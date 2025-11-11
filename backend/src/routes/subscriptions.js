const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const ccxt = require('ccxt');

const prisma = new PrismaClient();

/**
 * GET /api/subscriptions/my-subscriptions
 * Get all subscriptions for current user
 */
router.get('/my-subscriptions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            supportedPairs: true,
            winRate: true,
            avgProfit: true,
            maxDrawdown: true,
            sharpeRatio: true,
            totalTrades: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      subscriptions
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions'
    });
  }
});

/**
 * POST /api/subscriptions/subscribe
 * Subscribe to a strategy
 */
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      strategyName,
      subscribedPairs = [],
      allPairs = false,  // CHANGED: Default to false - user must explicitly enable all pairs
      exchanges = ['binance'],
      activeExchange = 'binance'
    } = req.body;

    if (!strategyName) {
      return res.status(400).json({
        success: false,
        message: 'Strategy name is required'
      });
    }

    // Find or create strategy record
    let strategy = await prisma.strategy.findFirst({
      where: { name: strategyName }
    });

    if (!strategy) {
      // Create auto-strategy for TradingView signals
      strategy = await prisma.strategy.create({
        data: {
          name: strategyName,
          description: 'TradingView strategy: ' + strategyName,
          category: 'TradingView',
          type: 'CUSTOM',
          parameters: {},
          supportedPairs: subscribedPairs.length > 0 ? subscribedPairs : [],
          supportedTimeframes: [],
          monthlyPrice: 0,
          providerId: userId,
          isActive: true,
          isPublic: true
        }
      });
    }

    // Check if already subscribed
    const existing = await prisma.subscription.findFirst({
      where: {
        userId,
        strategyId: strategy.id
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Already subscribed to this strategy'
      });
    }

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        strategyId: strategy.id,
        status: 'ACTIVE',
        isFree: true,
        monthlyPrice: 0,
        subscribedPairs: allPairs ? [] : subscribedPairs,
        allPairs,
        exchanges,
        activeExchange,
        startDate: new Date()
      },
      include: {
        strategy: true
      }
    });

    console.log('User ' + userId + ' subscribed to strategy ' + strategyName);

    res.json({
      success: true,
      message: 'Successfully subscribed to strategy',
      subscription
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription',
      error: error.message
    });
  }
});

/**
 * PUT /api/subscriptions/:id
 * Update subscription settings (pairs, exchanges, order config, auto-stop)
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscriptionId = req.params.id;
    const {
      subscribedPairs,
      allPairs,
      exchanges,
      activeExchange,
      status,
      // New fields - Trading Configuration
      orderType,
      fixedOrderSize,
      usePercentage,
      orderSizePercent,
      // New fields - Auto Stop Configuration
      autoStopEnabled,
      autoStopProfitPercent,
      autoStopLossPercent
    } = req.body;

    // Verify ownership
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Build update data object
    const updateData = {
      subscribedPairs: subscribedPairs !== undefined ? subscribedPairs : subscription.subscribedPairs,
      allPairs: allPairs !== undefined ? allPairs : subscription.allPairs,
      exchanges: exchanges !== undefined ? exchanges : subscription.exchanges,
      activeExchange: activeExchange !== undefined ? activeExchange : subscription.activeExchange,
      status: status !== undefined ? status : subscription.status
    };

    // Add trading configuration if provided
    if (orderType !== undefined) updateData.orderType = orderType;
    if (fixedOrderSize !== undefined) updateData.fixedOrderSize = fixedOrderSize;
    if (usePercentage !== undefined) updateData.usePercentage = usePercentage;
    if (orderSizePercent !== undefined) updateData.orderSizePercent = orderSizePercent;

    // Add auto-stop configuration if provided
    if (autoStopEnabled !== undefined) updateData.autoStopEnabled = autoStopEnabled;
    if (autoStopProfitPercent !== undefined) updateData.autoStopProfitPercent = autoStopProfitPercent;
    if (autoStopLossPercent !== undefined) updateData.autoStopLossPercent = autoStopLossPercent;

    // Update subscription
    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
      include: {
        strategy: true
      }
    });

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: updated
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription',
      error: error.message
    });
  }
});

/**
 * DELETE /api/subscriptions/:id
 * Unsubscribe from a strategy
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscriptionId = req.params.id;

    // Verify ownership
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Soft delete - mark as cancelled
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Successfully unsubscribed'
    });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe'
    });
  }
});

/**
 * GET /api/subscriptions/available-pairs/:strategyName
 * Get available pairs for a strategy
 */
