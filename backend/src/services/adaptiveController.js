// Adaptive Controller - Performance-based strategy adjustment
// Monitors paper/real trade performance and adjusts parameters dynamically

import settings from '../config/settings.js';

export class AdaptiveController {
  constructor(paperTradeEngine, realTradeEngine, strategyLoader) {
    this.paperTradeEngine = paperTradeEngine;
    this.realTradeEngine = realTradeEngine;
    this.strategyLoader = strategyLoader;
    this.adjustmentHistory = [];
    this.performanceThresholds = {
      minWinRate: 45,
      minROI: -5,
      maxDrawdown: 8,
      minProfitFactor: 1.2
    };
  }

  /**
   * Analyze performance and suggest adjustments
   */
  analyzePerformance() {
    const paperSessions = this.paperTradeEngine.getAllSessions();
    const realSessions = this.realTradeEngine.getAllSessions();

    const adjustments = [];

    // Analyze each session
    [...paperSessions, ...realSessions].forEach(session => {
      if (!session.active || !session.metrics) return;

      const { metrics, strategy, pair, params } = session;
      const suggestions = [];

      // Low win rate - tighten entry conditions
      if (metrics.winRate < this.performanceThresholds.minWinRate) {
        suggestions.push({
          type: 'parameter',
          reason: `Win rate ${metrics.winRate.toFixed(1)}% below threshold ${this.performanceThresholds.minWinRate}%`,
          action: 'tighten_entry',
          suggestions: this.getTightenEntrySuggestions(strategy, params)
        });
      }

      // Negative ROI - reduce position size or stop
      if (metrics.roi < this.performanceThresholds.minROI) {
        suggestions.push({
          type: 'risk',
          reason: `ROI ${metrics.roi.toFixed(1)}% below threshold ${this.performanceThresholds.minROI}%`,
          action: 'reduce_risk',
          suggestions: [
            { param: 'positionSize', change: -0.1, newValue: Math.max(0.3, settings.positionSize - 0.1) },
            { param: 'stopLoss', change: -0.5, newValue: 'tighter stops' }
          ]
        });
      }

      // High drawdown - implement stops
      if (metrics.maxDrawdown > this.performanceThresholds.maxDrawdown) {
        suggestions.push({
          type: 'protection',
          reason: `Max drawdown ${metrics.maxDrawdown.toFixed(1)}% exceeds ${this.performanceThresholds.maxDrawdown}%`,
          action: 'add_protection',
          suggestions: [
            { param: 'maxDrawdown', change: -1, newValue: this.performanceThresholds.maxDrawdown },
            { param: 'trailingStop', change: 'add', newValue: true }
          ]
        });
      }

      // Low profit factor - adjust targets
      if (metrics.profitFactor < this.performanceThresholds.minProfitFactor) {
        suggestions.push({
          type: 'targets',
          reason: `Profit factor ${metrics.profitFactor.toFixed(2)} below ${this.performanceThresholds.minProfitFactor}`,
          action: 'adjust_targets',
          suggestions: this.getTargetAdjustmentSuggestions(strategy, params, metrics)
        });
      }

      if (suggestions.length > 0) {
        adjustments.push({
          sessionId: session.id,
          pair,
          strategy,
          currentParams: params,
          metrics,
          suggestions,
          timestamp: Date.now()
        });
      }
    });

    return adjustments;
  }

  /**
   * Get suggestions to tighten entry conditions
   */
  getTightenEntrySuggestions(strategy, params) {
    const suggestions = [];

    if (!params) return suggestions;

    // Common parameters to adjust based on strategy type
    if (params.rsiOversold !== undefined) {
      suggestions.push({
        param: 'rsiOversold',
        currentValue: params.rsiOversold,
        newValue: Math.max(20, params.rsiOversold - 5),
        change: -5,
        reason: 'More extreme RSI for entries'
      });
    }

    if (params.rsiOverbought !== undefined) {
      suggestions.push({
        param: 'rsiOverbought',
        currentValue: params.rsiOverbought,
        newValue: Math.min(80, params.rsiOverbought + 5),
        change: 5,
        reason: 'More extreme RSI for entries'
      });
    }

    if (params.bollingerDeviation !== undefined) {
      suggestions.push({
        param: 'bollingerDeviation',
        currentValue: params.bollingerDeviation,
        newValue: params.bollingerDeviation + 0.2,
        change: 0.2,
        reason: 'Wider bands for fewer entries'
      });
    }

    if (params.atrMultiplier !== undefined) {
      suggestions.push({
        param: 'atrMultiplier',
        currentValue: params.atrMultiplier,
        newValue: params.atrMultiplier + 0.3,
        change: 0.3,
        reason: 'Higher ATR threshold'
      });
    }

    return suggestions;
  }

