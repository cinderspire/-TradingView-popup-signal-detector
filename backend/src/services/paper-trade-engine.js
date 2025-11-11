const { EventEmitter } = require('events');

class PaperTradeEngine extends EventEmitter {
  constructor() {
    super();
    this.positions = new Map(); // userId -> positions[]
    this.balances = new Map(); // userId -> { USDT: 10000, ... }
    this.trades = new Map(); // tradeId -> trade
    this.priceCache = new Map(); // pair -> price
    this.isMonitoring = false;

    console.log('✅ Paper Trade Engine initialized');
  }

  async initialize() {
    // Start price monitoring
    this.startPriceMonitoring();
    // Start position monitoring
    this.monitorPositions();
  }

  async executeSignal(userId, signal) {
    const executionStart = Date.now();

    try {
      // Get or create user balance
      if (!this.balances.has(userId)) {
        this.balances.set(userId, {
          USDT: 10000, // Starting balance
          equity: 10000,
          availableMargin: 10000
        });
      }

      const balance = this.balances.get(userId);

      // Check if enough balance
      if (balance.availableMargin <= 0) {
        throw new Error('Insufficient balance');
      }

      // Calculate position size with risk management
      const positionSize = this.calculatePositionSize(
        balance,
        signal.entry,
        signal.stopLoss,
        signal.direction
      );

      // Create position
      const position = {
        id: this.generateId(),
        userId,
        pair: signal.pair,
        direction: signal.direction,
        entryPrice: signal.entry,
        currentPrice: signal.entry,
        size: positionSize,
        leverage: 10, // Default 10x leverage
        takeProfit: signal.takeProfit,
        stopLoss: signal.stopLoss,
        timestamp: Date.now(),
        status: 'OPEN',
        pnl: 0,
        pnlPercent: 0,
        margin: (positionSize * signal.entry) / 10, // With 10x leverage
        signalId: signal.id,
        source: signal.source || 'manual'
      };

      // Check margin requirement
      if (position.margin > balance.availableMargin) {
        position.size = (balance.availableMargin * 10) / signal.entry;
        position.margin = balance.availableMargin;
      }

      // Store position
      const userPositions = this.positions.get(userId) || [];
      userPositions.push(position);
      this.positions.set(userId, userPositions);

      // Update balance
      balance.availableMargin -= position.margin;
      this.balances.set(userId, balance);

      // Save to database
      await this.savePosition(position);

      const executionLatency = Date.now() - executionStart;

      console.log(`📈 Paper position opened: ${position.pair} ${position.direction} ${position.size} @ ${position.entryPrice} (${executionLatency}ms)`);

      // Emit event
      this.emit('position_opened', position);

      return {
        success: true,
        position,
        latency: executionLatency
      };

    } catch (error) {
      console.error('❌ Paper trade execution error:', error);
      throw error;
    }
  }

  calculatePositionSize(balance, entryPrice, stopLoss, direction) {
    const riskPercent = 0.02; // 2% risk per trade
    const riskAmount = balance.USDT * riskPercent;

    if (!stopLoss || stopLoss === 0) {
      // If no SL, use 5% default risk
      const maxPositionValue = balance.USDT * 0.5; // Max 50% of balance
      return maxPositionValue / entryPrice;
    }

    // Calculate stop distance
    const stopDistance = Math.abs(entryPrice - stopLoss);
    const stopPercent = stopDistance / entryPrice;

    // Position size based on risk
    const positionValue = riskAmount / stopPercent;

    // Limit to max 50% of balance
    const maxPositionValue = balance.USDT * 0.5;
    const finalPositionValue = Math.min(positionValue, maxPositionValue);

    return finalPositionValue / entryPrice;
  }

