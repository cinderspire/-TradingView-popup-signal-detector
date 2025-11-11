// Helper utility functions

import fs from 'fs/promises';
import path from 'path';

export class Helpers {
  /**
   * Ensure directory exists, create if not
   */
  static async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Save JSON data to file
   */
  static async saveJSON(filePath, data) {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Load JSON data from file
   */
  static async loadJSON(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      return null;
    }
  }

  /**
   * Calculate percentage change
   */
  static percentChange(oldVal, newVal) {
    return ((newVal - oldVal) / oldVal) * 100;
  }

  /**
   * Round to decimal places
   */
  static round(num, decimals = 2) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Sleep function
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate standard deviation
   */
  static stdDev(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate Sharpe Ratio
   */
  static sharpeRatio(returns, riskFreeRate = 0) {
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = this.stdDev(returns);
    return stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev;
  }

  /**
   * Calculate Sortino Ratio
   */
  static sortinoRatio(returns, riskFreeRate = 0) {
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const downside = returns.filter(r => r < 0);
    const downsideStdDev = downside.length > 0 ? this.stdDev(downside) : 0;
    return downsideStdDev === 0 ? 0 : (avgReturn - riskFreeRate) / downsideStdDev;
  }

  /**
   * Calculate Maximum Drawdown
   */
  static maxDrawdown(equityCurve) {
    let maxDD = 0;
    let peak = equityCurve[0];

    for (const value of equityCurve) {
      if (value > peak) {
        peak = value;
      }
      const dd = (peak - value) / peak;
      if (dd > maxDD) {
        maxDD = dd;
      }
    }

    return maxDD;
  }

  /**
   * Calculate Win Rate
   */
  static winRate(trades) {
    if (trades.length === 0) return 0;
    const wins = trades.filter(t => t.pnl > 0).length;
    return wins / trades.length;
  }

  /**
   * Calculate Profit Factor
   */
  static profitFactor(trades) {
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

    return grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;
  }

  /**
   * Format number with commas
   */
  static formatNumber(num, decimals = 2) {
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Get timestamp range for date range
   */
  static getTimestampRange(startDate, endDate) {
    const start = new Date(startDate).getTime();
    const end = endDate ? new Date(endDate).getTime() : Date.now();
    return { start, end };
  }

  /**
   * Chunk array into smaller arrays
   */
  static chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export default Helpers;
