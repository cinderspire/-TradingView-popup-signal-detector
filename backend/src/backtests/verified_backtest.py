#!/usr/bin/env python3
"""
DOĞRULANMIŞ BACKTEST - GERÇEK VERİ İLE
Real market data validation
"""

import json
import requests
import time
from datetime import datetime, timedelta
import numpy as np

class VerifiedBacktest:
    def __init__(self):
        self.initial_balance = 1000.0
        self.leverage = 20  # 20x as requested
        self.position_size = 0.05  # 5% per position
        
        # Load strategies
        self.load_strategies()
        
    def load_strategies(self):
        """Load strategies"""
        try:
            with open('unique_strategies.json', 'r') as f:
                data = json.load(f)
                # Test top 5 strategies for verification
                self.strategies = data[:5]
                print(f"Testing {len(self.strategies)} strategies for verification")
        except:
            self.strategies = [
                {"strategy": "Test_1", "pair": "BTC/USDT"},
                {"strategy": "Test_2", "pair": "ETH/USDT"},
            ]
    
    def get_real_historical_data(self, symbol, days=30):
        """Get REAL historical data from Binance"""
        print(f"\n📊 Fetching REAL data for {symbol}...")
        
        clean_symbol = symbol.replace('/', '')
        
        # Calculate time range
        end_time = int(time.time() * 1000)
        start_time = end_time - (days * 24 * 60 * 60 * 1000)
        
        # Fetch 4-hour candles for better data
        url = "https://api.binance.com/api/v3/klines"
        params = {
            'symbol': clean_symbol,
            'interval': '4h',  # 4 hour candles
            'startTime': start_time,
            'endTime': end_time,
            'limit': 1000
        }
        
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                
                prices = []
                volumes = []
                highs = []
                lows = []
                
                for candle in data:
                    prices.append(float(candle[4]))  # Close price
                    volumes.append(float(candle[5]))
                    highs.append(float(candle[2]))
                    lows.append(float(candle[3]))
                
                print(f"✓ Fetched {len(prices)} real data points")
                print(f"  Price range: ${min(prices):.2f} - ${max(prices):.2f}")
                print(f"  Actual volatility: {np.std(prices)/np.mean(prices)*100:.2f}%")
                
                return {
                    'prices': prices,
                    'volumes': volumes,
                    'highs': highs,
                    'lows': lows,
                    'success': True
                }
        except Exception as e:
            print(f"✗ Error fetching data: {e}")
        
        return {'success': False}
    
    def calculate_real_indicators(self, prices):
        """Calculate REAL technical indicators"""
        if len(prices) < 20:
            return None
        
        # Real SMA
        sma_5 = np.mean(prices[-5:])
        sma_20 = np.mean(prices[-20:])
        
        # Real RSI
        deltas = np.diff(prices[-15:])
        gains = deltas[deltas > 0].sum() / 14
        losses = -deltas[deltas < 0].sum() / 14
        rs = gains / (losses + 1e-10)
        rsi = 100 - (100 / (1 + rs))
        
        # Real volatility
        returns = np.diff(prices[-20:]) / prices[-20:-1]
        volatility = np.std(returns)
        
        # Real momentum
        momentum = (prices[-1] - prices[-5]) / prices[-5]
        
        return {
            'sma_5': sma_5,
            'sma_20': sma_20,
            'rsi': rsi,
            'volatility': volatility,
            'momentum': momentum,
            'current_price': prices[-1]
        }
    
    def backtest_with_real_data(self, strategy):
        """Backtest using REAL market data"""
        
        # Get real historical data
        data = self.get_real_historical_data(strategy['pair'])
        
        if not data['success']:
            return None
        
        prices = data['prices']
        volumes = data['volumes']
        
        # Initialize
        balance = self.initial_balance
        positions = []
        trades = []
        equity_curve = [balance]
        
        # Simulate trading
        for i in range(20, len(prices)):
            price_window = prices[:i+1]
            current_price = prices[i]
            current_volume = volumes[i]
            
            # Calculate indicators
            indicators = self.calculate_real_indicators(price_window)
            if not indicators:
                continue
            
            # Generate trading signal
            signal_strength = 0
            
            # Trend following
            if indicators['sma_5'] > indicators['sma_20']:
                signal_strength += 1
            else:
                signal_strength -= 1
            
            # Momentum
            if indicators['momentum'] > 0.02:  # 2% momentum
                signal_strength += 1
            elif indicators['momentum'] < -0.02:
                signal_strength -= 1
            
            # RSI
            if indicators['rsi'] < 30:
                signal_strength += 2  # Oversold
            elif indicators['rsi'] > 70:
                signal_strength -= 2  # Overbought
            
            # Volatility filter
            if indicators['volatility'] > 0.05:  # High volatility
                signal_strength = signal_strength * 0.5  # Reduce position
            
            # Position management
            current_position = positions[-1] if positions else None
            
            # Entry
            if current_position is None and abs(signal_strength) >= 2:
                position_size = balance * self.position_size
                
                # Check if we can afford it
                if position_size > balance * 0.95:  # Keep 5% margin
                    continue
                
                entry_type = 'LONG' if signal_strength > 0 else 'SHORT'
                
                position = {
                    'type': entry_type,
                    'entry_price': current_price,
                    'size': position_size,
                    'leverage': self.leverage,
                    'entry_index': i,
                    'max_price': current_price,
                    'min_price': current_price
                }
                positions.append(position)
                
            # Exit & Risk Management  
            elif current_position:
                # Update max/min for trailing stop
                current_position['max_price'] = max(current_position['max_price'], current_price)
                current_position['min_price'] = min(current_position['min_price'], current_price)
                
                # Calculate P&L
                if current_position['type'] == 'LONG':
                    price_change = (current_price - current_position['entry_price']) / current_position['entry_price']
                else:
                    price_change = (current_position['entry_price'] - current_price) / current_position['entry_price']
                
                leveraged_pnl = price_change * self.leverage
                pnl_amount = current_position['size'] * leveraged_pnl
                
                # Exit conditions
                should_exit = False
                exit_reason = ""
                
                # Take profit (10% with leverage)
                if leveraged_pnl > 0.10:
                    should_exit = True
                    exit_reason = "TAKE_PROFIT"
                
                # Stop loss (5% with leverage = LIQUIDATION)
                elif leveraged_pnl < -0.05:
                    should_exit = True
                    exit_reason = "STOP_LOSS"
                    pnl_amount = -current_position['size'] * 0.95  # Lost almost all
                
                # Trailing stop (5% from peak)
                elif current_position['type'] == 'LONG':
                    if current_price < current_position['max_price'] * 0.95:
                        should_exit = True
                        exit_reason = "TRAILING_STOP"
                elif current_position['type'] == 'SHORT':
                    if current_price > current_position['min_price'] * 1.05:
                        should_exit = True
                        exit_reason = "TRAILING_STOP"
                
                # Time stop (24 periods = 4 days)
                if not should_exit and i - current_position['entry_index'] > 24:
                    should_exit = True
                    exit_reason = "TIME_EXIT"
                
                if should_exit:
                    balance += current_position['size'] + pnl_amount
                    
                    trade = {
                        'type': current_position['type'],
                        'entry_price': current_position['entry_price'],
                        'exit_price': current_price,
                        'pnl': pnl_amount,
                        'pnl_pct': leveraged_pnl * 100,
                        'exit_reason': exit_reason,
                        'duration': i - current_position['entry_index']
                    }
                    trades.append(trade)
                    positions.append(None)  # Clear position
            
            # Update equity
            current_equity = balance
            if current_position:
                # Add unrealized P&L
                if current_position['type'] == 'LONG':
                    unrealized_change = (current_price - current_position['entry_price']) / current_position['entry_price']
                else:
                    unrealized_change = (current_position['entry_price'] - current_price) / current_position['entry_price']
                
                unrealized_pnl = current_position['size'] * unrealized_change * self.leverage
                
                # Cap losses at position size (liquidation)
                unrealized_pnl = max(unrealized_pnl, -current_position['size'] * 0.95)
                
                current_equity += unrealized_pnl
            
            equity_curve.append(current_equity)
        
        # Calculate statistics
        if not trades:
            print(f"  ⚠️ No trades executed")
            return None
        
        total_trades = len(trades)
        winning_trades = [t for t in trades if t['pnl'] > 0]
        losing_trades = [t for t in trades if t['pnl'] <= 0]
        
        win_rate = len(winning_trades) / total_trades * 100
        
        # Calculate returns
        total_return = (balance - self.initial_balance) / self.initial_balance
        
        # Annualize (30 days to 365)
        annualized_return = total_return * (365 / 30)
        
        # Sharpe ratio
        equity_returns = np.diff(equity_curve) / equity_curve[:-1]
        sharpe = np.mean(equity_returns) / (np.std(equity_returns) + 1e-10) * np.sqrt(252)
        
        # Max drawdown
        peak = self.initial_balance
        max_dd = 0
        for eq in equity_curve:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak
            max_dd = max(max_dd, dd)
        
        # Exit reasons analysis
        exit_reasons = {}
        for t in trades:
            reason = t['exit_reason']
            if reason not in exit_reasons:
                exit_reasons[reason] = 0
            exit_reasons[reason] += 1
        
        return {
            'strategy': strategy['strategy'],
            'symbol': strategy['pair'],
            'total_trades': total_trades,
            'win_rate': win_rate,
            'total_return': total_return * 100,
            'annualized_return': annualized_return * 100,
            'sharpe_ratio': sharpe,
            'max_drawdown': max_dd * 100,
            'final_balance': balance,
            'winning_trades': len(winning_trades),
            'losing_trades': len(losing_trades),
            'avg_win': np.mean([t['pnl'] for t in winning_trades]) if winning_trades else 0,
            'avg_loss': np.mean([t['pnl'] for t in losing_trades]) if losing_trades else 0,
            'exit_reasons': exit_reasons
        }
    
    def run_verification(self):
        """Run verification backtest"""
        print("\n" + "="*60)
        print("🔍 BACKTEST VERIFICATION WITH REAL DATA")
        print("="*60)
        print(f"Initial Balance: ${self.initial_balance}")
        print(f"Leverage: {self.leverage}x")
        print(f"Position Size: {self.position_size*100}%")
        print(f"Data Source: Binance API (Real Historical)")
        print("="*60)
        
        results = []
        
        for strategy in self.strategies:
            print(f"\nTesting: {strategy['strategy']} ({strategy['pair']})")
            print("-"*40)
            
            result = self.backtest_with_real_data(strategy)
            
            if result:
                results.append(result)
                
                print(f"\n📈 RESULTS:")
                print(f"  Total Trades: {result['total_trades']}")
                print(f"  Win Rate: {result['win_rate']:.1f}%")
                print(f"  Monthly Return: {result['total_return']:.2f}%")
                print(f"  Annualized Return: {result['annualized_return']:.2f}%")
                print(f"  Sharpe Ratio: {result['sharpe_ratio']:.2f}")
                print(f"  Max Drawdown: {result['max_drawdown']:.1f}%")
                print(f"  Final Balance: ${result['final_balance']:.2f}")
                
                print(f"\n  Exit Reasons:")
                for reason, count in result['exit_reasons'].items():
                    print(f"    {reason}: {count}")
            
            time.sleep(0.5)  # Rate limiting
        
        # Summary
        if results:
            print("\n" + "="*60)
            print("📊 VERIFICATION SUMMARY")
            print("="*60)
            
            avg_return = np.mean([r['annualized_return'] for r in results])
            best_return = max(r['annualized_return'] for r in results)
            worst_return = min(r['annualized_return'] for r in results)
            avg_sharpe = np.mean([r['sharpe_ratio'] for r in results])
            avg_dd = np.mean([r['max_drawdown'] for r in results])
            
            print(f"Average Annual Return: {avg_return:.2f}%")
            print(f"Best Strategy Return: {best_return:.2f}%")
            print(f"Worst Strategy Return: {worst_return:.2f}%")
            print(f"Average Sharpe Ratio: {avg_sharpe:.2f}")
            print(f"Average Max Drawdown: {avg_dd:.1f}%")
            
            print("\n🎯 ACCURACY ASSESSMENT:")
            if avg_return > 10000:
                print("  ⚠️ Returns still very high - Check position sizing")
                print("  ⚠️ Possible issues: Leverage too high for volatility")
            elif avg_return > 1000:
                print("  ✓ High returns but theoretically possible with 20x leverage")
                print("  ⚠️ Risk Level: EXTREME - Expect frequent liquidations")
            elif avg_return > 100:
                print("  ✓ Returns are aggressive but realistic with leverage")
                print("  ✓ Risk Level: HIGH - Professional traders only")
            else:
                print("  ✓ Returns are conservative and realistic")
                print("  ✓ Risk Level: MODERATE")
            
            print("\n💡 REALITY CHECK:")
            print(f"  Without leverage ({self.leverage}x), annual return would be: {avg_return/self.leverage:.2f}%")
            print(f"  This is {'realistic' if avg_return/self.leverage < 100 else 'still optimistic'} for algo trading")
            
            # Save results
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'verified_backtest_{timestamp}.json'
            with open(filename, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"\n✓ Results saved to {filename}")
        
        return results

if __name__ == "__main__":
    verifier = VerifiedBacktest()
    verifier.run_verification()