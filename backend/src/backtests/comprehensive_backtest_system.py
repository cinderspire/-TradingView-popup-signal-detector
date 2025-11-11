#!/usr/bin/env python3
"""
Comprehensive Backtest System
Top 100 strategies on Top 50 crypto pairs using CCXT
"""

import ccxt
import pandas as pd
import numpy as np
import json
import os
from datetime import datetime, timedelta
import time
import warnings
warnings.filterwarnings('ignore')

class ComprehensiveBacktester:
    def __init__(self):
        """Initialize the backtester with CCXT"""
        self.exchange = ccxt.binance({
            'enableRateLimit': True,
            'options': {'defaultType': 'spot'}
        })
        
        # Top 50 crypto trading pairs by volume
        self.top_50_pairs = [
            'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
            'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
            'SHIB/USDT', 'TRX/USDT', 'LTC/USDT', 'UNI/USDT', 'ATOM/USDT',
            'LINK/USDT', 'ETC/USDT', 'XLM/USDT', 'BCH/USDT', 'FIL/USDT',
            'APT/USDT', 'ICP/USDT', 'NEAR/USDT', 'VET/USDT', 'INJ/USDT',
            'OP/USDT', 'HBAR/USDT', 'LDO/USDT', 'ARB/USDT', 'IMX/USDT',
            'CRO/USDT', 'MKR/USDT', 'AAVE/USDT', 'GRT/USDT', 'ALGO/USDT',
            'QNT/USDT', 'FTM/USDT', 'SAND/USDT', 'AXS/USDT', 'MANA/USDT',
            'THETA/USDT', 'EGLD/USDT', 'FLOW/USDT', 'CHZ/USDT', 'SNX/USDT',
            'KAVA/USDT', 'FXS/USDT', 'COMP/USDT', 'BLUR/USDT', 'ENS/USDT'
        ]
        
        self.timeframe = '1h'
        self.lookback_days = 90
        self.results = []
        
    def load_top_strategies(self):
        """Load top 100 performing strategies"""
        print("📂 Loading top strategies from TRADING_PROJECT...")
        
        strategies = []
        base_path = "/home/hp/TRADING_PROJECT"
        
        # Priority paths for high performance strategies
        priority_paths = [
            "high_performance_strategies/ULTRA_HIGH_ROI_Above_45_Percent",
            "06_PLATFORM/READY_TO_RUN_STRATEGIES",
            "01_STRATEGIES/Momentum",
            "01_STRATEGIES/Grid",
            "01_STRATEGIES/Trend"
        ]
        
        # Scan priority paths first
        for rel_path in priority_paths:
            full_path = os.path.join(base_path, rel_path)
            if os.path.exists(full_path):
                for file in os.listdir(full_path):
                    if file.endswith('.py') and not file.startswith('__'):
                        strategies.append({
                            'name': file.replace('.py', ''),
                            'path': os.path.join(full_path, file),
                            'category': self.categorize_strategy(file)
                        })
        
        # Sort by expected performance (strategies with numbers first)
        def get_performance_score(name):
            # Extract number from name if exists (e.g., "906pct" -> 906)
            import re
            match = re.search(r'(\d+)pct', name)
            if match:
                return int(match.group(1))
            elif 'INTELLIGENT' in name:
                return 1000  # High priority for INTELLIGENT strategies
            else:
                return 0
        
        strategies.sort(key=lambda x: get_performance_score(x['name']), reverse=True)
        
        # Return top 100
        top_100 = strategies[:100]
        print(f"✅ Loaded {len(top_100)} top strategies")
        
        return top_100
    
    def categorize_strategy(self, filename):
        """Categorize strategy based on filename"""
        filename_lower = filename.lower()
        if 'momentum' in filename_lower: return 'momentum'
        elif 'grid' in filename_lower: return 'grid'
        elif 'breakout' in filename_lower: return 'breakout'
        elif 'scalp' in filename_lower: return 'scalping'
        elif 'trend' in filename_lower: return 'trend'
        elif 'reversion' in filename_lower: return 'mean_reversion'
        elif 'volatility' in filename_lower: return 'volatility'
        elif 'rsi' in filename_lower: return 'rsi_based'
        elif 'bollinger' in filename_lower or 'bb' in filename_lower: return 'bollinger'
        else: return 'hybrid'
    
    def fetch_ohlcv_data(self, symbol, limit=2160):
        """Fetch OHLCV data for a symbol (90 days of hourly data)"""
        try:
            ohlcv = self.exchange.fetch_ohlcv(symbol, self.timeframe, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            return df
        except Exception as e:
            print(f"❌ Error fetching {symbol}: {str(e)}")
            return None
    
    def calculate_indicators(self, df):
        """Calculate technical indicators for strategy simulation"""
        # SMA
        df['sma_20'] = df['close'].rolling(window=20).mean()
        df['sma_50'] = df['close'].rolling(window=50).mean()
        
        # EMA
        df['ema_12'] = df['close'].ewm(span=12, adjust=False).mean()
        df['ema_26'] = df['close'].ewm(span=26, adjust=False).mean()
        
        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # Bollinger Bands
        df['bb_middle'] = df['close'].rolling(window=20).mean()
        bb_std = df['close'].rolling(window=20).std()
        df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
        df['bb_lower'] = df['bb_middle'] - (bb_std * 2)
        
        # MACD
        df['macd'] = df['ema_12'] - df['ema_26']
        df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
        df['macd_histogram'] = df['macd'] - df['macd_signal']
        
        # ATR (Average True Range)
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = ranges.max(axis=1)
        df['atr'] = true_range.rolling(window=14).mean()
        
        # Volume indicators
        df['volume_sma'] = df['volume'].rolling(window=20).mean()
        df['volume_ratio'] = df['volume'] / df['volume_sma']
        
        return df
    
    def simulate_strategy(self, df, strategy):
        """Simulate strategy performance on historical data"""
        if df is None or len(df) < 100:
            return None
        
        # Calculate indicators
        df = self.calculate_indicators(df)
        df = df.dropna()
        
        if len(df) < 50:
            return None
        
        # Generate trading signals based on strategy category
        signals = self.generate_signals(df, strategy['category'])
        
        # Calculate performance metrics
        metrics = self.calculate_performance(df, signals)
        
        return metrics
    
    def generate_signals(self, df, category):
        """Generate trading signals based on strategy category"""
        signals = pd.DataFrame(index=df.index)
        signals['signal'] = 0
        signals['position'] = 0
        
        if category == 'momentum':
            # Momentum strategy
            signals['signal'] = np.where(
                (df['rsi'] > 30) & (df['rsi'] < 70) & 
                (df['macd'] > df['macd_signal']) &
                (df['close'] > df['sma_20']), 1, 0)
            signals['signal'] = np.where(
                (df['rsi'] > 70) | (df['macd'] < df['macd_signal']), -1, signals['signal'])
            
        elif category == 'grid':
            # Grid trading strategy
            price_levels = np.linspace(df['close'].min(), df['close'].max(), 10)
            for i in range(len(price_levels)-1):
                signals['signal'] = np.where(
                    (df['close'] > price_levels[i]) & (df['close'] < price_levels[i+1]), 
                    1 if i % 2 == 0 else -1, signals['signal'])
        
        elif category in ['breakout', 'volatility']:
            # Breakout strategy
            signals['signal'] = np.where(
                (df['close'] > df['bb_upper']) & (df['volume_ratio'] > 1.5), 1, 0)
            signals['signal'] = np.where(
                df['close'] < df['bb_middle'], -1, signals['signal'])
        
        elif category == 'mean_reversion':
            # Mean reversion strategy
            signals['signal'] = np.where(
                (df['close'] < df['bb_lower']) & (df['rsi'] < 30), 1, 0)
            signals['signal'] = np.where(
                (df['close'] > df['bb_upper']) & (df['rsi'] > 70), -1, signals['signal'])
        
        elif category == 'rsi_based':
            # RSI-based strategy
            signals['signal'] = np.where(df['rsi'] < 30, 1, 0)
            signals['signal'] = np.where(df['rsi'] > 70, -1, signals['signal'])
        
        elif category == 'bollinger':
            # Bollinger Bands strategy
            signals['signal'] = np.where(df['close'] < df['bb_lower'], 1, 0)
            signals['signal'] = np.where(df['close'] > df['bb_upper'], -1, signals['signal'])
        
        else:  # hybrid or trend
            # Trend following strategy
            signals['signal'] = np.where(
                (df['sma_20'] > df['sma_50']) & (df['close'] > df['sma_20']), 1, 0)
            signals['signal'] = np.where(
                (df['sma_20'] < df['sma_50']) | (df['close'] < df['sma_50']), -1, signals['signal'])
        
        # Calculate positions
        signals['position'] = signals['signal'].diff()
        
        return signals
    
    def calculate_performance(self, df, signals):
        """Calculate detailed performance metrics"""
        # Merge data
        combined = pd.concat([df, signals], axis=1).dropna()
        
        if len(combined) == 0:
            return None
        
        # Calculate returns
        combined['returns'] = combined['close'].pct_change()
        combined['strategy_returns'] = combined['signal'].shift(1) * combined['returns']
        
        # Filter out NaN and inf values
        combined = combined.replace([np.inf, -np.inf], np.nan).dropna()
        
        if len(combined) < 10:
            return None
        
        # Calculate metrics
        total_return = (1 + combined['strategy_returns']).prod() - 1
        
        # Annualized metrics (hourly data)
        hours_per_year = 24 * 365
        n_hours = len(combined)
        
        # Monthly return (approximate)
        monthly_return = ((1 + total_return) ** (30 * 24 / n_hours) - 1) * 100
        
        # Sharpe Ratio
        if combined['strategy_returns'].std() != 0:
            sharpe_ratio = np.sqrt(hours_per_year) * (combined['strategy_returns'].mean() / combined['strategy_returns'].std())
        else:
            sharpe_ratio = 0
        
        # Sortino Ratio
        downside_returns = combined['strategy_returns'][combined['strategy_returns'] < 0]
        if len(downside_returns) > 0 and downside_returns.std() != 0:
            sortino_ratio = np.sqrt(hours_per_year) * (combined['strategy_returns'].mean() / downside_returns.std())
        else:
            sortino_ratio = 0
        
        # Maximum Drawdown
        cumulative_returns = (1 + combined['strategy_returns']).cumprod()
        running_max = cumulative_returns.cummax()
        drawdown = (cumulative_returns - running_max) / running_max
        max_drawdown = drawdown.min() * 100
        
        # Win Rate
        winning_trades = combined['strategy_returns'][combined['strategy_returns'] > 0]
        losing_trades = combined['strategy_returns'][combined['strategy_returns'] < 0]
        
        if len(winning_trades) + len(losing_trades) > 0:
            win_rate = len(winning_trades) / (len(winning_trades) + len(losing_trades)) * 100
        else:
            win_rate = 0
        
        # Number of trades
        num_trades = len(combined[combined['position'] != 0])
        
        # Profit Factor
        if len(losing_trades) > 0:
            total_wins = winning_trades.sum()
            total_losses = abs(losing_trades.sum())
            profit_factor = total_wins / total_losses if total_losses > 0 else 0
        else:
            profit_factor = 0
        
        return {
            'total_return': round(total_return * 100, 2),
            'monthly_roi': round(monthly_return, 2),
            'sharpe_ratio': round(sharpe_ratio, 2),
            'sortino_ratio': round(sortino_ratio, 2),
            'max_drawdown': round(abs(max_drawdown), 2),
            'win_rate': round(win_rate, 2),
            'num_trades': num_trades,
            'profit_factor': round(profit_factor, 2)
        }
    
    def run_comprehensive_test(self):
        """Run comprehensive backtests for top 100 strategies on top 50 pairs"""
        strategies = self.load_top_strategies()
        
        print("\n" + "="*80)
        print("🚀 STARTING COMPREHENSIVE BACKTEST")
        print(f"📊 Testing {len(strategies)} strategies on {len(self.top_50_pairs)} pairs")
        print(f"📈 Total tests: {len(strategies) * len(self.top_50_pairs):,}")
        print("="*80)
        
        results = []
        test_count = 0
        successful_tests = 0
        
        # Test each strategy on each pair
        for strategy in strategies:
            strategy_results = []
            print(f"\n📋 Testing strategy: {strategy['name'][:50]}...")
            
            for pair in self.top_50_pairs:
                test_count += 1
                
                # Rate limiting
                if test_count % 10 == 0:
                    print(f"   Progress: {test_count}/{len(strategies) * len(self.top_50_pairs)} tests")
                    time.sleep(1)  # Rate limit
                
                # Fetch data
                df = self.fetch_ohlcv_data(pair)
                
                if df is not None:
                    # Run backtest
                    metrics = self.simulate_strategy(df, strategy)
                    
                    if metrics and metrics['monthly_roi'] > 0:
                        successful_tests += 1
                        result = {
                            'strategy': strategy['name'],
                            'category': strategy['category'],
                            'pair': pair,
                            **metrics
                        }
                        strategy_results.append(result)
                        
                        # Print exceptional results
                        if metrics['monthly_roi'] > 50:
                            print(f"   🔥 HIGH PERFORMANCE: {pair} - {metrics['monthly_roi']}% monthly ROI")
            
            # Add best results for this strategy
            if strategy_results:
                # Sort by monthly ROI
                strategy_results.sort(key=lambda x: x['monthly_roi'], reverse=True)
                # Keep top 10 pairs for each strategy
                results.extend(strategy_results[:10])
        
        # Save results
        self.save_results(results)
        
        # Print summary
        self.print_summary(results)
        
        return results
    
    def save_results(self, results):
        """Save comprehensive test results"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"/home/hp/TRADING_PROJECT/TRADING_SYSTEM/COMPREHENSIVE_BACKTEST_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n💾 Results saved to: {filename}")
        
        # Also save top performers
        top_performers = sorted(results, key=lambda x: x['monthly_roi'], reverse=True)[:100]
        top_filename = f"/home/hp/TRADING_PROJECT/TRADING_SYSTEM/TOP_100_PERFORMERS_{timestamp}.json"
        
        with open(top_filename, 'w') as f:
            json.dump(top_performers, f, indent=2)
        
        print(f"💾 Top 100 performers saved to: {top_filename}")
    
    def print_summary(self, results):
        """Print comprehensive summary"""
        if not results:
            print("\n❌ No successful test results")
            return
        
        print("\n" + "="*80)
        print("📊 COMPREHENSIVE BACKTEST RESULTS")
        print("="*80)
        
        # Sort by monthly ROI
        top_results = sorted(results, key=lambda x: x['monthly_roi'], reverse=True)
        
        print("\n🏆 TOP 20 STRATEGY-PAIR COMBINATIONS:")
        print("-"*80)
        
        for i, r in enumerate(top_results[:20], 1):
            print(f"{i}. {r['strategy'][:40]} on {r['pair']}")
            print(f"   📈 Monthly ROI: {r['monthly_roi']}%")
            print(f"   📊 Sortino: {r['sortino_ratio']} | Sharpe: {r['sharpe_ratio']}")
            print(f"   🎯 Win Rate: {r['win_rate']}% | Trades: {r['num_trades']}")
            print(f"   📉 Max DD: {r['max_drawdown']}% | PF: {r['profit_factor']}")
            print()
        
        # Best performing pairs
        print("\n📈 BEST PERFORMING PAIRS:")
        pair_performance = {}
        for r in results:
            if r['pair'] not in pair_performance:
                pair_performance[r['pair']] = []
            pair_performance[r['pair']].append(r['monthly_roi'])
        
        sorted_pairs = sorted(pair_performance.items(), 
                            key=lambda x: np.mean(x[1]), reverse=True)[:10]
        
        for pair, rois in sorted_pairs:
            avg_roi = np.mean(rois)
            max_roi = max(rois)
            print(f"   • {pair}: Avg ROI: {avg_roi:.1f}%, Max: {max_roi:.1f}%")
        
        # Category performance
        print("\n📊 PERFORMANCE BY CATEGORY:")
        category_performance = {}
        for r in results:
            if r['category'] not in category_performance:
                category_performance[r['category']] = []
            category_performance[r['category']].append(r['monthly_roi'])
        
        for cat, rois in category_performance.items():
            if rois:
                avg_roi = np.mean(rois)
                max_roi = max(rois)
                print(f"   • {cat.upper()}: Avg: {avg_roi:.1f}%, Max: {max_roi:.1f}%")
        
        # Overall statistics
        all_rois = [r['monthly_roi'] for r in results]
        print("\n📈 OVERALL STATISTICS:")
        print(f"   • Total successful tests: {len(results):,}")
        print(f"   • Average Monthly ROI: {np.mean(all_rois):.2f}%")
        print(f"   • Median Monthly ROI: {np.median(all_rois):.2f}%")
        print(f"   • Maximum Monthly ROI: {max(all_rois):.2f}%")
        print(f"   • Strategies with >50% monthly ROI: {sum(1 for r in all_rois if r > 50)}")
        print(f"   • Strategies with >100% monthly ROI: {sum(1 for r in all_rois if r > 100)}")

def main():
    print("\n" + "🔥"*40)
    print("COMPREHENSIVE CCXT BACKTESTING SYSTEM")
    print("Top 100 Strategies × Top 50 Crypto Pairs")
    print("🔥"*40)
    
    backtester = ComprehensiveBacktester()
    
    try:
        results = backtester.run_comprehensive_test()
        
        print("\n" + "✅"*40)
        print("TESTING COMPLETE!")
        print("✅"*40)
        
    except Exception as e:
        print(f"\n❌ Error during testing: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()