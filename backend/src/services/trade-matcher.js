/**
 * Trade Matcher Service
 *
 * Python benzeri FIFO (First-In-First-Out) trade matching
 * TradingView sinyallerinden gerçek trade'leri çıkarır
 */

class TradeMatcher {
  constructor() {
    this.positions = new Map(); // key: `${strategy}_${pair}`, value: position array
    this.completedTrades = [];
    this.feePerTrade = 0.0005; // 0.05% (Binance futures fee)
  }

  /**
   * Process a signal (BUY or SELL)
   * Python equivalent: analyze_trading_data()
   */
  processSignal(signal) {
    const key = this.getPositionKey(signal);
    const action = this.detectAction(signal);

    console.log(`\n📊 Processing: ${signal.strategy} ${signal.pair} ${action}`);
    console.log(`   marketPosition: ${signal.marketPosition}, positionSize: ${signal.positionSize}`);

    if (action === 'BUY' || action === 'LONG') {
      return this.handleEntry(key, signal);
    } else if (action === 'SELL' || action === 'SHORT') {
      return this.handleExit(key, signal);
    } else if (signal.marketPosition === 'flat') {
      return this.handleFlat(key, signal);
    }

    return null;
  }

  /**
   * Detect action from signal
   */
  detectAction(signal) {
    // TradingView action field
    if (signal.action) {
      const action = signal.action.toUpperCase();
      // Map close/exit/flat to SELL
      if (action === 'CLOSE' || action === 'EXIT' || action === 'FLAT') {
        return 'SELL';
      }
      return action;
    }

    // Direction field
    if (signal.direction) {
      const dir = signal.direction.toUpperCase();
      if (dir === 'LONG') return 'BUY';
      if (dir === 'SHORT' || dir === 'CLOSE' || dir === 'EXIT') return 'SELL';
      return dir;
    }

    // marketPosition logic - handle case-insensitive
    const marketPos = (signal.marketPosition || '').toString().toLowerCase();
    if (marketPos === 'long') return 'BUY';
    if (marketPos === 'short') return 'SELL';
    if (marketPos === 'flat' || marketPos === 'close' || marketPos === 'exit' || marketPos === '') {
      return 'CLOSE';
    }

    // Check contracts - if contracts is 0, it's a close signal
    if (parseFloat(signal.contracts || signal.positionSize || 0) === 0) {
      return 'CLOSE';
    }

    return 'UNKNOWN';
  }

  /**
   * Get position key (strategy + pair)
   */
  getPositionKey(signal) {
    const strategy = signal.strategy || 'Unknown';
    const pair = signal.pair || signal.symbol || 'Unknown';
    return `${strategy}_${pair}`;
  }

  /**
   * Handle ENTRY (BUY/LONG)
   * Python equivalent: if action == 'buy': open_positions.append(...)
   */
  handleEntry(key, signal) {
    if (!this.positions.has(key)) {
      this.positions.set(key, []);
    }

    const position = {
      id: signal.id,
      strategy: signal.strategy,
      pair: signal.pair,
      entryPrice: signal.entry || signal.price || 0,
      amount: parseFloat(signal.contracts || signal.positionSize || signal.amount || 1),
      timestamp: signal.timestamp || signal.createdAt,
      direction: signal.direction || 'LONG'
    };

    this.positions.get(key).push(position);

    console.log(`   ✅ Entry added: ${position.amount} @ $${position.entryPrice}`);
    console.log(`   Total open positions for ${key}: ${this.positions.get(key).length}`);

    return { type: 'ENTRY', position };
  }

  /**
   * Handle EXIT (SELL/SHORT) with FIFO matching
   * Python equivalent: while open_positions and remaining_sell > 0
   */
  handleExit(key, signal) {
    const openPositions = this.positions.get(key);

    if (!openPositions || openPositions.length === 0) {
      console.log(`   ⚠️  No open position to close for ${key}`);
      return null;
    }

    const exitPrice = signal.entry || signal.price || 0;
    let remainingSell = parseFloat(signal.contracts || signal.positionSize || signal.amount || 1);

    console.log(`   🔴 Exit: ${remainingSell} @ $${exitPrice}`);

    const trades = [];

    // FIFO matching - Python: while open_positions and remaining_sell > 0
    while (openPositions.length > 0 && remainingSell > 0) {
      const firstPosition = openPositions[0];

      let tradeAmount;
      if (firstPosition.amount <= remainingSell) {
        // Full close - Python: if buy_pos['amount'] <= remaining_sell
        tradeAmount = firstPosition.amount;
        remainingSell -= tradeAmount;
        openPositions.shift(); // Remove from array
        console.log(`   ✅ FULL close: ${tradeAmount} @ entry $${firstPosition.entryPrice}`);
      } else {
        // Partial close - Python: else: buy_pos['amount'] -= remaining_sell
        tradeAmount = remainingSell;
        firstPosition.amount -= remainingSell;
        remainingSell = 0;
        console.log(`   ⚡ PARTIAL close: ${tradeAmount}, remaining: ${firstPosition.amount}`);
      }

      // Calculate PnL
      const pnl = this.calculatePnL(
        firstPosition.entryPrice,
        exitPrice,
        tradeAmount,
        firstPosition.direction
      );

      const trade = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategy: firstPosition.strategy,
        pair: firstPosition.pair,
        entryId: firstPosition.id,
        exitId: signal.id,
        entryPrice: firstPosition.entryPrice,
        exitPrice: exitPrice,
        amount: tradeAmount,
        direction: firstPosition.direction,
        entryTime: firstPosition.timestamp,
        exitTime: signal.timestamp || signal.createdAt || new Date().toISOString(),
        pnlPercent: pnl.percent,
        pnlUSD: pnl.usd,
        holdingTime: this.calculateHoldingTime(firstPosition.timestamp, signal.timestamp)
      };

      trades.push(trade);
      this.completedTrades.push(trade);

      console.log(`   💰 PnL: ${pnl.percent.toFixed(2)}% ($${pnl.usd.toFixed(2)})`);
    }

