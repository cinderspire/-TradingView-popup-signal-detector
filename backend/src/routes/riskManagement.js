const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * RISK MANAGEMENT SYSTEM
 * Comprehensive risk control for trading strategies
 *
 * Features:
 * - Fixed Risk: Set percentage per trade
 * - Adaptive Risk: Adjust based on performance (win/loss streaks)
 * - News-Based: Reduce risk around high-impact economic events
 */

// @route   GET /api/risk-management
// @desc    Get user's risk configurations
// @access  Private
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { type, isActive } = req.query;

    // Build filter
    const where = {
      userId: req.user.id
    };

    if (type) {
      where.type = type.toUpperCase();
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Get all configurations
    const configs = await prisma.riskConfig.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },  // Default first
        { createdAt: 'desc' }
      ]
    });

    // Calculate statistics
    const stats = {
      total: configs.length,
      byType: {
        FIXED: configs.filter(c => c.type === 'FIXED').length,
        ADAPTIVE: configs.filter(c => c.type === 'ADAPTIVE').length,
        NEWS_BASED: configs.filter(c => c.type === 'NEWS_BASED').length
      },
      active: configs.filter(c => c.isActive).length,
      default: configs.find(c => c.isDefault) || null
    };

    logger.info(`Risk configs retrieved for user ${req.user.id}: ${configs.length} found`);

    res.json({
      success: true,
      message: 'Risk configurations retrieved successfully',
      data: {
        configs,
        stats
      }
    });
  } catch (error) {
    logger.error('Get risk configs error:', error);
    next(error);
  }
});

// @route   POST /api/risk-management
// @desc    Create risk configuration
// @access  Private
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      name,
      description,
      type = 'FIXED',

      // Fixed Risk
      riskPerTrade,
      maxPositionSize,
      maxDailyLoss,
      maxDrawdown,

      // Adaptive Risk
      adaptiveEnabled,
      baseRiskPercent,
      winStreakMultiplier,
      lossStreakDivisor,
      maxAdaptiveRisk,
      minAdaptiveRisk,

      // News-Based Risk
      newsBasedEnabled,
      reduceRiskBeforeNews,
      newsRiskReduction,
      newsSafetyWindow,

      // Stop Loss & Take Profit
      useStopLoss,
      stopLossPercent,
      useTakeProfit,
      takeProfitPercent,
      riskRewardRatio,

      // Position Management
      maxOpenPositions,
      correlationLimit,
      allowHedging,

      // Leverage & Margin
      maxLeverage,
      useMargin,
      marginSafetyPercent,

      // Status
      isDefault = false
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Configuration name is required'
      });
    }

    // Type-specific validation
    if (type === 'FIXED' && !riskPerTrade) {
      return res.status(400).json({
        success: false,
        message: 'Fixed risk configuration requires riskPerTrade'
      });
    }

    if (type === 'ADAPTIVE' && (!baseRiskPercent || !winStreakMultiplier || !lossStreakDivisor)) {
      return res.status(400).json({
        success: false,
        message: 'Adaptive risk requires baseRiskPercent, winStreakMultiplier, and lossStreakDivisor'
      });
    }

    if (type === 'NEWS_BASED' && newsBasedEnabled && !newsRiskReduction) {
      return res.status(400).json({
        success: false,
        message: 'News-based risk requires newsRiskReduction percentage'
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.riskConfig.updateMany({
        where: {
          userId: req.user.id,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      });
    }

    // Create configuration
    const config = await prisma.riskConfig.create({
      data: {
        userId: req.user.id,
        name,
        description,
        type,

        // Fixed Risk
        riskPerTrade,
        maxPositionSize,
        maxDailyLoss,
        maxDrawdown,

        // Adaptive Risk
        adaptiveEnabled,
        baseRiskPercent,
        winStreakMultiplier,
        lossStreakDivisor,
        maxAdaptiveRisk,
        minAdaptiveRisk,

        // News-Based Risk
        newsBasedEnabled,
        reduceRiskBeforeNews,
        newsRiskReduction,
        newsSafetyWindow,

        // Stop Loss & Take Profit
        useStopLoss,
        stopLossPercent,
        useTakeProfit,
        takeProfitPercent,
        riskRewardRatio,

        // Position Management
        maxOpenPositions,
        correlationLimit,
        allowHedging,

        // Leverage & Margin
        maxLeverage,
        useMargin,
        marginSafetyPercent,

        // Status
        isDefault,
        isActive: true
      }
    });

    logger.info(`Risk config created: ${config.id} by user ${req.user.id} (${type})`);

    res.status(201).json({
      success: true,
      message: 'Risk configuration created successfully',
      data: { config }
    });
  } catch (error) {
    logger.error('Create risk config error:', error);
    next(error);
  }
});

