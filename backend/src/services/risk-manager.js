/**
 * Risk Management Service
 * Daily Loss Limits, Max Positions, Drawdown Alerts
 */

const cache = require('./cache');

class RiskManager {
  constructor() {
    this.limits = {
      DAILY_LOSS_PERCENT: 5,        // Max 5% daily loss
      MAX_POSITIONS_PER_STRATEGY: 20, // Max 20 positions per strategy
      MAX_TOTAL_POSITIONS: 50,       // Max 50 total positions
      DRAWDOWN_WARNING: 15,          // Alert at 15% drawdown
      DRAWDOWN_CRITICAL: 25,         // Critical at 25% drawdown
      MAX_CORRELATED_PAIRS: 3,       // Max 3 highly correlated pairs
    };
  }

  /**
   * Check if daily loss limit is exceeded
   * @param {string} userId - User ID
   * @param {number} accountBalance - Current account balance
   * @param {number} startingBalance - Balance at start of day
   * @returns {Object} Limit status
   */
  async checkDailyLossLimit(userId, accountBalance, startingBalance) {
    const currentLoss = startingBalance - accountBalance;
    const lossPercent = (currentLoss / startingBalance) * 100;

    const exceeded = lossPercent >= this.limits.DAILY_LOSS_PERCENT;

    if (exceeded) {
      // Store breach in cache for tracking
      await cache.set(
        `risk:daily_loss_breach:${userId}`,
        {
          timestamp: Date.now(),
          lossPercent,
          startingBalance,
          currentBalance: accountBalance,
        },
        86400 // 24 hours
      );
    }

    return {
      exceeded,
      currentLoss: Math.round(currentLoss * 100) / 100,
      lossPercent: Math.round(lossPercent * 100) / 100,
      limit: this.limits.DAILY_LOSS_PERCENT,
      remaining: Math.max(0, this.limits.DAILY_LOSS_PERCENT - lossPercent),
      action: exceeded ? 'STOP_TRADING' : 'CONTINUE',
      message: exceeded
        ? `⚠️ Daily loss limit exceeded (${lossPercent.toFixed(2)}%). All positions will be closed.`
        : `Daily loss: ${lossPercent.toFixed(2)}% of ${this.limits.DAILY_LOSS_PERCENT}% limit`
    };
  }

  /**
   * Check if max positions limit is exceeded
   * @param {string} strategyName - Strategy name
   * @param {number} currentPositions - Current open positions for this strategy
   * @returns {Object} Limit status
   */
  checkMaxPositions(strategyName, currentPositions) {
    const exceeded = currentPositions >= this.limits.MAX_POSITIONS_PER_STRATEGY;

    return {
      exceeded,
      current: currentPositions,
      limit: this.limits.MAX_POSITIONS_PER_STRATEGY,
      remaining: Math.max(0, this.limits.MAX_POSITIONS_PER_STRATEGY - currentPositions),
      action: exceeded ? 'REJECT_NEW_SIGNAL' : 'ALLOW',
      message: exceeded
        ? `⚠️ Maximum positions for ${strategyName} reached (${currentPositions}/${this.limits.MAX_POSITIONS_PER_STRATEGY})`
        : `Positions: ${currentPositions}/${this.limits.MAX_POSITIONS_PER_STRATEGY}`
    };
  }

  /**
   * Check total portfolio positions
   */
  checkTotalPositions(totalPositions) {
    const exceeded = totalPositions >= this.limits.MAX_TOTAL_POSITIONS;

    return {
      exceeded,
      current: totalPositions,
      limit: this.limits.MAX_TOTAL_POSITIONS,
      remaining: Math.max(0, this.limits.MAX_TOTAL_POSITIONS - totalPositions),
      action: exceeded ? 'REJECT_NEW_SIGNAL' : 'ALLOW',
      message: exceeded
        ? `⚠️ Maximum total positions reached (${totalPositions}/${this.limits.MAX_TOTAL_POSITIONS})`
        : `Total positions: ${totalPositions}/${this.limits.MAX_TOTAL_POSITIONS}`
    };
  }

