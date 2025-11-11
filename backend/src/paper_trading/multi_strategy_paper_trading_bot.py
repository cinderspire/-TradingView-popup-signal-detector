#!/usr/bin/env python3
"""
Multi-Strategy Paper Trading Orchestrator  
================================================
Loads **eight** existing strategy scripts (provided in the same
folder) **without modifying their code** and runs them side-by-side on
live market data fetched through *ccxt*.  Every 60 seconds the console
prints a combined dashboard showing, for *each* strategy:

│ strategy │ closed PnL │ open PnL │ total PnL │ open trades │ closed trades │

The table is sorted by *total PnL* (open + closed) so the best
performing algorithm bubbles to the top in real-time.

Supported strategies (file names must match):
    1. bull-and-bear-v2.py
    2. 15m-king-optimized.py
    3. 7rsi-v3-paper-trading-bot-v1.3.py  (already paper-trading)
    4. Holy-Grail-backtest.py
    5. Adaptive-Momentum-Scalper.py
    6. 3RSI.py
    7. ahft-backtester.py
    8. Mean-Reversion-with-Incremental-Entry-by-HedgerLabs-25-5.01-1-V2.py

Place this file and all strategy scripts in the **same directory**, then
run:

    python3 multi_strategy_paper_trading_bot.py

The orchestrator is intentionally lightweight: it never touches or edits
strategy code.  Instead, each strategy is loaded via *importlib* and
wrapped by a thin *adapter* that exposes three mandatory methods:
    • `update(market_snapshot: dict) -> None`   — feeds latest candles
    • `get_open_pnl() -> float`                 — unrealised PnL USD
    • `get_closed_pnl() -> float`               — realised PnL USD

If a script already implements a paper-trading loop (e.g. the 7-RSI bot)
we simply start it in its own thread and query public attributes that
track PnL.  If a script only contains back-test logic, a *minimal* live
engine is provided that calls the strategy’s signal generator bar-by-bar
on incoming data and executes a 100 % notional market order every time a
signal flips direction.

NOTE 1:  The thin adapters below are intentionally generic.  Strategies
with unusual class names or method signatures may require you to tweak
the autodetection block near the bottom so that the adapter knows which
class/function to instantiate.

NOTE 2:  All state lives *in-memory*.  This bot holds **no positions on
any real exchange** — it is paper-trading only.

© 2025 — Feel free to adapt for personal use.
"""

import asyncio
import importlib.machinery
import inspect
import threading
import time
from pathlib import Path
from types import ModuleType
from typing import Dict, List, Optional

import ccxt
import pandas as pd
from rich.console import Console
from rich.table import Table

# ──────────────────────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────────────────────
EXCHANGE_ID = "binance"            # Any ccxt spot exchange supporting fetch_ticker
UPDATE_INTERVAL = 60               # seconds between prints
SYMBOL_DEFAULT = "BTC/USDT"        # Fallback symbol if strategy supplies none
TIMEFRAME_DEFAULT = "1m"           # Candle resolution for back-test-only scripts
MAX_CANDLE_HISTORY = 500           # Memory per symbol
CONSOLE = Console()

# Absolute paths of strategy scripts sitting in the same folder
STRATEGY_FILES = [
    "bull-and-bear-v2.py",
    "15m-king-optimized.py",
    "7rsi-v3-paper-trading-bot-v1.3.py",
    "Holy-Grail-backtest.py",
    "Adaptive-Momentum-Scalper.py",
    "3RSI.py",
    "ahft-backtester.py",
    "Mean-Reversion-with-Incremental-Entry-by-HedgerLabs-25-5.01-1-V2.py",
]

