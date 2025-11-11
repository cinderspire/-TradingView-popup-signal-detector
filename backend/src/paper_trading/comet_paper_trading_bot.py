#!/usr/bin/env python3
"""
🚀 COMET STRATEGIES PAPER TRADING BOT
Real-time paper trading with 8 advanced strategies on selected crypto pairs
BTC, XRP, ETH, SOL, PAXG, PEPE, DOGE - CCXT API-less (public data only)
"""

import ccxt
import pandas as pd
import numpy as np
import time
import datetime as dt
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import threading
from dataclasses import dataclass
from typing import Dict, List, Optional
import warnings

warnings.filterwarnings("ignore")

@dataclass
class Position:
    """Paper trading position"""
    symbol: str
    strategy: str
    side: str  # 'long' or 'short'
    size: float
    entry_price: float
    entry_time: datetime
    current_price: float = 0.0
    unrealized_pnl: float = 0.0
    
    def update_pnl(self, current_price: float):
        """Update unrealized P&L"""
        self.current_price = current_price
        if self.side == 'long':
            self.unrealized_pnl = (current_price - self.entry_price) * self.size
        else:  # short
            self.unrealized_pnl = (self.entry_price - current_price) * self.size

@dataclass
class Trade:
    """Completed trade record"""
    symbol: str
    strategy: str
    side: str
    size: float
    entry_price: float
    exit_price: float
    entry_time: datetime
    exit_time: datetime
    pnl: float
    pnl_pct: float

