const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Badge assignment criteria
 */
function assignBadges(providerStats, leaderboardPosition = null) {
  const badges = [];
  const now = new Date();

  // TOP_PERFORMER - Top 3 in leaderboard
  if (leaderboardPosition && leaderboardPosition <= 3) {
    badges.push('TOP_PERFORMER');
  }

  // HALL_OF_FAME - Top all-time (high score + consistent performance)
  if (providerStats.score >= 80 && providerStats.totalTrades >= 50) {
    badges.push('HALL_OF_FAME');
  }

  // CONSISTENT_TRADER - >80% win rate for 3+ months with min 30 trades
  if (providerStats.winRate >= 80 && providerStats.totalTrades >= 30 && providerStats.consistency >= 70) {
    badges.push('CONSISTENT_TRADER');
  }

  // VERIFIED - Manual verification (for now, auto-verify if 20+ trades and positive P/L)
  if (providerStats.totalTrades >= 20 && providerStats.totalPnl > 0) {
    badges.push('VERIFIED');
  }

  // NEW_PROVIDER - Created within last 30 days
  if (providerStats.createdAt) {
    const daysSinceCreation = (now - new Date(providerStats.createdAt)) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation <= 30) {
      badges.push('NEW_PROVIDER');
    }
  }

  // RISING_STAR - Fast subscriber growth (mock for now - would need historical data)
  if (providerStats.subscriberCount >= 10 && providerStats.totalTrades >= 10) {
    badges.push('RISING_STAR');
  }

  // HOT_THIS_WEEK - Recent activity and growth (mock for now)
  if (providerStats.recentActivity && providerStats.recentActivity.weeklyTrades >= 5) {
    badges.push('HOT_THIS_WEEK');
  }

  return badges;
}

/**
 * GET /api/badges/provider/:id
 * Get badges for a specific provider
 */
router.get('/provider/:id', async (req, res) => {
  try {
    const { id } = req.params;

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

    // Get strategy IDs
    const strategyIds = provider.strategies.map(s => s.id);

    // Get executions
    const executions = await prisma.executionLog.findMany({
      where: {
        subscription: {
          strategyId: { in: strategyIds }
        },
        status: 'SUCCESS'
      },
      orderBy: { executedAt: 'asc' }
    });

    // Calculate basic stats (simplified version of leaderboard logic)
    const closedPositions = calculateClosedPositions(executions);
    const totalTrades = closedPositions.length;
    const winningTrades = closedPositions.filter(p => p.pnl > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;
    const totalPnl = closedPositions.reduce((sum, p) => sum + p.pnl, 0);
    const subscriberCount = provider.strategies.reduce((sum, s) => sum + s.subscriptions.length, 0);

    // Check recent activity
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentExecutions = executions.filter(e => new Date(e.executedAt) >= oneWeekAgo);
    const recentPositions = calculateClosedPositions(recentExecutions);

    const providerStats = {
      totalTrades,
      winningTrades,
      winRate,
      totalPnl,
      subscriberCount,
      score: calculateScore({ totalTrades, winningTrades, winRate, totalPnl, subscriberCount }),
      consistency: 70, // Mock - would need historical calculation
      createdAt: provider.createdAt,
      recentActivity: {
        weeklyTrades: recentPositions.length
      }
    };

    // Assign badges
    const badges = assignBadges(providerStats);

    res.json({
      success: true,
      providerId: provider.id,
      providerUsername: provider.username,
      badges,
      stats: providerStats
    });

  } catch (error) {
    console.error('Error fetching provider badges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provider badges',
      error: error.message
    });
  }
});

/**
 * GET /api/badges/strategy/:id
 * Get badges for a specific strategy
 */
router.get('/strategy/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const strategy = await prisma.strategy.findUnique({
      where: { id },
      include: {
        provider: true,
        subscriptions: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    // Get executions for this strategy
    const executions = await prisma.executionLog.findMany({
      where: {
        subscription: {
          strategyId: id
        },
        status: 'SUCCESS'
      },
      orderBy: { executedAt: 'asc' }
    });

    const closedPositions = calculateClosedPositions(executions);
    const totalTrades = closedPositions.length;
    const winningTrades = closedPositions.filter(p => p.pnl > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;
    const totalPnl = closedPositions.reduce((sum, p) => sum + p.pnl, 0);

    const strategyStats = {
      totalTrades,
      winningTrades,
      winRate,
      totalPnl,
      subscriberCount: strategy.subscriptions.length,
      score: calculateScore({ totalTrades, winningTrades, winRate, totalPnl, subscriberCount: strategy.subscriptions.length }),
      consistency: 70,
      createdAt: strategy.createdAt,
      recentActivity: { weeklyTrades: 0 }
    };

    const badges = assignBadges(strategyStats);

    res.json({
      success: true,
      strategyId: strategy.id,
      strategyName: strategy.name,
      providerId: strategy.providerId,
      badges,
      stats: strategyStats
    });

  } catch (error) {
    console.error('Error fetching strategy badges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch strategy badges',
      error: error.message
    });
  }
});

// Helper functions
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
          pnl,
          entryTime: entry.entryTime,
          exitTime: exec.executedAt
        });
      }
    }
  }

  return positions;
}

function calculateScore(stats) {
  const winRateScore = (stats.winRate || 0) * 0.4;
  const pnlScore = Math.min(Math.max((stats.totalPnl || 0) / 100, 0), 100) * 0.3;
  const subscriberScore = Math.min((stats.subscriberCount || 0) * 2, 100) * 0.2;
  const consistencyScore = 70 * 0.1;
  return winRateScore + pnlScore + subscriberScore + consistencyScore;
}

module.exports = router;
