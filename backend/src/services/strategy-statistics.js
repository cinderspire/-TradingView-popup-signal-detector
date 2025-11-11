const { EventEmitter } = require('events');

/**
 * StrategyStatistics
 *
 * Tracks performance metrics for each strategy:
 * - Win Rate
 * - Profit Factor
 * - Average Win/Loss
 * - Max Drawdown
 * - Sharpe Ratio
 * - Total Trades
 * - Best/Worst Trades
 */
class StrategyStatistics extends EventEmitter {
  constructor() {
    super();

    // strategy -> { trades: [], stats: {} }
    this.strategies = new Map();

    console.log('✅ Strategy Statistics initialized');
  }

  /**
   * Add a signal to strategy tracking
   */
  addSignal(signal) {
    const strategy = signal.strategy || 'Unknown';

    if (!this.strategies.has(strategy)) {
      this.strategies.set(strategy, {
        name: strategy,
        signals: [],
        trades: [],
        stats: this.getDefaultStats()
      });
    }

    const strategyData = this.strategies.get(strategy);
    strategyData.signals.push({
      id: signal.id,
      pair: signal.pair,
      direction: signal.direction,
      entry: signal.entry,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      timestamp: signal.timestamp,
      status: 'Active',
      pnl: 0
    });

    console.log(`📊 Added signal to strategy ${strategy}: ${signal.pair} ${signal.direction}`);
  }

  /**
   * Update signal PnL
   */
  updateSignalPnL(signalId, currentPnL, currentPrice) {
    for (const [strategy, data] of this.strategies.entries()) {
      const signal = data.signals.find(s => s.id === signalId);

      if (signal) {
        signal.pnl = currentPnL;
        signal.currentPrice = currentPrice;
        signal.lastUpdate = Date.now();

        // Recalculate strategy stats
        this.calculateStats(strategy);
        break;
      }
    }
  }

  /**
   * Close a signal and add to trade history
   */
  closeSignal(signalId, exitPrice, finalPnL, closeReason) {
    for (const [strategy, data] of this.strategies.entries()) {
      const signalIndex = data.signals.findIndex(s => s.id === signalId);

      if (signalIndex !== -1) {
        const signal = data.signals[signalIndex];
        signal.status = 'Closed';
        signal.exitPrice = exitPrice;
        signal.finalPnL = finalPnL;
        signal.closeReason = closeReason;
        signal.closedAt = Date.now();

        // Add to trade history
        data.trades.push({
          ...signal,
          duration: signal.closedAt - new Date(signal.timestamp).getTime()
        });

        // Recalculate stats
        this.calculateStats(strategy);

        console.log(`✅ Closed signal in ${strategy}: ${signal.pair} | PnL: ${finalPnL.toFixed(2)}%`);
        break;
      }
    }
  }

  /**
   * Calculate strategy statistics
   */
  calculateStats(strategy) {
    const data = this.strategies.get(strategy);
    if (!data) return;

    const trades = data.trades;
    const activeSignals = data.signals.filter(s => s.status === 'Active');

    // Basic counts
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.finalPnL > 0);
    const losingTrades = trades.filter(t => t.finalPnL <= 0);

    const wins = winningTrades.length;
    const losses = losingTrades.length;

    // Win Rate
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    // Average Win/Loss
    const avgWin = wins > 0
      ? winningTrades.reduce((sum, t) => sum + t.finalPnL, 0) / wins
      : 0;

    const avgLoss = losses > 0
      ? losingTrades.reduce((sum, t) => sum + t.finalPnL, 0) / losses
      : 0;

    // Profit Factor
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.finalPnL, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.finalPnL, 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;

    // Best/Worst Trades
    const bestTrade = trades.length > 0
      ? Math.max(...trades.map(t => t.finalPnL))
      : 0;

    const worstTrade = trades.length > 0
      ? Math.min(...trades.map(t => t.finalPnL))
      : 0;

    // Total Return
    const totalReturn = trades.reduce((sum, t) => sum + t.finalPnL, 0) +
                        activeSignals.reduce((sum, s) => sum + (s.pnl || 0), 0);

