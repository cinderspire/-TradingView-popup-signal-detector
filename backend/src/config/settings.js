// System Settings

export const settings = {
  // Trading fees (0.1% = 0.001)
  tradingFee: 0.001,

  // Slippage (0.05% = 0.0005)
  slippage: 0.0005,

  // Initial capital for backtesting/paper trading
  initialCapital: 100,

  // Position sizing - FIXED $100 per trade (100% of initial capital)
  positionSize: 1.0, // 100% = $100 fixed

  // Real Trading Settings
  realTradingOrderSize: 1.50, // Fixed $1.50 USDT per order (can be changed)
  realTradingMaxPositions: 10, // Max simultaneous real positions

  // Max positions at once
  maxPositions: 5,

  // Risk management
  maxDrawdown: 0.08, // 8% max DD threshold
  maxDailyLoss: 0.03, // 3% daily loss limit

  // Strategy quality thresholds
  minWinRate: 0.5,
  minSharpeRatio: 1.5,
  minSortinoRatio: 1.5,
  minProfitFactor: 1.5,

  // Long/Short ratio balance
  targetLongShortRatio: 1.0, // 50/50

  // Historical data settings
  initialDataMonths: 2,
  updateInterval: 60000, // 1 minute in ms

  // WebSocket settings
  wsReconnectDelay: 5000,
  wsMaxRetries: 10,

  // Adaptive Systems Toggles (ON/OFF switches for intelligent features)
  adaptiveRiskEnabled: true,      // Use ATR-based dynamic TP/SL and trailing stops
  newsMonitorEnabled: false,      // Monitor news and warn/exit on negative events
  trendEnhancementEnabled: false, // Use trend analysis to enhance entries
  predictionTrackingEnabled: true, // Track prediction accuracy

  // Logging
  logLevel: 'info', // 'error', 'warn', 'info', 'debug'
  logToFile: true,

  // Server
  port: 3001,
  frontendPort: 5173,

  // Data paths
  dataPath: '/home/karsilas/trading-system/backend/data',
  historicalDataPath: '/home/karsilas/trading-system/backend/data/historical',
  cachePath: '/home/karsilas/trading-system/backend/data/cache',
  logsPath: '/home/karsilas/trading-system/backend/data/logs',
  strategiesPath: '/home/karsilas/trading-system/backend/strategies'
};

export default settings;
