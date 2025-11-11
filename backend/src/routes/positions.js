const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const { getWebSocketServer } = require('../websocket');

const prisma = new PrismaClient();

/**
 * @route   GET /api/positions
 * @desc    Get all positions for authenticated user
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { status = 'OPEN', pair, strategyId, subscriptionId, limit = 50, offset = 0 } = req.query;

        const where = {
            userId: req.user.id
        };

        // If subscriptionId is provided, get the strategyId from the subscription
        if (subscriptionId) {
            const subscription = await prisma.subscription.findFirst({
                where: {
                    id: subscriptionId,
                    userId: req.user.id
                },
                select: { strategyId: true }
            });

            if (subscription) {
                where.strategyId = subscription.strategyId;
            }
        } else if (strategyId) {
            where.strategyId = strategyId;
        }

        if (status) where.status = status;
        if (pair) where.pair = pair;

        const [positions, total] = await Promise.all([
            prisma.position.findMany({
                where,
                include: {
                    strategy: {
                        select: {
                            id: true,
                            name: true,
                            type: true
                        }
                    },
                    signal: {
                        select: {
                            id: true,
                            confidence: true,
                            risk: true
                        }
                    }
                },
                orderBy: { openedAt: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.position.count({ where })
        ]);

        // Calculate real-time PnL for open positions
        const positionsWithPnL = positions.map(position => {
            if (position.status === 'OPEN' && position.currentPrice) {
                const priceDiff = position.side === 'LONG'
                    ? position.currentPrice - position.entryPrice
                    : position.entryPrice - position.currentPrice;
                const unrealizedPnL = priceDiff * position.quantity;
                return {
                    ...position,
                    unrealizedPnL,
                    unrealizedPnLPercent: (priceDiff / position.entryPrice) * 100
                };
            }
            return position;
        });

        res.json({
            success: true,
            data: {
                positions: positionsWithPnL,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: total > parseInt(offset) + parseInt(limit)
                }
            }
        });
    } catch (error) {
        logger.error('Get positions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch positions',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/positions/my
 * @desc    Get user's positions with comprehensive stats
 * @access  Private
 */
