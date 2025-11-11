/**
 * SUBSCRIPTION & PAYMENT SERVICE
 * Handles all subscription management, payments, and revenue sharing
 * $3/month default pricing with 70/30 revenue split
 */

const { PrismaClient } = require('@prisma/client');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class SubscriptionService {
    constructor() {
        this.DEFAULT_PRICE = 3.00; // $3/month
        this.REVENUE_SHARE_PROVIDER = 0.70; // 70% to provider
        this.REVENUE_SHARE_PLATFORM = 0.30; // 30% to platform
        this.FREE_TRIAL_DAYS = 7;
        this.SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'];

        // Stripe price IDs (would be created in Stripe Dashboard)
        this.STRIPE_PRICES = {
            monthly: process.env.STRIPE_MONTHLY_PRICE_ID || 'price_monthly_placeholder',
            quarterly: process.env.STRIPE_QUARTERLY_PRICE_ID || 'price_quarterly_placeholder',
            yearly: process.env.STRIPE_YEARLY_PRICE_ID || 'price_yearly_placeholder'
        };
    }

    /**
     * Create new subscription
     */
    async createSubscription(userId, providerId, options = {}) {
        const {
            strategyId,
            interval = 'MONTHLY',
            paymentMethodId,
            enableCopyTrading = false,
            maxPositionSize = 0.1,
            scaleFactor = 1.0
        } = options;

        try {
            // Get user and provider details
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            const provider = await prisma.provider.findUnique({
                where: { id: providerId },
                include: {
                    strategies: strategyId ? {
                        where: { id: strategyId }
                    } : true
                }
            });

            if (!user || !provider) {
                throw new Error('User or provider not found');
            }

            // Check if already subscribed
            const existingSubscription = await prisma.subscription.findFirst({
                where: {
                    userId,
                    strategyId: strategyId || provider.strategies[0]?.id,
                    status: 'ACTIVE'
                }
            });

            if (existingSubscription) {
                throw new Error('Already subscribed to this strategy');
            }

            // Determine pricing
            const strategy = strategyId
                ? provider.strategies.find(s => s.id === strategyId)
                : provider.strategies[0];

            const monthlyPrice = strategy?.monthlyPrice || provider.subscriptionPrice || this.DEFAULT_PRICE;
            const price = this.calculatePrice(monthlyPrice, interval);

            // Check if free trial eligible
            const isTrialEligible = await this.checkTrialEligibility(userId, providerId);
            const trialEnd = isTrialEligible
                ? new Date(Date.now() + this.FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000)
                : null;

            // Create Stripe customer if not exists
            let stripeCustomerId = user.stripeCustomerId;
            if (!stripeCustomerId) {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    metadata: {
                        userId: user.id
                    }
                });
                stripeCustomerId = customer.id;

                // Update user with Stripe customer ID
                await prisma.user.update({
                    where: { id: userId },
                    data: { stripeCustomerId }
                });
            }

            // Attach payment method if provided
            if (paymentMethodId) {
                await stripe.paymentMethods.attach(paymentMethodId, {
                    customer: stripeCustomerId
                });

                // Set as default payment method
                await stripe.customers.update(stripeCustomerId, {
                    invoice_settings: {
                        default_payment_method: paymentMethodId
                    }
                });
            }

            // Create Stripe subscription
            const stripeSubscription = await stripe.subscriptions.create({
                customer: stripeCustomerId,
                items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${provider.displayName} - ${strategy?.name || 'Trading Signals'}`,
                            metadata: {
                                providerId,
                                strategyId: strategy?.id
                            }
                        },
                        unit_amount: Math.round(price * 100), // Stripe uses cents
                        recurring: {
                            interval: interval.toLowerCase()
                        }
                    }
                }],
                trial_end: trialEnd ? Math.floor(trialEnd.getTime() / 1000) : undefined,
                metadata: {
                    userId,
                    providerId,
                    strategyId: strategy?.id,
                    revenueShare: this.REVENUE_SHARE_PROVIDER
                },
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent']
            });

            // Calculate dates
            const startDate = new Date();
            const endDate = this.calculateEndDate(startDate, interval);

            // Create subscription in database
            const subscription = await prisma.subscription.create({
                data: {
                    userId,
                    strategyId: strategy?.id,
                    status: stripeSubscription.status === 'active' ? 'ACTIVE' : 'PENDING',
                    tier: 'BASIC',
                    price,
                    interval,
                    copyTradingEnabled: enableCopyTrading,
                    maxPositionSize,
                    scaleFactor,
                    isTrialing: isTrialEligible,
                    trialEndsAt: trialEnd,
                    startDate,
                    endDate,
                    nextBillingDate: endDate,
                    stripeSubscriptionId: stripeSubscription.id
                },
                include: {
                    strategy: {
                        include: {
                            provider: true
                        }
                    }
                }
            });

            // Send confirmation notifications
            await this.sendSubscriptionConfirmation(user, subscription);

            // Notify provider of new subscriber
            await this.notifyProviderNewSubscriber(provider, user);

            logger.info(`New subscription created: User ${userId} subscribed to provider ${providerId}`);

            return {
                success: true,
                subscription,
                stripeSubscription,
                clientSecret: stripeSubscription.latest_invoice?.payment_intent?.client_secret,
                message: isTrialEligible
                    ? `Subscribed successfully! Your ${this.FREE_TRIAL_DAYS}-day free trial has started.`
                    : 'Subscribed successfully!'
            };
        } catch (error) {
            logger.error('Create subscription error:', error);
            throw error;
        }
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionId, userId, reason) {
        try {
            const subscription = await prisma.subscription.findFirst({
                where: {
                    id: subscriptionId,
                    userId
                },
                include: {
                    strategy: {
                        include: {
                            provider: true
                        }
                    }
                }
            });

            if (!subscription) {
                throw new Error('Subscription not found');
            }

            // Cancel Stripe subscription
            if (subscription.stripeSubscriptionId) {
                await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
                    cancel_at_period_end: true,
                    cancellation_details: {
                        comment: reason
                    }
                });
            }

            // Update subscription status
            const updatedSubscription = await prisma.subscription.update({
                where: { id: subscriptionId },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    cancellationReason: reason
                }
            });

            // Notify provider
            await this.notifyProviderSubscriberLost(
                subscription.strategy.provider,
                subscription.user
            );

            logger.info(`Subscription cancelled: ${subscriptionId}`);

            return {
                success: true,
                subscription: updatedSubscription,
                message: 'Subscription cancelled successfully'
            };
        } catch (error) {
            logger.error('Cancel subscription error:', error);
            throw error;
        }
    }

    /**
     * Pause subscription
     */
    async pauseSubscription(subscriptionId, userId, duration = 30) {
        try {
            const subscription = await prisma.subscription.findFirst({
                where: {
                    id: subscriptionId,
                    userId,
                    status: 'ACTIVE'
                }
            });

            if (!subscription) {
                throw new Error('Active subscription not found');
            }

            // Pause Stripe subscription
            if (subscription.stripeSubscriptionId) {
                await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
                    pause_collection: {
                        behavior: 'mark_uncollectible',
                        resumes_at: Math.floor((Date.now() + duration * 24 * 60 * 60 * 1000) / 1000)
                    }
                });
            }

            // Update subscription
            const pausedUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
            const updatedSubscription = await prisma.subscription.update({
                where: { id: subscriptionId },
                data: {
                    status: 'PAUSED',
                    pausedAt: new Date(),
                    resumesAt: pausedUntil
                }
            });

            logger.info(`Subscription paused: ${subscriptionId} for ${duration} days`);

            return {
                success: true,
                subscription: updatedSubscription,
                message: `Subscription paused for ${duration} days`
            };
        } catch (error) {
            logger.error('Pause subscription error:', error);
            throw error;
        }
    }

    /**
     * Resume paused subscription
     */
    async resumeSubscription(subscriptionId, userId) {
        try {
            const subscription = await prisma.subscription.findFirst({
                where: {
                    id: subscriptionId,
                    userId,
                    status: 'PAUSED'
                }
            });

            if (!subscription) {
                throw new Error('Paused subscription not found');
            }

            // Resume Stripe subscription
            if (subscription.stripeSubscriptionId) {
                await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
                    pause_collection: null
                });
            }

            // Update subscription
            const updatedSubscription = await prisma.subscription.update({
                where: { id: subscriptionId },
                data: {
                    status: 'ACTIVE',
                    pausedAt: null,
                    resumesAt: null
                }
            });

            logger.info(`Subscription resumed: ${subscriptionId}`);

            return {
                success: true,
                subscription: updatedSubscription,
                message: 'Subscription resumed successfully'
            };
        } catch (error) {
            logger.error('Resume subscription error:', error);
            throw error;
        }
    }

    /**
     * Process subscription payment
     */
    async processPayment(stripeEvent) {
        try {
            const { type, data } = stripeEvent;

            switch (type) {
                case 'invoice.payment_succeeded':
                    await this.handlePaymentSuccess(data.object);
                    break;

                case 'invoice.payment_failed':
                    await this.handlePaymentFailure(data.object);
                    break;

                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdate(data.object);
                    break;

                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(data.object);
                    break;

                default:
                    logger.info(`Unhandled Stripe event: ${type}`);
            }

            return { success: true };
        } catch (error) {
            logger.error('Process payment error:', error);
            throw error;
        }
    }

    /**
     * Handle successful payment
     */
    async handlePaymentSuccess(invoice) {
        try {
            const subscriptionId = invoice.subscription;
            const amount = invoice.amount_paid / 100; // Convert from cents
            const customerId = invoice.customer;

            // Find subscription
            const subscription = await prisma.subscription.findFirst({
                where: { stripeSubscriptionId: subscriptionId },
                include: {
                    strategy: {
                        include: {
                            provider: true
                        }
                    }
                }
            });

            if (!subscription) {
                logger.warn(`Subscription not found for Stripe ID: ${subscriptionId}`);
                return;
            }

            // Calculate revenue shares
            const providerShare = amount * this.REVENUE_SHARE_PROVIDER;
            const platformShare = amount * this.REVENUE_SHARE_PLATFORM;

            // Create payment record
            const payment = await prisma.payment.create({
                data: {
                    userId: subscription.userId,
                    subscriptionId: subscription.id,
                    amount,
                    currency: 'USD',
                    status: 'SUCCESS',
                    method: 'STRIPE',
                    transactionId: invoice.id,
                    processorResponse: invoice
                }
            });

            // Update provider earnings
            await prisma.provider.update({
                where: { id: subscription.strategy.providerId },
                data: {
                    totalEarnings: { increment: providerShare },
                    pendingPayout: { increment: providerShare }
                }
            });

            // Create transaction records
            await prisma.transaction.create({
                data: {
                    userId: subscription.userId,
                    providerId: subscription.strategy.providerId,
                    type: 'SUBSCRIPTION_PAYMENT',
                    amount,
                    currency: 'USD',
                    strategyId: subscription.strategyId,
                    subscriptionId: subscription.id,
                    paymentId: payment.id,
                    status: 'completed',
                    metadata: {
                        providerShare,
                        platformShare,
                        invoice: invoice.id
                    }
                }
            });

            // Update subscription dates
            const nextBillingDate = new Date(invoice.period_end * 1000);
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    lastPaymentId: payment.id,
                    nextBillingDate,
                    failedPayments: 0,
                    status: 'ACTIVE'
                }
            });

            logger.info(`Payment processed successfully: $${amount} for subscription ${subscription.id}`);
        } catch (error) {
            logger.error('Handle payment success error:', error);
            throw error;
        }
    }

    /**
     * Handle failed payment
     */
    async handlePaymentFailure(invoice) {
        try {
            const subscriptionId = invoice.subscription;

            // Find subscription
            const subscription = await prisma.subscription.findFirst({
                where: { stripeSubscriptionId: subscriptionId }
            });

            if (!subscription) {
                logger.warn(`Subscription not found for Stripe ID: ${subscriptionId}`);
                return;
            }

            // Increment failed payment count
            const failedPayments = subscription.failedPayments + 1;

            // Update subscription
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    failedPayments,
                    status: failedPayments >= 3 ? 'EXPIRED' : subscription.status
                }
            });

            // Send payment failure notification
            await this.sendPaymentFailureNotification(subscription);

            logger.warn(`Payment failed for subscription ${subscription.id}, attempt ${failedPayments}`);
        } catch (error) {
            logger.error('Handle payment failure error:', error);
            throw error;
        }
    }

    /**
     * Get user subscriptions
     */
    async getUserSubscriptions(userId) {
        try {
            const subscriptions = await prisma.subscription.findMany({
                where: { userId },
                include: {
                    strategy: {
                        include: {
                            provider: {
                                include: {
                                    user: {
                                        select: {
                                            username: true,
                                            avatar: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    payments: {
                        orderBy: { createdAt: 'desc' },
                        take: 5
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            // Calculate statistics for each subscription
            const subscriptionsWithStats = await Promise.all(
                subscriptions.map(async (subscription) => {
                    const stats = await this.calculateSubscriptionStats(subscription.id);
                    return {
                        ...subscription,
                        stats
                    };
                })
            );

            return {
                success: true,
                subscriptions: subscriptionsWithStats
            };
        } catch (error) {
            logger.error('Get user subscriptions error:', error);
            throw error;
        }
    }

    /**
     * Calculate subscription statistics
     */
    async calculateSubscriptionStats(subscriptionId) {
        try {
            const subscription = await prisma.subscription.findUnique({
                where: { id: subscriptionId }
            });

            if (!subscription) return null;

            // Get trades made using this subscription
            const trades = await prisma.trade.findMany({
                where: {
                    userId: subscription.userId,
                    signal: {
                        strategyId: subscription.strategyId
                    },
                    createdAt: {
                        gte: subscription.startDate
                    }
                }
            });

            // Calculate metrics
            const totalTrades = trades.length;
            const profitableTrades = trades.filter(t => t.realizedPnl > 0).length;
            const totalPnl = trades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
            const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

            // Calculate ROI
            const totalInvested = subscription.price *
                Math.floor((Date.now() - subscription.startDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
            const roi = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

            return {
                totalTrades,
                profitableTrades,
                winRate,
                totalPnl,
                roi,
                activeDays: Math.floor((Date.now() - subscription.startDate.getTime()) / (24 * 60 * 60 * 1000))
            };
        } catch (error) {
            logger.error('Calculate subscription stats error:', error);
            return null;
        }
    }

    /**
     * Check trial eligibility
     */
    async checkTrialEligibility(userId, providerId) {
        try {
            // Check if user has ever had a trial for this provider
            const previousTrial = await prisma.subscription.findFirst({
                where: {
                    userId,
                    strategy: {
                        providerId
                    },
                    isTrialing: true
                }
            });

            return !previousTrial;
        } catch (error) {
            logger.error('Check trial eligibility error:', error);
            return false;
        }
    }

    /**
     * Calculate price based on interval
     */
    calculatePrice(monthlyPrice, interval) {
        const multipliers = {
            MONTHLY: 1,
            QUARTERLY: 2.7, // 10% discount
            YEARLY: 10 // 17% discount (2 months free)
        };

        return monthlyPrice * (multipliers[interval] || 1);
    }

    /**
     * Calculate end date based on interval
     */
    calculateEndDate(startDate, interval) {
        const date = new Date(startDate);

        switch (interval) {
            case 'MONTHLY':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'QUARTERLY':
                date.setMonth(date.getMonth() + 3);
                break;
            case 'YEARLY':
                date.setFullYear(date.getFullYear() + 1);
                break;
        }

        return date;
    }

    /**
     * Process provider payouts
     */
    async processProviderPayouts() {
        try {
            // Get providers with pending payouts > $100
            const providers = await prisma.provider.findMany({
                where: {
                    pendingPayout: {
                        gte: 100 // Minimum payout threshold
                    }
                }
            });

            for (const provider of providers) {
                await this.createProviderPayout(provider);
            }

            logger.info(`Processed payouts for ${providers.length} providers`);

            return {
                success: true,
                processedCount: providers.length
            };
        } catch (error) {
            logger.error('Process provider payouts error:', error);
            throw error;
        }
    }

    /**
     * Create provider payout
     */
    async createProviderPayout(provider) {
        try {
            const amount = provider.pendingPayout;

            // Create payout record
            const payout = await prisma.payout.create({
                data: {
                    providerId: provider.id,
                    amount,
                    currency: 'USD',
                    status: 'PENDING',
                    method: 'STRIPE', // or 'BANK', 'CRYPTO'
                    periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    periodEnd: new Date(),
                    subscriptionRevenue: amount,
                    netAmount: amount
                }
            });

            // Process payout via Stripe Connect (simplified)
            // In production, would use Stripe Connect for actual transfers

            // Update provider
            await prisma.provider.update({
                where: { id: provider.id },
                data: {
                    pendingPayout: 0,
                    totalPaidOut: { increment: amount }
                }
            });

            // Update payout status
            await prisma.payout.update({
                where: { id: payout.id },
                data: {
                    status: 'COMPLETED',
                    processedAt: new Date(),
                    completedAt: new Date()
                }
            });

            logger.info(`Payout of $${amount} processed for provider ${provider.id}`);

            return payout;
        } catch (error) {
            logger.error('Create provider payout error:', error);
            throw error;
        }
    }

    /**
     * Send subscription confirmation email
     */
    async sendSubscriptionConfirmation(user, subscription) {
        // Implementation would send actual email
        logger.info(`Subscription confirmation sent to ${user.email}`);
    }

    /**
     * Notify provider of new subscriber
     */
    async notifyProviderNewSubscriber(provider, user) {
        // Implementation would send notification
        logger.info(`New subscriber notification sent to provider ${provider.id}`);
    }

    /**
     * Notify provider of lost subscriber
     */
    async notifyProviderSubscriberLost(provider, user) {
        // Implementation would send notification
        logger.info(`Lost subscriber notification sent to provider ${provider.id}`);
    }

    /**
     * Send payment failure notification
     */
    async sendPaymentFailureNotification(subscription) {
        // Implementation would send notification
        logger.info(`Payment failure notification sent for subscription ${subscription.id}`);
    }
}

// Export singleton instance
module.exports = new SubscriptionService();