"""
Strategy: MACD_Histogram_Divergence_V61
Source: from_web
Description: Web strategy variant 61
Parameters: {
  "description": "TradingView top-rated MACD divergence strategy",
  "indicators": [
    "MACD",
    "Signal",
    "Histogram"
  ],
  "entry_rules": "histogram_divergence",
  "exit_rules": "signal_cross",
  "timeframe": "4H",
  "win_rate_expected": 68
}
Generated: 2025-08-25 10:35:12
"""

import pandas as pd
import numpy as np
import vectorbt as vbt
from datetime import datetime, timedelta

class MACD_Histogram_Divergence_V61:
    def __init__(self):
        self.name = "MACD_Histogram_Divergence_V61"
        self.source = "from_web"
        self.params = {'description': 'TradingView top-rated MACD divergence strategy', 'indicators': ['MACD', 'Signal', 'Histogram'], 'entry_rules': 'histogram_divergence', 'exit_rules': 'signal_cross', 'timeframe': '4H', 'win_rate_expected': 68}
        
        # Strategy specific parameters
        self.lookback_period = 90
        self.entry_threshold = 0.03
        self.exit_threshold = 0.04
        self.stop_loss = 0.04
        self.take_profit = 0.04
        
    def generate_signals(self, data):
        """Generate trading signals based on strategy rules"""
        
        # Calculate indicators based on strategy type
        close = data['Close']
        high = data['High']
        low = data['Low']
        volume = data['Volume']
        
        # Moving averages
        sma_fast = close.rolling(window=10).mean()
        sma_slow = close.rolling(window=40).mean()
        
        # RSI
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        # Bollinger Bands
        bb_period = 20
        bb_std = 2
        sma_bb = close.rolling(window=bb_period).mean()
        std = close.rolling(window=bb_period).std()
        bb_upper = sma_bb + (bb_std * std)
        bb_lower = sma_bb - (bb_std * std)
        
        # MACD
        exp1 = close.ewm(span=12, adjust=False).mean()
        exp2 = close.ewm(span=26, adjust=False).mean()
        macd = exp1 - exp2
        signal = macd.ewm(span=9, adjust=False).mean()
        
        # Generate entry and exit signals
        entries = pd.Series(False, index=data.index)
        exits = pd.Series(False, index=data.index)
        
        # Strategy-specific logic
        
        
        
        
        
        
        
        
        
        
        
        
        # Default strategy logic
        if not any(pattern in self.name.lower() for pattern in ['momentum', 'breakout', 'reversal']):
            # Trend following with multiple confirmations
            trend_up = sma_fast > sma_slow
            momentum_up = macd > signal
            not_overbought = rsi < 75
            
            entries = trend_up & momentum_up & not_overbought
            
            trend_down = sma_fast < sma_slow
            momentum_down = macd < signal
            not_oversold = rsi > 25
            
            exits = trend_down | momentum_down | ~not_oversold
        
        return entries, exits
    
    def backtest(self, data, initial_capital=10000):
        """Run vectorbt backtest"""
        
        entries, exits = self.generate_signals(data)
        
        # Run backtest with vectorbt
        portfolio = vbt.Portfolio.from_signals(
            data['Close'],
            entries,
            exits,
            init_cash=initial_capital,
            fees=0.001,  # 0.1% trading fee
            slippage=0.001,  # 0.1% slippage
            size=self.calculate_position_size(initial_capital),
            size_type='value'
        )
        
        return portfolio
    
    def calculate_position_size(self, capital):
        """Calculate position size based on risk management"""
        # Risk 2% of capital per trade
        return capital * 0.02
    
    def get_performance_metrics(self, portfolio):
        """Extract performance metrics from backtest"""
        
        metrics = {
            'strategy_name': self.name,
            'source': self.source,
            'total_return': portfolio.total_return(),
            'annual_return': portfolio.annualized_return(),
            'sharpe_ratio': portfolio.sharpe_ratio(),
            'max_drawdown': portfolio.max_drawdown(),
            'win_rate': portfolio.win_rate(),
            'total_trades': portfolio.total_trades(),
            'profit_factor': portfolio.profit_factor(),
            'expectancy': portfolio.expectancy()
        }
        
        return metrics

# Strategy instance
strategy = MACD_Histogram_Divergence_V61()
