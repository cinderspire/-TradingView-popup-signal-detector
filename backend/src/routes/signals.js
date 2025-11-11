const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireProvider } = require('../middleware/auth');
const { signalLimiter } = require('../middleware/rateLimit');
const logger = require('../utils/logger');
const { getWebSocketServer } = require('../websocket');

const prisma = new PrismaClient();

// Helper function to format signal for response
function formatSignal(signal) {
  return {
    id: signal.id,
    strategyId: signal.strategyId,
    strategyName: signal.strategy?.name || 'Unknown',
    providerId: signal.strategy?.providerId || signal.providerId,
    providerUsername: signal.strategy?.provider?.username || 'Unknown',
    type: signal.type,
    direction: signal.direction,
    status: signal.status,
    symbol: signal.symbol,
    timeframe: signal.timeframe,
    entryPrice: signal.entryPrice,
    currentPrice: signal.currentPrice,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    takeProfit2: signal.takeProfit2,
    takeProfit3: signal.takeProfit3,
    riskRewardRatio: signal.riskRewardRatio,
    executedPrice: signal.executedPrice,
    exitPrice: signal.exitPrice,
    profitLoss: signal.profitLoss,
    profitLossAmount: signal.profitLossAmount,
    note: signal.note,
    confidenceLevel: signal.confidenceLevel,
    createdAt: signal.createdAt,
    executedAt: signal.executedAt,
    closedAt: signal.closedAt,
    expiresAt: signal.expiresAt,
  };
}

// @route   GET /api/signals
// @desc    Get all signals (filtered)
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const {
      status,
      type,
      direction,
      symbol,
      strategyId,
      providerId,
      timeframe,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const where = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (direction) where.direction = direction;
    if (symbol) where.symbol = { contains: symbol, mode: 'insensitive' };
    if (strategyId) where.strategyId = strategyId;
    if (timeframe) where.timeframe = timeframe;
    if (providerId) {
      where.strategy = { providerId };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get signals with strategy and provider info
    const [signals, total] = await Promise.all([
      prisma.signal.findMany({
        where,
        include: {
          strategy: {
            select: {
              id: true,
              name: true,
              providerId: true,
              provider: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        take: parseInt(limit),
        skip
      }),
      prisma.signal.count({ where })
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      message: 'Signals retrieved successfully',
      data: {
        signals: signals.map(formatSignal),
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      }
    });
  } catch (error) {
    logger.error('Get signals error:', error);
    next(error);
  }
});

// @route   GET /api/signals/my
// @desc    Get user's signals from subscribed strategies
// @access  Private
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const {
      status,
      type,
      direction,
      symbol,
      limit = 5
    } = req.query;

    // Get user's subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: req.user.id, status: 'ACTIVE' },
      select: { strategyId: true }
    });

    const strategyIds = subscriptions.map(sub => sub.strategyId);

    // Build filter
    const where = {
      strategyId: { in: strategyIds }
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (direction) where.direction = direction;
    if (symbol) where.symbol = { contains: symbol, mode: 'insensitive' };

    // Get signals
    const signals = await prisma.signal.findMany({
      where,
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
            providerId: true,
            provider: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    const total = await prisma.signal.count({ where });

    res.json({
      success: true,
      message: 'User signals retrieved successfully',
      data: {
        signals: signals.map(formatSignal),
        total
      }
    });
  } catch (error) {
    logger.error('Get user signals error:', error);
    next(error);
  }
});

