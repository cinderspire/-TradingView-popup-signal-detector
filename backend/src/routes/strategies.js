const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * @route   GET /api/strategies
 * @desc    Get all strategies (public + user's private)
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { type, isPublic, limit = 50, offset = 0 } = req.query;

        const where = {
            OR: [
                { isPublic: true },
                { userId: req.user.id }
            ]
        };

        if (type) where.type = type;
        if (isPublic !== undefined) {
            delete where.OR;
            where.isPublic = isPublic === 'true';
            if (!where.isPublic) {
                where.userId = req.user.id;
            }
        }

        const [strategies, total] = await Promise.all([
            prisma.strategy.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true
                        }
                    },
                    _count: {
                        select: {
                            signals: true,
                            backtests: true,
                            positions: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.strategy.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                strategies,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: total > parseInt(offset) + parseInt(limit)
                }
            }
        });
    } catch (error) {
        logger.error('Get strategies error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch strategies',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/strategies/my
 * @desc    Get user's strategies only
 * @access  Private
 */
router.get('/my', authenticate, async (req, res) => {
    try {
        const strategies = await prisma.strategy.findMany({
            where: {
                userId: req.user.id
            },
            include: {
                _count: {
                    select: {
                        signals: true,
                        backtests: true,
                        positions: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            data: strategies
        });
    } catch (error) {
        logger.error('Get my strategies error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your strategies',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/strategies/:id
 * @desc    Get specific strategy details
 * @access  Private
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: {
                id: req.params.id,
                OR: [
                    { isPublic: true },
                    { userId: req.user.id }
                ]
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                _count: {
                    select: {
                        signals: true,
                        backtests: true,
                        positions: true
                    }
                }
            }
        });

        if (!strategy) {
            return res.status(404).json({
                success: false,
                message: 'Strategy not found or access denied'
            });
        }

        // Get recent performance if user owns the strategy
        let performance = null;
        if (strategy.userId === req.user.id) {
            const recentBacktests = await prisma.backtest.findMany({
                where: {
                    strategyId: strategy.id,
                    userId: req.user.id
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    roi: true,
                    winRate: true,
                    sharpeRatio: true,
                    maxDrawdown: true
                }
            });

            if (recentBacktests.length > 0) {
                performance = {
                    avgROI: (recentBacktests.reduce((sum, bt) => sum + bt.roi, 0) / recentBacktests.length).toFixed(2),
                    avgWinRate: (recentBacktests.reduce((sum, bt) => sum + bt.winRate, 0) / recentBacktests.length).toFixed(2),
                    avgSharpe: (recentBacktests.reduce((sum, bt) => sum + bt.sharpeRatio, 0) / recentBacktests.length).toFixed(2),
                    backtestCount: recentBacktests.length
                };
            }
        }

        res.json({
            success: true,
            data: {
                ...strategy,
                performance
            }
        });
    } catch (error) {
        logger.error('Get strategy error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch strategy',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/strategies
 * @desc    Create a new strategy
 * @access  Private
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const {
            name,
            description,
            type,
            parameters,
            isPublic = false,
            targetPairs,
            timeframes
        } = req.body;

        // Validation
        if (!name || name.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Strategy name must be at least 3 characters'
            });
        }

        if (!type || !['TECHNICAL', 'FUNDAMENTAL', 'HYBRID', 'CUSTOM'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid strategy type'
            });
        }

        // Check if strategy name already exists for user
        const existing = await prisma.strategy.findFirst({
            where: {
                userId: req.user.id,
                name: name.trim()
            }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'You already have a strategy with this name'
            });
        }

        const strategy = await prisma.strategy.create({
            data: {
                userId: req.user.id,
                name: name.trim(),
                description: description?.trim() || '',
                type,
                parameters: parameters || {},
                isPublic,
                targetPairs: targetPairs || [],
                timeframes: timeframes || ['1h'],
                isActive: true
            }
        });

        logger.info(`Strategy created: ${strategy.id} by user ${req.user.id}`);

        res.status(201).json({
            success: true,
            message: 'Strategy created successfully',
            data: strategy
        });
    } catch (error) {
        logger.error('Create strategy error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create strategy',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/strategies/:id
 * @desc    Update a strategy
 * @access  Private
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!strategy) {
            return res.status(404).json({
                success: false,
                message: 'Strategy not found or access denied'
            });
        }

        const {
            name,
            description,
            parameters,
            isPublic,
            isActive,
            targetPairs,
            timeframes
        } = req.body;

        const updateData = {};
        if (name !== undefined) {
            if (name.trim().length < 3) {
                return res.status(400).json({
                    success: false,
                    message: 'Strategy name must be at least 3 characters'
                });
            }
            updateData.name = name.trim();
        }
        if (description !== undefined) updateData.description = description.trim();
        if (parameters !== undefined) updateData.parameters = parameters;
        if (isPublic !== undefined) updateData.isPublic = isPublic;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (targetPairs !== undefined) updateData.targetPairs = targetPairs;
        if (timeframes !== undefined) updateData.timeframes = timeframes;
        updateData.updatedAt = new Date();

        const updated = await prisma.strategy.update({
            where: { id: req.params.id },
            data: updateData
        });

        logger.info(`Strategy updated: ${updated.id}`);

        res.json({
            success: true,
            message: 'Strategy updated successfully',
            data: updated
        });
    } catch (error) {
        logger.error('Update strategy error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update strategy',
            error: error.message
        });
    }
});

