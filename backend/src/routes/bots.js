const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateOptional } = require('../middleware/auth');
const exchangeManager = require('../services/exchangeManager');

const prisma = new PrismaClient();

/**
 * @route   POST /api/bots/start
 * @desc    Start a trading bot for a strategy and pair(s)
 * @access  Public (for now)
 */
router.post('/start', authenticateOptional, async (req, res) => {
  try {
    const { strategyName, pairs, exchange, capital, mode } = req.body;

    console.log('🤖 Bot Start Request:', { strategyName, pairs, exchange, capital, mode });

    // Validation
    if (!strategyName || !pairs || !exchange || !capital || !mode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: strategyName, pairs, exchange, capital, mode'
      });
    }

    // Get strategy from database
    const strategy = await prisma.strategy.findFirst({
      where: { name: strategyName }
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: `Strategy "${strategyName}" not found`
      });
    }

    const pairList = Array.isArray(pairs) ? pairs : [pairs];
    const startedBots = [];

    // Start bot for each pair
    for (const pair of pairList) {
      // Check if bot already running
      const existingBot = await prisma.tradingBot.findFirst({
        where: {
          strategyId: strategy.id,
          symbol: pair,
          status: 'RUNNING'
        }
      });

      if (existingBot) {
        console.log(`⚠️  Bot already running for ${strategyName} + ${pair}`);
        startedBots.push({
          ...existingBot,
          alreadyRunning: true
        });
        continue;
      }

      // Create bot record
      const bot = await prisma.tradingBot.create({
        data: {
          strategyId: strategy.id,
          symbol: pair,
          exchange: exchange.toUpperCase(),
          capital: parseFloat(capital),
          mode: mode.toUpperCase(),
          status: 'RUNNING',
          startedAt: new Date(),
          config: {
            autoRestart: true,
            maxDrawdown: 50, // 50% max drawdown before stop
            stopLossEnabled: true,
            takeProfitEnabled: true
          }
        }
      });

      console.log(`✅ Bot started: ${bot.id} - ${strategyName} + ${pair}`);
      startedBots.push(bot);
    }

    // REAL ORDER PLACEMENT: Place test order for SPOT mode
    let testOrder = null;
    if (mode.toUpperCase() === 'SPOT' && startedBots.length > 0 && !startedBots[0].alreadyRunning) {
      try {
        console.log(`📊 Placing test SPOT order on ${exchange}...`);

        // Get user (for now using hardcoded user, should be from req.user)
        const user = await prisma.user.findUnique({
          where: { email: 'suyttru@gmail.com' }
        });

        if (!user) {
          throw new Error('User not found');
        }

        // Initialize exchange
        const exchangeInstance = await exchangeManager.initializeExchange(
          user.id,
          exchange.toLowerCase(),
          { defaultType: 'spot' }
        );

        // Place test market buy order
        const firstPair = pairList[0];
        const symbol = firstPair.replace('USDT', '/USDT'); // Convert to CCXT format

        // Calculate order amount (2 USD worth of crypto)
        const ticker = await exchangeInstance.fetchTicker(symbol);
        const amount = capital / ticker.last; // Amount of crypto to buy with 2 USD

        // Place market buy order
        testOrder = await exchangeInstance.createMarketBuyOrder(symbol, amount);

        console.log(`✅ Test order placed:`, {
          orderId: testOrder.id,
          symbol: symbol,
          amount: amount,
          cost: testOrder.cost || capital
        });

        // Update bot with order info
        await prisma.tradingBot.update({
          where: { id: startedBots[0].id },
          data: {
            config: {
              ...startedBots[0].config,
              testOrderId: testOrder.id,
              testOrderSymbol: symbol,
              testOrderAmount: amount,
              testOrderCost: testOrder.cost || capital
            }
          }
        });

      } catch (orderError) {
        console.error('❌ Test order failed:', orderError.message);
        testOrder = { error: orderError.message };
      }
    }

    // Return success
    res.json({
      success: true,
      message: `Started ${startedBots.length} bot(s) for ${strategyName}`,
      data: {
        strategy: strategyName,
        pairs: pairList,
        exchange,
        capital,
        mode,
        bots: startedBots,
        testOrder: testOrder
      }
    });

  } catch (error) {
    console.error('❌ Error starting bot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start bot',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/bots/stop
 * @desc    Stop a trading bot
 * @access  Public (for now)
 */
router.post('/stop', authenticateOptional, async (req, res) => {
  try {
    const { botId, strategyName, pair } = req.body;

    let bot;

    if (botId) {
      // Stop by bot ID
      bot = await prisma.tradingBot.update({
        where: { id: botId },
        data: {
          status: 'STOPPED',
          stoppedAt: new Date()
        }
      });
    } else if (strategyName && pair) {
      // Stop by strategy + pair
      const strategy = await prisma.strategy.findFirst({
        where: { name: strategyName }
      });

      if (!strategy) {
        return res.status(404).json({
          success: false,
          message: 'Strategy not found'
        });
      }

      bot = await prisma.tradingBot.updateMany({
        where: {
          strategyId: strategy.id,
          symbol: pair,
          status: 'RUNNING'
        },
        data: {
          status: 'STOPPED',
          stoppedAt: new Date()
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide either botId or (strategyName + pair)'
      });
    }

    console.log(`⏹️  Bot stopped:`, bot);

    res.json({
      success: true,
      message: 'Bot stopped successfully',
      data: bot
    });

  } catch (error) {
    console.error('❌ Error stopping bot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop bot',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/bots/status
 * @desc    Get status of all bots for a strategy
 * @access  Public
 */
router.get('/status/:strategyName', authenticateOptional, async (req, res) => {
  try {
    const { strategyName } = req.params;

    // Get strategy
    const strategy = await prisma.strategy.findFirst({
      where: { name: strategyName }
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    // Get all bots for this strategy
    const bots = await prisma.tradingBot.findMany({
      where: { strategyId: strategy.id },
      orderBy: { startedAt: 'desc' }
    });

    // Group by pair
    const byPair = {};
    for (const bot of bots) {
      if (!byPair[bot.symbol]) {
        byPair[bot.symbol] = [];
      }
      byPair[bot.symbol].push(bot);
    }

    // Get running status for each pair
    const pairStatus = {};
    for (const [pair, pairBots] of Object.entries(byPair)) {
      const runningBot = pairBots.find(b => b.status === 'RUNNING');
      pairStatus[pair] = runningBot ? 'RUNNING' : 'STOPPED';
    }

    res.json({
      success: true,
      data: {
        strategy: strategyName,
        pairStatus,
        bots
      }
    });

  } catch (error) {
    console.error('❌ Error getting bot status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bot status',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/bots/list
 * @desc    Get all active bots
 * @access  Public
 */
router.get('/list', authenticateOptional, async (req, res) => {
  try {
    const bots = await prisma.tradingBot.findMany({
      where: { status: 'RUNNING' },
      include: {
        strategy: {
          select: {
            name: true,
            description: true
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    res.json({
      success: true,
      data: {
        count: bots.length,
        bots
      }
    });

  } catch (error) {
    console.error('❌ Error listing bots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list bots',
      error: error.message
    });
  }
});

module.exports = router;
