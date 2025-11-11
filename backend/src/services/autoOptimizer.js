// Auto Optimization Engine - Continuous parameter optimization
// Uses performance data to dynamically adjust strategy parameters

import settings from '../config/settings.js';

export class AutoOptimizer {
  constructor(paperTradeEngine) {
    this.paperTradeEngine = paperTradeEngine;
    this.optimizationHistory = [];
    this.optimizationInterval = 3600000; // 1 hour
    this.minTradesForOptimization = 5;

    // Parameter ranges for each strategy
    this.parameterRanges = {
      'Mean Reversion': {
        rsiOversold: [20, 25, 30, 35],
        rsiOverbought: [65, 70, 75, 80],
        atrMultiplierSL: [1.5, 2.0, 2.5],
        atrMultiplierTP: [2.5, 3.0, 3.5, 4.0]
      },
      'Momentum': {
        atrMultiplierSL: [1.0, 1.5, 2.0],
        atrMultiplierTP: [2.0, 2.5, 3.0],
        rsiOverbought: [65, 70, 75]
      },
      'Scalping': {
        rsiOversold: [15, 20, 25],
        rsiOverbought: [75, 80, 85],
        atrMultiplierSL: [0.8, 1.0, 1.2],
        atrMultiplierTP: [1.5, 2.0, 2.5]
      }
    };
  }

  /**
   * Start auto optimization
   */
  async start() {
    console.log('🔧 Auto Optimizer starting...');

    // Initial optimization after 1 minute
    setTimeout(() => {
      this.runOptimization().catch(err =>
        console.error('Optimization error:', err.message)
      );
    }, 60000);

    // Run optimization every hour
    setInterval(() => {
      this.runOptimization().catch(err =>
        console.error('Optimization error:', err.message)
      );
    }, this.optimizationInterval);

    console.log(' Auto Optimizer active - will optimize every hour');
  }

  /**
   * Run optimization on all sessions
   */
  async runOptimization() {
    console.log('🔧 Running parameter optimization...');

    const sessions = this.paperTradeEngine.getAllSessions();
    let optimizedCount = 0;

    for (const session of sessions) {
      if (!session.active) continue;
      if (session.totalTrades < this.minTradesForOptimization) continue;

      const improvement = await this.optimizeSession(session);
      if (improvement) {
        optimizedCount++;
      }
    }

    console.log(`✅ Optimization complete: ${optimizedCount} sessions optimized`);
    return optimizedCount;
  }

  /**
   * Alias for API calls - optimize all sessions immediately
   */
  async optimizeAllSessions() {
    return await this.runOptimization();
  }

  /**
   * Optimize parameters for a single session
   */
  async optimizeSession(session) {
    const strategy = session.strategy;
    const metrics = session.metrics;

    // Only optimize if performance is suboptimal
    if (metrics.roi > 10 && metrics.winRate > 55) {
      return false; // Already performing well
    }

    const ranges = this.parameterRanges[strategy];
    if (!ranges) return false;

    // Find best parameter combination based on recent trades
    const recentTrades = session.trades.slice(-10); // Last 10 trades
    if (recentTrades.length < 3) return false;

    const currentScore = this.calculateScore(metrics);
    let bestScore = currentScore;
    let bestParams = null;

    // Simple grid search optimization
    for (const [paramName, values] of Object.entries(ranges)) {
      for (const value of values) {
        const testParams = { ...session.params, [paramName]: value };
        const estimatedScore = this.estimateScore(recentTrades, testParams, paramName, value);

        if (estimatedScore > bestScore) {
          bestScore = estimatedScore;
          bestParams = { ...testParams };
        }
      }
    }

    // Apply optimization if significant improvement (>5%)
    if (bestParams && (bestScore - currentScore) / currentScore > 0.05) {
      console.log(`🔧 Optimizing ${session.id}:`, bestParams);

      // Update session parameters
      const fullSession = this.paperTradeEngine.getSession(session.id);
      if (fullSession) {
        fullSession.params = bestParams;

        this.optimizationHistory.push({
          sessionId: session.id,
          strategy,
          timestamp: Date.now(),
          oldParams: session.params,
          newParams: bestParams,
          oldScore: currentScore,
          newScore: bestScore,
          improvement: ((bestScore - currentScore) / currentScore * 100).toFixed(2) + '%'
        });

        return true;
      }
    }

    return false;
  }