class CometPaperTradingBot:
    """Paper Trading Bot with 8 Comet Strategies"""
    
    def __init__(self, initial_capital=10000, position_size=100):
        self.initial_capital = initial_capital
        self.position_size = position_size  # Fixed position size per trade
        self.current_capital = initial_capital
        
        # Target symbols (BTC, XRP, ETH, SOL, PAXG, PEPE, DOGE)
        self.symbols = ['BTC/USDT', 'XRP/USDT', 'ETH/USDT', 'SOL/USDT', 
                       'PAXG/USDT', 'PEPE/USDT', 'DOGE/USDT']
        
        # Strategy names
        self.strategies = [
            'unmitigated_levels', 'linear_mean_rev', 'nas100_smart',
            'alligator', 'supertrend', 'fvg_sweep', 'zigzag', 'candle_channel'
        ]
        
        # Trading state
        self.positions: Dict[str, Position] = {}  # key: f"{symbol}_{strategy}"
        self.trades: List[Trade] = []
        self.historical_data = {}
        self.last_signals = {}
        
        # CCXT exchange (API-less, public data only)
        self.exchange = ccxt.binance({'enableRateLimit': True})
        self.exchange.load_markets()
        
        # Data storage
        self.data_dir = Path("paper_trading_data")
        self.data_dir.mkdir(exist_ok=True)
        
        # Performance tracking
        self.equity_curve = []
        self.start_time = datetime.now()
        
        print("🚀 COMET STRATEGIES PAPER TRADING BOT INITIALIZED")
        print(f"💰 Initial Capital: ${initial_capital:,}")
        print(f"📏 Position Size: ${position_size} per trade")
        print(f"🎯 Target Symbols: {', '.join(self.symbols)}")
        print(f"⚡ Active Strategies: {len(self.strategies)}")

    def fetch_ohlcv(self, symbol, timeframe='1h', limit=200):
        """Fetch OHLCV data for a symbol"""
        try:
            ohlcv = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('datetime', inplace=True)
            return df
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
            return pd.DataFrame()

    def update_market_data(self):
        """Update market data for all symbols"""
        print("📊 Updating market data...")
        for symbol in self.symbols:
            # 1-hour data
            df_1h = self.fetch_ohlcv(symbol, '1h', 500)
            df_15m = self.fetch_ohlcv(symbol, '15m', 500)
            
            if not df_1h.empty:
                self.historical_data[f"{symbol}_1h"] = df_1h
                self.historical_data[f"{symbol}_15m"] = df_15m
            
            time.sleep(0.5)  # Rate limiting

    # Technical Indicators (same as original)
    def sma(self, series, n):
        return series.rolling(n, min_periods=n).mean()
    
    def ema(self, series, n):
        return series.ewm(span=n, adjust=False).mean()
    
    def smma(self, series, n):
        return series.ewm(alpha=1.0 / n, adjust=False).mean()
    
    def atr(self, df, n=14):
        h, l, c = df['high'], df['low'], df['close']
        prev_c = c.shift(1)
        tr = pd.concat([(h - l), (h - prev_c).abs(), (l - prev_c).abs()], axis=1).max(axis=1)
        return tr.rolling(n, min_periods=n).mean()
    
    def vwap(self, df):
        tp = (df['high'] + df['low'] + df['close']) / 3.0
        cum_v = df['volume'].cumsum()
        cum_pv = (tp * df['volume']).cumsum()
        return (cum_pv / cum_v).ffill()

    def supertrend(self, df, period=10, multiplier=3.0):
        """SuperTrend indicator"""
        _atr = self.atr(df, period)
        hl2 = (df['high'] + df['low']) / 2
        upperband = hl2 + multiplier * _atr
        lowerband = hl2 - multiplier * _atr
        
        st = pd.Series(index=df.index, dtype=float)
        st.iloc[0] = lowerband.iloc[0]
        
        for i in range(1, len(df)):
            if df['close'].iloc[i] > st.iloc[i-1]:
                st.iloc[i] = lowerband.iloc[i]
            else:
                st.iloc[i] = upperband.iloc[i]
        
        return st

    # Strategy Implementations (adapted for real-time)
    def strategy_unmitigated_levels(self, symbol):
        """Unmitigated Levels Accumulation Strategy"""
        df_1h = self.historical_data.get(f"{symbol}_1h")
        if df_1h is None or len(df_1h) < 100:
            return None, None
        
        try:
            # Create daily/weekly/monthly data from hourly
            df_1d = df_1h.resample('1D').agg({'open':'first','high':'max','low':'min','close':'last','volume':'sum'})
            df_1w = df_1h.resample('1W').agg({'open':'first','high':'max','low':'min','close':'last','volume':'sum'})
            df_1m = df_1h.resample('1M').agg({'open':'first','high':'max','low':'min','close':'last','volume':'sum'})
            
            # Previous lows
            pdl1 = df_1d['low'].shift(1).reindex(df_1h.index, method='ffill')
            pwl1 = df_1w['low'].shift(1).reindex(df_1h.index, method='ffill') 
            pml1 = df_1m['low'].shift(1).reindex(df_1h.index, method='ffill')
            
            # London session (8:00-16:00 UTC)
            hour_utc = df_1h.index.hour
            london_session = (hour_utc >= 8) & (hour_utc < 16)
            
            # Entry conditions
            current_low = df_1h['low'].iloc[-1]
            entries = london_session & (
                (current_low <= pdl1 * 1.05) |  # 5% tolerance
                (current_low <= pwl1 * 1.05) |
                (current_low <= pml1 * 1.05)
            )
            
            # Exit: All-time high reached
            running_ath = df_1h['high'].cummax()
            exits = df_1h['high'].iloc[-1] >= running_ath.iloc[-1]
            
            return entries.iloc[-1], exits
            
        except Exception as e:
            print(f"Error in unmitigated_levels for {symbol}: {e}")
            return None, None

    def strategy_linear_mean_rev(self, symbol):
        """Linear Mean Reversion Strategy"""
        df_1h = self.historical_data.get(f"{symbol}_1h")
        if df_1h is None or len(df_1h) < 50:
            return None, None, None, None
            
        try:
            price = df_1h['close']
            mean = self.sma(price, 14)
            std = price.rolling(14).std()
            zscore = (price - mean) / std
            
            long_entry = zscore.iloc[-1] < -2.0
            short_entry = zscore.iloc[-1] > 2.0
            long_exit = zscore.iloc[-1] > -0.2
            short_exit = zscore.iloc[-1] < 0.2
            
            return long_entry, short_entry, long_exit, short_exit
            
        except Exception as e:
            print(f"Error in linear_mean_rev for {symbol}: {e}")
            return None, None, None, None

    def strategy_nas100_smart(self, symbol):
        """NAS100 Smart Scalping Strategy"""
        df_1h = self.historical_data.get(f"{symbol}_1h")
        df_15m = self.historical_data.get(f"{symbol}_15m")
        if df_1h is None or df_15m is None or len(df_1h) < 50:
            return None, None, None, None
            
        try:
            # Indicators
            ema9 = self.ema(df_1h['close'], 9)
            vwap_val = self.vwap(df_1h)
            
            # RSI approximation
            delta = df_1h['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            
            atr_val = self.atr(df_1h, 14)
            body_strength = abs(df_1h['close'] - df_1h['open']) > (atr_val * 0.3)
            
            # Volume spike
            avg_vol = df_1h['volume'].rolling(20).mean()
            volume_spike = df_1h['volume'] > (avg_vol * 1.5)
            
            # Current conditions
            current = df_1h.iloc[-1]
            bullish_setup = (current['close'] > current['open'] and
                           current['close'] > ema9.iloc[-1] and
                           current['close'] > vwap_val.iloc[-1] and
                           rsi.iloc[-1] > 50 and
                           body_strength.iloc[-1] and
                           volume_spike.iloc[-1])
            
            bearish_setup = (current['close'] < current['open'] and
                           current['close'] < ema9.iloc[-1] and
                           current['close'] < vwap_val.iloc[-1] and
                           rsi.iloc[-1] < 50 and
                           body_strength.iloc[-1] and
                           volume_spike.iloc[-1])
            
            return bullish_setup, bearish_setup, bearish_setup, bullish_setup
            
        except Exception as e:
            print(f"Error in nas100_smart for {symbol}: {e}")
            return None, None, None, None

    def strategy_alligator(self, symbol):
        """Williams Alligator Strategy"""
        df_1h = self.historical_data.get(f"{symbol}_1h")
        if df_1h is None or len(df_1h) < 50:
            return None, None
            
        try:
            hl2 = (df_1h['high'] + df_1h['low']) / 2
            jaw = self.smma(hl2, 13)
            lips = self.smma(hl2, 5)
            
            # Crossover signals
            long_entry = lips.iloc[-1] > jaw.iloc[-1] and lips.iloc[-2] <= jaw.iloc[-2]
            exit_signal = lips.iloc[-1] < jaw.iloc[-1] and lips.iloc[-2] >= jaw.iloc[-2]
            
            return long_entry, exit_signal
            
        except Exception as e:
            print(f"Error in alligator for {symbol}: {e}")
            return None, None

    def strategy_supertrend(self, symbol):
        """SuperTrend Strategy"""
        df_1h = self.historical_data.get(f"{symbol}_1h")
        if df_1h is None or len(df_1h) < 100:
            return None, None, None, None
            
        try:
            st = self.supertrend(df_1h, period=92, multiplier=4.6)
            
            # Direction changes
            long_signal = df_1h['close'].iloc[-1] > st.iloc[-1] and df_1h['close'].iloc[-2] <= st.iloc[-2]
            short_signal = df_1h['close'].iloc[-1] < st.iloc[-1] and df_1h['close'].iloc[-2] >= st.iloc[-2]
            
            return long_signal, short_signal, short_signal, long_signal
            
        except Exception as e:
            print(f"Error in supertrend for {symbol}: {e}")
            return None, None, None, None

    def strategy_zigzag(self, symbol):
        """ZigZag Pivot Strategy"""
        df_1h = self.historical_data.get(f"{symbol}_1h")
        if df_1h is None or len(df_1h) < 50:
            return None, None, None, None
            
        try:
            # Simple pivot detection
            depth = 12
            highs = df_1h['high']
            lows = df_1h['low']
            
            # Check if current bar is a pivot
            if len(df_1h) < depth * 2 + 1:
                return False, False, False, False
            
            # Pivot low (buy signal)
            center_low = lows.iloc[-depth-1]
            is_pivot_low = all(center_low < lows.iloc[i] for i in range(-depth*2-1, -depth)) and \
                          all(center_low < lows.iloc[i] for i in range(-depth, 0))
            
            # Pivot high (sell signal)  
            center_high = highs.iloc[-depth-1]
            is_pivot_high = all(center_high > highs.iloc[i] for i in range(-depth*2-1, -depth)) and \
                           all(center_high > highs.iloc[i] for i in range(-depth, 0))
            
            return is_pivot_low, is_pivot_high, is_pivot_high, is_pivot_low
            
        except Exception as e:
            print(f"Error in zigzag for {symbol}: {e}")
            return None, None, None, None

    def strategy_candle_channel(self, symbol):
        """Candle Channel Strategy"""
        df_1h = self.historical_data.get(f"{symbol}_1h")
        if df_1h is None or len(df_1h) < 50:
            return None, None, None, None
            
        try:
            candle_mid = (df_1h['high'] + df_1h['low']) / 2
            mid_sma = self.sma(candle_mid, 20)
            avg_range = self.sma(df_1h['high'] - df_1h['low'], 20)
            offset = avg_range * 2.0  # 200% scale
            
            upper = mid_sma + offset
            lower = mid_sma - offset
            
            # Current conditions
            current = df_1h.iloc[-1]
            prev = df_1h.iloc[-2]
            
            # Reversal signals
            upper_reversal = (prev['close'] > upper.iloc[-2] and 
                            current['close'] < upper.iloc[-1] and
                            current['close'] < current['open'])
            
            lower_reversal = (prev['close'] < lower.iloc[-2] and 
                            current['close'] > lower.iloc[-1] and
                            current['close'] > current['open'])
            
            # SMA crossovers
            sma_cross_up = (prev['close'] <= mid_sma.iloc[-2] and 
                           current['close'] > mid_sma.iloc[-1])
            sma_cross_down = (prev['close'] >= mid_sma.iloc[-2] and 
                             current['close'] < mid_sma.iloc[-1])
            
            long_entry = lower_reversal or sma_cross_up
            short_entry = upper_reversal or sma_cross_down
            
            return long_entry, short_entry, short_entry, long_entry
            
        except Exception as e:
            print(f"Error in candle_channel for {symbol}: {e}")
            return None, None, None, None

    def strategy_fvg_sweep(self, symbol):
        """FVG Sweep Strategy"""
        df_1h = self.historical_data.get(f"{symbol}_1h")
        df_15m = self.historical_data.get(f"{symbol}_15m")
        if df_1h is None or df_15m is None or len(df_1h) < 50:
            return None, None
            
        try:
            # Simple fractal sweep detection
            lows = df_1h['low']
            
            # Fractal low sweep
            prev_low = lows.rolling(5).min().shift(1)
            sweep = df_1h['low'].iloc[-1] < prev_low.iloc[-1]
            
            # Simple FVG detection on 15m
            m15_h = df_15m['high']
            m15_l = df_15m['low']
            
            # Bullish FVG: gap between bars
            bull_fvg = (m15_l.iloc[-1] > m15_h.iloc[-3]) if len(df_15m) >= 3 else False
            
            entry = sweep and bull_fvg
            exit = False  # Simple exit after entry
            
            return entry, exit
            
        except Exception as e:
            print(f"Error in fvg_sweep for {symbol}: {e}")
            return None, None

    def run_strategy(self, symbol, strategy_name):
        """Run a specific strategy on a symbol"""
        try:
            if strategy_name == 'unmitigated_levels':
                long_entry, exit_signal = self.strategy_unmitigated_levels(symbol)
                return long_entry, False, exit_signal, False  # Long only
                
            elif strategy_name == 'linear_mean_rev':
                return self.strategy_linear_mean_rev(symbol)
                
            elif strategy_name == 'nas100_smart':
                return self.strategy_nas100_smart(symbol)
                
            elif strategy_name == 'alligator':
                long_entry, exit_signal = self.strategy_alligator(symbol)
                return long_entry, False, exit_signal, False  # Long only
                
            elif strategy_name == 'supertrend':
                return self.strategy_supertrend(symbol)
                
            elif strategy_name == 'zigzag':
                return self.strategy_zigzag(symbol)
                
            elif strategy_name == 'candle_channel':
                return self.strategy_candle_channel(symbol)
                
            elif strategy_name == 'fvg_sweep':
                long_entry, exit_signal = self.strategy_fvg_sweep(symbol)
                return long_entry, False, exit_signal, False  # Long only
                
            return None, None, None, None
            
        except Exception as e:
            print(f"Error running {strategy_name} on {symbol}: {e}")
            return None, None, None, None

    def execute_trade(self, symbol, strategy, side, current_price):
        """Execute a paper trade"""
        position_key = f"{symbol}_{strategy}"
        
        # Check if already in position
        if position_key in self.positions:
            return
        
        # Calculate position size
        shares = self.position_size / current_price
        
        # Create position
        position = Position(
            symbol=symbol,
            strategy=strategy,
            side=side,
            size=shares,
            entry_price=current_price,
            entry_time=datetime.now()
        )
        
        self.positions[position_key] = position
        print(f"📈 OPEN {side.upper()}: {symbol} {strategy} @ ${current_price:.6f} (Size: {shares:.6f})")

    def close_position(self, position_key, current_price, reason="Signal"):
        """Close a position"""
        if position_key not in self.positions:
            return
            
        position = self.positions[position_key]
        
        # Calculate P&L
        if position.side == 'long':
            pnl = (current_price - position.entry_price) * position.size
        else:
            pnl = (position.entry_price - current_price) * position.size
        
        pnl_pct = (pnl / self.position_size) * 100
        
        # Create trade record
        trade = Trade(
            symbol=position.symbol,
            strategy=position.strategy,
            side=position.side,
            size=position.size,
            entry_price=position.entry_price,
            exit_price=current_price,
            entry_time=position.entry_time,
            exit_time=datetime.now(),
            pnl=pnl,
            pnl_pct=pnl_pct
        )
        
        self.trades.append(trade)
        self.current_capital += pnl
        
        print(f"📉 CLOSE {position.side.upper()}: {position.symbol} {position.strategy} @ ${current_price:.6f} "
              f"P&L: ${pnl:.2f} ({pnl_pct:.2f}%) - {reason}")
        
        del self.positions[position_key]

    def update_positions(self):
        """Update all open positions with current prices"""
        for position_key, position in self.positions.items():
            symbol = position.symbol
            df_1h = self.historical_data.get(f"{symbol}_1h")
            if df_1h is not None and not df_1h.empty:
                current_price = df_1h['close'].iloc[-1]
                position.update_pnl(current_price)

    def process_signals(self):
        """Process trading signals for all symbol-strategy combinations"""
        for symbol in self.symbols:
            df_1h = self.historical_data.get(f"{symbol}_1h")
            if df_1h is None or df_1h.empty:
                continue
                
            current_price = df_1h['close'].iloc[-1]
            
            for strategy in self.strategies:
                position_key = f"{symbol}_{strategy}"
                
                # Get signals
                signals = self.run_strategy(symbol, strategy)
                if signals is None or len(signals) != 4:
                    continue
                    
                long_entry, short_entry, long_exit, short_exit = signals
                
                # Process signals
                if position_key in self.positions:
                    # Already in position - check for exit
                    position = self.positions[position_key]
                    
                    if position.side == 'long' and long_exit:
                        self.close_position(position_key, current_price, "Long Exit Signal")
                    elif position.side == 'short' and short_exit:
                        self.close_position(position_key, current_price, "Short Exit Signal")
                        
                else:
                    # No position - check for entry
                    if long_entry and self.current_capital >= self.position_size:
                        self.execute_trade(symbol, strategy, 'long', current_price)
                    elif short_entry and self.current_capital >= self.position_size:
                        self.execute_trade(symbol, strategy, 'short', current_price)

    def display_status(self):
        """Display current trading status"""
        print("\n" + "="*80)
        print("🚀 COMET STRATEGIES PAPER TRADING STATUS")
        print("="*80)
        
        # Account summary
        total_unrealized = sum(pos.unrealized_pnl for pos in self.positions.values())
        total_equity = self.current_capital + total_unrealized
        total_return = ((total_equity - self.initial_capital) / self.initial_capital) * 100
        
        print(f"💰 Account Equity: ${total_equity:,.2f}")
        print(f"💵 Available Cash: ${self.current_capital:,.2f}")
        print(f"📈 Total Return: {total_return:+.2f}%")
        print(f"📊 Open Positions: {len(self.positions)}")
        print(f"🎯 Completed Trades: {len(self.trades)}")
        
        # Open positions
        if self.positions:
            print(f"\n📋 OPEN POSITIONS:")
            for key, pos in self.positions.items():
                print(f"  {key}: {pos.side.upper()} ${pos.current_price:.6f} "
                      f"P&L: ${pos.unrealized_pnl:+.2f}")
        
        # Recent trades
        if self.trades:
            print(f"\n📊 LAST 5 TRADES:")
            for trade in self.trades[-5:]:
                print(f"  {trade.symbol} {trade.strategy} {trade.side.upper()}: "
                      f"${trade.pnl:+.2f} ({trade.pnl_pct:+.2f}%)")
        
        print("="*80)

    def save_state(self):
        """Save trading state to file"""
        state = {
            'current_capital': self.current_capital,
            'trades': [
                {
                    'symbol': t.symbol,
                    'strategy': t.strategy,
                    'side': t.side,
                    'size': t.size,
                    'entry_price': t.entry_price,
                    'exit_price': t.exit_price,
                    'entry_time': t.entry_time.isoformat(),
                    'exit_time': t.exit_time.isoformat(),
                    'pnl': t.pnl,
                    'pnl_pct': t.pnl_pct
                }
                for t in self.trades
            ],
            'start_time': self.start_time.isoformat()
        }
        
        with open(self.data_dir / 'trading_state.json', 'w') as f:
            json.dump(state, f, indent=2)

    def run_forever(self, update_interval=300):  # 5 minutes
        """Run the paper trading bot continuously"""
        print(f"\n🚀 Starting paper trading bot...")
        print(f"⏰ Update interval: {update_interval} seconds")
        print("Press Ctrl+C to stop\n")
        
        try:
            while True:
                print(f"\n⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Processing...")
                
                # Update market data
                self.update_market_data()
                
                # Update position P&L
                self.update_positions()
                
                # Process trading signals
                self.process_signals()
                
                # Display status
                self.display_status()
                
                # Save state
                self.save_state()
                
                # Wait for next update
                print(f"⏳ Sleeping for {update_interval} seconds...")
                time.sleep(update_interval)
                
        except KeyboardInterrupt:
            print("\n🛑 Bot stopped by user")
            self.display_status()
            self.save_state()
            print("💾 Final state saved")

if __name__ == "__main__":
    # Initialize and run the paper trading bot
    bot = CometPaperTradingBot(
        initial_capital=10000,  # $10k starting capital
        position_size=100       # $100 per position
    )
    
    # Run forever (updates every 5 minutes)
    bot.run_forever(update_interval=300)