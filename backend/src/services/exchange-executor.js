const ccxt = require('ccxt');
const { EventEmitter } = require('events');
const { normalizeSymbol, getQuoteCurrency } = require('../utils/symbol-normalizer');
const { PrismaClient } = require('@prisma/client');
const { getInstance: getAdaptiveTPSL } = require('./adaptive-tpsl-calculator');

const prisma = new PrismaClient();
const adaptiveTPSL = getAdaptiveTPSL();

class ExchangeExecutor extends EventEmitter {
  constructor() {
    super();
    this.exchanges = new Map(); // userId_exchangeId -> exchange instance
    this.orders = new Map(); // orderId -> order details
    console.log('✅ Exchange Executor initialized');
  }

  async executeSignal(userId, exchangeId, signal, config) {
    const executionStart = Date.now();

    try {
      // Normalize symbol format (BGBUSDT.P → BGB/USDT)
      const normalizedPair = normalizeSymbol(signal.pair);
      signal.pair = normalizedPair;

      console.log(`🔄 Executing signal on ${exchangeId} for user ${userId}`);

      // NEW: Auto-stop check
      if (config.autoStopEnabled) {
        const currentPnL = config.currentProfitLoss || 0;

        // Check profit target
        if (config.autoStopProfitPercent && currentPnL >= config.autoStopProfitPercent) {
          console.log(`🛑 Auto-stop triggered: Profit target ${config.autoStopProfitPercent}% reached (current: ${currentPnL}%)`);
          throw new Error(`Auto-stop: Profit target ${config.autoStopProfitPercent}% reached`);
        }

        // Check loss limit
        if (config.autoStopLossPercent && currentPnL <= config.autoStopLossPercent) {
          console.log(`🛑 Auto-stop triggered: Loss limit ${config.autoStopLossPercent}% reached (current: ${currentPnL}%)`);
          throw new Error(`Auto-stop: Loss limit ${config.autoStopLossPercent}% reached`);
        }
      }

      // Get exchange instance
      const exchange = await this.getExchange(userId, exchangeId, config);

      // Calculate position size based on config
      const positionSize = await this.calculatePositionSize(
        exchange,
        signal,
        config
      );

      // Create market order
      const orderType = config.orderType || 'market';
      const side = signal.direction === 'LONG' ? 'buy' : 'sell';

      console.log(`📝 Order params: ${signal.pair} ${orderType} ${side} amount=${positionSize} price=${orderType === 'limit' ? signal.entry : 'market'}`);
      console.log(`📝 Position value: ${positionSize * signal.entry} ${signal.pair.split('/')[1]}`);

      // 🆕 GET SUBSCRIPTION CONFIG FOR ADAPTIVE TP/SL (BEFORE ORDER)
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId: userId,
          strategyId: signal.strategyId,
          status: 'ACTIVE'
        }
      });

      // Calculate TP/SL levels (using signal entry as estimate)
      let finalTP = signal.takeProfit;
      let finalSL = signal.stopLoss;
      let tpslSource = 'signal';
      const estimatedEntry = signal.entry;

      if (subscription && subscription.useAdaptiveTPSL) {
        console.log(`📊 Using Adaptive TP/SL (profile: ${subscription.riskProfile || 'balanced'})`);

        // Check for custom overrides first
        if (subscription.customTakeProfit && subscription.customStopLoss) {
          const tpPercent = subscription.customTakeProfit;
          const slPercent = subscription.customStopLoss;

          if (signal.direction === 'LONG') {
            finalTP = estimatedEntry * (1 + tpPercent / 100);
            finalSL = estimatedEntry * (1 - slPercent / 100);
          } else {
            finalTP = estimatedEntry * (1 - tpPercent / 100);
            finalSL = estimatedEntry * (1 + slPercent / 100);
          }

          tpslSource = 'custom';
          console.log(`✅ Custom TP/SL: TP=${tpPercent}% @ ${finalTP.toFixed(6)}, SL=${slPercent}% @ ${finalSL.toFixed(6)}`);

        } else {
          // Use adaptive calculator
          const tpslConfig = adaptiveTPSL.calculateTPSL(
            signal.pair,
            subscription.riskProfile || 'balanced',
            {
              trailingStopEnabled: subscription.useTrailingStop,
              breakEvenEnabled: subscription.useBreakEven
            }
          );

          if (signal.direction === 'LONG') {
            finalTP = estimatedEntry * (1 + tpslConfig.tp / 100);
            finalSL = estimatedEntry * (1 + tpslConfig.sl / 100); // tpslConfig.sl is negative
          } else {
            finalTP = estimatedEntry * (1 - tpslConfig.tp / 100);
            finalSL = estimatedEntry * (1 - tpslConfig.sl / 100);
          }

          tpslSource = 'adaptive';
          console.log(`✅ Adaptive TP/SL: TP=${tpslConfig.tp.toFixed(2)}% @ ${finalTP.toFixed(6)}, SL=${tpslConfig.sl.toFixed(2)}% @ ${finalSL.toFixed(6)}`);
        }
      }

      // 🆕 CREATE POSITION FIRST (OPTIMISTIC TRACKING)
      // Position created BEFORE order attempt - ensures tracking even if order fails
      let position = null;
      try {
        position = await prisma.position.create({
          data: {
            userId: userId,
            signalId: signal.id,
            strategyId: subscription?.id || null,
            symbol: signal.pair,
            side: signal.direction,
            size: positionSize,
            entryPrice: estimatedEntry,
            currentPrice: estimatedEntry,
            stopLoss: finalSL,
            takeProfit: finalTP,
            status: 'OPEN',
            notes: `Optimistic tracking | TP/SL: ${tpslSource} | ${exchangeId} | Pending order execution`
          }
        });
        console.log(`📊 Position created OPTIMISTICALLY: ${position.id} (TP/SL: ${tpslSource})`);
        console.log(`   → Will be tracked even if order fails`);
      } catch (dbError) {
        console.error('❌ Failed to create position in database:', dbError.message);
        // This is critical - if we can't create position, stop here
        throw new Error('Position creation failed - cannot track');
      }

      // NOW TRY TO EXECUTE THE ORDER
      let order = null;
      let orderSuccess = false;

      try {
        // For MEXC market BUY orders, use createMarketBuyOrderWithCost
        if (exchangeId.toLowerCase() === 'mexc' && orderType === 'market' && side === 'buy' && config.marketType === 'spot') {
          console.log(`📝 Using createMarketBuyOrderWithCost for MEXC SPOT`);
          const costInQuote = positionSize * signal.entry;
          order = await exchange.createMarketBuyOrderWithCost(signal.pair, costInQuote);
        } else {
          order = await exchange.createOrder(
            signal.pair,
            orderType,
            side,
            positionSize,
            orderType === 'limit' ? signal.entry : undefined
          );
        }

        console.log(`✅ Order executed successfully: ${order.id}`);
        orderSuccess = true;

        // Store order
        this.orders.set(order.id, {
          ...order,
          userId,
          exchangeId,
          signalId: signal.id,
          positionId: position.id,
          timestamp: Date.now()
        });

        // Update position with real order info
        const actualEntry = order.average || order.price || signal.entry;
        await prisma.position.update({
          where: { id: position.id },
          data: {
            entryPrice: actualEntry,
            currentPrice: actualEntry,
            notes: `Real order: ${order.id} | TP/SL: ${tpslSource} | ${exchangeId}`
          }
        });

        console.log(`📊 Position updated with real order data: ${order.id}`);

      } catch (orderError) {
        console.error(`❌ Order execution FAILED: ${orderError.message}`);
        console.log(`⚠️  BUT position ${position.id} is still being tracked`);
        console.log(`   → Stop loss WILL work even though order failed`);
        console.log(`   → If you manually open this position, it will be monitored`);

        // Update position to mark as virtual
        await prisma.position.update({
          where: { id: position.id },
          data: {
            notes: `VIRTUAL - Order failed: ${orderError.message} | TP/SL: ${tpslSource} | ${exchangeId}`
          }
        });
      }

      // Set TP/SL orders if enabled
      if (config.useTakeProfit && signal.takeProfit) {
        await this.setTakeProfit(exchange, signal, positionSize, order);
      }

      if (config.useStopLoss && signal.stopLoss) {
        await this.setStopLoss(exchange, signal, positionSize, order);
      }

      const executionLatency = Date.now() - executionStart;

      console.log(`✅ Signal executed on ${exchangeId} (${executionLatency}ms)`);

      // Emit event
      this.emit('order_created', {
        userId,
        exchangeId,
        order,
        signal
      });

      return {
        success: true,
        order,
        latency: executionLatency
      };

    } catch (error) {
      console.error(`❌ Exchange execution error:`, error);

      this.emit('execution_error', {
        userId,
        exchangeId,
        signal,
        error: error.message
      });

      throw error;
    }
  }

  async getExchange(userId, exchangeId, config) {
    const key = `${userId}_${exchangeId}`;

    // Return cached instance if exists
    if (this.exchanges.has(key)) {
      return this.exchanges.get(key);
    }

    // Create new exchange instance
    const ExchangeClass = ccxt[exchangeId];

    if (!ExchangeClass) {
      throw new Error(`Exchange ${exchangeId} not supported`);
    }

    // Use marketType from config (spot or future)
    const marketType = config.marketType || 'future'; // Default to futures for backward compatibility
    console.log(`📦 Market type: ${marketType}`);

    const exchange = new ExchangeClass({
      apiKey: config.apiKey,
      secret: config.apiSecret,
      password: config.apiPassword, // For some exchanges
      enableRateLimit: true,
      options: {
        defaultType: marketType, // spot, future, swap
        adjustForTimeDifference: true
      }
    });

    // Load markets
    await exchange.loadMarkets();

    // Set leverage if futures
    if (config.marketType === 'future' || config.marketType === 'swap') {
      try {
        const leverage = config.leverage || 10;
        await exchange.setLeverage(leverage, signal.pair);
      } catch (error) {
        console.warn(`⚠️  Could not set leverage: ${error.message}`);
      }
    }

    // Cache instance
    this.exchanges.set(key, exchange);

    console.log(`✅ Exchange instance created: ${exchangeId}`);

    return exchange;
  }

  async calculatePositionSize(exchange, signal, config) {
    try {
      // Get account balance
      const balance = await exchange.fetchBalance();
      const quote = getQuoteCurrency(signal.pair); // USDT, USD, BTC, etc.
      const availableBalance = balance.free[quote] || 0;

      if (availableBalance === 0) {
        throw new Error(`No ${quote} balance available`);
      }

      let positionValue;

      // NEW: Check if using fixed order size from subscription
      if (config.fixedOrderSize && config.fixedOrderSize > 0) {
        // Use fixed USDT amount
        positionValue = config.fixedOrderSize;
        console.log(`📦 Using fixed order size: ${positionValue} ${quote}`);
      }
      // NEW: Check if using percentage of balance from subscription
      else if (config.usePercentage && config.orderSizePercent > 0) {
        // Use percentage of available balance
        positionValue = availableBalance * (config.orderSizePercent / 100);
        console.log(`📦 Using ${config.orderSizePercent}% of balance: ${positionValue} ${quote}`);
      }
      // LEGACY: Calculate position size based on risk percentage (old method)
      else if (config.riskPercent) {
        const riskPercent = config.riskPercent || 2; // Default 2%
        const riskAmount = availableBalance * (riskPercent / 100);

        // If stop loss is set, calculate position size based on risk
        if (signal.stopLoss && signal.stopLoss > 0) {
          const stopDistance = Math.abs(signal.entry - signal.stopLoss);
          const stopPercent = stopDistance / signal.entry;

          positionValue = riskAmount / stopPercent;
          const maxPositionValue = availableBalance * (config.maxPositionPercent || 50) / 100;

          positionValue = Math.min(positionValue, maxPositionValue);
        } else {
          // Default: use fixed percentage of balance
          const maxPositionPercent = config.maxPositionPercent || 10;
          positionValue = availableBalance * (maxPositionPercent / 100);
        }
        console.log(`📦 Using risk-based calculation: ${positionValue} ${quote}`);
      }
      // FALLBACK: Use 10% of balance
      else {
        positionValue = availableBalance * 0.1;
        console.log(`📦 Using default 10% of balance: ${positionValue} ${quote}`);
      }

      // Ensure we don't exceed available balance
      if (positionValue > availableBalance) {
        console.warn(`⚠️  Position size (${positionValue}) exceeds available balance (${availableBalance}), capping to available`);
        positionValue = availableBalance * 0.95; // Use 95% to leave room for fees
      }

      // Calculate position size (amount of contracts/coins)
      const positionSize = positionValue / signal.entry;
      console.log(`📊 Calculated position size: ${positionSize} ${signal.pair.split('/')[0]} (value: ${positionValue} ${quote})`);

      const rounded = this.roundToLotSize(exchange, signal.pair, positionSize);
      console.log(`📊 After lot size rounding: ${rounded} ${signal.pair.split('/')[0]}`);

      return rounded;

    } catch (error) {
      console.error('❌ Position size calculation error:', error);
      throw error;
    }
  }

  roundToLotSize(exchange, symbol, amount) {
    const market = exchange.market(symbol);

    if (market && market.limits && market.limits.amount) {
      const min = market.limits.amount.min || 0;
      const precisionAmount = market.precision ? market.precision.amount : 8;

      // Determine if precision is step size (0.01) or decimal places (2)
      let factor;
      if (precisionAmount < 1) {
        // Step size (e.g., 0.01 means 2 decimal places)
        factor = Math.round(1 / precisionAmount);
      } else {
        // Number of decimal places
        factor = Math.pow(10, precisionAmount);
      }

      // Round to precision
      let rounded = Math.floor(amount * factor) / factor;

      // Ensure minimum
      if (rounded < min) {
        rounded = min;
      }

      return rounded;
    }

    return amount;
  }

  async setTakeProfit(exchange, signal, size, originalOrder) {
    try {
      const side = signal.direction === 'LONG' ? 'sell' : 'buy';

      const tpOrder = await exchange.createOrder(
        signal.pair,
        'limit',
        side,
        size,
        signal.takeProfit,
        {
          reduceOnly: true,
          postOnly: false
        }
      );

      console.log(`✅ Take Profit set @ ${signal.takeProfit}`);

      return tpOrder;

    } catch (error) {
      console.error('❌ Take Profit error:', error);
    }
  }

  async setStopLoss(exchange, signal, size, originalOrder) {
    try {
      const side = signal.direction === 'LONG' ? 'sell' : 'buy';

      // Try stop market order first
      try {
        const slOrder = await exchange.createOrder(
          signal.pair,
          'stop_market',
          side,
          size,
          undefined,
          {
            stopPrice: signal.stopLoss,
            reduceOnly: true
          }
        );

        console.log(`✅ Stop Loss set @ ${signal.stopLoss}`);
        return slOrder;

      } catch (stopMarketError) {
        // Fallback to stop limit
        console.warn('⚠️  Stop market failed, trying stop limit');

        const slOrder = await exchange.createOrder(
          signal.pair,
          'stop_limit',
          side,
          size,
          signal.stopLoss,
          {
            stopPrice: signal.stopLoss,
            reduceOnly: true
          }
        );

        console.log(`✅ Stop Loss (limit) set @ ${signal.stopLoss}`);
        return slOrder;
      }

    } catch (error) {
      console.error('❌ Stop Loss error:', error);
    }
  }

  async getOpenOrders(userId, exchangeId, config) {
    try {
      const exchange = await this.getExchange(userId, exchangeId, config);
      const orders = await exchange.fetchOpenOrders();

      return orders;

    } catch (error) {
      console.error('❌ Fetch open orders error:', error);
      return [];
    }
  }

  async getPositions(userId, exchangeId, config) {
    try {
      const exchange = await this.getExchange(userId, exchangeId, config);

      if (exchange.has['fetchPositions']) {
        const positions = await exchange.fetchPositions();
        return positions.filter(p => p.contracts > 0);
      }

      return [];

    } catch (error) {
      console.error('❌ Fetch positions error:', error);
      return [];
    }
  }

  async closePosition(userId, exchangeId, symbol, config) {
    try {
      const exchange = await this.getExchange(userId, exchangeId, config);

      // Get current position
      const positions = await exchange.fetchPositions([symbol]);
      const position = positions.find(p => p.symbol === symbol);

      if (!position || position.contracts === 0) {
        throw new Error('No open position found');
      }

      // Close position with market order
      const side = position.side === 'long' ? 'sell' : 'buy';
      const size = Math.abs(position.contracts);

      const order = await exchange.createOrder(
        symbol,
        'market',
        side,
        size,
        undefined,
        { reduceOnly: true }
      );

      console.log(`✅ Position closed: ${symbol}`);

      return order;

    } catch (error) {
      console.error('❌ Close position error:', error);
      throw error;
    }
  }

  async cancelOrder(userId, exchangeId, orderId, symbol, config) {
    try {
      const exchange = await this.getExchange(userId, exchangeId, config);
      await exchange.cancelOrder(orderId, symbol);

      console.log(`✅ Order cancelled: ${orderId}`);

      return true;

    } catch (error) {
      console.error('❌ Cancel order error:', error);
      throw error;
    }
  }

  async stop() {
    console.log('⏹️  Stopping Exchange Executor...');

    // Close all exchange connections
    for (const exchange of this.exchanges.values()) {
      try {
        await exchange.close();
      } catch (error) {
        console.error('❌ Error closing exchange:', error);
      }
    }

    this.exchanges.clear();

    console.log('✅ Exchange Executor stopped');
  }
}

// Singleton instance
module.exports = new ExchangeExecutor();
