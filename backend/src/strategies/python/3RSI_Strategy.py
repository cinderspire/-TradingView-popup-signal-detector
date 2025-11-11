import ccxt
import pandas as pd
import numpy as np
import talib
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class CryptoBacktester:
    def __init__(self, exchange_name='binance'):
        """Initialize the backtester with exchange and parameters"""
        self.exchange = getattr(ccxt, exchange_name)({
            'apiKey': '',  # Add your API keys if needed for more data
            'secret': '',
            'sandbox': False,
            'enableRateLimit': True,
        })
        
        # Strategy parameters from your MT5 config
        self.params = {
            # Time Settings
            'start_time': datetime(2024, 6, 2),  # 1 year back from save date
            'end_time': datetime(2025, 6, 2),
            
            # Trade Direction (2 = both long and short)
            'trade_direction': 2,
            
            # Order Weights (optimized values from your config)
            'weights': [22.151, 14.290, 67.041, 38.539, 3.28],
            
            # Long Bot Settings
            'long_rate_cover': 192.0,
            'long_take_profit': 3.60,
            'long_stop_loss_enable': True,
            'long_stop_loss': 120.0,
            
            # Short Bot Settings
            'short_rate_cover': 850.0,
            'short_take_profit': 0.3,
            'short_stop_loss_enable': True,
            'short_stop_loss': 310.0,
            
            # RSI Settings
            'rsi1_enable': True,
            'rsi1_timeframe': '3m',  # Converted from MT5 timeframe code
            'rsi1_long_threshold': 117,
            'rsi1_long_period': 33,
            'rsi1_short_threshold': 16,
            'rsi1_short_period': 20,
            
            'rsi2_enable': False,
            'rsi2_timeframe': '1m',
            'rsi2_long_threshold': 90,
            'rsi2_long_period': 38,
            'rsi2_short_threshold': 20,
            'rsi2_short_period': 18,
            
            'rsi3_enable': True,
            'rsi3_timeframe': '1m',
            'rsi3_long_threshold': 7,
            'rsi3_long_period': 14,
            'rsi3_short_threshold': 3,
            'rsi3_short_period': 20,
            
            # CCI Settings
            'cci1_enable': False,
            'cci1_timeframe': '1m',
            'cci1_long_threshold': 257,
            'cci1_long_period': 21,
            'cci1_short_threshold': -260,
            'cci1_short_period': 2,
            
            'cci2_enable': True,
            'cci2_timeframe': '1m',
            'cci2_long_threshold': 105,
            'cci2_long_period': 4,
            'cci2_short_threshold': 300,
            'cci2_short_period': 41,
            
            'cci3_enable': True,
            'cci3_timeframe': '4h',
            'cci3_long_threshold': 350,
            'cci3_long_period': 34,
            'cci3_short_threshold': -1565,
            'cci3_short_period': 47,
            
            # Bollinger Bands Settings
            'bb_enable': True,
            'bb_timeframe': '1m',
            'bb_deviation': 2.2,
            'bb_period': 103,
            
            # Band CCI Settings
            'band_cci_enable': True,
            'band_cci_timeframe': '1m',
            'band_cci_period': 99,
            'band_cci_low': -140,
            'band_cci_high': 200,
            
            # Trading Settings
            'initial_capital': 0.02,  # 2% of account per trade
            'show_signals': True
        }
        
        self.positions = []
        self.orders = []
        self.balance = 10000  # Starting balance in USDT
        self.results = []

    def get_top_crypto_pairs(self, limit=400):
        """Get top cryptocurrency pairs by volume"""
        try:
            markets = self.exchange.load_markets()
            usdt_pairs = [symbol for symbol in markets.keys() 
                         if symbol.endswith('/USDT') and markets[symbol]['active']]
            
            # Get 24h tickers to sort by volume
            tickers = self.exchange.fetch_tickers()
            
            # Sort by volume and take top pairs
            sorted_pairs = sorted(
                [(symbol, tickers.get(symbol, {}).get('quoteVolume', 0)) 
                 for symbol in usdt_pairs],
                key=lambda x: x[1] if x[1] else 0,
                reverse=True
            )
            
            return [pair[0] for pair in sorted_pairs[:limit]]
        except Exception as e:
            print(f"Error getting crypto pairs: {e}")
            # Fallback to major pairs
            return ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT']

    def fetch_ohlcv_data(self, symbol, timeframe='3m', limit=1000):
        """Fetch OHLCV data for a symbol"""
        try:
            ohlcv = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            return df
        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
            return None

    def calculate_indicators(self, df):
        """Calculate all technical indicators"""
        indicators = {}
        
        # RSI indicators
        if self.params['rsi1_enable']:
            indicators['rsi1_long'] = talib.RSI(df['close'], timeperiod=self.params['rsi1_long_period'])
            indicators['rsi1_short'] = talib.RSI(df['close'], timeperiod=self.params['rsi1_short_period'])
        
        if self.params['rsi2_enable']:
            indicators['rsi2_long'] = talib.RSI(df['close'], timeperiod=self.params['rsi2_long_period'])
            indicators['rsi2_short'] = talib.RSI(df['close'], timeperiod=self.params['rsi2_short_period'])
        
        if self.params['rsi3_enable']:
            indicators['rsi3_long'] = talib.RSI(df['close'], timeperiod=self.params['rsi3_long_period'])
            indicators['rsi3_short'] = talib.RSI(df['close'], timeperiod=self.params['rsi3_short_period'])
        
        # CCI indicators
        if self.params['cci1_enable']:
            indicators['cci1_long'] = talib.CCI(df['high'], df['low'], df['close'], timeperiod=self.params['cci1_long_period'])
            indicators['cci1_short'] = talib.CCI(df['high'], df['low'], df['close'], timeperiod=self.params['cci1_short_period'])
        
        if self.params['cci2_enable']:
            indicators['cci2_long'] = talib.CCI(df['high'], df['low'], df['close'], timeperiod=self.params['cci2_long_period'])
            indicators['cci2_short'] = talib.CCI(df['high'], df['low'], df['close'], timeperiod=self.params['cci2_short_period'])
        
        if self.params['cci3_enable']:
            indicators['cci3_long'] = talib.CCI(df['high'], df['low'], df['close'], timeperiod=self.params['cci3_long_period'])
            indicators['cci3_short'] = talib.CCI(df['high'], df['low'], df['close'], timeperiod=self.params['cci3_short_period'])
        
        # Bollinger Bands
        if self.params['bb_enable']:
            bb_upper, bb_middle, bb_lower = talib.BBANDS(
                df['close'], 
                timeperiod=self.params['bb_period'],
                nbdevup=self.params['bb_deviation'],
                nbdevdn=self.params['bb_deviation']
            )
            indicators['bb_upper'] = bb_upper
            indicators['bb_lower'] = bb_lower
        
        # Band CCI
        if self.params['band_cci_enable']:
            indicators['band_cci'] = talib.CCI(df['high'], df['low'], df['close'], timeperiod=self.params['band_cci_period'])
        
        return indicators

    def check_long_signal(self, indicators, current_price, index):
        """Check for long entry signal"""
        rating_long = 0
        rating_long_num = 0
        
        # RSI-1 Long
        if self.params['rsi1_enable'] and 'rsi1_long' in indicators:
            if not pd.isna(indicators['rsi1_long'].iloc[index]):
                if indicators['rsi1_long'].iloc[index] < self.params['rsi1_long_threshold']:
                    rating_long += 1
                rating_long_num += 1
        
        # RSI-2 Long
        if self.params['rsi2_enable'] and 'rsi2_long' in indicators:
            if not pd.isna(indicators['rsi2_long'].iloc[index]):
                if indicators['rsi2_long'].iloc[index] < self.params['rsi2_long_threshold']:
                    rating_long += 1
                rating_long_num += 1
        
        # RSI-3 Long
        if self.params['rsi3_enable'] and 'rsi3_long' in indicators:
            if not pd.isna(indicators['rsi3_long'].iloc[index]):
                if indicators['rsi3_long'].iloc[index] < self.params['rsi3_long_threshold']:
                    rating_long += 1
                rating_long_num += 1
        
        # CCI indicators
        if self.params['cci1_enable'] and 'cci1_long' in indicators:
            if not pd.isna(indicators['cci1_long'].iloc[index]):
                if indicators['cci1_long'].iloc[index] < self.params['cci1_long_threshold']:
                    rating_long += 1
                rating_long_num += 1
        
        if self.params['cci2_enable'] and 'cci2_long' in indicators:
            if not pd.isna(indicators['cci2_long'].iloc[index]):
                if indicators['cci2_long'].iloc[index] < self.params['cci2_long_threshold']:
                    rating_long += 1
                rating_long_num += 1
        
        if self.params['cci3_enable'] and 'cci3_long' in indicators:
            if not pd.isna(indicators['cci3_long'].iloc[index]):
                if indicators['cci3_long'].iloc[index] < self.params['cci3_long_threshold']:
                    rating_long += 1
                rating_long_num += 1
        
        # Bollinger Bands Long
        if self.params['bb_enable'] and 'bb_lower' in indicators:
            if not pd.isna(indicators['bb_lower'].iloc[index]):
                if current_price < indicators['bb_lower'].iloc[index]:
                    rating_long += 1
                rating_long_num += 1
        
        # Band CCI
        if self.params['band_cci_enable'] and 'band_cci' in indicators:
            if not pd.isna(indicators['band_cci'].iloc[index]):
                cci_val = indicators['band_cci'].iloc[index]
                if self.params['band_cci_low'] < cci_val < self.params['band_cci_high']:
                    rating_long += 1
                rating_long_num += 1
        
        return rating_long_num > 0 and rating_long == rating_long_num

    def check_short_signal(self, indicators, current_price, index):
        """Check for short entry signal"""
        rating_short = 0
        rating_short_num = 0
        
        # RSI-1 Short
        if self.params['rsi1_enable'] and 'rsi1_short' in indicators:
            if not pd.isna(indicators['rsi1_short'].iloc[index]):
                if indicators['rsi1_short'].iloc[index] > self.params['rsi1_short_threshold']:
                    rating_short += 1
                rating_short_num += 1
        
        # RSI-2 Short
        if self.params['rsi2_enable'] and 'rsi2_short' in indicators:
            if not pd.isna(indicators['rsi2_short'].iloc[index]):
                if indicators['rsi2_short'].iloc[index] > self.params['rsi2_short_threshold']:
                    rating_short += 1
                rating_short_num += 1
        
        # RSI-3 Short
        if self.params['rsi3_enable'] and 'rsi3_short' in indicators:
            if not pd.isna(indicators['rsi3_short'].iloc[index]):
                if indicators['rsi3_short'].iloc[index] > self.params['rsi3_short_threshold']:
                    rating_short += 1
                rating_short_num += 1
        
        # CCI indicators
        if self.params['cci1_enable'] and 'cci1_short' in indicators:
            if not pd.isna(indicators['cci1_short'].iloc[index]):
                if indicators['cci1_short'].iloc[index] > self.params['cci1_short_threshold']:
                    rating_short += 1
                rating_short_num += 1
        
        if self.params['cci2_enable'] and 'cci2_short' in indicators:
            if not pd.isna(indicators['cci2_short'].iloc[index]):
                if indicators['cci2_short'].iloc[index] > self.params['cci2_short_threshold']:
                    rating_short += 1
                rating_short_num += 1
        
        if self.params['cci3_enable'] and 'cci3_short' in indicators:
            if not pd.isna(indicators['cci3_short'].iloc[index]):
                if indicators['cci3_short'].iloc[index] > self.params['cci3_short_threshold']:
                    rating_short += 1
                rating_short_num += 1
        
        # Bollinger Bands Short
        if self.params['bb_enable'] and 'bb_upper' in indicators:
            if not pd.isna(indicators['bb_upper'].iloc[index]):
                if current_price > indicators['bb_upper'].iloc[index]:
                    rating_short += 1
                rating_short_num += 1
        
        # Band CCI
        if self.params['band_cci_enable'] and 'band_cci' in indicators:
            if not pd.isna(indicators['band_cci'].iloc[index]):
                cci_val = indicators['band_cci'].iloc[index]
                if self.params['band_cci_low'] < cci_val < self.params['band_cci_high']:
                    rating_short += 1
                rating_short_num += 1
        
        return rating_short_num > 0 and rating_short == rating_short_num

    def place_orders(self, symbol, direction, current_price, timestamp):
        """Place multiple orders with different weights (DCA strategy)"""
        orders = []
        trade_amount = self.balance * self.params['initial_capital']
        
        if direction == 'long':
            step = self.params['long_rate_cover'] / 4 * 0.01
            for i in range(5):
                entry_price = current_price * (1 - step * i)
                volume = (trade_amount * self.params['weights'][i] * 0.01) / entry_price
                
                order = {
                    'symbol': symbol,
                    'type': 'buy_limit',
                    'volume': volume,
                    'entry_price': entry_price,
                    'timestamp': timestamp,
                    'status': 'pending',
                    'order_id': len(self.orders)
                }
                orders.append(order)
        
        elif direction == 'short':
            step = self.params['short_rate_cover'] / 4 * 0.01
            for i in range(5):
                entry_price = current_price * (1 + step * i)
                volume = (trade_amount * self.params['weights'][i] * 0.01) / entry_price
                
                order = {
                    'symbol': symbol,
                    'type': 'sell_limit',
                    'volume': volume,
                    'entry_price': entry_price,
                    'timestamp': timestamp,
                    'status': 'pending',
                    'order_id': len(self.orders)
                }
                orders.append(order)
        
        self.orders.extend(orders)
        return orders

    def check_order_execution(self, current_price, timestamp):
        """Check if pending orders should be executed"""
        for order in self.orders:
            if order['status'] == 'pending':
                should_execute = False
                
                if order['type'] == 'buy_limit' and current_price <= order['entry_price']:
                    should_execute = True
                elif order['type'] == 'sell_limit' and current_price >= order['entry_price']:
                    should_execute = True
                
                if should_execute:
                    # Execute order
                    position = {
                        'symbol': order['symbol'],
                        'type': 'long' if order['type'] == 'buy_limit' else 'short',
                        'volume': order['volume'],
                        'entry_price': order['entry_price'],
                        'entry_time': timestamp,
                        'status': 'open'
                    }
                    self.positions.append(position)
                    order['status'] = 'executed'

    def check_exit_conditions(self, current_price, timestamp):
        """Check if positions should be closed"""
        for position in self.positions:
            if position['status'] == 'open':
                should_close = False
                exit_reason = ''
                
                if position['type'] == 'long':
                    # Long take profit
                    tp_price = position['entry_price'] * (1 + self.params['long_take_profit'] * 0.01)
                    if current_price >= tp_price:
                        should_close = True
                        exit_reason = 'take_profit'
                    
                    # Long stop loss
                    if self.params['long_stop_loss_enable']:
                        sl_price = position['entry_price'] * (1 - self.params['long_stop_loss'] * 0.01)
                        if current_price <= sl_price:
                            should_close = True
                            exit_reason = 'stop_loss'
                
                elif position['type'] == 'short':
                    # Short take profit
                    tp_price = position['entry_price'] * (1 - self.params['short_take_profit'] * 0.01)
                    if current_price <= tp_price:
                        should_close = True
                        exit_reason = 'take_profit'
                    
                    # Short stop loss
                    if self.params['short_stop_loss_enable']:
                        sl_price = position['entry_price'] * (1 + self.params['short_stop_loss'] * 0.01)
                        if current_price >= sl_price:
                            should_close = True
                            exit_reason = 'stop_loss'
                
                if should_close:
                    # Calculate P&L
                    if position['type'] == 'long':
                        pnl = (current_price - position['entry_price']) * position['volume']
                    else:
                        pnl = (position['entry_price'] - current_price) * position['volume']
                    
                    # Close position
                    position['status'] = 'closed'
                    position['exit_price'] = current_price
                    position['exit_time'] = timestamp
                    position['pnl'] = pnl
                    position['exit_reason'] = exit_reason
                    
                    # Update balance
                    self.balance += pnl
                    
                    # Cancel remaining pending orders for this symbol
                    for order in self.orders:
                        if order['symbol'] == position['symbol'] and order['status'] == 'pending':
                            order['status'] = 'cancelled'

    def backtest_symbol(self, symbol):
        """Backtest strategy on a single symbol"""
        print(f"Backtesting {symbol}...")
        
        # Fetch data
        df = self.fetch_ohlcv_data(symbol, '3m', 1000)
        if df is None or len(df) < 100:
            return
        
        # Calculate indicators
        indicators = self.calculate_indicators(df)
        
        # Simulate trading
        for i in range(100, len(df)):  # Start after indicators are calculated
            current_price = df['close'].iloc[i]
            timestamp = df.index[i]
            
            # Check order execution
            self.check_order_execution(current_price, timestamp)
            
            # Check exit conditions
            self.check_exit_conditions(current_price, timestamp)
            
            # Check for new signals (only if no open positions)
            if not any(pos['status'] == 'open' for pos in self.positions):
                long_signal = False
                short_signal = False
                
                if self.params['trade_direction'] in [0, 2]:  # Long or Both
                    long_signal = self.check_long_signal(indicators, current_price, i)
                
                if self.params['trade_direction'] in [1, 2]:  # Short or Both
                    short_signal = self.check_short_signal(indicators, current_price, i)
                
                # Place orders
                if long_signal:
                    self.place_orders(symbol, 'long', current_price, timestamp)
                elif short_signal:
                    self.place_orders(symbol, 'short', current_price, timestamp)

    def run_backtest(self, max_pairs=50):
        """Run backtest on multiple cryptocurrency pairs"""
        print("Starting cryptocurrency backtest...")
        print(f"Initial balance: ${self.balance:,.2f}")
        
        # Get top crypto pairs
        crypto_pairs = self.get_top_crypto_pairs(400)
        print(f"Found {len(crypto_pairs)} crypto pairs")
        
        # Limit pairs for testing
        test_pairs = crypto_pairs[:max_pairs]
        print(f"Testing on {len(test_pairs)} pairs")
        
        # Reset for each symbol
        for symbol in test_pairs:
            try:
                # Reset positions and orders for each symbol
                symbol_positions = []
                symbol_orders = []
                
                self.backtest_symbol(symbol)
                
            except Exception as e:
                print(f"Error backtesting {symbol}: {e}")
                continue
        
        # Calculate results
        self.calculate_results()

    def calculate_results(self):
        """Calculate and display backtest results"""
        closed_positions = [pos for pos in self.positions if pos['status'] == 'closed']
        
        if not closed_positions:
            print("No completed trades found.")
            return
        
        total_trades = len(closed_positions)
        winning_trades = len([pos for pos in closed_positions if pos['pnl'] > 0])
        losing_trades = total_trades - winning_trades
        
        total_pnl = sum(pos['pnl'] for pos in closed_positions)
        win_rate = (winning_trades / total_trades) * 100 if total_trades > 0 else 0
        
        avg_win = np.mean([pos['pnl'] for pos in closed_positions if pos['pnl'] > 0]) if winning_trades > 0 else 0
        avg_loss = np.mean([pos['pnl'] for pos in closed_positions if pos['pnl'] < 0]) if losing_trades > 0 else 0
        
        final_balance = self.balance
        roi = ((final_balance - 10000) / 10000) * 100
        
        print("\n" + "="*50)
        print("BACKTEST RESULTS")
        print("="*50)
        print(f"Initial Balance: ${10000:,.2f}")
        print(f"Final Balance: ${final_balance:,.2f}")
        print(f"Total P&L: ${total_pnl:,.2f}")
        print(f"ROI: {roi:.2f}%")
        print(f"Total Trades: {total_trades}")
        print(f"Winning Trades: {winning_trades}")
        print(f"Losing Trades: {losing_trades}")
        print(f"Win Rate: {win_rate:.2f}%")
        print(f"Average Win: ${avg_win:.2f}")
        print(f"Average Loss: ${avg_loss:.2f}")
        
        if avg_loss != 0:
            profit_factor = abs(avg_win * winning_trades) / abs(avg_loss * losing_trades)
            print(f"Profit Factor: {profit_factor:.2f}")

# Usage example
if __name__ == "__main__":
    # Initialize backtester
    backtester = CryptoBacktester('binance')
    
    # Run backtest on top 50 crypto pairs
    backtester.run_backtest(max_pairs=1)
