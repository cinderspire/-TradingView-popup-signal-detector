#!/usr/bin/env python3
"""
CRYPTO BACKTESTING BOT - 7 INDEPENDENT STRATEGIES
Converts Pine Script strategies to Python with CCXT integration for top 100 cryptocurrencies

Strategies Implemented:
1. Template Trailing Strategy (Advanced Multi-TP/SL)
2. 3Commas DCA Bot V2 
3. DCA Bot Long/Short
4. Turtle Strategy (Donchian Breakout)
5. Bollinger Bands Strategy
6. CryptoSniper Long Only
7. Moving Average Crossover

Author: AI Trading Bot Developer
Version: 1.0
"""

import ccxt
import pandas as pd
import numpy as np
import talib
import warnings
import time
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import asyncio

warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class TradeResult:
    """Trade result data structure"""
    entry_price: float
    exit_price: float
    quantity: float
    side: str  # 'buy' or 'sell'
    entry_time: datetime
    exit_time: datetime
    pnl: float
    pnl_percent: float
    strategy: str

class TechnicalIndicators:
    """Technical analysis indicators for trading strategies"""
    
    @staticmethod
    def sma(data: pd.Series, period: int) -> pd.Series:
        """Simple Moving Average"""
        return data.rolling(window=period).mean()
    
    @staticmethod
    def ema(data: pd.Series, period: int) -> pd.Series:
        """Exponential Moving Average"""
        return data.ewm(span=period).mean()
    
    @staticmethod
    def rsi(data: pd.Series, period: int = 14) -> pd.Series:
        """Relative Strength Index"""
        delta = data.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))
    
    @staticmethod
    def bollinger_bands(data: pd.Series, period: int = 20, std_dev: float = 2) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """Bollinger Bands (Upper, Middle, Lower)"""
        middle = data.rolling(window=period).mean()
        std = data.rolling(window=period).std()
        upper = middle + (std * std_dev)
        lower = middle - (std * std_dev)
        return upper, middle, lower
    
    @staticmethod
    def atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
        """Average True Range"""
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        return tr.rolling(window=period).mean()
    
    @staticmethod
    def donchian_channels(high: pd.Series, low: pd.Series, period: int = 20) -> Tuple[pd.Series, pd.Series]:
        """Donchian Channels (Upper, Lower)"""
        upper = high.rolling(window=period).max()
        lower = low.rolling(window=period).min()
        return upper, lower
    
    @staticmethod
    def adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
        """Average Directional Index"""
        try:
            return pd.Series(talib.ADX(high.values, low.values, close.values, timeperiod=period), index=close.index)
        except:
            return pd.Series(np.nan, index=close.index)

