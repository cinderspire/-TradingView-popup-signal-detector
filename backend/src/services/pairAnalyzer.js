// Pair Analyzer - Top 100 pairs analysis for optimal selection
// Analyzes which pairs perform best with which strategies

import settings from '../config/settings.js';
import { Helpers } from '../utils/helpers.js';

export class PairAnalyzer {
  constructor(dataService, strategyLoader) {
    this.dataService = dataService;
    this.strategyLoader = strategyLoader;
    this.pairPerformance = new Map();
    this.analysisInterval = 3600000; // 1 hour
    this.top100Pairs = [];
    this.lastAnalysis = null;
  }

  /**
   * Start continuous analysis
   */
  async start() {
    console.log('📊 Pair Analyzer starting...');

    // Initial analysis after 2 minutes
    setTimeout(() => {
      this.analyzeTop100Pairs().catch(err =>
        console.error('Pair analysis error:', err.message)
      );
    }, 30000);

    // Run analysis every hour
    setInterval(() => {
      this.analyzeTop100Pairs().catch(err =>
        console.error('Pair analysis error:', err.message)
      );
    }, this.analysisInterval);

    console.log('✅ Pair Analyzer active - will analyze top pairs every hour');
  }

  /**
   * Analyze top 100 pairs for best performance
   */
  async analyzeTop100Pairs() {
    console.log('📊 Analyzing ALL 98 pairs performance...');

    const { getAllPairs } = await import('../config/pairs.js');
    const allPairs = getAllPairs();

    const results = [];

    // Analyze ALL 98 pairs
    for (const pair of allPairs) {
      try {
        const pairResult = await this.analyzePair(pair);
        if (pairResult) {
          results.push(pairResult);
        }
      } catch (err) {
        console.error(`Failed to analyze ${pair}:`, err.message);
      }
    }

    // Sort by best ROI
    results.sort((a, b) => b.bestROI - a.bestROI);
    this.top100Pairs = results;
    this.lastAnalysis = Date.now();

    console.log(`✅ Analyzed ${results.length} pairs - Top 3: ${results.slice(0, 3).map(r => `${r.pair} (${r.bestROI.toFixed(2)}%)`).join(', ')}`);

    return results;
  }

  /**
   * Analyze single pair across all strategies and timeframes
   */
  async analyzePair(pair) {
    const strategies = this.strategyLoader.getAllStrategies();
    const timeframes = ['5m', '15m', '1h', '4h'];

    let bestROI = -Infinity;
    let bestStrategy = null;
    let bestTimeframe = null;
    let bestWinRate = 0;
    let bestSharpe = 0;

    for (const strategy of strategies) {
      for (const timeframe of timeframes) {
        try {
          const data = await this.dataService.loadHistoricalData(pair, timeframe);
          if (!data || data.length < 100) continue;

          // Quick backtest on last 500 candles
          const recent = data.slice(-500);
          const result = await this.quickBacktest(strategy.name, pair, timeframe, recent);

          if (result && result.roi > bestROI) {
            bestROI = result.roi;
            bestStrategy = strategy.name;
            bestTimeframe = timeframe;
            bestWinRate = result.winRate;
            bestSharpe = result.sharpe;
          }
        } catch (err) {
          // Skip errors
        }
      }
    }

    if (bestStrategy) {
      const performance = {
        pair,
        bestStrategy,
        bestTimeframe,
        bestROI,
        bestWinRate,
        bestSharpe,
        score: this.calculatePairScore(bestROI, bestWinRate, bestSharpe),
        timestamp: Date.now()
      };

      this.pairPerformance.set(pair, performance);
      return performance;
    }

    return null;
  }

  /**
   * Quick backtest on recent data
   */
  async quickBacktest(strategyName, pair, timeframe, candles) {
    const strategy = this.strategyLoader.getStrategy(strategyName);
    if (!strategy) return null;

    const indicators = strategy.init(candles, strategy.params);
    let capital = settings.initialCapital;
    let position = null;
    const trades = [];

    for (let i = 50; i < candles.length; i++) {
      const close = candles[i][4];

      if (!position) {
        const signal = strategy.next(i, candles, indicators, strategy.params);
        if (signal && signal.signal === 'buy') {
          const positionSize = capital * settings.positionSize;
          const fee = positionSize * settings.tradingFee;
          position = {
            entryPrice: close,
            size: positionSize / close,
            cost: positionSize + fee
          };
          capital -= (positionSize + fee);
        }
      } else {
        const signal = strategy.next(i, candles, indicators, strategy.params);
        if (signal && signal.signal === 'sell') {
          const exitValue = position.size * close;
          const fee = exitValue * settings.tradingFee;
          const pnl = exitValue - position.cost - fee;

          trades.push({
            pnl,
            pnlPercent: (pnl / position.cost) * 100
          });

          capital += exitValue - fee;
          position = null;
        }
      }
    }

    if (trades.length < 3) return null;

    const wins = trades.filter(t => t.pnl > 0);
    const winRate = (wins.length / trades.length) * 100;
    const returns = trades.map(t => t.pnlPercent / 100);
    const roi = ((capital - settings.initialCapital) / settings.initialCapital) * 100;
    const sharpe = Helpers.sharpeRatio(returns);

    return { roi, winRate, sharpe, trades: trades.length };
  }

  /**
   * Calculate pair performance score
   */
  calculatePairScore(roi, winRate, sharpe) {
    // Weighted: ROI (50%) + Win Rate (30%) + Sharpe (20%)
    const roiScore = Math.max(0, Math.min(100, roi * 2));
    const sharpeScore = Math.min(100, sharpe * 33);
    return (roiScore * 0.5) + (winRate * 0.3) + (sharpeScore * 0.2);
  }

  /**
   * Get top performing pairs
   */
  getTopPairs(limit = 10) {
    return this.top100Pairs.slice(0, limit);
  }

  /**
   * Get recommendations for new paper trades
   */
  getRecommendations() {
    const top = this.top100Pairs.slice(0, 5);

    return top.map(p => ({
      pair: p.pair,
      strategy: p.bestStrategy,
      timeframe: p.bestTimeframe,
      expectedROI: p.bestROI,
      winRate: p.bestWinRate,
      confidence: p.score,
      reason: `Best performer: ${p.bestROI.toFixed(2)}% ROI, ${p.bestWinRate.toFixed(1)}% WR`
    }));
  }

  /**
   * Get analysis statistics
   */
  getStats() {
    return {
      totalPairsAnalyzed: this.top100Pairs.length,
      lastAnalysis: this.lastAnalysis,
      topPairs: this.top100Pairs.slice(0, 5).map(p => ({
        pair: p.pair,
        strategy: p.bestStrategy,
        timeframe: p.bestTimeframe,
        roi: p.bestROI.toFixed(2) + '%',
        winRate: p.bestWinRate.toFixed(1) + '%',
        score: p.score.toFixed(2)
      }))
    };
  }
}

export default PairAnalyzer;
