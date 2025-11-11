const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

/**
 * Calculate closed positions from execution logs
 * Matches BUY (entry) with SELL (exit) to determine P/L
 */
function calculateClosedPositions(executions) {
  const positions = [];
  const openPositions = new Map(); // symbol -> {entry, amount}

  // Sort by execution time
  executions.sort((a, b) => a.executedAt - b.executedAt);

  for (const exec of executions) {
    const key = exec.symbol;

    if (exec.side === 'buy') {
      // Entry - open position
      if (!openPositions.has(key)) {
        openPositions.set(key, []);
      }
      openPositions.get(key).push({
        entryPrice: exec.price || 0,
        amount: exec.amount || 0,
        entryTime: exec.executedAt
      });
    } else if (exec.side === 'sell') {
      // Exit - close position
      if (openPositions.has(key) && openPositions.get(key).length > 0) {
        const entry = openPositions.get(key).shift();

        const pnl = (exec.price - entry.entryPrice) * entry.amount;
        const pnlPercent = entry.entryPrice > 0
          ? ((exec.price - entry.entryPrice) / entry.entryPrice * 100)
          : 0;

        positions.push({
          symbol: key,
          entryPrice: entry.entryPrice,
          exitPrice: exec.price,
          amount: entry.amount,
          pnl: pnl,
          pnlPercent: pnlPercent,
          entryTime: entry.entryTime,
          exitTime: exec.executedAt,
          duration: exec.executedAt - entry.entryTime
        });
      }
    }
  }

  return positions;
}

/**
 * GET /api/stats/subscription/:id
 * Get performance stats for a specific subscription
 */
router.get('/subscription/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify user owns this subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Get all successful executions for this subscription
    const executions = await prisma.executionLog.findMany({
      where: {
        subscriptionId: id,
        status: 'SUCCESS'
      },
      orderBy: { executedAt: 'asc' }
    });

    // Calculate closed positions
    const closedPositions = calculateClosedPositions(executions);

    // Calculate statistics
    const totalTrades = closedPositions.length;
    const winningTrades = closedPositions.filter(p => p.pnl > 0).length;
    const losingTrades = closedPositions.filter(p => p.pnl < 0).length;
    const winRate = totalTrades > 0
      ? (winningTrades / totalTrades * 100).toFixed(2)
      : 0;

    const totalPnl = closedPositions.reduce((sum, p) => sum + p.pnl, 0);
    const avgPnl = totalTrades > 0
      ? (totalPnl / totalTrades).toFixed(2)
      : 0;

    const avgWin = winningTrades > 0
      ? (closedPositions.filter(p => p.pnl > 0).reduce((sum, p) => sum + p.pnl, 0) / winningTrades).toFixed(2)
      : 0;

    const avgLoss = losingTrades > 0
      ? (closedPositions.filter(p => p.pnl < 0).reduce((sum, p) => sum + p.pnl, 0) / losingTrades).toFixed(2)
      : 0;

    const stats = {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: parseFloat(winRate),
      totalPnl: totalPnl.toFixed(2),
      avgPnl: parseFloat(avgPnl),
      avgWin: parseFloat(avgWin),
      avgLoss: parseFloat(avgLoss),
      profitFactor: losingTrades > 0 && avgLoss !== 0
        ? (Math.abs(parseFloat(avgWin) / parseFloat(avgLoss))).toFixed(2)
        : 0,
      totalExecutions: executions.length,
      openPositions: executions.length - (closedPositions.length * 2) // Rough estimate
    };

    res.json({ success: true, stats });

  } catch (error) {
    console.error('Error calculating subscription stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate stats'
    });
  }
});

/**
 * GET /api/stats/strategy/:id
 * Get performance stats for a specific strategy (across all subscriptions)
 */
router.get('/strategy/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get strategy
    const strategy = await prisma.strategy.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: {
              where: { status: 'ACTIVE' }
            },
            signals: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      }
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    // Get all executions for this strategy's subscriptions
    const executions = await prisma.executionLog.findMany({
      where: {
        subscription: {
          strategyId: id
        },
        status: 'SUCCESS'
      },
      orderBy: { executedAt: 'asc' }
    });

    // Calculate closed positions
    const closedPositions = calculateClosedPositions(executions);

    // Calculate statistics
    const totalTrades = closedPositions.length;
    const winningTrades = closedPositions.filter(p => p.pnl > 0).length;
    const winRate = totalTrades > 0
      ? (winningTrades / totalTrades * 100).toFixed(2)
      : 0;

    const totalPnl = closedPositions.reduce((sum, p) => sum + p.pnl, 0);

    // Get total signals count
    const totalSignals = await prisma.signal.count({
      where: { strategyId: id }
    });

    const performance = {
      totalSubscribers: strategy._count.subscriptions,
      activeSignals: strategy._count.signals,
      totalSignals,
      totalTrades,
      winningTrades,
      losingTrades: totalTrades - winningTrades,
      winRate: parseFloat(winRate),
      totalPnl: totalPnl.toFixed(2),
      avgPnl: totalTrades > 0 ? (totalPnl / totalTrades).toFixed(2) : 0
    };

    res.json({ success: true, performance });

  } catch (error) {
    console.error('Error calculating strategy performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate performance'
    });
  }
});

/**
 * GET /api/stats/user
 * Get overall stats for the authenticated user
 */
router.get('/user', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all user's subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      select: { id: true }
    });

    const subscriptionIds = subscriptions.map(s => s.id);

    // Get all executions
    const executions = await prisma.executionLog.findMany({
      where: {
        subscriptionId: { in: subscriptionIds },
        status: 'SUCCESS'
      },
      orderBy: { executedAt: 'asc' }
    });

    // Calculate closed positions
    const closedPositions = calculateClosedPositions(executions);

    // Calculate statistics
    const totalTrades = closedPositions.length;
    const winningTrades = closedPositions.filter(p => p.pnl > 0).length;
    const winRate = totalTrades > 0
      ? (winningTrades / totalTrades * 100).toFixed(2)
      : 0;

    const totalPnl = closedPositions.reduce((sum, p) => sum + p.pnl, 0);

    const stats = {
      totalSubscriptions: subscriptions.length,
      totalTrades,
      winningTrades,
      losingTrades: totalTrades - winningTrades,
      winRate: parseFloat(winRate),
      totalPnl: totalPnl.toFixed(2),
      avgPnl: totalTrades > 0 ? (totalPnl / totalTrades).toFixed(2) : 0,
      totalExecutions: executions.length
    };

    res.json({ success: true, stats });

  } catch (error) {
    console.error('Error calculating user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate stats'
    });
  }
});

module.exports = router;
