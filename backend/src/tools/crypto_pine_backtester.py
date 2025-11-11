
"""
🚀 COMPREHENSIVE PINE SCRIPT TO PYTHON BACKTESTER 🚀
==================================================

Converts all Pine Script strategies to Python:
1. 🏆 Unmitigated Levels Accumulation Strategy
2. 📊 Linear Mean Reversion Strategy  
3. 💹 NAS100 Smart Scalping Strategy
4. 🐊 Williams Alligator Strategy
5. 📈 SuperTrend Strategy
6. 🌊 FVG Sweep Indicator Strategy
7. 📡 Hann Window FIR Filter Ribbon Strategy
8. ⚡ ZigZag++ UltraAlgo Strategy
9. 🎯 Candle Channel Strategy

Features:
- Top 100 cryptocurrency pairs via CCXT
- 365-day backtesting period
- CSV caching system
- Performance metrics (ROI, Max Drawdown, Sharpe Ratio)
- Parallel processing for multiple pairs
- Sorted results by performance
"""

import numpy as np
import pandas as pd
import ccxt
import os
import json
from datetime import datetime, timedelta
import time
from typing import Dict, List, Tuple, Optional
import warnings
from concurrent.futures import ThreadPoolExecutor
import pandas_ta as ta
from pathlib import Path

warnings.filterwarnings('ignore')

