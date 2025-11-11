#!/usr/bin/env python3
"""
Advanced Paper Trading Simulator with Real-Time Tracking
Simulates top 200 performing strategies with comprehensive monitoring
"""

import json
import time
import random
import numpy as np
from datetime import datetime, timedelta
import threading
from collections import defaultdict
import os

class AdvancedPaperTradingSimulator:
    def __init__(self, initial_balance=10000, save_interval=10):
        self.initial_balance = initial_balance
        self.balance = initial_balance
        self.save_interval = save_interval
        
        # Trading data structures
        self.positions = {}  # Current open positions
        self.closed_trades = []  # Historical trades
        self.strategy_performance = defaultdict(lambda: {
            'trades': 0, 'wins': 0, 'losses': 0, 
            'total_pnl': 0, 'best_trade': 0, 'worst_trade': 0,
            'current_position': None, 'win_rate': 0, 'avg_pnl': 0
        })
        
        # Performance metrics
        self.equity_curve = [(datetime.now(), initial_balance)]
        self.drawdown_curve = []
        self.peak_balance = initial_balance
        self.max_drawdown = 0
        self.current_drawdown = 0
        
        # Trading statistics
        self.total_trades = 0
        self.winning_trades = 0
        self.losing_trades = 0
        self.consecutive_wins = 0
        self.consecutive_losses = 0
        self.max_consecutive_wins = 0
        self.max_consecutive_losses = 0
        
        # Time tracking
        self.start_time = datetime.now()
        self.last_save_time = datetime.now()
        
    def load_top_200_strategies(self):
        """Load top 200 strategies from backtest results"""
        strategies = []
        
        try:
            # Load from TOP_400 file and take top 200
            with open('TOP_400_PLATFORM_STRATEGIES_20250826_153653.json', 'r') as f:
                data = json.load(f)
                strategies = data['strategies'][:200]
                print(f"✅ Loaded {len(strategies)} strategies from backtest results")
        except:
            print("⚠️ Could not load backtest file, using generated strategies")
            # Generate fallback strategies
            strategies = self.generate_fallback_strategies()
        
        return strategies
    
    def generate_fallback_strategies(self):
        """Generate fallback strategies if file not found"""
        strategies = []
        
        # Known high performers
        high_performers = [
            ("889pct_XRPUSDT_adaptive_grid_OPT", "DOGE/USDT", 362.46, "grid"),
            ("790pct_XRPUSDT_adaptive_grid_OPT", "SHIB/USDT", 358.33, "grid"),
            ("889pct_XRPUSDT_adaptive_grid_OPT", "IMX/USDT", 356.16, "grid"),
            ("809pct_XRPUSDT_adaptive_grid_OPT", "DOGE/USDT", 352.86, "grid"),
            ("889pct_XRPUSDT_adaptive_grid_OPT", "OP/USDT", 348.11, "grid"),
            ("889pct_XRPUSDT_adaptive_grid_OPT", "SOL/USDT", 347.22, "grid"),
            ("889pct_XRPUSDT_adaptive_grid_OPT", "SHIB/USDT", 344.12, "grid"),
            ("809pct_XRPUSDT_adaptive_grid_OPT", "MANA/USDT", 337.71, "grid"),
            ("889pct_XRPUSDT_adaptive_grid_OPT", "AAVE/USDT", 335.38, "grid"),
            ("809pct_XRPUSDT_adaptive_grid_OPT", "SHIB/USDT", 333.58, "grid")
        ]
        
        for name, pair, roi, category in high_performers:
            strategies.append({
                'strategy': name,
                'pair': pair,
                'monthly_roi': roi,
                'category': category,
                'sortino_ratio': roi / 18,
                'win_rate': min(40 + roi / 8, 85),
                'num_trades': random.randint(300, 1500)
            })
        
        # Add more to reach 200
        pairs = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT"]
        categories = ["momentum", "scalping", "trend", "breakout", "grid"]
        
        for i in range(len(strategies), 200):
            strategies.append({
                'strategy': f"strategy_{i}_optimized",
                'pair': random.choice(pairs),
                'monthly_roi': random.uniform(30, 250),
                'category': random.choice(categories),
                'sortino_ratio': random.uniform(2, 15),
                'win_rate': random.uniform(45, 85),
                'num_trades': random.randint(100, 1000)
            })
        
        return sorted(strategies, key=lambda x: x['monthly_roi'], reverse=True)[:200]
    
    def calculate_position_size(self, strategy, risk_percent=2):
        """Calculate position size based on Kelly Criterion and risk management"""
        # Kelly Criterion: f = (p*b - q) / b
        # where p = win probability, q = loss probability, b = win/loss ratio
        
        win_rate = strategy.get('win_rate', 50) / 100
        loss_rate = 1 - win_rate
        win_loss_ratio = 1.5  # Average win is 1.5x average loss
        
        # Kelly fraction
        kelly_fraction = (win_rate * win_loss_ratio - loss_rate) / win_loss_ratio
        kelly_fraction = max(0, min(kelly_fraction, 0.25))  # Cap at 25%
        
        # Risk-adjusted position size
        max_risk = self.balance * (risk_percent / 100)
        position_size = min(
            self.balance * kelly_fraction,
            max_risk,
            self.balance * 0.1  # Max 10% per trade
        )
        
        return max(10, position_size)  # Minimum $10
    
    def simulate_price_movement(self, pair, timeframe_minutes=15):
        """Simulate realistic price movement with volatility"""
        base_prices = {
            "BTC/USDT": 65000, "ETH/USDT": 3200, "BNB/USDT": 580,
            "SOL/USDT": 145, "XRP/USDT": 0.62, "ADA/USDT": 0.58,
            "DOGE/USDT": 0.15, "SHIB/USDT": 0.000024, "AVAX/USDT": 35,
            "MANA/USDT": 8.5, "IMX/USDT": 2.1, "OP/USDT": 3.8,
            "AAVE/USDT": 95, "ARB/USDT": 1.2
        }
        
        base_price = base_prices.get(pair, 100)
        
        # Add realistic volatility
        volatility = {
            "SHIB/USDT": 0.04, "DOGE/USDT": 0.035, "SOL/USDT": 0.03,
            "IMX/USDT": 0.032, "MANA/USDT": 0.031, "BTC/USDT": 0.015,
            "ETH/USDT": 0.02, "BNB/USDT": 0.018
        }.get(pair, 0.025)
        
        # Simulate price with trend and noise
        trend = np.random.uniform(-0.001, 0.002)  # Slight trend
        noise = np.random.normal(0, volatility)
        
        return base_price * (1 + trend + noise)
    
    def execute_trade(self, strategy_data, trade_id):
        """Execute a single trade with realistic simulation"""
        strategy_name = f"{strategy_data['strategy']}_{strategy_data['pair']}"
        current_price = self.simulate_price_movement(strategy_data['pair'])
        position_size = self.calculate_position_size(strategy_data)
        
        if position_size < 10 or self.balance < position_size:
            return None
        
        # Determine trade outcome based on strategy performance
        base_win_rate = strategy_data.get('win_rate', 50) / 100
        
        # Adjust win rate based on market conditions and recent performance
        recent_perf = self.strategy_performance[strategy_name]
        if recent_perf['trades'] > 0:
            recent_win_rate = recent_perf['wins'] / recent_perf['trades']
            # Mean reversion: if winning too much, reduce win rate slightly
            win_rate_adjustment = (0.5 - recent_win_rate) * 0.1
        else:
            win_rate_adjustment = 0
        
        adjusted_win_rate = max(0.3, min(0.85, base_win_rate + win_rate_adjustment))
        is_winner = random.random() < adjusted_win_rate
        
        # Calculate P&L based on strategy ROI
        monthly_roi = strategy_data.get('monthly_roi', 50)
        daily_roi = monthly_roi / 30
        trade_roi = daily_roi / 10  # Assuming 10 trades per day
        
        if is_winner:
            # Winner: use strategy's expected return with variance
            profit_multiplier = (trade_roi / 100) * np.random.uniform(0.8, 1.5)
            pnl = position_size * profit_multiplier
            exit_price = current_price * (1 + profit_multiplier)
        else:
            # Loser: controlled loss with stop loss
            loss_multiplier = np.random.uniform(0.005, 0.02)  # 0.5% to 2% loss
            pnl = -position_size * loss_multiplier
            exit_price = current_price * (1 - loss_multiplier)
        
        # Update balance
        self.balance += pnl
        self.total_trades += 1
        
        # Update consecutive wins/losses
        if is_winner:
            self.winning_trades += 1
            self.consecutive_wins += 1
            self.consecutive_losses = 0
            self.max_consecutive_wins = max(self.max_consecutive_wins, self.consecutive_wins)
        else:
            self.losing_trades += 1
            self.consecutive_losses += 1
            self.consecutive_wins = 0
            self.max_consecutive_losses = max(self.max_consecutive_losses, self.consecutive_losses)
        
        # Create trade record
        trade = {
            'id': trade_id,
            'timestamp': datetime.now().isoformat(),
            'strategy': strategy_data['strategy'],
            'pair': strategy_data['pair'],
            'category': strategy_data.get('category', 'unknown'),
            'entry_price': current_price,
            'exit_price': exit_price,
            'position_size': round(position_size, 2),
            'pnl': round(pnl, 2),
            'pnl_percent': round((pnl / position_size) * 100, 2),
            'balance_after': round(self.balance, 2),
            'is_winner': is_winner
        }
        
        # Update strategy performance
        self.update_strategy_performance(strategy_name, trade)
        
        # Add to closed trades
        self.closed_trades.append(trade)
        
        # Update equity curve
        self.equity_curve.append((datetime.now(), self.balance))
        
        # Update drawdown
        self.update_drawdown()
        
        return trade
    
    def update_strategy_performance(self, strategy_name, trade):
        """Update individual strategy performance metrics"""
        perf = self.strategy_performance[strategy_name]
        
        perf['trades'] += 1
        perf['total_pnl'] += trade['pnl']
        
        if trade['is_winner']:
            perf['wins'] += 1
        else:
            perf['losses'] += 1
        
        perf['best_trade'] = max(perf['best_trade'], trade['pnl'])
        perf['worst_trade'] = min(perf['worst_trade'], trade['pnl'])
        perf['win_rate'] = (perf['wins'] / perf['trades']) * 100 if perf['trades'] > 0 else 0
        perf['avg_pnl'] = perf['total_pnl'] / perf['trades'] if perf['trades'] > 0 else 0
    
    def update_drawdown(self):
        """Update drawdown metrics"""
        if self.balance > self.peak_balance:
            self.peak_balance = self.balance
            self.current_drawdown = 0
        else:
            self.current_drawdown = ((self.peak_balance - self.balance) / self.peak_balance) * 100
            self.max_drawdown = max(self.max_drawdown, self.current_drawdown)
        
        self.drawdown_curve.append((datetime.now(), self.current_drawdown))
    
    def get_top_performing_strategies(self, n=10):
        """Get top N performing strategies by P&L"""
        sorted_strategies = sorted(
            self.strategy_performance.items(),
            key=lambda x: x[1]['total_pnl'],
            reverse=True
        )
        return sorted_strategies[:n]
    
    def get_worst_performing_strategies(self, n=10):
        """Get worst N performing strategies by P&L"""
        sorted_strategies = sorted(
            self.strategy_performance.items(),
            key=lambda x: x[1]['total_pnl']
        )
        return sorted_strategies[:n]
    
    def calculate_metrics(self):
        """Calculate comprehensive trading metrics"""
        if self.total_trades == 0:
            return {}
        
        total_pnl = self.balance - self.initial_balance
        roi = (total_pnl / self.initial_balance) * 100
        win_rate = (self.winning_trades / self.total_trades) * 100 if self.total_trades > 0 else 0
        
        # Calculate Sharpe ratio (simplified)
        if len(self.equity_curve) > 1:
            returns = [(self.equity_curve[i][1] - self.equity_curve[i-1][1]) / self.equity_curve[i-1][1] 
                      for i in range(1, len(self.equity_curve))]
            if returns:
                avg_return = np.mean(returns)
                std_return = np.std(returns)
                sharpe_ratio = (avg_return / std_return) * np.sqrt(252) if std_return > 0 else 0
            else:
                sharpe_ratio = 0
        else:
            sharpe_ratio = 0
        
        # Calculate profit factor
        total_wins = sum(t['pnl'] for t in self.closed_trades if t['pnl'] > 0)
        total_losses = abs(sum(t['pnl'] for t in self.closed_trades if t['pnl'] < 0))
        profit_factor = total_wins / total_losses if total_losses > 0 else float('inf')
        
        # Average trade metrics
        avg_win = total_wins / self.winning_trades if self.winning_trades > 0 else 0
        avg_loss = total_losses / self.losing_trades if self.losing_trades > 0 else 0
        
        return {
            'total_pnl': round(total_pnl, 2),
            'roi': round(roi, 2),
            'balance': round(self.balance, 2),
            'total_trades': self.total_trades,
            'winning_trades': self.winning_trades,
            'losing_trades': self.losing_trades,
            'win_rate': round(win_rate, 2),
            'profit_factor': round(profit_factor, 2),
            'sharpe_ratio': round(sharpe_ratio, 2),
            'max_drawdown': round(self.max_drawdown, 2),
            'current_drawdown': round(self.current_drawdown, 2),
            'avg_win': round(avg_win, 2),
            'avg_loss': round(avg_loss, 2),
            'max_consecutive_wins': self.max_consecutive_wins,
            'max_consecutive_losses': self.max_consecutive_losses,
            'active_strategies': len([s for s in self.strategy_performance.values() if s['trades'] > 0])
        }
    
    def save_state(self, filename=None):
        """Save current trading state to file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"paper_trading_state_{timestamp}.json"
        
        state = {
            'timestamp': datetime.now().isoformat(),
            'metrics': self.calculate_metrics(),
            'equity_curve': [(t.isoformat(), b) for t, b in self.equity_curve[-100:]],
            'recent_trades': self.closed_trades[-50:],
            'top_strategies': [
                {
                    'name': name,
                    'performance': {
                        'trades': perf['trades'],
                        'wins': perf['wins'],
                        'total_pnl': round(perf['total_pnl'], 2),
                        'win_rate': round(perf['win_rate'], 2),
                        'avg_pnl': round(perf['avg_pnl'], 2),
                        'best_trade': round(perf['best_trade'], 2),
                        'worst_trade': round(perf['worst_trade'], 2)
                    }
                }
                for name, perf in self.get_top_performing_strategies(20)
            ],
            'worst_strategies': [
                {
                    'name': name,
                    'performance': {
                        'trades': perf['trades'],
                        'wins': perf['wins'],
                        'total_pnl': round(perf['total_pnl'], 2),
                        'win_rate': round(perf['win_rate'], 2)
                    }
                }
                for name, perf in self.get_worst_performing_strategies(10)
            ]
        }
        
        with open(filename, 'w') as f:
            json.dump(state, f, indent=2)
        
        return filename
    
    def print_live_status(self):
        """Print live trading status"""
        metrics = self.calculate_metrics()
        
        # Clear screen for clean display
        os.system('clear' if os.name == 'posix' else 'cls')
        
        print("\n" + "="*80)
        print("📊 LIVE PAPER TRADING DASHBOARD - TOP 200 STRATEGIES")
        print("="*80)
        
        # Account status
        print(f"\n💰 ACCOUNT STATUS:")
        print(f"   Balance:         ${metrics['balance']:,.2f}")
        print(f"   P&L:            ${metrics['total_pnl']:+,.2f}")
        print(f"   ROI:            {metrics['roi']:+.2f}%")
        print(f"   Drawdown:       {metrics['current_drawdown']:.2f}% (Max: {metrics['max_drawdown']:.2f}%)")
        
        # Trading statistics
        print(f"\n📈 TRADING STATISTICS:")
        print(f"   Total Trades:    {metrics['total_trades']}")
        print(f"   Win Rate:        {metrics['win_rate']:.2f}%")
        print(f"   Profit Factor:   {metrics['profit_factor']:.2f}")
        print(f"   Sharpe Ratio:    {metrics['sharpe_ratio']:.2f}")
        print(f"   Active Strategies: {metrics['active_strategies']}/200")
        
        # Win/Loss stats
        print(f"\n🎯 WIN/LOSS ANALYSIS:")
        print(f"   Winning Trades:  {metrics['winning_trades']} (Avg: ${metrics['avg_win']:.2f})")
        print(f"   Losing Trades:   {metrics['losing_trades']} (Avg: ${metrics['avg_loss']:.2f})")
        print(f"   Max Consecutive Wins: {metrics['max_consecutive_wins']}")
        print(f"   Max Consecutive Losses: {metrics['max_consecutive_losses']}")
        
        # Top performers
        print(f"\n🏆 TOP 5 PERFORMING STRATEGIES:")
        for i, (name, perf) in enumerate(self.get_top_performing_strategies(5), 1):
            print(f"   {i}. {name[:40]:40} | P&L: ${perf['total_pnl']:+8.2f} | "
                  f"WR: {perf['win_rate']:5.1f}% | Trades: {perf['trades']:3}")
        
        # Recent trades
        if len(self.closed_trades) >= 5:
            print(f"\n📜 LAST 5 TRADES:")
            for trade in self.closed_trades[-5:]:
                symbol = "✅" if trade['is_winner'] else "❌"
                print(f"   {symbol} {trade['strategy'][:25]:25} on {trade['pair']:10} | "
                      f"P&L: ${trade['pnl']:+7.2f} ({trade['pnl_percent']:+5.2f}%)")
        
        # Time running
        runtime = datetime.now() - self.start_time
        print(f"\n⏱️  Runtime: {runtime.total_seconds()/60:.1f} minutes")
        print("="*80)
    
    def run_simulation(self, duration_hours=1, trades_per_minute=20):
        """Run the paper trading simulation"""
        print("\n" + "🚀"*40)
        print("STARTING ADVANCED PAPER TRADING SIMULATOR")
        print("Top 200 Performing Strategies")
        print("🚀"*40)
        
        # Load strategies
        strategies = self.load_top_200_strategies()
        print(f"\n📊 Loaded {len(strategies)} strategies for trading")
        print(f"💰 Initial Balance: ${self.initial_balance:,.2f}")
        print(f"⏱️  Duration: {duration_hours} hour(s)")
        print(f"📈 Trade Frequency: {trades_per_minute} trades/minute")
        
        end_time = datetime.now() + timedelta(hours=duration_hours)
        trade_id = 0
        last_print_time = datetime.now()
        
        print("\n" + "-"*80)
        print("Starting simulation... (Updates every 5 seconds)")
        print("-"*80)
        
        while datetime.now() < end_time and self.balance > 100:
            # Execute batch of trades
            for _ in range(trades_per_minute):
                if self.balance < 100:
                    break
                
                # Select random strategy weighted by performance
                strategy = random.choice(strategies[:50] * 3 + strategies[50:100] * 2 + strategies[100:])
                
                # Execute trade
                trade_id += 1
                trade = self.execute_trade(strategy, trade_id)
                
                # Print significant trades immediately
                if trade and abs(trade['pnl']) > 100:
                    symbol = "🔥" if trade['pnl'] > 200 else "✅" if trade['pnl'] > 0 else "❌"
                    print(f"{symbol} Big Trade: {trade['strategy'][:30]} | "
                          f"P&L: ${trade['pnl']:+.2f} | Balance: ${self.balance:,.2f}")
            
            # Print status every 5 seconds
            if (datetime.now() - last_print_time).seconds >= 5:
                self.print_live_status()
                last_print_time = datetime.now()
            
            # Save state periodically
            if (datetime.now() - self.last_save_time).seconds >= self.save_interval:
                self.save_state()
                self.last_save_time = datetime.now()
            
            # Sleep briefly to control pace
            time.sleep(60 / trades_per_minute)
        
        # Final report
        self.generate_final_report()
    
    def generate_final_report(self):
        """Generate comprehensive final report"""
        print("\n" + "="*80)
        print("📊 FINAL PAPER TRADING REPORT - TOP 200 STRATEGIES")
        print("="*80)
        
        metrics = self.calculate_metrics()
        
        # Summary
        print(f"\n💰 FINAL RESULTS:")
        print(f"   Initial Balance:  ${self.initial_balance:,.2f}")
        print(f"   Final Balance:    ${metrics['balance']:,.2f}")
        print(f"   Total P&L:        ${metrics['total_pnl']:+,.2f}")
        print(f"   ROI:             {metrics['roi']:+.2f}%")
        print(f"   Max Drawdown:     {metrics['max_drawdown']:.2f}%")
        
        # Performance
        print(f"\n📈 PERFORMANCE METRICS:")
        print(f"   Total Trades:     {metrics['total_trades']}")
        print(f"   Win Rate:         {metrics['win_rate']:.2f}%")
        print(f"   Profit Factor:    {metrics['profit_factor']:.2f}")
        print(f"   Sharpe Ratio:     {metrics['sharpe_ratio']:.2f}")
        print(f"   Avg Win:          ${metrics['avg_win']:.2f}")
        print(f"   Avg Loss:         ${metrics['avg_loss']:.2f}")
        
        # Top strategies
        print(f"\n🏆 TOP 10 PERFORMING STRATEGIES:")
        print("-"*80)
        for i, (name, perf) in enumerate(self.get_top_performing_strategies(10), 1):
            print(f"{i:2}. {name[:45]:45}")
            print(f"    P&L: ${perf['total_pnl']:+9.2f} | Trades: {perf['trades']:3} | "
                  f"Win Rate: {perf['win_rate']:5.1f}% | "
                  f"Best: ${perf['best_trade']:+7.2f} | Worst: ${perf['worst_trade']:+7.2f}")
        
        # Category performance
        category_performance = defaultdict(lambda: {'trades': 0, 'pnl': 0})
        for trade in self.closed_trades:
            cat = trade['category']
            category_performance[cat]['trades'] += 1
            category_performance[cat]['pnl'] += trade['pnl']
        
        print(f"\n📊 PERFORMANCE BY CATEGORY:")
        for cat, perf in sorted(category_performance.items(), key=lambda x: x[1]['pnl'], reverse=True):
            avg_pnl = perf['pnl'] / perf['trades'] if perf['trades'] > 0 else 0
            print(f"   {cat:15} | Total P&L: ${perf['pnl']:+9.2f} | "
                  f"Trades: {perf['trades']:4} | Avg: ${avg_pnl:+7.2f}")
        
        # Save final state
        final_file = self.save_state("paper_trading_final_report.json")
        print(f"\n💾 Final report saved to: {final_file}")
        
        # Save detailed CSV for analysis
        self.save_trades_csv()
        
        print("\n" + "="*80)
        print("✅ PAPER TRADING SIMULATION COMPLETE!")
        print("="*80)
    
    def save_trades_csv(self):
        """Save trades to CSV for detailed analysis"""
        import csv
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"paper_trading_trades_{timestamp}.csv"
        
        with open(filename, 'w', newline='') as f:
            if self.closed_trades:
                fieldnames = self.closed_trades[0].keys()
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(self.closed_trades)
        
        print(f"📁 Trade history saved to: {filename}")

def main():
    """Main execution"""
    simulator = AdvancedPaperTradingSimulator(
        initial_balance=10000,
        save_interval=30  # Save every 30 seconds
    )
    
    # Run simulation for 0.25 hours (15 minutes) for demo
    # You can increase this for longer testing
    simulator.run_simulation(
        duration_hours=0.25,  # 15 minutes
        trades_per_minute=20  # 20 trades per minute
    )

if __name__ == "__main__":
    main()