router.get('/my', authenticate, async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;

        // Build filter
        const where = {
            userId: req.user.id
        };

        if (status) where.status = status;

        // Get all positions (for stats calculation)
        const [allPositions, openPositions, closedPositions] = await Promise.all([
            prisma.position.findMany({
                where,
                include: {
                    strategy: {
                        select: {
                            id: true,
                            name: true,
                            type: true
                        }
                    },
                    signal: {
                        select: {
                            id: true,
                            confidenceLevel: true
                        }
                    }
                },
                orderBy: { openedAt: 'desc' },
                take: parseInt(limit)
            }),
            prisma.position.findMany({
                where: {
                    userId: req.user.id,
                    status: 'OPEN'
                }
            }),
            prisma.position.findMany({
                where: {
                    userId: req.user.id,
                    status: 'CLOSED'
                }
            })
        ]);

        // Calculate positions with PnL
        const positionsWithPnL = allPositions.map(position => {
            if (position.status === 'OPEN' && position.currentPrice) {
                const priceDiff = position.side === 'LONG'
                    ? position.currentPrice - position.entryPrice
                    : position.entryPrice - position.currentPrice;
                const unrealizedPnL = priceDiff * (position.size || position.quantity || 1);
                return {
                    ...position,
                    unrealizedPnL,
                    unrealizedPnLPercent: (priceDiff / position.entryPrice) * 100
                };
            }
            return position;
        });

        // Calculate comprehensive stats
        const totalUnrealizedPnL = openPositions.reduce((sum, p) => {
            if (p.currentPrice) {
                const priceDiff = p.side === 'LONG'
                    ? p.currentPrice - p.entryPrice
                    : p.entryPrice - p.currentPrice;
                return sum + (priceDiff * (p.size || p.quantity || 1));
            }
            return sum;
        }, 0);

        const totalRealizedPnL = closedPositions.reduce((sum, p) => sum + (p.realizedPnL || 0), 0);
        const winningTrades = closedPositions.filter(p => (p.realizedPnL || 0) > 0);
        const losingTrades = closedPositions.filter(p => (p.realizedPnL || 0) < 0);

        const totalWinAmount = winningTrades.reduce((sum, p) => sum + (p.realizedPnL || 0), 0);
        const totalLossAmount = Math.abs(losingTrades.reduce((sum, p) => sum + (p.realizedPnL || 0), 0));

        const winRate = closedPositions.length > 0
            ? (winningTrades.length / closedPositions.length) * 100
            : 0;

        const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0;

        const largestWin = winningTrades.length > 0
            ? Math.max(...winningTrades.map(p => p.realizedPnL || 0))
            : 0;

        const largestLoss = losingTrades.length > 0
            ? Math.min(...losingTrades.map(p => p.realizedPnL || 0))
            : 0;

        const stats = {
            totalOpen: openPositions.length,
            totalClosed: closedPositions.length,
            totalPositions: openPositions.length + closedPositions.length,
            totalRealizedPnL,
            totalUnrealizedPnL,
            totalPnL: totalRealizedPnL + totalUnrealizedPnL,
            winRate,
            profitFactor,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            largestWin,
            largestLoss,
            averageWin: winningTrades.length > 0 ? totalWinAmount / winningTrades.length : 0,
            averageLoss: losingTrades.length > 0 ? totalLossAmount / losingTrades.length : 0
        };

        res.json({
            success: true,
            message: 'User positions retrieved successfully',
            data: {
                positions: positionsWithPnL,
                stats
            }
        });
    } catch (error) {
        logger.error('Get user positions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user positions',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/positions/active
 * @desc    Get all active (open) positions
 * @access  Private
 */
router.get('/active', authenticate, async (req, res) => {
    try {
        const positions = await prisma.position.findMany({
            where: {
                userId: req.user.id,
                status: 'OPEN'
            },
            include: {
                strategy: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: { openedAt: 'desc' }
        });

        // Calculate unrealized PnL for each position
        const positionsWithPnL = positions.map(position => {
            if (position.currentPrice) {
                const priceDiff = position.side === 'LONG'
                    ? position.currentPrice - position.entryPrice
                    : position.entryPrice - position.currentPrice;
                const unrealizedPnL = priceDiff * position.quantity;
                const unrealizedPnLPercent = (priceDiff / position.entryPrice) * 100;

                return {
                    ...position,
                    unrealizedPnL,
                    unrealizedPnLPercent,
                    distanceToStopLoss: position.stopLoss ? ((position.currentPrice - position.stopLoss) / position.currentPrice * 100) : null,
                    distanceToTakeProfit: position.takeProfit ? ((position.takeProfit - position.currentPrice) / position.currentPrice * 100) : null
                };
            }
            return position;
        });

        // Calculate portfolio summary
        const totalUnrealizedPnL = positionsWithPnL.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0);
        const totalValue = positionsWithPnL.reduce((sum, p) => sum + (p.entryPrice * p.quantity), 0);

        res.json({
            success: true,
            data: {
                positions: positionsWithPnL,
                summary: {
                    totalPositions: positions.length,
                    totalValue,
                    totalUnrealizedPnL,
                    totalUnrealizedPnLPercent: totalValue > 0 ? (totalUnrealizedPnL / totalValue * 100) : 0
                }
            }
        });
    } catch (error) {
        logger.error('Get active positions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active positions',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/positions/:id
 * @desc    Get specific position details
 * @access  Private
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const position = await prisma.position.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: {
                strategy: true,
                signal: true,
                trades: {
                    orderBy: { executedAt: 'asc' }
                }
            }
        });

        if (!position) {
            return res.status(404).json({
                success: false,
                message: 'Position not found'
            });
        }

        // Calculate detailed metrics
        let detailedMetrics = {};
        if (position.status === 'OPEN' && position.currentPrice) {
            const priceDiff = position.side === 'LONG'
                ? position.currentPrice - position.entryPrice
                : position.entryPrice - position.currentPrice;
            detailedMetrics = {
                unrealizedPnL: priceDiff * position.quantity,
                unrealizedPnLPercent: (priceDiff / position.entryPrice) * 100,
                currentValue: position.currentPrice * position.quantity,
                initialValue: position.entryPrice * position.quantity,
                holdingTime: Math.floor((new Date() - position.openedAt) / 1000), // seconds
                distanceToStopLoss: position.stopLoss ? ((position.currentPrice - position.stopLoss) / position.currentPrice * 100) : null,
                distanceToTakeProfit: position.takeProfit ? ((position.takeProfit - position.currentPrice) / position.currentPrice * 100) : null
            };
        }

        res.json({
            success: true,
            data: {
                ...position,
                metrics: detailedMetrics
            }
        });
    } catch (error) {
        logger.error('Get position error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch position',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/positions/:id/stop-loss
 * @desc    Update stop loss for a position
 * @access  Private
 */
router.put('/:id/stop-loss', authenticate, async (req, res) => {
    try {
        const { stopLoss } = req.body;

        if (!stopLoss || isNaN(stopLoss) || stopLoss <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stop loss price'
            });
        }

        const position = await prisma.position.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id,
                status: 'OPEN'
            }
        });

        if (!position) {
            return res.status(404).json({
                success: false,
                message: 'Position not found or already closed'
            });
        }

        // Validate stop loss is on correct side
        if (position.side === 'LONG' && stopLoss >= position.currentPrice) {
            return res.status(400).json({
                success: false,
                message: 'Stop loss must be below current price for LONG positions'
            });
        }
        if (position.side === 'SHORT' && stopLoss <= position.currentPrice) {
            return res.status(400).json({
                success: false,
                message: 'Stop loss must be above current price for SHORT positions'
            });
        }

        const updated = await prisma.position.update({
            where: { id: req.params.id },
            data: {
                stopLoss,
                updatedAt: new Date()
            }
        });

        logger.info(`Stop loss updated for position ${req.params.id}: ${stopLoss}`);

        res.json({
            success: true,
            message: 'Stop loss updated successfully',
            data: updated
        });
    } catch (error) {
        logger.error('Update stop loss error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update stop loss',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/positions/:id/take-profit
 * @desc    Update take profit for a position
 * @access  Private
 */
router.put('/:id/take-profit', authenticate, async (req, res) => {
    try {
        const { takeProfit } = req.body;

        if (!takeProfit || isNaN(takeProfit) || takeProfit <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid take profit price'
            });
        }

        const position = await prisma.position.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id,
                status: 'OPEN'
            }
        });

        if (!position) {
            return res.status(404).json({
                success: false,
                message: 'Position not found or already closed'
            });
        }

        // Validate take profit is on correct side
        if (position.side === 'LONG' && takeProfit <= position.currentPrice) {
            return res.status(400).json({
                success: false,
                message: 'Take profit must be above current price for LONG positions'
            });
        }
        if (position.side === 'SHORT' && takeProfit >= position.currentPrice) {
            return res.status(400).json({
                success: false,
                message: 'Take profit must be below current price for SHORT positions'
            });
        }

        const updated = await prisma.position.update({
            where: { id: req.params.id },
            data: {
                takeProfit,
                updatedAt: new Date()
            }
        });

        logger.info(`Take profit updated for position ${req.params.id}: ${takeProfit}`);

        res.json({
            success: true,
            message: 'Take profit updated successfully',
            data: updated
        });
    } catch (error) {
        logger.error('Update take profit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update take profit',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/positions/:id
 * @desc    Update position (stop loss and/or take profit)
 * @access  Private
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { stopLoss, takeProfit } = req.body;

        if (!stopLoss && !takeProfit) {
            return res.status(400).json({
                success: false,
                message: 'At least one of stopLoss or takeProfit must be provided'
            });
        }

        const position = await prisma.position.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id,
                status: 'OPEN'
            }
        });

        if (!position) {
            return res.status(404).json({
                success: false,
                message: 'Position not found or already closed'
            });
        }

        // Build update data
        const updateData = { updatedAt: new Date() };

        // Validate and add stop loss if provided
        if (stopLoss !== undefined) {
            const parsedStopLoss = parseFloat(stopLoss);
            if (isNaN(parsedStopLoss) || parsedStopLoss <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid stop loss price'
                });
            }

            // Validate stop loss is on correct side
            if (position.side === 'LONG' && parsedStopLoss >= position.currentPrice) {
                return res.status(400).json({
                    success: false,
                    message: 'Stop loss must be below current price for LONG positions'
                });
            }
            if (position.side === 'SHORT' && parsedStopLoss <= position.currentPrice) {
                return res.status(400).json({
                    success: false,
                    message: 'Stop loss must be above current price for SHORT positions'
                });
            }

            updateData.stopLoss = parsedStopLoss;
        }

        // Validate and add take profit if provided
        if (takeProfit !== undefined) {
            const parsedTakeProfit = parseFloat(takeProfit);
            if (isNaN(parsedTakeProfit) || parsedTakeProfit <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid take profit price'
                });
            }

            // Validate take profit is on correct side
            if (position.side === 'LONG' && parsedTakeProfit <= position.currentPrice) {
                return res.status(400).json({
                    success: false,
                    message: 'Take profit must be above current price for LONG positions'
                });
            }
            if (position.side === 'SHORT' && parsedTakeProfit >= position.currentPrice) {
                return res.status(400).json({
                    success: false,
                    message: 'Take profit must be below current price for SHORT positions'
                });
            }

            updateData.takeProfit = parsedTakeProfit;
        }

        const updated = await prisma.position.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                strategy: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        logger.info(`Position ${req.params.id} updated - SL: ${stopLoss || 'unchanged'}, TP: ${takeProfit || 'unchanged'}`);

        // Broadcast via WebSocket to user
        const wsServer = getWebSocketServer();
        if (wsServer) {
            wsServer.broadcastPositionUpdate(updated);
        }

        res.json({
            success: true,
            message: 'Position updated successfully',
            data: { position: updated }
        });
    } catch (error) {
        logger.error('Update position error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update position',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/positions/:id/close
 * @desc    Manually close a position
 * @access  Private
 */
router.post('/:id/close', authenticate, async (req, res) => {
    try {
        const { exitPrice } = req.body;

        const position = await prisma.position.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id,
                status: 'OPEN'
            },
            include: {
                strategy: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!position) {
            return res.status(404).json({
                success: false,
                message: 'Position not found or already closed'
            });
        }

        // Use provided exit price or current price or entry price as fallback
        const finalExitPrice = exitPrice
            ? parseFloat(exitPrice)
            : (position.currentPrice || position.entryPrice);

        // Calculate final PnL
        const priceDiff = position.side === 'LONG'
            ? finalExitPrice - position.entryPrice
            : position.entryPrice - finalExitPrice;

        const positionSize = position.size || position.quantity || 1;
        const realizedPnL = priceDiff * positionSize;
        const pnlPercentage = (priceDiff / position.entryPrice) * 100;

        const updated = await prisma.position.update({
            where: { id: req.params.id },
            data: {
                status: 'CLOSED',
                exitPrice: finalExitPrice,
                closedAt: new Date(),
                realizedPnL,
                closeReason: 'MANUAL'
            },
            include: {
                strategy: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        logger.info(`Position ${req.params.id} closed manually. PnL: ${realizedPnL} (${pnlPercentage.toFixed(2)}%)`);

        // Broadcast via WebSocket to user
        const wsServer = getWebSocketServer();
        if (wsServer) {
            wsServer.broadcastPositionClosed(updated, realizedPnL, pnlPercentage);
        }

        res.json({
            success: true,
            message: 'Position closed successfully',
            data: {
                position: updated,
                realizedPnL,
                pnlPercentage
            }
        });
    } catch (error) {
        logger.error('Close position error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to close position',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/positions/stats/summary
 * @desc    Get position statistics summary
 * @access  Private
 */
router.get('/stats/summary', authenticate, async (req, res) => {
    try {
        const [openPositions, closedPositions, totalPnL] = await Promise.all([
            prisma.position.findMany({
                where: {
                    userId: req.user.id,
                    status: 'OPEN'
                }
            }),
            prisma.position.findMany({
                where: {
                    userId: req.user.id,
                    status: 'CLOSED'
                },
                orderBy: { closedAt: 'desc' },
                take: 100
            }),
            prisma.position.aggregate({
                where: {
                    userId: req.user.id,
                    status: 'CLOSED'
                },
                _sum: { realizedPnL: true }
            })
        ]);

        // Calculate open positions metrics
        const totalUnrealizedPnL = openPositions.reduce((sum, p) => {
            if (p.currentPrice) {
                const priceDiff = p.side === 'LONG'
                    ? p.currentPrice - p.entryPrice
                    : p.entryPrice - p.currentPrice;
                return sum + (priceDiff * p.quantity);
            }
            return sum;
        }, 0);

        // Calculate closed positions metrics
        const winningTrades = closedPositions.filter(p => p.realizedPnL > 0).length;
        const losingTrades = closedPositions.filter(p => p.realizedPnL <= 0).length;
        const winRate = closedPositions.length > 0
            ? (winningTrades / closedPositions.length * 100).toFixed(2)
            : 0;

        res.json({
            success: true,
            data: {
                open: {
                    count: openPositions.length,
                    totalUnrealizedPnL
                },
                closed: {
                    count: closedPositions.length,
                    totalRealizedPnL: totalPnL._sum.realizedPnL || 0,
                    winningTrades,
                    losingTrades,
                    winRate
                },
                overall: {
                    totalPositions: openPositions.length + closedPositions.length,
                    totalPnL: (totalPnL._sum.realizedPnL || 0) + totalUnrealizedPnL
                }
            }
        });
    } catch (error) {
        logger.error('Get position stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch position statistics',
            error: error.message
        });
    }
});

module.exports = router;
