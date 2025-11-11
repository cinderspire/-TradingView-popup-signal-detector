const { EventEmitter } = require('events');
const PriceService = require('./price-service');

/**
 * SignalPnLTracker
 *
 * Tracks PnL for all active signals in real-time
 * Updates every 5 seconds with current prices
 * Maintains PnL history for charting
 */
class SignalPnLTracker extends EventEmitter {
  constructor() {
    super();

    this.activeSignals = new Map(); // signalId -> { signal, pnlHistory, currentPnL, status }
    this.updateInterval = null;
    this.updateFrequency = 5000; // 5 seconds

    console.log('✅ Signal PnL Tracker initialized');
  }

  /**
   * Start tracking a new signal
   */
  startTracking(signal) {
    if (!signal || !signal.id) {
      console.error('❌ Invalid signal for tracking');
      return;
    }

    // Extract clean symbol (remove .P suffix for perpetuals)
    const cleanSymbol = signal.pair.replace('.P', '').replace('USDT', '/USDT');

    this.activeSignals.set(signal.id, {
      signal: {
        ...signal,
        cleanSymbol
      },
      pnlHistory: [0], // Start with 0% PnL
      priceHistory: [signal.entry],
      currentPnL: 0,
      currentPrice: signal.entry,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      status: 'Active',
      updateCount: 0
    });

    console.log(`📊 Started tracking signal: ${signal.id} (${signal.pair} ${signal.direction})`);

    // Start update loop if not already running
    if (!this.updateInterval) {
      this.startUpdateLoop();
    }

    return this.activeSignals.get(signal.id);
  }

  /**
   * Stop tracking a signal
   */
  stopTracking(signalId) {
    if (this.activeSignals.has(signalId)) {
      const tracked = this.activeSignals.get(signalId);
      tracked.status = 'Closed';

      console.log(`🔒 Stopped tracking signal: ${signalId}`);

      // Keep in memory for 1 hour before removing
      setTimeout(() => {
        this.activeSignals.delete(signalId);
      }, 3600000);
    }
  }

  /**
   * Start the update loop
   */
  startUpdateLoop() {
    console.log('🔄 Starting PnL update loop (5s interval)');

    this.updateInterval = setInterval(async () => {
      await this.updateAllSignals();
    }, this.updateFrequency);
  }

