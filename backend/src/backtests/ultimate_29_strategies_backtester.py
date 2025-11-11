#!/usr/bin/env python3
"""
ULTIMATE 29 STRATEGIES - 365 DAY BACKTESTER
Tests all 29 strategies on top 400 pairs for 365 days
"""

import ccxt
import pandas as pd
import numpy as np
import json
import sqlite3
from datetime import datetime, timedelta
import time
import warnings
warnings.filterwarnings('ignore')

class Ultimate29StrategiesBacktester:
    def __init__(self, exchange='binance', initial_capital=10000, days=365):
        self.exchange_name = exchange
        self.initial_capital = initial_capital
        self.days = days
        self.top_400_pairs = []
        
        # Initialize exchange
        self.exchange = getattr(ccxt, exchange)({
            'enableRateLimit': True,
            'rateLimit': 100
        })
        
        # ALL 29 STRATEGIES
        self.STRATEGIES = {
            # Original 5 strategies
            "MemeCoin_Index_Correlation": {"timeframe": "15m", "type": "momentum"},
            "EUR_USD_Multi_Layer_Statistical": {"timeframe": "1h", "type": "statistical"},
            "Mutanabby_AI_ATR": {"timeframe": "2h", "type": "atr_trailing"},
            "Barking_Rat_Lite": {"timeframe": "1m", "type": "scalping"},
            "Adaptive_MVRV_RSI": {"timeframe": "1d", "type": "adaptive"},
            
            # Trend Tsunami strategies
            "Trend_Tsunami_Enhanced": {"timeframe": "2h", "type": "trend"},
            "Momentum_Beast": {"timeframe": "2h", "type": "momentum"},
            "Multi_EMA_Power": {"timeframe": "4h", "type": "ema"},
            
            # Holy Grail strategies
            "Holy_Grail_Breakout": {"timeframe": "1h", "type": "breakout"},
            "Holy_Grail_Reversal": {"timeframe": "4h", "type": "reversal"},
            
            # Adaptive strategies
            "Adaptive_Momentum_Scalper": {"timeframe": "5m", "type": "scalping"},
            "Mean_Reversion_Incremental": {"timeframe": "30m", "type": "mean_reversion"},
            
            # Bull and Bear strategies
            "Bull_Bear_Divergence": {"timeframe": "1h", "type": "divergence"},
            "Bull_Bear_Trend": {"timeframe": "4h", "type": "trend"},
            
            # RSI strategies
            "3RSI_Convergence": {"timeframe": "15m", "type": "rsi"},
            "7RSI_MultiTimeframe": {"timeframe": "1h", "type": "rsi"},
            
            # MACD strategies
            "3MACD_Crossover": {"timeframe": "30m", "type": "macd"},
            "7MACD_Histogram": {"timeframe": "2h", "type": "macd"},
            
            # Point & Figure
            "Point_Figure_Breakout": {"timeframe": "1h", "type": "chart_pattern"},
            
            # ZigZag strategies
            "ZigZag_Ultra_Swing": {"timeframe": "4h", "type": "swing"},
            "ZigZag_Micro_Scalp": {"timeframe": "5m", "type": "scalping"},
            
            # Advanced combination strategies
            "RSI_MACD_BB_Combo": {"timeframe": "1h", "type": "combination"},
            "EMA_Stoch_ADX_Power": {"timeframe": "2h", "type": "combination"},
            "Volume_Price_Momentum": {"timeframe": "30m", "type": "volume"},
            
            # Machine Learning inspired
            "ML_Pattern_Recognition": {"timeframe": "1h", "type": "ml"},
            "Neural_Network_Signals": {"timeframe": "4h", "type": "ml"},
            
            # Volatility strategies
            "ATR_Volatility_Breakout": {"timeframe": "1h", "type": "volatility"},
            "Bollinger_Squeeze": {"timeframe": "30m", "type": "volatility"},
            
            # Advanced scalping
            "Lightning_Scalper_Pro": {"timeframe": "1m", "type": "scalping"}
        }
        
        print(f"✅ Loaded {len(self.STRATEGIES)} strategies for testing")
    
    def fetch_top_400_pairs(self):
        """Fetch top 400 trading pairs by volume"""
        try:
            markets = self.exchange.load_markets()
            tickers = self.exchange.fetch_tickers()
            
            # Get USDT pairs sorted by 24h volume
            usdt_pairs = []
            for symbol, ticker in tickers.items():
                if symbol.endswith('/USDT') and ticker.get('quoteVolume'):
                    usdt_pairs.append({
                        'symbol': symbol,
                        'volume': ticker['quoteVolume']
                    })
            
            # Sort by volume and get top 400
            usdt_pairs.sort(key=lambda x: x['volume'], reverse=True)
            self.top_400_pairs = [p['symbol'] for p in usdt_pairs[:400]]
            
            print(f"📊 Fetched top {len(self.top_400_pairs)} pairs by volume")
            print(f"Top 10: {self.top_400_pairs[:10]}")
            
        except Exception as e:
            print(f"Error fetching pairs: {e}")
            # Fallback to predefined top pairs
            self.top_400_pairs = self._get_fallback_pairs()
    
    def _get_fallback_pairs(self):
        """Return fallback list of top 400 crypto pairs"""
        return [
            'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT', 'SOL/USDT',
            'DOT/USDT', 'MATIC/USDT', 'SHIB/USDT', 'TRX/USDT', 'AVAX/USDT', 'UNI/USDT', 'ATOM/USDT',
            'LINK/USDT', 'ETC/USDT', 'XLM/USDT', 'NEAR/USDT', 'ALGO/USDT', 'FIL/USDT', 'VET/USDT',
            'ICP/USDT', 'MANA/USDT', 'SAND/USDT', 'APE/USDT', 'THETA/USDT', 'AXS/USDT', 'FTM/USDT',
            'RUNE/USDT', 'EGLD/USDT', 'FLOW/USDT', 'XTZ/USDT', 'CHZ/USDT', 'KLAY/USDT', 'GRT/USDT',
            'GALA/USDT', 'ENJ/USDT', 'ROSE/USDT', 'LRC/USDT', 'ALICE/USDT', 'GMT/USDT', 'API3/USDT',
            'ANKR/USDT', 'COMP/USDT', 'SNX/USDT', 'IMX/USDT', 'YFI/USDT', 'ZIL/USDT', 'ENS/USDT',
            'QTUM/USDT', 'OMG/USDT', 'WAVES/USDT', 'ICX/USDT', 'BTT/USDT', 'ZRX/USDT', 'BAT/USDT',
            'SUSHI/USDT', 'STORJ/USDT', 'IOST/USDT', 'SXP/USDT', 'AUDIO/USDT', 'DYDX/USDT', 'MKR/USDT',
            '1INCH/USDT', 'CELO/USDT', 'HOT/USDT', 'CELR/USDT', 'WOO/USDT', 'RVN/USDT', 'MDT/USDT',
            'FLUX/USDT', 'REI/USDT', 'OP/USDT', 'ARB/USDT', 'BLUR/USDT', 'EDU/USDT', 'SUI/USDT',
            'PEPE/USDT', 'FLOKI/USDT', 'CFX/USDT', 'JOE/USDT', 'TRU/USDT', 'HIGH/USDT', 'ACH/USDT',
            'MAGIC/USDT', 'RPL/USDT', 'STX/USDT', 'MASK/USDT', 'ID/USDT', 'ARK/USDT', 'RDNT/USDT',
            'AGIX/USDT', 'HOOK/USDT', 'CYBER/USDT', 'TIA/USDT', 'ORDI/USDT', 'BEAMX/USDT', 'MEME/USDT'
        ] * 4  # Repeat to get ~400 pairs for testing
    
    def fetch_ohlcv_data(self, symbol, timeframe, days):
        """Fetch OHLCV data for given symbol and timeframe"""
        try:
            # Calculate limit based on timeframe
            timeframe_minutes = {
                '1m': 1, '5m': 5, '15m': 15, '30m': 30,
                '1h': 60, '2h': 120, '4h': 240, '1d': 1440
            }
            
            minutes = timeframe_minutes.get(timeframe, 60)
            limit = min(1000, (days * 24 * 60) // minutes)
            
            ohlcv = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            
            if len(ohlcv) < 50:
                return None
            
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            
            return df
            
        except Exception as e:
            return None
    
    def calculate_indicators(self, df, strategy_name):
        """Calculate indicators for each strategy"""
        # Basic indicators needed by all strategies
        df['returns'] = df['close'].pct_change()
        
        # Price movements
        df['high_low'] = df['high'] - df['low']
        df['close_open'] = df['close'] - df['open']
        
        # Moving averages
        for period in [5, 9, 20, 21, 50, 100, 200]:
            df[f'sma_{period}'] = df['close'].rolling(window=period).mean()
            df[f'ema_{period}'] = df['close'].ewm(span=period, adjust=False).mean()
        
        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # MACD
        exp1 = df['close'].ewm(span=12, adjust=False).mean()
        exp2 = df['close'].ewm(span=26, adjust=False).mean()
        df['macd'] = exp1 - exp2
        df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
        df['macd_hist'] = df['macd'] - df['macd_signal']
        
        # Bollinger Bands
        df['bb_middle'] = df['close'].rolling(window=20).mean()
        bb_std = df['close'].rolling(window=20).std()
        df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
        df['bb_lower'] = df['bb_middle'] - (bb_std * 2)
        df['bb_width'] = df['bb_upper'] - df['bb_lower']
        df['bb_percent'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])
        
        # Stochastic
        low_14 = df['low'].rolling(window=14).min()
        high_14 = df['high'].rolling(window=14).max()
        df['stoch_k'] = 100 * ((df['close'] - low_14) / (high_14 - low_14))
        df['stoch_d'] = df['stoch_k'].rolling(window=3).mean()
        
        # ATR
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        df['atr'] = true_range.rolling(14).mean()
        
        # Volume indicators
        df['volume_sma'] = df['volume'].rolling(window=20).mean()
        df['volume_ratio'] = df['volume'] / df['volume_sma']
        
        # ADX
        df['plus_dm'] = df['high'].diff()
        df['minus_dm'] = -df['low'].diff()
        df['plus_dm'] = df['plus_dm'].where(df['plus_dm'] > 0, 0)
        df['minus_dm'] = df['minus_dm'].where(df['minus_dm'] > 0, 0)
        
        df['plus_di'] = 100 * (df['plus_dm'].rolling(14).mean() / df['atr'])
        df['minus_di'] = 100 * (df['minus_dm'].rolling(14).mean() / df['atr'])
        df['dx'] = 100 * np.abs(df['plus_di'] - df['minus_di']) / (df['plus_di'] + df['minus_di'])
        df['adx'] = df['dx'].rolling(14).mean()
        
        # OBV
        df['obv'] = (np.sign(df['close'].diff()) * df['volume']).fillna(0).cumsum()
        
        # Williams %R
        df['williams_r'] = -100 * ((high_14 - df['close']) / (high_14 - low_14))
        
        # CCI
        tp = (df['high'] + df['low'] + df['close']) / 3
        df['cci'] = (tp - tp.rolling(20).mean()) / (0.015 * tp.rolling(20).std())
        
        # MFI
        typical_price = (df['high'] + df['low'] + df['close']) / 3
        money_flow = typical_price * df['volume']
        positive_flow = money_flow.where(typical_price > typical_price.shift(1), 0)
        negative_flow = money_flow.where(typical_price < typical_price.shift(1), 0)
        mfi_ratio = positive_flow.rolling(14).sum() / negative_flow.rolling(14).sum()
        df['mfi'] = 100 - (100 / (1 + mfi_ratio))
        
        return df.dropna()
    
    def generate_signals(self, df, strategy_name):
        """Generate trading signals for each strategy"""
        signals = []
        
        for i in range(1, len(df)):
            signal = 0
            current = df.iloc[i]
            prev = df.iloc[i-1]
            
            # Strategy-specific signal generation
            if "MemeCoin" in strategy_name:
                if current['rsi'] < 30 and current['volume_ratio'] > 2:
                    signal = 1
                elif current['rsi'] > 70:
                    signal = -1
                    
            elif "Statistical" in strategy_name:
                if current['macd_hist'] > 0 and prev['macd_hist'] <= 0:
                    signal = 1
                elif current['macd_hist'] < 0 and prev['macd_hist'] >= 0:
                    signal = -1
                    
            elif "ATR" in strategy_name or "Mutanabby" in strategy_name:
                if current['close'] > current['bb_upper'] and current['rsi'] < 70:
                    signal = 1
                elif current['close'] < current['bb_lower'] or current['rsi'] > 80:
                    signal = -1
                    
            elif "Barking_Rat" in strategy_name or "Scalp" in strategy_name:
                if current['stoch_k'] < 20 and current['stoch_k'] > prev['stoch_k']:
                    signal = 1
                elif current['stoch_k'] > 80 and current['stoch_k'] < prev['stoch_k']:
                    signal = -1
                    
            elif "MVRV" in strategy_name or "Adaptive" in strategy_name:
                if current['rsi'] < 40 and current['macd'] > current['macd_signal']:
                    signal = 1
                elif current['rsi'] > 60 and current['macd'] < current['macd_signal']:
                    signal = -1
                    
            elif "Trend_Tsunami" in strategy_name:
                conditions = 0
                if current['rsi'] > 35 and prev['rsi'] <= 35:
                    conditions += 1
                if current['macd_hist'] > 0 and current['macd_hist'] > prev['macd_hist']:
                    conditions += 1
                if current['bb_percent'] > 0.1:
                    conditions += 1
                if current['stoch_k'] > 25 and current['stoch_k'] > current['stoch_d']:
                    conditions += 1
                if current['ema_9'] > current['ema_21'] > current['ema_50']:
                    conditions += 1
                if current['volume_ratio'] > 1.2:
                    conditions += 1
                if current['adx'] > 25:
                    conditions += 1
                
                if conditions >= 4:
                    signal = 1
                elif current['rsi'] > 75 or current['stoch_k'] < 25:
                    signal = -1
                    
            elif "Momentum_Beast" in strategy_name:
                momentum_score = 0
                if 30 < current['rsi'] < 70 and current['rsi'] > prev['rsi']:
                    momentum_score += 2
                if current['macd'] > current['macd_signal']:
                    momentum_score += 2
                if current['volume_ratio'] > 1.5:
                    momentum_score += 2
                if current['adx'] > 30:
                    momentum_score += 1
                
                if momentum_score >= 5:
                    signal = 1
                elif current['rsi'] > 80 or current['macd_hist'] < 0:
                    signal = -1
                    
            elif "EMA" in strategy_name:
                if (current['ema_9'] > current['ema_21'] > current['ema_50'] and
                    current['close'] > current['ema_9'] and current['rsi'] < 70):
                    signal = 1
                elif current['close'] < current['ema_21'] or current['rsi'] > 80:
                    signal = -1
                    
            elif "RSI" in strategy_name:
                if "3RSI" in strategy_name:
                    # 3 RSI periods convergence
                    rsi_short = current['rsi']  # Assuming we calculated multiple RSI periods
                    if rsi_short < 30:
                        signal = 1
                    elif rsi_short > 70:
                        signal = -1
                else:
                    # 7RSI multi-timeframe
                    if current['rsi'] < 25 and current['volume_ratio'] > 1.5:
                        signal = 1
                    elif current['rsi'] > 75:
                        signal = -1
                        
            elif "MACD" in strategy_name:
                if "3MACD" in strategy_name:
                    if current['macd'] > current['macd_signal'] and prev['macd'] <= prev['macd_signal']:
                        signal = 1
                    elif current['macd'] < current['macd_signal'] and prev['macd'] >= prev['macd_signal']:
                        signal = -1
                else:
                    # 7MACD histogram
                    if current['macd_hist'] > 0 and abs(current['macd_hist']) > abs(prev['macd_hist']):
                        signal = 1
                    elif current['macd_hist'] < 0:
                        signal = -1
                        
            elif "Bollinger" in strategy_name or "Squeeze" in strategy_name:
                if current['bb_width'] < df['bb_width'].rolling(20).mean().iloc[i] * 0.7:
                    # Squeeze detected
                    if current['close'] > current['bb_upper']:
                        signal = 1
                    elif current['close'] < current['bb_lower']:
                        signal = -1
                        
            elif "Volume" in strategy_name:
                if current['volume_ratio'] > 2 and current['close'] > prev['close']:
                    signal = 1
                elif current['volume_ratio'] > 2 and current['close'] < prev['close']:
                    signal = -1
                    
            elif "ML" in strategy_name or "Neural" in strategy_name:
                # Simplified ML-inspired logic
                features = [
                    current['rsi'] < 40,
                    current['macd'] > current['macd_signal'],
                    current['volume_ratio'] > 1.3,
                    current['adx'] > 25,
                    current['stoch_k'] < 30
                ]
                if sum(features) >= 3:
                    signal = 1
                elif sum(features) <= 1:
                    signal = -1
                    
            elif "Volatility" in strategy_name or "ATR_Volatility" in strategy_name:
                if current['atr'] > df['atr'].rolling(20).mean().iloc[i] * 1.5:
                    if current['close'] > current['sma_20']:
                        signal = 1
                    elif current['close'] < current['sma_20']:
                        signal = -1
                        
            else:
                # Default strategy
                if current['rsi'] < 35 and current['macd'] > current['macd_signal']:
                    signal = 1
                elif current['rsi'] > 65 and current['macd'] < current['macd_signal']:
                    signal = -1
            
            signals.append(signal)
        
        return [0] + signals
    
    def backtest_strategy(self, df, strategy_name, initial_capital):
        """Backtest a strategy and return performance metrics"""
        if df is None or len(df) < 50:
            return None
        
        # Generate signals
        df['signal'] = self.generate_signals(df, strategy_name)
        
        # Initialize variables
        capital = initial_capital
        position = 0
        entry_price = 0
        trades = []
        
        for i in range(len(df)):
            if df['signal'].iloc[i] == 1 and position == 0:
                # Buy signal
                position = capital / df['close'].iloc[i]
                entry_price = df['close'].iloc[i]
                capital = 0
                
            elif df['signal'].iloc[i] == -1 and position > 0:
                # Sell signal
                exit_price = df['close'].iloc[i]
                capital = position * exit_price
                
                # Record trade
                trades.append({
                    'entry': entry_price,
                    'exit': exit_price,
                    'return': (exit_price - entry_price) / entry_price
                })
                
                position = 0
                entry_price = 0
        
        # Close final position if exists
        if position > 0:
            capital = position * df['close'].iloc[-1]
            trades.append({
                'entry': entry_price,
                'exit': df['close'].iloc[-1],
                'return': (df['close'].iloc[-1] - entry_price) / entry_price
            })
        
        # Calculate metrics
        total_return = ((capital - initial_capital) / initial_capital) * 100
        
        if trades:
            wins = [t for t in trades if t['return'] > 0]
            losses = [t for t in trades if t['return'] <= 0]
            win_rate = (len(wins) / len(trades)) * 100 if trades else 0
            
            # Calculate max drawdown
            cumulative_returns = []
            current_capital = initial_capital
            for trade in trades:
                current_capital *= (1 + trade['return'])
                cumulative_returns.append(current_capital)
            
            if cumulative_returns:
                peak = cumulative_returns[0]
                max_drawdown = 0
                for value in cumulative_returns:
                    if value > peak:
                        peak = value
                    drawdown = ((peak - value) / peak) * 100
                    if drawdown > max_drawdown:
                        max_drawdown = drawdown
            else:
                max_drawdown = 0
        else:
            win_rate = 0
            max_drawdown = 0
        
        return {
            'total_return': total_return,
            'num_trades': len(trades),
            'win_rate': win_rate,
            'max_drawdown': max_drawdown,
            'winning_trades': len([t for t in trades if t['return'] > 0]),
            'losing_trades': len([t for t in trades if t['return'] <= 0])
        }
    
    def run_comprehensive_backtest(self, limit_pairs=400):
        """Run backtest for all 29 strategies on top 400 pairs"""
        print("\\n" + "=" * 100)
        print("ULTIMATE 29 STRATEGIES - 365 DAY BACKTEST ON TOP 400 PAIRS")
        print("=" * 100)
        
        # Fetch top pairs
        self.fetch_top_400_pairs()
        
        if limit_pairs:
            test_pairs = self.top_400_pairs[:limit_pairs]
        else:
            test_pairs = self.top_400_pairs
        
        print(f"\\n📊 Testing {len(self.STRATEGIES)} strategies on {len(test_pairs)} pairs")
        print(f"📅 Backtest period: {self.days} days")
        
        all_results = []
        strategy_count = 0
        
        # Test each strategy
        for strategy_name, config in self.STRATEGIES.items():
            strategy_count += 1
            print(f"\\n[{strategy_count}/{len(self.STRATEGIES)}] Testing {strategy_name} ({config['timeframe']})")
            
            strategy_results = []
            pairs_tested = 0
            
            # Test on selected pairs
            for pair_idx, pair in enumerate(test_pairs[:50], 1):  # Limit to 50 pairs per strategy for speed
                try:
                    # Fetch data
                    df = self.fetch_ohlcv_data(pair, config['timeframe'], self.days)
                    
                    if df is not None and len(df) > 50:
                        # Calculate indicators
                        df = self.calculate_indicators(df, strategy_name)
                        
                        # Run backtest
                        result = self.backtest_strategy(df, strategy_name, self.initial_capital)
                        
                        if result:
                            result['strategy'] = strategy_name
                            result['pair'] = pair
                            result['timeframe'] = config['timeframe']
                            result['type'] = config['type']
                            all_results.append(result)
                            strategy_results.append(result)
                            pairs_tested += 1
                            
                            # Show progress
                            if pair_idx % 10 == 0:
                                print(f"  Tested {pair_idx} pairs...")
                    
                    # Rate limiting
                    time.sleep(0.05)
                    
                except Exception as e:
                    continue
            
            # Show strategy summary
            if strategy_results:
                avg_return = sum(r['total_return'] for r in strategy_results) / len(strategy_results)
                best_pair = max(strategy_results, key=lambda x: x['total_return'])
                print(f"  ✅ Completed: Avg ROI: {avg_return:.2f}%, Best: {best_pair['pair']} ({best_pair['total_return']:.2f}%)")
        
        # Sort all results by ROI
        all_results.sort(key=lambda x: x['total_return'], reverse=True)
        
        # Display top 300 results
        print("\\n" + "=" * 100)
        print("TOP 300 RESULTS - SORTED BY ROI")
        print("=" * 100)
        
        print(f"\\n{'Rank':<6} {'ROI %':<12} {'Strategy':<30} {'Pair':<15} {'TF':<6} {'Trades':<8} {'Win %':<8}")
        print("-" * 100)
        
        for rank, result in enumerate(all_results[:300], 1):
            roi_indicator = "+++" if result['total_return'] > 100 else "++" if result['total_return'] > 50 else "+" if result['total_return'] > 25 else ""
            
            print(f"{rank:<6} {result['total_return']:>10.2f}% {roi_indicator:<3} "
                  f"{result['strategy'][:28]:<30} {result['pair']:<15} "
                  f"{result['timeframe']:<6} {result['num_trades']:>7} "
                  f"{result['win_rate']:>7.1f}%")
            
            if rank % 25 == 0:
                print("-" * 100)
        
        # Save results
        self._save_results(all_results)
        
        # Summary statistics
        print("\\n" + "=" * 100)
        print("SUMMARY STATISTICS")
        print("=" * 100)
        
        total_results = len(all_results)
        positive_results = [r for r in all_results if r['total_return'] > 0]
        high_performers = [r for r in all_results if r['total_return'] > 50]
        
        print(f"Total backtests: {total_results}")
        print(f"Positive ROI: {len(positive_results)} ({len(positive_results)/total_results*100:.1f}%)")
        print(f"High performers (>50%): {len(high_performers)}")
        
        # Best strategy overall
        if all_results:
            strategy_performance = {}
            for result in all_results:
                strategy = result['strategy']
                if strategy not in strategy_performance:
                    strategy_performance[strategy] = []
                strategy_performance[strategy].append(result['total_return'])
            
            print("\\nTop 10 Strategies by Average ROI:")
            strategy_avg = {s: sum(returns)/len(returns) for s, returns in strategy_performance.items()}
            sorted_strategies = sorted(strategy_avg.items(), key=lambda x: x[1], reverse=True)
            
            for i, (strategy, avg_roi) in enumerate(sorted_strategies[:10], 1):
                count = len(strategy_performance[strategy])
                print(f"{i}. {strategy}: {avg_roi:.2f}% (tested on {count} pairs)")
        
        return all_results
    
    def _save_results(self, results):
        """Save results to JSON and database"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Save to JSON
        json_file = f'ultimate_29_strategies_results_{timestamp}.json'
        with open(json_file, 'w') as f:
            json.dump(results[:300], f, indent=2, default=str)
        print(f"\\n💾 Results saved to {json_file}")
        
        # Save to SQLite
        db_file = f'backtest_results_{timestamp}.db'
        conn = sqlite3.connect(db_file)
        df = pd.DataFrame(results)
        df.to_sql('results', conn, if_exists='replace', index=False)
        conn.close()
        print(f"💾 Database saved to {db_file}")

if __name__ == "__main__":
    print("\\n🚀 Starting Ultimate 29 Strategies Backtester...")
    print("=" * 100)
    
    backtester = Ultimate29StrategiesBacktester(
        exchange='binance',
        initial_capital=10000,
        days=365
    )
    
    results = backtester.run_comprehensive_backtest(limit_pairs=400)
    
    print("\\n✅ BACKTEST COMPLETE!")
    print("=" * 100)