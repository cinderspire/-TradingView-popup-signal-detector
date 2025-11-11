const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

/**
 * POST /api/trials/start
 * Start a free trial for a strategy
 */
router.post('/start', authenticate, async (req, res) => {
  try {
    const { strategyId, trialDays = 14 } = req.body;
    const userId = req.user.id;

    // Check if user already has a subscription to this strategy
    const existing = await prisma.subscription.findFirst({
      where: {
        userId,
        strategyId
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have a subscription to this strategy'
      });
    }

    // Get strategy details
    const strategy = await prisma.strategy.findUnique({
      where: { id: strategyId },
      select: { monthlyPrice: true, name: true }
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategy not found'
      });
    }

    // Calculate trial end date
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    // Create trial subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        strategyId,
        status: 'ACTIVE',
        monthlyPrice: strategy.monthlyPrice,
        isFree: true,
        isTrial: true,
        trialDays,
        trialEndsAt,
        startDate: new Date(),
        endDate: trialEndsAt
      },
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
            description: true,
            provider: {
              select: {
                username: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      message: `${trialDays}-day free trial started successfully`,
      subscription
    });

  } catch (error) {
    console.error('Error starting trial:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start trial',
      error: error.message
    });
  }
});

/**
 * POST /api/trials/convert/:subscriptionId
 * Convert a trial subscription to paid
 */
router.post('/convert/:subscriptionId', authenticate, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user.id;

    // Get subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
        isTrial: true
      },
      include: {
        strategy: true
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Trial subscription not found'
      });
    }

    if (subscription.convertedFromTrial) {
      return res.status(400).json({
        success: false,
        message: 'This trial has already been converted'
      });
    }

    // Convert to paid subscription
    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        isTrial: false,
        isFree: false,
        convertedFromTrial: true,
        trialConvertedAt: new Date(),
        status: 'ACTIVE',
        // Set new end date (1 month from now)
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      include: {
        strategy: {
          select: {
            name: true,
            monthlyPrice: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Trial converted to paid subscription successfully',
      subscription: updated
    });

  } catch (error) {
    console.error('Error converting trial:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert trial',
      error: error.message
    });
  }
});

/**
 * GET /api/trials/check-expired
 * Check and expire trials (should be called by cron job)
 */
router.get('/check-expired', async (req, res) => {
  try {
    const now = new Date();

    // Find all active trial subscriptions that have expired
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        isTrial: true,
        status: 'ACTIVE',
        trialEndsAt: {
          lte: now
        }
      }
    });

    // Expire them
    const results = await Promise.all(
      expiredTrials.map(trial =>
        prisma.subscription.update({
          where: { id: trial.id },
          data: {
            status: 'EXPIRED',
            endDate: now
          }
        })
      )
    );

    res.json({
      success: true,
      message: `Expired ${results.length} trial subscriptions`,
      count: results.length
    });

  } catch (error) {
    console.error('Error checking expired trials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check expired trials',
      error: error.message
    });
  }
});

/**
 * GET /api/trials/status/:subscriptionId
 * Get trial status for a subscription
 */
router.get('/status/:subscriptionId', authenticate, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user.id;

    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId
      },
      select: {
        id: true,
        isTrial: true,
        trialEndsAt: true,
        trialDays: true,
        convertedFromTrial: true,
        status: true
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Calculate days remaining
    let daysRemaining = 0;
    if (subscription.isTrial && subscription.trialEndsAt) {
      const now = new Date();
      const diffTime = subscription.trialEndsAt - now;
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    res.json({
      success: true,
      trial: {
        ...subscription,
        daysRemaining,
        isExpired: subscription.isTrial && daysRemaining === 0
      }
    });

  } catch (error) {
    console.error('Error getting trial status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trial status',
      error: error.message
    });
  }
});

module.exports = router;
