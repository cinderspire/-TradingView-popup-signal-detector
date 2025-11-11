import heapq
import time
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import ccxt
import numpy as np
import pandas as pd

import multi_strategy_paper_trading as mst

BASE_TIMEFRAME = "5m"
DAYS_TO_FETCH = 365
DATA_DIR = Path(__file__).resolve().parent / "data"
PAIRS = [
    "BTC/USDT:USDT",
    "ETH/USDT:USDT",
    "XRP/USDT:USDT",
    "DOGE/USDT:USDT",
    "TRX/USDT:USDT",
    "ADA/USDT:USDT",
    "SOL/USDT:USDT",
    "PEPE/USDT:USDT",
]

mst.STARTING_BALANCE = 100.0
mst.ORDER_SIZE_USD = 5.0
mst.LEVERAGE = 4
mst.MAX_TOTAL_EXPOSURE = 0.5


BACKTEST_STRATEGIES = [
    mst.StrategyConfig(
        name="7RSI",
        strategy_type="multi_rsi",
        params={
            "timeframes": ["5m", "15m", "30m", "1h", "2h", "4h", "1d"],
            "threshold": 30,
            "min_confirmations": 4,
            "length": 14,
        },
        take_profit=0.03,
        step_perc=0.015,
        max_orders=4,
        order_size=5.0,
        stop_loss=0.06,
        cooldown=300,
    ),
    mst.StrategyConfig(
        name="7MACD",
        strategy_type="multi_macd",
        params={
            "timeframes": ["5m", "15m", "30m", "1h", "2h", "4h", "1d"],
            "fast": 12,
            "slow": 26,
            "signal": 9,
            "hist_threshold": -0.001,
            "require_crossover": True,
            "min_confirmations": 4,
        },
        take_profit=0.02,
        step_perc=0.015,
        max_orders=4,
        order_size=5.0,
        stop_loss=0.07,
        cooldown=300,
    ),
    mst.StrategyConfig(
        name="3RSI",
        strategy_type="triple_rsi",
        params={
            "timeframe": "15m",
            "rsi_params": {
                "rsi1": {"enabled": True, "long_threshold": 117, "long_period": 33},
                "rsi2": {"enabled": False, "long_threshold": 90, "long_period": 38},
                "rsi3": {"enabled": True, "long_threshold": 7, "long_period": 14},
            },
            "cci_params": {
                "cci1": {"enabled": False, "long_threshold": 257, "long_period": 21},
                "cci2": {"enabled": True, "long_threshold": 105, "long_period": 4},
                "cci3": {"enabled": True, "long_threshold": 350, "long_period": 34},
            },
            "bb_params": {"enabled": True, "period": 103, "deviation": 2.2},
        },
        take_profit=0.03,
        step_perc=0.015,
        max_orders=3,
        order_size=5.0,
        stop_loss=0.08,
        cooldown=300,
    ),
    mst.StrategyConfig(
        name="3MACD",
        strategy_type="triple_macd",
        params={
            "timeframe": "15m",
            "macd_params": {
                "macd1": {"enabled": True, "fast_period": 8, "slow_period": 21, "signal_period": 5, "long_threshold": -0.15},
                "macd2": {"enabled": False, "fast_period": 12, "slow_period": 26, "signal_period": 9, "long_threshold": -0.08},
                "macd3": {"enabled": True, "fast_period": 5, "slow_period": 13, "signal_period": 3, "long_threshold": -0.25},
            },
            "cci_params": {
                "cci1": {"enabled": False, "long_threshold": 257, "long_period": 21},
                "cci2": {"enabled": True, "long_threshold": 105, "long_period": 4},
                "cci3": {"enabled": True, "long_threshold": 350, "long_period": 34},
            },
            "bb_params": {"enabled": True, "period": 103, "deviation": 2.2},
        },
        take_profit=0.025,
        step_perc=0.015,
        max_orders=3,
        order_size=5.0,
        stop_loss=0.08,
        cooldown=300,
    ),
    mst.StrategyConfig(
        name="TrendTsunami",
        strategy_type="trend_tsunami",
        params={"timeframe": "1h"},
        take_profit=0.02,
        step_perc=0.015,
        max_orders=3,
        order_size=5.0,
        stop_loss=0.08,
        cooldown=600,
    ),
    mst.StrategyConfig(
        name="BullBearV2",
        strategy_type="bull_bear",
        params={
            "timeframe": "15m",
            "RMI_LENGTH": 25,
            "RMI_MOMENTUM": 7,
            "ADX_LENGTH": 79,
            "RSI_LENGTH": 55,
            "RMI_OVERSOLD": 31,
            "ADX_THRESHOLD_LONG": 14,
            "RSI_CENTER_LINE_LONG": 45,
            "LONG_POSITION": True,
        },
        take_profit=0.02,
        step_perc=0.015,
        max_orders=4,
        order_size=5.0,
        stop_loss=0.06,
        cooldown=300,
    ),
]


