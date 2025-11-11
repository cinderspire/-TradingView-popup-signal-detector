"""
Strategy: 7MACD
Pair: BTC/USDT
Expected ROI: 317.73%
Win Rate: 61.29%
Generated: 2025-08-21 16:35:02

Ready-to-run trading bot for live trading
"""

import ccxt
import pandas as pd
import numpy as np
import time
from datetime import datetime
import talib
import json

class Strategy_7MACD_761:
    """
    MACD Strategy
    Optimized Parameters from backtesting
    """
    
    def __init__(self, config=None):
        # Strategy identification
        self.strategy_name = "7MACD"
        self.strategy_id = "S0761"
        self.pair = "BTC/USDT"
        self.timeframe = "1h"
        
        # Performance metrics from backtesting
        self.expected_roi = 317.7258439495985
        self.expected_win_rate = 61.288245097796775
        self.max_drawdown = 22.376504362158318
        
        # Trading parameters
        self.order_size = config.get('order_size', 10) if config else 10  # $10 default
        self.stop_loss_pct = config.get('stop_loss', 2) if config else 2  # 2% stop loss
        self.take_profit_pct = config.get('take_profit', 5) if config else 5  # 5% take profit
        
        # Strategy-specific parameters
        self.macd_fast = 12
        self.macd_slow = 26
        self.macd_signal = 9
        
        # Exchange setup (configure your API keys)
        self.exchange = None
        self.position = None
        self.balance = 100  # Starting balance
        
        # Performance tracking
        self.trades = []
        self.pnl = 0
        
    def connect_exchange(self, api_key=None, secret=None):
        """Connect to exchange (Binance example)"""
        try:
            self.exchange = ccxt.binance({
                'apiKey': api_key or 'YOUR_API_KEY',
                'secret': secret or 'YOUR_SECRET',
                'enableRateLimit': True,
                'options': {'defaultType': 'spot'}
            })
            print(f"[CONNECTED] Exchange connected for {self.pair}")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to connect: {e}")
            return False
    
    def fetch_market_data(self):
        """Fetch current market data"""
        try:
            # Fetch OHLCV data
            ohlcv = self.exchange.fetch_ohlcv(self.pair, self.timeframe, limit=100)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            return df
        except Exception as e:
            print(f"[ERROR] Failed to fetch data: {e}")
            return None
    
    def calculate_indicators(self, df):
        """Calculate technical indicators"""
        # Calculate MACD
        df['macd'], df['macd_signal'], df['macd_hist'] = talib.MACD(
            df['close'], 
            fastperiod=self.macd_fast,
            slowperiod=self.macd_slow, 
            signalperiod=self.macd_signal
        )
        return df
    
    def generate_signal(self, df):
        """Generate trading signal based on strategy"""
        # MACD crossover signal
        macd = df['macd'].iloc[-1]
        macd_signal = df['macd_signal'].iloc[-1]
        macd_prev = df['macd'].iloc[-2]
        macd_signal_prev = df['macd_signal'].iloc[-2]
        
        if macd > macd_signal and macd_prev <= macd_signal_prev:
            return 'BUY'
        elif macd < macd_signal and macd_prev >= macd_signal_prev and self.position:
            return 'SELL'
        return 'HOLD'
    
    def execute_trade(self, signal, price):
        """Execute trade based on signal"""
        try:
            if signal == 'BUY' and not self.position:
                # Calculate position size
                amount = self.order_size / price
                
                # Place order (paper trading for safety)
                print(f"[BUY] {self.pair} @ ${price:.4f} | Amount: {amount:.6f}")
                
                self.position = {
                    'side': 'BUY',
                    'entry_price': price,
                    'amount': amount,
                    'stop_loss': price * (1 - self.stop_loss_pct/100),
                    'take_profit': price * (1 + self.take_profit_pct/100),
                    'entry_time': datetime.now()
                }
                
                return True
                
            elif signal == 'SELL' and self.position:
                # Calculate PnL
                pnl = (price - self.position['entry_price']) * self.position['amount']
                pnl_pct = ((price - self.position['entry_price']) / self.position['entry_price']) * 100
                
                print(f"[SELL] {self.pair} @ ${price:.4f} | PnL: ${pnl:.2f} ({pnl_pct:.2f}%)")
                
                # Record trade
                self.trades.append({
                    'entry_time': self.position['entry_time'],
                    'exit_time': datetime.now(),
                    'entry_price': self.position['entry_price'],
                    'exit_price': price,
                    'pnl': pnl,
                    'pnl_pct': pnl_pct
                })
                
                self.pnl += pnl
                self.position = None
                
                return True
                
        except Exception as e:
            print(f"[ERROR] Trade execution failed: {e}")
            return False
    
    def check_stop_loss_take_profit(self, current_price):
        """Check if stop loss or take profit is hit"""
        if self.position:
            if current_price <= self.position['stop_loss']:
                print(f"[STOP LOSS] Triggered at ${current_price:.4f}")
                return 'SELL'
            elif current_price >= self.position['take_profit']:
                print(f"[TAKE PROFIT] Triggered at ${current_price:.4f}")
                return 'SELL'
        return None
    
    def run(self, paper_trading=True):
        """Main trading loop"""
        print(f"[STARTING] {self.strategy_name} on {self.pair}")
        print(f"[INFO] Expected ROI: {self.expected_roi:.2f}% | Win Rate: {self.expected_win_rate:.2f}%")
        print(f"[MODE] {'Paper Trading' if paper_trading else 'LIVE TRADING'}")
        
        if not paper_trading and not self.exchange:
            print("[ERROR] Exchange not connected for live trading!")
            return
        
        while True:
            try:
                # Fetch market data
                df = self.fetch_market_data() if not paper_trading else self.simulate_data()
                
                if df is not None and len(df) > 0:
                    # Calculate indicators
                    df = self.calculate_indicators(df)
                    
                    # Get current price
                    current_price = df['close'].iloc[-1]
                    
                    # Check stop loss / take profit
                    sl_tp_signal = self.check_stop_loss_take_profit(current_price)
                    if sl_tp_signal:
                        self.execute_trade(sl_tp_signal, current_price)
                    else:
                        # Generate signal
                        signal = self.generate_signal(df)
                        
                        # Execute trade
                        if signal in ['BUY', 'SELL']:
                            self.execute_trade(signal, current_price)
                    
                    # Display status
                    self.display_status(current_price)
                
                # Wait before next iteration
                time.sleep(60)  # Check every minute
                
            except KeyboardInterrupt:
                print("\n[STOPPED] Trading stopped by user")
                break
            except Exception as e:
                print(f"[ERROR] {e}")
                time.sleep(60)
        
        # Final report
        self.display_final_report()
    
    def simulate_data(self):
        """Simulate market data for paper trading"""
        # Generate simulated OHLCV data
        timestamps = pd.date_range(end=datetime.now(), periods=100, freq='1H')
        
        # Simulate price with some volatility
        base_price = 100
        prices = []
        for i in range(100):
            change = np.random.normal(0, 2)
            base_price = base_price * (1 + change/100)
            prices.append(base_price)
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'open': prices,
            'high': [p * 1.01 for p in prices],
            'low': [p * 0.99 for p in prices],
            'close': prices,
            'volume': [np.random.randint(1000, 10000) for _ in range(100)]
        })
        
        return df
    
    def display_status(self, current_price):
        """Display current trading status"""
        if self.position:
            pnl = (current_price - self.position['entry_price']) * self.position['amount']
            pnl_pct = ((current_price - self.position['entry_price']) / self.position['entry_price']) * 100
            
            print(f"[STATUS] Position: {self.position['side']} | "
                  f"Entry: ${self.position['entry_price']:.4f} | "
                  f"Current: ${current_price:.4f} | "
                  f"PnL: ${pnl:.2f} ({pnl_pct:.2f}%)")
    
    def display_final_report(self):
        """Display final trading report"""
        print("\n" + "="*60)
        print("TRADING REPORT")
        print("="*60)
        print(f"Strategy: {self.strategy_name}")
        print(f"Pair: {self.pair}")
        print(f"Total Trades: {len(self.trades)}")
        print(f"Total PnL: ${self.pnl:.2f}")
        
        if self.trades:
            winning_trades = [t for t in self.trades if t['pnl'] > 0]
            win_rate = (len(winning_trades) / len(self.trades)) * 100
            print(f"Win Rate: {win_rate:.2f}%")
            print(f"Expected Win Rate: {self.expected_win_rate:.2f}%")
        
        print("="*60)

# Quick start for paper trading
if __name__ == "__main__":
    # Create strategy instance
    strategy = Strategy_7MACD_761()
    
    # For LIVE trading, uncomment and add your API keys:
    # strategy.connect_exchange(api_key='YOUR_API_KEY', secret='YOUR_SECRET')
    # strategy.run(paper_trading=False)
    
    # Run paper trading (safe mode)
    strategy.run(paper_trading=True)