router.get('/available-pairs/:strategyName', authenticate, async (req, res) => {
  try {
    const strategyName = req.params.strategyName;

    // Get strategy from TradingView signals (V2 persistence)
    const SignalPersistenceV2 = require('../services/signal-persistence-v2');
    const allSignals = await SignalPersistenceV2.getAllSignals();

    // Filter by strategy and extract unique pairs
    const strategySignals = allSignals.filter(s => s.strategy === strategyName);
    const pairs = [...new Set(strategySignals.map(s => s.pair))];

    res.json({
      success: true,
      strategyName,
      availablePairs: pairs,
      totalSignals: strategySignals.length
    });
  } catch (error) {
    console.error('Error fetching available pairs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available pairs'
    });
  }
});

/**
 * POST /api/subscriptions/:id/api-keys
 * Save encrypted exchange API keys for a subscription
 */
router.post('/:id/api-keys', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscriptionId = req.params.id;
    const { apiKey, apiSecret, subAccount } = req.body;

    // Validate inputs
    if (!apiKey || !apiSecret) {
      return res.status(400).json({
        success: false,
        message: 'API key and secret are required'
      });
    }

    // Verify ownership
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Encrypt API credentials
    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);

    // Update subscription with encrypted keys
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        exchangeApiKey: encryptedKey,
        exchangeApiSecret: encryptedSecret,
        exchangeSubAccount: subAccount || null
      }
    });

    console.log(`API keys saved for subscription ${subscriptionId}`);

    res.json({
      success: true,
      message: 'API keys saved securely'
    });
  } catch (error) {
    console.error('Error saving API keys:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save API keys',
      error: error.message
    });
  }
});

/**
 * GET /api/subscriptions/:id/balance
 * Get account balance from exchange using saved API keys
 */
router.get('/:id/balance', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscriptionId = req.params.id;

    // Get subscription with API keys
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Check if API keys are configured
    if (!subscription.exchangeApiKey || !subscription.exchangeApiSecret) {
      return res.status(400).json({
        success: false,
        message: 'API keys not configured. Please add your exchange API keys first.'
      });
    }

    // Decrypt API keys
    const apiKey = decrypt(subscription.exchangeApiKey);
    const apiSecret = decrypt(subscription.exchangeApiSecret);

    // Determine exchange (use activeExchange or default to binance)
    const exchangeName = subscription.activeExchange || 'binance';

    // Initialize exchange
    const ExchangeClass = ccxt[exchangeName];
    if (!ExchangeClass) {
      return res.status(400).json({
        success: false,
        message: `Exchange '${exchangeName}' is not supported`
      });
    }

    const exchange = new ExchangeClass({
      apiKey: apiKey,
      secret: apiSecret,
      enableRateLimit: true
    });

    // Fetch balance
    const balance = await exchange.fetchBalance();

    // Extract USDT balance (most common trading currency)
    const usdtBalance = {
      total: balance.total?.USDT || 0,
      free: balance.free?.USDT || 0,
      used: balance.used?.USDT || 0
    };

    res.json({
      success: true,
      exchange: exchangeName,
      balance: usdtBalance,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching balance:', error);

    // Handle specific CCXT errors
    let errorMessage = 'Failed to fetch account balance';
    if (error.message.includes('Invalid API')) {
      errorMessage = 'Invalid API keys. Please check your credentials.';
    } else if (error.message.includes('IP')) {
      errorMessage = 'IP address not whitelisted on exchange.';
    } else if (error.message.includes('permission')) {
      errorMessage = 'API keys lack required permissions.';
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
});

module.exports = router;
