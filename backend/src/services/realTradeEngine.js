// Real Trading Engine - Live trading with exchange integration
// CRITICAL: Real money trading - implements strict risk controls
// NEW: Syncs signals from paper trading sessions (copy trading mode)

import settings from '../config/settings.js';
import { Helpers } from '../utils/helpers.js';
import { getExchangeForRealTrade } from '../config/pairs.js';
import path from 'path';

export class RealTradeEngine {
  constructor(dataService, strategyLoader, riskManager) {
    this.dataService = dataService;
    this.strategyLoader = strategyLoader;
    this.riskManager = riskManager;
    this.activeTrades = new Map();
    this.enabled = false;
    this.paperTradeEngine = null; // Will be set externally
    this.pendingOrders = new Map(); // Track orders waiting to be filled
    this.orderCheckInterval = null; // Interval for checking pending orders
    this.sessionsPath = path.join(settings.dataPath, 'real_sessions');
    this.dailyStats = { startBalance: 0, currentBalance: 0, startDate: null, totalPnL: 0 };
    this.maxDailyLossPercent = -30; // -30% max daily loss
  }

  /**
   * Initialize - load saved sessions
   */
  async init() {
    await this.loadSessions();
    await this.loadDailyStats();
    this.resetDailyStatsIfNeeded();
  }

  /**
   * Set paper trade engine reference for signal syncing
   */
  setPaperTradeEngine(paperTradeEngine) {
    this.paperTradeEngine = paperTradeEngine;
    console.log('✅ Real trade engine linked to paper trade for signal sync');
  }

  /**
   * Save sessions to disk
   */
  async saveSessions() {
    try {
      const sessionsData = Array.from(this.activeTrades.values()).map(s => ({
        id: s.id,
        strategy: s.strategy,
        pair: s.pair,
        timeframe: s.timeframe,
        params: s.params,
        exchange: s.exchange,
        capital: s.capital,
        position: s.position,
        trades: s.trades,
        startTime: s.startTime,
        active: s.active,
        paperSessionId: s.paperSessionId,
        syncMode: s.syncMode
      }));

      const filePath = path.join(this.sessionsPath, 'active_sessions.json');
      await Helpers.saveJSON(filePath, sessionsData);
    } catch (err) {
      console.error('Failed to save real sessions:', err.message);
    }
  }

  /**
   * Load sessions from disk
   */
  async loadSessions() {
    try {
      const filePath = path.join(this.sessionsPath, 'active_sessions.json');
      const sessionsData = await Helpers.loadJSON(filePath);

      if (sessionsData && Array.isArray(sessionsData)) {
        for (const sessionData of sessionsData) {
          if (sessionData.active) {
            this.activeTrades.set(sessionData.id, sessionData);
          }
        }
        console.log(`✅ Restored ${this.activeTrades.size} real trading sessions`);
      }
    } catch (err) {
      console.log('No previous real sessions to restore');
    }
  }

  /**
   * Save daily stats
   */
  async saveDailyStats() {
    try {
      const filePath = path.join(this.sessionsPath, 'daily_stats.json');
      await Helpers.saveJSON(filePath, this.dailyStats);
    } catch (err) {
      console.error('Failed to save daily stats:', err.message);
    }
  }

  /**
   * Load daily stats
   */
  async loadDailyStats() {
    try {
      const filePath = path.join(this.sessionsPath, 'daily_stats.json');
      const stats = await Helpers.loadJSON(filePath);
      if (stats) {
        this.dailyStats = stats;
      }
    } catch (err) {
      // No stats to load
    }
  }

  /**
   * Reset daily stats if new day
   */
  resetDailyStatsIfNeeded() {
    const today = new Date().toDateString();
    if (this.dailyStats.startDate !== today) {
      this.dailyStats = {
        startBalance: this.dailyStats.currentBalance || 0,
        currentBalance: this.dailyStats.currentBalance || 0,
        startDate: today,
        totalPnL: 0
      };
      this.saveDailyStats();
      console.log('📅 Daily stats reset for new day');
    }
  }

