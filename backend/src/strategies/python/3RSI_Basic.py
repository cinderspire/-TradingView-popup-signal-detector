import ccxt
import pandas as pd
import numpy as np
import os
import time
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class CryptoBacktester:
    def __init__(self, exchange_name='binance', timeframe='3m', days=90):
        """Initialize the backtester with exchange and parameters"""
        self.exchange = getattr(ccxt, exchange_name)()
        self.timeframe = timeframe
        self.days = days
        self.data_dir = 'crypto_data'
        self.results_dir = 'backtest_results'
        
        # Create directories
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.results_dir, exist_ok=True)
        
        # Strategy parameters from Pine Script
        self.initial_capital = 0.02  # 2% initial capital
        self.commission = 0.075 / 100  # 0.075% commission
        
        # Order weights
        self.weight_orders = [0.22151, 0.14290, 0.67041, 0.38539, 0.0328]
        
        # Long bot parameters
        self.long_rate_cover = 192 / 4 * 0.01  # 48% rate cover
        self.long_take_profit = 0.036  # 3.6% take profit
        self.long_stop_loss = 1.20  # 120% stop loss
        
        # Short bot parameters
        self.short_rate_cover = 850 / 4 * 0.01  # 212.5% rate cover
        self.short_take_profit = 0.003  # 0.3% take profit
        self.short_stop_loss = 3.10  # 310% stop loss
        
        # Technical indicators parameters
        self.rsi_params = {
            'rsi1': {'enabled': True, 'long_threshold': 117, 'long_period': 33, 'short_threshold': 16, 'short_period': 20},
            'rsi2': {'enabled': False, 'long_threshold': 90, 'long_period': 38, 'short_threshold': 20, 'short_period': 18},
            'rsi3': {'enabled': True, 'long_threshold': 7, 'long_period': 14, 'short_threshold': 3, 'short_period': 20}
        }
        
        self.cci_params = {
            'cci1': {'enabled': False, 'long_threshold': 257, 'long_period': 21, 'short_threshold': -260, 'short_period': 2},
            'cci2': {'enabled': True, 'long_threshold': 105, 'long_period': 4, 'short_threshold': 300, 'short_period': 41},
            'cci3': {'enabled': True, 'long_threshold': 350, 'long_period': 34, 'short_threshold': -1565, 'short_period': 47}
        }
        
        self.bb_params = {'enabled': True, 'period': 103, 'deviation': 2.2}
        
    def get_top_pairs(self, limit=20):
        """Get top trading pairs by volume"""
        print("Fetching top trading pairs...")
        try:
            tickers = self.exchange.fetch_tickers()
            
            # Filter USDT pairs and sort by volume
            usdt_pairs = {k: v for k, v in tickers.items() if k.endswith('/USDT')}
            sorted_pairs = sorted(usdt_pairs.items(), key=lambda x: x[1]['quoteVolume'] or 0, reverse=True)
            
            top_pairs = [pair[0] for pair in sorted_pairs[:limit]]
            print(f"Found {len(top_pairs)} top pairs")
            return top_pairs
            
        except Exception as e:
            print(f"Error fetching pairs: {e}")
            return []
    
    def fetch_ohlcv(self, symbol, save_csv=True):
        """Fetch OHLCV data for a symbol"""
        csv_file = os.path.join(self.data_dir, f"{symbol.replace('/', '_')}.csv")
        
        # Check if CSV exists and is recent
        if os.path.exists(csv_file):
            try:
                df = pd.read_csv(csv_file, parse_dates=['timestamp'])
                # Check if data is recent (within last hour)
                if not df.empty and (datetime.now() - df['timestamp'].max()).total_seconds() < 3600:
                    print(f"Using existing data for {symbol}")
                    return df
            except Exception as e:
                print(f"Error reading CSV for {symbol}: {e}")
        
        # Fetch new data
        try:
            print(f"Fetching data for {symbol}...")
            since = int((datetime.now() - timedelta(days=self.days)).timestamp() * 1000)
            
            all_data = []
            while True:
                try:
                    ohlcv = self.exchange.fetch_ohlcv(symbol, self.timeframe, since=since, limit=1000)
                    if not ohlcv:
                        break
                    
                    all_data.extend(ohlcv)
                    since = ohlcv[-1][0] + 1
                    
                    if len(ohlcv) < 1000:
                        break
                        
                    time.sleep(0.1)  # Rate limiting
                    
                except Exception as e:
                    print(f"Error fetching data for {symbol}: {e}")
                    break
            
            if not all_data:
                return pd.DataFrame()
            
            # Convert to DataFrame
            df = pd.DataFrame(all_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df = df.drop_duplicates(subset=['timestamp']).sort_values('timestamp').reset_index(drop=True)
            
            # Save to CSV
            if save_csv:
                df.to_csv(csv_file, index=False)
                print(f"Saved data for {symbol} to {csv_file}")
            
            return df
            
        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
            return pd.DataFrame()
    
    def calculate_rsi(self, prices, period=14):
        """Calculate RSI indicator"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    def calculate_cci(self, high, low, close, period=20):
        """Calculate CCI indicator"""
        tp = (high + low + close) / 3
        sma = tp.rolling(window=period).mean()
        mad = tp.rolling(window=period).apply(lambda x: np.mean(np.abs(x - x.mean())))
        cci = (tp - sma) / (0.015 * mad)
        return cci
    
    def calculate_bollinger_bands(self, prices, period=20, deviation=2):
        """Calculate Bollinger Bands"""
        sma = prices.rolling(window=period).mean()
        std = prices.rolling(window=period).std()
        upper_band = sma + (std * deviation)
        lower_band = sma - (std * deviation)
        return upper_band, lower_band, sma
    
    def generate_signals(self, df):
        """Generate trading signals based on Pine Script strategy"""
        if df.empty or len(df) < 200:
            return df
        
        # Calculate technical indicators
        close = df['close']
        high = df['high']
        low = df['low']
        
        # RSI calculations
        rsi_signals_long = []
        rsi_signals_short = []
        
        for key, params in self.rsi_params.items():
            if params['enabled']:
                rsi_long = self.calculate_rsi(close, params['long_period'])
                rsi_short = self.calculate_rsi(close, params['short_period'])
                
                rsi_signals_long.append(rsi_long < params['long_threshold'])
                rsi_signals_short.append(rsi_short > params['short_threshold'])
        
        # CCI calculations
        cci_signals_long = []
        cci_signals_short = []
        
        for key, params in self.cci_params.items():
            if params['enabled']:
                cci_long = self.calculate_cci(high, low, close, params['long_period'])
                cci_short = self.calculate_cci(high, low, close, params['short_period'])
                
                cci_signals_long.append(cci_long < params['long_threshold'])
                cci_signals_short.append(cci_short > params['short_threshold'])
        
        # Bollinger Bands
        bb_signals_long = []
        bb_signals_short = []
        
        if self.bb_params['enabled']:
            upper_bb, lower_bb, bb_sma = self.calculate_bollinger_bands(
                close, self.bb_params['period'], self.bb_params['deviation']
            )
            bb_signals_long.append(close < lower_bb)
            bb_signals_short.append(close > upper_bb)
        
        # Combine signals
        long_signals = rsi_signals_long + cci_signals_long + bb_signals_long
        short_signals = rsi_signals_short + cci_signals_short + bb_signals_short
        
        # Generate buy/sell signals (all conditions must be True)
        if long_signals:
            df['buy_signal'] = np.all(long_signals, axis=0)
        else:
            df['buy_signal'] = False
            
        if short_signals:
            df['sell_signal'] = np.all(short_signals, axis=0)
        else:
            df['sell_signal'] = False
        
        return df
    
    def backtest_symbol(self, symbol, df):
        """Backtest strategy for a single symbol"""
        if df.empty:
            return None
        
        # Generate signals
        df = self.generate_signals(df)
        
        if df.empty:
            return None
        
        # Initialize tracking variables
        position = 0
        entry_price = 0
        entry_time = None
        trades = []
        capital = self.initial_capital
        
        for i in range(len(df)):
            current_price = df.iloc[i]['close']
            current_time = df.iloc[i]['timestamp']
            
            # Long entry
            if df.iloc[i]['buy_signal'] and position == 0:
                position = 1
                entry_price = current_price
                entry_time = current_time
                
            # Short entry
            elif df.iloc[i]['sell_signal'] and position == 0:
                position = -1
                entry_price = current_price
                entry_time = current_time
            
            # Exit conditions
            elif position != 0:
                exit_signal = False
                exit_price = current_price
                exit_reason = ""
                
                if position == 1:  # Long position
                    # Take profit
                    if current_price >= entry_price * (1 + self.long_take_profit):
                        exit_signal = True
                        exit_reason = "TP"
                    # Stop loss
                    elif current_price <= entry_price * (1 - self.long_stop_loss):
                        exit_signal = True
                        exit_reason = "SL"
                
                elif position == -1:  # Short position
                    # Take profit
                    if current_price <= entry_price * (1 - self.short_take_profit):
                        exit_signal = True
                        exit_reason = "TP"
                    # Stop loss
                    elif current_price >= entry_price * (1 + self.short_stop_loss):
                        exit_signal = True
                        exit_reason = "SL"
                
                if exit_signal:
                    # Calculate PnL
                    if position == 1:
                        pnl_pct = (exit_price - entry_price) / entry_price
                    else:
                        pnl_pct = (entry_price - exit_price) / entry_price
                    
                    pnl_pct -= self.commission * 2  # Entry + exit commission
                    
                    # Calculate holding time
                    holding_time = (current_time - entry_time).total_seconds() / 3600  # Hours
                    
                    trades.append({
                        'symbol': symbol,
                        'direction': 'Long' if position == 1 else 'Short',
                        'entry_time': entry_time,
                        'exit_time': current_time,
                        'entry_price': entry_price,
                        'exit_price': exit_price,
                        'pnl_pct': pnl_pct,
                        'holding_time': holding_time,
                        'exit_reason': exit_reason
                    })
                    
                    position = 0
                    entry_price = 0
                    entry_time = None
        
        return trades
    
    def calculate_metrics(self, trades):
        """Calculate performance metrics"""
        if not trades:
            return {}
        
        df_trades = pd.DataFrame(trades)
        
        # Basic metrics
        total_trades = len(df_trades)
        winning_trades = len(df_trades[df_trades['pnl_pct'] > 0])
        losing_trades = len(df_trades[df_trades['pnl_pct'] < 0])
        
        win_rate = winning_trades / total_trades * 100 if total_trades > 0 else 0
        
        # PnL calculations
        total_pnl = df_trades['pnl_pct'].sum() * 100
        avg_pnl = df_trades['pnl_pct'].mean() * 100
        
        # Drawdown calculation
        cumulative_pnl = df_trades['pnl_pct'].cumsum()
        running_max = cumulative_pnl.cummax()
        drawdown = (cumulative_pnl - running_max) * 100
        max_drawdown = drawdown.min()
        
        # Holding time
        avg_holding_time = df_trades['holding_time'].mean()
        
        return {
            'total_trades': total_trades,
            'winning_trades': winning_trades,
            'losing_trades': losing_trades,
            'win_rate': win_rate,
            'total_pnl': total_pnl,
            'avg_pnl': avg_pnl,
            'max_drawdown': max_drawdown,
            'avg_holding_time': avg_holding_time
        }
    
    def run_backtest(self, max_pairs=20):
        """Run backtest on top pairs"""
        print("Starting comprehensive backtest...")
        
        # Get top pairs
        top_pairs = self.get_top_pairs(max_pairs)
        
        if not top_pairs:
            print("No pairs found!")
            return
        
        all_results = []
        
        for i, symbol in enumerate(top_pairs):
            print(f"\nProcessing {i+1}/{len(top_pairs)}: {symbol}")
            
            try:
                # Fetch data
                df = self.fetch_ohlcv(symbol)
                
                if df.empty:
                    print(f"No data for {symbol}")
                    continue
                
                # Run backtest
                trades = self.backtest_symbol(symbol, df)
                
                if not trades:
                    print(f"No trades for {symbol}")
                    continue
                
                # Calculate metrics
                metrics = self.calculate_metrics(trades)
                
                if metrics:
                    metrics['symbol'] = symbol
                    all_results.append(metrics)
                    
                    print(f"Results for {symbol}:")
                    print(f"  Total PnL: {metrics['total_pnl']:.2f}%")
                    print(f"  Win Rate: {metrics['win_rate']:.2f}%")
                    print(f"  Max DD: {metrics['max_drawdown']:.2f}%")
                    print(f"  Avg Holding: {metrics['avg_holding_time']:.2f}h")
                
            except Exception as e:
                print(f"Error processing {symbol}: {e}")
                continue
        
        # Sort results by PnL
        all_results.sort(key=lambda x: x['total_pnl'], reverse=True)
        
        # Save results
        results_df = pd.DataFrame(all_results)
        results_file = os.path.join(self.results_dir, f'backtest_results_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv')
        results_df.to_csv(results_file, index=False)
        
        # Display top results
        print("\n" + "="*80)
        print("TOP 20 RESULTS (sorted by PnL)")
        print("="*80)
        
        for i, result in enumerate(all_results[:20]):
            print(f"{i+1:2d}. {result['symbol']:15s} | "
                  f"PnL: {result['total_pnl']:8.2f}% | "
                  f"WR: {result['win_rate']:6.2f}% | "
                  f"DD: {result['max_drawdown']:8.2f}% | "
                  f"Trades: {result['total_trades']:3d} | "
                  f"Avg Hold: {result['avg_holding_time']:6.2f}h")
        
        print(f"\nFull results saved to: {results_file}")
        
        # Summary statistics
        if all_results:
            total_symbols = len(all_results)
            profitable_symbols = len([r for r in all_results if r['total_pnl'] > 0])
            
            print(f"\n" + "="*80)
            print("SUMMARY STATISTICS")
            print("="*80)
            print(f"Total symbols tested: {total_symbols}")
            print(f"Profitable symbols: {profitable_symbols} ({profitable_symbols/total_symbols*100:.1f}%)")
            print(f"Average PnL: {np.mean([r['total_pnl'] for r in all_results]):.2f}%")
            print(f"Average Win Rate: {np.mean([r['win_rate'] for r in all_results]):.2f}%")
            print(f"Average Max DD: {np.mean([r['max_drawdown'] for r in all_results]):.2f}%")
            print(f"Average Holding Time: {np.mean([r['avg_holding_time'] for r in all_results]):.2f}h")

# Usage example
if __name__ == "__main__":
    # Initialize backtester
    backtester = CryptoBacktester(
        exchange_name='binance',
        timeframe='3m',
        days=90
    )
    
    # Run backtest on top 300 pairs
    backtester.run_backtest(max_pairs=20)
