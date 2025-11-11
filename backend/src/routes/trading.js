const express = require('express');
const router = express.Router();
const TradingEngine = require('../engines/tradingEngine');
// const TradingViewWebhook = require('../services/tradingViewWebhook');
// const PnLTracker = require('../services/pnlTracker');
const { authenticate, authorize } = require('../middleware/auth');
const authenticateToken = authenticate;
const requireRole = authorize;

/**
 * BACKTEST ROUTES
 */

// Run single backtest
router.post('/backtest', authenticateToken, async (req, res) => {
  try {
    const result = await TradingEngine.runBacktest({
      ...req.body,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Run batch backtest
router.post('/backtest/batch', authenticateToken, async (req, res) => {
  try {
    const results = await TradingEngine.runBatchBacktest({
      ...req.body,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Optimize strategy parameters
router.post('/optimize', authenticateToken, async (req, res) => {
  try {
    const result = await TradingEngine.optimizeStrategy({
      ...req.body,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PAPER TRADING ROUTES
 */

// Start paper trading session
router.post('/paper/start', authenticateToken, async (req, res) => {
  try {
    const session = await TradingEngine.startPaperTrading({
      ...req.body,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Stop paper trading session
router.post('/paper/stop/:sessionId', authenticateToken, async (req, res) => {
  try {
    const session = await TradingEngine.stopPaperTrading(req.params.sessionId);

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get all paper trading sessions
router.get('/paper/sessions', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const sessions = await prisma.tradingSession.findMany({
      where: {
        userId: req.user.id,
        type: 'paper'
      },
      orderBy: { startedAt: 'desc' },
      include: {
        strategy: true
      }
    });

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get paper trading session details
router.get('/paper/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const session = await TradingEngine.getSessionDetails(req.params.sessionId);

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get open positions for a session
router.get('/paper/positions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const positions = await prisma.position.findMany({
      where: {
        sessionId: req.params.sessionId,
        status: 'open'
      },
      orderBy: { openedAt: 'desc' }
    });

    res.json({
      success: true,
      data: positions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get open PnL for a session
router.get('/paper/open-pnl/:sessionId', authenticateToken, async (req, res) => {
  try {
    // const pnlSummary = await PnLTracker.getSessionPnLSummary(req.params.sessionId);
    const pnlSummary = {};

    res.json({
      success: true,
      data: pnlSummary
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * REAL TRADING ROUTES
 */

// Start real trading session
router.post('/real/start', authenticateToken, requireRole(['PROVIDER', 'ADMIN']), async (req, res) => {
  try {
    // Similar to paper trading but with real execution
    const session = await TradingEngine.startRealTrading({
      ...req.body,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Stop real trading session
router.post('/real/stop/:sessionId', authenticateToken, requireRole(['PROVIDER', 'ADMIN']), async (req, res) => {
  try {
    const session = await TradingEngine.stopRealTrading(req.params.sessionId);

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Emergency stop all positions
router.post('/real/emergency-stop', authenticateToken, requireRole(['PROVIDER', 'ADMIN']), async (req, res) => {
  try {
    const result = await TradingEngine.emergencyStop(req.user.id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get real trading sessions
router.get('/real/sessions', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const sessions = await prisma.tradingSession.findMany({
      where: {
        userId: req.user.id,
        type: 'real'
      },
      orderBy: { startedAt: 'desc' },
      include: {
        strategy: true
      }
    });

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get real trading positions
router.get('/real/positions', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const positions = await prisma.position.findMany({
      where: {
        session: {
          userId: req.user.id,
          type: 'real'
        },
        status: 'open'
      },
      include: {
        session: true
      },
      orderBy: { openedAt: 'desc' }
    });

    res.json({
      success: true,
      data: positions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * TRADINGVIEW WEBHOOK ROUTES
 */

// Receive TradingView webhook
router.post('/tradingview/webhook', async (req, res) => {
  try {
    const startTime = Date.now();

    console.log('\n' + '='.repeat(70));
    console.log('📡 TRADINGVIEW WEBHOOK RECEIVED');
    console.log('='.repeat(70));
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('🌐 Client IP:', req.ip || req.connection.remoteAddress);
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));

    // Verify request is from TradingView IPs (DISABLED FOR TESTING)
    const allowedIPs = ['52.89.214.238', '34.212.75.30', '54.218.53.128', '52.32.178.7'];
    const clientIP = req.ip || req.connection.remoteAddress;

    // TEMPORARILY DISABLED - Remove this comment to enable IP whitelist
    // if (process.env.NODE_ENV === 'production' && !allowedIPs.includes(clientIP)) {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Unauthorized IP address'
    //   });
    // }

    // Parse signal from webhook
    const signal = req.body;
    const action = (signal.action || signal.direction || 'BUY').toUpperCase();

    // Check if this is a CLOSE/EXIT signal
    if (action === 'CLOSE' || action === 'SELL' || action === 'EXIT') {
      console.log('🔴 CLOSE signal received:', signal);

      const signalDistributor = req.app.get('signalDistributor');
      if (signalDistributor) {
        const strategy = signal.strategy || signal.strategyName || signal.alert_name || 'Unknown';
        const pair = signal.pair || signal.ticker || signal.symbol || 'UNKNOWN';
        const exitPrice = parseFloat(signal.price || signal.exit || signal.close || 0);

        // Close the most recent open signal for this strategy+pair
        await signalDistributor.closeSignalByStrategyAndPair(strategy, pair, exitPrice, 'TradingView Close');
        console.log(`✅ Close signal processed: ${strategy} ${pair} @ ${exitPrice}`);
      }

      const latency = Date.now() - startTime;
      return res.json({
        success: true,
        message: 'Close signal processed',
        latency: `${latency}ms`
      });
    }

    // This is an ENTRY signal (BUY/LONG/SHORT)
    const tradingSignal = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      source: 'tradingview_webhook',
      strategy: signal.strategy || signal.strategyName || signal.alert_name || 'Unknown',
      pair: signal.pair || signal.ticker || signal.symbol || 'UNKNOWN',
      direction: (action === 'SELL' || action === 'SHORT') ? 'SHORT' : 'LONG',
      entry: parseFloat(signal.price || signal.entry || signal.close || 0),
      takeProfit: parseFloat(signal.tp || signal.take_profit || signal.takeProfit || 0) || null,
      stopLoss: parseFloat(signal.sl || signal.stop_loss || signal.stopLoss || 0) || null,
      timestamp: new Date().toISOString(),
      currentPnL: 0,
      status: 'Active',
      rawData: JSON.stringify(signal)
    };

    console.log('🟢 ENTRY Signal:', JSON.stringify(tradingSignal, null, 2));

    // Send to SignalDistributor
    const signalDistributor = req.app.get('signalDistributor');
    if (signalDistributor) {
      await signalDistributor.broadcastSignal(tradingSignal);
      console.log('✅ Signal broadcasted via SignalDistributor');
    } else {
      console.log('⚠️  SignalDistributor not available');
    }

    // Process webhook (legacy)
    try {
      const result = await TradingEngine.processTradingViewWebhook(req.body, req.headers);

      const latency = Date.now() - startTime;
      console.log('✅ Webhook processed successfully');
      console.log(`⚡ Total latency: ${latency}ms`);
      console.log('='.repeat(70) + '\n');

      res.json({
        success: true,
        data: result,
        signal: tradingSignal,
        latency: `${latency}ms`
      });
    } catch (engineError) {
      console.error('❌ TradingEngine error:', engineError.message);

      const latency = Date.now() - startTime;
      console.log(`⚡ Total latency: ${latency}ms`);
      console.log('='.repeat(70) + '\n');

      // Still return success to TradingView
      res.json({
        success: true,
        message: 'Webhook received and signal broadcasted',
        signal: tradingSignal,
        latency: `${latency}ms`,
        engineError: engineError.message
      });
    }
  } catch (error) {
    console.error('❌ Webhook error:', error);
    console.log('='.repeat(70) + '\n');

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Configure TradingView webhook settings
router.post('/tradingview/configure', authenticateToken, async (req, res) => {
  try {
    // Save webhook configuration for user
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const config = await prisma.webhookConfig.upsert({
      where: { userId: req.user.id },
      update: req.body,
      create: {
        userId: req.user.id,
        ...req.body
      }
    });

    res.json({
      success: true,
      data: config,
      webhookUrl: `${process.env.FRONTEND_URL}/api/trading/tradingview/webhook`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get TradingView alert history
router.get('/tradingview/alerts', authenticateToken, async (req, res) => {
  try {
    // const alerts = await TradingViewWebhook.getAlertHistory({
    //   ...req.query,
    //   userId: req.user.id
    // });
    const alerts = [];

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete TradingView alert
router.delete('/tradingview/alerts/:id', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.tradingViewAlert.delete({
      where: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * STRATEGY MANAGEMENT ROUTES
 */

// Get all strategies
router.get('/strategies', authenticateToken, async (req, res) => {
  try {
    const strategies = TradingEngine.getStrategies();

    res.json({
      success: true,
      data: strategies
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Create new strategy
router.post('/strategies', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const strategy = await prisma.strategy.create({
      data: {
        ...req.body,
        createdBy: req.user.id
      }
    });

    res.json({
      success: true,
      data: strategy
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Import Pine Script strategy
router.post('/strategies/import/pinescript', authenticateToken, async (req, res) => {
  try {
    const strategy = await TradingEngine.importPineScript({
      ...req.body,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: strategy
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Test strategy
router.post('/strategies/test', authenticateToken, async (req, res) => {
  try {
    // Quick backtest on recent data
    const result = await TradingEngine.runBacktest({
      ...req.body,
      userId: req.user.id,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      endDate: new Date()
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get strategy performance
router.get('/strategies/:id/performance', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Get all sessions using this strategy
    const sessions = await prisma.tradingSession.findMany({
      where: {
        strategyId: req.params.id,
        userId: req.user.id
      },
      include: {
        trades: true
      }
    });

    // Calculate aggregate performance
    const performance = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      totalTrades: sessions.reduce((sum, s) => sum + s.totalTrades, 0),
      avgRoi: sessions.reduce((sum, s) => sum + parseFloat(s.roi), 0) / sessions.length,
      avgWinRate: sessions.reduce((sum, s) => sum + parseFloat(s.winRate), 0) / sessions.length,
      sessions: sessions.map(s => ({
        id: s.id,
        type: s.type,
        status: s.status,
        roi: s.roi,
        winRate: s.winRate,
        totalTrades: s.totalTrades,
        startedAt: s.startedAt
      }))
    };

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POSITION MANAGEMENT ROUTES
 */

// Close position
router.post('/positions/:id/close', authenticateToken, async (req, res) => {
  try {
    // const position = await PnLTracker.closePosition(req.params.id, req.body.closePrice);
    const position = { id: req.params.id, status: 'closed' };

    res.json({
      success: true,
      data: position
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get position details
router.get('/positions/:id', authenticateToken, async (req, res) => {
  try {
    // const position = await PnLTracker.getPositionReport(req.params.id);
    const position = { id: req.params.id, report: 'Position report will be implemented' };

    res.json({
      success: true,
      data: position
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * SYSTEM ROUTES
 */

// Get system health
router.get('/health', async (req, res) => {
  try {
    const health = await TradingEngine.getSystemHealth();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;