// @route   PUT /api/risk-management/:id
// @desc    Update risk configuration
// @access  Private
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if config exists and belongs to user
    const existing = await prisma.riskConfig.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Risk configuration not found'
      });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this configuration'
      });
    }

    const {
      name,
      description,
      type,

      // Fixed Risk
      riskPerTrade,
      maxPositionSize,
      maxDailyLoss,
      maxDrawdown,

      // Adaptive Risk
      adaptiveEnabled,
      baseRiskPercent,
      winStreakMultiplier,
      lossStreakDivisor,
      maxAdaptiveRisk,
      minAdaptiveRisk,

      // News-Based Risk
      newsBasedEnabled,
      reduceRiskBeforeNews,
      newsRiskReduction,
      newsSafetyWindow,

      // Stop Loss & Take Profit
      useStopLoss,
      stopLossPercent,
      useTakeProfit,
      takeProfitPercent,
      riskRewardRatio,

      // Position Management
      maxOpenPositions,
      correlationLimit,
      allowHedging,

      // Leverage & Margin
      maxLeverage,
      useMargin,
      marginSafetyPercent,

      // Status
      isActive,
      isDefault
    } = req.body;

    // If setting as default, unset other defaults
    if (isDefault && !existing.isDefault) {
      await prisma.riskConfig.updateMany({
        where: {
          userId: req.user.id,
          isDefault: true,
          id: { not: id }
        },
        data: {
          isDefault: false
        }
      });
    }

    // Update configuration
    const updated = await prisma.riskConfig.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        description: description !== undefined ? description : existing.description,
        type: type !== undefined ? type : existing.type,

        // Fixed Risk
        riskPerTrade: riskPerTrade !== undefined ? riskPerTrade : existing.riskPerTrade,
        maxPositionSize: maxPositionSize !== undefined ? maxPositionSize : existing.maxPositionSize,
        maxDailyLoss: maxDailyLoss !== undefined ? maxDailyLoss : existing.maxDailyLoss,
        maxDrawdown: maxDrawdown !== undefined ? maxDrawdown : existing.maxDrawdown,

        // Adaptive Risk
        adaptiveEnabled: adaptiveEnabled !== undefined ? adaptiveEnabled : existing.adaptiveEnabled,
        baseRiskPercent: baseRiskPercent !== undefined ? baseRiskPercent : existing.baseRiskPercent,
        winStreakMultiplier: winStreakMultiplier !== undefined ? winStreakMultiplier : existing.winStreakMultiplier,
        lossStreakDivisor: lossStreakDivisor !== undefined ? lossStreakDivisor : existing.lossStreakDivisor,
        maxAdaptiveRisk: maxAdaptiveRisk !== undefined ? maxAdaptiveRisk : existing.maxAdaptiveRisk,
        minAdaptiveRisk: minAdaptiveRisk !== undefined ? minAdaptiveRisk : existing.minAdaptiveRisk,

        // News-Based Risk
        newsBasedEnabled: newsBasedEnabled !== undefined ? newsBasedEnabled : existing.newsBasedEnabled,
        reduceRiskBeforeNews: reduceRiskBeforeNews !== undefined ? reduceRiskBeforeNews : existing.reduceRiskBeforeNews,
        newsRiskReduction: newsRiskReduction !== undefined ? newsRiskReduction : existing.newsRiskReduction,
        newsSafetyWindow: newsSafetyWindow !== undefined ? newsSafetyWindow : existing.newsSafetyWindow,

        // Stop Loss & Take Profit
        useStopLoss: useStopLoss !== undefined ? useStopLoss : existing.useStopLoss,
        stopLossPercent: stopLossPercent !== undefined ? stopLossPercent : existing.stopLossPercent,
        useTakeProfit: useTakeProfit !== undefined ? useTakeProfit : existing.useTakeProfit,
        takeProfitPercent: takeProfitPercent !== undefined ? takeProfitPercent : existing.takeProfitPercent,
        riskRewardRatio: riskRewardRatio !== undefined ? riskRewardRatio : existing.riskRewardRatio,

        // Position Management
        maxOpenPositions: maxOpenPositions !== undefined ? maxOpenPositions : existing.maxOpenPositions,
        correlationLimit: correlationLimit !== undefined ? correlationLimit : existing.correlationLimit,
        allowHedging: allowHedging !== undefined ? allowHedging : existing.allowHedging,

        // Leverage & Margin
        maxLeverage: maxLeverage !== undefined ? maxLeverage : existing.maxLeverage,
        useMargin: useMargin !== undefined ? useMargin : existing.useMargin,
        marginSafetyPercent: marginSafetyPercent !== undefined ? marginSafetyPercent : existing.marginSafetyPercent,

        // Status
        isActive: isActive !== undefined ? isActive : existing.isActive,
        isDefault: isDefault !== undefined ? isDefault : existing.isDefault
      }
    });

    logger.info(`Risk config updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Risk configuration updated successfully',
      data: { config: updated }
    });
  } catch (error) {
    logger.error('Update risk config error:', error);
    next(error);
  }
});

// @route   DELETE /api/risk-management/:id
// @desc    Delete risk configuration
// @access  Private
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if config exists and belongs to user
    const existing = await prisma.riskConfig.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Risk configuration not found'
      });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this configuration'
      });
    }

    // Prevent deleting default config if it's the only one
    if (existing.isDefault) {
      const userConfigsCount = await prisma.riskConfig.count({
        where: { userId: req.user.id }
      });

      if (userConfigsCount === 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your only risk configuration'
        });
      }

      // If deleting default, set another config as default
      const nextConfig = await prisma.riskConfig.findFirst({
        where: {
          userId: req.user.id,
          id: { not: id }
        }
      });

      if (nextConfig) {
        await prisma.riskConfig.update({
          where: { id: nextConfig.id },
          data: { isDefault: true }
        });
      }
    }

    // Delete configuration
    await prisma.riskConfig.delete({
      where: { id }
    });

    logger.info(`Risk config deleted: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Risk configuration deleted successfully'
    });
  } catch (error) {
    logger.error('Delete risk config error:', error);
    next(error);
  }
});

