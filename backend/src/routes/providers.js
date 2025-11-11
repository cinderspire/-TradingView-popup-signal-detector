const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authenticateOptional } = require('../middleware/auth');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// @route   GET /api/providers
// @desc    Get all providers
// @access  Public
router.get('/', authenticateOptional, async (req, res, next) => {
  try {
    const {
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      order = 'desc',
      verified
    } = req.query;

    // Build filter for providers (users with PROVIDER role)
    const where = {
      role: 'PROVIDER',
      isActive: true
    };

    // Get providers with their stats
    const [providers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          bio: true,
          createdAt: true,
          _count: {
            select: {
              strategies: true,
              subscriptions: true
            }
          },
          strategies: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              category: true,
              winRate: true,
              totalSubscribers: true,
              rating: true
            },
            take: 3 // Show top 3 strategies
          }
        },
        orderBy: { [sortBy]: order },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.user.count({ where })
    ]);

    // Calculate provider stats
    const providersWithStats = providers.map(provider => {
      const avgRating = provider.strategies.length > 0
        ? provider.strategies.reduce((sum, s) => sum + (s.rating || 0), 0) / provider.strategies.length
        : 0;

      return {
        id: provider.id,
        username: provider.username,
        firstName: provider.firstName,
        lastName: provider.lastName,
        displayName: provider.firstName && provider.lastName
          ? `${provider.firstName} ${provider.lastName}`
          : provider.username,
        avatar: provider.avatar,
        bio: provider.bio,
        joinedAt: provider.createdAt,
        strategyCount: provider._count.strategies,
        subscriberCount: provider._count.subscriptions,
        topStrategies: provider.strategies,
        averageRating: avgRating.toFixed(1)
      };
    });

    res.json({
      success: true,
      data: {
        providers: providersWithStats,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + providers.length
        }
      }
    });
  } catch (error) {
    logger.error('Get providers error:', error);
    next(error);
  }
});

// @route   GET /api/providers/:id
// @desc    Get provider details
// @access  Public
router.get('/:id', authenticateOptional, async (req, res, next) => {
  try {
    const provider = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        role: 'PROVIDER',
        isActive: true
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            strategies: true,
            subscriptions: true
          }
        },
        strategies: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            type: true,
            monthlyPrice: true,
            winRate: true,
            avgProfit: true,
            totalTrades: true,
            totalSubscribers: true,
            rating: true,
            supportedPairs: true,
            supportedTimeframes: true,
            createdAt: true
          },
          orderBy: { totalSubscribers: 'desc' }
        }
      }
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Calculate overall stats
    const totalSignals = await prisma.signal.count({
      where: {
        strategy: {
          providerId: provider.id
        }
      }
    });

    const avgRating = provider.strategies.length > 0
      ? provider.strategies.reduce((sum, s) => sum + (s.rating || 0), 0) / provider.strategies.length
      : 0;

    const totalRevenue = await prisma.transaction.aggregate({
      where: {
        providerId: provider.id,
        type: 'REVENUE_SHARE'
      },
      _sum: {
        amount: true
      }
    });

    res.json({
      success: true,
      data: {
        provider: {
          id: provider.id,
          username: provider.username,
          firstName: provider.firstName,
          lastName: provider.lastName,
          displayName: provider.firstName && provider.lastName
            ? `${provider.firstName} ${provider.lastName}`
            : provider.username,
          avatar: provider.avatar,
          bio: provider.bio,
          joinedAt: provider.createdAt,
          stats: {
            totalStrategies: provider._count.strategies,
            totalSubscribers: provider._count.subscriptions,
            totalSignals: totalSignals,
            averageRating: avgRating.toFixed(1),
            totalRevenue: totalRevenue._sum.amount || 0
          },
          strategies: provider.strategies
        }
      }
    });
  } catch (error) {
    logger.error('Get provider details error:', error);
    next(error);
  }
});

// @route   POST /api/providers
// @desc    Become a provider (upgrade user to provider)
// @access  Private
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { bio, firstName, lastName } = req.body;

    // Check if user is already a provider
    if (req.user.role === 'PROVIDER') {
      return res.status(400).json({
        success: false,
        message: 'You are already a provider'
      });
    }

    // Upgrade user to provider
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        role: 'PROVIDER',
        bio: bio || null,
        firstName: firstName || req.user.firstName,
        lastName: lastName || req.user.lastName
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        bio: true,
        createdAt: true
      }
    });

    logger.info(`User ${req.user.id} upgraded to provider`);

    res.status(201).json({
      success: true,
      message: 'Successfully upgraded to provider',
      data: { user: updatedUser }
    });
  } catch (error) {
    logger.error('Become provider error:', error);
    next(error);
  }
});

