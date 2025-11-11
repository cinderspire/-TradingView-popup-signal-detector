# This Python code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
# © Intetics - Converted from Pine Script to Python

import ccxt
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
import warnings
warnings.filterwarnings('ignore')

class HolyGrailBacktester:
    def __init__(self):
        self.version = "1.0"
        
        # Strategy Parameters (matching Pine Script inputs)
        self.init_entry_percentage = 50  # Init Entry %
        self.exit_percentage = 3  # Exit %  
        self.ma_length = 50  # MA Length
        
        # Debug Parameters
        self.use_period_start_date = False
        self.period_start_date = None
        self.use_period_end_date = False
        self.period_end_date = None
        self.show_stats_table = True
        
        # Exchange setup
        self.exchange = ccxt.bybit({
            'sandbox': False,
            'enableRateLimit': True,
            'timeout': 30000,
        })
        
        # Initial capital
        self.initial_capital = 10000
        self.commission = 0.001  # 0.1%
        
    def fetch_top_pairs(self, limit=100):
        """Fetch top trading pairs by volume from Bitget"""
        try:
            print("Fetching top trading pairs...")
            markets = self.exchange.load_markets()
            
            # Get USDT pairs only
            usdt_pairs = []
            for symbol in markets:
                if '/USDT' in symbol and markets[symbol]['active']:
                    usdt_pairs.append(symbol)
            
            # Get 24h tickers for volume ranking
            tickers = self.exchange.fetch_tickers()
            
            # Sort by volume
            pair_volumes = []
            for pair in usdt_pairs:
                if pair in tickers and tickers[pair]['quoteVolume']:
                    pair_volumes.append((pair, tickers[pair]['quoteVolume']))
            
            # Sort by volume descending and take top N
            pair_volumes.sort(key=lambda x: x[1], reverse=True)
            top_pairs = [pair[0] for pair in pair_volumes[:limit]]
            
            print(f"Found {len(top_pairs)} top pairs")
            return top_pairs
            
        except Exception as e:
            print(f"Error fetching pairs: {e}")
            return []
    
    def fetch_ohlcv_data(self, symbol, days=365):
        """Fetch OHLCV data for specified days"""
        try:
            print(f"Fetching data for {symbol}...")
            
            # Calculate timeframe
            end_time = datetime.now()
            start_time = end_time - timedelta(days=days)
            since = int(start_time.timestamp() * 1000)
            
            # Fetch data in chunks due to API limits
            all_data = []
            current_since = since
            
            while current_since < int(end_time.timestamp() * 1000):
                try:
                    ohlcv = self.exchange.fetch_ohlcv(
                        symbol, 
                        timeframe='1h', 
                        since=current_since, 
                        limit=1000
                    )
                    
                    if not ohlcv:
                        break
                        
                    all_data.extend(ohlcv)
                    current_since = ohlcv[-1][0] + 3600000  # Add 1 hour in ms
                    
                    # Rate limiting
                    time.sleep(0.5)
                    
                except Exception as e:
                    print(f"Error fetching chunk: {e}")
                    break
            
            # Convert to DataFrame
            df = pd.DataFrame(all_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df = df.drop_duplicates(subset=['timestamp']).sort_values('timestamp').reset_index(drop=True)
            
            print(f"Fetched {len(df)} candles for {symbol}")
            return df
            
        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
            return pd.DataFrame()
    
    def calculate_sma(self, data, period):
        """Calculate Simple Moving Average"""
        return data.rolling(window=period).mean()
    
    def run_backtest(self, df, symbol):
        """Run backtest on single pair - matches Pine Script logic exactly"""
        if len(df) < self.ma_length:
            return None
            
        # Calculate indicators
        df['ma'] = self.calculate_sma(df['close'], self.ma_length)
        df['is_green'] = df['close'] > df['open']
        df['is_red'] = df['close'] < df['open']
        
        # Initialize variables (matching Pine Script)
        is_initialised = False
        looking_for_exit = False
        looking_for_entry = False
        ath = 0
        total_entries = 0
        total_exits = 0
        is_buy_section = True
        buy_sections = 0
        sell_sections = 0
        buy_section_low = 0
        
        # Portfolio tracking
        portfolio_value = self.initial_capital
        position_size = 0
        position_value = 0
        
        # Results tracking
        trades = []
        equity_curve = []
        
        for i in range(len(df)):
            row = df.iloc[i]
            
            # Skip if MA not available
            if pd.isna(row['ma']):
                equity_curve.append(portfolio_value)
                continue
            
            # Check if we're in date range (Pine Script logic)
            is_in_date_range = True
            if self.use_period_start_date and self.period_start_date:
                is_in_date_range = is_in_date_range and (row['timestamp'] >= self.period_start_date)
            if self.use_period_end_date and self.period_end_date:
                is_in_date_range = is_in_date_range and (row['timestamp'] <= self.period_end_date)
            
            # Initialize position (Pine Script logic)
            if not is_initialised and is_in_date_range:
                init_qty = (self.initial_capital * self.init_entry_percentage / 100) / row['high']
                position_size = init_qty
                position_value = init_qty * row['close']
                ath = row['high']
                is_initialised = True
                buy_sections += 1
                buy_section_low = row['low']
                total_entries += 1
                
                trades.append({
                    'timestamp': row['timestamp'],
                    'type': 'BUY',
                    'price': row['close'],
                    'quantity': init_qty,
                    'value': position_value
                })
            
            # Update ATH and looking for exit
            if row['high'] > ath:
                ath = row['high']
                looking_for_exit = True
            
            # Cross under MA logic
            if i > 0:
                prev_row = df.iloc[i-1]
                is_cross_under_ma = (prev_row['close'] >= prev_row['ma']) and (row['close'] < row['ma'])
                
                if not is_buy_section and is_cross_under_ma:
                    buy_section_low = row['low']
                    looking_for_entry = True
            
            # Buy section low update
            if is_buy_section and row['low'] < buy_section_low:
                buy_section_low = row['low']
                looking_for_entry = True
            
            # Trading logic
            if is_in_date_range and position_size > 0:
                # Entry condition
                entry_condition = row['is_green'] and row['close'] < row['ma'] and looking_for_entry
                if entry_condition:
                    # Add to position
                    new_qty = (portfolio_value * 0.01) / row['close']  # 1% of portfolio
                    position_size += new_qty
                    new_value = new_qty * row['close']
                    position_value += new_value
                    
                    looking_for_entry = False
                    total_entries += 1
                    
                    if not is_buy_section:
                        is_buy_section = True
                        buy_sections += 1
                        buy_section_low = row['low']
                    
                    trades.append({
                        'timestamp': row['timestamp'],
                        'type': 'BUY',
                        'price': row['close'],
                        'quantity': new_qty,
                        'value': new_value
                    })
                
                # Exit condition
                exit_condition = row['is_red'] and row['close'] > row['ma'] and looking_for_exit
                if exit_condition:
                    # Partial exit
                    exit_qty = position_size * (self.exit_percentage / 100)
                    if exit_qty > 0:
                        exit_value = exit_qty * row['close']
                        position_size -= exit_qty
                        position_value -= exit_value
                        portfolio_value += exit_value * (1 - self.commission)
                        
                        looking_for_exit = False
                        total_exits += 1
                        
                        if is_buy_section:
                            is_buy_section = False
                            sell_sections += 1
                        
                        trades.append({
                            'timestamp': row['timestamp'],
                            'type': 'SELL',
                            'price': row['close'],
                            'quantity': exit_qty,
                            'value': exit_value
                        })
            
            # Update portfolio value
            current_portfolio_value = portfolio_value
            if position_size > 0:
                current_portfolio_value += position_size * row['close']
            
            equity_curve.append(current_portfolio_value)
        
        # Calculate final results
        final_value = equity_curve[-1] if equity_curve else self.initial_capital
        total_return = ((final_value - self.initial_capital) / self.initial_capital) * 100
        
        return {
            'symbol': symbol,
            'initial_capital': self.initial_capital,
            'final_value': final_value,
            'total_return': total_return,
            'total_entries': total_entries,
            'total_exits': total_exits,
            'buy_sections': buy_sections,
            'sell_sections': sell_sections,
            'trades': trades,
            'equity_curve': equity_curve
        }
    
    def run_multi_pair_backtest(self, max_pairs=100):
        """Run backtest on multiple pairs"""
        print(f"Starting Holy Grail Backtester v{self.version}")
        print("=" * 50)
        
        # Fetch top pairs
        top_pairs = self.fetch_top_pairs(max_pairs)
        
        if not top_pairs:
            print("No pairs found!")
            return
        
        results = []
        
        for i, symbol in enumerate(top_pairs):
            print(f"\nProcessing {i+1}/{len(top_pairs)}: {symbol}")
            
            # Fetch data
            df = self.fetch_ohlcv_data(symbol, days=365)
            
            if df.empty:
                print(f"No data for {symbol}")
                continue
            
            # Run backtest
            result = self.run_backtest(df, symbol)
            
            if result:
                results.append(result)
                print(f"Completed {symbol}: {result['total_return']:.2f}% return")
            
            # Rate limiting
            time.sleep(1)
        
        # Display results
        self.display_results(results)
        
        return results
    
    def display_results(self, results):
        """Display backtest results"""
        if not results:
            print("No results to display")
            return
        
        print("\n" + "=" * 80)
        print("HOLY GRAIL BACKTEST RESULTS")
        print("=" * 80)
        
        # Sort by return
        results.sort(key=lambda x: x['total_return'], reverse=True)
        
        print(f"{'Rank':<5} {'Symbol':<15} {'Return %':<10} {'Entries':<8} {'Exits':<8} {'Buy Sec':<8} {'Sell Sec':<8}")
        print("-" * 80)
        
        for i, result in enumerate(results):
            print(f"{i+1:<5} {result['symbol']:<15} {result['total_return']:<10.2f} "
                  f"{result['total_entries']:<8} {result['total_exits']:<8} "
                  f"{result['buy_sections']:<8} {result['sell_sections']:<8}")
        
        # Summary statistics
        returns = [r['total_return'] for r in results]
        print(f"\nSUMMARY STATISTICS:")
        print(f"Total pairs tested: {len(results)}")
        print(f"Average return: {np.mean(returns):.2f}%")
        print(f"Best return: {max(returns):.2f}%")
        print(f"Worst return: {min(returns):.2f}%")
        print(f"Win rate: {len([r for r in returns if r > 0])/len(returns)*100:.1f}%")
        
        # Top 10 performers
        print(f"\nTOP 10 PERFORMERS:")
        for i, result in enumerate(results[:10]):
            print(f"{i+1}. {result['symbol']}: {result['total_return']:.2f}%")

def main():
    # Initialize backtester
    backtester = HolyGrailBacktester()
    
    # Configure parameters (matching Pine Script inputs)
    backtester.init_entry_percentage = 50  # Init Entry %
    backtester.exit_percentage = 3  # Exit %
    backtester.ma_length = 50  # MA Length
    backtester.show_stats_table = True
    
    # Run backtest on top 100 pairs
    results = backtester.run_multi_pair_backtest(max_pairs=100)
    
    return results

if __name__ == "__main__":
    results = main()
