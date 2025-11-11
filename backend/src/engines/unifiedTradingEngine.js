const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs').promises;
const path = require('path');

// Import services from karsilas system
const DataService = require('/home/karsilas/trading-system/backend/services/dataService');
const BacktestEngine = require('/home/karsilas/trading-system/backend/services/backtestEngine');
const PaperTradeEngine = require('/home/karsilas/trading-system/backend/services/paperTradeEngine');
const PerformanceAnalyzer = require('/home/karsilas/trading-system/backend/services/performanceAnalyzer');

// Import new services
const TradingViewWebhook = require('../services/tradingViewWebhook');
const PnLTracker = require('../services/pnlTracker');

class UnifiedTradingEngine {
  constructor() {
    this.strategies = new Map();
    this.activeSessions = new Map();
    this.backtestQueue = [];
    this.isInitialized = false;
  }

  /**
   * Initialize the unified trading engine
   */
  async initialize() {
    try {
      console.log('Initializing Unified Trading Engine...');

      // Initialize data service
      await DataService.initialize();

      // Initialize PnL tracker with market data
      PnLTracker.initialize(DataService);

      // Load all strategies
      await this.loadStrategies();

      // Load active sessions from database
      await this.loadActiveSessions();

      this.isInitialized = true;
      console.log('Unified Trading Engine initialized successfully');

    } catch (error) {
      console.error('Failed to initialize trading engine:', error);
      throw error;
    }
  }

  /**
   * Load strategies from both systems
   */
  async loadStrategies() {
    // Load karsilas strategies
    const karsilasStrategiesPath = '/home/karsilas/trading-system/backend/strategies';
    const strategyFiles = await fs.readdir(karsilasStrategiesPath);

    for (const file of strategyFiles) {
      if (file.endsWith('.js') && !file.includes('backup') && !file.includes('old')) {
        try {
          const strategyPath = path.join(karsilasStrategiesPath, file);
          const strategy = require(strategyPath);
          const strategyName = file.replace('.js', '');

          this.strategies.set(strategyName, {
            name: strategyName,
            type: 'javascript',
            source: 'karsilas',
            module: strategy,
            path: strategyPath
          });

          console.log(`Loaded strategy: ${strategyName}`);
        } catch (error) {
          console.error(`Failed to load strategy ${file}:`, error);
        }
      }
    }

    // Load strategies from database
    const dbStrategies = await prisma.strategy.findMany({
      where: { isActive: true }
    });

    for (const strategy of dbStrategies) {
      this.strategies.set(strategy.name, {
        name: strategy.name,
        type: strategy.type,
        source: strategy.source,
        parameters: strategy.parameters,
        id: strategy.id
      });
    }

    console.log(`Loaded ${this.strategies.size} strategies`);
  }

  /**
   * Load active trading sessions
   */
  async loadActiveSessions() {
    const sessions = await prisma.tradingSession.findMany({
      where: {
        status: { in: ['active', 'paused'] }
      },
      include: {
        strategy: true
      }
    });

    for (const session of sessions) {
      this.activeSessions.set(session.id, session);

      // Subscribe to PnL tracking
      PnLTracker.subscribeSession(session.id);
    }

    console.log(`Loaded ${sessions.length} active sessions`);
  }

