const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Calculate closed positions from execution logs
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
          entryPrice: entry.entryPrice,
          exitPrice: exec.price,
          amount: entry.amount,
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
 * GET /api/charts/strategy/:id/equity-curve
 * Get equity curve data for a strategy
 */
router.get('/strategy/:id/equity-curve', async (req, res) => {
  try {
    const { id } = req.params;

    // Get strategy
    const strategy = await prisma.strategy.findUnique({
      where: { id }
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

    // Build equity curve data points
    let cumulativePnl = 0;
    const equityCurve = closedPositions.map((position, index) => {
      cumulativePnl += position.pnl;
      return {
        tradeNumber: index + 1,
        date: position.exitTime.toISOString(),
        pnl: parseFloat(position.pnl.toFixed(2)),
        cumulativePnl: parseFloat(cumulativePnl.toFixed(2)),
        symbol: position.symbol
      };
    });

    // Add initial point at 0
    if (equityCurve.length > 0) {
      equityCurve.unshift({
        tradeNumber: 0,
        date: closedPositions[0].entryTime.toISOString(),
        pnl: 0,
        cumulativePnl: 0,
        symbol: null
      });
    }

    res.json({
      success: true,
      data: equityCurve,
      metadata: {
        totalTrades: closedPositions.length,
        finalPnl: cumulativePnl.toFixed(2),
        maxEquity: equityCurve.length > 0
          ? Math.max(...equityCurve.map(p => p.cumulativePnl)).toFixed(2)
          : 0,
        minEquity: equityCurve.length > 0
          ? Math.min(...equityCurve.map(p => p.cumulativePnl)).toFixed(2)
          : 0
      }
    });

  } catch (error) {
    console.error('Error generating equity curve:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate equity curve',
      error: error.message
    });
  }
});

/**
 * GET /api/charts/strategy/:id/monthly-returns
 * Get monthly returns breakdown for a strategy
 */
router.get('/strategy/:id/monthly-returns', async (req, res) => {
  try {
    const { id } = req.params;

    // Get strategy
    const strategy = await prisma.strategy.findUnique({
      where: { id }
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

    // Group by month
    const monthlyData = new Map();

    closedPositions.forEach(position => {
      const date = new Date(position.exitTime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          month: monthKey,
          trades: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalPnl: 0,
          avgPnl: 0,
          winRate: 0
        });
      }

      const data = monthlyData.get(monthKey);
      data.trades++;
      data.totalPnl += position.pnl;

      if (position.pnl > 0) {
        data.winningTrades++;
      } else if (position.pnl < 0) {
        data.losingTrades++;
      }
    });

    // Calculate averages and win rates
    const monthlyReturns = Array.from(monthlyData.values()).map(data => {
      data.avgPnl = data.trades > 0 ? data.totalPnl / data.trades : 0;
      data.winRate = data.trades > 0 ? (data.winningTrades / data.trades * 100) : 0;

      return {
        month: data.month,
        trades: data.trades,
        winningTrades: data.winningTrades,
        losingTrades: data.losingTrades,
        totalPnl: parseFloat(data.totalPnl.toFixed(2)),
        avgPnl: parseFloat(data.avgPnl.toFixed(2)),
        winRate: parseFloat(data.winRate.toFixed(2))
      };
    });

    // Sort by month
    monthlyReturns.sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      success: true,
      data: monthlyReturns,
      metadata: {
        totalMonths: monthlyReturns.length,
        profitableMonths: monthlyReturns.filter(m => m.totalPnl > 0).length,
        bestMonth: monthlyReturns.length > 0
          ? monthlyReturns.reduce((best, current) =>
              current.totalPnl > best.totalPnl ? current : best
            )
          : null,
        worstMonth: monthlyReturns.length > 0
          ? monthlyReturns.reduce((worst, current) =>
              current.totalPnl < worst.totalPnl ? current : worst
            )
          : null
      }
    });

  } catch (error) {
    console.error('Error generating monthly returns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate monthly returns',
      error: error.message
    });
  }
});

/**
 * GET /api/charts/strategy/:id/trade-distribution
 * Get win/loss distribution data
 */
router.get('/strategy/:id/trade-distribution', async (req, res) => {
  try {
    const { id } = req.params;

    // Get strategy
    const strategy = await prisma.strategy.findUnique({
      where: { id }
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

    // Categorize positions by P/L ranges
    const ranges = [
      { label: 'Large Loss', min: -Infinity, max: -50, count: 0, totalPnl: 0 },
      { label: 'Medium Loss', min: -50, max: -20, count: 0, totalPnl: 0 },
      { label: 'Small Loss', min: -20, max: 0, count: 0, totalPnl: 0 },
      { label: 'Small Win', min: 0, max: 20, count: 0, totalPnl: 0 },
      { label: 'Medium Win', min: 20, max: 50, count: 0, totalPnl: 0 },
      { label: 'Large Win', min: 50, max: Infinity, count: 0, totalPnl: 0 },
    ];

    closedPositions.forEach(position => {
      const pnl = position.pnl;
      const range = ranges.find(r => pnl > r.min && pnl <= r.max);
      if (range) {
        range.count++;
        range.totalPnl += pnl;
      }
    });

    const distribution = ranges.map(range => ({
      label: range.label,
      count: range.count,
      totalPnl: parseFloat(range.totalPnl.toFixed(2)),
      avgPnl: range.count > 0 ? parseFloat((range.totalPnl / range.count).toFixed(2)) : 0
    }));

    res.json({
      success: true,
      data: distribution,
      metadata: {
        totalTrades: closedPositions.length,
        winningTrades: closedPositions.filter(p => p.pnl > 0).length,
        losingTrades: closedPositions.filter(p => p.pnl < 0).length,
        breakEvenTrades: closedPositions.filter(p => p.pnl === 0).length
      }
    });

  } catch (error) {
    console.error('Error generating trade distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate trade distribution',
      error: error.message
    });
  }
});

module.exports = router;