  /**
   * Calculate performance score
   */
  calculateScore(metrics) {
    // Weighted score: ROI (40%) + Win Rate (30%) + Sharpe (20%) - DD penalty (10%)
    const roiScore = Math.max(0, Math.min(100, metrics.roi * 2)); // 0-100
    const winRateScore = metrics.winRate; // 0-100
    const sharpeScore = Math.min(100, metrics.sharpeRatio * 33); // 0-100
    const ddPenalty = metrics.maxDrawdown * 2; // penalty

    return (roiScore * 0.4) + (winRateScore * 0.3) + (sharpeScore * 0.2) - (ddPenalty * 0.1);
  }

  /**
   * Estimate score with new parameter
   */
  estimateScore(recentTrades, params, changedParam, newValue) {
    // Estimate impact based on parameter type
    let estimatedROI = 0;
    let estimatedWinRate = 0;

    for (const trade of recentTrades) {
      const profitPercent = trade.pnlPercent;

      // Adjust estimates based on parameter changes
      if (changedParam.includes('SL') && newValue < params[changedParam]) {
        // Tighter stop loss: potentially better R:R but lower win rate
        estimatedWinRate -= 2;
        estimatedROI += profitPercent > 0 ? profitPercent * 0.1 : 0;
      } else if (changedParam.includes('TP') && newValue > params[changedParam]) {
        // Higher take profit: potentially better ROI
        estimatedROI += profitPercent > 0 ? profitPercent * 0.15 : 0;
      } else if (changedParam.includes('Oversold') && newValue < params[changedParam]) {
        // More aggressive entry: more trades, potentially higher risk
        estimatedWinRate += 3;
      }
    }

    // Calculate estimated metrics
    const avgROI = estimatedROI / recentTrades.length;
    const wins = recentTrades.filter(t => t.pnl > 0).length;
    const winRate = ((wins / recentTrades.length) * 100) + estimatedWinRate;

    return (avgROI * 0.5) + (winRate * 0.5);
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    return this.getOptimizationStats();
  }

  getOptimizationStats() {
    const recent = this.optimizationHistory.slice(-10);

    return {
      totalOptimizations: this.optimizationHistory.length,
      recentOptimizations: recent,
      avgImprovement: recent.length > 0
        ? (recent.reduce((sum, opt) => sum + parseFloat(opt.improvement), 0) / recent.length).toFixed(2) + '%'
        : '0%',
      lastOptimization: this.optimizationHistory.length > 0
        ? this.optimizationHistory[this.optimizationHistory.length - 1].timestamp
        : null
    };
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations() {
    const sessions = this.paperTradeEngine.getAllSessions();
    const recommendations = [];

    for (const session of sessions) {
      if (!session.active || session.totalTrades < this.minTradesForOptimization) continue;

      const metrics = session.metrics;

      // Recommendation based on performance
      if (metrics.roi < 5 && metrics.winRate < 50) {
        recommendations.push({
          sessionId: session.id,
          priority: 'high',
          reason: 'Low ROI and Win Rate',
          suggestion: 'Consider tighter entry filters or different timeframe'
        });
      } else if (metrics.maxDrawdown > 15) {
        recommendations.push({
          sessionId: session.id,
          priority: 'medium',
          reason: 'High Max Drawdown',
          suggestion: 'Reduce ATR multiplier for stop loss'
        });
      } else if (metrics.profitFactor < 1.3) {
        recommendations.push({
          sessionId: session.id,
          priority: 'medium',
          reason: 'Low Profit Factor',
          suggestion: 'Increase R:R ratio or improve entry quality'
        });
      }
    }

    return recommendations;
  }
}

export default AutoOptimizer;