  /**
   * Get target adjustment suggestions based on metrics
   */
  getTargetAdjustmentSuggestions(strategy, params, metrics) {
    const suggestions = [];

    // If avg loss > avg win, increase profit targets
    if (metrics.avgLoss > metrics.avgWin) {
      const targetIncrease = (metrics.avgLoss / metrics.avgWin) * 1.5;

      suggestions.push({
        param: 'profitTarget',
        currentValue: params.profitTarget || 2.0,
        newValue: Math.min(5.0, (params.profitTarget || 2.0) * targetIncrease),
        change: `${((targetIncrease - 1) * 100).toFixed(0)}%`,
        reason: `Avg loss ($${metrics.avgLoss.toFixed(2)}) > avg win ($${metrics.avgWin.toFixed(2)})`
      });
    }

    return suggestions;
  }

  /**
   * Auto-apply adjustments to underperforming sessions
   */
  autoAdjust(sessionId, applyAdjustments = false) {
    const adjustments = this.analyzePerformance();
    const sessionAdjustment = adjustments.find(a => a.sessionId === sessionId);

    if (!sessionAdjustment) {
      return { adjusted: false, message: 'No adjustments needed' };
    }

    if (!applyAdjustments) {
      return {
        adjusted: false,
        message: 'Adjustments suggested but not applied',
        suggestions: sessionAdjustment
      };
    }

    // Apply adjustments
    const session = this.paperTradeEngine.getSession(sessionId) ||
                     this.realTradeEngine.getSession(sessionId);

    if (!session) {
      return { adjusted: false, message: 'Session not found' };
    }

    // Log adjustment
    this.adjustmentHistory.push({
      timestamp: Date.now(),
      sessionId,
      before: { ...session.params },
      adjustments: sessionAdjustment.suggestions,
      metrics: sessionAdjustment.metrics
    });

    // Apply suggested parameter changes
    sessionAdjustment.suggestions.forEach(suggestion => {
      suggestion.suggestions.forEach(paramSuggestion => {
        if (paramSuggestion.param && paramSuggestion.newValue !== undefined) {
          session.params[paramSuggestion.param] = paramSuggestion.newValue;
        }
      });
    });

    // Reinitialize strategy with new params
    const strategy = this.strategyLoader.getStrategy(session.strategy);
    if (strategy) {
      session.indicators = strategy.init(session.candles, session.params);
    }

    return {
      adjusted: true,
      message: 'Parameters adjusted based on performance',
      changes: sessionAdjustment.suggestions,
      newParams: session.params
    };
  }

  /**
   * Get adjustment history
   */
  getAdjustmentHistory(limit = 20) {
    return this.adjustmentHistory.slice(-limit);
  }

  /**
   * Get stats
   */
  getStats() {
    try {
      const adjustments = this.analyzePerformance();

      return {
        totalSessionsAnalyzed: adjustments.length,
        sessionsNeedingAdjustment: adjustments.length,
        adjustmentsSuggested: adjustments.reduce((sum, a) => sum + a.suggestions.length, 0),
        adjustmentsApplied: this.adjustmentHistory.length,
        recentAdjustments: this.getAdjustmentHistory(5)
      };
    } catch (err) {
      console.error('Error in adaptiveController.getStats:', err);
      return {
        totalSessionsAnalyzed: 0,
        sessionsNeedingAdjustment: 0,
        adjustmentsSuggested: 0,
        adjustmentsApplied: 0,
        recentAdjustments: [],
        error: err.message
      };
    }
  }
}

export default AdaptiveController;
