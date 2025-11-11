const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * @route   GET /api/backtests
 * @desc    Get all backtests for authenticated user
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { strategyId, pair, status, limit = 20, offset = 0 } = req.query;

        const where = {
            userId: req.user.id
        };

        if (strategyId) where.strategyId = strategyId;
        if (pair) where.pair = pair;
        if (status) where.status = status;

        const [backtests, total] = await Promise.all([
            prisma.backtest.findMany({
                where,
                include: {
                    strategy: {
                        select: {
                            id: true,
                            name: true,
                            type: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.backtest.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                backtests,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: total > parseInt(offset) + parseInt(limit)
                }
            }
        });
    } catch (error) {
        logger.error('Get backtests error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch backtests',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/backtests/:id
 * @desc    Get specific backtest details
 * @access  Private
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const backtest = await prisma.backtest.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: {
                strategy: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        type: true,
                        parameters: true
                    }
                }
            }
        });

        if (!backtest) {
            return res.status(404).json({
                success: false,
                message: 'Backtest not found'
            });
        }

        res.json({
            success: true,
            data: backtest
        });
    } catch (error) {
        logger.error('Get backtest error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch backtest',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/backtests/:id/trades
 * @desc    Get trades for a specific backtest
 * @access  Private
 */
router.get('/:id/trades', authenticate, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        // Verify backtest ownership
        const backtest = await prisma.backtest.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!backtest) {
            return res.status(404).json({
                success: false,
                message: 'Backtest not found'
            });
        }

        const trades = await prisma.trade.findMany({
            where: {
                backtestId: req.params.id
            },
            orderBy: { executedAt: 'asc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });

        res.json({
            success: true,
            data: {
                trades,
                backtestId: req.params.id
            }
        });
    } catch (error) {
        logger.error('Get backtest trades error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch backtest trades',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/backtests/:id/equity-curve
 * @desc    Get equity curve data for a backtest
 * @access  Private
 */
router.get('/:id/equity-curve', authenticate, async (req, res) => {
    try {
        // Verify backtest ownership
        const backtest = await prisma.backtest.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!backtest) {
            return res.status(404).json({
                success: false,
                message: 'Backtest not found'
            });
        }

        // Get all trades ordered by execution time
        const trades = await prisma.trade.findMany({
            where: {
                backtestId: req.params.id
            },
            orderBy: { executedAt: 'asc' },
            select: {
                executedAt: true,
                pnl: true,
                side: true,
                pair: true
            }
        });

        // Calculate equity curve
        let equity = backtest.initialCapital || 10000;
        const equityCurve = [{
            timestamp: backtest.createdAt,
            equity,
            pnl: 0
        }];

        trades.forEach(trade => {
            if (trade.pnl) {
                equity += trade.pnl;
                equityCurve.push({
                    timestamp: trade.executedAt,
                    equity,
                    pnl: trade.pnl
                });
            }
        });

        res.json({
            success: true,
            data: {
                backtestId: req.params.id,
                initialCapital: backtest.initialCapital || 10000,
                finalEquity: equity,
                totalReturn: equity - (backtest.initialCapital || 10000),
                returnPercentage: ((equity / (backtest.initialCapital || 10000) - 1) * 100).toFixed(2),
                equityCurve
            }
        });
    } catch (error) {
        logger.error('Get equity curve error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch equity curve',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/backtests/compare
 * @desc    Compare multiple backtests
 * @access  Private
 */
router.post('/compare', authenticate, async (req, res) => {
    try {
        const { backtestIds } = req.body;

        if (!Array.isArray(backtestIds) || backtestIds.length < 2 || backtestIds.length > 5) {
            return res.status(400).json({
                success: false,
                message: 'Please provide 2-5 backtest IDs to compare'
            });
        }

        const backtests = await prisma.backtest.findMany({
            where: {
                id: { in: backtestIds },
                userId: req.user.id
            },
            include: {
                strategy: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (backtests.length !== backtestIds.length) {
            return res.status(404).json({
                success: false,
                message: 'Some backtests not found or unauthorized'
            });
        }

        const comparison = backtests.map(bt => ({
            id: bt.id,
            strategyName: bt.strategy.name,
            pair: bt.pair,
            timeframe: bt.timeframe,
            dateRange: {
                start: bt.startDate,
                end: bt.endDate
            },
            performance: {
                totalTrades: bt.totalTrades,
                winningTrades: bt.winningTrades,
                losingTrades: bt.losingTrades,
                winRate: bt.winRate,
                profitFactor: bt.profitFactor,
                sharpeRatio: bt.sharpeRatio,
                maxDrawdown: bt.maxDrawdown,
                totalReturn: bt.totalReturn,
                roi: bt.roi
            }
        }));

        res.json({
            success: true,
            data: {
                comparison,
                best: {
                    roi: comparison.reduce((max, bt) => bt.performance.roi > max.performance.roi ? bt : max),
                    winRate: comparison.reduce((max, bt) => bt.performance.winRate > max.performance.winRate ? bt : max),
                    sharpeRatio: comparison.reduce((max, bt) => bt.performance.sharpeRatio > max.performance.sharpeRatio ? bt : max)
                }
            }
        });
    } catch (error) {
        logger.error('Compare backtests error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to compare backtests',
            error: error.message
        });
    }
});

/**
 * @route   DELETE /api/backtests/:id
 * @desc    Delete a backtest
 * @access  Private
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const backtest = await prisma.backtest.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!backtest) {
            return res.status(404).json({
                success: false,
                message: 'Backtest not found'
            });
        }

        // Delete associated trades first
        await prisma.trade.deleteMany({
            where: { backtestId: req.params.id }
        });

        // Delete backtest
        await prisma.backtest.delete({
            where: { id: req.params.id }
        });

        res.json({
            success: true,
            message: 'Backtest deleted successfully'
        });
    } catch (error) {
        logger.error('Delete backtest error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete backtest',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/backtests/stats/summary
 * @desc    Get backtest statistics summary
 * @access  Private
 */
router.get('/stats/summary', authenticate, async (req, res) => {
    try {
        const [totalBacktests, avgWinRate, avgRoi, bestBacktest] = await Promise.all([
            prisma.backtest.count({
                where: { userId: req.user.id }
            }),
            prisma.backtest.aggregate({
                where: { userId: req.user.id },
                _avg: { winRate: true }
            }),
            prisma.backtest.aggregate({
                where: { userId: req.user.id },
                _avg: { roi: true }
            }),
            prisma.backtest.findFirst({
                where: { userId: req.user.id },
                orderBy: { roi: 'desc' },
                include: {
                    strategy: {
                        select: { name: true }
                    }
                }
            })
        ]);

        res.json({
            success: true,
            data: {
                totalBacktests,
                averageWinRate: avgWinRate._avg.winRate || 0,
                averageROI: avgRoi._avg.roi || 0,
                bestPerforming: bestBacktest ? {
                    id: bestBacktest.id,
                    strategy: bestBacktest.strategy.name,
                    roi: bestBacktest.roi,
                    winRate: bestBacktest.winRate,
                    pair: bestBacktest.pair
                } : null
            }
        });
    } catch (error) {
        logger.error('Get backtest stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch backtest statistics',
            error: error.message
        });
    }
});

module.exports = router;
