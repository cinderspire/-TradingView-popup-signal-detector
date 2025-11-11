/**
 * SIMPLE POSITION MONITOR - TP/SL Kontrol + Trailing Stop + Breakeven
 * Multi-exchange desteği ile gelişmiş pozisyon takibi
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const { getInstance: getAdaptiveTPSL } = require('./adaptive-tpsl-calculator');
const { getInstance: getMultiSourcePrice } = require('./multi-source-price-service');
const { decrypt } = require('../utils/encryption');
const ccxt = require('ccxt');

const prisma = new PrismaClient();
const adaptiveTPSL = getAdaptiveTPSL();
const multiSourcePrice = getMultiSourcePrice();

class SimplePositionMonitor {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 5000; // 5 saniye
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Simple Position Monitor already running');
      return;
    }

    this.isRunning = true;
    logger.info('✅ Simple Position Monitor started - checking every 5 seconds');

    this.monitoringLoop();
  }

  async monitoringLoop() {
    while (this.isRunning) {
      await this.checkAllPositions();
      await new Promise(resolve => setTimeout(resolve, this.checkInterval));
    }
  }

  stop() {
    this.isRunning = false;
    logger.info('Simple Position Monitor stopped');
  }

  async checkAllPositions() {
    try {
      // Get all open positions with TP/SL
      const openPositions = await prisma.position.findMany({
        where: {
          status: 'OPEN',
          OR: [
            { takeProfit: { not: null } },
            { stopLoss: { not: null } }
          ]
        }
      });

      if (openPositions.length === 0) {
        return; // No positions to monitor
      }

      logger.info(`🔍 Checking ${openPositions.length} open positions...`);

      for (const position of openPositions) {
        await this.checkPosition(position);
      }

    } catch (error) {
      logger.error('Error checking positions:', error.message);
    }
  }

  async checkPosition(position) {
    try {
      const entryPrice = parseFloat(position.entryPrice);
      let takeProfit = parseFloat(position.takeProfit);
      let stopLoss = parseFloat(position.stopLoss);

      // 🆕 GET REAL-TIME PRICE FROM MULTIPLE SOURCES (MULTI-SOURCE PRICE SERVICE)
      let currentPrice = parseFloat(position.currentPrice); // Fallback to DB price
      let priceConfidence = 0.5; // Low confidence for DB fallback
      let exchange = null;
      let exchangeName = null;

      try {
        // Detect preferred exchange from position notes
        const exchangeMatch = position.notes?.match(/\| ([a-zA-Z]+)$/);
        const preferredExchange = exchangeMatch ? exchangeMatch[1].toLowerCase() : null;

        // 🌟 FETCH PRICE FROM MULTIPLE SOURCES
        const priceResult = await multiSourcePrice.getPrice(position.symbol, {
          preferredExchange: preferredExchange,
          useCache: true,
          minSources: 1
        });

        if (priceResult) {
          currentPrice = priceResult;

          // Get detailed info for confidence
          const priceDetails = await multiSourcePrice.getPriceDetailed(position.symbol);
          const sourceCount = priceDetails.sources?.length || 1;

          // Higher confidence with more sources
          priceConfidence = Math.min(0.9, 0.5 + (sourceCount * 0.2));

          // Update currentPrice in database
          await prisma.position.update({
            where: { id: position.id },
            data: { currentPrice: currentPrice }
          });

          logger.info(`💹 ${position.symbol}: ${currentPrice.toFixed(6)} (${sourceCount} sources, confidence: ${(priceConfidence*100).toFixed(0)}%)`);
        } else {
          // Fallback: Try to get exchange instance for close order
          exchangeName = preferredExchange || 'mexc';
          const apiKey = await prisma.apiKey.findFirst({
            where: { userId: position.userId, exchange: exchangeName, isActive: true }
          });

          if (apiKey) {
            const ExchangeClass = ccxt[exchangeName];
            if (ExchangeClass) {
              exchange = new ExchangeClass({
                apiKey: decrypt(apiKey.apiKey),
                secret: decrypt(apiKey.apiSecret),
                enableRateLimit: true,
                options: { defaultType: 'spot' }
              });
            }
          }
        }

      } catch (priceError) {
        logger.warn(`⚠️ Multi-source price fetch failed for ${position.symbol}: ${priceError.message}`);
        logger.warn(`   Using DB price: ${currentPrice.toFixed(6)}`);
        // Continue with DB price (confidence already set to 0.5)
      }

      if (!currentPrice || !entryPrice) {
        return; // Can't check without prices
      }

      // 🆕 CHECK FOR DYNAMIC TP/SL UPDATES (TRAILING STOP, BREAKEVEN)
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId: position.userId,
          status: 'ACTIVE'
        }
      });

      if (subscription && (subscription.useTrailingStop || subscription.useBreakEven)) {
        const dynamicUpdate = adaptiveTPSL.calculateDynamicTPSL(
          entryPrice,
          currentPrice,
          position.side,
          {
            originalTP: takeProfit,
            originalSL: stopLoss,
            trailingStop: subscription.useTrailingStop ? {
              enabled: true,
              activationPercent: 3.0,  // Activate at 3% profit
              callbackPercent: 2.0     // Trail back by 2%
            } : null,
            breakEven: subscription.useBreakEven ? {
              enabled: true,
              activationPercent: 2.0,  // Move to BE at 2% profit
              offsetPercent: 0.1       // Slightly above entry
            } : null
          }
        );

        if (dynamicUpdate.shouldUpdate) {
          // Update SL in database
          await prisma.position.update({
            where: { id: position.id },
            data: { stopLoss: dynamicUpdate.newSL }
          });

          stopLoss = dynamicUpdate.newSL;
          logger.info(`🔄 ${position.symbol} SL updated: ${dynamicUpdate.modifications.join(', ')}`);
        }
      }

      const side = position.side; // 'LONG' or 'SHORT'
      let shouldClose = false;
      let closeReason = '';

      // 🛡️ CONFIDENCE THRESHOLD - Only act on reliable price data
      const MINIMUM_CONFIDENCE_FOR_CLOSE = 0.6; // 60% confidence required

      // Check Take Profit
      if (takeProfit) {
        if (side === 'LONG' && currentPrice >= takeProfit) {
          shouldClose = true;
          closeReason = 'Take Profit Hit';
        } else if (side === 'SHORT' && currentPrice <= takeProfit) {
          shouldClose = true;
          closeReason = 'Take Profit Hit';
        }
      }

      // Check Stop Loss
      if (stopLoss && !shouldClose) {
        if (side === 'LONG' && currentPrice <= stopLoss) {
          shouldClose = true;
          closeReason = 'Stop Loss Hit';
        } else if (side === 'SHORT' && currentPrice >= stopLoss) {
          shouldClose = true;
          closeReason = 'Stop Loss Hit';
        }
      }

      if (shouldClose) {
        // Safety check: Only close if price confidence is high enough
        if (priceConfidence < MINIMUM_CONFIDENCE_FOR_CLOSE) {
          logger.warn(`⚠️  ${position.symbol} ${closeReason} but price confidence too low: ${(priceConfidence*100).toFixed(0)}%`);
          logger.warn(`   Required: ${(MINIMUM_CONFIDENCE_FOR_CLOSE*100).toFixed(0)}% - Skipping close for safety`);
          return; // Don't close on unreliable price data
        }

        logger.info(`✅ ${position.symbol} ${closeReason} with ${(priceConfidence*100).toFixed(0)}% price confidence - proceeding to close`);
        await this.closePosition(position, currentPrice, closeReason, exchange, exchangeName);
      }

    } catch (error) {
      logger.error(`Error checking position ${position.symbol}:`, error.message);
    }
  }

  async closePosition(position, exitPrice, reason, exchangeInstance = null, exchangeName = null) {
    try {
      logger.info(`\n🔴 CLOSING POSITION: ${position.symbol}`);
      logger.info(`   Reason: ${reason}`);
      logger.info(`   Entry: ${position.entryPrice}`);
      logger.info(`   Exit: ${exitPrice}`);

      // Calculate P&L
      const entryPrice = parseFloat(position.entryPrice);
      const size = parseFloat(position.size);

      let pnl = 0;
      if (position.side === 'LONG') {
        pnl = (exitPrice - entryPrice) * size;
      } else {
        pnl = (entryPrice - exitPrice) * size;
      }

      // 🆕 EXECUTE REAL SELL ORDER ON EXCHANGE (MULTI-EXCHANGE SUPPORT)
      let orderExecuted = false;
      let orderId = null;

      try {
        let exchange = exchangeInstance;

        // If exchange not provided, create new instance
        if (!exchange) {
          // Detect exchange from position notes
          const exchangeMatch = position.notes?.match(/\| ([a-zA-Z]+)$/);
          exchangeName = exchangeMatch ? exchangeMatch[1].toLowerCase() : 'mexc';

          const apiKey = await prisma.apiKey.findFirst({
            where: {
              userId: position.userId,
              exchange: exchangeName,
              isActive: true
            }
          });

          if (!apiKey) {
            throw new Error(`No API key found for ${exchangeName}`);
          }

          const ExchangeClass = ccxt[exchangeName];
          if (!ExchangeClass) {
            throw new Error(`Exchange ${exchangeName} not supported`);
          }

          exchange = new ExchangeClass({
            apiKey: decrypt(apiKey.apiKey),
            secret: decrypt(apiKey.apiSecret),
            enableRateLimit: true,
            options: { defaultType: 'spot' }
          });

          await exchange.loadMarkets();
        }

        // Execute market sell/buy order
        const orderSide = position.side === 'LONG' ? 'sell' : 'buy';
        const order = await exchange.createOrder(
          position.symbol,
          'market',
          orderSide,
          size
        );

        orderId = order.id;
        orderExecuted = true;

        logger.info(`✅ REAL ORDER EXECUTED on ${exchangeName || 'exchange'}: ${order.id}`);
        logger.info(`   Filled: ${order.filled || size} ${position.symbol.split('/')[0]}`);

      } catch (exchangeError) {
        logger.error(`❌ Failed to execute order on exchange: ${exchangeError.message}`);
        logger.warn(`⚠️  Position will be marked as closed in DB but may still exist on exchange!`);
      }

      // Update position to CLOSED in database
      await prisma.position.update({
        where: { id: position.id },
        data: {
          status: 'CLOSED',
          exitPrice: exitPrice,
          realizedPnL: pnl,
          closedAt: new Date(),
          closeReason: orderExecuted ? `${reason} | Order: ${orderId}` : `${reason} (DB only - exchange order failed)`
        }
      });

      logger.info(`✅ Position closed ${orderExecuted ? 'on exchange and in database' : 'in database only'}!`);
      logger.info(`   P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`);
      logger.info(`   P&L%: ${((pnl / (entryPrice * size)) * 100).toFixed(2)}%\n`);

    } catch (error) {
      logger.error(`Error closing position ${position.symbol}:`, error.message);
    }
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval
    };
  }
}

// Export singleton
module.exports = new SimplePositionMonitor();
