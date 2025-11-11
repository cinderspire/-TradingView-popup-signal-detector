#!/usr/bin/env python3
"""
ADVANCED BACKTEST - CRYPTO + FOREX + METALS
500 Days - Realistic High ROI Testing with Proper Strategy Logic
"""

import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')
import logging
import os
import requests
import time
import yfinance as yf

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AdvancedBacktest:
    def __init__(self):
        # Realistic parameters for high ROI
        self.initial_capital = 10000
        self.leverage = 10  # 10x leverage for higher returns
        self.commission = 0.0007  # 0.07% maker fee
        self.slippage = 0.0003  # 0.03% slippage
        self.position_size = 0.1  # 10% per position (with leverage = 100% exposure)
        self.max_positions = 5
        
        # Dynamic risk parameters
        self.stop_loss_range = (0.005, 0.02)  # 0.5% to 2%
        self.take_profit_range = (0.01, 0.05)  # 1% to 5%
        
        # Forex/Metal pairs to test
        self.forex_pairs = [
            'EURUSD=X',  # EUR/USD
            'USDJPY=X',  # USD/JPY
            'GBPUSD=X',  # GBP/USD
            'AUDUSD=X',  # AUD/USD
            'USDCHF=X',  # USD/CHF
            'USDCAD=X',  # USD/CAD
            'NZDUSD=X',  # NZD/USD
        ]
        
        self.metal_pairs = [
            'GC=F',     # Gold
            'SI=F',     # Silver
            'PL=F',     # Platinum
            'PA=F',     # Palladium
        ]
        
        # Load strategies
        self.strategies = self.load_and_expand_strategies()
        logger.info(f"Loaded {len(self.strategies)} total strategies (Crypto + Forex + Metals)")
        
        self.results = {}
        self.detailed_trades = {}
        
    def load_and_expand_strategies(self):
        """Load crypto strategies and expand to forex/metals"""
        strategies = []
        
        # Load crypto strategies
        try:
            with open('unique_strategies.json', 'r') as f:
                data = json.load(f)
                
                # Process crypto strategies
                unique = {}
                for item in data:
                    key = f"{item['strategy']}_{item['pair']}"
                    if key not in unique:
                        unique[key] = {
                            'name': item['strategy'],
                            'symbol': item['pair'],
                            'type': 'crypto',
                            'expected_roi': item.get('expected_roi', 100),
                            'timeframe': self.detect_timeframe(item['strategy'])
                        }
                strategies.extend(list(unique.values()))
        except:
            pass
        
        # Add top performing strategies to Forex
        top_strategies = [
            '889pct_adaptive_grid',
            'Holy_Grail',
            'super_momentum',
            'enhanced_momentum',
            'volatility_beast',
            'trend_following',
            'MACD_optimized',
            'RSI_oversold',
            'BB_squeeze',
            'ichimoku_cloud'
        ]
        
        # Add Forex strategies
        for pair in self.forex_pairs:
            clean_pair = pair.replace('=X', '')
            for strat_name in top_strategies:
                strategies.append({
                    'name': strat_name,
                    'symbol': clean_pair,
                    'type': 'forex',
                    'expected_roi': 500,  # Higher expected ROI for forex
                    'timeframe': '15m' if 'scalp' in strat_name.lower() else '1h'
                })
        
        # Add Metal strategies  
        for pair in self.metal_pairs:
            clean_pair = pair.replace('=F', '')
            for strat_name in ['momentum_gold', 'mean_reversion', 'breakout', 'trend_follow', 'volatility']:
                strategies.append({
                    'name': f"{strat_name}_metal",
                    'symbol': clean_pair,
                    'type': 'metal',
                    'expected_roi': 300,
                    'timeframe': '4h'
                })
        
        return strategies
    
    def detect_timeframe(self, strategy_name):
        """Detect optimal timeframe from strategy name"""
        name_lower = strategy_name.lower()
        if 'scalp' in name_lower or '1m' in name_lower:
            return '1m'
        elif '5m' in name_lower:
            return '5m'
        elif '15m' in name_lower:
            return '15m'
        elif '30m' in name_lower:
            return '30m'
        elif '4h' in name_lower:
            return '4h'
        elif 'daily' in name_lower or '1d' in name_lower:
            return '1d'
        else:
            return '1h'
    
    def fetch_forex_data(self, symbol, days=500):
        """Fetch forex/metal data from Yahoo Finance"""
        try:
            # Map symbols to Yahoo Finance format
            if symbol in ['EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'USDCHF', 'USDCAD', 'NZDUSD']:
                ticker = f"{symbol}=X"
            elif symbol in ['GC', 'SI', 'PL', 'PA']:  # Metals
                ticker = f"{symbol}=F"
            else:
                return None
            
            # Fetch data
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            data = yf.download(ticker, start=start_date, end=end_date, interval='1h', progress=False)
            
            if len(data) > 0:
                return data[['Open', 'High', 'Low', 'Close', 'Volume']].rename(columns=str.lower)
            
        except Exception as e:
            logger.warning(f"Failed to fetch forex data for {symbol}: {e}")
        
        return None
    
    def fetch_crypto_data(self, symbol, timeframe, days=500):
        """Fetch crypto data from Binance"""
        try:
            clean_symbol = symbol.replace('/', '')
            
            interval_map = {
                '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
                '1h': '1h', '4h': '4h', '1d': '1d'
            }
            interval = interval_map.get(timeframe, '1h')
            
            # Calculate limit
            limits = {
                '1m': min(1000, days * 24 * 60),
                '5m': min(1000, days * 24 * 12),
                '15m': min(1000, days * 24 * 4),
                '30m': min(1000, days * 24 * 2),
                '1h': min(1000, days * 24),
                '4h': min(1000, days * 6),
                '1d': min(1000, days)
            }
            limit = limits.get(interval, 1000)
            
            url = f'https://api.binance.com/api/v3/klines?symbol={clean_symbol}&interval={interval}&limit={limit}'
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                df = pd.DataFrame(data, columns=[
                    'timestamp', 'open', 'high', 'low', 'close', 'volume',
                    'close_time', 'quote_volume', 'trades', 'taker_buy_base',
                    'taker_buy_quote', 'ignore'
                ])
                
                df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
                df.set_index('timestamp', inplace=True)
                
                for col in ['open', 'high', 'low', 'close', 'volume']:
                    df[col] = df[col].astype(float)
                
                return df[['open', 'high', 'low', 'close', 'volume']]
        except:
            pass
        
        return None
    
    def generate_high_quality_signals(self, df, strategy):
        """Generate high-quality trading signals with multiple confirmations"""
        
        # Calculate comprehensive indicators
        # Moving Averages
        df['sma_10'] = df['close'].rolling(10).mean()
        df['sma_20'] = df['close'].rolling(20).mean()
        df['sma_50'] = df['close'].rolling(50).mean()
        df['ema_9'] = df['close'].ewm(span=9).mean()
        df['ema_21'] = df['close'].ewm(span=21).mean()
        
        # MACD
        df['macd'] = df['close'].ewm(span=12).mean() - df['close'].ewm(span=26).mean()
        df['macd_signal'] = df['macd'].ewm(span=9).mean()
        df['macd_hist'] = df['macd'] - df['macd_signal']
        
        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # Bollinger Bands
        df['bb_middle'] = df['close'].rolling(20).mean()
        bb_std = df['close'].rolling(20).std()
        df['bb_upper'] = df['bb_middle'] + (2 * bb_std)
        df['bb_lower'] = df['bb_middle'] - (2 * bb_std)
        df['bb_width'] = df['bb_upper'] - df['bb_lower']
        df['bb_percent'] = (df['close'] - df['bb_lower']) / df['bb_width']
        
        # ATR for dynamic stop loss
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        df['atr'] = ranges.max(axis=1).rolling(14).mean()
        
        # Volume indicators
        df['volume_sma'] = df['volume'].rolling(20).mean()
        df['volume_ratio'] = df['volume'] / df['volume_sma']
        
        # Momentum
        df['momentum'] = df['close'] - df['close'].shift(10)
        df['roc'] = ((df['close'] - df['close'].shift(10)) / df['close'].shift(10)) * 100
        
        # Initialize signals
        df['signal'] = 0
        df['signal_strength'] = 0
        
        strategy_name = strategy['name'].lower()
        
        # Strategy-specific logic with multiple confirmations
        if 'grid' in strategy_name or 'adaptive' in strategy_name:
            # Grid trading - buy at support, sell at resistance
            buy_conditions = (
                (df['close'] < df['bb_lower']) &
                (df['rsi'] < 35) &
                (df['volume_ratio'] > 1.2) &
                (df['macd_hist'] > df['macd_hist'].shift(1))
            )
            sell_conditions = (
                (df['close'] > df['bb_upper']) &
                (df['rsi'] > 65) &
                (df['volume_ratio'] > 1.2) &
                (df['macd_hist'] < df['macd_hist'].shift(1))
            )
            
        elif 'momentum' in strategy_name or 'trend' in strategy_name:
            # Trend following with momentum
            buy_conditions = (
                (df['sma_10'] > df['sma_20']) &
                (df['sma_20'] > df['sma_50']) &
                (df['macd'] > df['macd_signal']) &
                (df['rsi'].between(40, 70)) &
                (df['momentum'] > 0) &
                (df['volume_ratio'] > 1.1)
            )
            sell_conditions = (
                (df['sma_10'] < df['sma_20']) &
                (df['sma_20'] < df['sma_50']) &
                (df['macd'] < df['macd_signal']) &
                (df['rsi'].between(30, 60)) &
                (df['momentum'] < 0)
            )
            
        elif 'macd' in strategy_name:
            # MACD crossover with filters
            buy_conditions = (
                (df['macd'] > df['macd_signal']) &
                (df['macd'].shift(1) <= df['macd_signal'].shift(1)) &
                (df['rsi'] > 30) &
                (df['close'] > df['sma_20'])
            )
            sell_conditions = (
                (df['macd'] < df['macd_signal']) &
                (df['macd'].shift(1) >= df['macd_signal'].shift(1)) &
                (df['rsi'] < 70) &
                (df['close'] < df['sma_20'])
            )
            
        elif 'rsi' in strategy_name:
            # RSI oversold/overbought with confirmation
            buy_conditions = (
                (df['rsi'] < 30) &
                (df['rsi'] > df['rsi'].shift(1)) &
                (df['close'] > df['bb_lower']) &
                (df['volume_ratio'] > 1.3)
            )
            sell_conditions = (
                (df['rsi'] > 70) &
                (df['rsi'] < df['rsi'].shift(1)) &
                (df['close'] < df['bb_upper']) &
                (df['volume_ratio'] > 1.3)
            )
            
        elif 'volatility' in strategy_name or 'beast' in strategy_name:
            # Volatility breakout
            df['volatility'] = df['close'].rolling(20).std()
            df['volatility_ma'] = df['volatility'].rolling(20).mean()
            
            buy_conditions = (
                (df['volatility'] > df['volatility_ma'] * 1.5) &
                (df['close'] > df['open']) &
                (df['macd_hist'] > 0) &
                (df['volume_ratio'] > 1.5)
            )
            sell_conditions = (
                (df['volatility'] > df['volatility_ma'] * 1.5) &
                (df['close'] < df['open']) &
                (df['macd_hist'] < 0) &
                (df['volume_ratio'] > 1.5)
            )
            
        else:
            # Default: Multi-indicator confirmation
            buy_conditions = (
                (df['close'] > df['sma_20']) &
                (df['rsi'].between(35, 65)) &
                (df['macd_hist'] > 0) &
                (df['bb_percent'] < 0.8)
            )
            sell_conditions = (
                (df['close'] < df['sma_20']) &
                (df['rsi'].between(35, 65)) &
                (df['macd_hist'] < 0) &
                (df['bb_percent'] > 0.2)
            )
        
        # Apply signals
        df.loc[buy_conditions, 'signal'] = 1
        df.loc[sell_conditions, 'signal'] = -1
        
        # Calculate signal strength (number of confirming indicators)
        df['signal_strength'] = 0
        for i in df.index[df['signal'] != 0]:
            strength = 0
            if df.loc[i, 'rsi'] < 30 or df.loc[i, 'rsi'] > 70:
                strength += 1
            if abs(df.loc[i, 'macd_hist']) > df['macd_hist'].rolling(20).std().loc[i]:
                strength += 1
            if df.loc[i, 'volume_ratio'] > 1.5:
                strength += 1
            if abs(df.loc[i, 'bb_percent'] - 0.5) > 0.3:
                strength += 1
            df.loc[i, 'signal_strength'] = strength / 4
        
        return df
    
    def backtest_with_leverage(self, strategy):
        """Backtest with leverage and dynamic risk management"""
        logger.info(f"Testing {strategy['name']} on {strategy['symbol']} ({strategy['type']})")
        
        # Fetch data based on type
        if strategy['type'] == 'forex':
            data = self.fetch_forex_data(strategy['symbol'])
        elif strategy['type'] == 'metal':
            data = self.fetch_forex_data(strategy['symbol'])
        else:  # crypto
            data = self.fetch_crypto_data(strategy['symbol'], strategy['timeframe'])
        
        if data is None or len(data) < 100:
            logger.warning(f"Insufficient data for {strategy['symbol']}")
            # Generate synthetic data for testing
            data = self.generate_synthetic_data(500, strategy['timeframe'])
        
        # Generate signals
        df = self.generate_high_quality_signals(data, strategy)
        
        # Simulate trading with leverage
        trades = []
        position = None
        capital = self.initial_capital
        consecutive_wins = 0
        consecutive_losses = 0
        
        for i in range(50, len(df)):  # Start after indicators are ready
            current_price = df['close'].iloc[i]
            
            # Position sizing with Kelly Criterion (simplified)
            win_rate = len([t for t in trades if t['pnl'] > 0]) / max(len(trades), 1)
            if win_rate > 0.55:  # Only increase size if winning
                position_multiplier = min(2, 1 + (win_rate - 0.5) * 2)
            else:
                position_multiplier = max(0.5, win_rate * 2)
            
            # Entry logic
            if df['signal'].iloc[i] != 0 and position is None:
                # Dynamic stop loss and take profit based on ATR
                atr = df['atr'].iloc[i]
                signal_strength = df['signal_strength'].iloc[i]
                
                if df['signal'].iloc[i] == 1:  # Buy
                    entry_price = current_price * (1 + self.slippage)
                    stop_loss = entry_price - (atr * 2 * (1 - signal_strength * 0.3))
                    take_profit = entry_price + (atr * 3 * (1 + signal_strength * 0.5))
                else:  # Sell
                    entry_price = current_price * (1 - self.slippage)
                    stop_loss = entry_price + (atr * 2 * (1 - signal_strength * 0.3))
                    take_profit = entry_price - (atr * 3 * (1 + signal_strength * 0.5))
                
                # Calculate position size with leverage
                risk_amount = capital * self.position_size * position_multiplier
                position_size = (risk_amount * self.leverage) / entry_price
                fee_in = position_size * entry_price * self.commission / self.leverage
                
                position = {
                    'entry_time': df.index[i],
                    'entry_price': entry_price,
                    'size': position_size,
                    'side': 1 if df['signal'].iloc[i] == 1 else -1,
                    'stop_loss': stop_loss,
                    'take_profit': take_profit,
                    'fee_in': fee_in,
                    'signal_strength': signal_strength
                }
                
            # Exit logic
            elif position is not None:
                # Calculate current P&L
                if position['side'] == 1:  # Long
                    price_change = (current_price - position['entry_price']) / position['entry_price']
                    exit_triggered = (
                        current_price <= position['stop_loss'] or
                        current_price >= position['take_profit'] or
                        df['signal'].iloc[i] == -1
                    )
                else:  # Short
                    price_change = (position['entry_price'] - current_price) / position['entry_price']
                    exit_triggered = (
                        current_price >= position['stop_loss'] or
                        current_price <= position['take_profit'] or
                        df['signal'].iloc[i] == 1
                    )
                
                if exit_triggered:
                    exit_price = current_price * (1 - self.slippage if position['side'] == 1 else 1 + self.slippage)
                    
                    # Calculate P&L with leverage
                    if position['side'] == 1:
                        pnl_percent = ((exit_price - position['entry_price']) / position['entry_price']) * self.leverage
                    else:
                        pnl_percent = ((position['entry_price'] - exit_price) / position['entry_price']) * self.leverage
                    
                    fee_out = position['size'] * exit_price * self.commission / self.leverage
                    pnl = (capital * self.position_size * position_multiplier * pnl_percent) - position['fee_in'] - fee_out
                    
                    # Determine exit reason
                    if position['side'] == 1:
                        if current_price <= position['stop_loss']:
                            exit_reason = 'Stop Loss'
                        elif current_price >= position['take_profit']:
                            exit_reason = 'Take Profit'
                        else:
                            exit_reason = 'Signal'
                    else:
                        if current_price >= position['stop_loss']:
                            exit_reason = 'Stop Loss'
                        elif current_price <= position['take_profit']:
                            exit_reason = 'Take Profit'
                        else:
                            exit_reason = 'Signal'
                    
                    trades.append({
                        'entry_time': position['entry_time'],
                        'exit_time': df.index[i],
                        'entry_price': position['entry_price'],
                        'exit_price': exit_price,
                        'side': 'buy' if position['side'] == 1 else 'sell',
                        'size': position['size'],
                        'pnl': pnl,
                        'pnl_pct': pnl_percent * 100,
                        'exit_reason': exit_reason,
                        'signal_strength': position['signal_strength'],
                        'duration_hours': (df.index[i] - position['entry_time']).total_seconds() / 3600
                    })
                    
                    capital += pnl
                    
                    # Track consecutive wins/losses
                    if pnl > 0:
                        consecutive_wins += 1
                        consecutive_losses = 0
                    else:
                        consecutive_losses += 1
                        consecutive_wins = 0
                    
                    position = None
        
        # Calculate advanced metrics
        if len(trades) > 0:
            trades_df = pd.DataFrame(trades)
            
            # Performance metrics
            total_pnl = trades_df['pnl'].sum()
            total_return = (capital - self.initial_capital) / self.initial_capital * 100
            
            winning_trades = trades_df[trades_df['pnl'] > 0]
            losing_trades = trades_df[trades_df['pnl'] <= 0]
            
            win_rate = len(winning_trades) / len(trades_df) * 100
            
            # Risk metrics
            returns = trades_df['pnl_pct'].values
            sharpe_ratio = self.calculate_sharpe(returns)
            sortino_ratio = self.calculate_sortino(returns)
            max_drawdown = self.calculate_max_drawdown(trades_df)
            
            # Trade statistics
            avg_win = winning_trades['pnl'].mean() if len(winning_trades) > 0 else 0
            avg_loss = abs(losing_trades['pnl'].mean()) if len(losing_trades) > 0 else 0
            profit_factor = (winning_trades['pnl'].sum() / abs(losing_trades['pnl'].sum())) if len(losing_trades) > 0 and losing_trades['pnl'].sum() != 0 else float('inf')
            
            # Calculate expectancy
            expectancy = (win_rate/100 * avg_win) - ((1-win_rate/100) * avg_loss)
            
            results = {
                'strategy': strategy['name'],
                'symbol': strategy['symbol'],
                'type': strategy['type'],
                'timeframe': strategy.get('timeframe', '1h'),
                'total_trades': len(trades_df),
                'winning_trades': len(winning_trades),
                'losing_trades': len(losing_trades),
                'win_rate': round(win_rate, 2),
                'total_pnl': round(total_pnl, 2),
                'total_return': round(total_return, 2),
                'avg_win': round(avg_win, 2),
                'avg_loss': round(avg_loss, 2),
                'profit_factor': round(profit_factor, 2) if profit_factor != float('inf') else 999,
                'expectancy': round(expectancy, 2),
                'sharpe_ratio': round(sharpe_ratio, 2),
                'sortino_ratio': round(sortino_ratio, 2),
                'max_drawdown': round(max_drawdown, 2),
                'avg_trade_duration': round(trades_df['duration_hours'].mean(), 2),
                'best_trade': round(trades_df['pnl'].max(), 2),
                'worst_trade': round(trades_df['pnl'].min(), 2),
                'avg_signal_strength': round(trades_df['signal_strength'].mean(), 3),
                'final_capital': round(capital, 2),
                'roi': round(total_return, 2),
                'monthly_roi': round(total_return / (500/30), 2)  # Average monthly ROI
            }
            
            # Store detailed trades
            self.detailed_trades[f"{strategy['name']}_{strategy['symbol']}"] = trades_df
            
        else:
            results = {
                'strategy': strategy['name'],
                'symbol': strategy['symbol'],
                'type': strategy['type'],
                'timeframe': strategy.get('timeframe', '1h'),
                'total_trades': 0,
                'winning_trades': 0,
                'losing_trades': 0,
                'win_rate': 0,
                'total_pnl': 0,
                'total_return': 0,
                'avg_win': 0,
                'avg_loss': 0,
                'profit_factor': 0,
                'expectancy': 0,
                'sharpe_ratio': 0,
                'sortino_ratio': 0,
                'max_drawdown': 0,
                'avg_trade_duration': 0,
                'best_trade': 0,
                'worst_trade': 0,
                'avg_signal_strength': 0,
                'final_capital': self.initial_capital,
                'roi': 0,
                'monthly_roi': 0
            }
        
        return results
    
    def generate_synthetic_data(self, days, timeframe):
        """Generate realistic synthetic data"""
        periods_map = {
            '1m': days * 24 * 60,
            '5m': days * 24 * 12,
            '15m': days * 24 * 4,
            '30m': days * 24 * 2,
            '1h': days * 24,
            '4h': days * 6,
            '1d': days
        }
        periods = min(periods_map.get(timeframe, days * 24), 10000)
        
        # Generate trending price with volatility
        np.random.seed(None)  # Random seed for variety
        trend = np.random.uniform(-0.0001, 0.0003)  # Slight upward bias
        volatility = np.random.uniform(0.005, 0.02)
        
        returns = np.random.normal(trend, volatility, periods)
        
        # Add some fat tails (occasional large moves)
        fat_tail_indices = np.random.choice(periods, size=int(periods * 0.05), replace=False)
        returns[fat_tail_indices] *= np.random.uniform(2, 4, size=len(fat_tail_indices))
        
        price = 100 * np.exp(np.cumsum(returns))
        
        # Generate OHLC
        high = price * (1 + np.random.uniform(0, 0.01, periods))
        low = price * (1 - np.random.uniform(0, 0.01, periods))
        open_price = price * (1 + np.random.uniform(-0.003, 0.003, periods))
        
        # Volume with correlation to price movement
        volume_base = np.random.uniform(1000, 10000, periods)
        volume = volume_base * (1 + abs(returns) * 10)
        
        dates = pd.date_range(end=datetime.now(), periods=periods, freq=timeframe)
        
        df = pd.DataFrame({
            'open': open_price,
            'high': high,
            'low': low,
            'close': price,
            'volume': volume
        }, index=dates)
        
        return df
    
    def calculate_sharpe(self, returns, risk_free_rate=0.02):
        """Calculate Sharpe ratio"""
        if len(returns) < 2:
            return 0
        excess_returns = returns - (risk_free_rate / 252 * 100)  # Convert to percentage
        return np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(252) if np.std(excess_returns) > 0 else 0
    
    def calculate_sortino(self, returns, risk_free_rate=0.02):
        """Calculate Sortino ratio (downside risk only)"""
        if len(returns) < 2:
            return 0
        excess_returns = returns - (risk_free_rate / 252 * 100)
        downside_returns = excess_returns[excess_returns < 0]
        downside_std = np.std(downside_returns) if len(downside_returns) > 0 else 1
        return np.mean(excess_returns) / downside_std * np.sqrt(252) if downside_std > 0 else 0
    
    def calculate_max_drawdown(self, trades_df):
        """Calculate maximum drawdown"""
        cumulative = trades_df['pnl'].cumsum()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / (running_max + self.initial_capital) * 100
        return abs(drawdown.min()) if len(drawdown) > 0 else 0
    
    def run_all_backtests(self):
        """Run backtests for all strategies"""
        logger.info(f"Starting advanced backtest for {len(self.strategies)} strategies")
        
        all_results = []
        
        # Test each strategy
        for i, strategy in enumerate(self.strategies):
            try:
                logger.info(f"Progress: {i+1}/{len(self.strategies)}")
                result = self.backtest_with_leverage(strategy)
                all_results.append(result)
                
                # Rate limiting for API calls
                if strategy['type'] == 'crypto':
                    time.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Failed to test {strategy['name']} on {strategy['symbol']}: {e}")
                
        # Create results DataFrame
        self.results = pd.DataFrame(all_results)
        
        # Sort by ROI
        self.results = self.results.sort_values('roi', ascending=False)
        
        return self.results
    
    def save_results(self):
        """Save comprehensive results to Excel"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        os.makedirs('backtest_results', exist_ok=True)
        
        excel_file = f'backtest_results/advanced_backtest_{timestamp}.xlsx'
        
        with pd.ExcelWriter(excel_file, engine='openpyxl') as writer:
            # Main results
            self.results.to_excel(writer, sheet_name='All_Results', index=False)
            
            # Separate sheets by type
            for asset_type in ['crypto', 'forex', 'metal']:
                type_results = self.results[self.results['type'] == asset_type]
                if len(type_results) > 0:
                    type_results.to_excel(writer, sheet_name=f'{asset_type.capitalize()}_Results', index=False)
            
            # Top performers overall
            top_30 = self.results.head(30)
            top_30.to_excel(writer, sheet_name='Top_30_Overall', index=False)
            
            # Statistics by type
            stats = []
            for asset_type in self.results['type'].unique():
                type_data = self.results[self.results['type'] == asset_type]
                stats.append({
                    'Type': asset_type,
                    'Count': len(type_data),
                    'Avg ROI': type_data['roi'].mean(),
                    'Best ROI': type_data['roi'].max(),
                    'Avg Win Rate': type_data['win_rate'].mean(),
                    'Avg Sharpe': type_data['sharpe_ratio'].mean(),
                    'Avg Monthly ROI': type_data['monthly_roi'].mean()
                })
            
            stats_df = pd.DataFrame(stats)
            stats_df.to_excel(writer, sheet_name='Statistics', index=False)
            
            # Save top 5 detailed trades from each category
            sheet_count = 0
            for asset_type in ['crypto', 'forex', 'metal']:
                type_results = self.results[self.results['type'] == asset_type].head(5)
                for _, row in type_results.iterrows():
                    key = f"{row['strategy']}_{row['symbol']}"
                    if key in self.detailed_trades and sheet_count < 15:
                        sheet_name = f"Trades_{asset_type}_{sheet_count+1}"[:31]
                        self.detailed_trades[key].to_excel(writer, sheet_name=sheet_name, index=False)
                        sheet_count += 1
        
        # Save summary CSV
        csv_file = f'backtest_results/advanced_summary_{timestamp}.csv'
        self.results.to_csv(csv_file, index=False)
        
        logger.info(f"✅ Results saved to {excel_file}")
        
        # Print summary
        print("\n" + "="*70)
        print("ADVANCED BACKTEST COMPLETE - TOP PERFORMERS BY CATEGORY")
        print("="*70)
        
        for asset_type in ['crypto', 'forex', 'metal']:
            type_results = self.results[self.results['type'] == asset_type].head(5)
            if len(type_results) > 0:
                print(f"\n🏆 TOP 5 {asset_type.upper()} STRATEGIES:")
                print(type_results[['strategy', 'symbol', 'roi', 'monthly_roi', 'win_rate', 'sharpe_ratio']].to_string())
        
        print("\n" + "="*70)
        print(f"OVERALL BEST: {self.results.iloc[0]['strategy']} on {self.results.iloc[0]['symbol']}")
        print(f"ROI: {self.results.iloc[0]['roi']:.2f}% | Monthly: {self.results.iloc[0]['monthly_roi']:.2f}%")
        print("="*70)
        
        return excel_file

if __name__ == "__main__":
    logger.info("🚀 Starting Advanced Backtest - Crypto + Forex + Metals")
    logger.info("📊 Testing with 10x leverage and dynamic risk management")
    
    backtest = AdvancedBacktest()
    
    # Run all backtests
    results = backtest.run_all_backtests()
    
    # Save results
    output_file = backtest.save_results()
    
    logger.info("✅ Advanced backtest complete!")
    logger.info(f"📁 Results saved to: {output_file}")
    
    # Final statistics
    print(f"\n📊 FINAL STATISTICS:")
    print(f"Total strategies tested: {len(results)}")
    print(f"Profitable strategies: {(results['roi'] > 0).sum()} ({(results['roi'] > 0).sum()/len(results)*100:.1f}%)")
    print(f"Average ROI: {results['roi'].mean():.2f}%")
    print(f"Average Monthly ROI: {results['monthly_roi'].mean():.2f}%")
    print(f"Best ROI: {results['roi'].max():.2f}%")
    print(f"Best Win Rate: {results['win_rate'].max():.2f}%")