  /**
   * Update balance and check daily loss limit
   */
  async updateBalanceAndCheckLimit() {
    try {
      const exchange = this.dataService.getExchange('mexc');
      const balance = await exchange.fetchBalance();
      const currentBalance = balance['USDT'].free + balance['USDT'].used;

      // First time setup
      if (this.dailyStats.startBalance === 0) {
        this.dailyStats.startBalance = currentBalance;
        this.dailyStats.currentBalance = currentBalance;
        this.dailyStats.startDate = new Date().toDateString();
      } else {
        this.dailyStats.currentBalance = currentBalance;
      }

      this.dailyStats.totalPnL = currentBalance - this.dailyStats.startBalance;
      const dailyLossPercent = (this.dailyStats.totalPnL / this.dailyStats.startBalance) * 100;

      await this.saveDailyStats();

      // Check daily loss limit
      if (dailyLossPercent <= this.maxDailyLossPercent) {
        console.log(`🚨 DAILY LOSS LIMIT HIT: ${dailyLossPercent.toFixed(2)}% <= ${this.maxDailyLossPercent}%`);
        console.log(`   Start: $${this.dailyStats.startBalance.toFixed(2)}`);
        console.log(`   Current: $${currentBalance.toFixed(2)}`);
        console.log(`   Loss: $${this.dailyStats.totalPnL.toFixed(2)}`);

        await this.emergencyStopAll();
        return false; // Trading stopped
      }

      return true; // Trading can continue
    } catch (err) {
      console.error('Failed to update balance:', err.message);
      return true; // Don't stop on error
    }
  }

  /**
   * Enable real trading (requires confirmation)
   */
  enableTrading() {
    this.enabled = true;
    this.startOrderMonitoring();
    console.log('⚠️  REAL TRADING ENABLED');
  }

  /**
   * Disable real trading
   */
  disableTrading() {
    this.enabled = false;
    this.stopOrderMonitoring();
    console.log('🛑 REAL TRADING DISABLED');
  }

  /**
   * Start monitoring pending orders (check every 10 seconds)
   */
  startOrderMonitoring() {
    if (this.orderCheckInterval) return; // Already running

    this.orderCheckInterval = setInterval(async () => {
      await this.checkPendingOrders();
    }, 10000); // Check every 10 seconds

    console.log('🔍 Order monitoring started (checking every 10s)');
  }

  /**
   * Stop monitoring pending orders
   */
  stopOrderMonitoring() {
    if (this.orderCheckInterval) {
      clearInterval(this.orderCheckInterval);
      this.orderCheckInterval = null;
      console.log('🛑 Order monitoring stopped');
    }
  }

  /**
   * Check all pending orders and cancel if > 1 minute old
   */
  async checkPendingOrders() {
    const now = Date.now();

    for (const [orderId, orderInfo] of this.pendingOrders.entries()) {
      const ageMs = now - orderInfo.timestamp;
      const ageSeconds = ageMs / 1000;

      // Cancel if older than 60 seconds (1 minute)
      if (ageSeconds > 60) {
        console.log(`⏱️  Order ${orderId} is ${ageSeconds.toFixed(0)}s old, cancelling...`);

        try {
          const exchange = this.dataService.getExchange(orderInfo.exchange);

          // Check order status first
          const order = await exchange.fetchOrder(orderId, orderInfo.pair);

          if (order.status === 'open' || order.status === 'pending') {
            // Cancel the order
            await exchange.cancelOrder(orderId, orderInfo.pair);
            console.log(`❌ Order ${orderId} cancelled (${orderInfo.pair} ${orderInfo.side})`);

            // Remove from pending
            this.pendingOrders.delete(orderId);
          } else if (order.status === 'closed' || order.status === 'filled') {
            // Order was filled, process it
            console.log(`✅ Order ${orderId} was filled (${orderInfo.pair} ${orderInfo.side})`);
            await this.handleFilledOrder(orderInfo.sessionId, order);
            this.pendingOrders.delete(orderId);
          } else {
            // Order in unknown state, remove from pending
            console.log(`⚠️  Order ${orderId} in state: ${order.status}, removing from tracking`);
            this.pendingOrders.delete(orderId);
          }
        } catch (err) {
          console.error(`❌ Error checking/cancelling order ${orderId}:`, err.message);
          // Remove from pending if error (order might not exist anymore)
          this.pendingOrders.delete(orderId);
        }
      }
    }
  }

