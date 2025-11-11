const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * ADAPTIVE TP/SL CALCULATOR
 *
 * Calculates optimal Take Profit and Stop Loss levels based on:
 * - Historical performance data
 * - User risk profile (conservative/balanced/aggressive)
 * - Pair-specific statistics
 * - Real-time market conditions
 *
 * Features:
 * - Dynamic TP/SL based on pair performance
 * - User-configurable risk profiles
 * - Trailing stop loss support
 * - Break-even protection
 */
class AdaptiveTPSLCalculator {
  constructor() {
    this.performanceData = null;
    this.loadPerformanceData();

    // Default global recommendations
    this.globalRecommendations = {
      conservative: { tp: 2.35, sl: -4.12 },
      balanced: { tp: 3.13, sl: -2.75 },
      aggressive: { tp: 4.69, sl: -2.06 }
    };

    logger.info('✅ Adaptive TP/SL Calculator initialized');
  }

  /**
   * Load performance data from analysis report
   */
  loadPerformanceData() {
    try {
      const reportPath = '/tmp/performance-report.json';

      if (fs.existsSync(reportPath)) {
        const data = fs.readFileSync(reportPath, 'utf8');
        this.performanceData = JSON.parse(data);
        logger.info('✅ Performance data loaded');
      } else {
        logger.warn('⚠️  No performance report found, using defaults');
      }
    } catch (error) {
      logger.error('❌ Error loading performance data:', error.message);
    }
  }

  /**
   * Calculate TP/SL for a specific symbol and user profile
   */
  calculateTPSL(symbol, userProfile = 'balanced', options = {}) {
    const {
      useGlobalDefaults = false,
      trailingStopEnabled = false,
      breakEvenEnabled = true,
      minTP = 0.5,  // Minimum TP in %
      maxSL = -10.0  // Maximum SL in % (more negative = larger loss)
    } = options;

    try {
      // If using global defaults or no data available
      if (useGlobalDefaults || !this.performanceData) {
        return this.getGlobalRecommendation(userProfile);
      }

      // Find symbol-specific data
      const symbolData = this.findSymbolData(symbol);

      if (!symbolData) {
        logger.warn(`⚠️  No data for ${symbol}, using global defaults`);
        return this.getGlobalRecommendation(userProfile);
      }

      // Calculate TP/SL based on historical performance
      let tpsl = this.calculateFromHistoricalData(symbolData, userProfile);

      // Apply constraints
      tpsl.tp = Math.max(tpsl.tp, minTP);
      tpsl.sl = Math.max(tpsl.sl, maxSL);

      // Add metadata
      tpsl.symbol = symbol;
      tpsl.profile = userProfile;
      tpsl.basedOn = 'historical';
      tpsl.sampleSize = symbolData.totalTrades;
      tpsl.winRate = symbolData.winRate;

      // Add trailing stop configuration if enabled
      if (trailingStopEnabled) {
        tpsl.trailingStop = {
          enabled: true,
          activationPercent: tpsl.tp * 0.5,  // Activate at 50% of TP
          callbackPercent: tpsl.tp * 0.25    // Trail back by 25% of TP
        };
      }

      // Add break-even protection if enabled
      if (breakEvenEnabled) {
        tpsl.breakEven = {
          enabled: true,
          activationPercent: tpsl.tp * 0.4,  // Move SL to BE at 40% of TP
          offsetPercent: 0.1                  // Slightly above entry (0.1% profit)
        };
      }

      logger.info(`📊 TP/SL for ${symbol} (${userProfile}): TP ${tpsl.tp.toFixed(2)}% / SL ${tpsl.sl.toFixed(2)}%`);

      return tpsl;

    } catch (error) {
      logger.error(`❌ Error calculating TP/SL for ${symbol}:`, error.message);
      return this.getGlobalRecommendation(userProfile);
    }
  }

  /**
   * Calculate TP/SL from historical data
   */
  calculateFromHistoricalData(symbolData, profile) {
    const avgWin = symbolData.avgWin || 0;
    const avgLoss = symbolData.avgLoss || 0;
    const recommendedTP = symbolData.recommendedTP || avgWin;
    const recommendedSL = symbolData.recommendedSL || avgLoss;

    let tp, sl;

    switch (profile) {
      case 'conservative':
        // Lower TP, wider SL (prioritize win rate)
        tp = recommendedTP * 0.75;
        sl = recommendedSL * 1.5;
        break;

      case 'aggressive':
        // Higher TP, tighter SL (maximize profits)
        tp = recommendedTP * 1.5;
        sl = recommendedSL * 0.75;
        break;

      case 'balanced':
      default:
        // Use recommended values
        tp = recommendedTP;
        sl = recommendedSL;
        break;
    }

    return { tp, sl };
  }

