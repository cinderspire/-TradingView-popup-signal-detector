/**
 * USER ONBOARDING SERVICE
 *
 * Manages user onboarding flow with:
 * - Step-by-step onboarding checklist
 * - Progress tracking
 * - Welcome email sequence
 * - Interactive tutorials
 * - Feature discovery
 * - Personalized setup wizard
 */

const logger = require('../utils/logger');
const emailService = require('../utils/emailService');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class OnboardingService {
    constructor() {
        // Onboarding steps for different user types
        this.onboardingSteps = {
            trader: [
                {
                    id: 'welcome',
                    title: 'Welcome to AutomatedTradeBot',
                    description: 'Learn about the platform and its features',
                    action: 'watch_intro',
                    order: 1,
                    required: false
                },
                {
                    id: 'verify_email',
                    title: 'Verify Your Email',
                    description: 'Confirm your email address to secure your account',
                    action: 'verify_email',
                    order: 2,
                    required: true
                },
                {
                    id: 'complete_profile',
                    title: 'Complete Your Profile',
                    description: 'Add your trading preferences and experience level',
                    action: 'edit_profile',
                    order: 3,
                    required: false
                },
                {
                    id: 'browse_providers',
                    title: 'Explore Signal Providers',
                    description: 'Discover top-performing trading signal providers',
                    action: 'browse_providers',
                    order: 4,
                    required: false
                },
                {
                    id: 'first_subscription',
                    title: 'Subscribe to Your First Provider',
                    description: 'Subscribe to a provider for $3/month',
                    action: 'subscribe_provider',
                    order: 5,
                    required: false
                },
                {
                    id: 'setup_copy_trading',
                    title: 'Set Up Copy Trading (Optional)',
                    description: 'Configure automated copy trading with risk management',
                    action: 'configure_copy_trading',
                    order: 6,
                    required: false
                },
                {
                    id: 'add_exchange_keys',
                    title: 'Connect Exchange Account (Optional)',
                    description: 'Add API keys for automated trading',
                    action: 'add_api_keys',
                    order: 7,
                    required: false
                }
            ],
            provider: [
                {
                    id: 'welcome',
                    title: 'Welcome Signal Provider!',
                    description: 'Learn how to create and manage trading signals',
                    action: 'watch_provider_intro',
                    order: 1,
                    required: false
                },
                {
                    id: 'verify_email',
                    title: 'Verify Your Email',
                    description: 'Confirm your email address',
                    action: 'verify_email',
                    order: 2,
                    required: true
                },
                {
                    id: 'setup_provider_profile',
                    title: 'Create Provider Profile',
                    description: 'Set up your trading profile and description',
                    action: 'setup_provider',
                    order: 3,
                    required: true
                },
                {
                    id: 'create_strategy',
                    title: 'Create Your First Strategy',
                    description: 'Define your trading strategy and parameters',
                    action: 'create_strategy',
                    order: 4,
                    required: false
                },
                {
                    id: 'run_backtest',
                    title: 'Backtest Your Strategy',
                    description: 'Test your strategy on historical data',
                    action: 'run_backtest',
                    order: 5,
                    required: false
                },
                {
                    id: 'paper_trade',
                    title: 'Start Paper Trading',
                    description: 'Test your strategy in real-time without real money',
                    action: 'start_paper_trading',
                    order: 6,
                    required: false
                },
                {
                    id: 'publish_first_signal',
                    title: 'Publish Your First Signal',
                    description: 'Create and publish a trading signal',
                    action: 'create_signal',
                    order: 7,
                    required: false
                },
                {
                    id: 'setup_tradingview',
                    title: 'Connect TradingView (Optional)',
                    description: 'Integrate with TradingView for automated signals',
                    action: 'configure_tradingview',
                    order: 8,
                    required: false
                }
            ]
        };

        // Welcome email sequence (drip campaign)
        this.emailSequence = {
            trader: [
                {
                    day: 0,
                    template: 'welcome',
                    subject: 'Welcome to AutomatedTradeBot! 🚀'
                },
                {
                    day: 1,
                    template: 'onboarding_day1',
                    subject: 'How to Find the Best Signal Providers'
                },
                {
                    day: 3,
                    template: 'onboarding_day3',
                    subject: 'Understanding Copy Trading & Risk Management'
                },
                {
                    day: 7,
                    template: 'onboarding_day7',
                    subject: 'Your First Week - Tips for Success'
                }
            ],
            provider: [
                {
                    day: 0,
                    template: 'welcome_provider',
                    subject: 'Welcome Provider! Start Earning Today 💰'
                },
                {
                    day: 1,
                    template: 'provider_onboarding_day1',
                    subject: 'Creating High-Quality Trading Signals'
                },
                {
                    day: 3,
                    template: 'provider_onboarding_day3',
                    subject: 'Growing Your Subscriber Base'
                },
                {
                    day: 7,
                    template: 'provider_onboarding_day7',
                    subject: 'Best Practices for Signal Providers'
                }
            ]
        };
    }

    /**
     * Initialize onboarding for a new user
     */
    async initializeOnboarding(userId, userType = 'trader') {
        try {
            const steps = this.onboardingSteps[userType] || this.onboardingSteps.trader;

            // Create onboarding record
            const onboarding = await prisma.userOnboarding.create({
                data: {
                    userId,
                    userType,
                    currentStep: 0,
                    totalSteps: steps.length,
                    completedSteps: [],
                    startedAt: new Date()
                }
            });

            // Create step records
            for (const step of steps) {
                await prisma.onboardingStep.create({
                    data: {
                        onboardingId: onboarding.id,
                        stepId: step.id,
                        title: step.title,
                        description: step.description,
                        action: step.action,
                        order: step.order,
                        required: step.required,
                        completed: false
                    }
                });
            }

            // Send welcome email
            await this.sendWelcomeEmail(userId, userType);

            // Schedule email sequence
            await this.scheduleEmailSequence(userId, userType);

            logger.info(`Onboarding initialized for user ${userId} (${userType})`);

            return onboarding;
        } catch (error) {
            logger.error('Failed to initialize onboarding:', error);
            throw error;
        }
    }

    /**
     * Send welcome email
     */
    async sendWelcomeEmail(userId, userType) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                throw new Error('User not found');
            }

            const template = userType === 'provider' ? 'welcome_provider' : 'welcome';

            await emailService.sendTemplateEmail(template, user.email, {
                firstName: user.firstName || user.username,
                username: user.username
            });

            logger.info(`Welcome email sent to ${user.email}`);
        } catch (error) {
            logger.error('Failed to send welcome email:', error);
        }
    }

    /**
     * Schedule email sequence for user
     */
    async scheduleEmailSequence(userId, userType) {
        try {
            const sequence = this.emailSequence[userType] || this.emailSequence.trader;

            for (const email of sequence) {
                const scheduledDate = new Date();
                scheduledDate.setDate(scheduledDate.getDate() + email.day);

                await prisma.scheduledEmail.create({
                    data: {
                        userId,
                        template: email.template,
                        subject: email.subject,
                        scheduledFor: scheduledDate,
                        sent: email.day === 0 // First email already sent
                    }
                });
            }

            logger.info(`Email sequence scheduled for user ${userId}`);
        } catch (error) {
            logger.error('Failed to schedule email sequence:', error);
        }
    }

    /**
     * Complete an onboarding step
     */
    async completeStep(userId, stepId) {
        try {
            const onboarding = await prisma.userOnboarding.findFirst({
                where: { userId },
                include: { steps: true }
            });

            if (!onboarding) {
                logger.warn(`No onboarding found for user ${userId}`);
                return null;
            }

            // Find and update step
            const step = await prisma.onboardingStep.findFirst({
                where: {
                    onboardingId: onboarding.id,
                    stepId
                }
            });

            if (!step) {
                logger.warn(`Step ${stepId} not found for user ${userId}`);
                return null;
            }

            if (step.completed) {
                logger.info(`Step ${stepId} already completed for user ${userId}`);
                return step;
            }

            // Mark step as completed
            await prisma.onboardingStep.update({
                where: { id: step.id },
                data: {
                    completed: true,
                    completedAt: new Date()
                }
            });

            // Update onboarding progress
            const completedSteps = onboarding.completedSteps || [];
            completedSteps.push(stepId);

            const progress = (completedSteps.length / onboarding.totalSteps) * 100;
            const allCompleted = completedSteps.length === onboarding.totalSteps;

            await prisma.userOnboarding.update({
                where: { id: onboarding.id },
                data: {
                    completedSteps,
                    currentStep: completedSteps.length,
                    progress,
                    completed: allCompleted,
                    completedAt: allCompleted ? new Date() : null
                }
            });

            logger.info(`Step ${stepId} completed for user ${userId}. Progress: ${progress.toFixed(1)}%`);

            // If onboarding completed, send congratulations email
            if (allCompleted) {
                await this.sendCompletionEmail(userId, onboarding.userType);
            }

            return step;
        } catch (error) {
            logger.error('Failed to complete onboarding step:', error);
            throw error;
        }
    }

    /**
     * Send onboarding completion email
     */
    async sendCompletionEmail(userId, userType) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                return;
            }

            await emailService.sendEmail({
                to: user.email,
                subject: '🎉 Congratulations! Onboarding Complete',
                html: `
                    <h2 style="color: #667eea;">Congratulations, ${user.firstName || user.username}!</h2>
                    <p>You've completed the onboarding process and are now ready to ${userType === 'provider' ? 'start earning from your trading signals' : 'discover profitable trading signals'}!</p>
                    <p>Here's what you can do next:</p>
                    <ul>
                        ${userType === 'provider' ? `
                            <li>Publish more trading signals</li>
                            <li>Optimize your strategies</li>
                            <li>Grow your subscriber base</li>
                            <li>Track your revenue in the dashboard</li>
                        ` : `
                            <li>Subscribe to more providers</li>
                            <li>Set up copy trading</li>
                            <li>Monitor your performance</li>
                            <li>Explore new strategies</li>
                        `}
                    </ul>
                    <p>If you have any questions, our support team is here to help!</p>
                    <p>Happy trading!</p>
                `
            });

            logger.info(`Completion email sent to ${user.email}`);
        } catch (error) {
            logger.error('Failed to send completion email:', error);
        }
    }

    /**
     * Get onboarding progress for user
     */
    async getProgress(userId) {
        try {
            const onboarding = await prisma.userOnboarding.findFirst({
                where: { userId },
                include: {
                    steps: {
                        orderBy: { order: 'asc' }
                    }
                }
            });

            if (!onboarding) {
                return null;
            }

            return {
                onboarding: {
                    id: onboarding.id,
                    userType: onboarding.userType,
                    currentStep: onboarding.currentStep,
                    totalSteps: onboarding.totalSteps,
                    progress: onboarding.progress,
                    completed: onboarding.completed,
                    startedAt: onboarding.startedAt,
                    completedAt: onboarding.completedAt
                },
                steps: onboarding.steps.map(step => ({
                    id: step.stepId,
                    title: step.title,
                    description: step.description,
                    action: step.action,
                    order: step.order,
                    required: step.required,
                    completed: step.completed,
                    completedAt: step.completedAt
                }))
            };
        } catch (error) {
            logger.error('Failed to get onboarding progress:', error);
            throw error;
        }
    }

    /**
     * Skip onboarding (user can skip optional steps)
     */
    async skipOnboarding(userId) {
        try {
            const onboarding = await prisma.userOnboarding.findFirst({
                where: { userId }
            });

            if (!onboarding) {
                return null;
            }

            await prisma.userOnboarding.update({
                where: { id: onboarding.id },
                data: {
                    completed: true,
                    skipped: true,
                    completedAt: new Date()
                }
            });

            logger.info(`Onboarding skipped for user ${userId}`);

            return true;
        } catch (error) {
            logger.error('Failed to skip onboarding:', error);
            throw error;
        }
    }

    /**
     * Send scheduled emails (to be called by cron job)
     */
    async sendScheduledEmails() {
        try {
            const now = new Date();

            const emails = await prisma.scheduledEmail.findMany({
                where: {
                    sent: false,
                    scheduledFor: {
                        lte: now
                    }
                },
                include: {
                    user: true
                }
            });

            logger.info(`Found ${emails.length} scheduled emails to send`);

            for (const email of emails) {
                try {
                    await emailService.sendTemplateEmail(
                        email.template,
                        email.user.email,
                        {
                            firstName: email.user.firstName || email.user.username,
                            username: email.user.username
                        }
                    );

                    await prisma.scheduledEmail.update({
                        where: { id: email.id },
                        data: {
                            sent: true,
                            sentAt: new Date()
                        }
                    });

                    logger.info(`Sent scheduled email ${email.template} to ${email.user.email}`);
                } catch (error) {
                    logger.error(`Failed to send scheduled email ${email.id}:`, error);
                }
            }

            return emails.length;
        } catch (error) {
            logger.error('Failed to send scheduled emails:', error);
            throw error;
        }
    }

    /**
     * Get onboarding statistics
     */
    async getStatistics() {
        try {
            const [
                totalOnboardings,
                completedOnboardings,
                skippedOnboardings,
                avgProgress,
                traderOnboardings,
                providerOnboardings
            ] = await Promise.all([
                prisma.userOnboarding.count(),
                prisma.userOnboarding.count({ where: { completed: true, skipped: false } }),
                prisma.userOnboarding.count({ where: { skipped: true } }),
                prisma.userOnboarding.aggregate({
                    _avg: { progress: true }
                }),
                prisma.userOnboarding.count({ where: { userType: 'trader' } }),
                prisma.userOnboarding.count({ where: { userType: 'provider' } })
            ]);

            return {
                total: totalOnboardings,
                completed: completedOnboardings,
                skipped: skippedOnboardings,
                inProgress: totalOnboardings - completedOnboardings - skippedOnboardings,
                completionRate: totalOnboardings > 0 ? (completedOnboardings / totalOnboardings) * 100 : 0,
                avgProgress: avgProgress._avg.progress || 0,
                byType: {
                    trader: traderOnboardings,
                    provider: providerOnboardings
                }
            };
        } catch (error) {
            logger.error('Failed to get onboarding statistics:', error);
            throw error;
        }
    }
}

// Export singleton instance
const onboardingService = new OnboardingService();
module.exports = onboardingService;