  /**
   * Check drawdown level and generate alerts
   * @param {number} currentDrawdown - Current drawdown %
   * @param {string} strategyName - Strategy name
   * @returns {Object} Drawdown alert
   */
  checkDrawdown(currentDrawdown, strategyName) {
    let level = 'SAFE';
    let action = 'CONTINUE';
    let message = `Drawdown: ${currentDrawdown.toFixed(2)}%`;

    if (currentDrawdown >= this.limits.DRAWDOWN_CRITICAL) {
      level = 'CRITICAL';
      action = 'PAUSE_STRATEGY';
      message = `🚨 CRITICAL drawdown on ${strategyName}: ${currentDrawdown.toFixed(2)}%! Strategy auto-paused.`;
    } else if (currentDrawdown >= this.limits.DRAWDOWN_WARNING) {
      level = 'WARNING';
      action = 'ALERT_USER';
      message = `⚠️ High drawdown on ${strategyName}: ${currentDrawdown.toFixed(2)}%. Consider pausing.`;
    }

    return {
      level,
      action,
      currentDrawdown: Math.round(currentDrawdown * 100) / 100,
      warningThreshold: this.limits.DRAWDOWN_WARNING,
      criticalThreshold: this.limits.DRAWDOWN_CRITICAL,
      message
    };
  }

  /**
   * Check if adding this pair exceeds correlation limits
   * @param {string} newPair - New pair to add
   * @param {Array} openPairs - Currently open pairs
   * @param {Object} correlationMatrix - Correlation data
   * @returns {Object} Correlation check result
   */
  checkCorrelation(newPair, openPairs, correlationMatrix = {}) {
    // Count highly correlated pairs (>0.7 correlation)
    let highlyCorrelated = [];

    for (const openPair of openPairs) {
      const correlation = correlationMatrix[`${newPair}-${openPair}`] || 0;
      if (Math.abs(correlation) > 0.7) {
        highlyCorrelated.push({
          pair: openPair,
          correlation
        });
      }
    }

    const exceeded = highlyCorrelated.length >= this.limits.MAX_CORRELATED_PAIRS;

    return {
      exceeded,
      highlyCorrelated,
      count: highlyCorrelated.length,
      limit: this.limits.MAX_CORRELATED_PAIRS,
      action: exceeded ? 'WARN' : 'ALLOW',
      message: exceeded
        ? `⚠️ ${newPair} is highly correlated with ${highlyCorrelated.length} open positions`
        : `Correlation check passed for ${newPair}`
    };
  }

  /**
   * Comprehensive pre-trade risk check
   * @param {Object} params - Trade parameters
   * @returns {Object} Risk assessment
   */
  async assessTrade(params) {
    const {
      userId,
      strategyName,
      pair,
      accountBalance,
      startingBalance,
      currentPositions,
      totalPositions,
      openPairs = [],
      correlationMatrix = {}
    } = params;

    const checks = {
      dailyLoss: await this.checkDailyLossLimit(userId, accountBalance, startingBalance),
      maxPositions: this.checkMaxPositions(strategyName, currentPositions),
      totalPositions: this.checkTotalPositions(totalPositions),
      correlation: this.checkCorrelation(pair, openPairs, correlationMatrix)
    };

    const rejected =
      checks.dailyLoss.exceeded ||
      checks.maxPositions.exceeded ||
      checks.totalPositions.exceeded;

    const warnings = [];
    if (checks.correlation.exceeded) warnings.push(checks.correlation.message);

    return {
      approved: !rejected,
      rejected,
      warnings,
      checks,
      recommendation: rejected
        ? '🚫 Trade REJECTED - Risk limits exceeded'
        : warnings.length > 0
        ? '⚠️  Trade APPROVED with warnings'
        : '✅ Trade APPROVED - All risk checks passed'
    };
  }

  /**
   * Update risk limits dynamically
   */
  updateLimits(newLimits) {
    this.limits = { ...this.limits, ...newLimits };
    console.log('🔧 Risk limits updated:', this.limits);
  }

  /**
   * Get current limits
   */
  getLimits() {
    return { ...this.limits };
  }
}

module.exports = new RiskManager();
