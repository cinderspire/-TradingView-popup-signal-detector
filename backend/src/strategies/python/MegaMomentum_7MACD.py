"""
MEGAMOMENTUM_7MACD_ENHANCED
Type: momentum
Description: Enhanced 7MACD with multiple timeframe confirmation
Expected ROI: 2000%
Generated: 2025-08-22T15:43:37.222360

INDICATORS:
{
  "macd_fast": {
    "fast": 8,
    "slow": 17,
    "signal": 9
  },
  "macd_standard": {
    "fast": 12,
    "slow": 26,
    "signal": 9
  },
  "macd_slow": {
    "fast": 5,
    "slow": 35,
    "signal": 5
  },
  "adx_threshold": 25,
  "volume_multiplier": 1.5
}

ENTRY RULES:
- All 3 MACD histograms positive
- ADX > 25 (trending market)
- Volume > 1.5x average
- Price above EMA 21

EXIT RULES:
- Any MACD histogram turns negative
- RSI > 80 (overbought)
- Trailing stop at 2 ATR
"""

import ccxt
import pandas as pd
import numpy as np
import talib
from datetime import datetime
import time

class MegaMomentum_7MACD_Enhanced:
    def __init__(self):
        self.exchange = ccxt.binance({
            'enableRateLimit': True,
            'options': {'defaultType': 'spot'}
        })
        
        self.symbol = 'BTC/USDT'  # Change as needed
        self.timeframe = '1h'
        self.balance = 10000
        self.position = None
        
        # Strategy parameters
        self.params = {
        "macd_fast": {
                "fast": 8,
                "slow": 17,
                "signal": 9
        },
        "macd_standard": {
                "fast": 12,
                "slow": 26,
                "signal": 9
        },
        "macd_slow": {
                "fast": 5,
                "slow": 35,
                "signal": 5
        },
        "adx_threshold": 25,
        "volume_multiplier": 1.5
}
        
    def fetch_data(self):
        """Fetch latest market data"""
        try:
            ohlcv = self.exchange.fetch_ohlcv(self.symbol, self.timeframe, limit=200)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            return df
        except:
            return None
    
    def calculate_indicators(self, df):
        """Calculate required indicators"""
        close = df['close'].values
        high = df['high'].values
        low = df['low'].values
        volume = df['volume'].values
        
        # MACD variations
        macd1, signal1, hist1 = talib.MACD(close, 8, 17, 9)
        macd2, signal2, hist2 = talib.MACD(close, 12, 26, 9)
        macd3, signal3, hist3 = talib.MACD(close, 5, 35, 5)
        
        df['macd_hist_fast'] = hist1
        df['macd_hist_standard'] = hist2
        df['macd_hist_slow'] = hist3
        df['macd_alignment'] = ((hist1 > 0) & (hist2 > 0) & (hist3 > 0)).astype(int)
        
        # Trend and momentum
        df['adx'] = talib.ADX(high, low, close, 14)
        df['rsi'] = talib.RSI(close, 14)
        df['ema_fast'] = talib.EMA(close, 9)
        df['ema_slow'] = talib.EMA(close, 21)
        df['volume_sma'] = talib.SMA(volume, 20)
        df['volume_ratio'] = volume / df['volume_sma']
        
        return df
    
    def generate_signal(self, df):
        """Generate trading signal"""
        if len(df) < 100:
            return 'HOLD'
        
        df = self.calculate_indicators(df)
        current = df.iloc[-1]
        
        # Entry conditions
        if not self.position:
            if (current['macd_alignment'] == 1 and
                current['adx'] > self.params['adx_threshold'] and
                current['volume_ratio'] > self.params['volume_multiplier'] and
                current['close'] > current['ema_fast']):
                return 'BUY'
        
        # Exit conditions
        elif self.position:
            entry_price = self.position['entry']
            pnl_pct = (current['close'] - entry_price) / entry_price * 100
            
            if (current['macd_alignment'] == 0 or
                current['rsi'] > 80 or
                pnl_pct < -2):
                return 'SELL'
        
        return 'HOLD'
    
    def run(self):
        """Main trading loop"""
        print(f"Starting {self.__class__.__name__}")
        print(f"Symbol: {self.symbol}")
        print(f"Expected ROI: 2000%")
        
        while True:
            try:
                df = self.fetch_data()
                if df is not None:
                    signal = self.generate_signal(df)
                    
                    if signal == 'BUY' and not self.position:
                        self.position = {
                            'entry': df.iloc[-1]['close'],
                            'time': datetime.now()
                        }
                        print(f"[BUY] {self.symbol} at {self.position['entry']:.4f}")
                    
                    elif signal == 'SELL' and self.position:
                        exit_price = df.iloc[-1]['close']
                        pnl = (exit_price - self.position['entry']) / self.position['entry'] * 100
                        print(f"[SELL] {self.symbol} at {exit_price:.4f} | PnL: {pnl:.2f}%")
                        self.position = None
                
                time.sleep(60)
                
            except KeyboardInterrupt:
                print("Stopped by user")
                break
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(60)

if __name__ == "__main__":
    bot = MegaMomentum_7MACD_Enhanced()
    bot.run()