  /**
   * Handle filled order
   */
  async handleFilledOrder(sessionId, order) {
    const session = this.activeTrades.get(sessionId);
    if (!session) return;

    if (order.side === 'buy') {
      session.position = {
        type: 'long',
        entryPrice: order.average || order.price,
        entryTime: order.timestamp,
        size: order.filled,
        cost: order.cost,
        orderId: order.id,
        stopLoss: null,
        takeProfit: null,
        reason: 'Paper trade signal'
      };

      session.capital -= order.cost;

      console.log(`  ✅ BUY ORDER FILLED: ${session.pair} @ ${order.average} | Size: ${order.filled} | Cost: ${order.cost} USDT`);
    } else if (order.side === 'sell') {
      if (!session.position) return;

      const pnl = order.cost - session.position.cost;
      const pnlPercent = (pnl / session.position.cost) * 100;

      session.capital += order.cost;

      const trade = {
        pair: session.pair,
        type: session.position.type,
        entryTime: session.position.entryTime,
        exitTime: order.timestamp,
        entryPrice: session.position.entryPrice,
        exitPrice: order.average,
        size: session.position.size,
        pnl,
        pnlPercent,
        holdingTime: order.timestamp - session.position.entryTime,
        entryReason: session.position.reason,
        exitReason: 'Paper trade signal',
        entryOrderId: session.position.orderId,
        exitOrderId: order.id
      };

      session.trades.push(trade);
      session.position = null;

      console.log(`  ✅ SELL ORDER FILLED: ${session.pair} @ ${order.average} | PnL: ${pnl.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)`);

      // Save sessions and check daily limit after trade
      await this.saveSessions();
      await this.updateBalanceAndCheckLimit();
    }
  }

  /**
   * Start real trading session - synced with paper trade
   */
  async startRealTrade(sessionId, strategyName, pair, timeframe = '1m', params = null) {
    if (!this.enabled) {
      throw new Error('Real trading is disabled. Enable it first.');
    }

    // Check if corresponding paper trade session exists
    if (!this.paperTradeEngine) {
      throw new Error('Paper trade engine not configured. Cannot sync signals.');
    }

    const paperSession = this.paperTradeEngine.getSession(sessionId);
    if (!paperSession) {
      throw new Error(`Paper trade session ${sessionId} not found. Start paper trading first.`);
    }

    const strategy = this.strategyLoader.getStrategy(strategyName);
    if (!strategy) throw new Error(`Strategy ${strategyName} not found`);

    // FORCE MEXC for ALL real trading (user requirement: $6 USDT fixed size on MEXC)
    const exchangeName = 'mexc';

    // SAFE: Only check exchange availability, don't fetch balance yet
    try {
      const exchange = this.dataService.getExchange(exchangeName);
      if (!exchange) {
        throw new Error(`Exchange ${exchangeName} not configured`);
      }
    } catch (err) {
      throw new Error(`Exchange error: ${err.message}. Configure API keys first.`);
    }

    const session = {
      id: sessionId,
      strategy: strategyName,
      pair,
      timeframe,
      params: params || strategy.params,
      exchange: exchangeName,
      capital: settings.initialCapital, // Use settings capital, not fetched balance
      position: null,
      trades: [],
      startTime: Date.now(),
      active: true,
      paperSessionId: sessionId, // Link to paper trade session
      syncMode: 'paper-signal', // Signal source
      lastSyncedSignal: null
    };

    this.activeTrades.set(sessionId, session);

    // Save sessions after adding new one
    await this.saveSessions();

    console.log(`💰 REAL TRADE started (PAPER SYNC MODE): ${strategyName} on ${pair} ${timeframe}`);
    console.log(`   📊 Signals synced from paper session: ${sessionId}`);
    console.log(`   ⚠️  Orders will execute only when paper trade generates signals`);

    return session;
  }

