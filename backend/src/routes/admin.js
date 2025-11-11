const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const backupService = require('../services/backupService');
const monitoringService = require('../services/monitoringService');
const emailService = require('../utils/emailService');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const requireAdmin = authorize(['ADMIN']);

/**
 * ADMIN ROUTES
 * All routes require authentication and admin role
 */

// Middleware: All admin routes require auth + admin role
router.use(authenticate);
router.use(requireAdmin);

/**
 * BACKUP MANAGEMENT
 */

// Get backup statistics
router.get('/backups/stats', async (req, res) => {
    try {
        const stats = backupService.getBackupStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get backup history
router.get('/backups', async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;

        const backups = backupService.backupHistory
            .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        res.json({
            success: true,
            data: {
                backups,
                total: backupService.backupHistory.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create manual backup
router.post('/backups/create', async (req, res) => {
    try {
        const { type = 'manual' } = req.body;

        const backup = await backupService.createBackup(type);

        res.json({
            success: true,
            message: 'Backup created successfully',
            data: { backup }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Restore from backup
router.post('/backups/restore', async (req, res) => {
    try {
        const { backupId, options = {} } = req.body;

        if (!backupId) {
            return res.status(400).json({
                success: false,
                error: 'Backup ID is required'
            });
        }

        const result = await backupService.restoreBackup(backupId, options);

        res.json({
            success: true,
            message: 'Restore completed successfully',
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Cleanup old backups
router.post('/backups/cleanup', async (req, res) => {
    try {
        const result = await backupService.cleanupOldBackups();

        res.json({
            success: true,
            message: 'Cleanup completed',
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Verify backup
router.post('/backups/:id/verify', async (req, res) => {
    try {
        const { id } = req.params;

        const backup = backupService.backupHistory.find(b => b.id === id);
        if (!backup) {
            return res.status(404).json({
                success: false,
                error: 'Backup not found'
            });
        }

        const verified = await backupService.verifyBackup(backup);

        res.json({
            success: true,
            data: { verified }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * SYSTEM MONITORING
 */

// Get system health
router.get('/monitoring/health', async (req, res) => {
    try {
        const health = monitoringService.getHealthStatus();

        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get system metrics
router.get('/monitoring/metrics', async (req, res) => {
    try {
        const metrics = monitoringService.getMetrics();

        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get active alerts
router.get('/monitoring/alerts', async (req, res) => {
    try {
        const { limit = 50, acknowledged = false } = req.query;

        let alerts = monitoringService.alerts;

        if (acknowledged === 'false') {
            alerts = alerts.filter(a => !a.acknowledged);
        }

        alerts = alerts.slice(0, parseInt(limit));

        res.json({
            success: true,
            data: {
                alerts,
                total: alerts.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Acknowledge alert
router.post('/monitoring/alerts/:id/acknowledge', async (req, res) => {
    try {
        const { id } = req.params;

        const alert = monitoringService.alerts.find(a => a.id === id);
        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = req.user.id;

        res.json({
            success: true,
            message: 'Alert acknowledged'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * USER MANAGEMENT
 */

// Get all users
router.get('/users', async (req, res) => {
    try {
        const { limit = 50, offset = 0, role, search } = req.query;

        const where = {};
        if (role) {
            where.role = role;
        }
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } }
            ];
        }

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                isProvider: true,
                createdAt: true,
                lastLoginAt: true,
                _count: {
                    select: {
                        subscriptions: true,
                        signals: true
                    }
                }
            },
            take: parseInt(limit),
            skip: parseInt(offset),
            orderBy: { createdAt: 'desc' }
        });

        const total = await prisma.user.count({ where });

        res.json({
            success: true,
            data: {
                users,
                total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get user details
router.get('/users/:id', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                subscriptions: true,
                signals: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                },
                sessions: {
                    where: { isActive: true }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: { user }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update user
router.put('/users/:id', async (req, res) => {
    try {
        const { role, isProvider, banned } = req.body;

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: {
                role,
                isProvider,
                banned
            }
        });

        res.json({
            success: true,
            message: 'User updated successfully',
            data: { user }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ban user
router.post('/users/:id/ban', async (req, res) => {
    try {
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { banned: true }
        });

        res.json({
            success: true,
            message: 'User banned successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Unban user
router.post('/users/:id/unban', async (req, res) => {
    try {
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { banned: false }
        });

        res.json({
            success: true,
            message: 'User unbanned successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * SYSTEM STATISTICS
 */

// Get dashboard statistics
router.get('/stats/dashboard', async (req, res) => {
    try {
        const [
            totalUsers,
            totalProviders,
            totalSignals,
            activeSignals,
            totalSubscriptions,
            totalRevenue
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { isProvider: true } }),
            prisma.signal.count(),
            prisma.signal.count({ where: { status: 'ACTIVE' } }),
            prisma.subscription.count({ where: { status: 'ACTIVE' } }),
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { status: 'SUCCEEDED' }
            })
        ]);

        // Today's stats
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [newUsersToday, newSignalsToday, revenueToday] = await Promise.all([
            prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
            prisma.signal.count({ where: { createdAt: { gte: todayStart } } }),
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: {
                    status: 'SUCCEEDED',
                    createdAt: { gte: todayStart }
                }
            })
        ]);

        res.json({
            success: true,
            data: {
                overview: {
                    totalUsers,
                    totalProviders,
                    totalSignals,
                    activeSignals,
                    totalSubscriptions,
                    totalRevenue: totalRevenue._sum.amount || 0
                },
                today: {
                    newUsers: newUsersToday,
                    newSignals: newSignalsToday,
                    revenue: revenueToday._sum.amount || 0
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get revenue statistics
router.get('/stats/revenue', async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        let startDate = new Date();
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
        }

        const payments = await prisma.payment.findMany({
            where: {
                status: 'SUCCEEDED',
                createdAt: { gte: startDate }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Group by day
        const revenueByDay = {};
        payments.forEach(payment => {
            const day = payment.createdAt.toISOString().split('T')[0];
            revenueByDay[day] = (revenueByDay[day] || 0) + parseFloat(payment.amount);
        });

        const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const avgDailyRevenue = totalRevenue / Object.keys(revenueByDay).length;

        res.json({
            success: true,
            data: {
                totalRevenue,
                avgDailyRevenue,
                transactionCount: payments.length,
                revenueByDay
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
 * SYSTEM LOGS
 */

// Get system logs
router.get('/logs', async (req, res) => {
    try {
        const { limit = 100, level, category, startDate, endDate } = req.query;

        const where = {};
        if (level) {
            where.level = level;
        }
        if (category) {
            where.category = category;
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                where.createdAt.lte = new Date(endDate);
            }
        }

        const logs = await prisma.systemLog.findMany({
            where,
            take: parseInt(limit),
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            data: { logs }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * EMAIL TESTING
 */

// Send test email
router.post('/email/test', async (req, res) => {
    try {
        const { to, template, data } = req.body;

        if (!to) {
            return res.status(400).json({
                success: false,
                error: 'Recipient email is required'
            });
        }

        await emailService.sendTemplateEmail(template || 'welcome', to, data || {
            firstName: 'Test User'
        });

        res.json({
            success: true,
            message: 'Test email sent successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * SYSTEM OPERATIONS
 */

// Clear cache (if implemented)
router.post('/system/clear-cache', async (req, res) => {
    try {
        // Clear cache logic here
        res.json({
            success: true,
            message: 'Cache cleared successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get system info
router.get('/system/info', async (req, res) => {
    try {
        const info = {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            env: process.env.NODE_ENV
        };

        res.json({
            success: true,
            data: info
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * EXECUTION LOGS - View order executions from SubscriptionExecutor
 */

// Get execution logs with filtering
router.get('/executions', async (req, res) => {
    try {
        const {
            limit = 50,
            offset = 0,
            status,
            userId,
            subscriptionId,
            exchange,
            startDate,
            endDate
        } = req.query;

        // Build where clause
        const where = {};
        if (status) where.status = status;
        if (userId) where.userId = userId;
        if (subscriptionId) where.subscriptionId = subscriptionId;
        if (exchange) where.exchange = exchange;
        if (startDate || endDate) {
            where.executedAt = {};
            if (startDate) where.executedAt.gte = new Date(startDate);
            if (endDate) where.executedAt.lte = new Date(endDate);
        }

        const [executions, total] = await Promise.all([
            prisma.executionLog.findMany({
                where,
                include: {
                    user: {
                        select: { id: true, email: true, username: true }
                    },
                    subscription: {
                        select: {
                            id: true,
                            strategy: {
                                select: { name: true }
                            }
                        }
                    },
                    signal: {
                        select: {
                            id: true,
                            symbol: true,
                            direction: true,
                            entryPrice: true
                        }
                    }
                },
                orderBy: { executedAt: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.executionLog.count({ where })
        ]);

        // Calculate statistics
        const stats = {
            total,
            successful: executions.filter(e => e.status === 'SUCCESS').length,
            failed: executions.filter(e => e.status === 'FAILED').length,
            avgExecutionTime: executions.length > 0
                ? Math.round(executions.reduce((sum, e) => sum + (e.executionTimeMs || 0), 0) / executions.length)
                : 0
        };

        res.json({
            success: true,
            data: {
                executions,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: parseInt(offset) + executions.length < total
                },
                stats
            }
        });
    } catch (error) {
        console.error('Error fetching executions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get execution statistics summary
router.get('/executions/stats', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const executions = await prisma.executionLog.findMany({
            where: {
                executedAt: {
                    gte: startDate
                }
            },
            select: {
                status: true,
                executionTimeMs: true,
                exchange: true,
                executedAt: true
            }
        });

        const stats = {
            totalExecutions: executions.length,
            successful: executions.filter(e => e.status === 'SUCCESS').length,
            failed: executions.filter(e => e.status === 'FAILED').length,
            successRate: executions.length > 0
                ? ((executions.filter(e => e.status === 'SUCCESS').length / executions.length) * 100).toFixed(2)
                : 0,
            avgExecutionTime: executions.length > 0
                ? Math.round(executions.reduce((sum, e) => sum + (e.executionTimeMs || 0), 0) / executions.length)
                : 0,
            byExchange: {},
            byDay: {}
        };

        // Group by exchange
        executions.forEach(e => {
            if (!stats.byExchange[e.exchange]) {
                stats.byExchange[e.exchange] = { total: 0, successful: 0, failed: 0 };
            }
            stats.byExchange[e.exchange].total++;
            if (e.status === 'SUCCESS') stats.byExchange[e.exchange].successful++;
            if (e.status === 'FAILED') stats.byExchange[e.exchange].failed++;
        });

        // Group by day
        executions.forEach(e => {
            const day = e.executedAt.toISOString().split('T')[0];
            if (!stats.byDay[day]) {
                stats.byDay[day] = { total: 0, successful: 0, failed: 0 };
            }
            stats.byDay[day].total++;
            if (e.status === 'SUCCESS') stats.byDay[day].successful++;
            if (e.status === 'FAILED') stats.byDay[day].failed++;
        });

        res.json({
            success: true,
            data: {
                period: `Last ${days} days`,
                ...stats
            }
        });
    } catch (error) {
        console.error('Error fetching execution stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get SubscriptionExecutor service stats
router.get('/subscription-executor/stats', (req, res) => {
    try {
        const { getInstance } = require('../services/subscription-executor');
        const executor = getInstance();
        const stats = executor.getStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