// @route   GET /api/signals/provider/my
// @desc    Get provider's own created signals
// @access  Private (Provider only)
router.get('/provider/my', authenticate, requireProvider, async (req, res, next) => {
  try {
    const {
      status,
      type,
      direction,
      symbol,
      strategyId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Get provider's strategies
    const strategies = await prisma.strategy.findMany({
      where: { providerId: req.user.id },
      select: { id: true }
    });

    const strategyIds = strategies.map(s => s.id);

    // Build filter
    const where = {
      strategyId: { in: strategyIds }
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (direction) where.direction = direction;
    if (symbol) where.symbol = { contains: symbol, mode: 'insensitive' };
    if (strategyId && strategyIds.includes(strategyId)) {
      where.strategyId = strategyId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get signals
    const [signals, total] = await Promise.all([
      prisma.signal.findMany({
        where,
        include: {
          strategy: {
            select: {
              id: true,
              name: true,
              providerId: true,
              provider: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        take: parseInt(limit),
        skip
      }),
      prisma.signal.count({ where })
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      message: 'Provider signals retrieved successfully',
      data: {
        signals: signals.map(formatSignal),
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      }
    });
  } catch (error) {
    logger.error('Get provider signals error:', error);
    next(error);
  }
});

// @route   GET /api/signals/:id
// @desc    Get signal details
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const signal = await prisma.signal.findUnique({
      where: { id: req.params.id },
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
            description: true,
            providerId: true,
            provider: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Signal not found'
      });
    }

    res.json({
      success: true,
      message: 'Signal retrieved successfully',
      data: { signal: formatSignal(signal) }
    });
  } catch (error) {
    logger.error('Get signal details error:', error);
    next(error);
  }
});

// @route   POST /api/signals
// @desc    Create new signal
// @access  Private (Provider only)
router.post('/', authenticate, requireProvider, signalLimiter, async (req, res, next) => {
  try {
    const {
      strategyId,
      type,
      direction,
      symbol,
      timeframe,
      entryPrice,
      stopLoss,
      takeProfit,
      takeProfit2,
      takeProfit3,
      note,
      confidenceLevel,
      expiresAt
    } = req.body;

    // Validate required fields
    if (!strategyId || !type || !direction || !symbol || !timeframe || !entryPrice || !stopLoss) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: strategyId, type, direction, symbol, timeframe, entryPrice, stopLoss'
      });
    }

    // Verify strategy belongs to provider
    const strategy = await prisma.strategy.findFirst({
      where: {
        id: strategyId,
        providerId: req.user.id
      }
    });

    if (!strategy) {
      return res.status(403).json({
        success: false,
        message: 'Strategy not found or you do not have permission'
      });
    }

    // Calculate risk-reward ratio
    let riskRewardRatio = null;
    if (entryPrice && stopLoss && takeProfit) {
      const risk = Math.abs(parseFloat(entryPrice) - parseFloat(stopLoss));
      const reward = Math.abs(parseFloat(takeProfit) - parseFloat(entryPrice));
      riskRewardRatio = risk > 0 ? reward / risk : null;
    }

    // Create signal
    const signal = await prisma.signal.create({
      data: {
        strategyId,
        type,
        direction,
        status: 'ACTIVE',
        symbol,
        timeframe,
        entryPrice: parseFloat(entryPrice),
        stopLoss: parseFloat(stopLoss),
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        takeProfit2: takeProfit2 ? parseFloat(takeProfit2) : null,
        takeProfit3: takeProfit3 ? parseFloat(takeProfit3) : null,
        riskRewardRatio,
        note: note || null,
        confidenceLevel: confidenceLevel ? parseInt(confidenceLevel) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      },
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
            providerId: true,
            provider: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      }
    });

    logger.info(`Signal created: ${signal.id} by provider ${req.user.id}`);

    // Broadcast via WebSocket to strategy subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastSignalCreated(formatSignal(signal));
    }

    res.status(201).json({
      success: true,
      message: 'Signal created successfully',
      data: { signal: formatSignal(signal) }
    });
  } catch (error) {
    logger.error('Create signal error:', error);
    next(error);
  }
});

