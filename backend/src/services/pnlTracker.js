const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class PnLTracker {
  constructor() {
    this.priceCache = new Map();
    this.updateInterval = null;
    this.subscribedSessions = new Set();
    this.marketDataService = null; // Will be initialized with market data service
  }

  /**
   * Initialize PnL tracker with market data service
   */
  initialize(marketDataService) {
    this.marketDataService = marketDataService;
    this.startTracking();
  }

  /**
   * Start tracking PnL for all active sessions
   */
  startTracking() {
    // Update PnL every second
    this.updateInterval = setInterval(async () => {
      await this.updateAllPositions();
    }, 1000);

    // Load active sessions
    this.loadActiveSessions();
  }

  /**
   * Stop tracking
   */
  stopTracking() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Load all active trading sessions
   */
  async loadActiveSessions() {
    try {
      const sessions = await prisma.tradingSession.findMany({
        where: {
          status: 'active'
        },
        select: {
          id: true
        }
      });

      sessions.forEach(session => {
        this.subscribedSessions.add(session.id);
      });

      console.log(`Loaded ${sessions.length} active sessions for PnL tracking`);
    } catch (error) {
      console.error('Error loading active sessions:', error);
    }
  }

  /**
   * Subscribe to a session for PnL tracking
   */
  subscribeSession(sessionId) {
    this.subscribedSessions.add(sessionId);
  }

  /**
   * Unsubscribe from a session
   */
  unsubscribeSession(sessionId) {
    this.subscribedSessions.delete(sessionId);
  }

  /**
   * Update PnL for all positions in subscribed sessions
   */
  async updateAllPositions() {
    if (this.subscribedSessions.size === 0) return;

    try {
      // Get all open positions from subscribed sessions
      const positions = await this.getOpenPositions();

      if (positions.length === 0) return;

      // Get unique symbols
      const symbols = [...new Set(positions.map(p => p.symbol))];

      // Fetch current prices
      const prices = await this.getCurrentPrices(symbols);

      // Update each position's PnL
      const updates = [];
      for (const position of positions) {
        const currentPrice = prices[position.symbol];
        if (!currentPrice) continue;

        const pnlData = this.calculatePnL(position, currentPrice);
        updates.push({
          positionId: position.id,
          sessionId: position.sessionId,
          ...pnlData
        });
      }

      // Batch update positions in database
      if (updates.length > 0) {
        await this.updatePositionsInDb(updates);
        await this.updateSessionTotals(updates);
        this.broadcastUpdates(updates);
      }

    } catch (error) {
      console.error('Error updating positions PnL:', error);
    }
  }

  /**
   * Get all open positions from subscribed sessions
   */
  async getOpenPositions() {
    const sessionIds = Array.from(this.subscribedSessions);

    const positions = await prisma.position.findMany({
      where: {
        sessionId: { in: sessionIds },
        status: 'open'
      }
    });

    return positions;
  }

  /**
   * Get current prices for symbols
   */
  async getCurrentPrices(symbols) {
    const prices = {};

    for (const symbol of symbols) {
      try {
        // Check cache first (1 second expiry)
        const cached = this.priceCache.get(symbol);
        if (cached && Date.now() - cached.timestamp < 1000) {
          prices[symbol] = cached.price;
          continue;
        }

        // Fetch from market data service
        if (this.marketDataService) {
          const price = await this.marketDataService.getCurrentPrice(symbol);
          prices[symbol] = price;

          // Update cache
          this.priceCache.set(symbol, {
            price,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
      }
    }

    return prices;
  }

  /**
   * Calculate PnL for a position
   */
  calculatePnL(position, currentPrice) {
    const { entryPrice, quantity, side } = position;
    const entryValue = parseFloat(entryPrice) * parseFloat(quantity);

    let pnl, pnlPercent;

    if (side === 'long') {
      // Long position: profit when price goes up
      pnl = (currentPrice - parseFloat(entryPrice)) * parseFloat(quantity);
      pnlPercent = ((currentPrice - parseFloat(entryPrice)) / parseFloat(entryPrice)) * 100;
    } else {
      // Short position: profit when price goes down
      pnl = (parseFloat(entryPrice) - currentPrice) * parseFloat(quantity);
      pnlPercent = ((parseFloat(entryPrice) - currentPrice) / parseFloat(entryPrice)) * 100;
    }

    // Calculate unrealized PnL with fees
    const fees = entryValue * 0.001; // 0.1% fees
    const netPnl = pnl - fees;

    return {
      currentPrice,
      openPnL: parseFloat(netPnl.toFixed(8)),
      openPnLPercent: parseFloat(pnlPercent.toFixed(4)),
      marketValue: currentPrice * parseFloat(quantity)
    };
  }

  /**
   * Update positions in database
   */
  async updatePositionsInDb(updates) {
    // Use transaction for batch update
    await prisma.$transaction(
      updates.map(update =>
        prisma.position.update({
          where: { id: update.positionId },
          data: {
            currentPrice: update.currentPrice,
            openPnL: update.openPnL,
            openPnLPercent: update.openPnLPercent,
            updatedAt: new Date()
          }
        })
      )
    );
  }

  /**
   * Update session totals
   */
  async updateSessionTotals(positionUpdates) {
    // Group updates by session
    const sessionGroups = {};
    positionUpdates.forEach(update => {
      if (!sessionGroups[update.sessionId]) {
        sessionGroups[update.sessionId] = [];
      }
      sessionGroups[update.sessionId].push(update);
    });

    // Update each session
    for (const [sessionId, positions] of Object.entries(sessionGroups)) {
      const totalOpenPnL = positions.reduce((sum, p) => sum + p.openPnL, 0);
      const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

      // Get session to calculate percentages
      const session = await prisma.tradingSession.findUnique({
        where: { id: sessionId },
        select: { startCapital: true, currentBalance: true, realizedPnL: true }
      });

      if (!session) continue;

      const totalPnL = parseFloat(session.realizedPnL || 0) + totalOpenPnL;
      const roi = (totalPnL / parseFloat(session.startCapital)) * 100;

      await prisma.tradingSession.update({
        where: { id: sessionId },
        data: {
          openPnL: totalOpenPnL,
          totalPnL,
          roi,
          updatedAt: new Date()
        }
      });
    }
  }

  /**
   * Broadcast PnL updates via WebSocket
   */
  broadcastUpdates(updates) {
    if (!global.io) return;

    // Group by session for efficient broadcasting
    const sessionGroups = {};
    updates.forEach(update => {
      if (!sessionGroups[update.sessionId]) {
        sessionGroups[update.sessionId] = [];
      }
      sessionGroups[update.sessionId].push(update);
    });

    // Broadcast to each session room
    for (const [sessionId, positions] of Object.entries(sessionGroups)) {
      global.io.to(`session:${sessionId}`).emit('pnl:update', {
        sessionId,
        positions,
        timestamp: new Date()
      });
    }
  }

  /**
   * Get session PnL summary
   */
  async getSessionPnLSummary(sessionId) {
    const positions = await prisma.position.findMany({
      where: { sessionId }
    });

    const openPositions = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status === 'closed');

    // Calculate totals
    const totalOpenPnL = openPositions.reduce((sum, p) => sum + parseFloat(p.openPnL || 0), 0);
    const totalRealizedPnL = closedPositions.reduce((sum, p) => sum + parseFloat(p.realizedPnL || 0), 0);

    // Get best and worst positions
    const bestOpen = openPositions.reduce((best, p) =>
      (!best || parseFloat(p.openPnLPercent) > parseFloat(best.openPnLPercent)) ? p : best
    , null);

    const worstOpen = openPositions.reduce((worst, p) =>
      (!worst || parseFloat(p.openPnLPercent) < parseFloat(worst.openPnLPercent)) ? p : worst
    , null);

    return {
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      totalOpenPnL,
      totalRealizedPnL,
      totalPnL: totalOpenPnL + totalRealizedPnL,
      bestOpenPosition: bestOpen ? {
        symbol: bestOpen.symbol,
        pnl: bestOpen.openPnL,
        pnlPercent: bestOpen.openPnLPercent
      } : null,
      worstOpenPosition: worstOpen ? {
        symbol: worstOpen.symbol,
        pnl: worstOpen.openPnL,
        pnlPercent: worstOpen.openPnLPercent
      } : null
    };
  }

  /**
   * Get detailed position report
   */
  async getPositionReport(positionId) {
    const position = await prisma.position.findUnique({
      where: { id: positionId }
    });

    if (!position) throw new Error('Position not found');

    // Get current price
    const prices = await this.getCurrentPrices([position.symbol]);
    const currentPrice = prices[position.symbol];

    // Calculate detailed PnL
    const pnlData = this.calculatePnL(position, currentPrice);

    // Get price history for chart
    const priceHistory = await this.getPriceHistory(position.symbol, position.openedAt);

    return {
      position,
      currentPrice,
      ...pnlData,
      priceHistory,
      timeHeld: this.calculateTimeHeld(position.openedAt),
      riskRewardRatio: this.calculateRiskReward(position, currentPrice)
    };
  }

  /**
   * Get price history for position chart
   */
  async getPriceHistory(symbol, since) {
    if (!this.marketDataService) return [];

    try {
      const history = await this.marketDataService.getPriceHistory(symbol, since);
      return history;
    } catch (error) {
      console.error(`Error fetching price history for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Calculate time held for position
   */
  calculateTimeHeld(openedAt) {
    const now = new Date();
    const opened = new Date(openedAt);
    const diffMs = now - opened;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Calculate risk-reward ratio
   */
  calculateRiskReward(position, currentPrice) {
    if (!position.stopLoss || !position.takeProfit) return null;

    const entryPrice = parseFloat(position.entryPrice);
    const stopLoss = parseFloat(position.stopLoss);
    const takeProfit = parseFloat(position.takeProfit);

    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);

    return {
      ratio: (reward / risk).toFixed(2),
      riskAmount: risk * parseFloat(position.quantity),
      rewardAmount: reward * parseFloat(position.quantity),
      currentRR: position.side === 'long'
        ? ((currentPrice - entryPrice) / risk).toFixed(2)
        : ((entryPrice - currentPrice) / risk).toFixed(2)
    };
  }

  /**
   * Close position and realize PnL
   */
  async closePosition(positionId, closePrice = null) {
    const position = await prisma.position.findUnique({
      where: { id: positionId }
    });

    if (!position || position.status !== 'open') {
      throw new Error('Position not found or already closed');
    }

    // Get current price if not provided
    if (!closePrice) {
      const prices = await this.getCurrentPrices([position.symbol]);
      closePrice = prices[position.symbol];
    }

    // Calculate realized PnL
    const pnlData = this.calculatePnL(position, closePrice);

    // Update position
    const updatedPosition = await prisma.position.update({
      where: { id: positionId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closePrice,
        realizedPnL: pnlData.openPnL,
        realizedPnLPercent: pnlData.openPnLPercent
      }
    });

    // Update session realized PnL
    await this.updateSessionRealizedPnL(position.sessionId);

    // Broadcast close event
    if (global.io) {
      global.io.to(`session:${position.sessionId}`).emit('position:closed', {
        position: updatedPosition,
        pnl: pnlData.openPnL,
        pnlPercent: pnlData.openPnLPercent
      });
    }

    return updatedPosition;
  }

  /**
   * Update session realized PnL after position close
   */
  async updateSessionRealizedPnL(sessionId) {
    const positions = await prisma.position.findMany({
      where: {
        sessionId,
        status: 'closed'
      }
    });

    const totalRealized = positions.reduce((sum, p) =>
      sum + parseFloat(p.realizedPnL || 0), 0
    );

    await prisma.tradingSession.update({
      where: { id: sessionId },
      data: {
        realizedPnL: totalRealized,
        updatedAt: new Date()
      }
    });
  }
}

module.exports = new PnLTracker();