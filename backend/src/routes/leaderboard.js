const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Calculate provider performance score
 * Multi-factor algorithm: winRate (40%) + P/L (30%) + subscribers (20%) + consistency (10%)
 */
function calculateProviderScore(stats) {
  const winRateScore = (stats.winRate || 0) * 0.4;
  const pnlScore = Math.min(Math.max((parseFloat(stats.totalPnl) || 0) / 100, 0), 100) * 0.3; // Normalize P/L
  const subscriberScore = Math.min((stats.subscriberCount || 0) * 2, 100) * 0.2; // Cap at 50 subs
  const consistencyScore = (stats.consistency || 0) * 0.1;

  return winRateScore + pnlScore + subscriberScore + consistencyScore;
}

/**
 * Calculate closed positions from execution logs
 * Matches BUY (entry) with SELL (exit) to determine P/L
 */
function calculateClosedPositions(executions) {
  const positions = [];
  const openPositions = new Map();

  executions.sort((a, b) => a.executedAt - b.executedAt);

  for (const exec of executions) {
    const key = exec.symbol;

    if (exec.side === 'buy') {
      if (!openPositions.has(key)) {
        openPositions.set(key, []);
      }
      openPositions.get(key).push({
        entryPrice: exec.price || 0,
        amount: exec.amount || 0,
        entryTime: exec.executedAt
      });
    } else if (exec.side === 'sell') {
      if (openPositions.has(key) && openPositions.get(key).length > 0) {
        const entry = openPositions.get(key).shift();
        const pnl = (exec.price - entry.entryPrice) * entry.amount;
        positions.push({
          symbol: key,
          pnl: pnl,
          entryTime: entry.entryTime,
          exitTime: exec.executedAt
        });
      }
    }
  }

  return positions;
}

/**
 * Calculate consistency score (percentage of profitable weeks)
 */
function calculateConsistency(positions) {
  if (positions.length === 0) return 0;

  // Group positions by week
  const weeklyResults = new Map();

  positions.forEach(pos => {
    const weekKey = getWeekKey(pos.exitTime);
    if (!weeklyResults.has(weekKey)) {
      weeklyResults.set(weekKey, 0);
    }
    weeklyResults.set(weekKey, weeklyResults.get(weekKey) + pos.pnl);
  });

  const profitableWeeks = Array.from(weeklyResults.values()).filter(pnl => pnl > 0).length;
  const totalWeeks = weeklyResults.size;

  return totalWeeks > 0 ? (profitableWeeks / totalWeeks) * 100 : 0;
}

/**
 * Get week key from date (YYYY-WW format)
 */