// @route   PUT /api/signals/:id
// @desc    Update signal
// @access  Private (Provider only)
router.put('/:id', authenticate, requireProvider, async (req, res, next) => {
  try {
    const {
      status,
      currentPrice,
      stopLoss,
      takeProfit,
      takeProfit2,
      takeProfit3,
      note,
      confidenceLevel
    } = req.body;

    // Get existing signal
    const existingSignal = await prisma.signal.findUnique({
      where: { id: req.params.id },
      include: {
        strategy: {
          select: {
            providerId: true
          }
        }
      }
    });

    if (!existingSignal) {
      return res.status(404).json({
        success: false,
        message: 'Signal not found'
      });
    }

    // Verify ownership
    if (existingSignal.strategy.providerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this signal'
      });
    }

    // Build update data
    const updateData = {};

    if (status) updateData.status = status;
    if (currentPrice !== undefined) updateData.currentPrice = parseFloat(currentPrice);
    if (stopLoss !== undefined) updateData.stopLoss = parseFloat(stopLoss);
    if (takeProfit !== undefined) updateData.takeProfit = parseFloat(takeProfit);
    if (takeProfit2 !== undefined) updateData.takeProfit2 = parseFloat(takeProfit2);
    if (takeProfit3 !== undefined) updateData.takeProfit3 = parseFloat(takeProfit3);
    if (note !== undefined) updateData.note = note;
    if (confidenceLevel !== undefined) updateData.confidenceLevel = parseInt(confidenceLevel);

    // Update signal
    const signal = await prisma.signal.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
            providerId: true,
            provider: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      }
    });

    logger.info(`Signal updated: ${signal.id} by provider ${req.user.id}`);

    // Broadcast via WebSocket to strategy subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastSignalUpdated(formatSignal(signal));
    }

    res.json({
      success: true,
      message: 'Signal updated successfully',
      data: { signal: formatSignal(signal) }
    });
  } catch (error) {
    logger.error('Update signal error:', error);
    next(error);
  }
});

// @route   POST /api/signals/:id/execute
// @desc    Execute signal (create position from signal)
// @access  Private
router.post('/:id/execute', authenticate, async (req, res, next) => {
  try {
    const { executedPrice, positionSize } = req.body;

    if (!executedPrice) {
      return res.status(400).json({
        success: false,
        message: 'Executed price is required'
      });
    }

    // Get signal
    const signal = await prisma.signal.findUnique({
      where: { id: req.params.id },
      include: {
        strategy: true
      }
    });

    if (!signal) {
      return res.status(404).json({
        success: false,
        message: 'Signal not found'
      });
    }

    // Verify signal is active
    if (signal.status !== 'ACTIVE' && signal.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Signal is not active'
      });
    }

    // Create position from signal
    const position = await prisma.position.create({
      data: {
        userId: req.user.id,
        strategyId: signal.strategyId,
        signalId: signal.id,
        symbol: signal.symbol,
        side: signal.direction,
        status: 'OPEN',
        entryPrice: parseFloat(executedPrice),
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        size: positionSize ? parseFloat(positionSize) : 1.0
      }
    });

    // Update signal status
    await prisma.signal.update({
      where: { id: req.params.id },
      data: {
        status: 'EXECUTED',
        executedPrice: parseFloat(executedPrice),
        executedAt: new Date()
      }
    });

    logger.info(`Signal ${signal.id} executed by user ${req.user.id}, position ${position.id} created`);

    // Broadcast via WebSocket to strategy subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastSignalExecuted(formatSignal(signal), position);
    }

    res.json({
      success: true,
      message: 'Signal executed successfully',
      data: {
        position,
        signal: formatSignal(signal)
      }
    });
  } catch (error) {
    logger.error('Execute signal error:', error);
    next(error);
  }
});

// @route   POST /api/signals/:id/cancel
// @desc    Cancel signal
// @access  Private (Provider only)
router.post('/:id/cancel', authenticate, requireProvider, async (req, res, next) => {
  try {
    // Get existing signal
    const existingSignal = await prisma.signal.findUnique({
      where: { id: req.params.id },
      include: {
        strategy: {
          select: {
            providerId: true
          }
        }
      }
    });

    if (!existingSignal) {
      return res.status(404).json({
        success: false,
        message: 'Signal not found'
      });
    }

    // Verify ownership
    if (existingSignal.strategy.providerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel this signal'
      });
    }

    // Update status to CANCELLED
    const signal = await prisma.signal.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
        closedAt: new Date()
      },
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
            providerId: true,
            provider: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      }
    });

    logger.info(`Signal cancelled: ${signal.id} by provider ${req.user.id}`);

    // Broadcast via WebSocket to strategy subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastSignalClosed(formatSignal(signal), 'CANCELLED');
    }

    res.json({
      success: true,
      message: 'Signal cancelled successfully',
      data: { signal: formatSignal(signal) }
    });
  } catch (error) {
    logger.error('Cancel signal error:', error);
    next(error);
  }
});

