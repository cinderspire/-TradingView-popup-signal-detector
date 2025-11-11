const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const analyticsService = require('../services/analyticsService');

// Authentication middleware
router.use(authenticate);

/**
 * GET /api/analytics/overview
 * Get platform overview metrics
 */
router.get('/overview', async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        const overview = await analyticsService.getPlatformOverview(period);

        res.json({
            success: true,
            data: overview
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/user-growth
 * Get user growth analytics
 */
router.get('/user-growth', async (req, res) => {
    try {
        const { period = '30d', interval = 'day' } = req.query;

        const growth = await analyticsService.getUserGrowth(period, interval);

        res.json({
            success: true,
            data: growth
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/revenue
 * Get revenue analytics
 */
router.get('/revenue', async (req, res) => {
    try {
        const { period = '30d', interval = 'day' } = req.query;

        const revenue = await analyticsService.getRevenueAnalytics(period, interval);

        res.json({
            success: true,
            data: revenue
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/signal-performance
 * Get signal performance analytics
 */
router.get('/signal-performance', async (req, res) => {
    try {
        const { providerId, period = '30d' } = req.query;

        // If querying for specific provider, verify access
        if (providerId && providerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const performance = await analyticsService.getSignalPerformance(providerId, period);

        res.json({
            success: true,
            data: performance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/subscriptions
 * Get subscription analytics
 */
router.get('/subscriptions', async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        const subscriptions = await analyticsService.getSubscriptionAnalytics(period);

        res.json({
            success: true,
            data: subscriptions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/leaderboard
 * Get provider leaderboard
 */
router.get('/leaderboard', async (req, res) => {
    try {
        const { metric = 'subscribers', limit = 20 } = req.query;

        const leaderboard = await analyticsService.getProviderLeaderboard(metric, parseInt(limit));

        res.json({
            success: true,
            data: {
                leaderboard,
                metric
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/analytics/clear-cache
 * Clear analytics cache (Admin only)
 */
router.post('/clear-cache', authorize(['ADMIN']), async (req, res) => {
    try {
        analyticsService.clearCache();

        res.json({
            success: true,
            message: 'Analytics cache cleared'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