function getWeekKey(date) {
  const d = new Date(date);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Filter executions by time period
 */
function filterByTimePeriod(executions, period) {
  if (period === 'all-time') return executions;

  const now = new Date();
  let cutoffDate;

  if (period === 'week') {
    cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === 'month') {
    cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    return executions; // Default to all-time
  }

  return executions.filter(exec => new Date(exec.executedAt) >= cutoffDate);
}

/**
 * GET /api/leaderboard/top-providers
 * Get top performing providers with rankings
 * Query params:
 *   - period: 'week' | 'month' | 'all-time' (default: 'all-time')
 *   - limit: number of providers to return (default: 10)
 */
router.get('/top-providers', async (req, res) => {
  try {
    const { period = 'all-time', limit = 10 } = req.query;
    const limitNum = parseInt(limit);

    // Get all providers (users with active strategies)
    const providers = await prisma.user.findMany({
      where: {
        role: 'PROVIDER',
        strategies: {
          some: {
            isActive: true
          }
        }
      },
      include: {
        strategies: {
          where: { isActive: true },
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      }
    });

    // Calculate stats for each provider
    const providerStats = await Promise.all(
      providers.map(async (provider) => {
        // Get all strategy IDs for this provider
        const strategyIds = provider.strategies.map(s => s.id);

        // Get all executions for provider's strategies
        const executions = await prisma.executionLog.findMany({
          where: {
            subscription: {
              strategyId: { in: strategyIds }
            },
            status: 'SUCCESS'
          },
          orderBy: { executedAt: 'asc' }
        });

        // Filter by time period
        const filteredExecutions = filterByTimePeriod(executions, period);

        // Calculate closed positions
        const closedPositions = calculateClosedPositions(filteredExecutions);

        // Calculate statistics
        const totalTrades = closedPositions.length;
        const winningTrades = closedPositions.filter(p => p.pnl > 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;
        const totalPnl = closedPositions.reduce((sum, p) => sum + p.pnl, 0);
        const consistency = calculateConsistency(closedPositions);

        // Count total subscribers across all strategies
        const subscriberCount = provider.strategies.reduce(
          (sum, strategy) => sum + strategy.subscriptions.length,
          0
        );

        // Count total signals
        const totalSignals = await prisma.signal.count({
          where: { strategyId: { in: strategyIds } }
        });

        const stats = {
          providerId: provider.id,
          providerUsername: provider.username,
          providerEmail: provider.email,
          totalStrategies: provider.strategies.length,
          subscriberCount,
          totalSignals,
          totalTrades,
          winningTrades,
          losingTrades: totalTrades - winningTrades,
          winRate: parseFloat(winRate.toFixed(2)),
          totalPnl: parseFloat(totalPnl.toFixed(2)),
          avgPnl: totalTrades > 0 ? parseFloat((totalPnl / totalTrades).toFixed(2)) : 0,
          consistency: parseFloat(consistency.toFixed(2))
        };

        // Calculate overall score
        stats.score = calculateProviderScore(stats);

        return stats;
      })
    );

    // Sort by different metrics
    const byWinRate = [...providerStats]
      .filter(p => p.totalTrades >= 3) // Min 3 trades to qualify
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, limitNum);

    const byPnl = [...providerStats]
      .filter(p => p.totalTrades >= 3)
      .sort((a, b) => b.totalPnl - a.totalPnl)
      .slice(0, limitNum);

    const bySubscribers = [...providerStats]
      .sort((a, b) => b.subscriberCount - a.subscriberCount)
      .slice(0, limitNum);

    const byScore = [...providerStats]
      .filter(p => p.totalTrades >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limitNum);

    // Add rank to each category
    byWinRate.forEach((p, index) => p.rank = index + 1);
    byPnl.forEach((p, index) => p.rank = index + 1);
    bySubscribers.forEach((p, index) => p.rank = index + 1);
    byScore.forEach((p, index) => p.rank = index + 1);

    res.json({
      success: true,
      period,
      leaderboards: {
        byWinRate,
        byPnl,
        bySubscribers,
        byScore
      },
      metadata: {
        totalProviders: providers.length,
        qualifiedProviders: providerStats.filter(p => p.totalTrades >= 3).length,
        minTrades: 3,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate leaderboard',
      error: error.message
    });
  }
});

/**
 * GET /api/leaderboard/provider/:id
 * Get specific provider's ranking and stats
 */
router.get('/provider/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { period = 'all-time' } = req.query;

    // Get provider
    const provider = await prisma.user.findUnique({
      where: { id },
      include: {
        strategies: {
          where: { isActive: true },
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      }
    });

    if (!provider || provider.role !== 'PROVIDER') {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Calculate provider stats (reuse logic from top-providers)
    const strategyIds = provider.strategies.map(s => s.id);
    const executions = await prisma.executionLog.findMany({
      where: {
        subscription: {
          strategyId: { in: strategyIds }
        },
        status: 'SUCCESS'
      },
      orderBy: { executedAt: 'asc' }
    });

    const filteredExecutions = filterByTimePeriod(executions, period);
    const closedPositions = calculateClosedPositions(filteredExecutions);

    const totalTrades = closedPositions.length;
    const winningTrades = closedPositions.filter(p => p.pnl > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;
    const totalPnl = closedPositions.reduce((sum, p) => sum + p.pnl, 0);
    const consistency = calculateConsistency(closedPositions);

    const subscriberCount = provider.strategies.reduce(
      (sum, strategy) => sum + strategy.subscriptions.length,
      0
    );

    const stats = {
      providerId: provider.id,
      providerUsername: provider.username,
      totalStrategies: provider.strategies.length,
      subscriberCount,
      totalTrades,
      winningTrades,
      losingTrades: totalTrades - winningTrades,
      winRate: parseFloat(winRate.toFixed(2)),
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      avgPnl: totalTrades > 0 ? parseFloat((totalPnl / totalTrades).toFixed(2)) : 0,
      consistency: parseFloat(consistency.toFixed(2)),
      score: 0
    };

    stats.score = calculateProviderScore(stats);

    res.json({
      success: true,
      period,
      provider: stats
    });

  } catch (error) {
    console.error('Error fetching provider ranking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provider ranking',
      error: error.message
    });
  }
});

/**
 * GET /api/leaderboard/stats
 * Get platform-wide statistics for landing page
 */
router.get('/stats', async (req, res) => {
  try {
    // Get all active strategies
    const strategies = await prisma.strategy.findMany({
      where: { isActive: true },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    // Get all providers
    const providers = await prisma.user.findMany({
      where: { role: 'PROVIDER' }
    });

    // Get all signals
    const signals = await prisma.signal.findMany();

    // Get all successful executions for win rate calculation
    const executions = await prisma.executionLog.findMany({
      where: { status: 'SUCCESS' },
      orderBy: { executedAt: 'asc' }
    });

    const closedPositions = calculateClosedPositions(executions);
    const totalTrades = closedPositions.length;
    const winningTrades = closedPositions.filter(p => p.pnl > 0).length;
    const avgWinRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;

    // Count total subscribers across all strategies
    const totalSubscribers = strategies.reduce((sum, s) => sum + s.subscriptions.length, 0);

    const stats = {
      totalStrategies: strategies.length,
      totalProviders: providers.length,
      totalSignals: signals.length,
      avgWinRate: parseFloat(avgWinRate.toFixed(2)),
      totalSubscribers,
      totalTrades
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform stats',
      error: error.message
    });
  }
});

module.exports = router;