// @route   PUT /api/providers/:id
// @desc    Update provider profile
// @access  Private (Provider only)
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { bio, firstName, lastName, avatar } = req.body;

    // Verify user is updating their own profile
    if (req.params.id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own provider profile'
      });
    }

    // Verify user is a provider
    if (req.user.role !== 'PROVIDER') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can update provider profiles'
      });
    }

    // Build update data
    const updateData = {};
    if (bio !== undefined) updateData.bio = bio;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (avatar !== undefined) updateData.avatar = avatar;

    // Update provider profile
    const updatedProvider = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            strategies: true,
            subscriptions: true
          }
        }
      }
    });

    logger.info(`Provider ${req.user.id} updated profile`);

    res.json({
      success: true,
      message: 'Provider profile updated successfully',
      data: { provider: updatedProvider }
    });
  } catch (error) {
    logger.error('Update provider error:', error);
    next(error);
  }
});

// @route   GET /api/providers/:id/signals
// @desc    Get provider's signals
// @access  Public/Private
router.get('/:id/signals', authenticateOptional, async (req, res, next) => {
  try {
    const {
      status,
      pair,
      limit = 20,
      offset = 0
    } = req.query;

    // Verify provider exists
    const provider = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        role: 'PROVIDER'
      }
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Build filter for signals from this provider's strategies
    const where = {
      strategy: {
        providerId: req.params.id
      }
    };

    if (status) where.status = status;
    if (pair) where.pair = pair;

    // Get signals
    const [signals, total] = await Promise.all([
      prisma.signal.findMany({
        where,
        include: {
          strategy: {
            select: {
              id: true,
              name: true,
              category: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.signal.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        providerId: req.params.id,
        providerUsername: provider.username,
        signals,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + signals.length
        }
      }
    });
  } catch (error) {
    logger.error('Get provider signals error:', error);
    next(error);
  }
});

// @route   GET /api/providers/dashboard
// @desc    Get current provider's dashboard stats
// @access  Private (Provider only)
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    // Verify user is a provider
    if (req.user.role !== 'PROVIDER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can access the dashboard'
      });
    }

    const providerId = req.user.id;

    // Get provider details
    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      include: {
        _count: {
          select: {
            strategies: true,
            subscriptions: true
          }
        }
      }
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Get strategy stats
    const strategies = await prisma.strategy.findMany({
      where: { providerId },
      select: {
        id: true,
        name: true,
        winRate: true,
        avgProfit: true,
        totalTrades: true,
        profitableTrades: true,
        rating: true,
        totalSubscribers: true,
        monthlyPrice: true
      }
    });

    // Calculate aggregated stats
    const totalTrades = strategies.reduce((sum, s) => sum + (s.totalTrades || 0), 0);
    const totalProfitableTrades = strategies.reduce((sum, s) => sum + (s.profitableTrades || 0), 0);
    const avgWinRate = strategies.length > 0
      ? strategies.reduce((sum, s) => sum + (s.winRate || 0), 0) / strategies.length
      : 0;
    const avgProfit = strategies.length > 0
      ? strategies.reduce((sum, s) => sum + (s.avgProfit || 0), 0) / strategies.length
      : 0;
    const avgRating = strategies.length > 0
      ? strategies.reduce((sum, s) => sum + (s.rating || 0), 0) / strategies.length
      : 0;
    const totalSubscribers = strategies.reduce((sum, s) => sum + (s.totalSubscribers || 0), 0);

    // Get signal stats
    const signalStats = await prisma.signal.groupBy({
      by: ['status'],
      where: {
        strategy: {
          providerId
        }
      },
      _count: true
    });

    const signalCounts = signalStats.reduce((acc, stat) => {
      acc[stat.status.toLowerCase()] = stat._count;
      return acc;
    }, {});

    // Get revenue stats (last 30 days and total)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalRevenue, monthlyRevenue] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          providerId,
          type: 'REVENUE_SHARE',
          status: 'COMPLETED'
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.transaction.aggregate({
        where: {
          providerId,
          type: 'REVENUE_SHARE',
          status: 'COMPLETED',
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        _sum: { amount: true }
      })
    ]);

    // Calculate potential monthly revenue from current subscriptions
    const potentialMonthlyRevenue = strategies.reduce((sum, s) => {
      return sum + (s.totalSubscribers * s.monthlyPrice * 0.7); // 70% revenue share
    }, 0);

    res.json({
      success: true,
      data: {
        provider: {
          id: provider.id,
          username: provider.username,
          displayName: provider.firstName && provider.lastName
            ? `${provider.firstName} ${provider.lastName}`
            : provider.username,
          avatar: provider.avatar,
          bio: provider.bio
        },
        stats: {
          strategies: {
            total: strategies.length,
            active: strategies.filter(s => s.totalSubscribers > 0).length
          },
          subscribers: {
            total: totalSubscribers,
            unique: provider._count.subscriptions
          },
          trading: {
            totalTrades,
            profitableTrades: totalProfitableTrades,
            winRate: avgWinRate.toFixed(2),
            avgProfit: avgProfit.toFixed(2)
          },
          signals: {
            total: Object.values(signalCounts).reduce((sum, count) => sum + count, 0),
            active: signalCounts.active || 0,
            executed: signalCounts.executed || 0,
            cancelled: signalCounts.cancelled || 0,
            expired: signalCounts.expired || 0
          },
          performance: {
            averageRating: avgRating.toFixed(1),
            ratingCount: strategies.length
          },
          revenue: {
            total: totalRevenue._sum.amount || 0,
            last30Days: monthlyRevenue._sum.amount || 0,
            potentialMonthly: potentialMonthlyRevenue.toFixed(2),
            transactionCount: totalRevenue._count
          }
        },
        recentStrategies: strategies.slice(0, 5)
      }
    });
  } catch (error) {
    logger.error('Get provider dashboard error:', error);
    next(error);
  }
});

