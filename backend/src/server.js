require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

// Import configurations
const { setupWebSocket } = require('./websocket');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const rateLimit = require('./middleware/rateLimit');

// Import routes
const premiumPagesRoutes = require('./routes/premium-pages');
const authRoutes = require('./routes/auth');
const providerRoutes = require('./routes/providers');
const signalRoutes = require('./routes/signals');
const subscriptionRoutes = require('./routes/subscriptions');
const riskManagementRoutes = require('./routes/riskManagement');
const newsCalendarRoutes = require('./routes/newsCalendar');
const tradingRoutes = require('./routes/trading');
const realtimeRoutes = require('./routes/realtime');
const allPagesRoutes = require('./routes/allPagesTemp');
const adminRoutes = require('./routes/admin');
const onboardingRoutes = require('./routes/onboarding');
const analyticsRoutes = require('./routes/analytics');
const backtestsRoutes = require('./routes/backtests');
const positionsRoutes = require('./routes/positions');
const strategiesRoutes = require('./routes/strategies');
const profileRoutes = require('./routes/profile');
const tradesRoutes = require('./routes/trades');
const exportRoutes = require('./routes/export');
const marketplaceRoutes = require('./routes/marketplace');
const botsRoutes = require('./routes/bots');
const statsRoutes = require('./routes/stats'); // NEW: Win rate & performance stats
const leaderboardRoutes = require('./routes/leaderboard'); // NEW: Provider leaderboard & rankings
const chartsRoutes = require('./routes/charts'); // NEW: Performance charts data
const badgesRoutes = require('./routes/badges'); // NEW: Provider & strategy badges
const trialsRoutes = require('./routes/trials'); // NEW: Free trial management

// Import services
const TradingEngine = require('./engines/tradingEngine');
const backupService = require('./services/backupService');
const monitoringService = require('./services/monitoringService');
const positionMonitor = require('./services/simple-position-monitor');

// Import new signal capture services
const SignalCoordinator = require('./services/signal-coordinator');
const SignalDistributor = require('./services/signal-distributor');
const PriceService = require('./services/price-service');
const PaperTradeEngine = require('./services/paper-trade-engine');
const ExchangeExecutor = require('./services/exchange-executor');
const { getInstance: getSubscriptionExecutor } = require('./services/subscription-executor');

const app = express();
const server = http.createServer(app);

// Trust proxy (behind nginx)
app.set('trust proxy', 1);

// Serve static files with priority over routes
app.use(express.static(path.join(__dirname, '../public'), {
  index: 'index.html',
  extensions: ['html', 'htm']
}));

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting
app.use(rateLimit);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Clean URL routes (without .html)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/profile.html'));
});

app.get('/subscriptions', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/subscriptions.html'));
});

app.get('/signals-live', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/signals-live.html'));
});

// DEFAULT: signals page now uses the new v2 design
app.get('/signals', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/signals-v2.html'));
});

app.get('/signals-v2', (req, res) => {
  // Cache bypass headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/signals-v2.html'));
});

// Signal detail page (MQL5-style)
app.get('/signal-detail', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/signal-detail.html'));
});

// Strategies page
app.get('/strategies', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/strategies.html'));
});

// Strategy detail page (individual strategy view)
app.get('/strategy/:id', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/strategy-detail.html'));
});

// Dashboard page
app.get('/dashboard', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Marketplace page
app.get('/marketplace', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/marketplace.html'));
});

// Providers page
app.get('/providers', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/providers.html'));
});

// Fund Managers page
app.get('/fund-managers', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/fund-managers.html'));
});

// News & Sentiment page
app.get('/news-sentiment', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/news-sentiment.html'));
});

// Pricing page
app.get('/pricing', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/pricing.html'));
});

// Status page
app.get('/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/status.html'));
});

