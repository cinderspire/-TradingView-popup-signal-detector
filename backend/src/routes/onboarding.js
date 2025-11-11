const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const onboardingService = require('../services/onboardingService');

// All onboarding routes require authentication
router.use(authenticate);

/**
 * GET /api/onboarding/progress
 * Get user's onboarding progress
 */
router.get('/progress', async (req, res) => {
    try {
        const progress = await onboardingService.getProgress(req.user.id);

        if (!progress) {
            return res.json({
                success: true,
                data: {
                    onboarding: null,
                    message: 'Onboarding not initialized'
                }
            });
        }

        res.json({
            success: true,
            data: progress
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/onboarding/initialize
 * Initialize onboarding for current user
 */
router.post('/initialize', async (req, res) => {
    try {
        const { userType = 'trader' } = req.body;

        // Check if onboarding already exists
        const existing = await onboardingService.getProgress(req.user.id);
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Onboarding already initialized'
            });
        }

        const onboarding = await onboardingService.initializeOnboarding(req.user.id, userType);

        res.status(201).json({
            success: true,
            message: 'Onboarding initialized successfully',
            data: { onboarding }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/onboarding/step/:stepId/complete
 * Mark a specific step as completed
 */
router.post('/step/:stepId/complete', async (req, res) => {
    try {
        const { stepId } = req.params;

        const step = await onboardingService.completeStep(req.user.id, stepId);

        if (!step) {
            return res.status(404).json({
                success: false,
                error: 'Step not found or already completed'
            });
        }

        // Get updated progress
        const progress = await onboardingService.getProgress(req.user.id);

        res.json({
            success: true,
            message: 'Step completed successfully',
            data: {
                step,
                progress: progress.onboarding
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
 * POST /api/onboarding/skip
 * Skip the onboarding process
 */
router.post('/skip', async (req, res) => {
    try {
        await onboardingService.skipOnboarding(req.user.id);

        res.json({
            success: true,
            message: 'Onboarding skipped'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/onboarding/steps
 * Get all available onboarding steps for user type
 */
router.get('/steps', async (req, res) => {
    try {
        const { userType = 'trader' } = req.query;

        const steps = onboardingService.onboardingSteps[userType] || onboardingService.onboardingSteps.trader;

        res.json({
            success: true,
            data: {
                userType,
                steps
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