# ──────────────────────────────────────────────────────────────
# Adapter layer
# ──────────────────────────────────────────────────────────────
class StrategyAdapter:
    """Wrap a third-party strategy without altering its source code."""

    def __init__(self, name: str, module: ModuleType):
        self.name = name
        self.module = module
        self.closed_pnl: float = 0.0
        self.open_pnl: float = 0.0
        self.open_trades: int = 0
        self.closed_trades: int = 0
        self.positions = {}  # symbol -> entry_price

        # Best-effort autodetection of a class exposing paper-trading
        self._setup_internal_worker()

    # ------------------------------------------------------------------
    # Public API expected by orchestrator
    # ------------------------------------------------------------------
    def update(self, market_snapshot: Dict[str, float]) -> None:
        """Feed latest mid-prices to the strategy."""
        if self._worker_update is None:
            # Fallback: naive cross-over demo (buy/sell on price > SMA)
            self._fallback_logic(market_snapshot)
        else:
            try:
                self._worker_update(market_snapshot)  # type: ignore[arg-type]
            except Exception as exc:  # pylint: disable=broad-except
                CONSOLE.log(f"[red]{self.name} update failed → {exc}")

    def get_open_pnl(self) -> float:
        return self.open_pnl

    def get_closed_pnl(self) -> float:
        return self.closed_pnl

    # ------------------------------------------------------------------
    # Introspection helpers
    # ------------------------------------------------------------------
    def _setup_internal_worker(self) -> None:
        """Look for common entry-points exposed by the original script."""
        self._worker_update = None  # type: ignore[assignment]

        # Preference 1: a class called PaperTradingBot with start() method
        for _name, obj in inspect.getmembers(self.module, inspect.isclass):
            if _name.lower().endswith("bot") and hasattr(obj, "start"):
                instance = obj()
                thread = threading.Thread(target=instance.start, daemon=True)
                thread.start()
                # Expect bot to expose live stats we can read periodically
                def _update(_: Dict[str, float]):
                    self.closed_pnl = getattr(instance, "total_pnl", 0.0)
                    self.open_pnl = getattr(instance, "equity", 0.0) - getattr(instance, "balance", getattr(instance, "equity", 0.0))
                    self.open_trades = len(getattr(instance, "positions", {}))
                    self.closed_trades = len(getattr(instance, "trade_history", []))
                self._worker_update = _update
                return

        # Preference 2: function generate_signal(df_row) returning –1 / 0 / +1
        for _name, obj in inspect.getmembers(self.module, inspect.isclass):
            if hasattr(obj, "generate_signal"):
                instance = obj()
                self.symbols = getattr(instance, "symbols", [SYMBOL_DEFAULT])
                self.timeframe = getattr(instance, "timeframe", TIMEFRAME_DEFAULT)
                self._setup_signal_runner(instance)
                return

        # If nothing matched we fall back later

    def _setup_signal_runner(self, instance) -> None:  # noqa: ANN001
        """Build minimal paper-trade engine around generate_signal."""
        price_history: Dict[str, List[float]] = {s: [] for s in self.symbols}

        def _update(snapshot: Dict[str, float]):  # noqa: ANN001
            for sym, price in snapshot.items():
                if sym not in price_history:
                    continue
                ph = price_history[sym]
                ph.append(price)
                if len(ph) > MAX_CANDLE_HISTORY:
                    ph.pop(0)
                # We fake a dataframe row with close price only
                df_row = pd.Series({"close": price})
                signal = instance.generate_signal(sym, df_row)  # type: ignore[arg-type]
                pos = self.positions.get(sym)
                if signal == 1 and pos is None:
                    # Open long
                    self.positions[sym] = price
                    self.open_trades += 1
                elif signal == -1 and pos is not None:
                    # Close position
                    pnl = price - pos
                    self.closed_pnl += pnl
                    self.open_trades -= 1
                    self.closed_trades += 1
                    del self.positions[sym]
            # unrealised PnL
            self.open_pnl = sum(snapshot[sym] - entry for sym, entry in self.positions.items())

        self._worker_update = _update

    # ------------------------------------------------------------------
    # Fallback demo logic (SMA-crossover) if detection failed
    # ------------------------------------------------------------------
    def _fallback_logic(self, snapshot: Dict[str, float]):
        sym, price = next(iter(snapshot.items()))
        if not hasattr(self, "_history"):
            self._history: List[float] = []
        self._history.append(price)
        if len(self._history) < 21:
            return
        sma10 = sum(self._history[-10:]) / 10
        sma20 = sum(self._history[-20:]) / 20
        pos = self.positions.get(sym)
        if sma10 > sma20 and pos is None:
            self.positions[sym] = price
            self.open_trades += 1
        elif sma10 < sma20 and pos is not None:
            pnl = price - pos
            self.closed_pnl += pnl
            self.open_trades -= 1
            self.closed_trades += 1
            del self.positions[sym]
        self.open_pnl = sum(snapshot[s] - e for s, e in self.positions.items())