  async monitorPositions() {
    this.isMonitoring = true;

    const checkInterval = 100; // Check every 100ms

    const monitor = async () => {
      if (!this.isMonitoring) return;

      try {
        for (const [userId, positions] of this.positions.entries()) {
          for (const position of positions) {
            if (position.status !== 'OPEN') continue;

            // Get current price
            const currentPrice = await this.getCurrentPrice(position.pair);

            if (currentPrice > 0) {
              // Update position
              position.currentPrice = currentPrice;

              // Calculate PnL
              const pnl = this.calculatePnL(position, currentPrice);
              position.pnl = pnl.amount;
              position.pnlPercent = pnl.percent;

              // Update user balance
              const balance = this.balances.get(userId);
              if (balance) {
                // Calculate total equity
                const totalPnL = positions
                  .filter(p => p.status === 'OPEN')
                  .reduce((sum, p) => sum + p.pnl, 0);

                balance.equity = balance.USDT + totalPnL;
                balance.availableMargin = balance.USDT - positions
                  .filter(p => p.status === 'OPEN')
                  .reduce((sum, p) => sum + p.margin, 0);
              }

              // Check if should close
              if (this.shouldClosePosition(position, currentPrice)) {
                await this.closePosition(userId, position.id, currentPrice, 'auto');
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Position monitoring error:', error);
      }

      // Schedule next check
      setTimeout(monitor, checkInterval);
    };

    monitor();

    console.log('✅ Position monitoring started');
  }

  calculatePnL(position, currentPrice) {
    const priceDiff = position.direction === 'LONG'
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;

    const pnlAmount = priceDiff * position.size;
    const pnlPercent = (priceDiff / position.entryPrice) * 100 * position.leverage;

    return {
      amount: pnlAmount,
      percent: pnlPercent
    };
  }

  shouldClosePosition(position, currentPrice) {
    // Check TP
    if (position.takeProfit && position.takeProfit > 0) {
      if (position.direction === 'LONG' && currentPrice >= position.takeProfit) {
        return true;
      }
      if (position.direction === 'SHORT' && currentPrice <= position.takeProfit) {
        return true;
      }
    }

    // Check SL
    if (position.stopLoss && position.stopLoss > 0) {
      if (position.direction === 'LONG' && currentPrice <= position.stopLoss) {
        return true;
      }
      if (position.direction === 'SHORT' && currentPrice >= position.stopLoss) {
        return true;
      }
    }

    // Check liquidation (100% loss)
    if (position.pnlPercent <= -95) {
      return true;
    }

    return false;
  }

  async closePosition(userId, positionId, exitPrice, reason = 'manual') {
    try {
      const userPositions = this.positions.get(userId);
      if (!userPositions) return null;

      const positionIndex = userPositions.findIndex(p => p.id === positionId);
      if (positionIndex === -1) return null;

      const position = userPositions[positionIndex];

      // Calculate final PnL
      const finalPnL = this.calculatePnL(position, exitPrice);

      // Update position
      position.status = 'CLOSED';
      position.exitPrice = exitPrice;
      position.closedAt = Date.now();
      position.pnl = finalPnL.amount;
      position.pnlPercent = finalPnL.percent;
      position.closeReason = reason;

      // Update balance
      const balance = this.balances.get(userId);
      if (balance) {
        balance.USDT += position.margin + finalPnL.amount;
        balance.availableMargin += position.margin;
        balance.equity = balance.USDT;
      }

      // Save to database
      await this.updatePosition(position);

      console.log(`📊 Position closed: ${position.pair} ${position.direction} PnL: ${finalPnL.amount.toFixed(2)} (${finalPnL.percent.toFixed(2)}%) - ${reason}`);

      // Emit event
      this.emit('position_closed', position);

      return position;

    } catch (error) {
      console.error('❌ Close position error:', error);
      throw error;
    }
  }

  async getCurrentPrice(pair) {
    // Check cache first
    const cached = this.priceCache.get(pair);
    if (cached && Date.now() - cached.timestamp < 1000) {
      return cached.price;
    }

    try {
      // Fetch from price service (you'll need to implement this)
      const PriceService = require('./price-service');
      const price = await PriceService.getPrice(pair);

      // Cache price
      this.priceCache.set(pair, {
        price,
        timestamp: Date.now()
      });

      return price;

    } catch (error) {
      console.error(`❌ Error fetching price for ${pair}:`, error);
      return cached ? cached.price : 0;
    }
  }

  async startPriceMonitoring() {
    // Subscribe to price updates via WebSocket
    const PriceService = require('./price-service');

    PriceService.on('price_update', (data) => {
      this.priceCache.set(data.pair, {
        price: data.price,
        timestamp: Date.now()
      });
    });

    console.log('✅ Price monitoring started');
  }

  getUserPositions(userId) {
    return this.positions.get(userId) || [];
  }

  getUserBalance(userId) {
    return this.balances.get(userId) || {
      USDT: 10000,
      equity: 10000,
      availableMargin: 10000
    };
  }

  getUserStats(userId) {
    const positions = this.getUserPositions(userId);
    const openPositions = positions.filter(p => p.status === 'OPEN');
    const closedPositions = positions.filter(p => p.status === 'CLOSED');

    const totalPnL = closedPositions.reduce((sum, p) => sum + p.pnl, 0);
    const winningTrades = closedPositions.filter(p => p.pnl > 0).length;
    const losingTrades = closedPositions.filter(p => p.pnl < 0).length;
    const winRate = closedPositions.length > 0
      ? (winningTrades / closedPositions.length) * 100
      : 0;

    const balance = this.getUserBalance(userId);

    return {
      balance,
      totalPositions: positions.length,
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      totalPnL,
      winningTrades,
      losingTrades,
      winRate,
      roi: ((balance.equity - 10000) / 10000) * 100
    };
  }

  generateId() {
    return `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async savePosition(position) {
    // Save to database
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      await prisma.paperTrade.create({
        data: {
          id: position.id,
          userId: position.userId,
          pair: position.pair,
          direction: position.direction,
          entryPrice: position.entryPrice,
          exitPrice: position.exitPrice || null,
          size: position.size,
          leverage: position.leverage,
          takeProfit: position.takeProfit || null,
          stopLoss: position.stopLoss || null,
          status: position.status,
          pnl: position.pnl,
          pnlPercent: position.pnlPercent,
          margin: position.margin,
          signalId: position.signalId || null,
          source: position.source,
          timestamp: new Date(position.timestamp),
          closedAt: position.closedAt ? new Date(position.closedAt) : null
        }
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error('❌ Database save error:', error);
    }
  }

  async updatePosition(position) {
    // Update in database
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      await prisma.paperTrade.update({
        where: { id: position.id },
        data: {
          exitPrice: position.exitPrice,
          status: position.status,
          pnl: position.pnl,
          pnlPercent: position.pnlPercent,
          closedAt: position.closedAt ? new Date(position.closedAt) : null,
          closeReason: position.closeReason
        }
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error('❌ Database update error:', error);
    }
  }

  async stop() {
    console.log('⏹️  Stopping Paper Trade Engine...');
    this.isMonitoring = false;
    console.log('✅ Paper Trade Engine stopped');
  }
}

// Singleton instance
module.exports = new PaperTradeEngine();
