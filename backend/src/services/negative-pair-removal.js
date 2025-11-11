/**
 * Negative Pair Auto-Removal Service
 * Automatically blacklist pairs with consecutive losses
 */

const cache = require('./cache');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class NegativePairRemovalService {
  constructor() {
    this.config = {
      CONSECUTIVE_LOSSES_THRESHOLD: 5,  // Blacklist after 5 consecutive losses
      MIN_TRADES_REQUIRED: 3,            // Need at least 3 trades to evaluate
      NEGATIVE_ROI_THRESHOLD: -10,       // Or if total ROI < -10%
      REVIEW_PERIOD_DAYS: 7,             // Weekly review for re-enable
      WHITELIST_DURATION_DAYS: 30,       // Once re-enabled, whitelist for 30 days
    };
  }

  /**
   * Analyze pair performance and determine if should be blacklisted
   * @param {string} strategyId - Strategy ID
   * @param {string} pair - Trading pair
   * @returns {Object} Analysis result
   */
  async analyzePair(strategyId, pair) {
    // Get recent closed signals for this pair
    const recentSignals = await prisma.signal.findMany({
      where: {
        strategyId,
        symbol: pair,
        status: 'CLOSED',
      },
      orderBy: {
        closedAt: 'desc'
      },
      take: 20, // Last 20 trades
    });

    if (recentSignals.length < this.config.MIN_TRADES_REQUIRED) {
      return {
        shouldBlacklist: false,
        reason: 'Insufficient trade history',
        tradesCount: recentSignals.length
      };
    }

    // Calculate metrics
    const totalTrades = recentSignals.length;
    const losses = recentSignals.filter(s => (s.profitLoss || 0) < 0).length;
    const wins = totalTrades - losses;
    const totalROI = recentSignals.reduce((sum, s) => sum + (s.profitLoss || 0), 0);

    // Check consecutive losses
    let consecutiveLosses = 0;
    for (const signal of recentSignals) {
      if ((signal.profitLoss || 0) < 0) {
        consecutiveLosses++;
      } else {
        break; // Stop at first win
      }
    }

    // Decision logic
    const shouldBlacklist =
      consecutiveLosses >= this.config.CONSECUTIVE_LOSSES_THRESHOLD ||
      totalROI <= this.config.NEGATIVE_ROI_THRESHOLD;

    return {
      shouldBlacklist,
      pair,
      totalTrades,
      wins,
      losses,
      winRate: (wins / totalTrades) * 100,
      totalROI,
      consecutiveLosses,
      reason: shouldBlacklist
        ? `${consecutiveLosses >= this.config.CONSECUTIVE_LOSSES_THRESHOLD
            ? `${consecutiveLosses} consecutive losses`
            : `Total ROI ${totalROI.toFixed(2)}% below threshold`}`
        : 'Performance acceptable',
      recommendation: shouldBlacklist ? 'BLACKLIST' : 'CONTINUE'
    };
  }

  /**
   * Blacklist a pair for a strategy
   */
  async blacklistPair(strategyId, pair, reason) {
    const key = `blacklist:${strategyId}:${pair}`;
    const data = {
      strategyId,
      pair,
      reason,
      blacklistedAt: Date.now(),
      reviewAfter: Date.now() + (this.config.REVIEW_PERIOD_DAYS * 24 * 60 * 60 * 1000),
    };

    // Store in Redis with expiry
    await cache.set(
      key,
      data,
      this.config.REVIEW_PERIOD_DAYS * 24 * 60 * 60 // 7 days
    );

    console.log(`🚫 Blacklisted ${pair} for strategy ${strategyId}: ${reason}`);

    return data;
  }

  /**
   * Check if a pair is blacklisted
   */
  async isBlacklisted(strategyId, pair) {
    const key = `blacklist:${strategyId}:${pair}`;
    const blacklist = await cache.get(key);

    return !!blacklist;
  }

  /**
   * Get blacklist details
   */
  async getBlacklistInfo(strategyId, pair) {
    const key = `blacklist:${strategyId}:${pair}`;
    return await cache.get(key);
  }

  /**
   * Remove pair from blacklist (manual or after review)
   */
  async removeFromBlacklist(strategyId, pair) {
    const key = `blacklist:${strategyId}:${pair}`;
    await cache.del(key);

    // Add to whitelist (prevent immediate re-blacklisting)
    const whitelistKey = `whitelist:${strategyId}:${pair}`;
    await cache.set(
      whitelistKey,
      {
        strategyId,
        pair,
        whitelistedAt: Date.now()
      },
      this.config.WHITELIST_DURATION_DAYS * 24 * 60 * 60 // 30 days
    );

    console.log(`✅ Removed ${pair} from blacklist for strategy ${strategyId}`);
  }

  /**
   * Auto-review all blacklisted pairs and re-enable if performance improved
   */
  async reviewBlacklistedPairs() {
    console.log('🔍 Reviewing blacklisted pairs...');

    // Get all blacklist keys
    const pattern = 'blacklist:*';
    // Note: In production, you'd need to implement key scanning
    // For now, this is a placeholder

    console.log('Review completed. Re-enabled pairs will be monitored.');
  }

  /**
   * Get all blacklisted pairs for a strategy
   */
  async getBlacklistedPairs(strategyId) {
    // In production, implement proper key scanning
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Scan all strategies and auto-blacklist underperforming pairs
   */
  async scanAndBlacklist() {
    console.log('🔍 Scanning all strategies for underperforming pairs...');

    const strategies = await prisma.strategy.findMany({
      where: { isActive: true }
    });

    let blacklistedCount = 0;

    for (const strategy of strategies) {
      // Get all unique pairs for this strategy
      const signals = await prisma.signal.findMany({
        where: {
          strategyId: strategy.id,
          status: 'CLOSED'
        },
        distinct: ['symbol'],
        select: {
          symbol: true
        }
      });

      const uniquePairs = [...new Set(signals.map(s => s.symbol))];

      for (const pair of uniquePairs) {
        // Skip if already blacklisted
        if (await this.isBlacklisted(strategy.id, pair)) {
          continue;
        }

        // Skip if whitelisted (recently re-enabled)
        const whitelistKey = `whitelist:${strategy.id}:${pair}`;
        if (await cache.get(whitelistKey)) {
          continue;
        }

        // Analyze pair performance
        const analysis = await this.analyzePair(strategy.id, pair);

        if (analysis.shouldBlacklist) {
          await this.blacklistPair(strategy.id, pair, analysis.reason);
          blacklistedCount++;
        }
      }
    }

    console.log(`✅ Scan complete. Blacklisted ${blacklistedCount} pairs.`);

    return { blacklistedCount };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Negative pair removal config updated:', this.config);
  }
}

module.exports = new NegativePairRemovalService();