// @route   DELETE /api/signals/:id
// @desc    Delete signal
// @access  Private (Provider only)
router.delete('/:id', authenticate, requireProvider, async (req, res, next) => {
  try {
    // Get existing signal
    const existingSignal = await prisma.signal.findUnique({
      where: { id: req.params.id },
      include: {
        strategy: {
          select: {
            providerId: true
          }
        }
      }
    });

    if (!existingSignal) {
      return res.status(404).json({
        success: false,
        message: 'Signal not found'
      });
    }

    // Verify ownership
    if (existingSignal.strategy.providerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this signal'
      });
    }

    // Delete signal
    await prisma.signal.delete({
      where: { id: req.params.id }
    });

    logger.info(`Signal deleted: ${req.params.id} by provider ${req.user.id}`);

    res.json({
      success: true,
      message: 'Signal deleted successfully'
    });
  } catch (error) {
    logger.error('Delete signal error:', error);
    next(error);
  }
});

// @route   GET /api/signals/analytics/open-pnl
// @desc    Get Open PnL for all active positions using FIFO matching
// @access  Private
router.get('/analytics/open-pnl', authenticate, async (req, res, next) => {
  try {
    const SignalMatcher = require('../services/signal-matcher');

    // Get open positions with PnL calculations
    const openPositions = await SignalMatcher.getOpenPositionsWithPnL();

    const totalOpenPnL = openPositions.reduce((sum, p) => sum + p.openPnLPercent, 0);

    res.json({
      success: true,
      message: 'Open PnL retrieved successfully',
      data: {
        positions: openPositions.map(p => ({
          symbol: p.symbol,
          direction: p.direction,
          openPositionCount: p.openPositionCount,
          totalAmount: p.totalAmount,
          avgEntryPrice: p.avgEntryPrice,
          currentPrice: p.currentPrice,
          openPnLPercent: p.openPnLPercent.toFixed(2)
        })),
        totalOpenPnL: totalOpenPnL.toFixed(2),
        positionCount: openPositions.length
      }
    });
  } catch (error) {
    logger.error('Get Open PnL error:', error);
    next(error);
  }
});

// @route   GET /api/signals/analytics/performance
// @desc    Get complete trading performance (closed + open PnL)
// @access  Private
router.get('/analytics/performance', authenticate, async (req, res, next) => {
  try {
    const SignalMatcher = require('../services/signal-matcher');

    // Get performance summary
    const summary = await SignalMatcher.getPerformanceSummary();

    res.json({
      success: true,
      message: 'Performance summary retrieved successfully',
      data: summary
    });
  } catch (error) {
    logger.error('Get performance summary error:', error);
    next(error);
  }
});

// @route   POST /api/signals/match-exit
// @desc    Manually trigger EXIT signal matching (for testing/debugging)
// @access  Private (Provider only)
router.post('/match-exit', authenticate, requireProvider, async (req, res, next) => {
  try {
    const { signalId } = req.body;

    if (!signalId) {
      return res.status(400).json({
        success: false,
        message: 'Signal ID is required'
      });
    }

    // Get exit signal
    const exitSignal = await prisma.signal.findUnique({
      where: { id: signalId }
    });

    if (!exitSignal) {
      return res.status(404).json({
        success: false,
        message: 'Signal not found'
      });
    }

    if (exitSignal.type !== 'EXIT') {
      return res.status(400).json({
        success: false,
        message: 'Signal must be EXIT type for matching'
      });
    }

    // Trigger matching
    const SignalMatcher = require('../services/signal-matcher');
    const matches = await SignalMatcher.matchExitSignal({
      id: exitSignal.id,
      pair: exitSignal.symbol,
      direction: exitSignal.direction,
      entry: exitSignal.entryPrice,
      contracts: 1.0
    });

    res.json({
      success: true,
      message: 'EXIT signal matched successfully',
      data: {
        matchCount: matches ? matches.length : 0,
        matches
      }
    });
  } catch (error) {
    logger.error('Match EXIT signal error:', error);
    next(error);
  }
});

module.exports = router;