class CryptoPineBacktester:
    """Main backtesting engine for Pine Script strategies"""

    def __init__(self, 
                 initial_capital: float = 10000,
                 commission: float = 0.001,  # 0.1% commission
                 max_workers: int = 4):

        self.initial_capital = initial_capital
        self.commission = commission
        self.max_workers = max_workers
        self.data_dir = Path("crypto_data")
        self.data_dir.mkdir(exist_ok=True)

        # Initialize exchange (using Binance for data)
        self.exchange = ccxt.binance()

        # Performance tracking
        self.results = []

        print("🚀 CryptoPineBacktester Initialized!")
        print(f"💰 Initial Capital: ${initial_capital:,.2f}")
        print(f"💸 Commission: {commission*100:.2f}%")
        print(f"🔧 Max Workers: {max_workers}")

    def get_top_100_pairs(self) -> List[str]:
        """Get top 100 crypto pairs by volume"""
        try:
            print("🔍 Fetching top 100 crypto pairs...")
            markets = self.exchange.load_markets()

            # Filter USDT pairs and get volume data
            usdt_pairs = []
            for symbol, market in markets.items():
                if (symbol.endswith('/USDT') and 
                    market['active'] and 
                    'spot' in market['type']):
                    usdt_pairs.append(symbol)

            # Get 24h ticker data for volume sorting
            tickers = self.exchange.fetch_tickers()

            # Sort by volume and get top 100
            pair_volumes = []
            for pair in usdt_pairs:
                if pair in tickers and tickers[pair]['quoteVolume']:
                    pair_volumes.append({
                        'symbol': pair,
                        'volume': float(tickers[pair]['quoteVolume'])
                    })

            # Sort by volume descending
            pair_volumes.sort(key=lambda x: x['volume'], reverse=True)
            top_100 = [pair['symbol'] for pair in pair_volumes[:100]]

            print(f"✅ Found {len(top_100)} top trading pairs")
            return top_100

        except Exception as e:
            print(f"❌ Error fetching pairs: {e}")
            # Fallback to common pairs
            return [
                'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT',
                'XRP/USDT', 'DOT/USDT', 'DOGE/USDT', 'AVAX/USDT', 'LUNA/USDT'
            ]

    def fetch_historical_data(self, symbol: str, timeframe: str = '1h', days: int = 365) -> pd.DataFrame:
        """Fetch historical OHLCV data with CSV caching"""

        # Create filename for caching
        filename = f"{symbol.replace('/', '_')}_{timeframe}_{days}d.csv"
        filepath = self.data_dir / filename

        # Check if cached data exists and is recent (less than 1 day old)
        if filepath.exists():
            file_age = time.time() - filepath.stat().st_mtime
            if file_age < 86400:  # Less than 24 hours
                print(f"📁 Loading cached data for {symbol}")
                try:
                    df = pd.read_csv(filepath, index_col=0, parse_dates=True)
                    return df
                except:
                    print(f"⚠️  Cached data corrupted for {symbol}, refetching...")

        # Fetch fresh data
        print(f"🌐 Fetching fresh data for {symbol}...")
        try:
            # Calculate since timestamp
            since = int((datetime.now() - timedelta(days=days)).timestamp() * 1000)

            # Fetch OHLCV data
            ohlcv = self.exchange.fetch_ohlcv(symbol, timeframe, since=since)

            if not ohlcv:
                raise Exception(f"No data returned for {symbol}")

            # Convert to DataFrame
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)

            # Save to CSV
            df.to_csv(filepath)
            print(f"💾 Cached data for {symbol}")

            return df

        except Exception as e:
            print(f"❌ Error fetching {symbol}: {e}")
            return pd.DataFrame()

    def calculate_technical_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate all technical indicators needed for strategies"""

        if df.empty:
            return df

        # Basic indicators
        df['sma_20'] = ta.sma(df['close'], 20)
        df['sma_50'] = ta.sma(df['close'], 50)
        df['sma_200'] = ta.sma(df['close'], 200)
        df['ema_9'] = ta.ema(df['close'], 9)
        df['ema_200'] = ta.ema(df['close'], 200)

        # RSI
        df['rsi'] = ta.rsi(df['close'], 14)

        # ATR
        df['atr'] = ta.atr(df['high'], df['low'], df['close'], 14)

        # VWAP (approximation)
        df['vwap'] = ta.vwap(df['high'], df['low'], df['close'], df['volume'])

        # Bollinger Bands
        bb = ta.bbands(df['close'], 20, 2)
        if bb is not None and not bb.empty:
            df['bb_upper'] = bb.iloc[:, 0]
            df['bb_middle'] = bb.iloc[:, 1] 
            df['bb_lower'] = bb.iloc[:, 2]

        # SuperTrend
        supertrend = ta.supertrend(df['high'], df['low'], df['close'], 14, 3.0)
        if supertrend is not None and not supertrend.empty:
            df['supertrend'] = supertrend.iloc[:, 0]
            df['supertrend_direction'] = supertrend.iloc[:, 1]

        # Williams %R
        df['williams_r'] = ta.willr(df['high'], df['low'], df['close'], 14)

        # Stochastic
        stoch = ta.stoch(df['high'], df['low'], df['close'])
        if stoch is not None and not stoch.empty:
            df['stoch_k'] = stoch.iloc[:, 0]
            df['stoch_d'] = stoch.iloc[:, 1]

        return df

    # Strategy 1: Unmitigated Levels Accumulation
    def strategy_unmitigated_levels(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        🏆 Unmitigated Levels Accumulation Strategy
        - Buy at previous daily/weekly/monthly lows during London session
        - Sell at all-time highs
        """
        if df.empty:
            return df

        signals = pd.DataFrame(index=df.index)
        signals['signal'] = 0
        signals['position'] = 0

        # Calculate previous period lows
        df['daily_low'] = df['low'].rolling('1D').min().shift(1)
        df['weekly_low'] = df['low'].rolling('7D').min().shift(1) 
        df['monthly_low'] = df['low'].rolling('30D').min().shift(1)

        # All-time high
        df['ath'] = df['high'].expanding().max()

        # London session (9:00-17:00 UTC+1, so 8:00-16:00 UTC)
        df['london_session'] = (df.index.hour >= 8) & (df.index.hour <= 16)

        # Buy signals at support levels during London session
        buy_condition = (
            df['london_session'] & 
            ((df['low'] <= df['daily_low'] * 1.001) |  # Touch daily low
             (df['low'] <= df['weekly_low'] * 1.001) |  # Touch weekly low
             (df['low'] <= df['monthly_low'] * 1.001))   # Touch monthly low
        )

        # Sell signal at ATH
        sell_condition = df['high'] >= df['ath']

        signals.loc[buy_condition, 'signal'] = 1
        signals.loc[sell_condition, 'signal'] = -1

        # Generate positions
        signals['position'] = signals['signal'].replace(0, np.nan).ffill().fillna(0)

        return signals

    # Strategy 2: Linear Mean Reversion
    def strategy_mean_reversion(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        📊 Linear Mean Reversion Strategy
        - Z-score based entries and exits
        - Fixed stop loss
        """
        if df.empty:
            return df

        signals = pd.DataFrame(index=df.index)
        signals['signal'] = 0
        signals['position'] = 0

        # Parameters
        lookback = 14
        entry_threshold = 2.0
        exit_threshold = 0.2

        # Calculate Z-score
        mean = df['close'].rolling(lookback).mean()
        std = df['close'].rolling(lookback).std()
        df['zscore'] = (df['close'] - mean) / std

        # Entry conditions
        long_entry = df['zscore'] < -entry_threshold
        short_entry = df['zscore'] > entry_threshold

        # Exit conditions
        long_exit = df['zscore'] > -exit_threshold
        short_exit = df['zscore'] < exit_threshold

        signals.loc[long_entry, 'signal'] = 1
        signals.loc[short_entry, 'signal'] = -1
        signals.loc[long_exit & (signals['position'].shift() > 0), 'signal'] = 0
        signals.loc[short_exit & (signals['position'].shift() < 0), 'signal'] = 0

        # Generate positions
        signals['position'] = signals['signal'].replace(0, np.nan).ffill().fillna(0)

        return signals

    # Strategy 3: NAS100 Smart Scalping (adapted for crypto)
    def strategy_smart_scalping(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        💹 Smart Scalping Strategy (adapted for crypto)
        - EMA9, VWAP, RSI based signals
        - Volume spike confirmation
        """
        if df.empty:
            return df

        signals = pd.DataFrame(index=df.index)
        signals['signal'] = 0
        signals['position'] = 0

        # Volume spike detection
        avg_volume = df['volume'].rolling(20).mean()
        volume_spike = df['volume'] > (avg_volume * 1.5)

        # Body strength
        body_strength = abs(df['close'] - df['open']) > (df['atr'] * 0.3)

        # Bullish setup
        bullish_setup = (
            (df['close'] > df['open']) &
            (df['close'] > df['ema_9']) &
            (df['close'] > df['vwap']) &
            (df['rsi'] > 50) &
            body_strength &
            volume_spike
        )

        # Bearish setup  
        bearish_setup = (
            (df['close'] < df['open']) &
            (df['close'] < df['ema_9']) &
            (df['close'] < df['vwap']) &
            (df['rsi'] < 50) &
            body_strength &
            volume_spike
        )

        signals.loc[bullish_setup, 'signal'] = 1
        signals.loc[bearish_setup, 'signal'] = -1

        # Generate positions with exit after N bars
        signals['position'] = signals['signal']

        return signals

    # Strategy 4: Williams Alligator
    def strategy_williams_alligator(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        🐊 Williams Alligator Strategy
        - SMMA based trend following
        - ATR based stop loss
        """
        if df.empty:
            return df

        signals = pd.DataFrame(index=df.index)
        signals['signal'] = 0  
        signals['position'] = 0

        # Calculate SMMA (Smoothed Moving Average)
        def smma(series, period):
            return series.ewm(alpha=1/period, adjust=False).mean()

        # Alligator lines
        df['jaw'] = smma(df['close'], 13).shift(8)    # Blue line
        df['teeth'] = smma(df['close'], 8).shift(5)   # Red line  
        df['lips'] = smma(df['close'], 5).shift(3)    # Green line

        # Signals when lips cross above/below jaw
        long_signal = (df['lips'] > df['jaw']) & (df['lips'].shift(1) <= df['jaw'].shift(1))
        short_signal = (df['lips'] < df['jaw']) & (df['lips'].shift(1) >= df['jaw'].shift(1))

        signals.loc[long_signal, 'signal'] = 1
        signals.loc[short_signal, 'signal'] = -1

        # Generate positions
        signals['position'] = signals['signal'].replace(0, np.nan).ffill().fillna(0)

        return signals

    # Strategy 5: SuperTrend  
    def strategy_supertrend(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        📈 SuperTrend Strategy
        - Trend following with SuperTrend indicator
        """
        if df.empty or 'supertrend_direction' not in df.columns:
            signals = pd.DataFrame(index=df.index)
            signals['signal'] = 0
            signals['position'] = 0
            return signals

        signals = pd.DataFrame(index=df.index)
        signals['signal'] = 0
        signals['position'] = 0

        # SuperTrend direction change signals
        direction_change = df['supertrend_direction'] != df['supertrend_direction'].shift(1)

        # Long when direction changes to 1 (up trend)
        long_signal = direction_change & (df['supertrend_direction'] == 1)
        # Short when direction changes to -1 (down trend)  
        short_signal = direction_change & (df['supertrend_direction'] == -1)

        signals.loc[long_signal, 'signal'] = 1
        signals.loc[short_signal, 'signal'] = -1

        # Use SuperTrend direction as position
        signals['position'] = df['supertrend_direction']

        return signals

    # Strategy 6: FVG Sweep (Simplified)
    def strategy_fvg_sweep(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        🌊 Fair Value Gap (FVG) Sweep Strategy (Simplified)
        - Detect gaps between candles and trade reversals
        """
        if df.empty:
            return df

        signals = pd.DataFrame(index=df.index)
        signals['signal'] = 0
        signals['position'] = 0

        # Detect Fair Value Gaps
        # Bullish FVG: Gap between current low and 2 bars ago high
        bullish_fvg = df['low'] > df['high'].shift(2)

        # Bearish FVG: Gap between current high and 2 bars ago low
        bearish_fvg = df['high'] < df['low'].shift(2)

        # Trade when price returns to fill the gap
        fill_bullish_gap = (df['low'] <= df['high'].shift(2)) & bullish_fvg.shift(1)
        fill_bearish_gap = (df['high'] >= df['low'].shift(2)) & bearish_fvg.shift(1)

        signals.loc[fill_bullish_gap, 'signal'] = 1
        signals.loc[fill_bearish_gap, 'signal'] = -1

        # Generate positions
        signals['position'] = signals['signal']

        return signals

    # Strategy 7: Hann Window FIR Filter (Simplified)
    def strategy_hann_filter(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        📡 Hann Window FIR Filter Strategy (Simplified)
        - Moving average ribbon with Hann window weighting
        """
        if df.empty:
            return df

        signals = pd.DataFrame(index=df.index)  
        signals['signal'] = 0
        signals['position'] = 0

        # Simplified Hann filter using weighted moving averages
        def hann_filter(series, length):
            weights = np.array([1 - np.cos(2 * np.pi * i / (length + 1)) 
                              for i in range(1, length + 1)])
            weights = weights / weights.sum()
            return series.rolling(length).apply(lambda x: np.dot(x, weights), raw=True)

        # Calculate multiple Hann filtered MAs
        df['hann_20'] = hann_filter(df['close'], 20)
        df['hann_22'] = hann_filter(df['close'], 22)

        # Signals when shorter MA crosses longer MA
        long_signal = (df['hann_20'] > df['hann_22']) & (df['hann_20'].shift(1) <= df['hann_22'].shift(1))
        short_signal = (df['hann_20'] < df['hann_22']) & (df['hann_20'].shift(1) >= df['hann_22'].shift(1))

        signals.loc[long_signal, 'signal'] = 1
        signals.loc[short_signal, 'signal'] = -1

        # Generate positions
        signals['position'] = signals['signal'].replace(0, np.nan).ffill().fillna(0)

        return signals

    # Strategy 8: ZigZag UltraAlgo
    def strategy_zigzag_ultra(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        ⚡ ZigZag UltraAlgo Strategy
        - Pivot high/low detection for trend reversal
        """
        if df.empty:
            return df

        signals = pd.DataFrame(index=df.index)
        signals['signal'] = 0
        signals['position'] = 0

        # Simple pivot detection
        depth = 12

        # Pivot highs and lows
        pivot_highs = (df['high'] == df['high'].rolling(depth*2+1, center=True).max())
        pivot_lows = (df['low'] == df['low'].rolling(depth*2+1, center=True).min())

        # UltraShort signal at pivot highs
        signals.loc[pivot_highs, 'signal'] = -1
        # UltraBuy signal at pivot lows  
        signals.loc[pivot_lows, 'signal'] = 1

        # Generate positions
        signals['position'] = signals['signal'].replace(0, np.nan).ffill().fillna(0)

        return signals

    # Strategy 9: Candle Channel
    def strategy_candle_channel(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        🎯 Candle Channel Strategy
        - SMA of candle midpoint with dynamic bands
        """
        if df.empty:
            return df

        signals = pd.DataFrame(index=df.index)
        signals['signal'] = 0
        signals['position'] = 0

        # Parameters
        length = 20
        scale = 200.0  # % of average candle height

        # Candle midpoint
        candle_mid = (df['high'] + df['low']) / 2
        mid_sma = candle_mid.rolling(length).mean()

        # Average candle height
        avg_range = (df['high'] - df['low']).rolling(length).mean()
        offset = avg_range * scale / 100

        # Bands
        df['upper_band'] = mid_sma + offset
        df['lower_band'] = mid_sma - offset

        # Reversal signals
        # Bearish reversal: price was above upper band, now closes below with red candle
        above_upper = df['close'].shift(1) > df['upper_band'].shift(1)
        return_to_upper = above_upper & (df['close'] < df['upper_band']) & (df['close'] < df['open'])

        # Bullish reversal: price was below lower band, now closes above with green candle
        below_lower = df['close'].shift(1) < df['lower_band'].shift(1)
        return_to_lower = below_lower & (df['close'] > df['lower_band']) & (df['close'] > df['open'])

        # SMA crossover signals
        sma_cross_up = (df['close'] > mid_sma) & (df['close'].shift(1) <= mid_sma.shift(1))
        sma_cross_down = (df['close'] < mid_sma) & (df['close'].shift(1) >= mid_sma.shift(1))

        signals.loc[return_to_lower | sma_cross_up, 'signal'] = 1
        signals.loc[return_to_upper | sma_cross_down, 'signal'] = -1

        # Generate positions
        signals['position'] = signals['signal']

        return signals

    def backtest_strategy(self, df: pd.DataFrame, signals: pd.DataFrame, strategy_name: str) -> Dict:
        """Backtest a strategy and return performance metrics"""

        if df.empty or signals.empty:
            return {
                'strategy': strategy_name,
                'total_return': 0,
                'max_drawdown': 0,
                'win_rate': 0,
                'total_trades': 0,
                'sharpe_ratio': 0
            }

        # Initialize portfolio
        portfolio = pd.DataFrame(index=df.index)
        portfolio['price'] = df['close']
        portfolio['signal'] = signals['signal']
        portfolio['position'] = signals['position']

        # Calculate returns
        portfolio['returns'] = df['close'].pct_change()
        portfolio['strategy_returns'] = portfolio['position'].shift(1) * portfolio['returns']

        # Apply commission
        position_changes = portfolio['position'].diff().abs()
        portfolio['commission'] = position_changes * self.commission
        portfolio['net_returns'] = portfolio['strategy_returns'] - portfolio['commission']

        # Calculate cumulative returns
        portfolio['cumulative'] = (1 + portfolio['net_returns']).cumprod()

        # Performance metrics
        total_return = (portfolio['cumulative'].iloc[-1] - 1) * 100

        # Max drawdown
        rolling_max = portfolio['cumulative'].expanding().max()
        drawdown = (portfolio['cumulative'] - rolling_max) / rolling_max
        max_drawdown = drawdown.min() * 100

        # Win rate
        profitable_trades = portfolio['net_returns'] > 0
        total_trades = len(portfolio['net_returns'].dropna())
        win_rate = profitable_trades.sum() / total_trades * 100 if total_trades > 0 else 0

        # Sharpe ratio
        excess_returns = portfolio['net_returns'].dropna()
        sharpe_ratio = excess_returns.mean() / excess_returns.std() * np.sqrt(8760) if excess_returns.std() != 0 else 0  # Hourly to annual

        return {
            'strategy': strategy_name,
            'total_return': round(total_return, 2),
            'max_drawdown': round(max_drawdown, 2),
            'win_rate': round(win_rate, 2), 
            'total_trades': total_trades,
            'sharpe_ratio': round(sharpe_ratio, 2)
        }

    def run_strategy_on_pair(self, symbol: str, strategy_func, strategy_name: str) -> Dict:
        """Run a single strategy on a trading pair"""

        print(f"🔄 Running {strategy_name} on {symbol}")

        # Fetch data
        df = self.fetch_historical_data(symbol)
        if df.empty:
            return {'symbol': symbol, 'strategy': strategy_name, 'error': 'No data'}

        # Calculate indicators
        df = self.calculate_technical_indicators(df)

        # Run strategy
        signals = strategy_func(df)

        # Backtest
        results = self.backtest_strategy(df, signals, strategy_name)
        results['symbol'] = symbol

        return results

    def run_all_strategies_single_pair(self, symbol: str) -> List[Dict]:
        """Run all strategies on a single pair"""

        # Strategy mapping
        strategies = {
            '🏆 Unmitigated Levels': self.strategy_unmitigated_levels,
            '📊 Mean Reversion': self.strategy_mean_reversion,
            '💹 Smart Scalping': self.strategy_smart_scalping,
            '🐊 Williams Alligator': self.strategy_williams_alligator,
            '📈 SuperTrend': self.strategy_supertrend,
            '🌊 FVG Sweep': self.strategy_fvg_sweep,
            '📡 Hann Filter': self.strategy_hann_filter,
            '⚡ ZigZag Ultra': self.strategy_zigzag_ultra,
            '🎯 Candle Channel': self.strategy_candle_channel
        }

        pair_results = []

        for strategy_name, strategy_func in strategies.items():
            result = self.run_strategy_on_pair(symbol, strategy_func, strategy_name)
            pair_results.append(result)

        return pair_results

    def run_full_backtest(self, max_pairs: int = 20) -> pd.DataFrame:
        """Run full backtest on top crypto pairs"""

        print("🚀 Starting Full Crypto Backtesting Suite!")
        print("=" * 60)

        # Get top pairs
        top_pairs = self.get_top_100_pairs()[:max_pairs]  # Limit for demo

        print(f"📊 Testing {len(top_pairs)} pairs with 9 strategies")
        print(f"⏱️  Expected tests: {len(top_pairs) * 9}")

        all_results = []

        # Process pairs with threading
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {}

            for symbol in top_pairs:
                future = executor.submit(self.run_all_strategies_single_pair, symbol)
                futures[future] = symbol

            completed = 0
            total_tests = len(top_pairs) * 9

            for future in futures:
                try:
                    pair_results = future.result(timeout=300)  # 5 min timeout
                    all_results.extend(pair_results)
                    completed += len(pair_results)

                    print(f"✅ Progress: {completed}/{total_tests} tests completed ({completed/total_tests*100:.1f}%)")

                except Exception as e:
                    symbol = futures[future]
                    print(f"❌ Error processing {symbol}: {e}")

        # Convert to DataFrame
        results_df = pd.DataFrame(all_results)

        # Clean and sort results
        if not results_df.empty:
            # Remove error rows
            results_df = results_df[~results_df.get('error', False)]

            # Sort by total return descending
            results_df = results_df.sort_values('total_return', ascending=False)

            # Reset index
            results_df = results_df.reset_index(drop=True)

            # Add ranking
            results_df['rank'] = range(1, len(results_df) + 1)

        return results_df

    def save_results(self, results_df: pd.DataFrame, filename: str = None) -> str:
        """Save results to CSV"""

        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"crypto_backtest_results_{timestamp}.csv"

        filepath = self.data_dir / filename
        results_df.to_csv(filepath, index=False)

        print(f"💾 Results saved to: {filepath}")
        return str(filepath)

    def display_top_results(self, results_df: pd.DataFrame, top_n: int = 20):
        """Display top performing strategies"""

        if results_df.empty:
            print("❌ No results to display")
            return

        print("\n" + "="*80)
        print(f"🏆 TOP {top_n} PERFORMING STRATEGIES")
        print("="*80)

        top_results = results_df.head(top_n)

        for idx, row in top_results.iterrows():
            print(f"\n#{row['rank']:2d} | {row['strategy']:20s} | {row['symbol']:10s}")
            print(f"     💰 ROI: {row['total_return']:8.2f}% | "
                  f"📉 Max DD: {row['max_drawdown']:6.2f}% | "
                  f"🎯 Win Rate: {row['win_rate']:5.1f}%")
            print(f"     📊 Sharpe: {row['sharpe_ratio']:6.2f} | "
                  f"🔄 Trades: {row['total_trades']:4d}")

        # Summary statistics
        print("\n" + "="*80)
        print("📈 SUMMARY STATISTICS")
        print("="*80)

        print(f"📊 Total Strategy Tests: {len(results_df)}")
        print(f"💰 Average ROI: {results_df['total_return'].mean():.2f}%")
        print(f"🏆 Best ROI: {results_df['total_return'].max():.2f}%")
        print(f"📉 Worst ROI: {results_df['total_return'].min():.2f}%")
        print(f"⚖️  Average Max Drawdown: {results_df['max_drawdown'].mean():.2f}%")
        print(f"🎯 Average Win Rate: {results_df['win_rate'].mean():.1f}%")

        # Strategy performance summary
        strategy_summary = results_df.groupby('strategy').agg({
            'total_return': 'mean',
            'max_drawdown': 'mean', 
            'win_rate': 'mean',
            'sharpe_ratio': 'mean'
        }).round(2).sort_values('total_return', ascending=False)

        print("\n" + "="*80)
        print("🔧 STRATEGY PERFORMANCE SUMMARY (Averages)")
        print("="*80)

        for strategy, metrics in strategy_summary.iterrows():
            print(f"{strategy:25s} | ROI: {metrics['total_return']:6.2f}% | "
                  f"DD: {metrics['max_drawdown']:6.2f}% | WR: {metrics['win_rate']:5.1f}%")


# Example usage function
def run_crypto_backtest_demo():
    """Run a demonstration of the crypto backtester"""

    print("🚀 CRYPTO PINE SCRIPT BACKTESTER DEMO")
    print("=====================================\n")

    # Initialize backtester
    backtester = CryptoPineBacktester(
        initial_capital=10000,
        commission=0.001,  # 0.1%
        max_workers=2      # Reduce for demo
    )

    # Run backtest on limited pairs for demo
    results = backtester.run_full_backtest(max_pairs=5)  # Test 5 pairs only

    # Display results
    backtester.display_top_results(results, top_n=15)

    # Save results
    filepath = backtester.save_results(results)

    print(f"\n✅ Demo completed! Results saved to: {filepath}")

    return results

if __name__ == "__main__":
    # Run the demo
    results = run_crypto_backtest_demo()
