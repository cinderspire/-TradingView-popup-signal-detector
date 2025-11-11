/**
 * SIGNAL PROVIDER MANAGEMENT SERVICE
 * Core business logic for managing signal providers, strategies, and performance
 * 70/30 revenue sharing model (70% to providers)
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const realDataService = require('./realDataService');
const { calculatePerformanceMetrics } = require('../utils/metricsCalculator');

const prisma = new PrismaClient();

class ProviderService {
    constructor() {
        this.REVENUE_SHARE_PROVIDER = 0.7; // 70% to provider
        this.REVENUE_SHARE_PLATFORM = 0.3; // 30% to platform
        this.DEFAULT_SUBSCRIPTION_PRICE = 3.0; // $3/month default
        this.MIN_SUBSCRIPTION_PRICE = 1.0;
        this.MAX_SUBSCRIPTION_PRICE = 100.0;
    }

    /**
     * Register as signal provider
     */
    async registerProvider(userId, providerData) {
        const {
            displayName,
            description,
            tradingExperience,
            specialties,
            subscriptionPrice = this.DEFAULT_SUBSCRIPTION_PRICE,
            freeTrialDays = 7
        } = providerData;

        try {
            // Check if already a provider
            const existingProvider = await prisma.provider.findUnique({
                where: { userId }
            });

            if (existingProvider) {
                throw new Error('User is already registered as a provider');
            }

            // Validate subscription price
            if (subscriptionPrice < this.MIN_SUBSCRIPTION_PRICE ||
                subscriptionPrice > this.MAX_SUBSCRIPTION_PRICE) {
                throw new Error(`Subscription price must be between $${this.MIN_SUBSCRIPTION_PRICE} and $${this.MAX_SUBSCRIPTION_PRICE}`);
            }

            // Create provider profile
            const provider = await prisma.provider.create({
                data: {
                    userId,
                    displayName,
                    description,
                    tradingExperience: parseInt(tradingExperience),
                    specialties,
                    subscriptionPrice,
                    freeTrialDays,
                    revenueShare: this.REVENUE_SHARE_PROVIDER
                },
                include: {
                    user: {
                        select: {
                            email: true,
                            username: true
                        }
                    }
                }
            });

            // Update user role to PROVIDER
            await prisma.user.update({
                where: { id: userId },
                data: { role: 'PROVIDER' }
            });

            logger.info(`New provider registered: ${provider.displayName} (${userId})`);

            return {
                success: true,
                provider,
                message: 'Successfully registered as signal provider'
            };
        } catch (error) {
            logger.error('Provider registration error:', error);
            throw error;
        }
    }

    /**
     * Get provider profile with performance metrics
     */
    async getProviderProfile(providerId, includePrivate = false) {
        try {
            const provider = await prisma.provider.findUnique({
                where: { id: providerId },
                include: {
                    user: {
                        select: {
                            username: true,
                            avatar: true,
                            createdAt: true
                        }
                    },
                    strategies: {
                        where: includePrivate ? {} : { isPublic: true },
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            winRate: true,
                            totalTrades: true,
                            monthlyPrice: true,
                            isActive: true,
                            supportedPairs: true,
                            supportedTimeframes: true
                        }
                    },
                    followers: {
                        where: { isActive: true },
                        select: {
                            id: true,
                            followedAt: true
                        }
                    },
                    _count: {
                        select: {
                            signals: true,
                            strategies: true,
                            followers: true,
                            subscriptions: true
                        }
                    }
                }
            });

            if (!provider) {
                throw new Error('Provider not found');
            }

            // Calculate live performance metrics
            const performanceMetrics = await this.calculateProviderPerformance(providerId);

            // Get recent signals
            const recentSignals = await this.getRecentSignals(providerId, 10);

            // Calculate monthly revenue
            const monthlyRevenue = await this.calculateMonthlyRevenue(providerId);

            return {
                success: true,
                provider: {
                    ...provider,
                    performance: performanceMetrics,
                    recentSignals,
                    monthlyRevenue,
                    providerShare: monthlyRevenue * this.REVENUE_SHARE_PROVIDER
                }
            };
        } catch (error) {
            logger.error('Get provider profile error:', error);
            throw error;
        }
    }

    /**
     * Create new trading strategy
     */
    async createStrategy(providerId, strategyData) {
        const {
            name,
            description,
            type,
            parameters,
            supportedPairs,
            supportedTimeframes,
            monthlyPrice,
            isPublic = false
        } = strategyData;

        try {
            // Validate provider
            const provider = await prisma.provider.findUnique({
                where: { id: providerId }
            });

            if (!provider) {
                throw new Error('Provider not found');
            }

            // Create strategy
            const strategy = await prisma.strategy.create({
                data: {
                    providerId,
                    name,
                    description,
                    type,
                    parameters,
                    supportedPairs,
                    supportedTimeframes,
                    monthlyPrice: monthlyPrice || provider.subscriptionPrice,
                    isPublic,
                    category: this.categorizeStrategy(type),
                    revenueSharePercent: 100 - (this.REVENUE_SHARE_PROVIDER * 100)
                }
            });

            // Run initial backtest
            await this.runStrategyBacktest(strategy.id, supportedPairs[0], '1h');

            logger.info(`New strategy created: ${name} by provider ${providerId}`);

            return {
                success: true,
                strategy,
                message: 'Strategy created successfully'
            };
        } catch (error) {
            logger.error('Create strategy error:', error);
            throw error;
        }
    }

    /**
     * Generate trading signal
     */
    async generateSignal(providerId, signalData) {
        const {
            strategyId,
            pair,
            exchange,
            side,
            entryPrice,
            stopLoss,
            takeProfit,
            confidence,
            reasoning,
            timeframe = '1h'
        } = signalData;

        try {
            // Validate provider
            const provider = await prisma.provider.findUnique({
                where: { id: providerId }
            });

            if (!provider) {
                throw new Error('Provider not found');
            }

            // Get real-time price for validation
            const currentPrice = await realDataService.getRealPrice(pair, exchange);

            // Validate signal parameters
            this.validateSignalParameters(side, entryPrice, stopLoss, takeProfit, currentPrice.price);

            // Calculate risk metrics
            const riskMetrics = this.calculateRiskMetrics(
                entryPrice,
                stopLoss,
                takeProfit,
                side
            );

            // Get current market indicators
            const indicators = await realDataService.getMarketIndicators(pair, timeframe, exchange);

            // Create signal
            const signal = await prisma.signal.create({
                data: {
                    strategyId,
                    type: 'ENTRY',
                    status: 'PENDING',
                    pair,
                    exchange,
                    timeframe,
                    entryPrice,
                    currentPrice: currentPrice.price,
                    stopLoss,
                    takeProfit,
                    side,
                    confidence: confidence || 0.7,
                    reasoning,
                    indicators,
                    riskRewardRatio: riskMetrics.riskRewardRatio,
                    positionSize: riskMetrics.recommendedPosition,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
                },
                include: {
                    strategy: {
                        select: {
                            name: true,
                            provider: {
                                select: {
                                    displayName: true
                                }
                            }
                        }
                    }
                }
            });

            // Notify subscribers via WebSocket
            await this.notifySubscribers(providerId, signal);

            // Update provider stats
            await this.updateProviderStats(providerId, 'signal_created');

            logger.info(`Signal generated: ${pair} ${side} by provider ${providerId}`);

            return {
                success: true,
                signal,
                message: 'Signal generated and sent to subscribers'
            };
        } catch (error) {
            logger.error('Generate signal error:', error);
            throw error;
        }
    }

    /**
     * Update signal status
     */
    async updateSignal(signalId, updateData) {
        const { status, actualExitPrice, pnl, pnlPercent } = updateData;

        try {
            const signal = await prisma.signal.findUnique({
                where: { id: signalId }
            });

            if (!signal) {
                throw new Error('Signal not found');
            }

            // Update signal
            const updatedSignal = await prisma.signal.update({
                where: { id: signalId },
                data: {
                    status,
                    actualExitPrice,
                    pnl,
                    pnlPercent,
                    closedAt: status === 'CLOSED' ? new Date() : undefined
                }
            });

            // Update strategy performance if signal closed
            if (status === 'CLOSED' && pnl !== undefined) {
                await this.updateStrategyPerformance(signal.strategyId, pnl > 0);
            }

            logger.info(`Signal ${signalId} updated to status: ${status}`);

            return {
                success: true,
                signal: updatedSignal
            };
        } catch (error) {
            logger.error('Update signal error:', error);
            throw error;
        }
    }

    /**
     * Get provider's active signals
     */
    async getActiveSignals(providerId) {
        try {
            const signals = await prisma.signal.findMany({
                where: {
                    strategy: {
                        providerId
                    },
                    status: 'ACTIVE'
                },
                include: {
                    strategy: {
                        select: {
                            name: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            // Add real-time price updates
            const signalsWithPrices = await Promise.all(
                signals.map(async (signal) => {
                    const currentPrice = await realDataService.getRealPrice(
                        signal.pair,
                        signal.exchange
                    );

                    // Calculate unrealized PnL
                    const unrealizedPnl = this.calculateUnrealizedPnL(
                        signal.entryPrice,
                        currentPrice.price,
                        signal.side
                    );

                    return {
                        ...signal,
                        currentPrice: currentPrice.price,
                        unrealizedPnl,
                        unrealizedPnlPercent: (unrealizedPnl / signal.entryPrice) * 100
                    };
                })
            );

            return {
                success: true,
                signals: signalsWithPrices
            };
        } catch (error) {
            logger.error('Get active signals error:', error);
            throw error;
        }
    }

    /**
     * Get provider's followers
     */
    async getProviderFollowers(providerId, options = {}) {
        const { page = 1, limit = 50 } = options;

        try {
            const followers = await prisma.providerFollower.findMany({
                where: {
                    providerId,
                    isActive: true
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            avatar: true
                        }
                    }
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    followedAt: 'desc'
                }
            });

            const totalCount = await prisma.providerFollower.count({
                where: {
                    providerId,
                    isActive: true
                }
            });

            return {
                success: true,
                followers,
                pagination: {
                    total: totalCount,
                    page,
                    pages: Math.ceil(totalCount / limit)
                }
            };
        } catch (error) {
            logger.error('Get provider followers error:', error);
            throw error;
        }
    }

    /**
     * Calculate provider performance metrics
     */
    async calculateProviderPerformance(providerId, period = 30) {
        try {
            const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

            // Get all signals in period
            const signals = await prisma.signal.findMany({
                where: {
                    strategy: {
                        providerId
                    },
                    createdAt: {
                        gte: startDate
                    },
                    status: {
                        in: ['CLOSED', 'ACTIVE']
                    }
                }
            });

            // Calculate metrics
            const totalSignals = signals.length;
            const closedSignals = signals.filter(s => s.status === 'CLOSED');
            const profitableSignals = closedSignals.filter(s => s.pnl > 0);
            const losingSignals = closedSignals.filter(s => s.pnl < 0);

            const winRate = closedSignals.length > 0
                ? (profitableSignals.length / closedSignals.length) * 100
                : 0;

            const totalProfit = profitableSignals.reduce((sum, s) => sum + s.pnl, 0);
            const totalLoss = Math.abs(losingSignals.reduce((sum, s) => sum + s.pnl, 0));
            const netProfit = totalProfit - totalLoss;

            const avgWin = profitableSignals.length > 0
                ? totalProfit / profitableSignals.length
                : 0;

            const avgLoss = losingSignals.length > 0
                ? totalLoss / losingSignals.length
                : 0;

            const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit;

            // Calculate Sharpe ratio (simplified)
            const returns = closedSignals.map(s => s.pnlPercent || 0);
            const sharpeRatio = this.calculateSharpeRatio(returns);

            // Get best and worst trades
            const bestTrade = closedSignals.reduce((best, signal) =>
                (!best || signal.pnl > best.pnl) ? signal : best, null);

            const worstTrade = closedSignals.reduce((worst, signal) =>
                (!worst || signal.pnl < worst.pnl) ? signal : worst, null);

            return {
                period: `${period} days`,
                totalSignals,
                activeSignals: signals.filter(s => s.status === 'ACTIVE').length,
                closedSignals: closedSignals.length,
                winRate,
                profitableSignals: profitableSignals.length,
                losingSignals: losingSignals.length,
                netProfit,
                totalProfit,
                totalLoss,
                avgWin,
                avgLoss,
                profitFactor,
                sharpeRatio,
                bestTrade: bestTrade ? {
                    pair: bestTrade.pair,
                    pnl: bestTrade.pnl,
                    pnlPercent: bestTrade.pnlPercent,
                    date: bestTrade.createdAt
                } : null,
                worstTrade: worstTrade ? {
                    pair: worstTrade.pair,
                    pnl: worstTrade.pnl,
                    pnlPercent: worstTrade.pnlPercent,
                    date: worstTrade.createdAt
                } : null
            };
        } catch (error) {
            logger.error('Calculate provider performance error:', error);
            throw error;
        }
    }

    /**
     * Get recent signals
     */
    async getRecentSignals(providerId, limit = 10) {
        try {
            return await prisma.signal.findMany({
                where: {
                    strategy: {
                        providerId
                    }
                },
                select: {
                    id: true,
                    pair: true,
                    side: true,
                    status: true,
                    entryPrice: true,
                    pnl: true,
                    pnlPercent: true,
                    createdAt: true,
                    closedAt: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: limit
            });
        } catch (error) {
            logger.error('Get recent signals error:', error);
            throw error;
        }
    }

    /**
     * Calculate monthly revenue
     */
    async calculateMonthlyRevenue(providerId) {
        try {
            const activeSubscriptions = await prisma.subscription.count({
                where: {
                    strategy: {
                        providerId
                    },
                    status: 'ACTIVE'
                }
            });

            const provider = await prisma.provider.findUnique({
                where: { id: providerId },
                select: { subscriptionPrice: true }
            });

            return activeSubscriptions * (provider?.subscriptionPrice || this.DEFAULT_SUBSCRIPTION_PRICE);
        } catch (error) {
            logger.error('Calculate monthly revenue error:', error);
            return 0;
        }
    }

    /**
     * Run strategy backtest
     */
    async runStrategyBacktest(strategyId, pair, timeframe) {
        try {
            // Create backtest record
            const backtest = await prisma.backtest.create({
                data: {
                    strategyId,
                    pair,
                    exchange: 'bybit',
                    timeframe,
                    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days
                    endDate: new Date(),
                    status: 'PENDING'
                }
            });

            // This would trigger actual backtest job
            // For now, return pending status
            logger.info(`Backtest initiated for strategy ${strategyId}`);

            return backtest;
        } catch (error) {
            logger.error('Run strategy backtest error:', error);
            throw error;
        }
    }

    /**
     * Notify subscribers of new signal
     */
    async notifySubscribers(providerId, signal) {
        try {
            // Get active subscribers
            const subscribers = await prisma.subscription.findMany({
                where: {
                    strategy: {
                        providerId
                    },
                    status: 'ACTIVE'
                },
                select: {
                    userId: true
                }
            });

            // Send via WebSocket (implementation in websocket.js)
            const wsServer = require('../websocket').getWebSocketServer();
            if (wsServer) {
                subscribers.forEach(sub => {
                    wsServer.sendToUser(sub.userId, {
                        type: 'new_signal',
                        data: signal
                    });
                });
            }

            logger.info(`Notified ${subscribers.length} subscribers of new signal`);
        } catch (error) {
            logger.error('Notify subscribers error:', error);
        }
    }

    /**
     * Update provider statistics
     */
    async updateProviderStats(providerId, action) {
        try {
            const updates = {};

            switch (action) {
                case 'signal_created':
                    updates.totalSignals = { increment: 1 };
                    break;
                case 'follower_added':
                    updates.totalFollowers = { increment: 1 };
                    updates.activeFollowers = { increment: 1 };
                    break;
                case 'follower_removed':
                    updates.activeFollowers = { decrement: 1 };
                    break;
            }

            await prisma.provider.update({
                where: { id: providerId },
                data: updates
            });
        } catch (error) {
            logger.error('Update provider stats error:', error);
        }
    }

    /**
     * Update strategy performance
     */
    async updateStrategyPerformance(strategyId, isWin) {
        try {
            const strategy = await prisma.strategy.findUnique({
                where: { id: strategyId }
            });

            if (!strategy) return;

            const totalTrades = strategy.totalTrades + 1;
            const profitableTrades = strategy.profitableTrades + (isWin ? 1 : 0);
            const winRate = (profitableTrades / totalTrades) * 100;

            await prisma.strategy.update({
                where: { id: strategyId },
                data: {
                    totalTrades,
                    profitableTrades,
                    winRate
                }
            });
        } catch (error) {
            logger.error('Update strategy performance error:', error);
        }
    }

    /**
     * Validate signal parameters
     */
    validateSignalParameters(side, entryPrice, stopLoss, takeProfit, currentPrice) {
        if (side === 'BUY') {
            if (stopLoss >= entryPrice) {
                throw new Error('Stop loss must be below entry price for BUY signals');
            }
            if (takeProfit && takeProfit <= entryPrice) {
                throw new Error('Take profit must be above entry price for BUY signals');
            }
        } else {
            if (stopLoss <= entryPrice) {
                throw new Error('Stop loss must be above entry price for SELL signals');
            }
            if (takeProfit && takeProfit >= entryPrice) {
                throw new Error('Take profit must be below entry price for SELL signals');
            }
        }

        // Check if entry price is reasonable compared to current price
        const deviation = Math.abs((entryPrice - currentPrice) / currentPrice);
        if (deviation > 0.05) { // More than 5% deviation
            logger.warn(`Signal entry price deviates ${(deviation * 100).toFixed(2)}% from current price`);
        }
    }

    /**
     * Calculate risk metrics
     */
    calculateRiskMetrics(entryPrice, stopLoss, takeProfit, side) {
        const risk = Math.abs(entryPrice - stopLoss);
        const reward = takeProfit ? Math.abs(takeProfit - entryPrice) : risk * 2;
        const riskRewardRatio = reward / risk;

        // Calculate recommended position size based on risk (1% rule)
        const recommendedPosition = 0.01 / (risk / entryPrice);

        return {
            risk,
            reward,
            riskRewardRatio,
            recommendedPosition: Math.min(recommendedPosition, 0.1) // Max 10% position
        };
    }

    /**
     * Calculate unrealized PnL
     */
    calculateUnrealizedPnL(entryPrice, currentPrice, side) {
        if (side === 'BUY') {
            return currentPrice - entryPrice;
        } else {
            return entryPrice - currentPrice;
        }
    }

    /**
     * Calculate Sharpe ratio
     */
    calculateSharpeRatio(returns) {
        if (returns.length < 2) return 0;

        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        return stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
    }

    /**
     * Categorize strategy type
     */
    categorizeStrategy(type) {
        const categories = {
            'RSI': 'Technical',
            'MACD': 'Technical',
            'MA': 'Technical',
            'BOLLINGER': 'Technical',
            'AI': 'AI/ML',
            'ML': 'AI/ML',
            'NEURAL': 'AI/ML',
            'CUSTOM': 'Custom',
            'HYBRID': 'Hybrid'
        };

        return categories[type.toUpperCase()] || 'Other';
    }
}

// Export singleton instance
module.exports = new ProviderService();