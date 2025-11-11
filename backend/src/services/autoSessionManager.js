// Auto Session Manager - Automatically manages paper trading sessions for all 98 pairs
// Ensures all pairs are actively trading with optimal strategies

import { getAllPairs, getExchangeForPair } from '../config/pairs.js';

export class AutoSessionManager {
  constructor(paperTradeEngine, pairAnalyzer, strategyLoader) {
    this.paperTradeEngine = paperTradeEngine;
    this.pairAnalyzer = pairAnalyzer;
    this.strategyLoader = strategyLoader;
    this.managedSessions = new Map(); // pair -> sessionId
    this.checkInterval = 3600000; // Check every hour
  }

  /**
   * Start auto-management of all 98 pairs
   */
  async start() {
    console.log('\n🤖 Auto Session Manager starting...');
    console.log('📊 Will manage paper trading for all 98 pairs\n');

    // Initial startup - start immediately with fallback strategy
    setTimeout(async () => {
      await this.ensureAllPairsActive();
    }, 30000); // Wait 30 seconds for system to stabilize

    // Check hourly and restart any failed sessions
    setInterval(async () => {
      await this.ensureAllPairsActive();
    }, this.checkInterval);

    console.log('✅ Auto Session Manager active');
  }

  /**
   * Ensure all 98 pairs have active paper trading sessions
   */
  async ensureAllPairsActive() {
    console.log('\n🔍 Checking all 98 pairs for active sessions...');

    const allPairs = getAllPairs();
    const activeSessions = this.paperTradeEngine.getAllSessions();
    const activeSessionPairs = new Set(activeSessions.map(s => s.pair));

    let newSessionCount = 0;
    let existingSessionCount = 0;

    for (const pair of allPairs) {
      try {
        if (activeSessionPairs.has(pair)) {
          // Session already exists
          existingSessionCount++;
          continue;
        }

        // No session for this pair - create one
        const recommendation = await this.getRecommendationForPair(pair);

        if (recommendation) {
          const sessionId = `auto-${pair.replace('/', '-')}-${Date.now()}`;

          await this.paperTradeEngine.startPaperTrade(
            sessionId,
            recommendation.strategy,
            pair,
            recommendation.timeframe,
            recommendation.params
          );

          this.managedSessions.set(pair, sessionId);
          newSessionCount++;

          console.log(`✅ Started: ${pair} with ${recommendation.strategy} on ${recommendation.timeframe}`);
        }
      } catch (err) {
        console.error(`❌ Failed to start session for ${pair}:`, err.message);
      }
    }

    console.log(`\n📊 Session Status: ${existingSessionCount} existing, ${newSessionCount} new`);
    console.log(`✅ Total active sessions: ${existingSessionCount + newSessionCount} / 98`);

    // Save all sessions
    await this.paperTradeEngine.saveSessions();
  }

  /**
   * Get optimal strategy recommendation for a pair
   */
  async getRecommendationForPair(pair) {
    // First, check if pair analyzer has recommendations
    const analyzerRecommendations = this.pairAnalyzer.getRecommendations();
    const pairRec = analyzerRecommendations.find(r => r.pair === pair);

    if (pairRec && pairRec.expectedROI > 0) {
      return {
        strategy: pairRec.strategy,
        timeframe: pairRec.timeframe,
        params: null // Use default strategy params
      };
    }

    // Fallback: Use default strategy with optimal timeframe for pair type
    const strategies = this.strategyLoader.getAllStrategies();

    if (strategies.length === 0) {
      return null;
    }

    // Select strategy based on pair characteristics
    const defaultStrategy = strategies[0].name; // Use first available strategy
    const timeframe = this.selectOptimalTimeframe(pair);

    return {
      strategy: defaultStrategy,
      timeframe,
      params: null
    };
  }

  /**
   * Select optimal timeframe based on pair characteristics
   */
  selectOptimalTimeframe(pair) {
    // Major pairs (BTC, ETH, XRP, SOL) - use lower timeframes for more trades
    const majorPairs = ['BTC/USDT', 'ETH/USDT', 'XRP/USDT', 'SOL/USDT'];

    if (majorPairs.includes(pair)) {
      return '5m'; // High liquidity, can trade frequently
    }

    // Mid-cap pairs - balanced timeframe
    const midCapPairs = ['DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'MATIC/USDT', 'DOT/USDT', 'LINK/USDT'];

    if (midCapPairs.includes(pair)) {
      return '15m';
    }

    // Smaller pairs - use higher timeframes to avoid noise
    return '1h';
  }

  /**
   * Get statistics about managed sessions
   */
  getStats() {
    const allPairs = getAllPairs();
    const activeSessions = this.paperTradeEngine.getAllSessions();

    const sessionsByExchange = {
      bybit: 0,
      bitget: 0,
      mexc: 0
    };

    activeSessions.forEach(session => {
      const exchange = getExchangeForPair(session.pair);
      if (exchange) {
        sessionsByExchange[exchange]++;
      }
    });

    return {
      totalPairs: allPairs.length,
      activeSessions: activeSessions.length,
      managedByAutoManager: this.managedSessions.size,
      coverage: ((activeSessions.length / allPairs.length) * 100).toFixed(1) + '%',
      sessionsByExchange
    };
  }

  /**
   * Force refresh all sessions (restart underperforming ones)
   */
  async refreshUnderperformingSessions() {
    console.log('\n🔄 Checking for underperforming sessions...');

    const activeSessions = this.paperTradeEngine.getAllSessions();
    let refreshedCount = 0;

    for (const session of activeSessions) {
      const metrics = session.metrics;

      // Restart if performance is poor
      if (metrics && metrics.totalTrades >= 10) {
        const shouldRefresh =
          metrics.winRate < 35 ||
          metrics.roi < -15 ||
          metrics.maxDrawdown > 12;

        if (shouldRefresh) {
          console.log(`🔄 Refreshing poor performer: ${session.pair} (WR: ${metrics.winRate}%, ROI: ${metrics.roi}%)`);

          // Stop old session
          await this.paperTradeEngine.stopPaperTrade(session.id);

          // Start new session with potentially better parameters
          const recommendation = await this.getRecommendationForPair(session.pair);

          if (recommendation) {
            const newSessionId = `auto-${session.pair.replace('/', '-')}-${Date.now()}`;

            await this.paperTradeEngine.startPaperTrade(
              newSessionId,
              recommendation.strategy,
              session.pair,
              recommendation.timeframe,
              recommendation.params
            );

            refreshedCount++;
          }
        }
      }
    }

    console.log(`✅ Refreshed ${refreshedCount} underperforming sessions`);
  }
}

export default AutoSessionManager;