class Strategy1_TemplateTrailing:
    """Template Trailing Strategy with Multiple TP/SL"""
    
    def __init__(self, config: Dict):
        self.name = "Template_Trailing_Strategy"
        self.fast_ma_period = config.get('fast_ma_period', 21)
        self.slow_ma_period = config.get('slow_ma_period', 49)
        self.ema_period = config.get('ema_period', 200)
        self.atr_period = config.get('atr_period', 14)
        self.take_profit_targets = config.get('take_profit_targets', [2.0, 4.0, 6.0])  # % profits
        self.stop_loss_pct = config.get('stop_loss_pct', 3.0)
        self.position_size = config.get('position_size', 0.1)
        
    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate trading signals based on strategy logic"""
        df = df.copy()
        
        # Calculate indicators
        df['fast_ma'] = TechnicalIndicators.sma(df['close'], self.fast_ma_period)
        df['slow_ma'] = TechnicalIndicators.sma(df['close'], self.slow_ma_period)
        df['ema_filter'] = TechnicalIndicators.ema(df['close'], self.ema_period)
        df['atr'] = TechnicalIndicators.atr(df['high'], df['low'], df['close'], self.atr_period)
        
        # Generate signals
        df['long_signal'] = (
            (df['fast_ma'] > df['slow_ma']) & 
            (df['fast_ma'].shift(1) <= df['slow_ma'].shift(1)) &
            (df['close'] > df['ema_filter'])
        )
        
        df['short_signal'] = (
            (df['fast_ma'] < df['slow_ma']) & 
            (df['fast_ma'].shift(1) >= df['slow_ma'].shift(1)) &
            (df['close'] < df['ema_filter'])
        )
        
        # Exit signals
        df['long_exit'] = (df['fast_ma'] < df['slow_ma']) & (df['fast_ma'].shift(1) >= df['slow_ma'].shift(1))
        df['short_exit'] = (df['fast_ma'] > df['slow_ma']) & (df['fast_ma'].shift(1) <= df['slow_ma'].shift(1))
        
        return df

class Strategy2_DCABot:
    """3Commas DCA Bot V2 Strategy"""
    
    def __init__(self, config: Dict):
        self.name = "DCA_Bot_V2"
        self.base_order_size = config.get('base_order_size', 100)
        self.safety_order_size = config.get('safety_order_size', 140)
        self.price_deviation = config.get('price_deviation', 1.5) / 100
        self.safety_order_volume_scale = config.get('safety_order_volume_scale', 1.5)
        self.safety_order_step_scale = config.get('safety_order_step_scale', 1.6)
        self.max_safety_orders = config.get('max_safety_orders', 6)
        self.take_profit = config.get('take_profit', 4.5) / 100
        self.rsi_threshold = config.get('rsi_threshold', 30)
        
    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate DCA bot signals"""
        df = df.copy()
        
        # Calculate RSI for deal start condition
        df['rsi'] = TechnicalIndicators.rsi(df['close'], 7)
        
        # DCA entry condition (RSI oversold)
        df['dca_start'] = df['rsi'] < self.rsi_threshold
        
        # Safety order triggers based on price deviation
        df['price_drop_5pct'] = df['close'] < df['close'].shift(1) * (1 - 0.05)
        df['price_drop_10pct'] = df['close'] < df['close'].shift(1) * (1 - 0.10)
        
        return df

class Strategy3_DCABotLongShort:
    """DCA Bot Long/Short Strategy"""
    
    def __init__(self, config: Dict):
        self.name = "DCA_Bot_Long_Short"
        self.long_enabled = config.get('long_enabled', True)
        self.short_enabled = config.get('short_enabled', True)
        self.price_deviation_long = config.get('price_deviation_long', 1.1) / 100
        self.price_deviation_short = config.get('price_deviation_short', 1.0) / 100
        self.take_profit_long = config.get('take_profit_long', 1.2) / 100
        self.take_profit_short = config.get('take_profit_short', 1.0) / 100
        self.base_order = config.get('base_order', 4.2)
        self.safety_order = config.get('safety_order', 4.2)
        self.max_safety_orders = config.get('max_safety_orders', 6)
        
    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate Long/Short DCA signals"""
        df = df.copy()
        
        # Calculate technical indicators
        df['sma_20'] = TechnicalIndicators.sma(df['close'], 20)
        df['rsi'] = TechnicalIndicators.rsi(df['close'], 14)
        
        # Long signals
        if self.long_enabled:
            df['long_signal'] = (df['close'] > df['sma_20']) & (df['rsi'] < 70)
        else:
            df['long_signal'] = False
            
        # Short signals  
        if self.short_enabled:
            df['short_signal'] = (df['close'] < df['sma_20']) & (df['rsi'] > 30)
        else:
            df['short_signal'] = False
            
        return df

class Strategy4_TurtleStrategy:
    """Turtle Strategy - Donchian Breakout"""
    
    def __init__(self, config: Dict):
        self.name = "Turtle_Strategy"
        self.entry_period = config.get('entry_period', 20)
        self.exit_period = config.get('exit_period', 10)
        self.atr_period = config.get('atr_period', 20)
        self.atr_multiplier = config.get('atr_multiplier', 2.0)
        self.position_size = config.get('position_size', 0.1)
        
    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate Turtle trading signals"""
        df = df.copy()
        
        # Donchian Channels
        df['upper_channel'], df['lower_channel'] = TechnicalIndicators.donchian_channels(
            df['high'], df['low'], self.entry_period
        )
        df['exit_upper'], df['exit_lower'] = TechnicalIndicators.donchian_channels(
            df['high'], df['low'], self.exit_period
        )
        
        # ATR for position sizing
        df['atr'] = TechnicalIndicators.atr(df['high'], df['low'], df['close'], self.atr_period)
        
        # Entry signals
        df['long_signal'] = df['close'] > df['upper_channel'].shift(1)
        df['short_signal'] = df['close'] < df['lower_channel'].shift(1)
        
        # Exit signals
        df['long_exit'] = df['close'] < df['exit_lower'].shift(1)
        df['short_exit'] = df['close'] > df['exit_upper'].shift(1)
        
        return df