// Login page
app.get('/login', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Register page
app.get('/register', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

// Onboarding page
app.get('/onboarding', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/onboarding.html'));
});

// Page routes (Complete site structure - no orphan pages)
app.use('/', allPagesRoutes);

// Legacy premium pages (keeping for backward compatibility)
// app.use('/', premiumPagesRoutes);

// API Routes (commenting out old landing page)
/*
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutomatedTradeBot - Trading Signal Marketplace</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 60px 40px;
            max-width: 800px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .logo { font-size: 64px; margin-bottom: 10px; }
        h1 { font-size: 36px; color: #1a202c; margin-bottom: 10px; }
        .subtitle { font-size: 20px; color: #667eea; margin-bottom: 30px; font-weight: 600; }
        p { color: #4a5568; line-height: 1.8; margin-bottom: 30px; font-size: 18px; }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }
        .feature {
            padding: 20px;
            background: #f7fafc;
            border-radius: 12px;
            border-left: 4px solid #667eea;
        }
        .feature-icon { font-size: 32px; margin-bottom: 10px; }
        .feature-title { font-weight: 700; color: #1a202c; margin-bottom: 8px; font-size: 16px; }
        .feature-desc { font-size: 14px; color: #718096; }
        .status {
            background: linear-gradient(135deg, #48bb78, #38a169);
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            display: inline-block;
            margin: 20px 0;
            font-weight: 600;
            font-size: 18px;
            box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
        }
        .api-link {
            display: inline-block;
            margin: 10px;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.3s;
        }
        .api-link:hover { background: #5a67d8; transform: translateY(-2px); }
        .tech-stack { margin-top: 40px; padding-top: 30px; border-top: 2px solid #e2e8f0; }
        .tech-badge {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            margin: 5px;
            font-size: 14px;
            font-weight: 500;
        }
        @media (max-width: 600px) {
            .container { padding: 40px 20px; }
            h1 { font-size: 28px; }
            .features { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">📈</div>
        <h1>AutomatedTradeBot</h1>
        <div class="subtitle">Trading Signal Marketplace Platform</div>

        <p>Professional trading signal marketplace with real-time WebSocket distribution, advanced risk management, and automated copy trading features.</p>

        <div class="status">✅ API Server Running Successfully</div>

        <div class="features">
            <div class="feature">
                <div class="feature-icon">⚡</div>
                <div class="feature-title">Real-Time Signals</div>
                <div class="feature-desc">WebSocket-based instant notifications</div>
            </div>
            <div class="feature">
                <div class="feature-icon">🛡️</div>
                <div class="feature-title">Risk Management</div>
                <div class="feature-desc">Adaptive & news-based SL control</div>
            </div>
            <div class="feature">
                <div class="feature-icon">📊</div>
                <div class="feature-title">Rich Analytics</div>
                <div class="feature-desc">Open PnL & drawdown tracking</div>
            </div>
            <div class="feature">
                <div class="feature-icon">🔄</div>
                <div class="feature-title">Copy Trading</div>
                <div class="feature-desc">Automated trade execution</div>
            </div>
        </div>

        <div style="margin: 30px 0;">
            <a href="/health" class="api-link">🔍 API Health Check</a>
            <a href="/api/signals" class="api-link">📡 Signals API</a>
            <a href="/api/providers" class="api-link">👥 Providers API</a>
        </div>

        <div class="tech-stack">
            <p style="font-weight: 600; margin-bottom: 15px; font-size: 16px;">Powered By:</p>
            <span class="tech-badge">Node.js 22</span>
            <span class="tech-badge">Express.js</span>
            <span class="tech-badge">WebSocket</span>
            <span class="tech-badge">JWT Auth</span>
            <span class="tech-badge">PostgreSQL</span>
            <span class="tech-badge">Redis</span>
            <span class="tech-badge">Stripe</span>
            <span class="tech-badge">PM2</span>
        </div>

        <p style="margin-top: 40px; font-size: 14px; color: #a0aec0;">
            Backend API: <strong>✅ Online</strong> | Port: <strong>6864</strong> | Status: <strong>Production</strong>
        </p>
    </div>
</body>
</html>
  `);
});
*/

// System status endpoint (public)
app.get('/api/status', async (req, res) => {
  let userCount = 0, signalCount = 0, strategyCount = 0, positionCount = 0;
  let dbStatus = 'online';

  try {
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();

    try {
      const counts = await Promise.all([
        db.user.count(),
        db.signal.count(),
        db.strategy.count(),
        db.position.count()
      ]);

      [userCount, signalCount, strategyCount, positionCount] = counts;
      await db.$disconnect();
    } catch (dbError) {
      dbStatus = 'offline';
      logger.error('Status endpoint DB error:', dbError.message);
    }

    res.json({
      success: true,
      status: dbStatus === 'online' ? 'operational' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      stats: {
        users: userCount,
        strategies: strategyCount,
        signals: signalCount,
        positions: positionCount
      },
      services: {
        api: 'online',
        database: dbStatus,
        websocket: 'online'
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    });
  } catch (error) {
    logger.error('Status endpoint error:', error.message);
    res.status(503).json({
      success: false,
      status: 'degraded',
      message: 'Service experiencing issues',
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/marketplace', marketplaceRoutes); // NEW: Optimized marketplace API
app.use('/api/providers', providerRoutes);
app.use('/api/signals', signalRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/risk-management', riskManagementRoutes);
app.use('/api/news-calendar', newsCalendarRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/backtests', backtestsRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/strategies', strategiesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/bots', botsRoutes); // NEW: Bot management API
app.use('/api/stats', statsRoutes); // NEW: Win rate & performance stats
app.use('/api/leaderboard', leaderboardRoutes); // NEW: Provider leaderboard & rankings
app.use('/api/charts', chartsRoutes); // NEW: Performance charts data
app.use('/api/badges', badgesRoutes); // NEW: Provider & strategy badges
app.use('/api/trials', trialsRoutes); // NEW: Free trial management

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Setup WebSocket - DISABLED (using SignalDistributor instead at /ws/signals)
// setupWebSocket(server);

// Initialize signal capture services
let signalDistributor;
let signalCoordinator;
let subscriptionExecutor;

async function initializeSignalCaptureServices() {
  try {
    logger.info('\n' + '='.repeat(60));
    logger.info('🚀 INITIALIZING SIGNAL CAPTURE SYSTEM');
    logger.info('='.repeat(60));

    // Initialize Signal Distributor (WebSocket for signals)
    logger.info('📡 Initializing Signal Distributor...');
    signalDistributor = new SignalDistributor(server);
    logger.info('✅ Signal Distributor ready');

    // Initialize Price Service (non-critical, can fail gracefully)
    logger.info('💹 Initializing Price Service...');
    try {
      await PriceService.initialize();
      logger.info('✅ Price Service ready');
    } catch (priceError) {
      logger.warn('⚠️  Price Service initialization failed (non-critical):', priceError.message);
      logger.info('   Continuing with other services...');
    }

    // Initialize Paper Trade Engine
    logger.info('📊 Initializing Paper Trade Engine...');
    await PaperTradeEngine.initialize();
    logger.info('✅ Paper Trade Engine ready');

    // Initialize Signal Coordinator (orchestrates TradingView + Telegram)
    logger.info('🎯 Initializing Signal Coordinator...');
    signalCoordinator = new SignalCoordinator();
    await signalCoordinator.initialize(signalDistributor);
    logger.info('✅ Signal Coordinator ready');

    // Initialize Subscription Executor (automatic order execution)
    logger.info('🤖 Initializing Subscription Executor...');
    subscriptionExecutor = getSubscriptionExecutor();
    subscriptionExecutor.initialize(signalCoordinator);
    logger.info('✅ Subscription Executor ready');

    // Make services available to routes
    app.set('signalDistributor', signalDistributor);
    app.set('subscriptionExecutor', subscriptionExecutor);
    logger.info('✅ Services registered to app');

    logger.info('='.repeat(60));
    logger.info('✅ SIGNAL CAPTURE SYSTEM INITIALIZED');
    logger.info('   - TradingView Capture: ' + (process.env.ENABLE_TRADINGVIEW_CAPTURE === 'true' ? 'Enabled' : 'Disabled'));
    logger.info('   - Telegram Bot: ' + (process.env.TELEGRAM_BOT_TOKEN ? 'Enabled' : 'Disabled'));
    logger.info('   - WebSocket Signals: Active on /ws/signals');
    logger.info('   - Price Service: Active');
    logger.info('   - Paper Trade Engine: Active');
    logger.info('   - Subscription Executor: Active (Auto-trading)');
    logger.info('='.repeat(60) + '\n');

  } catch (error) {
    logger.error('❌ Failed to initialize signal capture services:', error);
  }
}

// Initialize Trading Engine
async function initializeTradingEngine() {
  try {
    await TradingEngine.initialize();
    logger.info('✅ Trading Engine initialized');
  } catch (error) {
    logger.error('Failed to initialize trading engine:', error);
  }
}

// Start server
const PORT = process.env.PORT || 3001;

server.listen(PORT, async () => {
  logger.info(`🚀 AutomatedTradeBot API Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔗 WebSocket enabled on ws://localhost:${PORT}`);
  logger.info(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);

  // Initialize services after server starts

  // Initialize signal capture services FIRST (critical for signal flow)
  await initializeSignalCaptureServices();

  await initializeTradingEngine();

  // Initialize backup service
  try {
    await backupService.initialize();
    logger.info('✅ Backup Service initialized');
  } catch (error) {
    logger.error('Failed to initialize backup service:', error);
  }

  // Initialize monitoring service
  try {
    await monitoringService.startHealthChecks();
    logger.info('✅ Monitoring Service initialized');
  } catch (error) {
    logger.error('Failed to initialize monitoring service:', error);
  }

  // Initialize position monitor (TP/SL auto-close)
  try {
    await positionMonitor.start();
    logger.info('✅ Position Monitor started - Checking TP/SL every 5 seconds');
  } catch (error) {
    logger.error('Failed to start position monitor:', error);
  }

  logger.info('🎯 System fully operational - Ready for trading!');
  logger.info('📡 TradingView webhook URL: https://automatedtradebot.com/api/trading/tradingview/webhook');
  logger.info('🌐 Supporting exchanges: Bybit, MEXC, Bitget, Binance + 100+ via CCXT');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  positionMonitor.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  positionMonitor.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = { app, server };