  /**
   * Process signal from paper trade (called externally)
   * This is the MAIN method for syncing paper -> real
   */
  async processPaperSignal(paperSessionId, signal, price, timestamp) {
    const session = this.activeTrades.get(paperSessionId);

    if (!session || !session.active || !this.enabled) {
      return; // Session not active or trading disabled
    }

    // Avoid processing duplicate signals
    if (session.lastSyncedSignal &&
        session.lastSyncedSignal.signal === signal.signal &&
        session.lastSyncedSignal.timestamp === timestamp) {
      return;
    }

    session.lastSyncedSignal = { signal: signal.signal, timestamp };

    console.log(`🔄 Real trade syncing signal from paper: ${signal.signal} ${session.pair} @ ${price}`);

    // Risk management check
    const approved = await this.riskManager.approveSignal(session, signal);
    if (!approved) {
      console.log(`🚫 Signal rejected by risk manager: ${signal.signal} ${session.pair}`);
      return;
    }

    // Execute on real exchange
    try {
      await this.executeSignal(session, signal, price, timestamp);
    } catch (err) {
      console.error(`❌ Real trade execution failed: ${err.message}`);
      // Don't crash - just log and continue
    }
  }

  /**
   * Execute trading signal on real exchange
   */
  async executeSignal(session, signal, price, timestamp) {
    const { position, exchange: exchangeName, pair } = session;

    let exchange;
    try {
      exchange = this.dataService.getExchange(exchangeName);
    } catch (err) {
      console.error(`❌ Cannot get exchange ${exchangeName}: ${err.message}`);
      return;
    }

    try {
      // Entry
      if (signal.signal === 'buy' && !position) {
        // ORDER SIZE from settings (configurable)
        const positionSize = settings.realTradingOrderSize; // Default: $1.50 USDT
        const size = positionSize / price;

        // Format size to exchange precision
        const formattedSize = parseFloat(exchange.amountToPrecision(pair, size));

        console.log(`  📤 Placing REAL BUY order: ${pair} @ ${price} | Size: ${formattedSize} | Cost: $${positionSize.toFixed(2)} USDT`);

        // Place LIMIT buy order (better execution than market)
        const limitPrice = parseFloat(exchange.priceToPrecision(pair, price * 1.001)); // 0.1% above current price for quick fill
        const order = await exchange.createLimitBuyOrder(pair, formattedSize, limitPrice);

        // Track order for monitoring
        this.pendingOrders.set(order.id, {
          orderId: order.id,
          sessionId: session.id,
          pair,
          side: 'buy',
          size,
          price: limitPrice,
          exchange: exchangeName,
          timestamp: Date.now()
        });

        console.log(`  📝 BUY ORDER PLACED: ${pair} @ ${limitPrice.toFixed(6)} | Order ID: ${order.id} | Tracking for 60s`);
      }

      // Exit
      if (position && (signal.signal === 'sell' || signal.signal === 'close')) {
        // Format size to exchange precision (critical for sell orders)
        const formattedSize = parseFloat(exchange.amountToPrecision(pair, position.size));

        console.log(`  📤 Placing REAL SELL order: ${pair} @ ${price} | Size: ${formattedSize}`);

        // Place LIMIT sell order
        const limitPrice = parseFloat(exchange.priceToPrecision(pair, price * 0.999)); // 0.1% below current price for quick fill
        const order = await exchange.createLimitSellOrder(pair, formattedSize, limitPrice);

        // Track order for monitoring
        this.pendingOrders.set(order.id, {
          orderId: order.id,
          sessionId: session.id,
          pair,
          side: 'sell',
          size: position.size,
          price: limitPrice,
          exchange: exchangeName,
          timestamp: Date.now()
        });

        console.log(`  📝 SELL ORDER PLACED: ${pair} @ ${limitPrice.toFixed(6)} | Order ID: ${order.id} | Tracking for 60s`);
      }
    } catch (err) {
      console.error(`❌ REAL order execution failed: ${err.message}`);
      // Log but don't crash the whole system
      console.error(`   Session: ${session.id}, Pair: ${session.pair}`);
      console.error(`   Signal: ${signal.signal}, Price: ${price}`);
    }
  }

  /**
   * Emergency stop all trades
   */
  async emergencyStopAll() {
    console.log('🚨 EMERGENCY STOP - Closing all REAL positions...');

    for (const session of this.activeTrades.values()) {
      if (session.position) {
        try {
          const exchange = this.dataService.getExchange(session.exchange);
          await exchange.createMarketSellOrder(session.pair, session.position.size);
          console.log(`  ✅ Closed REAL position: ${session.pair}`);
        } catch (err) {
          console.error(`  ❌ Failed to close ${session.pair}:`, err.message);
        }
      }
      session.active = false;
    }

    this.disableTrading();
    console.log('🛑 All REAL positions closed. Trading disabled.');
  }