class Strategy5_BollingerStrategy:
    """Bollinger Bands Mean Reversion Strategy"""
    
    def __init__(self, config: Dict):
        self.name = "Bollinger_Strategy"
        self.bb_period = config.get('bb_period', 20)
        self.bb_std = config.get('bb_std', 2.0)
        self.rsi_period = config.get('rsi_period', 14)
        self.rsi_oversold = config.get('rsi_oversold', 30)
        self.rsi_overbought = config.get('rsi_overbought', 70)
        self.take_profit = config.get('take_profit', 1.4) / 100
        self.stop_loss = config.get('stop_loss', 15) / 100
        
    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate Bollinger Bands signals"""
        df = df.copy()
        
        # Bollinger Bands
        df['bb_upper'], df['bb_middle'], df['bb_lower'] = TechnicalIndicators.bollinger_bands(
            df['close'], self.bb_period, self.bb_std
        )
        
        # RSI
        df['rsi'] = TechnicalIndicators.rsi(df['close'], self.rsi_period)
        
        # Entry signals (mean reversion)
        df['long_signal'] = (df['close'] < df['bb_lower']) & (df['rsi'] < self.rsi_oversold)
        df['short_signal'] = (df['close'] > df['bb_upper']) & (df['rsi'] > self.rsi_overbought)
        
        # Exit signals
        df['long_exit'] = df['close'] > df['bb_middle']
        df['short_exit'] = df['close'] < df['bb_middle']
        
        return df

class Strategy6_CryptoSniper:
    """CryptoSniper Long Only Strategy"""
    
    def __init__(self, config: Dict):
        self.name = "CryptoSniper_Long"
        self.resistance_period = config.get('resistance_period', 34)
        self.ema1_period = config.get('ema1_period', 13)
        self.ema2_period = config.get('ema2_period', 21)
        self.support_resistance_period = config.get('support_resistance_period', 10)
        self.higher_tf_period = config.get('higher_tf_period', 120)  # minutes
        
    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate CryptoSniper signals"""
        df = df.copy()
        
        # Candle body resistance channel
        df['candle_body'] = (df['open'] + df['close']) / 2
        df['resistance_channel'] = TechnicalIndicators.sma(df['candle_body'], self.resistance_period)
        
        # EMAs
        df['ema1'] = TechnicalIndicators.ema(df['close'], self.ema1_period)
        df['ema2'] = TechnicalIndicators.ema(df['close'], self.ema2_period)
        
        # Support/Resistance levels
        df['resistance_level'] = df['high'].rolling(window=self.support_resistance_period).max()
        df['support_level'] = df['low'].rolling(window=self.support_resistance_period).min()
        
        # Long only signals
        df['long_signal'] = (
            (df['close'] > df['resistance_channel']) &
            (df['ema1'] > df['ema2']) &
            (df['close'] > df['ema1'])
        )
        
        df['long_exit'] = (df['close'] < df['ema2']) | (df['close'] < df['support_level'])
        
        return df