  /**
   * Find symbol data in performance report
   */
  findSymbolData(symbol) {
    if (!this.performanceData || !this.performanceData.bySymbol) {
      return null;
    }

    // Normalize symbol (handle .P suffix)
    const normalizedSymbol = symbol.endsWith('.P') ? symbol : symbol + '.P';

    return this.performanceData.bySymbol.find(s =>
      s.symbol === symbol ||
      s.symbol === normalizedSymbol ||
      s.symbol === symbol.replace('.P', '')
    );
  }

  /**
   * Get global recommendation for user profile
   */
  getGlobalRecommendation(profile) {
    const recommendation = this.globalRecommendations[profile] || this.globalRecommendations.balanced;

    return {
      tp: recommendation.tp,
      sl: recommendation.sl,
      profile,
      basedOn: 'global',
      sampleSize: null,
      winRate: null
    };
  }

  /**
   * Calculate dynamic TP/SL based on current PnL
   * (for trailing stops and break-even)
   */
  calculateDynamicTPSL(entryPrice, currentPrice, direction, config) {
    const {
      originalTP,
      originalSL,
      trailingStop = null,
      breakEven = null
    } = config;

    // Calculate current PnL
    let currentPnL;
    if (direction === 'LONG') {
      currentPnL = ((currentPrice - entryPrice) / entryPrice) * 100;
    } else {
      currentPnL = ((entryPrice - currentPrice) / entryPrice) * 100;
    }

    let newSL = originalSL;
    let modifications = [];

    // Break-even protection
    if (breakEven && breakEven.enabled && currentPnL >= breakEven.activationPercent) {
      newSL = breakEven.offsetPercent;
      modifications.push('break_even');
      logger.info(`🔒 Break-even activated at ${currentPnL.toFixed(2)}% PnL`);
    }

    // Trailing stop
    if (trailingStop && trailingStop.enabled && currentPnL >= trailingStop.activationPercent) {
      const trailingSL = currentPnL - trailingStop.callbackPercent;

      if (trailingSL > newSL) {
        newSL = trailingSL;
        modifications.push('trailing_stop');
        logger.info(`📈 Trailing stop updated: ${newSL.toFixed(2)}%`);
      }
    }

    return {
      currentPnL,
      newTP: originalTP,
      newSL,
      modifications,
      shouldUpdate: modifications.length > 0
    };
  }

  /**
   * Calculate position size based on risk and TP/SL
   */
  calculatePositionSize(accountBalance, riskPercent, entryPrice, stopLossPrice, direction) {
    // Calculate risk amount in USDT
    const riskAmount = accountBalance * (riskPercent / 100);

    // Calculate stop loss distance in %
    let slDistance;
    if (direction === 'LONG') {
      slDistance = ((entryPrice - stopLossPrice) / entryPrice) * 100;
    } else {
      slDistance = ((stopLossPrice - entryPrice) / entryPrice) * 100;
    }

    // Ensure positive distance
    slDistance = Math.abs(slDistance);

    if (slDistance === 0) {
      logger.error('❌ Invalid SL distance: 0%');
      return 0;
    }

    // Calculate position size
    // Risk Amount = Position Size × Entry Price × (SL Distance / 100)
    // Position Size = Risk Amount / (Entry Price × SL Distance / 100)
    const positionSize = riskAmount / (entryPrice * (slDistance / 100));

    logger.info(`💰 Position Size: ${positionSize.toFixed(4)} (Risk: $${riskAmount.toFixed(2)}, SL Distance: ${slDistance.toFixed(2)}%)`);

    return positionSize;
  }

  /**
   * Get recommended settings for all symbols
   */
  getAllRecommendations(profile = 'balanced') {
    if (!this.performanceData || !this.performanceData.bySymbol) {
      return [];
    }

    return this.performanceData.bySymbol
      .filter(s => s.totalTrades >= 10)  // Minimum 10 trades for reliability
      .map(symbolData => {
        const tpsl = this.calculateFromHistoricalData(symbolData, profile);
        return {
          symbol: symbolData.symbol,
          ...tpsl,
          winRate: symbolData.winRate,
          totalTrades: symbolData.totalTrades,
          avgPnL: symbolData.avgPnL
        };
      })
      .sort((a, b) => b.avgPnL - a.avgPnL);  // Sort by performance
  }

  /**
   * Reload performance data
   */
  reloadPerformanceData() {
    this.loadPerformanceData();
    logger.info('🔄 Performance data reloaded');
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new AdaptiveTPSLCalculator();
    }
    return instance;
  },
  AdaptiveTPSLCalculator
};