    return { type: 'EXIT', trades };
  }

  /**
   * Handle FLAT position - close all open positions for this pair/strategy
   * Python equivalent: marketPosition == 'flat'
   */
  handleFlat(key, signal) {
    const openPositions = this.positions.get(key);

    if (!openPositions || openPositions.length === 0) {
      console.log(`   ℹ️  No open positions for ${key} to flatten`);
      return null;
    }

    console.log(`   🔴 FLATTEN: Closing ${openPositions.length} open positions`);

    const exitPrice = signal.entry || signal.price || 0;
    const trades = [];

    // Close all positions
    while (openPositions.length > 0) {
      const position = openPositions.shift();

      const pnl = this.calculatePnL(
        position.entryPrice,
        exitPrice,
        position.amount,
        position.direction
      );

      const trade = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        strategy: position.strategy,
        pair: position.pair,
        entryId: position.id,
        exitId: signal.id,
        entryPrice: position.entryPrice,
        exitPrice: exitPrice,
        amount: position.amount,
        direction: position.direction,
        entryTime: position.timestamp,
        exitTime: signal.timestamp || signal.createdAt || new Date().toISOString(),
        pnlPercent: pnl.percent,
        pnlUSD: pnl.usd,
        holdingTime: this.calculateHoldingTime(position.timestamp, signal.timestamp),
        closeReason: 'flat'
      };

      trades.push(trade);
      this.completedTrades.push(trade);

      console.log(`   ✅ Closed: ${position.amount} @ $${position.entryPrice} → $${exitPrice} = ${pnl.percent.toFixed(2)}%`);
    }

    return { type: 'FLAT', trades };
  }

  /**
   * Calculate PnL
   * Python: profit_percent = ((exit - entry) / entry) * 100 - (2 * fee)
   */
  calculatePnL(entryPrice, exitPrice, amount, direction = 'LONG') {
    const entry = parseFloat(entryPrice);
    const exit = parseFloat(exitPrice);
    const qty = parseFloat(amount);

    let rawPercent;
    if (direction.toUpperCase() === 'LONG' || direction.toUpperCase() === 'BUY') {
      rawPercent = ((exit - entry) / entry) * 100;
    } else {
      // SHORT position
      rawPercent = ((entry - exit) / entry) * 100;
    }

    // Subtract fees (entry fee + exit fee)
    const percentWithFees = rawPercent - (2 * this.feePerTrade * 100);

    // USD PnL (assuming 1x leverage for simplicity)
    const usdPnl = (percentWithFees / 100) * entry * qty;

    return {
      percent: percentWithFees,
      usd: usdPnl,
      raw: rawPercent
    };
  }

  /**
   * Calculate holding time
   */
  calculateHoldingTime(entryTime, exitTime) {
    const entry = new Date(entryTime);
    const exit = new Date(exitTime || Date.now());
    const diffMs = exit - entry;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    return {
      milliseconds: diffMs,
      hours: diffHours,
      days: diffDays,
      text: diffDays > 0 ? `${diffDays}d ${diffHours % 24}h` : `${diffHours}h`
    };
  }

  /**
   * Get open positions for a key
   */
  getOpenPositions(key) {
    return this.positions.get(key) || [];
  }

  /**
   * Get all open positions
   */
  getAllOpenPositions() {
    const all = [];
    for (const [key, positions] of this.positions.entries()) {
      all.push(...positions.map(p => ({ ...p, key })));
    }
    return all;
  }

  /**
   * Get completed trades
   */
  getCompletedTrades() {
    return this.completedTrades;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const totalTrades = this.completedTrades.length;
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgPnL: 0,
        totalPnL: 0,
        bestTrade: 0,
        worstTrade: 0
      };
    }

    const winningTrades = this.completedTrades.filter(t => t.pnlPercent > 0);
    const losingTrades = this.completedTrades.filter(t => t.pnlPercent < 0);

    const totalPnL = this.completedTrades.reduce((sum, t) => sum + t.pnlPercent, 0);
    const avgPnL = totalPnL / totalTrades;

    const allPnLs = this.completedTrades.map(t => t.pnlPercent);
    const bestTrade = Math.max(...allPnLs);
    const worstTrade = Math.min(...allPnLs);

    return {
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / totalTrades) * 100,
      avgPnL,
      totalPnL,
      bestTrade,
      worstTrade,
      openPositions: this.getAllOpenPositions().length
    };
  }

  /**
   * Reset all data
   */
  reset() {
    this.positions.clear();
    this.completedTrades = [];
  }
}

module.exports = TradeMatcher;
