/**
 * Backtest API Routes
 * Run and retrieve strategy backtests
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @route   POST /api/backtest/run
 * @desc    Run a new backtest
 * @access  Private
 */
router.post('/run', async (req, res) => {
  try {
    const {
      strategyId,
      pair,
      exchange = 'binance',
      timeframe = '1h',
      startDate,
      endDate,
      initialCapital = 10000
    } = req.body;

    // Validate inputs
    if (!strategyId || !pair || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Create backtest record
    const backtest = await prisma.backtest.create({
      data: {
        strategyId,
        pair,
        exchange,
        timeframe,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'PENDING',
      }
    });

    // TODO: Queue backtest job (use Bull queue in production)
    // For now, return pending status

    res.json({
      success: true,
      message: 'Backtest queued',
      data: {
        backtestId: backtest.id,
        status: 'PENDING',
        estimatedTime: '2-5 minutes'
      }
    });

  } catch (error) {
    console.error('❌ Backtest error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start backtest'
    });
  }
});

/**
 * @route   GET /api/backtest/:id
 * @desc    Get backtest results
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const backtest = await prisma.backtest.findUnique({
      where: { id },
      include: {
        strategy: {
          select: {
            name: true,
            type: true
          }
        }
      }
    });

    if (!backtest) {
      return res.status(404).json({
        success: false,
        error: 'Backtest not found'
      });
    }

    res.json({
      success: true,
      data: backtest
    });

  } catch (error) {
    console.error('❌ Get backtest error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve backtest'
    });
  }
});

/**
 * @route   GET /api/backtest/strategy/:strategyId
 * @desc    Get all backtests for a strategy
 * @access  Private
 */
router.get('/strategy/:strategyId', async (req, res) => {
  try {
    const { strategyId } = req.params;

    const backtests = await prisma.backtest.findMany({
      where: { strategyId },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    });

    res.json({
      success: true,
      data: backtests
    });

  } catch (error) {
    console.error('❌ Get strategy backtests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve backtests'
    });
  }
});

module.exports = router;