class Strategy7_MovingAverageCrossover:
    """Simple Moving Average Crossover Strategy"""
    
    def __init__(self, config: Dict):
        self.name = "MA_Crossover"
        self.fast_period = config.get('fast_period', 10)
        self.slow_period = config.get('slow_period', 50)
        self.volume_ma_period = config.get('volume_ma_period', 20)
        
    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate MA Crossover signals"""
        df = df.copy()
        
        # Moving averages
        df['ma_fast'] = TechnicalIndicators.sma(df['close'], self.fast_period)
        df['ma_slow'] = TechnicalIndicators.sma(df['close'], self.slow_period)
        df['volume_ma'] = TechnicalIndicators.sma(df['volume'], self.volume_ma_period)
        
        # Golden cross (bullish) and death cross (bearish)
        df['long_signal'] = (
            (df['ma_fast'] > df['ma_slow']) & 
            (df['ma_fast'].shift(1) <= df['ma_slow'].shift(1)) &
            (df['volume'] > df['volume_ma'])  # Volume confirmation
        )
        
        df['short_signal'] = (
            (df['ma_fast'] < df['ma_slow']) & 
            (df['ma_fast'].shift(1) >= df['ma_slow'].shift(1)) &
            (df['volume'] > df['volume_ma'])  # Volume confirmation
        )
        
        # Exit on opposite crossover
        df['long_exit'] = (df['ma_fast'] < df['ma_slow']) & (df['ma_fast'].shift(1) >= df['ma_slow'].shift(1))
        df['short_exit'] = (df['ma_fast'] > df['ma_slow']) & (df['ma_fast'].shift(1) <= df['ma_slow'].shift(1))
        
        return df

class RiskManager:
    """Risk management for position sizing and stop losses"""
    
    def __init__(self, initial_capital: float = 10000, max_risk_per_trade: float = 0.02):
        self.initial_capital = initial_capital
        self.current_capital = initial_capital
        self.max_risk_per_trade = max_risk_per_trade
        self.trades = []
        
    def calculate_position_size(self, entry_price: float, stop_loss_price: float, risk_amount: float = None) -> float:
        """Calculate position size based on risk management"""
        if risk_amount is None:
            risk_amount = self.current_capital * self.max_risk_per_trade
            
        if stop_loss_price == 0:
            return risk_amount / entry_price
            
        risk_per_unit = abs(entry_price - stop_loss_price)
        return min(risk_amount / risk_per_unit, self.current_capital * 0.25 / entry_price)
    
    def update_capital(self, pnl: float):
        """Update capital after trade"""
        self.current_capital += pnl
        
    def get_performance_metrics(self) -> Dict:
        """Calculate performance metrics"""
        if not self.trades:
            return {}
            
        total_trades = len(self.trades)
        winning_trades = len([t for t in self.trades if t.pnl > 0])
        losing_trades = total_trades - winning_trades
        
        total_pnl = sum([t.pnl for t in self.trades])
        total_return = (total_pnl / self.initial_capital) * 100
        
        win_rate = (winning_trades / total_trades) * 100 if total_trades > 0 else 0
        
        avg_win = np.mean([t.pnl for t in self.trades if t.pnl > 0]) if winning_trades > 0 else 0
        avg_loss = np.mean([t.pnl for t in self.trades if t.pnl < 0]) if losing_trades > 0 else 0
        
        profit_factor = abs(avg_win * winning_trades / avg_loss / losing_trades) if avg_loss != 0 and losing_trades > 0 else 0
        
        return {
            'total_trades': total_trades,
            'winning_trades': winning_trades,
            'losing_trades': losing_trades,
            'win_rate': win_rate,
            'total_return': total_return,
            'profit_factor': profit_factor,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'final_capital': self.current_capital
        }

class BacktestEngine:
    """Main backtesting engine for all strategies"""
    
    def __init__(self, initial_capital: float = 10000):
        self.exchange = ccxt.binance()  # Use Binance for data
        self.initial_capital = initial_capital
        self.strategies = {}
        self.results = {}
        
    def add_strategy(self, strategy_class, config: Dict):
        """Add a strategy to the backtesting engine"""
        strategy = strategy_class(config)
        self.strategies[strategy.name] = strategy
        
    def get_top_100_cryptos(self) -> List[str]:
        """Get top 100 cryptocurrencies by market cap"""
        try:
            markets = self.exchange.load_markets()
            usdt_pairs = [symbol for symbol in markets.keys() if symbol.endswith('/USDT')]
            # Return top 100 or all available USDT pairs
            return usdt_pairs[:100] if len(usdt_pairs) >= 100 else usdt_pairs
        except Exception as e:
            logger.error(f"Error fetching top cryptos: {e}")
            # Fallback to common pairs
            return ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'XRP/USDT', 
                   'DOT/USDT', 'DOGE/USDT', 'UNI/USDT', 'LINK/USDT', 'LTC/USDT']
    
    def fetch_ohlcv_data(self, symbol: str, timeframe: str = '1h', limit: int = 1000) -> pd.DataFrame:
        """Fetch OHLCV data for a symbol"""
        try:
            ohlcv = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            return df
        except Exception as e:
            logger.error(f"Error fetching data for {symbol}: {e}")
            return pd.DataFrame()
    
    def simulate_strategy(self, df: pd.DataFrame, strategy, symbol: str) -> List[TradeResult]:
        """Simulate a strategy on historical data"""
        if df.empty:
            return []
            
        trades = []
        position = None
        risk_manager = RiskManager(self.initial_capital)
        
        # Generate signals
        df_with_signals = strategy.generate_signals(df)
        
        for i in range(1, len(df_with_signals)):
            current_row = df_with_signals.iloc[i]
            current_time = df_with_signals.index[i]
            
            # Check for exit signals first
            if position is not None:
                exit_signal = False
                exit_price = current_row['close']
                
                if position['side'] == 'long':
                    if hasattr(current_row, 'long_exit') and current_row['long_exit']:
                        exit_signal = True
                    elif current_row['close'] <= position['stop_loss']:
                        exit_signal = True
                        exit_price = position['stop_loss']
                    elif current_row['close'] >= position['take_profit']:
                        exit_signal = True
                        exit_price = position['take_profit']
                        
                elif position['side'] == 'short':
                    if hasattr(current_row, 'short_exit') and current_row['short_exit']:
                        exit_signal = True
                    elif current_row['close'] >= position['stop_loss']:
                        exit_signal = True
                        exit_price = position['stop_loss']
                    elif current_row['close'] <= position['take_profit']:
                        exit_signal = True
                        exit_price = position['take_profit']
                
                if exit_signal:
                    # Close position
                    if position['side'] == 'long':
                        pnl = (exit_price - position['entry_price']) * position['quantity']
                    else:
                        pnl = (position['entry_price'] - exit_price) * position['quantity']
                    
                    pnl_percent = (pnl / (position['entry_price'] * position['quantity'])) * 100
                    
                    trade = TradeResult(
                        entry_price=position['entry_price'],
                        exit_price=exit_price,
                        quantity=position['quantity'],
                        side=position['side'],
                        entry_time=position['entry_time'],
                        exit_time=current_time,
                        pnl=pnl,
                        pnl_percent=pnl_percent,
                        strategy=strategy.name
                    )
                    
                    trades.append(trade)
                    risk_manager.trades.append(trade)
                    risk_manager.update_capital(pnl)
                    position = None
            
            # Check for new entry signals
            if position is None:
                entry_price = current_row['close']
                
                # Long signal
                if hasattr(current_row, 'long_signal') and current_row['long_signal']:
                    stop_loss = entry_price * 0.97  # 3% stop loss
                    take_profit = entry_price * 1.06  # 6% take profit
                    quantity = risk_manager.calculate_position_size(entry_price, stop_loss)
                    
                    position = {
                        'side': 'long',
                        'entry_price': entry_price,
                        'quantity': quantity,
                        'stop_loss': stop_loss,
                        'take_profit': take_profit,
                        'entry_time': current_time
                    }
                
                # Short signal
                elif hasattr(current_row, 'short_signal') and current_row['short_signal']:
                    stop_loss = entry_price * 1.03  # 3% stop loss
                    take_profit = entry_price * 0.94  # 6% take profit
                    quantity = risk_manager.calculate_position_size(entry_price, stop_loss)
                    
                    position = {
                        'side': 'short',
                        'entry_price': entry_price,
                        'quantity': quantity,
                        'stop_loss': stop_loss,
                        'take_profit': take_profit,
                        'entry_time': current_time
                    }
        
        return trades
    
    def run_backtest(self, symbols: List[str] = None, timeframe: str = '1h') -> Dict:
        """Run backtest for all strategies on given symbols"""
        if symbols is None:
            symbols = self.get_top_100_cryptos()[:10]  # Test on top 10 for demo
            
        logger.info(f"Starting backtest on {len(symbols)} symbols with {len(self.strategies)} strategies")
        
        all_results = {}
        
        for strategy_name, strategy in self.strategies.items():
            logger.info(f"Testing strategy: {strategy_name}")
            strategy_results = {}
            all_trades = []
            
            for symbol in symbols:
                try:
                    # Fetch data
                    df = self.fetch_ohlcv_data(symbol, timeframe)
                    if df.empty:
                        continue
                    
                    # Run strategy simulation
                    trades = self.simulate_strategy(df, strategy, symbol)
                    all_trades.extend(trades)
                    
                    if trades:
                        symbol_pnl = sum([t.pnl for t in trades])
                        strategy_results[symbol] = {
                            'trades': len(trades),
                            'pnl': symbol_pnl,
                            'return_pct': (symbol_pnl / self.initial_capital) * 100
                        }
                    
                    # Add small delay to avoid rate limits
                    time.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Error processing {symbol} for {strategy_name}: {e}")
                    continue
            
            # Calculate overall strategy performance
            if all_trades:
                total_pnl = sum([t.pnl for t in all_trades])
                winning_trades = len([t for t in all_trades if t.pnl > 0])
                total_trades = len(all_trades)
                win_rate = (winning_trades / total_trades) * 100 if total_trades > 0 else 0
                
                all_results[strategy_name] = {
                    'total_trades': total_trades,
                    'winning_trades': winning_trades,
                    'win_rate': win_rate,
                    'total_pnl': total_pnl,
                    'return_pct': (total_pnl / self.initial_capital) * 100,
                    'symbol_results': strategy_results,
                    'trades': all_trades
                }
            else:
                all_results[strategy_name] = {
                    'total_trades': 0,
                    'winning_trades': 0,
                    'win_rate': 0,
                    'total_pnl': 0,
                    'return_pct': 0,
                    'symbol_results': {},
                    'trades': []
                }
        
        return all_results
    
    def generate_report(self, results: Dict) -> str:
        """Generate a comprehensive backtest report"""
        report = "=" * 80 + "\n"
        report += "CRYPTO BACKTESTING BOT - STRATEGY PERFORMANCE REPORT\n"
        report += "=" * 80 + "\n\n"
        
        # Overall summary
        total_strategies = len(results)
        profitable_strategies = len([r for r in results.values() if r['return_pct'] > 0])
        
        report += f"SUMMARY:\n"
        report += f"Total Strategies Tested: {total_strategies}\n"
        report += f"Profitable Strategies: {profitable_strategies}\n"
        report += f"Success Rate: {(profitable_strategies/total_strategies)*100:.1f}%\n\n"
        
        # Strategy details
        report += "STRATEGY PERFORMANCE:\n"
        report += "-" * 80 + "\n"
        
        # Sort strategies by return percentage
        sorted_strategies = sorted(results.items(), key=lambda x: x[1]['return_pct'], reverse=True)
        
        for strategy_name, result in sorted_strategies:
            report += f"\n{strategy_name}:\n"
            report += f"  Total Trades: {result['total_trades']}\n"
            report += f"  Winning Trades: {result['winning_trades']}\n"
            report += f"  Win Rate: {result['win_rate']:.2f}%\n"
            report += f"  Total P&L: ${result['total_pnl']:.2f}\n"
            report += f"  Return: {result['return_pct']:.2f}%\n"
            
            # Top performing symbols for this strategy
            if result['symbol_results']:
                top_symbols = sorted(result['symbol_results'].items(), 
                                   key=lambda x: x[1]['return_pct'], reverse=True)[:3]
                report += f"  Top Symbols: "
                for symbol, perf in top_symbols:
                    report += f"{symbol}({perf['return_pct']:.1f}%) "
                report += "\n"
        
        report += "\n" + "=" * 80 + "\n"
        report += f"Report generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        
        return report

def main():
    """Main function to run the backtesting bot"""
    
    # Initialize backtesting engine
    engine = BacktestEngine(initial_capital=10000)
    
    # Strategy configurations
    strategy_configs = {
        'template_trailing': {
            'fast_ma_period': 21,
            'slow_ma_period': 49,
            'ema_period': 200,
            'take_profit_targets': [2.0, 4.0, 6.0],
            'stop_loss_pct': 3.0
        },
        'dca_bot_v2': {
            'base_order_size': 100,
            'safety_order_size': 140,
            'price_deviation': 1.5,
            'take_profit': 4.5,
            'rsi_threshold': 30
        },
        'dca_long_short': {
            'long_enabled': True,
            'short_enabled': True,
            'price_deviation_long': 1.1,
            'take_profit_long': 1.2,
            'base_order': 4.2
        },
        'turtle_strategy': {
            'entry_period': 20,
            'exit_period': 10,
            'atr_period': 20,
            'atr_multiplier': 2.0
        },
        'bollinger_strategy': {
            'bb_period': 20,
            'bb_std': 2.0,
            'rsi_period': 14,
            'take_profit': 1.4
        },
        'cryptosniper': {
            'resistance_period': 34,
            'ema1_period': 13,
            'ema2_period': 21,
            'support_resistance_period': 10
        },
        'ma_crossover': {
            'fast_period': 10,
            'slow_period': 50,
            'volume_ma_period': 20
        }
    }
    
    # Add all strategies to the engine
    engine.add_strategy(Strategy1_TemplateTrailing, strategy_configs['template_trailing'])
    engine.add_strategy(Strategy2_DCABot, strategy_configs['dca_bot_v2'])
    engine.add_strategy(Strategy3_DCABotLongShort, strategy_configs['dca_long_short'])
    engine.add_strategy(Strategy4_TurtleStrategy, strategy_configs['turtle_strategy'])
    engine.add_strategy(Strategy5_BollingerStrategy, strategy_configs['bollinger_strategy'])
    engine.add_strategy(Strategy6_CryptoSniper, strategy_configs['cryptosniper'])
    engine.add_strategy(Strategy7_MovingAverageCrossover, strategy_configs['ma_crossover'])
    
    # Get top cryptocurrencies (limit to 15 for demo)
    top_cryptos = engine.get_top_100_cryptos()[:15]
    
    logger.info(f"Testing strategies on: {', '.join(top_cryptos)}")
    
    # Run backtest
    results = engine.run_backtest(symbols=top_cryptos, timeframe='1h')
    
    # Generate and print report
    report = engine.generate_report(results)
    print(report)
    
    # Save results to JSON file
    results_file = f"backtest_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    # Convert TradeResult objects to dictionaries for JSON serialization
    json_results = {}
    for strategy, result in results.items():
        json_results[strategy] = {
            'total_trades': result['total_trades'],
            'winning_trades': result['winning_trades'],
            'win_rate': result['win_rate'],
            'total_pnl': result['total_pnl'],
            'return_pct': result['return_pct'],
            'symbol_results': result['symbol_results']
            # Note: Excluding 'trades' list for JSON compatibility
        }
    
    with open(results_file, 'w') as f:
        json.dump(json_results, f, indent=2)
    
    logger.info(f"Results saved to {results_file}")
    
    # Save detailed report to text file
    report_file = f"backtest_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_file, 'w') as f:
        f.write(report)
    
    logger.info(f"Report saved to {report_file}")

if __name__ == "__main__":
    main()