  /**
   * Stop real trading session
   */
  async stopRealTrade(sessionId) {
    const session = this.activeTrades.get(sessionId);
    if (!session) return null;

    // Close open position if exists
    if (session.position) {
      try {
        const exchange = this.dataService.getExchange(session.exchange);
        const order = await exchange.createMarketSellOrder(session.pair, session.position.size);

        const pnl = order.cost - session.position.cost;
        session.capital += order.cost;

        session.trades.push({
          pair: session.pair,
          type: session.position.type,
          entryTime: session.position.entryTime,
          exitTime: Date.now(),
          entryPrice: session.position.entryPrice,
          exitPrice: order.average,
          size: session.position.size,
          pnl,
          pnlPercent: (pnl / session.position.cost) * 100,
          exitReason: 'Session Stopped'
        });

        session.position = null;
        console.log(`  ✅ Closed REAL position on stop: ${session.pair} | PnL: ${pnl.toFixed(2)} USDT`);
      } catch (err) {
        console.error(`❌ Failed to close position on stop: ${err.message}`);
      }
    }

    session.active = false;

    // Save sessions after stopping
    await this.saveSessions();

    console.log(`⏹️  Real trade stopped: ${session.strategy} on ${session.pair}`);

    return session;
  }

  /**
   * Get session
   */
  getSession(sessionId) {
    return this.activeTrades.get(sessionId);
  }

  /**
   * Get total realized ROI (from all closed trades, excluding open positions)
   */
  getTotalRealizedROI() {
    let totalRealizedPnL = 0;
    let totalClosedTrades = 0;

    for (const session of this.activeTrades.values()) {
      const trades = session.trades || [];
      totalClosedTrades += trades.length;
      totalRealizedPnL += trades.reduce((sum, t) => sum + t.pnl, 0);
    }

    // Calculate ROI based on initial capital (not per-session)
    const totalRealizedROI = (totalRealizedPnL / settings.initialCapital) * 100;

    return {
      totalRealizedROI,
      totalRealizedPnL,
      totalClosedTrades
    };
  }

  /**
   * Get all active sessions with detailed metrics
   */
  getAllSessions() {
    return Array.from(this.activeTrades.values()).map(session => {
      // Calculate metrics
      const trades = session.trades || [];
      const wins = trades.filter(t => t.pnl > 0);
      const losses = trades.filter(t => t.pnl < 0);
      const totalProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
      const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
      const netProfit = trades.reduce((sum, t) => sum + t.pnl, 0);
      const roi = (netProfit / settings.initialCapital) * 100;
      const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

      // Calculate Open PnL (unrealized PnL from open position)
      let openPnL = 0;
      if (session.position && this.paperTradeEngine) {
        const paperSession = this.paperTradeEngine.getSession(session.paperSessionId);
        if (paperSession && paperSession.candles && paperSession.candles.length > 0) {
          const currentPrice = paperSession.candles[paperSession.candles.length - 1][4];
          openPnL = (session.position.size * currentPrice) - session.position.cost;
        }
      }

      // Calculate ROI including Open PnL
      const roiWithOpenPnl = ((netProfit + openPnL) / settings.initialCapital) * 100;

      // Get pending orders for this session
      const pendingOrders = Array.from(this.pendingOrders.values())
        .filter(order => order.sessionId === session.id)
        .map(order => ({
          orderId: order.orderId,
          side: order.side,
          pair: order.pair,
          size: order.size,
          price: order.price,
          age: Date.now() - order.timestamp
        }));

      return {
        id: session.id,
        strategy: session.strategy,
        pair: session.pair,
        timeframe: session.timeframe,
        exchange: session.exchange,
        active: session.active,
        syncMode: session.syncMode,
        paperSessionId: session.paperSessionId,
        startTime: session.startTime,
        totalTrades: trades.length,
        openPnL,
        hasOpenPosition: !!session.position,
        hasPendingOrders: pendingOrders.length > 0,
        pendingOrders,
        roiWithOpenPnl, // ROI with open positions included
        metrics: {
          roi,
          winRate,
          totalProfit,
          totalLoss,
          netProfit,
          profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
          currentCapital: session.capital + (session.position ? session.position.cost : 0)
        }
      };
    });
  }
}

export default RealTradeEngine;
