// Performance Analyzer - Calculate and analyze trading metrics

import { Helpers } from '../utils/helpers.js';
import settings from '../config/settings.js';

export class PerformanceAnalyzer {
  /**
   * Analyze backtest or trading results
   */
  static analyze(trades, equityCurve, initialCapital) {
    if (!trades || trades.length === 0) {
      return this.getEmptyMetrics();
    }

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    const totalProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const netProfit = trades.reduce((sum, t) => sum + t.pnl, 0);

    // Debug logging
    console.log(`📊 Performance Analysis:`);
    console.log(`   Trades: ${trades.length} (${wins.length} wins, ${losses.length} losses)`);
    console.log(`   Total Profit: $${totalProfit.toFixed(2)}`);
    console.log(`   Total Loss: $${totalLoss.toFixed(2)}`);
    console.log(`   Net Profit: $${netProfit.toFixed(2)}`);
    console.log(`   Initial Capital: $${initialCapital}`);
    console.log(`   ROI: ${((netProfit / initialCapital) * 100).toFixed(2)}%`);

    const returns = trades.map(t => t.pnlPercent / 100);
    const holdingTimes = trades.map(t => t.holdingTime);

    const metrics = {
      // Basic metrics
      totalTrades: trades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: Helpers.winRate(trades) * 100,

      // Profit metrics
      totalProfit: Helpers.round(totalProfit, 2),
      totalLoss: Helpers.round(totalLoss, 2),
      netProfit: Helpers.round(netProfit, 2),
      roi: Helpers.round((netProfit / initialCapital) * 100, 4), // 4 decimals for precision
      avgWin: wins.length > 0 ? Helpers.round(totalProfit / wins.length, 2) : 0,
      avgLoss: losses.length > 0 ? Helpers.round(totalLoss / losses.length, 2) : 0,

      // Risk metrics
      profitFactor: Helpers.round(Helpers.profitFactor(trades), 2),
      sharpeRatio: Helpers.round(Helpers.sharpeRatio(returns), 2),
      sortinoRatio: Helpers.round(Helpers.sortinoRatio(returns), 2),
      maxDrawdown: Helpers.round(Helpers.maxDrawdown(equityCurve) * 100, 2),

      // Timing metrics
      avgHoldingTime: this.formatHoldingTime(holdingTimes.reduce((a, b) => a + b, 0) / trades.length),
      minHoldingTime: this.formatHoldingTime(Math.min(...holdingTimes)),
      maxHoldingTime: this.formatHoldingTime(Math.max(...holdingTimes)),

      // Capital
      initialCapital,
      finalCapital: Helpers.round(equityCurve[equityCurve.length - 1], 2)
    };

    // Calculate strategy score
    metrics.strategyScore = this.calculateStrategyScore(metrics);
    metrics.healthStatus = this.getHealthStatus(metrics);

    return metrics;
  }

  /**
   * Calculate strategy quality score (0-100)
   */
  static calculateStrategyScore(metrics) {
    let score = 0;

    // Win rate (30 points)
    score += Math.min(metrics.winRate / 100, 1) * 30;

    // Profit Factor (20 points)
    score += Math.min(metrics.profitFactor / 3, 1) * 20;

    // Sharpe Ratio (20 points)
    score += Math.min(metrics.sharpeRatio / 2, 1) * 20;

    // Max Drawdown (15 points - lower is better)
    score += Math.max(0, (1 - metrics.maxDrawdown / 20)) * 15;

    // ROI (15 points)
    score += Math.min(Math.max(metrics.roi, 0) / 100, 1) * 15;

    return Helpers.round(score, 1);
  }

  /**
   * Get health status based on metrics
   */
  static getHealthStatus(metrics) {
    if (metrics.strategyScore >= 70 && metrics.maxDrawdown < settings.maxDrawdown * 100) {
      return 'excellent';
    } else if (metrics.strategyScore >= 50 && metrics.maxDrawdown < settings.maxDrawdown * 100 * 1.5) {
      return 'good';
    } else if (metrics.strategyScore >= 30) {
      return 'moderate';
    } else {
      return 'poor';
    }
  }

  /**
   * Format holding time to human readable
   */
  static formatHoldingTime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Get empty metrics
   */
  static getEmptyMetrics() {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      roi: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      avgHoldingTime: '0m',
      strategyScore: 0,
      healthStatus: 'no-data'
    };
  }

  /**
   * Compare multiple strategy results
   */
  static compareStrategies(results) {
    return results
      .map(r => ({
        strategy: r.strategy,
        pair: r.pair,
        metrics: this.analyze(r.trades, r.equityCurve, settings.initialCapital)
      }))
      .sort((a, b) => b.metrics.strategyScore - a.metrics.strategyScore);
  }

  /**
   * Generate strategy health report
   */
  static generateHealthReport(strategies) {
    const report = {
      total: strategies.length,
      excellent: strategies.filter(s => s.healthStatus === 'excellent').length,
      good: strategies.filter(s => s.healthStatus === 'good').length,
      moderate: strategies.filter(s => s.healthStatus === 'moderate').length,
      poor: strategies.filter(s => s.healthStatus === 'poor').length,
      avgScore: strategies.reduce((sum, s) => sum + s.strategyScore, 0) / strategies.length,
      avgDrawdown: strategies.reduce((sum, s) => sum + s.maxDrawdown, 0) / strategies.length,
      avgSharpe: strategies.reduce((sum, s) => sum + s.sharpeRatio, 0) / strategies.length
    };

    return report;
  }
}

export default PerformanceAnalyzer;
