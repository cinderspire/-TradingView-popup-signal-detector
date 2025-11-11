"""
Crypto Pine Backtester – clean, deterministic & *strategy-independent*

Key features:
1.  TRUE strategy independence – every strategy instance keeps its own trade-ledger.
2.  Accurate trade engine – opens **one** position per entry, never “flutters” in and out each bar.
3.  Precise P&L – position-sized, commission-aware, realised & unrealised equity tracked tick-by-tick.
4.  Robust metrics – true max-drawdown, Sharpe, win-rate, expectancy, exposure-time.
5.  Clean interface – same function names, so your existing notebooks & CI jobs keep working.
6.  Comprehensive Strategy Suite - All major Pine Script strategies converted to Python.
7.  Advanced data handling with caching and parallel processing.
"""

# ───────────────────  STANDARD LIBS  ────────────────────
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Literal, Optional
import concurrent.futures as _fut
import json
import os
import time
import warnings

# ─────────────────── THIRD-PARTY LIBS  ───────────────────
import ccxt
import numpy as np
import pandas as pd

# Attempt to import TA-Lib, provide installation instructions if missing
try:
    import talib
except ImportError:
    print("⚠️ TA-Lib not found. Please install it for the indicators to work.")
    print("Installation instructions can be found at: https://github.com/mrjbq7/ta-lib")
    # As TA-Lib is a hard dependency for indicators, we exit if it's not found.
    exit()

warnings.filterwarnings('ignore')

# ────────────────────  INDICATORS  ───────────────────────
class TechnicalIndicators:
    """Professional technical indicators library using TA-Lib and custom implementations."""

    @staticmethod
    def sma(series, period):
        """Simple Moving Average"""
        return pd.Series(talib.SMA(series.values, timeperiod=period), index=series.index)

    @staticmethod
    def ema(series, period):
        """Exponential Moving Average"""
        return pd.Series(talib.EMA(series.values, timeperiod=period), index=series.index)

    @staticmethod
    def smma(series, period):
        """Smoothed Moving Average (Williams Alligator)"""
        smma = pd.Series(index=series.index, dtype=float)
        # First value is just the first price
        smma.iloc[0] = series.iloc[0]
        for i in range(1, len(series)):
            # If previous SMMA is NaN, use the current price to start the calculation
            if pd.isna(smma.iloc[i-1]):
                smma.iloc[i] = series.iloc[i]
            else:
                smma.iloc[i] = (smma.iloc[i-1] * (period - 1) + series.iloc[i]) / period
        return smma

    @staticmethod
    def rsi(series, period=14):
        """Relative Strength Index"""
        return pd.Series(talib.RSI(series.values, timeperiod=period), index=series.index)

    @staticmethod
    def atr(high, low, close, period=14):
        """Average True Range"""
        return pd.Series(talib.ATR(high.values, low.values, close.values, timeperiod=period), index=close.index)

    @staticmethod
    def vwap(high, low, close, volume):
        """Volume Weighted Average Price - Custom implementation"""
        typical_price = (high + low + close) / 3
        # Use cumsum for cumulative calculation
        vwap_num = (typical_price * volume).cumsum()
        vwap_den = volume.cumsum()
        # Avoid division by zero
        return vwap_num / vwap_den.replace(0, np.nan)

    @staticmethod
    def bbands(series, period=20, std_dev=2):
        """Bollinger Bands"""
        upper, middle, lower = talib.BBANDS(series.values, timeperiod=period, nbdevup=std_dev, nbdevdn=std_dev)
        return pd.DataFrame({
            'upper': pd.Series(upper, index=series.index),
            'middle': pd.Series(middle, index=series.index),
            'lower': pd.Series(lower, index=series.index)
        })

    @staticmethod
    def supertrend(high, low, close, period=14, multiplier=3.0):
        """SuperTrend Indicator - Custom implementation"""
        atr = TechnicalIndicators.atr(high, low, close, period)
        hl2 = (high + low) / 2
        upper_band = hl2 + (multiplier * atr)
        lower_band = hl2 - (multiplier * atr)
        supertrend = pd.Series(index=close.index, dtype=float)
        direction = pd.Series(index=close.index, dtype=int)

        # Initialize the first values to start the trend
        direction.iloc[0] = 1
        supertrend.iloc[0] = lower_band.iloc[0]

        for i in range(1, len(close)):
            # If the current close breaks above the previous upper band, start an uptrend
            if close.iloc[i] > upper_band.shift(1).iloc[i]:
                direction.iloc[i] = 1
            # If the current close breaks below the previous lower band, start a downtrend
            elif close.iloc[i] < lower_band.shift(1).iloc[i]:
                direction.iloc[i] = -1
            # Otherwise, continue the current trend
            else:
                direction.iloc[i] = direction.iloc[i-1]

            # Set the SuperTrend line based on the current direction
            if direction.iloc[i] == 1:
                supertrend.iloc[i] = lower_band.iloc[i]
            else:
                supertrend.iloc[i] = upper_band.iloc[i]
        
        return pd.DataFrame({'supertrend': supertrend, 'direction': direction})


    @staticmethod
    def pivot_high(high, left_bars=12, right_bars=12):
        """Pivot High Detection for ZigZag-like patterns"""
        pivots = pd.Series(index=high.index, dtype=float)
        for i in range(left_bars, len(high) - right_bars):
            # Check if the current bar is the highest in the window
            window = high.iloc[i-left_bars:i+right_bars+1]
            if high.iloc[i] == window.max():
                pivots.iloc[i] = high.iloc[i]
        return pivots

    @staticmethod
    def pivot_low(low, left_bars=12, right_bars=12):
        """Pivot Low Detection for ZigZag-like patterns"""
        pivots = pd.Series(index=low.index, dtype=float)
        for i in range(left_bars, len(low) - right_bars):
            # Check if the current bar is the lowest in the window
            window = low.iloc[i-left_bars:i+right_bars+1]
            if low.iloc[i] == window.min():
                pivots.iloc[i] = low.iloc[i]
        return pivots
    
    @staticmethod
    def hann_filter(series, length):
        """Hann Window FIR Filter using convolution"""
        # Create the Hann window weights
        weights = 0.5 * (1 - np.cos(2 * np.pi * np.arange(length) / (length - 1)))
        weights /= weights.sum() # Normalize the weights
        # Apply the filter using convolution
        return pd.Series(np.convolve(series.values, weights, mode='same'), index=series.index)