// @route   POST /api/risk-management/test
// @desc    Test risk settings with simulation
// @access  Private
router.post('/test', authenticate, async (req, res, next) => {
  try {
    const {
      configId,
      capitalAmount = 10000,
      currentPrice = 50000,
      winStreak = 0,
      lossStreak = 0,
      checkNewsImpact = false
    } = req.body;

    // Get configuration
    let config;
    if (configId) {
      config = await prisma.riskConfig.findUnique({
        where: { id: configId }
      });

      if (!config || config.userId !== req.user.id) {
        return res.status(404).json({
          success: false,
          message: 'Risk configuration not found'
        });
      }
    } else {
      // Use default config
      config = await prisma.riskConfig.findFirst({
        where: {
          userId: req.user.id,
          isDefault: true
        }
      });

      if (!config) {
        return res.status(400).json({
          success: false,
          message: 'No default risk configuration found. Please create one first.'
        });
      }
    }

    // Calculate position size based on config type
    let simulation = {};

    if (config.type === 'FIXED') {
      const riskAmount = capitalAmount * (config.riskPerTrade / 100);
      const stopLossDistance = currentPrice * (config.stopLossPercent / 100);
      const positionSize = riskAmount / stopLossDistance;
      const positionValue = positionSize * currentPrice;
      const positionPercent = (positionValue / capitalAmount) * 100;

      simulation = {
        type: 'FIXED',
        description: 'Fixed percentage risk per trade',
        capitalAmount,
        riskPerTrade: config.riskPerTrade,
        riskAmount: riskAmount.toFixed(2),
        stopLossPercent: config.stopLossPercent,
        stopLossDistance: stopLossDistance.toFixed(2),
        positionSize: positionSize.toFixed(6),
        positionValue: positionValue.toFixed(2),
        positionPercent: positionPercent.toFixed(2),
        stopLossPrice: (currentPrice - stopLossDistance).toFixed(2),
        takeProfitPrice: config.useTakeProfit
          ? (currentPrice + (currentPrice * config.takeProfitPercent / 100)).toFixed(2)
          : null,
        maxPositionSize: config.maxPositionSize,
        isWithinLimits: positionPercent <= (config.maxPositionSize || 100)
      };
    } else if (config.type === 'ADAPTIVE') {
      let adjustedRisk = config.baseRiskPercent;

      // Adjust based on streaks
      if (winStreak > 0) {
        adjustedRisk = Math.min(
          config.baseRiskPercent * Math.pow(config.winStreakMultiplier, winStreak),
          config.maxAdaptiveRisk
        );
      } else if (lossStreak > 0) {
        adjustedRisk = Math.max(
          config.baseRiskPercent / Math.pow(config.lossStreakDivisor, lossStreak),
          config.minAdaptiveRisk
        );
      }

      const riskAmount = capitalAmount * (adjustedRisk / 100);
      const stopLossDistance = currentPrice * (config.stopLossPercent / 100);
      const positionSize = riskAmount / stopLossDistance;
      const positionValue = positionSize * currentPrice;

      simulation = {
        type: 'ADAPTIVE',
        description: 'Dynamic risk adjustment based on performance',
        capitalAmount,
        baseRiskPercent: config.baseRiskPercent,
        adjustedRiskPercent: adjustedRisk.toFixed(2),
        winStreak,
        lossStreak,
        riskAmount: riskAmount.toFixed(2),
        positionSize: positionSize.toFixed(6),
        positionValue: positionValue.toFixed(2),
        stopLossPrice: (currentPrice - stopLossDistance).toFixed(2),
        adaptiveRange: `${config.minAdaptiveRisk}% - ${config.maxAdaptiveRisk}%`,
        streakImpact: winStreak > 0
          ? `Increased by ${((adjustedRisk / config.baseRiskPercent - 1) * 100).toFixed(1)}%`
          : lossStreak > 0
          ? `Decreased by ${((1 - adjustedRisk / config.baseRiskPercent) * 100).toFixed(1)}%`
          : 'No adjustment'
      };
    } else if (config.type === 'NEWS_BASED') {
      const baseRisk = config.riskPerTrade || config.baseRiskPercent || 1.0;
      let adjustedRisk = baseRisk;

      // Check if we should reduce risk (simulated news check)
      let newsImpact = null;
      if (checkNewsImpact && config.newsBasedEnabled && config.reduceRiskBeforeNews) {
        adjustedRisk = baseRisk * ((100 - config.newsRiskReduction) / 100);
        newsImpact = {
          detected: true,
          reduction: config.newsRiskReduction,
          safetyWindow: config.newsSafetyWindow,
          message: `Risk reduced by ${config.newsRiskReduction}% due to upcoming high-impact news`
        };
      }

      const riskAmount = capitalAmount * (adjustedRisk / 100);
      const stopLossDistance = currentPrice * (config.stopLossPercent / 100);
      const positionSize = riskAmount / stopLossDistance;
      const positionValue = positionSize * currentPrice;

      simulation = {
        type: 'NEWS_BASED',
        description: 'Auto-adjust stop loss and position size before high-impact news',
        capitalAmount,
        baseRiskPercent: baseRisk,
        adjustedRiskPercent: adjustedRisk.toFixed(2),
        riskAmount: riskAmount.toFixed(2),
        positionSize: positionSize.toFixed(6),
        positionValue: positionValue.toFixed(2),
        stopLossPrice: (currentPrice - stopLossDistance).toFixed(2),
        newsImpact,
        newsBasedSettings: {
          enabled: config.newsBasedEnabled,
          reduceRiskBeforeNews: config.reduceRiskBeforeNews,
          riskReduction: config.newsRiskReduction,
          safetyWindow: config.newsSafetyWindow
        }
      };
    }

    // Add common risk metrics
    simulation.riskRewardRatio = config.riskRewardRatio;
    simulation.maxOpenPositions = config.maxOpenPositions;
    simulation.maxLeverage = config.maxLeverage;
    simulation.allowHedging = config.allowHedging;

    // Calculate potential outcomes
    const stopLossLoss = -parseFloat(simulation.riskAmount);
    const takeProfitGain = config.useTakeProfit
      ? parseFloat(simulation.riskAmount) * config.riskRewardRatio
      : null;

    simulation.potentialOutcomes = {
      stopLossHit: {
        loss: stopLossLoss.toFixed(2),
        newCapital: (capitalAmount + stopLossLoss).toFixed(2),
        percentLoss: ((stopLossLoss / capitalAmount) * 100).toFixed(2)
      },
      takeProfitHit: takeProfitGain ? {
        profit: takeProfitGain.toFixed(2),
        newCapital: (capitalAmount + takeProfitGain).toFixed(2),
        percentGain: ((takeProfitGain / capitalAmount) * 100).toFixed(2)
      } : null
    };

    logger.info(`Risk config tested: ${config.id} by user ${req.user.id} (${config.type})`);

    res.json({
      success: true,
      message: 'Risk settings tested successfully',
      data: {
        config: {
          id: config.id,
          name: config.name,
          type: config.type
        },
        simulation
      }
    });
  } catch (error) {
    logger.error('Test risk settings error:', error);
    next(error);
  }
});

module.exports = router;