def pair_to_filename(pair: str) -> str:
    return pair.replace("/", "_").replace(":", "_")


def fetch_pair_dataframe(exchange, pair: str, timeframe: str, days: int, cache_dir: Path) -> pd.DataFrame:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{pair_to_filename(pair)}_{timeframe}_{days}d.csv"
    if cache_file.exists():
        cached = pd.read_csv(cache_file, parse_dates=["timestamp"], index_col="timestamp")
        if not cached.empty and (cached.index[-1] - cached.index[0]).days >= days - 5:
            return cached
    since = int((datetime.utcnow() - timedelta(days=days + 7)).timestamp() * 1000)
    end = exchange.milliseconds()
    timeframe_ms = exchange.parse_timeframe(timeframe) * 1000
    all_rows = []
    while since < end:
        try:
            batch = exchange.fetch_ohlcv(pair, timeframe, since=since, limit=1000)
        except Exception as exc:
            print(f"[warn] fetch error for {pair}: {exc}")
            break
        if not batch:
            break
        all_rows.extend(batch)
        last_ts = batch[-1][0]
        since = last_ts + timeframe_ms
        if last_ts >= end - timeframe_ms:
            break
        time.sleep(exchange.rateLimit / 1000)
    if not all_rows:
        print(f"[warn] no data pulled for {pair}")
        return pd.DataFrame()
    df = pd.DataFrame(all_rows, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df.drop_duplicates(subset="timestamp", keep="last", inplace=True)
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
    df.set_index("timestamp", inplace=True)
    df.sort_index(inplace=True)
    df = df[~df.index.duplicated(keep="last")]
    df = df.tz_localize(None)
    if df.empty:
        return df
    cutoff = df.index[-1] - pd.Timedelta(days=days)
    df = df[df.index >= cutoff]
    df.to_csv(cache_file)
    return df


class PairDataView:
    def __init__(self, cache: "PairDataCache", timestamp: pd.Timestamp):
        self.cache = cache
        self.timestamp = timestamp

    def get(self, timeframe: str) -> pd.DataFrame:
        frame = self.cache.ensure(timeframe)
        if frame.empty:
            return frame
        return frame.loc[: self.timestamp]


class PairDataCache:
    def __init__(self, base_df: pd.DataFrame, base_timeframe: str):
        self.base_timeframe = base_timeframe
        self.frames = {base_timeframe: base_df}

    def ensure(self, timeframe: str) -> pd.DataFrame:
        if timeframe not in self.frames:
            if timeframe == self.base_timeframe:
                self.frames[timeframe] = self.frames[self.base_timeframe]
            else:
                self.frames[timeframe] = mst.resample_dataframe(self.frames[self.base_timeframe], timeframe)
        return self.frames[timeframe]

    def view(self, timestamp: pd.Timestamp) -> PairDataView:
        return PairDataView(self, timestamp)


def compute_max_drawdown(equity_series: pd.Series) -> float:
    if equity_series.empty:
        return 0.0
    cumulative_max = equity_series.cummax()
    drawdowns = (equity_series / cumulative_max - 1.0) * 100.0
    return float(drawdowns.min())


class BacktestEngine:
    def __init__(self, pairs: list[str], strategy_configs: list[mst.StrategyConfig], base_timeframe: str):
        self.pairs = pairs
        self.strategy_configs = strategy_configs
        self.base_timeframe = base_timeframe
        self.required_timeframes = self._collect_required_timeframes()
        self.strategies: dict[str, mst.StrategyState] = {}
        self.latest_prices = {pair: np.nan for pair in pairs}
        self.equity_history: dict[str, list[tuple[pd.Timestamp, float]]] = {}
        self.max_collateral: dict[str, float] = {}
        self.order_sequence = 0
        for cfg in strategy_configs:
            state = mst.StrategyState(
                config=cfg,
                balance=mst.STARTING_BALANCE,
                equity=mst.STARTING_BALANCE,
                total_pnl=0.0,
                total_collateral_used=0.0,
                max_buying_power=mst.STARTING_BALANCE * mst.LEVERAGE * mst.MAX_TOTAL_EXPOSURE,
            )
            for pair in pairs:
                state.ensure_pair(pair)
                state.last_signals[pair] = pd.Timestamp("1970-01-01")
            self.strategies[cfg.name] = state
            self.equity_history[cfg.name] = []
            self.max_collateral[cfg.name] = 0.0

    def _collect_required_timeframes(self) -> set[str]:
        frames = {self.base_timeframe}
        for cfg in self.strategy_configs:
            if cfg.strategy_type in {"multi_rsi", "multi_macd"}:
                frames.update(cfg.params.get("timeframes", []))
            elif cfg.strategy_type in {"triple_rsi", "triple_macd"}:
                frames.add(cfg.params.get("timeframe", self.base_timeframe))
            elif cfg.strategy_type in {"trend_tsunami", "bull_bear"}:
                frames.add(cfg.params.get("timeframe", self.base_timeframe))
        return frames

    def generate_order_id(self) -> str:
        self.order_sequence += 1
        return f"BT_{self.order_sequence}"

    def calculate_available_collateral(self, state: mst.StrategyState) -> float:
        max_collateral = mst.STARTING_BALANCE * mst.MAX_TOTAL_EXPOSURE
        return max(0.0, max_collateral - state.total_collateral_used)

    def calculate_available_buying_power(self, state: mst.StrategyState) -> float:
        used_buying_power = state.total_collateral_used * mst.LEVERAGE
        available = state.max_buying_power - used_buying_power
        return max(0.0, available)

    def update_unrealized_pnl(self) -> None:
        for state in self.strategies.values():
            total_unrealized = 0.0
            for pair, position in state.positions.items():
                if position.size > 0 and position.entry_price > 0:
                    price = self.latest_prices.get(pair, np.nan)
                    if not np.isnan(price):
                        change = (price - position.entry_price) / position.entry_price
                        unrealized = change * position.collateral_used * mst.LEVERAGE
                        position.unrealized_pnl = unrealized
                        total_unrealized += unrealized
                    else:
                        position.unrealized_pnl = 0.0
                else:
                    position.unrealized_pnl = 0.0
            state.equity = state.balance + total_unrealized

    def check_order_fills(self, state: mst.StrategyState, pair: str, row: dict, timestamp: pd.Timestamp) -> None:
        orders = state.open_orders.get(pair, [])
        if not orders:
            return
        low_price = row["low"]
        filled_orders = []
        for order in orders:
            if order.filled:
                continue
            if low_price <= order.price:
                if self.calculate_available_collateral(state) < order.collateral:
                    continue
                state.total_collateral_used += order.collateral
                position = state.positions[pair]
                total_cost = position.entry_price * position.size + order.price * order.quantity
                total_size = position.size + order.quantity
                position.entry_price = total_cost / total_size if total_size > 0 else order.price
                position.size = total_size
                position.collateral_used += order.collateral
                order.filled = True
                filled_orders.append(order)
                state.trade_history.append(
                    {
                        "timestamp": timestamp.to_pydatetime(),
                        "pair": pair,
                        "strategy": state.config.name,
                        "side": "buy",
                        "quantity": order.quantity,
                        "price": order.price,
                        "collateral": order.collateral,
                        "leverage": mst.LEVERAGE,
                        "type": "entry",
                    }
                )
        if filled_orders:
            state.open_orders[pair] = [order for order in orders if not order.filled]

    def close_position(self, state: mst.StrategyState, pair: str, size: float, exit_price: float, reason: str, timestamp: pd.Timestamp) -> None:
        position = state.positions[pair]
        if size <= 0 or position.size <= 0 or position.entry_price <= 0:
            return
        price_change = (exit_price - position.entry_price) / position.entry_price
        collateral_used = position.collateral_used
        leveraged_pnl = price_change * collateral_used * mst.LEVERAGE
        state.total_collateral_used = max(0.0, state.total_collateral_used - collateral_used)
        state.balance += leveraged_pnl
        state.total_pnl += leveraged_pnl
        state.trade_history.append(
            {
                        "timestamp": timestamp.to_pydatetime(),
                        "pair": pair,
                        "strategy": state.config.name,
                        "side": "sell",
                        "quantity": size,
                        "price": exit_price,
                        "entry_price": position.entry_price,
                        "pnl": leveraged_pnl,
                        "leverage": mst.LEVERAGE,
                        "type": "exit",
                        "reason": reason,
                    }
        )
        state.positions[pair] = mst.PositionState()
        state.open_orders[pair] = []

    def check_take_profit(self, state: mst.StrategyState, pair: str, row: dict, timestamp: pd.Timestamp) -> None:
        position = state.positions[pair]
        if position.size <= 0 or position.entry_price <= 0:
            return
        tp_price = position.entry_price * (1 + state.config.take_profit)
        sl_price = position.entry_price * (1 - state.config.stop_loss) if state.config.stop_loss > 0 else None
        current_high = row["high"]
        current_low = row["low"]
        hit_tp = current_high >= tp_price
        hit_sl = sl_price is not None and current_low <= sl_price
        exit_price = None
        reason = ""
        if hit_tp and hit_sl:
            open_price = row["open"]
            dist_tp = abs(tp_price - open_price)
            dist_sl = abs(open_price - sl_price)
            if dist_sl <= dist_tp:
                exit_price = sl_price
                reason = "Stop Loss"
            else:
                exit_price = tp_price
                reason = "Take Profit"
        elif hit_tp:
            exit_price = tp_price
            reason = "Take Profit"
        elif hit_sl:
            exit_price = sl_price
            reason = "Stop Loss"
        if exit_price is not None:
            self.close_position(state, pair, position.size, exit_price, reason, timestamp)

    def place_limit_orders(self, state: mst.StrategyState, pair: str, current_price: float, timestamp: pd.Timestamp) -> None:
        if current_price <= 0:
            return
        available_collateral = self.calculate_available_collateral(state)
        available_buying_power = self.calculate_available_buying_power(state)
        single_collateral = state.config.order_size
        max_by_collateral = int(available_collateral // single_collateral) if single_collateral > 0 else 0
        max_by_power = int(available_buying_power // (single_collateral * mst.LEVERAGE)) if single_collateral > 0 else 0
        orders_to_place = min(state.config.max_orders, max_by_collateral, max_by_power)
        if orders_to_place <= 0:
            return
        for i in range(orders_to_place):
            limit_price = current_price * (1 - state.config.step_perc * i)
            if limit_price <= 0:
                continue
            quantity = single_collateral / limit_price
            order = mst.OrderState(
                id=self.generate_order_id(),
                pair=pair,
                side="buy",
                type="limit",
                quantity=quantity,
                price=limit_price,
                collateral=single_collateral,
                position_value=single_collateral * mst.LEVERAGE,
                timestamp=timestamp.to_pydatetime(),
                filled=False,
            )
            state.open_orders[pair].append(order)

    def _ready_for_entry(self, state: mst.StrategyState, pair: str, timestamp: pd.Timestamp) -> bool:
        position = state.positions[pair]
        if position.size > 0 or state.open_orders[pair]:
            return False
        last_signal = state.last_signals.get(pair, pd.Timestamp("1970-01-01"))
        if isinstance(last_signal, (int, float)):
            last_time = datetime.utcfromtimestamp(last_signal)
        else:
            last_time = pd.Timestamp(last_signal).to_pydatetime()
        elapsed = (timestamp.to_pydatetime() - last_time).total_seconds()
        return elapsed >= state.config.cooldown

    def process_timestamp(self, timestamp: pd.Timestamp, snapshot: dict[str, dict], pair_caches: dict[str, PairDataCache]) -> None:
        for pair, row in snapshot.items():
            self.latest_prices[pair] = row["close"]
        for state in self.strategies.values():
            for pair, row in snapshot.items():
                self.check_order_fills(state, pair, row, timestamp)
                self.check_take_profit(state, pair, row, timestamp)
        self.update_unrealized_pnl()
        for state in self.strategies.values():
            signal_func = mst.SIGNAL_FUNCTIONS.get(state.config.strategy_type)
            if not signal_func:
                continue
            for pair, row in snapshot.items():
                if not self._ready_for_entry(state, pair, timestamp):
                    continue
                pair_data = pair_caches[pair].view(timestamp)
                base_df = pair_data.get(self.base_timeframe)
                if base_df is None or base_df.empty or len(base_df) < 50:
                    continue
                signal_result = signal_func(pair, pair_data, state.config.params)
                if signal_result.get("signal"):
                    state.last_signals[pair] = timestamp
                    self.place_limit_orders(state, pair, row["close"], timestamp)
        self.update_unrealized_pnl()
        for name, state in self.strategies.items():
            self.equity_history[name].append((timestamp, state.equity))
            self.max_collateral[name] = max(self.max_collateral[name], state.total_collateral_used)

    def run(self, market_data: dict[str, pd.DataFrame]) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        pair_caches = {pair: PairDataCache(df, self.base_timeframe) for pair, df in market_data.items()}
        for cache in pair_caches.values():
            for tf in self.required_timeframes:
                cache.ensure(tf)
        heap: list[tuple[int, str]] = []
        iterators = {}
        for pair, df in market_data.items():
            df_sorted = df.sort_index()
            iterator = df_sorted.itertuples()
            try:
                first = next(iterator)
            except StopIteration:
                continue
            iterators[pair] = {"iterator": iterator, "current": first}
            heapq.heappush(heap, (int(first.Index.value), pair))
        if not heap:
            raise RuntimeError("No market data available for backtest.")
        while heap:
            ts_value, pair = heapq.heappop(heap)
            timestamp = pd.to_datetime(ts_value).tz_localize(None)
            snapshot_rows = {pair: iterators[pair]["current"]}
            ready_pairs = [pair]
            while heap and heap[0][0] == ts_value:
                _, other_pair = heapq.heappop(heap)
                snapshot_rows[other_pair] = iterators[other_pair]["current"]
                ready_pairs.append(other_pair)
            snapshot = {}
            for pr, row in snapshot_rows.items():
                snapshot[pr] = {
                    "open": float(row.open),
                    "high": float(row.high),
                    "low": float(row.low),
                    "close": float(row.close),
                    "volume": float(row.volume),
                }
            self.process_timestamp(timestamp, snapshot, pair_caches)
            for pr in ready_pairs:
                iterator_info = iterators[pr]
                try:
                    nxt = next(iterator_info["iterator"])
                    iterator_info["current"] = nxt
                    heapq.heappush(heap, (int(nxt.Index.value), pr))
                except StopIteration:
                    iterator_info["current"] = None
        summary = self.build_metrics()
        trades = self.build_trades_dataframe()
        equity = self.build_equity_dataframe()
        per_pair = self.build_pair_stats()
        return summary, trades, equity, per_pair

    def build_metrics(self) -> pd.DataFrame:
        records = []
        for name, state in self.strategies.items():
            equity_points = self.equity_history[name]
            equity_series = pd.Series([value for _, value in equity_points], index=[ts for ts, _ in equity_points])
            max_dd = compute_max_drawdown(equity_series)
            open_pnl = sum(pos.unrealized_pnl for pos in state.positions.values())
            exit_trades = [trade for trade in state.trade_history if trade.get("type") == "exit"]
            realized_pnl = sum(trade.get("pnl", 0.0) for trade in exit_trades)
            wins = sum(1 for trade in exit_trades if trade.get("pnl", 0.0) > 0)
            num_trades = len(exit_trades)
            win_rate = (wins / num_trades) * 100.0 if num_trades else 0.0
            records.append(
                {
                    "strategy": name,
                    "final_equity": state.equity,
                    "final_balance": state.balance,
                    "realized_pnl": realized_pnl,
                    "open_pnl": open_pnl,
                    "total_pnl": state.total_pnl,
                    "roi_pct": ((state.equity - mst.STARTING_BALANCE) / mst.STARTING_BALANCE) * 100.0,
                    "max_drawdown_pct": max_dd,
                    "num_trades": num_trades,
                    "win_rate_pct": win_rate,
                    "max_collateral_used": self.max_collateral[name],
                    "final_total_collateral": state.total_collateral_used,
                }
            )
        return pd.DataFrame(records)

    def build_trades_dataframe(self) -> pd.DataFrame:
        trades = []
        for name, state in self.strategies.items():
            for trade in state.trade_history:
                entry = trade.copy()
                entry["strategy"] = name
                trades.append(entry)
        if not trades:
            return pd.DataFrame()
        df = pd.DataFrame(trades)
        if "timestamp" in df.columns:
            df["timestamp"] = pd.to_datetime(df["timestamp"])
        df.sort_values("timestamp", inplace=True)
        return df

    def build_equity_dataframe(self) -> pd.DataFrame:
        rows = []
        for name, points in self.equity_history.items():
            for ts, value in points:
                rows.append({"timestamp": ts, "strategy": name, "equity": value})
        df = pd.DataFrame(rows)
        if not df.empty:
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            df.sort_values(["timestamp", "strategy"], inplace=True)
        return df

    def build_pair_stats(self) -> pd.DataFrame:
        rows = []
        for name, state in self.strategies.items():
            realized_by_pair = defaultdict(float)
            trade_counts = defaultdict(int)
            for trade in state.trade_history:
                if trade.get("type") == "exit":
                    realized_by_pair[trade["pair"]] += trade.get("pnl", 0.0)
                    trade_counts[trade["pair"]] += 1
            for pair in self.pairs:
                position = state.positions[pair]
                roi = 0.0
                if position.collateral_used > 0:
                    roi = ((realized_by_pair[pair] + position.unrealized_pnl) / position.collateral_used) * 100.0
                rows.append(
                    {
                        "strategy": name,
                        "pair": pair,
                        "realized_pnl": realized_by_pair[pair],
                        "unrealized_pnl": position.unrealized_pnl,
                        "roi_pct": roi,
                        "trades": trade_counts[pair],
                        "open_size": position.size,
                        "entry_price": position.entry_price,
                        "collateral_used": position.collateral_used,
                    }
                )
        return pd.DataFrame(rows)


def export_to_excel(path: Path, summary: pd.DataFrame, trades: pd.DataFrame, equity: pd.DataFrame, per_pair: pd.DataFrame) -> None:
    with pd.ExcelWriter(path, engine="xlsxwriter") as writer:
        summary.to_excel(writer, sheet_name="summary", index=False)
        per_pair.to_excel(writer, sheet_name="per_pair", index=False)
        equity.to_excel(writer, sheet_name="equity_curve", index=False)
        trades.to_excel(writer, sheet_name="trades", index=False)


def main() -> None:
    exchange = ccxt.bitget({"enableRateLimit": True, "options": {"defaultType": "swap"}})
    try:
        exchange.load_markets()
    except Exception as exc:
        print(f"[error] failed to load markets: {exc}")
        return
    market_data: dict[str, pd.DataFrame] = {}
    for pair in PAIRS:
        print(f"[info] downloading {pair} {BASE_TIMEFRAME} data...")
        df = fetch_pair_dataframe(exchange, pair, BASE_TIMEFRAME, DAYS_TO_FETCH, DATA_DIR)
        if df.empty:
            print(f"[warn] skipping {pair} (no usable data)")
            continue
        market_data[pair] = df
        print(f"[info] {pair}: {len(df)} candles loaded ({df.index[0]} to {df.index[-1]})")
    if not market_data:
        print("[error] no market data available, aborting.")
        return
    engine = BacktestEngine(list(market_data.keys()), BACKTEST_STRATEGIES, BASE_TIMEFRAME)
    summary_df, trades_df, equity_df, per_pair_df = engine.run(market_data)
    timestamp_tag = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    output_path = DATA_DIR / f"multi_strategy_backtest_{BASE_TIMEFRAME}_{DAYS_TO_FETCH}d_{timestamp_tag}.xlsx"
    export_to_excel(output_path, summary_df, trades_df, equity_df, per_pair_df)
    print("\nSummary metrics:")
    if not summary_df.empty:
        display_cols = ["strategy", "roi_pct", "max_drawdown_pct", "final_equity", "open_pnl", "num_trades", "win_rate_pct"]
        print(summary_df[display_cols].round(4))
    else:
        print("No trades executed.")
    print(f"\nExcel report saved to: {output_path}")


if __name__ == "__main__":
    main()