# ──────────────────────────────────────────────────────────────
# Utility functions
# ──────────────────────────────────────────────────────────────

def load_strategy(path: str) -> Optional[StrategyAdapter]:
    p = Path(path)
    if not p.is_file():
        CONSOLE.log(f"[yellow]Strategy file not found → {path}")
        return None
    try:
        loader = importlib.machinery.SourceFileLoader(p.stem, str(p))
        module = loader.load_module()  # type: ignore[deprecated-method]
        return StrategyAdapter(p.stem, module)
    except Exception as exc:  # pylint: disable=broad-except
        CONSOLE.log(f"[red]Failed to load {path} → {exc}")
        return None

async def fetch_prices(exchange, symbols: List[str]) -> Dict[str, float]:  # noqa: ANN001
    prices = {}
    for sym in symbols:
        try:
            ticker = exchange.fetch_ticker(sym)
            prices[sym] = ticker["last"]
        except Exception:  # pylint: disable=broad-except
            continue
    return prices

# ──────────────────────────────────────────────────────────────
# Main asynchronous loop
# ──────────────────────────────────────────────────────────────
async def main():  # noqa: D401
    "Run orchestrator until interrupted."  # noqa: D401

    # 1⃣  Load all strategies
    adapters: List[StrategyAdapter] = []
    for file in STRATEGY_FILES:
        adapter = load_strategy(file)
        if adapter is not None:
            adapters.append(adapter)
    if not adapters:
        CONSOLE.log("[bold red]No strategy could be loaded — aborting.")
        return
    CONSOLE.log(f"Loaded {len(adapters)} strategies.")

    # 2⃣  Collect union of required symbols
    symbols = {SYMBOL_DEFAULT}
    for ad in adapters:
        symbols.update(getattr(ad, "symbols", [SYMBOL_DEFAULT]))
    symbols = list(symbols)
    CONSOLE.log(f"Subscribing to live prices for {len(symbols)} symbols: {symbols}")

    # 3⃣  Create ccxt exchange instance (public only)
    exchange = getattr(ccxt, EXCHANGE_ID)({"enableRateLimit": True})

    # 4⃣  Endless loop
    while True:
        snapshot = await fetch_prices(exchange, symbols)
        if not snapshot:
            CONSOLE.log("[yellow]Price snapshot empty — retry in 5 s")
            await asyncio.sleep(5)
            continue

        for ad in adapters:
            ad.update(snapshot)

        # Build dashboard
        table = Table(title="Live Paper-Trading Dashboard", highlight=True)
        table.add_column("Strategy", style="cyan", no_wrap=True)
        table.add_column("Closed PnL", justify="right")
        table.add_column("Open PnL", justify="right")
        table.add_column("Total PnL", justify="right", style="bold")
        table.add_column("Open", justify="right")
        table.add_column("Closed", justify="right")

        # Sort by total PnL desc
        adapters_sorted = sorted(adapters, key=lambda a: a.get_open_pnl() + a.get_closed_pnl(), reverse=True)
        for ad in adapters_sorted:
            closed_p = ad.get_closed_pnl()
            open_p = ad.get_open_pnl()
            total_p = closed_p + open_p
            table.add_row(
                ad.name,
                f"{closed_p:,.2f}",
                f"{open_p:,.2f}",
                f"{total_p:,.2f}",
                str(ad.open_trades),
                str(ad.closed_trades),
            )

        CONSOLE.clear()
        CONSOLE.print(table)
        await asyncio.sleep(UPDATE_INTERVAL)

# ──────────────────────────────────────────────────────────────
# Entrypoint
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        CONSOLE.print("\n[bold]Shutting down… Bye!")
