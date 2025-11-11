/**
 * ANALYTICS AND REPORTING SERVICE
 *
 * Provides comprehensive analytics and reporting for:
 * - Platform performance metrics
 * - User behavior analytics
 * - Trading performance
 * - Revenue analytics
 * - Provider statistics
 * - Signal performance
 * - Subscription trends
 */

const logger = require('../utils/logger');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class AnalyticsService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get platform overview metrics
     */
    async getPlatformOverview(period = '30d') {
        try {
            const cacheKey = `platform_overview_${period}`;
            const cached = this.getCached(cacheKey);
            if (cached) return cached;

            const { startDate, endDate } = this.getPeriodDates(period);

            const [
                totalUsers,
                activeUsers,
                totalProviders,
                activeProviders,
                totalSignals,
                activeSignals,
                totalSubscriptions,
                totalRevenue,
                newUsersInPeriod,
                newSignalsInPeriod,
                newSubscriptionsInPeriod,
                revenueInPeriod
            ] = await Promise.all([
                prisma.user.count(),
                prisma.session.count({ where: { isActive: true } }),
                prisma.user.count({ where: { isProvider: true } }),
                prisma.user.count({ where: { isProvider: true, lastLoginAt: { gte: startDate } } }),
                prisma.signal.count(),
                prisma.signal.count({ where: { status: 'ACTIVE' } }),
                prisma.subscription.count({ where: { status: 'ACTIVE' } }),
                prisma.payment.aggregate({
                    _sum: { amount: true },
                    where: { status: 'SUCCEEDED' }
                }),
                prisma.user.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
                prisma.signal.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
                prisma.subscription.count({
                    where: { createdAt: { gte: startDate, lte: endDate } }
                }),
                prisma.payment.aggregate({
                    _sum: { amount: true },
                    where: {
                        status: 'SUCCEEDED',
                        createdAt: { gte: startDate, lte: endDate }
                    }
                })
            ]);

            const overview = {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    new: newUsersInPeriod,
                    activeRate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0
                },
                providers: {
                    total: totalProviders,
                    active: activeProviders,
                    activeRate: totalProviders > 0 ? (activeProviders / totalProviders) * 100 : 0
                },
                signals: {
                    total: totalSignals,
                    active: activeSignals,
                    new: newSignalsInPeriod,
                    avgPerProvider: totalProviders > 0 ? totalSignals / totalProviders : 0
                },
                subscriptions: {
                    total: totalSubscriptions,
                    new: newSubscriptionsInPeriod,
                    avgPerProvider: totalProviders > 0 ? totalSubscriptions / totalProviders : 0
                },
                revenue: {
                    total: parseFloat(totalRevenue._sum.amount || 0),
                    period: parseFloat(revenueInPeriod._sum.amount || 0),
                    avgPerSubscription: totalSubscriptions > 0
                        ? parseFloat(totalRevenue._sum.amount || 0) / totalSubscriptions
                        : 0
                },
                period: {
                    start: startDate,
                    end: endDate,
                    label: this.getPeriodLabel(period)
                }
            };

            this.setCached(cacheKey, overview);
            return overview;
        } catch (error) {
            logger.error('Failed to get platform overview:', error);
            throw error;
        }
    }

    /**
     * Get user growth analytics
     */
    async getUserGrowth(period = '30d', interval = 'day') {
        try {
            const { startDate, endDate } = this.getPeriodDates(period);

            const users = await prisma.user.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate }
                },
                select: { createdAt: true, role: true, isProvider: true },
                orderBy: { createdAt: 'asc' }
            });

            const grouped = this.groupByInterval(users, 'createdAt', interval);

            return {
                timeline: grouped.map(group => ({
                    date: group.date,
                    total: group.count,
                    traders: group.items.filter(u => !u.isProvider).length,
                    providers: group.items.filter(u => u.isProvider).length
                })),
                summary: {
                    total: users.length,
                    traders: users.filter(u => !u.isProvider).length,
                    providers: users.filter(u => u.isProvider).length,
                    avgPerDay: users.length / this.getDaysInPeriod(period)
                }
            };
        } catch (error) {
            logger.error('Failed to get user growth:', error);
            throw error;
        }
    }

    /**
     * Get revenue analytics
     */
    async getRevenueAnalytics(period = '30d', interval = 'day') {
        try {
            const { startDate, endDate } = this.getPeriodDates(period);

            const payments = await prisma.payment.findMany({
                where: {
                    status: 'SUCCEEDED',
                    createdAt: { gte: startDate, lte: endDate }
                },
                include: {
                    subscription: {
                        include: {
                            provider: {
                                select: { username: true, displayName: true }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'asc' }
            });

            const grouped = this.groupByInterval(payments, 'createdAt', interval);

            const timeline = grouped.map(group => {
                const revenue = group.items.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                const platformRevenue = revenue * 0.3;
                const providerRevenue = revenue * 0.7;

                return {
                    date: group.date,
                    revenue,
                    platformRevenue,
                    providerRevenue,
                    transactions: group.count
                };
            });

            const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            const avgTransactionValue = payments.length > 0 ? totalRevenue / payments.length : 0;

            // Top providers by revenue
            const providerRevenue = {};
            payments.forEach(payment => {
                if (payment.subscription?.provider) {
                    const providerId = payment.subscription.providerId;
                    providerRevenue[providerId] = providerRevenue[providerId] || {
                        provider: payment.subscription.provider,
                        revenue: 0,
                        transactions: 0
                    };
                    providerRevenue[providerId].revenue += parseFloat(payment.amount) * 0.7;
                    providerRevenue[providerId].transactions++;
                }
            });

            const topProviders = Object.values(providerRevenue)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);

            return {
                timeline,
                summary: {
                    totalRevenue,
                    platformRevenue: totalRevenue * 0.3,
                    providerRevenue: totalRevenue * 0.7,
                    transactions: payments.length,
                    avgTransactionValue,
                    avgRevenuePerDay: totalRevenue / this.getDaysInPeriod(period)
                },
                topProviders
            };
        } catch (error) {
            logger.error('Failed to get revenue analytics:', error);
            throw error;
        }
    }

    /**
     * Get signal performance analytics
     */
    async getSignalPerformance(providerId = null, period = '30d') {
        try {
            const { startDate, endDate } = this.getPeriodDates(period);

            const where = {
                createdAt: { gte: startDate, lte: endDate }
            };

            if (providerId) {
                where.providerId = providerId;
            }

            const signals = await prisma.signal.findMany({
                where,
                include: {
                    provider: {
                        select: { username: true, displayName: true }
                    },
                    strategy: {
                        select: { name: true }
                    }
                }
            });

            const closedSignals = signals.filter(s => s.status === 'CLOSED' && s.closePrice);

            const performance = closedSignals.map(signal => {
                const pnl = signal.side === 'BUY'
                    ? ((signal.closePrice - signal.entryPrice) / signal.entryPrice) * 100
                    : ((signal.entryPrice - signal.closePrice) / signal.entryPrice) * 100;

                const holdTime = signal.closedAt
                    ? (new Date(signal.closedAt) - new Date(signal.createdAt)) / (1000 * 60 * 60)
                    : 0;

                return {
                    signal,
                    pnl,
                    holdTime,
                    profitable: pnl > 0
                };
            });

            const profitableSignals = performance.filter(p => p.profitable);
            const losingSignals = performance.filter(p => !p.profitable);

            const avgPnl = performance.length > 0
                ? performance.reduce((sum, p) => sum + p.pnl, 0) / performance.length
                : 0;

            const avgWin = profitableSignals.length > 0
                ? profitableSignals.reduce((sum, p) => sum + p.pnl, 0) / profitableSignals.length
                : 0;

            const avgLoss = losingSignals.length > 0
                ? losingSignals.reduce((sum, p) => sum + p.pnl, 0) / losingSignals.length
                : 0;

            const avgHoldTime = performance.length > 0
                ? performance.reduce((sum, p) => sum + p.holdTime, 0) / performance.length
                : 0;

            // Performance by pair
            const byPair = {};
            performance.forEach(p => {
                const pair = p.signal.pair;
                byPair[pair] = byPair[pair] || {
                    pair,
                    signals: 0,
                    profitable: 0,
                    avgPnl: 0,
                    totalPnl: 0
                };
                byPair[pair].signals++;
                if (p.profitable) byPair[pair].profitable++;
                byPair[pair].totalPnl += p.pnl;
                byPair[pair].avgPnl = byPair[pair].totalPnl / byPair[pair].signals;
            });

            const pairPerformance = Object.values(byPair)
                .sort((a, b) => b.avgPnl - a.avgPnl);

            return {
                overview: {
                    totalSignals: signals.length,
                    activeSignals: signals.filter(s => s.status === 'ACTIVE').length,
                    closedSignals: closedSignals.length,
                    profitableSignals: profitableSignals.length,
                    losingSignals: losingSignals.length,
                    winRate: closedSignals.length > 0
                        ? (profitableSignals.length / closedSignals.length) * 100
                        : 0
                },
                performance: {
                    avgPnl,
                    avgWin,
                    avgLoss,
                    profitFactor: Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : 0,
                    avgHoldTime
                },
                pairPerformance,
                recentSignals: performance.slice(-20).reverse()
            };
        } catch (error) {
            logger.error('Failed to get signal performance:', error);
            throw error;
        }
    }

    /**
     * Get subscription analytics
     */
    async getSubscriptionAnalytics(period = '30d') {
        try {
            const { startDate, endDate } = this.getPeriodDates(period);

            const subscriptions = await prisma.subscription.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate }
                },
                include: {
                    provider: {
                        select: { id: true, username: true, displayName: true }
                    },
                    user: {
                        select: { id: true, username: true }
                    }
                }
            });

            const grouped = this.groupByInterval(subscriptions, 'createdAt', 'day');

            const timeline = grouped.map(group => ({
                date: group.date,
                subscriptions: group.count,
                active: group.items.filter(s => s.status === 'ACTIVE').length,
                cancelled: group.items.filter(s => s.status === 'CANCELLED').length
            }));

            // Provider rankings
            const providerStats = {};
            subscriptions.forEach(sub => {
                const providerId = sub.providerId;
                providerStats[providerId] = providerStats[providerId] || {
                    provider: sub.provider,
                    subscriptions: 0,
                    active: 0,
                    cancelled: 0,
                    revenue: 0
                };
                providerStats[providerId].subscriptions++;
                if (sub.status === 'ACTIVE') {
                    providerStats[providerId].active++;
                    providerStats[providerId].revenue += 3 * 0.7; // $3/month * 70%
                } else if (sub.status === 'CANCELLED') {
                    providerStats[providerId].cancelled++;
                }
            });

            const topProviders = Object.values(providerStats)
                .sort((a, b) => b.subscriptions - a.subscriptions)
                .slice(0, 10);

            // Churn analysis
            const cancelledSubscriptions = subscriptions.filter(s => s.status === 'CANCELLED');
            const churnRate = subscriptions.length > 0
                ? (cancelledSubscriptions.length / subscriptions.length) * 100
                : 0;

            return {
                timeline,
                summary: {
                    total: subscriptions.length,
                    active: subscriptions.filter(s => s.status === 'ACTIVE').length,
                    cancelled: cancelledSubscriptions.length,
                    churnRate,
                    avgPerProvider: topProviders.length > 0
                        ? subscriptions.length / topProviders.length
                        : 0
                },
                topProviders,
                churnAnalysis: {
                    rate: churnRate,
                    avgLifetime: await this.getAvgSubscriptionLifetime()
                }
            };
        } catch (error) {
            logger.error('Failed to get subscription analytics:', error);
            throw error;
        }
    }

    /**
     * Get average subscription lifetime
     */
    async getAvgSubscriptionLifetime() {
        try {
            const cancelledSubscriptions = await prisma.subscription.findMany({
                where: {
                    status: 'CANCELLED',
                    cancelledAt: { not: null }
                },
                select: {
                    createdAt: true,
                    cancelledAt: true
                }
            });

            if (cancelledSubscriptions.length === 0) {
                return 0;
            }

            const totalDays = cancelledSubscriptions.reduce((sum, sub) => {
                const days = (new Date(sub.cancelledAt) - new Date(sub.createdAt)) / (1000 * 60 * 60 * 24);
                return sum + days;
            }, 0);

            return totalDays / cancelledSubscriptions.length;
        } catch (error) {
            logger.error('Failed to get avg subscription lifetime:', error);
            return 0;
        }
    }

    /**
     * Get provider leaderboard
     */
    async getProviderLeaderboard(metric = 'subscribers', limit = 20) {
        try {
            const providers = await prisma.user.findMany({
                where: { isProvider: true },
                include: {
                    _count: {
                        select: {
                            subscribers: true,
                            signals: true
                        }
                    },
                    signals: {
                        where: { status: 'CLOSED', closePrice: { not: null } },
                        select: {
                            side: true,
                            entryPrice: true,
                            closePrice: true
                        }
                    }
                }
            });

            const leaderboard = providers.map(provider => {
                const closedSignals = provider.signals;
                const performance = closedSignals.map(signal => {
                    return signal.side === 'BUY'
                        ? ((signal.closePrice - signal.entryPrice) / signal.entryPrice) * 100
                        : ((signal.entryPrice - signal.closePrice) / signal.entryPrice) * 100;
                });

                const profitableSignals = performance.filter(p => p > 0).length;
                const avgPnl = performance.length > 0
                    ? performance.reduce((sum, p) => sum + p, 0) / performance.length
                    : 0;
                const winRate = closedSignals.length > 0
                    ? (profitableSignals / closedSignals.length) * 100
                    : 0;

                return {
                    id: provider.id,
                    username: provider.username,
                    displayName: provider.displayName || provider.username,
                    subscribers: provider._count.subscribers,
                    totalSignals: provider._count.signals,
                    closedSignals: closedSignals.length,
                    roi: avgPnl,
                    winRate,
                    revenue: provider._count.subscribers * 3 * 0.7 // $3/month * 70%
                };
            });

            // Sort by metric
            const sortFunctions = {
                subscribers: (a, b) => b.subscribers - a.subscribers,
                roi: (a, b) => b.roi - a.roi,
                winRate: (a, b) => b.winRate - a.winRate,
                signals: (a, b) => b.totalSignals - a.totalSignals,
                revenue: (a, b) => b.revenue - a.revenue
            };

            leaderboard.sort(sortFunctions[metric] || sortFunctions.subscribers);

            return leaderboard.slice(0, limit);
        } catch (error) {
            logger.error('Failed to get provider leaderboard:', error);
            throw error;
        }
    }

    /**
     * Helper: Get period dates
     */
    getPeriodDates(period) {
        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            case 'all':
                startDate.setFullYear(2000);
                break;
            default:
                startDate.setDate(startDate.getDate() - 30);
        }

        return { startDate, endDate };
    }

    /**
     * Helper: Get period label
     */
    getPeriodLabel(period) {
        const labels = {
            '7d': 'Last 7 Days',
            '30d': 'Last 30 Days',
            '90d': 'Last 90 Days',
            '1y': 'Last Year',
            'all': 'All Time'
        };
        return labels[period] || 'Last 30 Days';
    }

    /**
     * Helper: Get days in period
     */
    getDaysInPeriod(period) {
        const days = {
            '7d': 7,
            '30d': 30,
            '90d': 90,
            '1y': 365,
            'all': 365
        };
        return days[period] || 30;
    }

    /**
     * Helper: Group data by interval
     */
    groupByInterval(items, dateField, interval = 'day') {
        const grouped = {};

        items.forEach(item => {
            const date = new Date(item[dateField]);
            let key;

            if (interval === 'hour') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
            } else if (interval === 'day') {
                key = date.toISOString().split('T')[0];
            } else if (interval === 'week') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
            } else if (interval === 'month') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            grouped[key] = grouped[key] || { date: key, count: 0, items: [] };
            grouped[key].count++;
            grouped[key].items.push(item);
        });

        return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Helper: Cache management
     */
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        return null;
    }

    setCached(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }
}

// Export singleton instance
const analyticsService = new AnalyticsService();
module.exports = analyticsService;
