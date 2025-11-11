// Risk Manager - Portfolio risk control and position management

import settings from '../config/settings.js';
import { Helpers } from '../utils/helpers.js';

export class RiskManager {
  constructor() {
    this.positions = new Map();
    this.dailyPnL = 0;
    this.dailyPnLResetTime = this.getNextResetTime();
  }

  /**
   * Approve or reject a trading signal based on risk rules
   */
  async approveSignal(session, signal) {
    // Check if max positions reached
    if (signal.signal === 'buy' && this.positions.size >= settings.maxPositions) {
      console.log(`🚫 Max positions reached (${settings.maxPositions})`);
      return false;
    }

    // Check daily loss limit
    if (this.dailyPnL < -settings.maxDailyLoss * settings.initialCapital) {
      console.log(`🚫 Daily loss limit exceeded: ${Helpers.round(this.dailyPnL, 2)}`);
      return false;
    }

    // Check max drawdown
    if (session.equityCurve && session.equityCurve.length > 0) {
      const currentDD = Helpers.maxDrawdown(session.equityCurve);
      if (currentDD > settings.maxDrawdown) {
        console.log(`🚫 Max drawdown exceeded: ${Helpers.round(currentDD * 100, 2)}%`);
        return false;
      }
    }

    // Check long/short balance
    const balance = this.getLongShortBalance();
    if (signal.signal === 'buy' && balance.ratio > settings.targetLongShortRatio * 2) {
      console.log(`🚫 Long/Short ratio too high: ${Helpers.round(balance.ratio, 2)}`);
      return false;
    }

    return true;
  }

  /**
   * Get long/short position balance
   */
  getLongShortBalance() {
    let longCount = 0;
    let shortCount = 0;

    for (const pos of this.positions.values()) {
      if (pos.type === 'long') longCount++;
      else shortCount++;
    }

    return {
      long: longCount,
      short: shortCount,
      ratio: shortCount === 0 ? longCount : longCount / shortCount,
      total: longCount + shortCount
    };
  }

  /**
   * Update position tracking
   */
  addPosition(sessionId, position) {
    this.positions.set(sessionId, position);
  }

  removePosition(sessionId) {
    this.positions.delete(sessionId);
  }

  /**
   * Update daily PnL
   */
  updateDailyPnL(pnl) {
    this.dailyPnL += pnl;

    // Reset daily PnL if new day
    if (Date.now() > this.dailyPnLResetTime) {
      this.dailyPnL = pnl;
      this.dailyPnLResetTime = this.getNextResetTime();
    }
  }

  /**
   * Get next daily reset time (midnight UTC)
   */
  getNextResetTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Calculate adaptive stop loss based on ATR
   */
  calculateAdaptiveStopLoss(price, atr, isLong = true) {
    const atrMultiplier = 1.5; // Can be dynamic
    const stopDistance = atr * atrMultiplier;

    if (isLong) {
      return price - stopDistance;
    } else {
      return price + stopDistance;
    }
  }

  /**
   * Calculate position size based on risk
   */
  calculatePositionSize(capital, riskPercent, entryPrice, stopLoss) {
    const riskAmount = capital * riskPercent;
    const priceRisk = Math.abs(entryPrice - stopLoss);
    const size = riskAmount / priceRisk;

    return size;
  }

  /**
   * Get risk report
   */
  getRiskReport() {
    const balance = this.getLongShortBalance();

    return {
      dailyPnL: Helpers.round(this.dailyPnL, 2),
      dailyPnLPercent: Helpers.round((this.dailyPnL / settings.initialCapital) * 100, 2),
      dailyLossLimit: settings.maxDailyLoss * 100,
      positions: {
        total: balance.total,
        long: balance.long,
        short: balance.short,
        ratio: Helpers.round(balance.ratio, 2),
        targetRatio: settings.targetLongShortRatio
      },
      maxPositions: settings.maxPositions,
      maxDrawdown: settings.maxDrawdown * 100
    };
  }
}

export default RiskManager;
