/**
 * Stop Loss / Take Profit Automation
 * Auto-close signals when SL/TP levels are hit
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PriceFetcher = require('./price-batch-fetcher');

class SLTPAutomation {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 5000; // Check every 5 seconds
    this.intervalId = null;
  }

  /**
   * Start monitoring active signals
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  SL/TP automation already running');
      return;
    }

    this.isRunning = true;
    console.log('🎯 Starting SL/TP automation...');

    this.intervalId = setInterval(async () => {
      await this.checkAllSignals();
    }, this.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 SL/TP automation stopped');
  }

  /**
   * Check all active signals for SL/TP hits
   */
  async checkAllSignals() {
    try {
      // Get all active signals with SL or TP
      const activeSignals = await prisma.signal.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { stopLoss: { not: null } },
            { takeProfit: { not: null } }
          ]
        },
        select: {
          id: true,
          symbol: true,
          direction: true,
          entryPrice: true,
          stopLoss: true,
          takeProfit: true,
          takeProfit2: true,
          takeProfit3: true,
        }
      });

      if (activeSignals.length === 0) return;

      // Get all symbols
      const symbols = [...new Set(activeSignals.map(s => s.symbol))];

      // Fetch current prices (batch fetch - 1 API call)
      const prices = await PriceFetcher.getPrices(symbols);

      let closedCount = 0;

      for (const signal of activeSignals) {
        const currentPrice = prices[signal.symbol];
        if (!currentPrice) continue;

        const shouldClose = this.checkSLTPHit(signal, currentPrice);

        if (shouldClose.hit) {
          await this.closeSignal(signal.id, currentPrice, shouldClose.reason);
          closedCount++;
        }
      }

      if (closedCount > 0) {
        console.log(`✅ Auto-closed ${closedCount} signals via SL/TP`);
      }
    } catch (error) {
      console.error('❌ SL/TP check error:', error.message);
    }
  }

  /**
   * Check if SL or TP was hit
   */
  checkSLTPHit(signal, currentPrice) {
    const { direction, entryPrice, stopLoss, takeProfit } = signal;
    const isLong = direction === 'LONG';

    // Check Stop Loss
    if (stopLoss) {
      if (isLong && currentPrice <= stopLoss) {
        return { hit: true, reason: 'Stop Loss', type: 'SL' };
      }
      if (!isLong && currentPrice >= stopLoss) {
        return { hit: true, reason: 'Stop Loss', type: 'SL' };
      }
    }

    // Check Take Profit
    if (takeProfit) {
      if (isLong && currentPrice >= takeProfit) {
        return { hit: true, reason: 'Take Profit', type: 'TP' };
      }
      if (!isLong && currentPrice <= takeProfit) {
        return { hit: true, reason: 'Take Profit', type: 'TP' };
      }
    }

    return { hit: false };
  }

  /**
   * Close signal when SL/TP hit
   */
  async closeSignal(signalId, exitPrice, reason) {
    try {
      const signal = await prisma.signal.findUnique({
        where: { id: signalId }
      });

      if (!signal) return;

      // Calculate P&L
      const priceDiff = exitPrice - signal.entryPrice;
      const pnlPercent = signal.direction === 'LONG'
        ? (priceDiff / signal.entryPrice) * 100
        : -(priceDiff / signal.entryPrice) * 100;

      // Update signal
      await prisma.signal.update({
        where: { id: signalId },
        data: {
          status: 'CLOSED',
          exitPrice,
          currentPrice: exitPrice,
          profitLoss: pnlPercent,
          closedAt: new Date(),
          note: signal.note
            ? `${signal.note} | Auto-closed: ${reason}`
            : `Auto-closed: ${reason}`
        }
      });

      console.log(`🎯 ${signal.symbol} auto-closed at ${exitPrice} (${reason}): ${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`);
    } catch (error) {
      console.error(`❌ Error closing signal ${signalId}:`, error.message);
    }
  }

  /**
   * Get automation status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      uptime: this.isRunning ? 'Active' : 'Stopped'
    };
  }
}

module.exports = new SLTPAutomation();
