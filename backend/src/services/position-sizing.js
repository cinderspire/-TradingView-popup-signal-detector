/**
 * Position Sizing Calculator
 * Kelly Criterion & Fixed Fractional Money Management
 */

class PositionSizingService {
  /**
   * Calculate position size using Fixed Fractional method
   * @param {number} accountBalance - Total account balance in USD
   * @param {number} riskPercentage - Risk % per trade (default 2%)
   * @param {number} stopLossPercent - Stop loss distance in %
   * @returns {number} Position size in USD
   */
  fixedFractional(accountBalance, riskPercentage = 2, stopLossPercent = 5) {
    if (!accountBalance || accountBalance <= 0) return 0;
    if (!stopLossPercent || stopLossPercent <= 0) return 0;

    const riskAmount = accountBalance * (riskPercentage / 100);
    const positionSize = riskAmount / (stopLossPercent / 100);

    return Math.max(0, positionSize);
  }

  /**
   * Calculate position size using Kelly Criterion
   * @param {number} accountBalance - Total account balance
   * @param {number} winRate - Win rate as decimal (0.6 for 60%)
   * @param {number} avgWin - Average win amount
   * @param {number} avgLoss - Average loss amount
   * @param {number} maxKelly - Maximum Kelly % to use (default 25% of full Kelly)
   * @returns {number} Position size in USD
   */
  kellyCriterion(accountBalance, winRate, avgWin, avgLoss, maxKelly = 0.25) {
    if (!accountBalance || accountBalance <= 0) return 0;
    if (!winRate || winRate <= 0 || winRate >= 1) return 0;
    if (!avgWin || !avgLoss || avgWin <= 0 || avgLoss <= 0) return 0;

    const loseRate = 1 - winRate;
    const winLossRatio = avgWin / avgLoss;

    // Kelly formula: K = W - [(1-W) / R]
    // W = winning probability, R = win/loss ratio
    const kellyPercent = winRate - (loseRate / winLossRatio);

    // Don't use negative Kelly (indicates -EV system)
    if (kellyPercent <= 0) return 0;

    // Use fractional Kelly for safety (default 25% of full Kelly)
    const safeKelly = kellyPercent * maxKelly;

    // Position size
    const positionSize = accountBalance * safeKelly;

    return Math.max(0, positionSize);
  }

  /**
   * Calculate optimal position size for a strategy
   * @param {Object} params
   * @param {number} params.accountBalance - Account balance
   * @param {number} params.riskPercentage - Risk % per trade
   * @param {Object} params.strategyStats - Strategy statistics
   * @param {string} params.method - 'fixed' or 'kelly'
   * @returns {Object} Position sizing recommendation
   */
  calculate(params) {
    const {
      accountBalance,
      riskPercentage = 2,
      strategyStats = {},
      method = 'fixed'
    } = params;

    if (!accountBalance || accountBalance <= 0) {
      return {
        positionSize: 0,
        method: method,
        error: 'Invalid account balance'
      };
    }

    let positionSize = 0;
    let details = {};

    if (method === 'kelly' && strategyStats.winRate && strategyStats.avgWin && strategyStats.avgLoss) {
      positionSize = this.kellyCriterion(
        accountBalance,
        strategyStats.winRate / 100, // Convert to decimal
        strategyStats.avgWin,
        strategyStats.avgLoss,
        0.25 // Use 25% of full Kelly
      );

      details = {
        method: 'Kelly Criterion (25%)',
        winRate: strategyStats.winRate,
        avgWin: strategyStats.avgWin,
        avgLoss: strategyStats.avgLoss,
        recommendation: 'Conservative Kelly for reduced volatility'
      };
    } else {
      // Default to fixed fractional
      const stopLoss = strategyStats.avgDrawdown || 5; // Use avg drawdown as SL estimate
      positionSize = this.fixedFractional(accountBalance, riskPercentage, stopLoss);

      details = {
        method: 'Fixed Fractional',
        riskPercentage: riskPercentage,
        stopLossEstimate: stopLoss,
        recommendation: 'Safe position sizing based on risk %'
      };
    }

    // Cap position size at 20% of account (safety limit)
    const maxPosition = accountBalance * 0.20;
    const capped = positionSize > maxPosition;

    if (capped) {
      positionSize = maxPosition;
    }

    return {
      positionSize: Math.round(positionSize * 100) / 100,
      positionPercent: Math.round((positionSize / accountBalance) * 10000) / 100,
      accountBalance,
      method: details.method,
      details,
      capped,
      maxPosition
    };
  }

  /**
   * Calculate risk/reward ratio
   */
  riskRewardRatio(entry, stopLoss, takeProfit) {
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);

    if (risk === 0) return 0;

    return reward / risk;
  }

  /**
   * Validate if trade meets minimum R:R ratio
   */
  meetsMinimumRR(entry, stopLoss, takeProfit, minRatio = 2) {
    const rr = this.riskRewardRatio(entry, stopLoss, takeProfit);
    return rr >= minRatio;
  }
}

module.exports = new PositionSizingService();
