// Performance Tracker - Track all trades, metrics, and performance data
// For maximum profit optimization and comprehensive reporting

import path from 'path';
import { Helpers } from '../utils/helpers.js';
import settings from '../config/settings.js';

export class PerformanceTracker {
  constructor() {
    this.dataPath = path.join(settings.dataPath, 'performance');
    this.trades = new Map(); // All trades by session
    this.metrics = new Map(); // Metrics by session
    this.dailyStats = new Map(); // Daily statistics
    this.strategyPerformance = new Map(); // Performance by strategy

    this.loadData();
  }

  /**
   * Record a trade
   */
  recordTrade(sessionId, trade) {
    if (!this.trades.has(sessionId)) {
      this.trades.set(sessionId, []);
    }

    const enrichedTrade = {
      ...trade,
      timestamp: Date.now(),
      sessionId,
      id: `${sessionId}_${Date.now()}`
    };

    this.trades.get(sessionId).push(enrichedTrade);
    this.updateMetrics(sessionId);
    this.updateDailyStats(trade);
    this.saveData();

    return enrichedTrade;
  }

  /**
   * Update metrics for a session
   */
  updateMetrics(sessionId) {
    const trades = this.trades.get(sessionId) || [];
    if (trades.length === 0) return;

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalPnLPercent = trades.reduce((sum, t) => sum + (t.pnlPercent || 0), 0);

    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Calculate drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    for (const trade of trades) {
      runningPnL += trade.pnl || 0;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      const drawdown = ((peak - runningPnL) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Sharpe ratio (simplified)
    const returns = trades.map(t => t.pnlPercent || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

    const metrics = {
      sessionId,
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      totalPnL,
      totalPnLPercent,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
      lastUpdated: Date.now()
    };

    this.metrics.set(sessionId, metrics);
    return metrics;
  }

  /**
   * Update daily statistics
   */
  updateDailyStats(trade) {
    const date = new Date().toISOString().split('T')[0];

    if (!this.dailyStats.has(date)) {
      this.dailyStats.set(date, {
        date,
        trades: 0,
        pnl: 0,
        wins: 0,
        losses: 0
      });
    }

    const stats = this.dailyStats.get(date);
    stats.trades++;
    stats.pnl += trade.pnl || 0;
    if (trade.pnl > 0) stats.wins++;
    else if (trade.pnl < 0) stats.losses++;

    this.dailyStats.set(date, stats);
  }

  /**
   * Get session metrics
   */
  getSessionMetrics(sessionId) {
    return this.metrics.get(sessionId) || this.updateMetrics(sessionId);
  }

  /**
   * Get all session trades
   */
  getSessionTrades(sessionId) {
    return this.trades.get(sessionId) || [];
  }

  /**
   * Get daily statistics
   */
  getDailyStats(days = 30) {
    const stats = Array.from(this.dailyStats.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, days);

    return stats;
  }

  /**
   * Get strategy performance comparison
   */
  getStrategyPerformance() {
    const strategyStats = new Map();

    for (const [sessionId, metrics] of this.metrics.entries()) {
      const strategy = sessionId.split('_')[0]; // Extract strategy name

      if (!strategyStats.has(strategy)) {
        strategyStats.set(strategy, {
          strategy,
          sessions: 0,
          totalTrades: 0,
          totalPnL: 0,
          avgWinRate: 0,
          avgSharpe: 0
        });
      }

      const stats = strategyStats.get(strategy);
      stats.sessions++;
      stats.totalTrades += metrics.totalTrades;
      stats.totalPnL += metrics.totalPnL;
      stats.avgWinRate += metrics.winRate;
      stats.avgSharpe += metrics.sharpeRatio;
    }

    // Calculate averages
    for (const stats of strategyStats.values()) {
      stats.avgWinRate /= stats.sessions;
      stats.avgSharpe /= stats.sessions;
    }

    return Array.from(strategyStats.values())
      .sort((a, b) => b.totalPnL - a.totalPnL);
  }

  /**
   * Get top performers
   */
  getTopPerformers(limit = 10) {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .slice(0, limit);
  }

  /**
   * Get comprehensive report
   */
  getComprehensiveReport() {
    const allMetrics = Array.from(this.metrics.values());

    const totalTrades = allMetrics.reduce((sum, m) => sum + m.totalTrades, 0);
    const totalPnL = allMetrics.reduce((sum, m) => sum + m.totalPnL, 0);
    const avgWinRate = allMetrics.reduce((sum, m) => sum + m.winRate, 0) / allMetrics.length;
    const avgSharpe = allMetrics.reduce((sum, m) => sum + m.sharpeRatio, 0) / allMetrics.length;

    return {
      overview: {
        totalSessions: allMetrics.length,
        totalTrades,
        totalPnL,
        avgWinRate,
        avgSharpe
      },
      topPerformers: this.getTopPerformers(10),
      strategyComparison: this.getStrategyPerformance(),
      dailyStats: this.getDailyStats(30),
      lastUpdated: Date.now()
    };
  }

  /**
   * Save all data to disk
   */
  async saveData() {
    try {
      const data = {
        trades: Array.from(this.trades.entries()),
        metrics: Array.from(this.metrics.entries()),
        dailyStats: Array.from(this.dailyStats.entries()),
        lastSaved: Date.now()
      };

      await Helpers.saveJSON(
        path.join(this.dataPath, 'performance_tracker.json'),
        data
      );
    } catch (err) {
      console.error('Failed to save performance data:', err.message);
    }
  }

  /**
   * Load data from disk
   */
  async loadData() {
    try {
      const data = await Helpers.loadJSON(
        path.join(this.dataPath, 'performance_tracker.json')
      );

      if (data) {
        this.trades = new Map(data.trades || []);
        this.metrics = new Map(data.metrics || []);
        this.dailyStats = new Map(data.dailyStats || []);
        console.log('✅ Performance data loaded');
      }
    } catch (err) {
      console.log('No previous performance data found, starting fresh');
    }
  }
}