/**
 * @route   DELETE /api/strategies/:id
 * @desc    Delete a strategy
 * @access  Private
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!strategy) {
            return res.status(404).json({
                success: false,
                message: 'Strategy not found or access denied'
            });
        }

        // Check if strategy has active positions or signals
        const [activePositions, activeSignals] = await Promise.all([
            prisma.position.count({
                where: {
                    strategyId: req.params.id,
                    status: 'OPEN'
                }
            }),
            prisma.signal.count({
                where: {
                    strategyId: req.params.id,
                    status: 'ACTIVE'
                }
            })
        ]);

        if (activePositions > 0 || activeSignals > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete strategy with ${activePositions} active positions and ${activeSignals} active signals. Close them first.`
            });
        }

        await prisma.strategy.delete({
            where: { id: req.params.id }
        });

        logger.info(`Strategy deleted: ${req.params.id}`);

        res.json({
            success: true,
            message: 'Strategy deleted successfully'
        });
    } catch (error) {
        logger.error('Delete strategy error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete strategy',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/strategies/:id/clone
 * @desc    Clone a public strategy
 * @access  Private
 */
router.post('/:id/clone', authenticate, async (req, res) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: {
                id: req.params.id,
                isPublic: true
            }
        });

        if (!strategy) {
            return res.status(404).json({
                success: false,
                message: 'Strategy not found or not public'
            });
        }

        // Create cloned strategy
        const clonedName = `${strategy.name} (Copy)`;
        const cloned = await prisma.strategy.create({
            data: {
                userId: req.user.id,
                name: clonedName,
                description: strategy.description,
                type: strategy.type,
                parameters: strategy.parameters,
                isPublic: false,
                targetPairs: strategy.targetPairs,
                timeframes: strategy.timeframes,
                isActive: true
            }
        });

        logger.info(`Strategy cloned: ${strategy.id} -> ${cloned.id} by user ${req.user.id}`);

        res.status(201).json({
            success: true,
            message: 'Strategy cloned successfully',
            data: cloned
        });
    } catch (error) {
        logger.error('Clone strategy error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clone strategy',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/strategies/:id/performance
 * @desc    Get detailed performance metrics for a strategy
 * @access  Private
 */
router.get('/:id/performance', authenticate, async (req, res) => {
    try {
        const strategy = await prisma.strategy.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!strategy) {
            return res.status(404).json({
                success: false,
                message: 'Strategy not found or access denied'
            });
        }

        const { period = '30d' } = req.query;
        const days = parseInt(period.replace('d', ''));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get all backtests
        const backtests = await prisma.backtest.findMany({
            where: {
                strategyId: req.params.id,
                userId: req.user.id,
                createdAt: { gte: startDate }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Get all positions
        const positions = await prisma.position.findMany({
            where: {
                strategyId: req.params.id,
                userId: req.user.id,
                openedAt: { gte: startDate }
            }
        });

        // Calculate metrics
        const totalBacktests = backtests.length;
        const avgROI = totalBacktests > 0
            ? backtests.reduce((sum, bt) => sum + bt.roi, 0) / totalBacktests
            : 0;
        const avgWinRate = totalBacktests > 0
            ? backtests.reduce((sum, bt) => sum + bt.winRate, 0) / totalBacktests
            : 0;

        const closedPositions = positions.filter(p => p.status === 'CLOSED');
        const openPositions = positions.filter(p => p.status === 'OPEN');
        const totalPnL = closedPositions.reduce((sum, p) => sum + (p.realizedPnL || 0), 0);

        res.json({
            success: true,
            data: {
                strategyId: req.params.id,
                period: `${days} days`,
                backtests: {
                    total: totalBacktests,
                    avgROI: avgROI.toFixed(2),
                    avgWinRate: avgWinRate.toFixed(2),
                    best: backtests.length > 0 ? Math.max(...backtests.map(bt => bt.roi)) : 0,
                    worst: backtests.length > 0 ? Math.min(...backtests.map(bt => bt.roi)) : 0
                },
                positions: {
                    total: positions.length,
                    open: openPositions.length,
                    closed: closedPositions.length,
                    totalPnL: totalPnL.toFixed(2),
                    avgPnL: closedPositions.length > 0 ? (totalPnL / closedPositions.length).toFixed(2) : 0
                }
            }
        });
    } catch (error) {
        logger.error('Get strategy performance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch strategy performance',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/strategies/stats/summary
 * @desc    Get strategy statistics summary
 * @access  Private
 */
router.get('/stats/summary', authenticate, async (req, res) => {
    try {
        const [totalStrategies, publicStrategies, activeStrategies] = await Promise.all([
            prisma.strategy.count({
                where: { userId: req.user.id }
            }),
            prisma.strategy.count({
                where: {
                    userId: req.user.id,
                    isPublic: true
                }
            }),
            prisma.strategy.count({
                where: {
                    userId: req.user.id,
                    isActive: true
                }
            })
        ]);

        // Get best performing strategy
        const backtestsByStrategy = await prisma.backtest.groupBy({
            by: ['strategyId'],
            where: {
                userId: req.user.id
            },
            _avg: {
                roi: true,
                winRate: true
            },
            _count: true
        });

        const bestStrategy = backtestsByStrategy.length > 0
            ? backtestsByStrategy.reduce((max, s) => s._avg.roi > max._avg.roi ? s : max)
            : null;

        let bestStrategyDetails = null;
        if (bestStrategy) {
            bestStrategyDetails = await prisma.strategy.findUnique({
                where: { id: bestStrategy.strategyId },
                select: {
                    id: true,
                    name: true,
                    type: true
                }
            });
        }

        res.json({
            success: true,
            data: {
                totalStrategies,
                publicStrategies,
                activeStrategies,
                inactiveStrategies: totalStrategies - activeStrategies,
                bestPerforming: bestStrategyDetails ? {
                    ...bestStrategyDetails,
                    avgROI: bestStrategy._avg.roi.toFixed(2),
                    avgWinRate: bestStrategy._avg.winRate.toFixed(2),
                    backtestCount: bestStrategy._count
                } : null
            }
        });
    } catch (error) {
        logger.error('Get strategy stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch strategy statistics',
            error: error.message
        });
    }
});

module.exports = router;
