const { PrismaClient } = require('@prisma/client');
const { EventEmitter } = require('events');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

/**
 * SUBSCRIPTION EXECUTOR SERVICE
 *
 * Automatically executes orders for active subscriptions with API keys configured.
 * Works independently of WebSocket connections.
 *
 * Features:
 * - Monitors Signal Coordinator events
 * - Matches signals to active subscriptions
 * - Executes orders via Exchange Executor
 * - Logs all executions to database
 * - Handles errors gracefully
 */
class SubscriptionExecutor extends EventEmitter {
  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.executionQueue = [];
    this.isProcessing = false;
    this.stats = {
      totalSignalsProcessed: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      lastExecutionTime: null
    };

    // CRITICAL: Position tracking to prevent duplicate entries
    this.openPositions = new Map(); // Key: userId_exchange_symbol → {orderId, amount, entryPrice, side, openedAt}

    // CRITICAL: Minimum balance to prevent over-trading
    this.MIN_BALANCE_USDT = 5; // Don't trade if balance < $5

    logger.info('✅ Subscription Executor initialized');
  }

  /**
   * Start listening to signal events
   */
  initialize(signalCoordinator) {
    if (!signalCoordinator) {
      logger.error('❌ SignalCoordinator is required');
      return;
    }

    // Listen for new signals from Signal Coordinator
    signalCoordinator.on('signal_processed', async (signal) => {
      await this.processSignal(signal);
    });

    logger.info('✅ Subscription Executor listening for signals');
  }

  /**
   * Process incoming signal and execute for matching subscriptions
   */
  async processSignal(signal) {
    const processStart = Date.now();

    try {
      this.stats.totalSignalsProcessed++;

      logger.info(`\n${'='.repeat(80)}`);
      logger.info(`🎯 SUBSCRIPTION EXECUTOR: Processing Signal`);
      logger.info(`${'='.repeat(80)}`);
      logger.info(`Signal ID: ${signal.id}`);
      logger.info(`Pair:      ${signal.pair}`);
      logger.info(`Direction: ${signal.direction}`);
      logger.info(`Strategy:  ${signal.strategy || 'N/A'}`);
      logger.info(`${'='.repeat(80)}\n`);

      // Find matching active subscriptions
      const matchingSubscriptions = await this.findMatchingSubscriptions(signal);

      if (matchingSubscriptions.length === 0) {
        logger.info(`ℹ️  No matching subscriptions found for signal ${signal.id}`);
        return;
      }

      logger.info(`✅ Found ${matchingSubscriptions.length} matching subscription(s)`);

      // Execute orders for each matching subscription
      const executionPromises = matchingSubscriptions.map(async (subscription) => {
        return await this.executeForSubscription(subscription, signal);
      });

      const results = await Promise.allSettled(executionPromises);

      // Log results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      this.stats.totalExecutions += results.length;
      this.stats.successfulExecutions += successful;
      this.stats.failedExecutions += failed;
      this.stats.lastExecutionTime = new Date().toISOString();

      const processingTime = Date.now() - processStart;

      logger.info(`\n✅ SUBSCRIPTION EXECUTOR: Complete`);
      logger.info(`   - Subscriptions: ${matchingSubscriptions.length}`);
      logger.info(`   - Successful:    ${successful}`);
      logger.info(`   - Failed:        ${failed}`);
      logger.info(`   - Time:          ${processingTime}ms\n`);

    } catch (error) {
      logger.error('❌ Subscription Executor error:', error);
    }
  }

  /**
   * Find subscriptions that match this signal
   */
  async findMatchingSubscriptions(signal) {
    try {
      // Normalize strategy name: "P3RSI" → "3RSI", "P7RSI" → "7RSI", "PGRID" → "GRID"
      let normalizedStrategy = signal.strategy;
      if (signal.strategy && signal.strategy.startsWith('P')) {
        normalizedStrategy = signal.strategy.substring(1); // Remove "P" prefix
      }

      // Query active subscriptions (API keys checked separately)
      const subscriptions = await this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          // Match by strategy if available
          ...(signal.strategyId && {
            strategyId: signal.strategyId
          })
        },
        include: {
          strategy: {
            select: {
              id: true,
              name: true
            }
          },
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });

      // FLEXIBLE MATCHING: Match by pair first, strategy is secondary
      const matching = subscriptions.filter(sub => {
        // Check if pair matches
        const pairMatches = sub.allPairs ||
          (sub.subscribedPairs && sub.subscribedPairs.length > 0 &&
           sub.subscribedPairs.includes(signal.pair));

        if (!pairMatches) {
          return false; // Pair must match
        }

        // If no strategy in signal, match by pair only
        if (!normalizedStrategy) {
          return true; // Pair matched, no strategy to check
        }

        // If strategy exists, try to match it (but don't fail if no match)
        // This allows signals without strategy to still execute
        if (sub.strategy && sub.strategy.name === normalizedStrategy) {
          return true; // Perfect match: pair + strategy
        }

        // Pair matches but strategy doesn't - still allow it
        // User has 147 pairs across 3 strategies, signal should execute
        return true;
      });

      return matching;

    } catch (error) {
      logger.error('❌ Error finding matching subscriptions:', error);
      return [];
    }
  }

  /**
   * Execute order for a single subscription
   */
  async executeForSubscription(subscription, signal) {
    const executionStart = Date.now();

    try {
      logger.info(`🔄 Executing for user ${subscription.user.email} (${subscription.activeExchange})`);

      // Check auto-stop limits
      if (subscription.autoStopEnabled) {
        const shouldStop = this.checkAutoStop(subscription);
        if (shouldStop) {
          logger.warn(`🛑 Auto-stop triggered for subscription ${subscription.id}`);
          throw new Error(`Auto-stop: ${shouldStop}`);
        }
      }

      // Get API keys from separate ApiKey table
      const userApiKey = await this.prisma.apiKey.findFirst({
        where: {
          userId: subscription.userId,
          exchange: subscription.activeExchange,
          isActive: true
        }
      });

      if (!userApiKey) {
        logger.error(`❌ No API key found for ${subscription.activeExchange}`);
        throw new Error(`No API key configured for ${subscription.activeExchange}`);
      }

      // Decrypt API keys
      const apiKey = decrypt(userApiKey.apiKey);
      const apiSecret = decrypt(userApiKey.apiSecret);

      // Prepare exchange config
      const exchangeConfig = {
        apiKey,
        apiSecret,
        apiPassword: subscription.exchangeApiPassword ? decrypt(subscription.exchangeApiPassword) : undefined,
        // marketType: 'spot' or 'future' (not orderType which is 'market'/'limit')
        marketType: subscription.orderType === 'SPOT' ? 'spot' : 'future',
        leverage: subscription.leverage || 10,
        useTakeProfit: true,
        useStopLoss: true,
        autoStopEnabled: subscription.autoStopEnabled,
        autoStopProfitPercent: subscription.autoStopProfitPercent,
        autoStopLossPercent: subscription.autoStopLossPercent,
        currentProfitLoss: subscription.currentProfitLoss || 0
      };

      // 🤖 AI + ADAPTIVE TP/SL CALCULATION
      if (subscription.useAdaptiveTPSL || subscription.useAIRiskControl) {
        try {
          logger.info(`🤖 Calculating AI + Adaptive TP/SL for ${signal.pair}...`);

          let takeProfitPercent = null;
          let stopLossPercent = null;

          // Use AI Risk Control if enabled
          if (subscription.useAIRiskControl) {
            const AIRiskControl = require('./ai-risk-control');
            const aiService = AIRiskControl.getInstance();

            // Get balance for context
            const ccxt = require('ccxt');
            const balanceCheck = new ccxt[subscription.activeExchange]({
              apiKey,
              secret: apiSecret,
              enableRateLimit: true,
              options: { defaultType: 'spot' }
            });
            await balanceCheck.loadMarkets();
            const balance = await balanceCheck.fetchBalance();
            const usdtBalance = balance.free['USDT'] || 0;
            await balanceCheck.close();

            // Prepare AI context
            const aiContext = {
              symbol: signal.pair,
              direction: signal.direction,
              entryPrice: signal.entry || signal.entryPrice,
              currentPrice: signal.entry || signal.entryPrice,
              balance: usdtBalance,
              openPositionsCount: this.openPositions.size,
              recentPnL: subscription.currentProfitLoss,
              marketData: null,
              historicalPerformance: null
            };

            // Get AI recommendation
            const aiRecommendation = await aiService.getTPSLRecommendation(aiContext);

            takeProfitPercent = aiRecommendation.takeProfit;
            stopLossPercent = aiRecommendation.stopLoss;

            logger.info(`🤖 AI TP/SL: TP ${takeProfitPercent}%, SL ${stopLossPercent}% (confidence: ${aiRecommendation.confidence})`);

            // Log AI decision for transparency
            subscription.aiDecisionLog = {
              timestamp: new Date().toISOString(),
              signal: signal.pair,
              recommendation: aiRecommendation
            };
          }
          // Use Adaptive TP/SL if AI not enabled
          else if (subscription.useAdaptiveTPSL) {
            const AdaptiveTPSLCalculator = require('./adaptive-tpsl-calculator');
            const calculator = AdaptiveTPSLCalculator.getInstance();

            const profile = subscription.riskProfile || 'balanced';
            const tpsl = calculator.calculateTPSL(signal.pair, profile, {
              useGlobalDefaults: !subscription.usePairSpecificTPSL,
              trailingStopEnabled: subscription.useTrailingStop,
              breakEvenEnabled: subscription.useBreakEven
            });

            takeProfitPercent = tpsl.tp;
            stopLossPercent = tpsl.sl;

            logger.info(`📊 Adaptive TP/SL (${profile}): TP ${takeProfitPercent}%, SL ${stopLossPercent}%`);
          }

          // Apply custom overrides if specified
          if (subscription.customTakeProfit) {
            takeProfitPercent = subscription.customTakeProfit;
            logger.info(`🔧 Using custom TP: ${takeProfitPercent}%`);
          }
          if (subscription.customStopLoss) {
            stopLossPercent = subscription.customStopLoss;
            logger.info(`🔧 Using custom SL: ${stopLossPercent}%`);
          }

          // Add to exchange config
          if (takeProfitPercent) {
            exchangeConfig.takeProfitPercent = takeProfitPercent;
          }
          if (stopLossPercent) {
            exchangeConfig.stopLossPercent = Math.abs(stopLossPercent); // Ensure positive
          }
          if (subscription.useTrailingStop) {
            exchangeConfig.useTrailingStop = true;
          }
          if (subscription.useBreakEven) {
            exchangeConfig.useBreakEven = true;
          }

        } catch (error) {
          logger.error(`❌ AI/Adaptive TP/SL calculation failed: ${error.message}`);
          // Continue with default values
        }
      }

      // CRITICAL: Check for existing position (prevent duplicates)
      const positionKey = `${subscription.user.id}_${subscription.activeExchange}_${signal.pair}`;
      const hasOpenPosition = this.openPositions.has(positionKey);

      // CRITICAL: Handle EXIT/CLOSE signals for BOTH SPOT and FUTURES
      // Detect exit signals: type='EXIT', direction='SHORT' (for spot), or direction='CLOSE'
      const isExitSignal = signal.type === 'EXIT' ||
                          signal.direction === 'CLOSE' ||
                          (signal.direction === 'SHORT' && exchangeConfig.marketType === 'spot');

      if (isExitSignal) {
        logger.info(`🔄 EXIT SIGNAL DETECTED: ${signal.pair} (type: ${signal.type}, direction: ${signal.direction})`);

        if (!hasOpenPosition) {
          logger.warn(`⚠️  EXIT signal but no open position tracked for ${signal.pair}`);
          // Try to close via exchange-executor anyway (might have position on exchange)
          try {
            const executor = require('./exchange-executor');
            const result = await executor.closePosition(
              subscription.user.id,
              subscription.activeExchange,
              signal.pair,
              exchangeConfig
            );
            logger.info(`✅ Position closed via executor: ${signal.pair}`);
            return { success: true, action: 'position_closed_via_executor', result };
          } catch (error) {
            logger.warn(`⚠️  Could not close position: ${error.message}`);
            return { success: false, reason: 'No open position to close' };
          }
        }

        // Close existing tracked position
        const position = this.openPositions.get(positionKey);
        logger.info(`🔒 Closing tracked position: ${signal.pair} (${position.amount} contracts)`);

        const ccxt = require('ccxt');
        const exchange = new ccxt[subscription.activeExchange]({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          options: { defaultType: exchangeConfig.marketType }
        });

        await exchange.loadMarkets();

        let closeOrder;
        if (exchangeConfig.marketType === 'spot') {
          // SPOT: Sell the amount we bought
          closeOrder = await exchange.createMarketSellOrder(signal.pair, position.amount);
        } else {
          // FUTURES: Close position (reduce position to 0)
          closeOrder = await exchange.createOrder(
            signal.pair,
            'market',
            'sell', // Opposite of entry side
            position.amount,
            undefined,
            { reduceOnly: true }
          );
        }

        // Remove from tracking
        this.openPositions.delete(positionKey);

        logger.info(`✅ Position closed: ${signal.pair} - Order: ${closeOrder.id}`);

        await this.logExecution({
          userId: subscription.user.id,
          subscriptionId: subscription.id,
          signalId: signal.id,
          exchange: subscription.activeExchange,
          orderType: 'MARKET',
          side: 'sell',
          symbol: signal.pair,
          amount: position.amount,
          price: closeOrder.price || signal.entry,
          orderId: closeOrder.id,
          status: 'SUCCESS',
          executionTimeMs: Date.now() - executionStart
        });

        await exchange.close();
        return { success: true, action: 'position_closed', order: closeOrder };
      }

      // CRITICAL: Skip if position already exists (ENTRY signal)
      if (hasOpenPosition && (signal.type === 'ENTRY' || signal.direction === 'LONG')) {
        logger.warn(`⚠️  Position already open for ${signal.pair} - SKIPPING to prevent duplicate`);
        return { success: false, reason: 'Position already exists' };
      }

      // CRITICAL: Check minimum balance before opening new position
      const ccxt = require('ccxt');
      const balanceCheck = new ccxt[subscription.activeExchange]({
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        options: { defaultType: 'spot' }
      });

      await balanceCheck.loadMarkets();
      const balance = await balanceCheck.fetchBalance();
      const usdtBalance = balance.free['USDT'] || 0;
      await balanceCheck.close();

      if (usdtBalance < this.MIN_BALANCE_USDT) {
        logger.error(`❌ Insufficient balance: ${usdtBalance} USDT (min: ${this.MIN_BALANCE_USDT})`);
        throw new Error(`Insufficient balance: ${usdtBalance.toFixed(2)} USDT (minimum: ${this.MIN_BALANCE_USDT} USDT required)`);
      }

      logger.info(`💰 Balance OK: ${usdtBalance.toFixed(2)} USDT`);

      // Calculate position size
      if (subscription.usePercentage && subscription.orderSizePercent) {
        exchangeConfig.usePercentage = true;
        exchangeConfig.orderSizePercent = subscription.orderSizePercent;
      } else if (subscription.fixedOrderSize) {
        exchangeConfig.fixedOrderSize = subscription.fixedOrderSize;
      } else {
        // Default to 2% risk
        exchangeConfig.riskPercent = 2;
      }

      // Execute via Exchange Executor (singleton instance)
      const executor = require('./exchange-executor');

      const result = await executor.executeSignal(
        subscription.user.id,
        subscription.activeExchange || 'binance',
        signal,
        exchangeConfig
      );

      const executionTime = Date.now() - executionStart;

      // Log successful execution to database
      await this.logExecution({
        userId: subscription.user.id,
        subscriptionId: subscription.id,
        signalId: signal.id,
        exchange: subscription.activeExchange,
        orderType: subscription.orderType,
        side: signal.direction === 'LONG' ? 'buy' : 'sell',
        symbol: signal.pair || signal.symbol,
        amount: result.order?.amount || 0,
        price: result.order?.price || signal.entry,
        orderId: result.order?.id,
        status: 'SUCCESS',
        error: null,
        executionTimeMs: executionTime
      });

      logger.info(`✅ Order executed for ${subscription.user.email} (${executionTime}ms)`);

      // CRITICAL: Track position to prevent duplicates
      if (signal.direction === 'LONG' || signal.type === 'ENTRY') {
        this.openPositions.set(positionKey, {
          orderId: result.order?.id,
          amount: result.order?.amount || 0,
          entryPrice: result.order?.price || signal.entry,
          side: 'buy',
          symbol: signal.pair,
          openedAt: new Date()
        });
        logger.info(`📝 Position tracked: ${signal.pair} (${result.order?.amount || 0} coins)`);
      }

      // Emit success event
      this.emit('execution_success', {
        subscription,
        signal,
        result
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - executionStart;

      logger.error(`❌ Execution failed for subscription ${subscription.id}:`, error.message);

      // Log failed execution
      await this.logExecution({
        userId: subscription.user.id,
        subscriptionId: subscription.id,
        signalId: signal.id,
        exchange: subscription.activeExchange,
        orderType: subscription.orderType,
        side: signal.direction === 'LONG' ? 'buy' : 'sell',
        symbol: signal.pair || signal.symbol,
        amount: 0,
        price: signal.entry,
        orderId: null,
        status: 'FAILED',
        error: error.message,
        executionTimeMs: executionTime
      });

      // Emit failure event
      this.emit('execution_failed', {
        subscription,
        signal,
        error
      });

      throw error;
    }
  }

  /**
   * Check if auto-stop should trigger
   */
  checkAutoStop(subscription) {
    if (!subscription.autoStopEnabled) {
      return null;
    }

    const currentPnL = subscription.currentProfitLoss || 0;

    // Check profit target
    if (subscription.autoStopProfitPercent && currentPnL >= subscription.autoStopProfitPercent) {
      return `Profit target ${subscription.autoStopProfitPercent}% reached (current: ${currentPnL}%)`;
    }

    // Check loss limit
    if (subscription.autoStopLossPercent && currentPnL <= subscription.autoStopLossPercent) {
      return `Loss limit ${subscription.autoStopLossPercent}% reached (current: ${currentPnL}%)`;
    }

    return null;
  }

  /**
   * Log execution to database (ExecutionLog table)
   */
  async logExecution(data) {
    try {
      // Log to console for monitoring
      logger.info('📝 Execution Log:', {
        userId: data.userId,
        subscriptionId: data.subscriptionId,
        signalId: data.signalId,
        exchange: data.exchange,
        status: data.status,
        orderId: data.orderId,
        error: data.error,
        executionTimeMs: data.executionTimeMs
      });

      // Save to database
      await this.prisma.executionLog.create({
        data: {
          userId: data.userId,
          subscriptionId: data.subscriptionId,
          signalId: data.signalId,
          exchange: data.exchange,
          orderType: data.orderType,
          side: data.side,
          symbol: data.symbol || 'UNKNOWN',
          amount: data.amount,
          price: data.price,
          orderId: data.orderId,
          status: data.status,
          error: data.error,
          executionTimeMs: data.executionTimeMs
        }
      });

      logger.info('✅ Execution logged to database');

    } catch (error) {
      logger.error('❌ Error logging execution to database:', error.message);
      // Non-critical - don't throw, just log the error
    }
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      ...this.stats,
      uptime: process.uptime()
    };
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    logger.info('⏹️  Shutting down Subscription Executor...');
    await this.prisma.$disconnect();
    logger.info('✅ Subscription Executor stopped');
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new SubscriptionExecutor();
    }
    return instance;
  },
  SubscriptionExecutor
};