// @route   GET /api/providers/:id/stats
// @desc    Get provider statistics
// @access  Public
router.get('/:id/stats', async (req, res, next) => {
  try {
    // Verify provider exists
    const provider = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        role: 'PROVIDER',
        isActive: true
      },
      include: {
        _count: {
          select: {
            strategies: true,
            subscriptions: true
          }
        }
      }
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Get strategy stats
    const strategies = await prisma.strategy.findMany({
      where: { providerId: req.params.id },
      select: {
        winRate: true,
        avgProfit: true,
        totalTrades: true,
        profitableTrades: true,
        rating: true,
        totalSubscribers: true
      }
    });

    // Calculate aggregated stats
    const totalTrades = strategies.reduce((sum, s) => sum + (s.totalTrades || 0), 0);
    const totalProfitableTrades = strategies.reduce((sum, s) => sum + (s.profitableTrades || 0), 0);
    const avgWinRate = strategies.length > 0
      ? strategies.reduce((sum, s) => sum + (s.winRate || 0), 0) / strategies.length
      : 0;
    const avgProfit = strategies.length > 0
      ? strategies.reduce((sum, s) => sum + (s.avgProfit || 0), 0) / strategies.length
      : 0;
    const avgRating = strategies.length > 0
      ? strategies.reduce((sum, s) => sum + (s.rating || 0), 0) / strategies.length
      : 0;
    const totalSubscribers = strategies.reduce((sum, s) => sum + (s.totalSubscribers || 0), 0);

    // Get signal stats
    const signalStats = await prisma.signal.groupBy({
      by: ['status'],
      where: {
        strategy: {
          providerId: req.params.id
        }
      },
      _count: true
    });

    const signalCounts = signalStats.reduce((acc, stat) => {
      acc[stat.status.toLowerCase()] = stat._count;
      return acc;
    }, {});

    // Get revenue stats
    const revenue = await prisma.transaction.aggregate({
      where: {
        providerId: req.params.id,
        type: 'REVENUE_SHARE'
      },
      _sum: { amount: true },
      _count: true
    });

    res.json({
      success: true,
      data: {
        providerId: req.params.id,
        stats: {
          strategies: {
            total: provider._count.strategies,
            active: strategies.length
          },
          subscribers: {
            total: totalSubscribers,
            unique: provider._count.subscriptions
          },
          trading: {
            totalTrades,
            profitableTrades: totalProfitableTrades,
            winRate: avgWinRate.toFixed(2),
            avgProfit: avgProfit.toFixed(2)
          },
          signals: {
            total: Object.values(signalCounts).reduce((sum, count) => sum + count, 0),
            ...signalCounts
          },
          performance: {
            averageRating: avgRating.toFixed(1),
            ratingCount: strategies.length
          },
          revenue: {
            total: revenue._sum.amount || 0,
            transactionCount: revenue._count
          }
        }
      }
    });
  } catch (error) {
    logger.error('Get provider stats error:', error);
    next(error);
  }
});

module.exports = router;