  /**
   * Run backtest with real historical data
   */
  async runBacktest(params) {
    const {
      strategyName,
      symbol,
      timeframe = '15m',
      startDate,
      endDate,
      initialCapital = 100,
      userId
    } = params;

    try {
      // Get strategy
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        throw new Error(`Strategy ${strategyName} not found`);
      }

      // Download historical data if needed
      await DataService.downloadHistoricalData(symbol, timeframe, startDate, endDate);

      // Run backtest
      const result = await BacktestEngine.runBacktest({
        strategy: strategy.module || strategy,
        symbol,
        timeframe,
        startDate,
        endDate,
        initialCapital
      });

      // Analyze performance
      const performance = PerformanceAnalyzer.analyze(result.trades, result.equityCurve);

      // Save to database
      const backtestRecord = await prisma.backtest.create({
        data: {
          userId,
          strategyName,
          symbol,
          timeframe,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          initialCapital,
          finalBalance: result.finalBalance,
          totalTrades: performance.totalTrades,
          winRate: performance.winRate,
          roi: performance.roi,
          sharpeRatio: performance.sharpeRatio,
          maxDrawdown: performance.maxDrawdown,
          trades: result.trades,
          equityCurve: result.equityCurve,
          performance
        }
      });

      return {
        id: backtestRecord.id,
        ...performance,
        trades: result.trades,
        equityCurve: result.equityCurve
      };

    } catch (error) {
      console.error('Backtest error:', error);
      throw error;
    }
  }

  /**
   * Run batch backtest for multiple pairs
   */
  async runBatchBacktest(params) {
    const {
      strategyName,
      symbols,
      timeframe,
      startDate,
      endDate,
      initialCapital,
      userId
    } = params;

    const results = [];

    for (const symbol of symbols) {
      try {
        const result = await this.runBacktest({
          strategyName,
          symbol,
          timeframe,
          startDate,
          endDate,
          initialCapital,
          userId
        });

        results.push({
          symbol,
          success: true,
          ...result
        });
      } catch (error) {
        results.push({
          symbol,
          success: false,
          error: error.message
        });
      }
    }

    // Sort by ROI
    results.sort((a, b) => (b.roi || 0) - (a.roi || 0));

    return results;
  }

  /**
   * Optimize strategy parameters with ±30% range
   */
  async optimizeStrategy(params) {
    const {
      strategyName,
      symbol,
      timeframe,
      startDate,
      endDate,
      baseParameters,
      userId
    } = params;

    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Strategy ${strategyName} not found`);
    }

    // Generate optimization ranges (±30%)
    const paramRanges = {};
    for (const [key, value] of Object.entries(baseParameters)) {
      if (typeof value === 'number') {
        paramRanges[key] = {
          min: Math.floor(value * 0.7),
          max: Math.ceil(value * 1.3),
          step: Math.max(1, Math.floor(value * 0.1))
        };
      }
    }

    // Generate all parameter combinations
    const combinations = this.generateParameterCombinations(paramRanges);
    const results = [];

    // Test each combination
    for (const params of combinations) {
      try {
        // Create modified strategy with new parameters
        const modifiedStrategy = {
          ...strategy.module,
          parameters: params
        };

        const result = await BacktestEngine.runBacktest({
          strategy: modifiedStrategy,
          symbol,
          timeframe,
          startDate,
          endDate,
          initialCapital: 100
        });

        const performance = PerformanceAnalyzer.analyze(result.trades, result.equityCurve);

        results.push({
          parameters: params,
          ...performance
        });
      } catch (error) {
        console.error('Optimization iteration error:', error);
      }
    }

    // Sort by ROI
    results.sort((a, b) => b.roi - a.roi);

    // Save optimization results
    await prisma.optimization.create({
      data: {
        userId,
        strategyName,
        symbol,
        timeframe,
        baseParameters,
        parameterRanges: paramRanges,
        results: results.slice(0, 10), // Top 10 results
        bestParameters: results[0]?.parameters,
        bestRoi: results[0]?.roi
      }
    });

    return {
      totalCombinations: combinations.length,
      topResults: results.slice(0, 10),
      bestParameters: results[0]?.parameters,
      bestPerformance: results[0]
    };
  }

  /**
   * Generate parameter combinations for optimization
   */
  generateParameterCombinations(ranges) {
    const keys = Object.keys(ranges);
    const combinations = [];

    function generate(index, current) {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }

      const key = keys[index];
      const range = ranges[key];

      for (let value = range.min; value <= range.max; value += range.step) {
        current[key] = value;
        generate(index + 1, current);
      }
    }

    generate(0, {});
    return combinations;
  }

  /**
   * Start paper trading session
   */
  async startPaperTrading(params) {
    const {
      userId,
      strategyName,
      symbol,
      timeframe = '15m',
      initialCapital = 100
    } = params;

    try {
      // Get strategy
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        throw new Error(`Strategy ${strategyName} not found`);
      }

      // Create session in database
      const session = await prisma.tradingSession.create({
        data: {
          userId,
          strategyId: strategy.id || strategyName,
          type: 'paper',
          status: 'active',
          startCapital: initialCapital,
          currentBalance: initialCapital,
          openPnL: 0,
          realizedPnL: 0,
          totalPnL: 0,
          roi: 0,
          winRate: 0,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          maxDrawdown: 0,
          positions: [],
          equityCurve: []
        }
      });

      // Start paper trading engine
      await PaperTradeEngine.startSession({
        sessionId: session.id,
        strategy: strategy.module || strategy,
        symbol,
        timeframe,
        initialCapital
      });

      // Subscribe to PnL tracking
      PnLTracker.subscribeSession(session.id);

      // Add to active sessions
      this.activeSessions.set(session.id, session);

      return session;

    } catch (error) {
      console.error('Failed to start paper trading:', error);
      throw error;
    }
  }

  /**
   * Stop paper trading session
   */
  async stopPaperTrading(sessionId) {
    try {
      // Stop in paper trade engine
      await PaperTradeEngine.stopSession(sessionId);

      // Unsubscribe from PnL tracking
      PnLTracker.unsubscribeSession(sessionId);

      // Update session status
      const session = await prisma.tradingSession.update({
        where: { id: sessionId },
        data: {
          status: 'stopped',
          stoppedAt: new Date()
        }
      });

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      return session;

    } catch (error) {
      console.error('Failed to stop paper trading:', error);
      throw error;
    }
  }

  /**
   * Get session details with open PnL
   */
  async getSessionDetails(sessionId) {
    const session = await prisma.tradingSession.findUnique({
      where: { id: sessionId },
      include: {
        user: true,
        strategy: true,
        trades: {
          orderBy: { executedAt: 'desc' },
          take: 50
        }
      }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Get PnL summary
    const pnlSummary = await PnLTracker.getSessionPnLSummary(sessionId);

    // Get open positions
    const openPositions = await prisma.position.findMany({
      where: {
        sessionId,
        status: 'open'
      },
      orderBy: { openedAt: 'desc' }
    });

    return {
      ...session,
      pnlSummary,
      openPositions
    };
  }

  /**
   * Process TradingView webhook
   */
  async processTradingViewWebhook(data, headers) {
    return await TradingViewWebhook.processWebhook(data, headers);
  }

  /**
   * Get all available strategies
   */
  getStrategies() {
    return Array.from(this.strategies.values()).map(strategy => ({
      name: strategy.name,
      type: strategy.type,
      source: strategy.source,
      parameters: strategy.parameters || {}
    }));
  }

  /**
   * Import Pine Script strategy
   */
  async importPineScript(params) {
    const { userId, name, code, description } = params;

    // Use the Pine Script converter agent
    const convertedStrategy = await this.convertPineScript(code);

    // Save strategy to database
    const strategy = await prisma.strategy.create({
      data: {
        name,
        type: 'pine_script',
        source: 'user_upload',
        code: convertedStrategy.javascript,
        parameters: convertedStrategy.parameters,
        defaultSettings: convertedStrategy.defaultSettings,
        createdBy: userId,
        description
      }
    });

    // Add to strategies map
    this.strategies.set(name, {
      name,
      type: 'pine_script',
      source: 'user_upload',
      module: convertedStrategy.module,
      id: strategy.id
    });

    return strategy;
  }

  /**
   * Convert Pine Script to JavaScript (placeholder for agent)
   */
  async convertPineScript(pineCode) {
    // This will be handled by the Pine Script converter agent
    // For now, return a basic structure
    return {
      javascript: '// Converted from Pine Script',
      parameters: {},
      defaultSettings: {},
      module: {
        name: 'Converted Strategy',
        init: function() {},
        next: function() { return null; }
      }
    };
  }

  /**
   * Get system health and statistics
   */
  async getSystemHealth() {
    const activeSessions = this.activeSessions.size;
    const totalStrategies = this.strategies.size;

    // Get database statistics
    const stats = await prisma.$transaction([
      prisma.tradingSession.count(),
      prisma.trade.count(),
      prisma.signal.count(),
      prisma.user.count()
    ]);

    return {
      status: 'healthy',
      uptime: process.uptime(),
      activeSessions,
      totalStrategies,
      database: {
        totalSessions: stats[0],
        totalTrades: stats[1],
        totalSignals: stats[2],
        totalUsers: stats[3]
      },
      services: {
        dataService: DataService.isInitialized,
        pnlTracker: PnLTracker.updateInterval !== null,
        webhookService: true
      }
    };
  }
}

module.exports = new UnifiedTradingEngine();