    // Max Drawdown
    const maxDrawdown = this.calculateMaxDrawdown(trades, activeSignals);

    // Sharpe Ratio
    const sharpeRatio = this.calculateSharpeRatio(trades);

    // Expected Payoff
    const expectedPayoff = totalTrades > 0
      ? totalReturn / totalTrades
      : 0;

    // Recovery Factor
    const recoveryFactor = maxDrawdown !== 0
      ? totalReturn / Math.abs(maxDrawdown)
      : 0;

    // Average trade duration
    const avgDuration = trades.length > 0
      ? trades.reduce((sum, t) => sum + t.duration, 0) / trades.length
      : 0;

    // Update stats
    data.stats = {
      totalTrades,
      winningTrades: wins,
      losingTrades: losses,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      bestTrade,
      worstTrade,
      totalReturn,
      maxDrawdown,
      sharpeRatio,
      expectedPayoff,
      recoveryFactor,
      avgDuration,
      activeSignals: activeSignals.length,
      lastUpdate: Date.now()
    };

    this.emit('stats-updated', {
      strategy,
      stats: data.stats
    });
  }

  /**
   * Calculate max drawdown
   */
  calculateMaxDrawdown(trades, activeSignals) {
    const allPnLs = [
      ...trades.map(t => t.finalPnL),
      ...activeSignals.map(s => s.pnl || 0)
    ];

    if (allPnLs.length === 0) return 0;

    let peak = 0;
    let maxDD = 0;
    let cumulative = 0;

    for (const pnl of allPnLs) {
      cumulative += pnl;

      if (cumulative > peak) {
        peak = cumulative;
      }

      const drawdown = peak - cumulative;
      if (drawdown > maxDD) {
        maxDD = drawdown;
      }
    }

    return -maxDD; // Return as negative
  }

  /**
   * Calculate Sharpe Ratio
   */
  calculateSharpeRatio(trades) {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => t.finalPnL);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate standard deviation
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Sharpe ratio (assuming risk-free rate = 0)
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  /**
   * Get default stats object
   */
  getDefaultStats() {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      bestTrade: 0,
      worstTrade: 0,
      totalReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      expectedPayoff: 0,
      recoveryFactor: 0,
      avgDuration: 0,
      activeSignals: 0,
      lastUpdate: Date.now()
    };
  }

  /**
   * Get strategy stats
   */
  getStrategyStats(strategy) {
    const data = this.strategies.get(strategy);
    return data ? data.stats : this.getDefaultStats();
  }

  /**
   * Get signal details with stats
   */
  getSignalDetails(signalId) {
    for (const [strategy, data] of this.strategies.entries()) {
      const signal = data.signals.find(s => s.id === signalId);

      if (signal) {
        return {
          signal,
          strategy,
          strategyStats: data.stats,
          trades: data.trades.slice(-10) // Last 10 trades
        };
      }
    }

    return null;
  }

  /**
   * Get all strategies
   */
  getAllStrategies() {
    const result = [];

    for (const [strategy, data] of this.strategies.entries()) {
      result.push({
        name: strategy,
        stats: data.stats,
        activeSignals: data.signals.filter(s => s.status === 'Active').length,
        totalTrades: data.trades.length
      });
    }

    return result;
  }

  /**
   * Get stats summary
   */
  getStatsSummary() {
    const strategies = this.getAllStrategies();

    const totalTrades = strategies.reduce((sum, s) => sum + s.stats.totalTrades, 0);
    const totalWins = strategies.reduce((sum, s) => sum + s.stats.winningTrades, 0);
    const totalLosses = strategies.reduce((sum, s) => sum + s.stats.losingTrades, 0);

    const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
    const totalReturn = strategies.reduce((sum, s) => sum + s.stats.totalReturn, 0);

    return {
      totalStrategies: strategies.length,
      totalTrades,
      totalWins,
      totalLosses,
      overallWinRate,
      totalReturn,
      strategies
    };
  }
}

// Singleton instance
const strategyStats = new StrategyStatistics();

module.exports = strategyStats;
