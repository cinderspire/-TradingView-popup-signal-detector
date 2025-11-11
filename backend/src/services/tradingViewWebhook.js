const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class TradingViewWebhookService {
  constructor() {
    this.alertQueue = [];
    this.processingInterval = null;
    this.strategyPatterns = {
      '3RSI_Strategy': /(?:3\s*RSI|triple.*RSI|RSI.*3|three.*RSI)/i,
      '7RSI_Strategy': /(?:7\s*RSI|seven.*RSI|RSI.*7)/i,
      'MACD_Cross': /(?:MACD.*cross|MACD.*signal)/i,
      'Bollinger_Breakout': /(?:Bollinger|BB.*break|band.*break)/i,
      'Moving_Average_Cross': /(?:MA.*cross|EMA.*cross|SMA.*cross)/i,
      'Stochastic_Oversold': /(?:Stoch.*oversold|Stochastic.*buy)/i,
      'RSI_Divergence': /(?:RSI.*divergence|divergence.*RSI)/i,
      'Volume_Spike': /(?:volume.*spike|unusual.*volume)/i,
      'Support_Resistance': /(?:support.*break|resistance.*break)/i,
      'Momentum_Shift': /(?:momentum.*shift|momentum.*change)/i
    };

    this.actionPatterns = {
      'buy': /(?:buy|long|enter.*long|open.*long|bullish)/i,
      'sell': /(?:sell|short|enter.*short|open.*short|bearish)/i,
      'close': /(?:close|exit|take.*profit|stop.*loss|flat)/i,
      'close_buy': /(?:close.*long|exit.*long|close.*buy)/i,
      'close_sell': /(?:close.*short|exit.*short|close.*sell)/i
    };

    this.startProcessing();
  }

  /**
   * Process incoming webhook from TradingView
   */
  async processWebhook(data, headers) {
    try {
      // Validate webhook signature if configured
      if (process.env.TRADINGVIEW_WEBHOOK_SECRET) {
        const isValid = this.validateSignature(data, headers);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      // Parse and normalize the alert
      const alert = this.parseAlert(data);

      // Auto-detect strategy if not specified
      if (!alert.strategy || alert.strategy === 'unknown') {
        alert.strategy = this.detectStrategy(alert);
      }

      // Detect action if not specified
      if (!alert.action) {
        alert.action = this.detectAction(alert);
      }

      // Validate the alert
      this.validateAlert(alert);

      // Store in database
      const savedAlert = await this.saveAlert(alert);

      // Add to processing queue
      this.alertQueue.push(savedAlert);

      // Return confirmation
      return {
        success: true,
        alertId: savedAlert.id,
        strategy: savedAlert.strategyName,
        action: savedAlert.action,
        symbol: savedAlert.symbol,
        message: 'Alert received and queued for processing'
      };

    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }

  /**
   * Validate webhook signature from TradingView
   */
  validateSignature(data, headers) {
    const secret = process.env.TRADINGVIEW_WEBHOOK_SECRET;
    const signature = headers['x-tradingview-signature'];

    if (!signature) return false;

    const hash = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(data))
      .digest('hex');

    return hash === signature;
  }

  /**
   * Parse incoming alert data
   */
  parseAlert(data) {
    // Handle different alert formats
    let parsed = {
      alertId: data.alertId || crypto.randomUUID(),
      strategy: data.strategy || data.strategyName || 'unknown',
      action: data.action || data.signal || null,
      symbol: this.normalizeSymbol(data.symbol || data.ticker || ''),
      price: parseFloat(data.price || data.close || 0),
      volume: parseFloat(data.volume || 0),
      time: data.time || new Date().toISOString(),
      exchange: data.exchange || 'unknown',
      message: data.message || data.comment || '',
      indicators: {}
    };

    // Extract indicator values from message if present
    if (parsed.message) {
      parsed.indicators = this.extractIndicators(parsed.message);
    }

    // Extract additional fields
    if (data.stopLoss) parsed.stopLoss = parseFloat(data.stopLoss);
    if (data.takeProfit) parsed.takeProfit = parseFloat(data.takeProfit);
    if (data.quantity) parsed.quantity = parseFloat(data.quantity);
    if (data.riskPercent) parsed.riskPercent = parseFloat(data.riskPercent);

    return parsed;
  }

  /**
   * Normalize symbol format (e.g., BTCUSDT -> BTC/USDT)
   */
  normalizeSymbol(symbol) {
    // Remove exchange prefix if present
    symbol = symbol.replace(/^[A-Z]+:/, '');

    // Common patterns
    const patterns = [
      { regex: /^([A-Z]+)(USDT|USD|BUSD|USDC)$/i, format: '$1/$2' },
      { regex: /^([A-Z]+)\/([A-Z]+)$/i, format: '$1/$2' },
      { regex: /^([A-Z]+)-([A-Z]+)$/i, format: '$1/$2' },
      { regex: /^([A-Z]+)_([A-Z]+)$/i, format: '$1/$2' }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(symbol)) {
        return symbol.replace(pattern.regex, pattern.format).toUpperCase();
      }
    }

    return symbol.toUpperCase();
  }

  /**
   * Auto-detect strategy from alert content
   */
  detectStrategy(alert) {
    const searchText = `${alert.message} ${alert.strategy} ${JSON.stringify(alert.indicators)}`;

    for (const [strategy, pattern] of Object.entries(this.strategyPatterns)) {
      if (pattern.test(searchText)) {
        return strategy;
      }
    }

    // Check for custom strategy names in message
    const customMatch = searchText.match(/strategy[:\s]+([a-zA-Z0-9_-]+)/i);
    if (customMatch) {
      return customMatch[1];
    }

    return 'CUSTOM_STRATEGY';
  }

  /**
   * Auto-detect action from alert content
   */
  detectAction(alert) {
    const searchText = `${alert.message} ${alert.action}`;

    for (const [action, pattern] of Object.entries(this.actionPatterns)) {
      if (pattern.test(searchText)) {
        return action;
      }
    }

    // Default based on indicators
    if (alert.indicators.rsi && alert.indicators.rsi < 30) return 'buy';
    if (alert.indicators.rsi && alert.indicators.rsi > 70) return 'sell';

    return 'hold';
  }

  /**
   * Extract indicator values from message
   */
  extractIndicators(message) {
    const indicators = {};

    // RSI pattern
    const rsiMatch = message.match(/RSI[:\s]+(\d+\.?\d*)/i);
    if (rsiMatch) indicators.rsi = parseFloat(rsiMatch[1]);

    // MACD pattern
    const macdMatch = message.match(/MACD[:\s]+(-?\d+\.?\d*)/i);
    if (macdMatch) indicators.macd = parseFloat(macdMatch[1]);

    // Volume pattern
    const volumeMatch = message.match(/Volume[:\s]+(\d+\.?\d*)/i);
    if (volumeMatch) indicators.volume = parseFloat(volumeMatch[1]);

    // Moving average patterns
    const maMatch = message.match(/(?:MA|SMA|EMA)_?(\d+)[:\s]+(\d+\.?\d*)/gi);
    if (maMatch) {
      maMatch.forEach(ma => {
        const parts = ma.match(/(?:MA|SMA|EMA)_?(\d+)[:\s]+(\d+\.?\d*)/i);
        if (parts) {
          indicators[`ma${parts[1]}`] = parseFloat(parts[2]);
        }
      });
    }

    // Stochastic
    const stochMatch = message.match(/Stoch[:\s]+(\d+\.?\d*)/i);
    if (stochMatch) indicators.stochastic = parseFloat(stochMatch[1]);

    // Bollinger Bands
    const bbUpperMatch = message.match(/BB_Upper[:\s]+(\d+\.?\d*)/i);
    const bbLowerMatch = message.match(/BB_Lower[:\s]+(\d+\.?\d*)/i);
    if (bbUpperMatch) indicators.bbUpper = parseFloat(bbUpperMatch[1]);
    if (bbLowerMatch) indicators.bbLower = parseFloat(bbLowerMatch[1]);

    return indicators;
  }

  /**
   * Validate alert data
   */
  validateAlert(alert) {
    const errors = [];

    if (!alert.symbol) errors.push('Symbol is required');
    if (!alert.action) errors.push('Action is required');
    if (alert.price <= 0) errors.push('Valid price is required');

    if (errors.length > 0) {
      throw new Error(`Alert validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Save alert to database
   */
  async saveAlert(alert) {
    return await prisma.tradingViewAlert.create({
      data: {
        alertId: alert.alertId,
        strategyName: alert.strategy,
        action: alert.action,
        symbol: alert.symbol,
        price: alert.price,
        quantity: alert.quantity || null,
        stopLoss: alert.stopLoss || null,
        takeProfit: alert.takeProfit || null,
        message: alert.message || null,
        processed: false
      }
    });
  }

  /**
   * Start processing queued alerts
   */
  startProcessing() {
    this.processingInterval = setInterval(async () => {
      await this.processQueuedAlerts();
    }, 1000); // Process every second
  }

  /**
   * Process alerts in queue
   */
  async processQueuedAlerts() {
    if (this.alertQueue.length === 0) return;

    const alert = this.alertQueue.shift();

    try {
      // Check for active sessions that match this strategy
      const activeSessions = await this.findMatchingSessions(alert);

      for (const session of activeSessions) {
        await this.executeAlert(alert, session);
      }

      // Mark alert as processed
      await prisma.tradingViewAlert.update({
        where: { id: alert.id },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Alert processing error:', error);
      // Re-queue the alert for retry
      this.alertQueue.push(alert);
    }
  }

  /**
   * Find trading sessions that should execute this alert
   */
  async findMatchingSessions(alert) {
    // Find active sessions with matching strategy or auto-trading enabled
    const sessions = await prisma.tradingSession.findMany({
      where: {
        status: 'active',
        OR: [
          { strategy: { name: alert.strategyName } },
          { strategy: { type: 'tradingview' } },
          { autoTrade: true }
        ]
      },
      include: {
        strategy: true,
        user: true
      }
    });

    return sessions;
  }

  /**
   * Execute alert in a trading session
   */
  async executeAlert(alert, session) {
    console.log(`Executing alert ${alert.alertId} for session ${session.id}`);

    // Create trade record
    const trade = await prisma.trade.create({
      data: {
        sessionId: session.id,
        userId: session.userId,
        symbol: alert.symbol,
        action: alert.action,
        entryPrice: alert.price,
        quantity: alert.quantity || this.calculateQuantity(session, alert),
        stopLoss: alert.stopLoss,
        takeProfit: alert.takeProfit,
        status: 'OPEN',
        executedAt: new Date()
      }
    });

    // Update session with new position
    await this.updateSessionPosition(session, trade);

    // Emit WebSocket event
    if (global.io) {
      global.io.to(`session:${session.id}`).emit('alert:executed', {
        alert,
        trade,
        session: session.id
      });
    }

    return trade;
  }

  /**
   * Calculate position quantity based on risk management
   */
  calculateQuantity(session, alert) {
    const riskPercent = alert.riskPercent || 1; // Default 1% risk
    const balance = parseFloat(session.currentBalance);
    const riskAmount = balance * (riskPercent / 100);

    // If stop loss is provided, calculate quantity based on risk
    if (alert.stopLoss) {
      const riskPerUnit = Math.abs(alert.price - alert.stopLoss);
      return riskAmount / riskPerUnit;
    }

    // Otherwise use fixed position size
    return riskAmount / alert.price;
  }

  /**
   * Update session with new position
   */
  async updateSessionPosition(session, trade) {
    const positions = session.positions || [];

    if (trade.action === 'buy' || trade.action === 'sell') {
      // Add new position
      positions.push({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.action === 'buy' ? 'long' : 'short',
        entryPrice: trade.entryPrice,
        quantity: trade.quantity,
        openedAt: trade.executedAt
      });
    } else if (trade.action === 'close') {
      // Close matching positions
      const symbolPositions = positions.filter(p => p.symbol === trade.symbol);
      for (const pos of symbolPositions) {
        pos.status = 'closed';
        pos.closedAt = new Date();
        pos.closePrice = trade.entryPrice;
      }
    }

    await prisma.tradingSession.update({
      where: { id: session.id },
      data: { positions }
    });
  }

  /**
   * Get alert history
   */
  async getAlertHistory(filters = {}) {
    const where = {};

    if (filters.strategyName) where.strategyName = filters.strategyName;
    if (filters.symbol) where.symbol = filters.symbol;
    if (filters.processed !== undefined) where.processed = filters.processed;

    if (filters.startDate || filters.endDate) {
      where.receivedAt = {};
      if (filters.startDate) where.receivedAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.receivedAt.lte = new Date(filters.endDate);
    }

    return await prisma.tradingViewAlert.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: filters.limit || 100
    });
  }

  /**
   * Get strategy performance from alerts
   */
  async getStrategyPerformance(strategyName) {
    const alerts = await prisma.tradingViewAlert.findMany({
      where: {
        strategyName,
        processed: true
      }
    });

    const trades = await prisma.trade.findMany({
      where: {
        alertId: { in: alerts.map(a => a.id) }
      }
    });

    // Calculate performance metrics
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const losingTrades = trades.filter(t => t.pnl < 0).length;
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
      strategyName,
      totalAlerts: alerts.length,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPnL,
      avgPnL: totalTrades > 0 ? totalPnL / totalTrades : 0
    };
  }

  /**
   * Clean up old processed alerts
   */
  async cleanupOldAlerts(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deleted = await prisma.tradingViewAlert.deleteMany({
      where: {
        processed: true,
        processedAt: { lt: cutoffDate }
      }
    });

    console.log(`Cleaned up ${deleted.count} old alerts`);
    return deleted.count;
  }
}

module.exports = new TradingViewWebhookService();