  /**
   * Stop the update loop
   */
  stopUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('⏹️  Stopped PnL update loop');
    }
  }

  /**
   * Update all active signals
   */
  async updateAllSignals() {
    const activeCount = Array.from(this.activeSignals.values())
      .filter(t => t.status === 'Active').length;

    if (activeCount === 0) {
      return;
    }

    console.log(`🔄 Updating ${activeCount} active signals...`);

    const updates = [];

    for (const [signalId, tracked] of this.activeSignals.entries()) {
      if (tracked.status !== 'Active') continue;

      try {
        const currentPrice = await this.getCurrentPrice(tracked.signal.cleanSymbol);

        if (currentPrice) {
          const pnl = this.calculatePnL(tracked.signal, currentPrice);

          tracked.currentPrice = currentPrice;
          tracked.currentPnL = pnl;
          tracked.lastUpdate = Date.now();
          tracked.updateCount++;

          // Add to history (keep last 100 points)
          tracked.pnlHistory.push(pnl);
          tracked.priceHistory.push(currentPrice);

          if (tracked.pnlHistory.length > 100) {
            tracked.pnlHistory.shift();
            tracked.priceHistory.shift();
          }

          updates.push({
            signalId,
            pair: tracked.signal.pair,
            currentPrice,
            currentPnL: pnl,
            status: tracked.status
          });

          // Check if stop loss or take profit hit
          this.checkExitConditions(signalId, tracked, currentPrice);
        }
      } catch (error) {
        console.error(`❌ Error updating signal ${signalId}:`, error.message);
      }
    }

    if (updates.length > 0) {
      // Emit update event
      this.emit('pnl-update', updates);
    }
  }

  /**
   * Get current price for a symbol
   */
  async getCurrentPrice(symbol) {
    try {
      const price = await PriceService.getPrice(symbol);
      return price;
    } catch (error) {
      console.error(`❌ Failed to get price for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate PnL percentage
   */
  calculatePnL(signal, currentPrice) {
    const entry = signal.entry;
    const direction = signal.direction;

    if (!entry || !currentPrice) return 0;

    let pnl = 0;

    if (direction === 'LONG') {
      // LONG: PnL = (currentPrice - entryPrice) / entryPrice * 100
      pnl = ((currentPrice - entry) / entry) * 100;
    } else {
      // SHORT: PnL = (entryPrice - currentPrice) / entryPrice * 100
      pnl = ((entry - currentPrice) / entry) * 100;
    }

    return pnl;
  }

  /**
   * Check if stop loss or take profit is hit
   */
  checkExitConditions(signalId, tracked, currentPrice) {
    const signal = tracked.signal;
    const direction = signal.direction;

    // Check stop loss
    if (signal.stopLoss) {
      if (direction === 'LONG' && currentPrice <= signal.stopLoss) {
        console.log(`🛑 Stop loss hit for ${signalId}: ${currentPrice} <= ${signal.stopLoss}`);
        this.closeSignal(signalId, 'StopLoss', currentPrice);
        return;
      }

      if (direction === 'SHORT' && currentPrice >= signal.stopLoss) {
        console.log(`🛑 Stop loss hit for ${signalId}: ${currentPrice} >= ${signal.stopLoss}`);
        this.closeSignal(signalId, 'StopLoss', currentPrice);
        return;
      }
    }

    // Check take profit
    if (signal.takeProfit) {
      if (direction === 'LONG' && currentPrice >= signal.takeProfit) {
        console.log(`🎯 Take profit hit for ${signalId}: ${currentPrice} >= ${signal.takeProfit}`);
        this.closeSignal(signalId, 'TakeProfit', currentPrice);
        return;
      }

      if (direction === 'SHORT' && currentPrice <= signal.takeProfit) {
        console.log(`🎯 Take profit hit for ${signalId}: ${currentPrice} <= ${signal.takeProfit}`);
        this.closeSignal(signalId, 'TakeProfit', currentPrice);
        return;
      }
    }
  }

  /**
   * Close a signal
   */
  closeSignal(signalId, reason, exitPrice) {
    if (!this.activeSignals.has(signalId)) return;

    const tracked = this.activeSignals.get(signalId);
    tracked.status = 'Closed';
    tracked.closeReason = reason;
    tracked.exitPrice = exitPrice;
    tracked.closedAt = Date.now();

    const finalPnL = this.calculatePnL(tracked.signal, exitPrice);
    tracked.finalPnL = finalPnL;

    console.log(`🔒 Signal closed: ${signalId} | Reason: ${reason} | Final PnL: ${finalPnL.toFixed(2)}%`);

    // Emit close event
    this.emit('signal-closed', {
      signalId,
      reason,
      exitPrice,
      finalPnL,
      duration: tracked.closedAt - tracked.startTime
    });
  }

  /**
   * Get tracked signal data
   */
  getSignalData(signalId) {
    return this.activeSignals.get(signalId);
  }

  /**
   * Get all active signals
   */
  getAllActive() {
    return Array.from(this.activeSignals.values())
      .filter(t => t.status === 'Active');
  }

  /**
   * Get all signals (active + closed)
   */
  getAll() {
    return Array.from(this.activeSignals.values());
  }

  /**
   * Get stats
   */
  getStats() {
    const all = this.getAll();
    const active = all.filter(t => t.status === 'Active');
    const closed = all.filter(t => t.status === 'Closed');

    const avgPnL = active.length > 0
      ? active.reduce((sum, t) => sum + t.currentPnL, 0) / active.length
      : 0;

    const winningTrades = closed.filter(t => t.finalPnL > 0).length;
    const losingTrades = closed.filter(t => t.finalPnL <= 0).length;
    const winRate = closed.length > 0 ? (winningTrades / closed.length) * 100 : 0;

    return {
      totalSignals: all.length,
      activeSignals: active.length,
      closedSignals: closed.length,
      avgPnL: avgPnL.toFixed(2),
      winningTrades,
      losingTrades,
      winRate: winRate.toFixed(2)
    };
  }

  /**
   * Cleanup old closed signals
   */
  cleanup() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    for (const [signalId, tracked] of this.activeSignals.entries()) {
      if (tracked.status === 'Closed' && tracked.closedAt < oneHourAgo) {
        this.activeSignals.delete(signalId);
        console.log(`🗑️  Cleaned up old signal: ${signalId}`);
      }
    }
  }
}

// Singleton instance
const tracker = new SignalPnLTracker();

module.exports = tracker;
