/**
 * POSITION MONITOR SERVICE
 * Monitors open positions and automatically closes them when TP/SL is reached
 * Implements trailing stops and break-even protection
 */

const { PrismaClient } = require('@prisma/client');
const ccxt = require('ccxt');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryption');

const prisma = new PrismaClient();

class PositionMonitor {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 5000; // Check every 5 seconds
    this.exchanges = new Map(); // Cache of exchange instances
    this.positionStates = new Map(); // Track position states for trailing stops
  }

  /**
   * Start monitoring positions
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Position monitor already running');
      return;
    }

    this.isRunning = true;
    logger.info('🔍 Position Monitor started - checking every 5 seconds');

    // Start monitoring loop
    this.monitoringLoop();
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isRunning = false;
    logger.info('Position Monitor stopped');
  }

  /**
   * Main monitoring loop
   */
  async monitoringLoop() {
    while (this.isRunning) {
      try {
        await this.checkAllPositions();
      } catch (error) {
        logger.error('Position monitoring error:', error);
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, this.checkInterval));
    }
  }

  /**
   * Check all open positions
   */
  async checkAllPositions() {
    try {
      // Get all open positions with TP/SL
      const openPositions = await prisma.position.findMany({
        where: {
          status: 'OPEN',
          takeProfit: { not: null },
          stopLoss: { not: null }
        },
        include: {
          user: true,
          signal: true
        }
      });

      if (openPositions.length === 0) {
        return; // No positions to monitor
      }

      logger.debug(`📊 Monitoring ${openPositions.length} active positions`);

      // Check each position
      for (const trade of openPositions) {
        await this.checkPosition(trade);
      }
    } catch (error) {
      logger.error('Error checking all positions:', error);
    }
  }

  /**
   * Check a single position
   */
  async checkPosition(trade) {
    try {
      const symbol = position.pair.replace('.P', '');
      const exchange = await this.getExchange(
        position.subscription.activeExchange,
        position.subscription.userId
      );

      if (!exchange) {
        return; // Can't check without exchange access
      }

      // Get current price
      const ticker = await exchange.fetchTicker(symbol);
      const currentPrice = ticker.last;

      // Calculate P&L
      const entryPrice = parseFloat(position.entryPrice);
      const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      const direction = position.direction;

      // Adjust for SHORT positions
      const adjustedPnL = direction === 'SHORT' ? -pnlPercent : pnlPercent;

      // Get TP/SL levels
      let takeProfit = parseFloat(position.adaptiveTakeProfit);
      let stopLoss = parseFloat(position.adaptiveStopLoss);

      // Initialize position state if not exists
      const stateKey = position.id;
      if (!this.positionStates.has(stateKey)) {
        this.positionStates.set(stateKey, {
          highestPnL: adjustedPnL,
          trailingActivated: false,
          breakEvenSet: false
        });
      }

      const state = this.positionStates.get(stateKey);

      // Update highest P&L
      if (adjustedPnL > state.highestPnL) {
        state.highestPnL = adjustedPnL;
      }

      // Check if trailing stop should be applied
      const trailingResult = this.calculateTrailingStop(
        entryPrice,
        currentPrice,
        stopLoss,
        takeProfit,
        state.highestPnL,
        adjustedPnL,
        direction
      );

      if (trailingResult.shouldClose) {
        logger.info(`🎯 Trailing stop triggered for ${symbol}: ${trailingResult.reason}`);
        await this.closePosition(trade, currentPrice, 'TRAILING_STOP');
        this.positionStates.delete(stateKey);
        return;
      }

      // Update stop loss if trailing is active
      if (trailingResult.newStopLoss && trailingResult.newStopLoss !== stopLoss) {
        stopLoss = trailingResult.newStopLoss;
        state.trailingActivated = true;

        // Update in database
        await prisma.position.update({
          where: { id: position.id },
          data: { adaptiveStopLoss: stopLoss.toString() }
        });

        logger.info(`📊 Trailing stop updated for ${symbol}: SL ${stopLoss.toFixed(6)} (${trailingResult.reason})`);
      }

      // Check Take Profit
      if (direction === 'LONG' && currentPrice >= takeProfit) {
        logger.info(`✅ Take Profit reached for ${symbol}: ${currentPrice.toFixed(4)} >= ${takeProfit.toFixed(4)} (+${adjustedPnL.toFixed(2)}%)`);
        await this.closePosition(trade, currentPrice, 'TAKE_PROFIT');
        this.positionStates.delete(stateKey);
        return;
      }

      if (direction === 'SHORT' && currentPrice <= takeProfit) {
        logger.info(`✅ Take Profit reached for ${symbol}: ${currentPrice.toFixed(4)} <= ${takeProfit.toFixed(4)} (+${adjustedPnL.toFixed(2)}%)`);
        await this.closePosition(trade, currentPrice, 'TAKE_PROFIT');
        this.positionStates.delete(stateKey);
        return;
      }

      // Check Stop Loss
      if (direction === 'LONG' && currentPrice <= stopLoss) {
        logger.info(`❌ Stop Loss hit for ${symbol}: ${currentPrice.toFixed(4)} <= ${stopLoss.toFixed(4)} (${adjustedPnL.toFixed(2)}%)`);
        await this.closePosition(trade, currentPrice, 'STOP_LOSS');
        this.positionStates.delete(stateKey);
        return;
      }

      if (direction === 'SHORT' && currentPrice >= stopLoss) {
        logger.info(`❌ Stop Loss hit for ${symbol}: ${currentPrice.toFixed(4)} >= ${stopLoss.toFixed(4)} (${adjustedPnL.toFixed(2)}%)`);
        await this.closePosition(trade, currentPrice, 'STOP_LOSS');
        this.positionStates.delete(stateKey);
        return;
      }

      // Log position status periodically (every 10 checks = ~50 seconds)
      if (!position._checkCount) position._checkCount = 0;
      position._checkCount++;

      if (position._checkCount % 10 === 0) {
        logger.debug(`💰 ${symbol} ${direction}: Entry ${entryPrice.toFixed(4)}, Current ${currentPrice.toFixed(4)}, P&L ${adjustedPnL.toFixed(2)}%, TP ${takeProfit.toFixed(4)}, SL ${stopLoss.toFixed(4)}`);
      }

    } catch (error) {
      logger.error(`Error checking position ${position.pair}:`, error.message);
    }
  }

  /**
   * Close a position
   */
  async closePosition(trade, currentPrice, reason) {
    try {
      const symbol = position.pair.replace('.P', '');
      const exchange = await this.getExchange(
        position.subscription.activeExchange,
        position.subscription.userId
      );

      if (!exchange) {
        logger.error(`Cannot close position ${symbol}: No exchange access`);
        return;
      }

      logger.info(`🔄 Closing position: ${symbol} @ ${currentPrice} (Reason: ${reason})`);

      // Determine order side
      const side = position.direction === 'LONG' ? 'sell' : 'buy';
      const amount = parseFloat(position.amount);

      // Place market order to close
      const order = await exchange.createMarketOrder(
        symbol,
        side,
        amount
      );

      logger.info(`✅ Position closed: ${symbol} - Order ID: ${order.id}`);

      // Calculate final P&L
      const entryPrice = parseFloat(position.entryPrice);
      const pnl = position.direction === 'LONG'
        ? (currentPrice - entryPrice) * amount
        : (entryPrice - currentPrice) * amount;
      const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100 * (position.direction === 'LONG' ? 1 : -1);

      // Update trade in database
      await prisma.position.update({
        where: { id: position.id },
        data: {
          status: 'CLOSED',
          exitPrice: currentPrice.toString(),
          pnl: pnl.toString(),
          closeReason: reason,
          closedAt: new Date()
        }
      });

      // Create execution log
      await prisma.executionLog.create({
        data: {
          subscriptionId: position.subscriptionId,
          signalId: position.signalId,
          action: 'CLOSE',
          exchange: position.subscription.activeExchange,
          pair: position.pair,
          orderType: 'MARKET',
          side: side.toUpperCase(),
          amount: amount.toString(),
          price: currentPrice.toString(),
          status: 'SUCCESS',
          pnl: pnl.toString(),
          reason: reason
        }
      });

      logger.info(`💰 Final P&L: ${pnl.toFixed(2)} USDT (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);

    } catch (error) {
      logger.error(`Error closing position ${position.pair}:`, error);

      // Update status to error
      await prisma.position.update({
        where: { id: position.id },
        data: {
          status: 'ERROR',
          notes: `Close error: ${error.message}`
        }
      });
    }
  }

  /**
   * Get or create exchange instance for user
   */
  async getExchange(exchangeName, userId) {
    const cacheKey = `${exchangeName}_${userId}`;

    // Return cached instance if exists
    if (this.exchanges.has(cacheKey)) {
      return this.exchanges.get(cacheKey);
    }

    try {
      // Get API keys from database
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          userId: userId,
          exchange: exchangeName,
          isActive: true
        }
      });

      if (!apiKey) {
        logger.warn(`No API key found for ${exchangeName} (user: ${userId})`);
        return null;
      }

      // Decrypt credentials
      const decryptedKey = decrypt(apiKey.apiKey);
      const decryptedSecret = decrypt(apiKey.apiSecret);

      // Create exchange instance
      const exchangeClass = ccxt[exchangeName];
      if (!exchangeClass) {
        logger.error(`Exchange ${exchangeName} not supported`);
        return null;
      }

      const exchange = new exchangeClass({
        apiKey: decryptedKey,
        secret: decryptedSecret,
        enableRateLimit: true,
        options: {
          defaultType: 'spot'
        }
      });

      // Test connection
      await exchange.loadMarkets();

      // Cache the instance
      this.exchanges.set(cacheKey, exchange);

      return exchange;
    } catch (error) {
      logger.error(`Error creating exchange instance for ${exchangeName}:`, error);
      return null;
    }
  }

  /**
   * Calculate trailing stop
   * Simple but effective trailing stop logic
   */
  calculateTrailingStop(entryPrice, currentPrice, stopLoss, takeProfit, highestPnL, currentPnL, direction) {
    const result = {
      shouldClose: false,
      newStopLoss: null,
      reason: ''
    };

    // Only apply trailing if position is profitable
    if (currentPnL <= 0) {
      return result;
    }

    // Tier 1: Small profit (>1%) - trail to breakeven
    if (currentPnL > 1.0 && !result.newStopLoss) {
      if (direction === 'LONG') {
        result.newStopLoss = entryPrice * 1.001; // Break-even + 0.1%
      } else {
        result.newStopLoss = entryPrice * 0.999;
      }
      result.reason = 'Small profit - trailing to break-even';
    }

    // Tier 2: Medium profit (>3%) - lock in 1%
    if (currentPnL > 3.0) {
      if (direction === 'LONG') {
        result.newStopLoss = entryPrice * 1.01; // Lock 1% profit
      } else {
        result.newStopLoss = entryPrice * 0.99;
      }
      result.reason = 'Medium profit - locking 1% profit';
    }

    // Tier 3: Good profit (>5%) - lock in 2%
    if (currentPnL > 5.0) {
      if (direction === 'LONG') {
        result.newStopLoss = entryPrice * 1.02; // Lock 2% profit
      } else {
        result.newStopLoss = entryPrice * 0.98;
      }
      result.reason = 'Good profit - locking 2% profit';
    }

    // Tier 4: Great profit (>8%) - lock in 4%
    if (currentPnL > 8.0) {
      if (direction === 'LONG') {
        result.newStopLoss = entryPrice * 1.04; // Lock 4% profit
      } else {
        result.newStopLoss = entryPrice * 0.96;
      }
      result.reason = 'Great profit - locking 4% profit';
    }

    // Tier 5: Excellent profit (>12%) - lock in 6%
    if (currentPnL > 12.0) {
      if (direction === 'LONG') {
        result.newStopLoss = entryPrice * 1.06; // Lock 6% profit
      } else {
        result.newStopLoss = entryPrice * 0.94;
      }
      result.reason = 'Excellent profit - locking 6% profit';
    }

    // Tier 6: Drawdown protection - if profit dropped 50% from peak
    if (highestPnL > 3.0 && currentPnL < highestPnL * 0.5) {
      result.shouldClose = true;
      result.reason = `Drawdown protection - Peak ${highestPnL.toFixed(2)}% dropped to ${currentPnL.toFixed(2)}%`;
      return result;
    }

    // Make sure new stop is better than current stop
    if (result.newStopLoss) {
      if (direction === 'LONG' && result.newStopLoss <= stopLoss) {
        result.newStopLoss = null; // Don't move stop down for LONG
      }
      if (direction === 'SHORT' && result.newStopLoss >= stopLoss) {
        result.newStopLoss = null; // Don't move stop up for SHORT
      }
    }

    return result;
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      trackedPositions: this.positionStates.size,
      cachedExchanges: this.exchanges.size
    };
  }
}

// Export singleton instance
module.exports = new PositionMonitor();