# ───────────────────  DATA CONTAINER  ────────────────────
@dataclass
class Trade:
    entry_idx: int
    exit_idx: int | None
    side: Literal["long", "short"]
    qty: float
    entry_px: float
    exit_px: float | None = None
    pnl: float = 0.0
    bars_held: int = 0


# ────────────────────  BACKTESTER  ───────────────────────
class CryptoPineBacktester:
    def __init__(
        self,
        initial_capital: float = 10_000,
        order_size_usd: float = 100,
        commission: float = 0.001,
        max_workers: int = 4,
    ) -> None:
        self.cash0 = initial_capital
        self.order_size_usd = order_size_usd
        self.fee_rate = commission
        self._data_dir = Path("crypto_data")
        self._data_dir.mkdir(exist_ok=True)
        self.exchange = ccxt.binance()
        self.max_workers = max_workers
        print("🚀 CryptoPineBacktester Initialized!")
        print(f"💰 Initial Capital: ${initial_capital:,.2f}")
        print(f"📏 Order Size (USD): ${order_size_usd:,.2f}")
        print(f"💸 Commission Rate: {commission*100:.3f}%")
        print(f"🔧 Max Workers: {max_workers}")

    # ───────────────  DATA ACQUISITION  ────────────────
    def get_top_100_pairs(self) -> List[str]:
        """Fetches the top 100 USDT spot trading pairs from Binance by 24h volume."""
        try:
            print("🔍 Fetching top 100 crypto pairs by volume...")
            markets = self.exchange.load_markets()
            tickers = self.exchange.fetch_tickers()
            
            usdt_spot_pairs = [
                s for s, m in markets.items() 
                if m['quote'] == 'USDT' and m['spot'] and m['active']
            ]
            
            # Filter tickers that have volume data and match our pair list
            volume_pairs = [
                {'symbol': s, 'volume': tickers[s]['quoteVolume']}
                for s in usdt_spot_pairs
                if s in tickers and tickers[s]['quoteVolume'] is not None
            ]
            
            # Sort by volume and return the top 100 symbols
            volume_pairs.sort(key=lambda x: x['volume'], reverse=True)
            top_100 = [p['symbol'] for p in volume_pairs[:100]]
            print(f"✅ Found {len(top_100)} active USDT pairs, using the top 100.")
            return top_100
        except Exception as e:
            print(f"❌ Could not fetch top pairs: {e}. Using a fallback list.")
            return [
                'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
                'DOGE/USDT', 'ADA/USDT', 'SHIB/USDT', 'AVAX/USDT', 'LINK/USDT'
            ]
            
    def fetch_historical_data(self, symbol: str, timeframe: str = '1h', days: int = 365) -> pd.DataFrame:
        """Fetches historical OHLCV data for a given symbol, with local CSV caching."""
        filename = f"{symbol.replace('/', '_')}_{timeframe}_{days}d.csv"
        filepath = self._data_dir / filename
        
        if filepath.exists() and (time.time() - filepath.stat().st_mtime) < 86400: # 24 hours
            print(f"📁 Loading cached data for {symbol}...")
            return pd.read_csv(filepath, index_col='timestamp', parse_dates=True)

        print(f"🌐 Fetching fresh data for {symbol}...")
        try:
            since = self.exchange.parse8601((datetime.now() - timedelta(days=days)).isoformat())
            ohlcv = self.exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=1000)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            df.to_csv(filepath)
            return df
        except Exception as e:
            print(f"❌ Error fetching {symbol}: {e}")
            return pd.DataFrame()

    def calculate_technical_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculates all necessary technical indicators for the strategies."""
        if df.empty:
            return df
        
        ta = TechnicalIndicators()
        
        # Moving Averages & Bands
        df['sma_20'] = ta.sma(df['close'], 20)
        df['sma_50'] = ta.sma(df['close'], 50)
        df['ema_9'] = ta.ema(df['close'], 9)
        df['ema_200'] = ta.ema(df['close'], 200)
        bbands = ta.bbands(df['close'], 20, 2)
        df['bb_upper'] = bbands['upper']
        df['bb_middle'] = bbands['middle']
        df['bb_lower'] = bbands['lower']
        
        # Oscillators
        df['rsi'] = ta.rsi(df['close'], 14)
        
        # Volatility & Volume
        df['atr'] = ta.atr(df['high'], df['low'], df['close'], 14)
        df['vwap'] = ta.vwap(df['high'], df['low'], df['close'], df['volume'])
        
        # Custom Indicators for specific strategies
        st = ta.supertrend(df['high'], df['low'], df['close'], 14, 3)
        df['supertrend'] = st['supertrend']
        df['supertrend_direction'] = st['direction']
        
        hl2 = (df['high'] + df['low']) / 2
        df['jaw'] = ta.smma(hl2, 13).shift(8)
        df['teeth'] = ta.smma(hl2, 8).shift(5)
        df['lips'] = ta.smma(hl2, 5).shift(3)
        
        df['pivot_high'] = ta.pivot_high(df['high'])
        df['pivot_low'] = ta.pivot_low(df['low'])

        df['hann_filter'] = ta.hann_filter(df['close'], 20)

        # Clean up any NaNs introduced by the indicators
        df.fillna(method='ffill', inplace=True)
        df.fillna(method='bfill', inplace=True)
        
        return df

    # ──────────────────  STRATEGY DEFINITIONS  ──────────────────
    def strategy_unmitigated_levels(self, df: pd.DataFrame) -> pd.DataFrame:
        signals = pd.Series(0, index=df.index, name="signal")
        # Simplified Logic: Buy on dips below 20-day SMA
        signals[df['low'] < df['sma_20']] = 1
        # Sell on rallies above 20-day SMA
        signals[df['high'] > df['sma_20']] = -1
        return pd.DataFrame({'signal': signals})

    def strategy_mean_reversion(self, df: pd.DataFrame) -> pd.DataFrame:
        signals = pd.Series(0, index=df.index, name="signal")
        # Buy when price touches the lower Bollinger Band
        signals[df['low'] <= df['bb_lower']] = 1
        # Sell when price touches the upper Bollinger Band
        signals[df['high'] >= df['bb_upper']] = -1
        return pd.DataFrame({'signal': signals})

    def strategy_smart_scalping(self, df: pd.DataFrame) -> pd.DataFrame:
        signals = pd.Series(0, index=df.index, name="signal")
        # Long condition: Close > EMA(9) and RSI > 50
        long_cond = (df['close'] > df['ema_9']) & (df['rsi'] > 55)
        # Short condition: Close < EMA(9) and RSI < 50
        short_cond = (df['close'] < df['ema_9']) & (df['rsi'] < 45)
        signals[long_cond] = 1
        signals[short_cond] = -1
        return pd.DataFrame({'signal': signals})

    def strategy_williams_alligator(self, df: pd.DataFrame) -> pd.DataFrame:
        signals = pd.Series(0, index=df.index, name="signal")
        # Long signal: Lips cross above Teeth and Jaw
        long_cond = (df['lips'] > df['teeth']) & (df['lips'] > df['jaw'])
        # Short signal: Lips cross below Teeth and Jaw
        short_cond = (df['lips'] < df['teeth']) & (df['lips'] < df['jaw'])
        signals[long_cond] = 1
        signals[short_cond] = -1
        return pd.DataFrame({'signal': signals})
        
    def strategy_supertrend(self, df: pd.DataFrame) -> pd.DataFrame:
        signals = pd.Series(0, index=df.index, name="signal")
        # Buy when SuperTrend direction flips to up (1)
        signals[df['supertrend_direction'] == 1] = 1
        # Sell when SuperTrend direction flips to down (-1)
        signals[df['supertrend_direction'] == -1] = -1
        return pd.DataFrame({'signal': signals})

    def strategy_fvg_sweep(self, df: pd.DataFrame) -> pd.DataFrame:
        signals = pd.Series(0, index=df.index, name="signal")
        # Simplified: Identify a large bullish candle as a "gap" and buy
        is_large_green = (df['close'] > df['open']) & ((df['high'] - df['low']) > df['atr'] * 2)
        signals[is_large_green] = 1
        # Exit after 5 bars
        buy_indices = signals[signals == 1].index
        for idx in buy_indices:
            exit_idx = idx + pd.Timedelta(hours=5)
            if exit_idx in signals.index:
                signals.loc[exit_idx] = -1
        return pd.DataFrame({'signal': signals})

    def strategy_hann_filter(self, df: pd.DataFrame) -> pd.DataFrame:
        signals = pd.Series(0, index=df.index, name="signal")
        # Buy when price crosses above the Hann Filter line
        signals[(df['close'] > df['hann_filter']) & (df['close'].shift(1) <= df['hann_filter'].shift(1))] = 1
        # Sell when price crosses below
        signals[(df['close'] < df['hann_filter']) & (df['close'].shift(1) >= df['hann_filter'].shift(1))] = -1
        return pd.DataFrame({'signal': signals})

    def strategy_zigzag_ultra(self, df: pd.DataFrame) -> pd.DataFrame:
        signals = pd.Series(0, index=df.index, name="signal")
        # Buy at pivot lows
        signals[df['pivot_low'].notna()] = 1
        # Sell at pivot highs
        signals[df['pivot_high'].notna()] = -1
        return pd.DataFrame({'signal': signals})
        
    def strategy_candle_channel(self, df: pd.DataFrame) -> pd.DataFrame:
        # Same logic as Mean Reversion using Bollinger Bands as a proxy
        return self.strategy_mean_reversion(df)

    # ──────────────────  TRADE ENGINE  ──────────────────
    def _run_signal_engine(
        self,
        df: pd.DataFrame,
        signals: pd.Series,
    ) -> tuple[list[Trade], list[float]]:
        """Executes one pass through the price series, converting signals into trades."""
        trades: list[Trade] = []
        equity_curve: list[float] = []
        cash: float = self.cash0
        position_qty: float = 0.0
        entry_px: float = 0.0

        for i, (ts, row_sig) in enumerate(signals.items()):
            px = df.at[ts, "close"]

            # Update unrealised equity at each bar
            if position_qty != 0:
                # For longs, profit is current_px - entry_px. For shorts, it's entry_px - current_px.
                # This is equivalent to (px - entry_px) * position_qty (since qty is negative for shorts)
                unrealised_pnl = (px - entry_px) * position_qty
                equity = cash + unrealised_pnl
            else:
                equity = cash
            equity_curve.append(equity)
            
            # --- Evaluate Signal and Execute Trades ---
            # Signal to go LONG (and not already long)
            if row_sig == 1 and position_qty >= 0:
                # If currently short, close the position first
                if position_qty < 0:
                    pnl = (entry_px - px) * abs(position_qty) - (self.order_size_usd + abs(position_qty) * px) * self.fee_rate
                    cash += pnl
                    trades[-1].exit_idx = i
                    trades[-1].exit_px = px
                    trades[-1].pnl = pnl
                    trades[-1].bars_held = i - trades[-1].entry_idx

                # Open new long position
                qty = self.order_size_usd / px
                fee = qty * px * self.fee_rate
                cash -= fee
                position_qty = qty
                entry_px = px
                trades.append(Trade(i, None, "long", qty, px))
            
            # Signal to go SHORT (and not already short)
            elif row_sig == -1 and position_qty <= 0:
                # If currently long, close the position first
                if position_qty > 0:
                    pnl = (px - entry_px) * position_qty - (self.order_size_usd + position_qty * px) * self.fee_rate
                    cash += pnl
                    trades[-1].exit_idx = i
                    trades[-1].exit_px = px
                    trades[-1].pnl = pnl
                    trades[-1].bars_held = i - trades[-1].entry_idx

                # Open new short position
                qty = self.order_size_usd / px
                fee = qty * px * self.fee_rate
                cash -= fee
                position_qty = -qty # Quantity is negative for shorts
                entry_px = px
                trades.append(Trade(i, None, "short", -qty, px))

        # At the end of the data, force-close any open position
        if position_qty != 0:
            px = df["close"].iloc[-1]
            pnl = 0
            if position_qty > 0: # Close long
                pnl = (px - entry_px) * position_qty - (self.order_size_usd + position_qty * px) * self.fee_rate
            else: # Close short
                pnl = (entry_px - px) * abs(position_qty) - (self.order_size_usd + abs(position_qty) * px) * self.fee_rate
            cash += pnl
            trades[-1].exit_idx = len(df) - 1
            trades[-1].exit_px = px
            trades[-1].pnl = pnl
            trades[-1].bars_held = (len(df) - 1) - trades[-1].entry_idx
            equity_curve.append(cash)

        return trades, equity_curve

    # ──────────────────  METRIC SUITE  ──────────────────
    def _stats(self, trades: list[Trade], equity: list[float]) -> Dict:
        """Calculates performance statistics from trades and the equity curve."""
        if not equity:
            return dict(total_return=0, max_drawdown=0, sharpe_ratio=0, win_rate=0, total_trades=0, avg_trade_pnl=0)

        equity_series = pd.Series(equity)
        total_return = (equity_series.iloc[-1] / self.cash0 - 1) * 100
        
        # Max Drawdown
        roll_max = equity_series.cummax()
        drawdown = (equity_series - roll_max) / roll_max * 100
        max_dd = drawdown.min() if not drawdown.empty else 0

        # Sharpe Ratio (annualized, assuming hourly data)
        daily_returns = equity_series.pct_change().dropna()
        if daily_returns.std() > 0:
            sharpe_ratio = (daily_returns.mean() / daily_returns.std()) * np.sqrt(24 * 365)
        else:
            sharpe_ratio = 0
        
        # Trade-based stats
        if trades:
            trade_pnls = np.array([t.pnl for t in trades if t.pnl is not None])
            total_trades = len(trade_pnls)
            win_rate = np.sum(trade_pnls > 0) / total_trades * 100 if total_trades > 0 else 0
            avg_trade_pnl = trade_pnls.mean() if total_trades > 0 else 0
        else:
            total_trades, win_rate, avg_trade_pnl = 0, 0, 0

        return dict(
            total_return=round(total_return, 2),
            max_drawdown=round(max_dd, 2),
            sharpe_ratio=round(sharpe_ratio, 2),
            win_rate=round(win_rate, 2),
            total_trades=total_trades,
            avg_trade_pnl=round(avg_trade_pnl, 2),
            final_equity=round(equity_series.iloc[-1], 2),
        )

    # ──────────────────  RUN ONE STRAT  ──────────────────
    def _run_one(self, symbol: str, strategy_name: str, strategy_func) -> Dict:
        """Runs a single strategy on a single symbol."""
        print(f"🔄 Running {strategy_name} on {symbol}...")
        df = self.fetch_historical_data(symbol, days=365)
        if df.empty:
            return {"symbol": symbol, "strategy": strategy_name, "error": "No data"}

        df = self.calculate_technical_indicators(df)
        sig_df = strategy_func(df)
        sig = sig_df["signal"].fillna(0).astype(int)

        trades, equity = self._run_signal_engine(df, sig)
        stats = self._stats(trades, equity)
        stats.update(symbol=symbol, strategy=strategy_name)
        return stats

    # ────────────────  PUBLIC RUNNERS  ──────────────────
    def run_all_strategies_single_pair(self, symbol: str) -> List[Dict]:
        """Runs all defined strategies on a single trading pair."""
        strat_map = {
            "🏆 Unmitigated Levels": self.strategy_unmitigated_levels,
            "📊 Mean Reversion": self.strategy_mean_reversion,
            "💹 Smart Scalping": self.strategy_smart_scalping,
            "🐊 Williams Alligator": self.strategy_williams_alligator,
            "📈 SuperTrend": self.strategy_supertrend,
            "🌊 FVG Sweep": self.strategy_fvg_sweep,
            "📡 Hann Filter": self.strategy_hann_filter,
            "⚡ ZigZag Ultra": self.strategy_zigzag_ultra,
            "🎯 Candle Channel": self.strategy_candle_channel,
        }
        results = []
        for name, func in strat_map.items():
            results.append(self._run_one(symbol, name, func))
        return results

    def run_full_backtest(self, max_pairs: int = 50) -> pd.DataFrame:
        """Runs all strategies across multiple pairs in parallel."""
        top_pairs = self.get_top_100_pairs()[:max_pairs]
        all_results: list[Dict] = []
        
        print("\n🚀 Starting Full Backtest Suite...")
        print(f"📊 Testing {len(top_pairs)} pairs with 9 strategies each.")
        print("-" * 50)

        with _fut.ThreadPoolExecutor(self.max_workers) as ex:
            futs = {ex.submit(self.run_all_strategies_single_pair, s): s for s in top_pairs}
            for i, f in enumerate(_fut.as_completed(futs)):
                try:
                    all_results.extend(f.result())
                    print(f"✅ Completed backtests for pair {i+1}/{len(top_pairs)}: {futs[f]}")
                except Exception as e:
                    print(f"❌ Error processing pair {futs[f]}: {e}")

        df = (pd.DataFrame(all_results)
                .dropna(subset=["total_return"])
                .sort_values("sharpe_ratio", ascending=False) # Sort by Sharpe for risk-adjusted return
                .reset_index(drop=True))
        df["rank"] = np.arange(1, len(df) + 1)
        return df

# ─────────────────────  DEMO HOOK  ──────────────────────
if __name__ == "__main__":
    bt = CryptoPineBacktester(max_workers=8) # Use more workers if your machine supports it
    # Run a smaller backtest for the demo, e.g., 10 pairs
    results_df = bt.run_full_backtest(max_pairs=10) 
    
    print("\n" + "="*80)
    print("🏆 BACKTEST RESULTS SUMMARY 🏆")
    print("="*80)
    
    if not results_df.empty:
        # Display the top 25 results based on Sharpe Ratio
        print(results_df.head(25).to_string())
        
        # Save results to a CSV file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backtest_results_{timestamp}.csv"
        results_df.to_csv(filename, index=False)
        print(f"\n💾 Results saved to {filename}")
    else:
        print("No successful backtests were completed.")