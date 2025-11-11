import ccxt
import pandas as pd
import numpy as np
import os
import time
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class ExactRSIDivergenceBacktester:
    def __init__(self):
        self.exchange = ccxt.binance()
        self.timeframe = '5m'
        self.days_back = 90
        self.csv_folder = 'ohlcv_data'
        self.results_folder = 'backtest_results'
        
        # EXACT Pine Script parameters from your image
        self.rsi_length = 14
        self.rsi_source = 'close'
        self.calculate_divergence = True
        self.long_entry_rsi = 35.0
        self.short_entry_rsi = 76.0
        self.long_exit_rsi = 80.0
        self.short_exit_rsi = 54.1
        
        # EXACT divergence parameters from Pine Script
        self.lookback_right = 5
        self.lookback_left = 5
        self.range_upper = 60
        self.range_lower = 5
        
        # Trading parameters
        self.initial_capital = 100000
        self.commission = 0.001  # 0.1%
        
        os.makedirs(self.csv_folder, exist_ok=True)
        os.makedirs(self.results_folder, exist_ok=True)
    
    def get_top_50_pairs(self):
        """Get top 50 trading pairs by volume"""
        try:
            tickers = self.exchange.fetch_tickers()
            usdt_pairs = {k: v for k, v in tickers.items() if k.endswith('/USDT')}
            sorted_pairs = sorted(usdt_pairs.keys(), 
                                key=lambda x: usdt_pairs[x]['quoteVolume'] if usdt_pairs[x]['quoteVolume'] else 0, 
                                reverse=True)[:50]
            return sorted_pairs
        except Exception as e:
            print(f"Error getting top pairs: {e}")
            return ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'XRP/USDT']
    
    def fetch_ohlcv_data(self, symbol):
        """Fetch OHLCV data with CSV caching"""
        filename = f'{self.csv_folder}/{symbol.replace("/", "_")}_5m_90d.csv'
        
        if os.path.exists(filename):
            file_age = time.time() - os.path.getmtime(filename)
            if file_age < 3600:  # 1 hour
                print(f"Loading cached data for {symbol}")
                df = pd.read_csv(filename, parse_dates=['timestamp'])
                return df
        
        print(f"Fetching fresh data for {symbol}")
        try:
            since = int((datetime.now() - timedelta(days=self.days_back)).timestamp() * 1000)
            
            all_ohlcv = []
            current_since = since
            limit = 1000
            
            while True:
                ohlcv = self.exchange.fetch_ohlcv(symbol, self.timeframe, since=current_since, limit=limit)
                if not ohlcv:
                    break
                
                all_ohlcv.extend(ohlcv)
                current_since = ohlcv[-1][0] + (5 * 60 * 1000)
                
                if len(ohlcv) < limit:
                    break
                
                time.sleep(0.1)
            
            df = pd.DataFrame(all_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df = df.sort_values('timestamp').reset_index(drop=True)
            
            df.to_csv(filename, index=False)
            return df
            
        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
            return None
    
    def calculate_rsi_tradingview_exact(self, close_prices):
        """Calculate RSI exactly like TradingView using RMA (Running Moving Average)"""
        close_prices = np.array(close_prices)
        
        # Calculate price changes
        changes = np.diff(close_prices)
        changes = np.concatenate([[0], changes])  # Add 0 for first value
        
        # Separate gains and losses
        gains = np.where(changes > 0, changes, 0)
        losses = np.where(changes < 0, -changes, 0)
        
        # Calculate RMA (Running Moving Average) - TradingView's method
        alpha = 1.0 / self.rsi_length
        
        # Initialize arrays
        avg_gains = np.zeros(len(close_prices))
        avg_losses = np.zeros(len(close_prices))
        
        # First RMA calculation (SMA for first period)
        avg_gains[self.rsi_length-1] = np.mean(gains[:self.rsi_length])
        avg_losses[self.rsi_length-1] = np.mean(losses[:self.rsi_length])
        
        # Subsequent RMA calculations
        for i in range(self.rsi_length, len(close_prices)):
            avg_gains[i] = alpha * gains[i] + (1 - alpha) * avg_gains[i-1]
            avg_losses[i] = alpha * losses[i] + (1 - alpha) * avg_losses[i-1]
        
        # Calculate RSI
        rsi = np.full(len(close_prices), np.nan)
        for i in range(self.rsi_length-1, len(close_prices)):
            if avg_losses[i] == 0:
                rsi[i] = 100
            elif avg_gains[i] == 0:
                rsi[i] = 0
            else:
                rs = avg_gains[i] / avg_losses[i]
                rsi[i] = 100 - (100 / (1 + rs))
        
        return rsi
    
    def find_pivot_lows(self, rsi_values):
        """Find pivot lows exactly like Pine Script"""
        pivot_lows = np.full(len(rsi_values), False)
        
        for i in range(self.lookback_left, len(rsi_values) - self.lookback_right):
            left_values = rsi_values[i-self.lookback_left:i]
            right_values = rsi_values[i+1:i+self.lookback_right+1]
            current_value = rsi_values[i]
            
            # Check if current value is lowest in the window
            if (np.all(current_value <= left_values) and 
                np.all(current_value <= right_values) and
                not np.isnan(current_value)):
                pivot_lows[i] = True
        
        return pivot_lows
    
    def find_pivot_highs(self, rsi_values):
        """Find pivot highs exactly like Pine Script"""
        pivot_highs = np.full(len(rsi_values), False)
        
        for i in range(self.lookback_left, len(rsi_values) - self.lookback_right):
            left_values = rsi_values[i-self.lookback_left:i]
            right_values = rsi_values[i+1:i+self.lookback_right+1]
            current_value = rsi_values[i]
            
            # Check if current value is highest in the window
            if (np.all(current_value >= left_values) and 
                np.all(current_value >= right_values) and
                not np.isnan(current_value)):
                pivot_highs[i] = True
        
        return pivot_highs
    
    def in_range(self, condition_array, current_index):
        """Replicate Pine Script's _inRange function exactly"""
        # Find the most recent True value before current index
        recent_indices = np.where(condition_array[:current_index])[0]
        if len(recent_indices) == 0:
            return False
        
        bars_since = current_index - recent_indices[-1]
        return self.range_lower <= bars_since <= self.range_upper
    
    def detect_divergence_exact(self, df):
        """Detect RSI divergence exactly like Pine Script"""
        df = df.copy()
        
        # Calculate RSI using TradingView's exact method
        df['rsi'] = self.calculate_rsi_tradingview_exact(df['close'])
        
        # Find pivot points
        df['rsi_pivot_low'] = self.find_pivot_lows(df['rsi'].values)
        df['rsi_pivot_high'] = self.find_pivot_highs(df['rsi'].values)
        
        # Initialize divergence signals
        df['bull_divergence'] = False
        df['bear_divergence'] = False
        
        # Detect divergences using exact Pine Script logic
        for i in range(self.lookback_right, len(df)):
            rsi_lookback = df['rsi'].iloc[i - self.lookback_right]
            
            # Bullish divergence detection
            if df['rsi_pivot_low'].iloc[i - self.lookback_right]:
                if self.in_range(df['rsi_pivot_low'].values, i):
                    # Find previous pivot low
                    prev_pivot_indices = np.where(df['rsi_pivot_low'].iloc[:i-self.lookback_right])[0]
                    if len(prev_pivot_indices) > 0:
                        prev_idx = prev_pivot_indices[-1]
                        prev_rsi = df['rsi'].iloc[prev_idx]
                        prev_low = df['low'].iloc[prev_idx]
                        current_low = df['low'].iloc[i - self.lookback_right]
                        
                        # RSI higher low + Price lower low = Bullish divergence
                        if rsi_lookback > prev_rsi and current_low < prev_low:
                            df.iloc[i, df.columns.get_loc('bull_divergence')] = True
            
            # Bearish divergence detection
            if df['rsi_pivot_high'].iloc[i - self.lookback_right]:
                if self.in_range(df['rsi_pivot_high'].values, i):
                    # Find previous pivot high
                    prev_pivot_indices = np.where(df['rsi_pivot_high'].iloc[:i-self.lookback_right])[0]
                    if len(prev_pivot_indices) > 0:
                        prev_idx = prev_pivot_indices[-1]
                        prev_rsi = df['rsi'].iloc[prev_idx]
                        prev_high = df['high'].iloc[prev_idx]
                        current_high = df['high'].iloc[i - self.lookback_right]
                        
                        # RSI lower high + Price higher high = Bearish divergence
                        if rsi_lookback < prev_rsi and current_high > prev_high:
                            df.iloc[i, df.columns.get_loc('bear_divergence')] = True
        
        return df
    
    def run_backtest_exact(self, df, symbol):
        """Run backtest with exact Pine Script logic"""
        df = df.copy()
        
        # Initialize trading variables
        position = 0  # 0: no position, 1: long, -1: short
        entry_price = 0
        entry_time = None
        balance = self.initial_capital
        trades = []
        equity_curve = []
        
        for i in range(len(df)):
            row = df.iloc[i]
            current_price = row['close']
            current_time = row['timestamp']
            current_rsi = row['rsi']
            
            # Skip if RSI is NaN
            if np.isnan(current_rsi):
                continue
            
            # Entry conditions - EXACT Pine Script logic
            if position == 0:
                # Long entry: bull divergence AND RSI < long_entry_level
                if row['bull_divergence'] and current_rsi < self.long_entry_rsi:
                    position = 1
                    entry_price = current_price
                    entry_time = current_time
                
                # Short entry: bear divergence AND RSI > short_entry_level
                elif row['bear_divergence'] and current_rsi > self.short_entry_rsi:
                    position = -1
                    entry_price = current_price
                    entry_time = current_time
            
            # Exit conditions - EXACT Pine Script logic
            elif position == 1:  # Long position
                if current_rsi >= self.long_exit_rsi:
                    # Close long
                    pnl = (current_price - entry_price) / entry_price
                    pnl_after_commission = pnl - (2 * self.commission)
                    balance *= (1 + pnl_after_commission)
                    
                    holding_time = (current_time - entry_time).total_seconds() / 60
                    
                    trades.append({
                        'symbol': symbol,
                        'type': 'long',
                        'entry_time': entry_time,
                        'exit_time': current_time,
                        'entry_price': entry_price,
                        'exit_price': current_price,
                        'pnl_pct': pnl_after_commission * 100,
                        'holding_time_min': holding_time,
                        'entry_rsi': df.iloc[df[df['timestamp'] == entry_time].index[0]]['rsi'],
                        'exit_rsi': current_rsi
                    })
                    
                    position = 0
            
            elif position == -1:  # Short position
                if current_rsi <= self.short_exit_rsi:
                    # Close short
                    pnl = (entry_price - current_price) / entry_price
                    pnl_after_commission = pnl - (2 * self.commission)
                    balance *= (1 + pnl_after_commission)
                    
                    holding_time = (current_time - entry_time).total_seconds() / 60
                    
                    trades.append({
                        'symbol': symbol,
                        'type': 'short',
                        'entry_time': entry_time,
                        'exit_time': current_time,
                        'entry_price': entry_price,
                        'exit_price': current_price,
                        'pnl_pct': pnl_after_commission * 100,
                        'holding_time_min': holding_time,
                        'entry_rsi': df.iloc[df[df['timestamp'] == entry_time].index[0]]['rsi'],
                        'exit_rsi': current_rsi
                    })
                    
                    position = 0
            
            # Track equity curve
            if position == 1:
                unrealized_pnl = (current_price - entry_price) / entry_price - (2 * self.commission)
                current_balance = balance * (1 + unrealized_pnl)
            elif position == -1:
                unrealized_pnl = (entry_price - current_price) / entry_price - (2 * self.commission)
                current_balance = balance * (1 + unrealized_pnl)
            else:
                current_balance = balance
            
            equity_curve.append({
                'timestamp': current_time,
                'balance': current_balance,
                'position': position,
                'rsi': current_rsi
            })
        
        return trades, equity_curve
    
    def calculate_metrics(self, trades, equity_curve):
        """Calculate performance metrics"""
        if not trades:
            return {
                'total_trades': 0,
                'win_rate': 0,
                'total_pnl': 0,
                'max_drawdown': 0,
                'avg_holding_time': 0,
                'profit_factor': 0
            }
        
        trades_df = pd.DataFrame(trades)
        equity_df = pd.DataFrame(equity_curve)
        
        # Basic metrics
        total_trades = len(trades_df)
        winning_trades = len(trades_df[trades_df['pnl_pct'] > 0])
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        total_pnl = trades_df['pnl_pct'].sum()
        avg_holding_time = trades_df['holding_time_min'].mean()
        
        # Drawdown calculation
        equity_df['peak'] = equity_df['balance'].cummax()
        equity_df['drawdown'] = (equity_df['balance'] - equity_df['peak']) / equity_df['peak'] * 100
        max_drawdown = equity_df['drawdown'].min()
        
        # Profit factor
        gross_profit = trades_df[trades_df['pnl_pct'] > 0]['pnl_pct'].sum()
        gross_loss = abs(trades_df[trades_df['pnl_pct'] < 0]['pnl_pct'].sum())
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
        
        return {
            'total_trades': total_trades,
            'win_rate': win_rate,
            'total_pnl': total_pnl,
            'max_drawdown': max_drawdown,
            'avg_holding_time': avg_holding_time,
            'profit_factor': profit_factor,
            'gross_profit': gross_profit,
            'gross_loss': gross_loss,
            'final_balance': equity_df['balance'].iloc[-1] if len(equity_df) > 0 else self.initial_capital
        }
    
    def run_full_backtest(self):
        """Run backtest on all top pairs"""
        print("="*60)
        print("EXACT TRADINGVIEW RSI DIVERGENCE BACKTEST")
        print("="*60)
        print(f"Parameters from your Pine Script:")
        print(f"  RSI Length: {self.rsi_length}")
        print(f"  Long Entry RSI: {self.long_entry_rsi}")
        print(f"  Short Entry RSI: {self.short_entry_rsi}")
        print(f"  Long Exit RSI: {self.long_exit_rsi}")
        print(f"  Short Exit RSI: {self.short_exit_rsi}")
        print(f"  Lookback Left: {self.lookback_left}")
        print(f"  Lookback Right: {self.lookback_right}")
        print(f"  Range Upper: {self.range_upper}")
        print(f"  Range Lower: {self.range_lower}")
        print("="*60)
        
        top_pairs = self.get_top_50_pairs()
        all_results = []
        
        for i, symbol in enumerate(top_pairs):
            print(f"\nProcessing {symbol} ({i+1}/{len(top_pairs)})")
            
            # Fetch data
            df = self.fetch_ohlcv_data(symbol)
            if df is None or len(df) < 200:  # Need more data for proper RSI calculation
                print(f"Insufficient data for {symbol}")
                continue
            
            # Detect divergences with exact Pine Script logic
            df = self.detect_divergence_exact(df)
            
            # Run backtest with exact logic
            trades, equity_curve = self.run_backtest_exact(df, symbol)
            
            # Calculate metrics
            metrics = self.calculate_metrics(trades, equity_curve)
            metrics['symbol'] = symbol
            
            all_results.append(metrics)
            
            # Show progress
            if trades:
                print(f"  Trades: {metrics['total_trades']}")
                print(f"  Win Rate: {metrics['win_rate']:.1f}%")
                print(f"  Total PnL: {metrics['total_pnl']:.2f}%")
                print(f"  Max Drawdown: {metrics['max_drawdown']:.2f}%")
                print(f"  Avg Holding: {metrics['avg_holding_time']:.1f} min")
                print(f"  Final Balance: ${metrics['final_balance']:.2f}")
            else:
                print(f"  No trades generated")
        
        # Sort by PnL
        all_results.sort(key=lambda x: x['total_pnl'], reverse=True)
        
        # Save results
        results_df = pd.DataFrame(all_results)
        results_df.to_csv(f'{self.results_folder}/exact_tradingview_results.csv', index=False)
        
        return results_df
    
    def display_results(self, results_df):
        """Display formatted results"""
        print("\n" + "="*100)
        print("EXACT TRADINGVIEW MATCHING RESULTS")
        print("="*100)
        
        if len(results_df) == 0:
            print("No results to display")
            return
        
        # Top performers
        print("TOP PERFORMERS (sorted by PnL):")
        print("-"*100)
        print(f"{'Symbol':<12} | {'PnL %':<8} | {'Trades':<6} | {'Win Rate':<8} | {'Max DD':<8} | {'Avg Hold':<10} | {'Final Balance':<12}")
        print("-"*100)
        
        for i, row in results_df.head(15).iterrows():
            print(f"{row['symbol']:<12} | "
                  f"{row['total_pnl']:>7.2f}% | "
                  f"{row['total_trades']:>6} | "
                  f"{row['win_rate']:>7.1f}% | "
                  f"{row['max_drawdown']:>7.2f}% | "
                  f"{row['avg_holding_time']:>9.1f}m | "
                  f"${row['final_balance']:>10.2f}")
        
        print("\n" + "="*100)
        print("SUMMARY STATISTICS:")
        print("="*100)
        print(f"Total Symbols: {len(results_df)}")
        print(f"Profitable Symbols: {len(results_df[results_df['total_pnl'] > 0])}")
        print(f"Average PnL: {results_df['total_pnl'].mean():.2f}%")
        print(f"Best: {results_df.iloc[0]['symbol']} ({results_df.iloc[0]['total_pnl']:.2f}%)")
        print(f"Worst: {results_df.iloc[-1]['symbol']} ({results_df.iloc[-1]['total_pnl']:.2f}%)")
        print(f"Average Win Rate: {results_df['win_rate'].mean():.1f}%")
        print(f"Average Max DD: {results_df['max_drawdown'].mean():.2f}%")
        print(f"Average Holding Time: {results_df['avg_holding_time'].mean():.1f} minutes")

# Run the exact TradingView matching backtester
if __name__ == "__main__":
    backtester = ExactRSIDivergenceBacktester()
    results = backtester.run_full_backtest()
    backtester.display_results(results)
