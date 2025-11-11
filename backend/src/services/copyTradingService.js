/**
 * COPY TRADING SERVICE
 * Automatically copy trades from signal providers to subscriber accounts
 * Includes risk management, position sizing, and real exchange execution
 */

const ccxt = require('ccxt');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const realDataService = require('./realDataService');

const prisma = new PrismaClient();

class CopyTradingService {
    constructor() {
        this.activeFollowers = new Map(); // Map of userId -> copy trading config
        this.executionQueue = [];
        this.isProcessing = false;
        this.exchanges = new Map(); // User exchange instances

        // Risk management defaults
        this.DEFAULT_MAX_POSITION = 0.1; // 10% max position size
        this.DEFAULT_SCALE_FACTOR = 1.0; // 1:1 copy ratio
        this.MIN_POSITION_SIZE = 10; // $10 minimum position
        this.MAX_SLIPPAGE = 0.005; // 0.5% max slippage tolerance
    }

    /**
     * Initialize copy trading service
     */
    async initialize() {
        try {
            // Load active copy trading subscriptions
            await this.loadActiveFollowers();

            // Start processing queue
            this.startQueueProcessor();

            logger.info('Copy Trading Service initialized successfully');
            return true;
        } catch (error) {
            logger.error('Copy Trading Service initialization error:', error);
            throw error;
        }
    }

    /**
     * Load active copy trading subscriptions
     */
    async loadActiveFollowers() {
        try {
            const subscriptions = await prisma.subscription.findMany({
                where: {
                    status: 'ACTIVE',
                    copyTradingEnabled: true
                },
                include: {
                    user: {
                        include: {
                            apiKeys: {
                                where: { isActive: true }
                            }
                        }
                    },
                    strategy: {
                        include: {
                            provider: true
                        }
                    }
                }
            });

            for (const subscription of subscriptions) {
                if (subscription.user.apiKeys.length > 0) {
                    this.activeFollowers.set(subscription.userId, {
                        userId: subscription.userId,
                        subscriptionId: subscription.id,
                        providerId: subscription.strategy.providerId,
                        strategyId: subscription.strategyId,
                        maxPositionSize: subscription.maxPositionSize || this.DEFAULT_MAX_POSITION,
                        scaleFactor: subscription.scaleFactor || this.DEFAULT_SCALE_FACTOR,
                        apiKeys: subscription.user.apiKeys,
                        riskSettings: subscription.user.tradingPreferences
                    });
                }
            }

            logger.info(`Loaded ${this.activeFollowers.size} active copy trading followers`);
        } catch (error) {
            logger.error('Load active followers error:', error);
        }
    }

    /**
     * Enable copy trading for subscription
     */
    async enableCopyTrading(subscriptionId, userId, options = {}) {
        const {
            maxPositionSize = this.DEFAULT_MAX_POSITION,
            scaleFactor = this.DEFAULT_SCALE_FACTOR,
            useStopLoss = true,
            useTakeProfit = true
        } = options;

        try {
            // Verify user has API keys configured
            const apiKeys = await prisma.apiKey.findMany({
                where: {
                    userId,
                    isActive: true
                }
            });

            if (apiKeys.length === 0) {
                throw new Error('Please configure exchange API keys before enabling copy trading');
            }

            // Verify subscription
            const subscription = await prisma.subscription.findFirst({
                where: {
                    id: subscriptionId,
                    userId,
                    status: 'ACTIVE'
                },
                include: {
                    strategy: true
                }
            });

            if (!subscription) {
                throw new Error('Active subscription not found');
            }

            // Update subscription
            const updatedSubscription = await prisma.subscription.update({
                where: { id: subscriptionId },
                data: {
                    copyTradingEnabled: true,
                    maxPositionSize,
                    scaleFactor,
                    copyTradingSettings: {
                        useStopLoss,
                        useTakeProfit,
                        enabledAt: new Date()
                    }
                }
            });

            // Add to active followers
            this.activeFollowers.set(userId, {
                userId,
                subscriptionId,
                providerId: subscription.strategy.providerId,
                strategyId: subscription.strategyId,
                maxPositionSize,
                scaleFactor,
                apiKeys,
                riskSettings: { useStopLoss, useTakeProfit }
            });

            logger.info(`Copy trading enabled for user ${userId}, subscription ${subscriptionId}`);

            return {
                success: true,
                subscription: updatedSubscription,
                message: 'Copy trading enabled successfully'
            };
        } catch (error) {
            logger.error('Enable copy trading error:', error);
            throw error;
        }
    }

    /**
     * Disable copy trading for subscription
     */
    async disableCopyTrading(subscriptionId, userId, closePositions = false) {
        try {
            // Update subscription
            await prisma.subscription.update({
                where: {
                    id: subscriptionId,
                    userId
                },
                data: {
                    copyTradingEnabled: false,
                    copyTradingSettings: {
                        disabledAt: new Date()
                    }
                }
            });

            // Remove from active followers
            this.activeFollowers.delete(userId);

            // Optionally close open positions
            if (closePositions) {
                await this.closeAllPositions(userId);
            }

            logger.info(`Copy trading disabled for user ${userId}`);

            return {
                success: true,
                message: 'Copy trading disabled successfully'
            };
        } catch (error) {
            logger.error('Disable copy trading error:', error);
            throw error;
        }
    }

    /**
     * Process new signal for copy trading
     */
    async processSignal(signal) {
        try {
            // Get all followers of this provider/strategy
            const followers = Array.from(this.activeFollowers.values()).filter(f =>
                f.strategyId === signal.strategyId
            );

            if (followers.length === 0) {
                logger.debug(`No copy traders for signal ${signal.id}`);
                return;
            }

            logger.info(`Processing signal ${signal.id} for ${followers.length} copy traders`);

            // Queue copy trades for each follower
            for (const follower of followers) {
                await this.queueCopyTrade(signal, follower);
            }
        } catch (error) {
            logger.error('Process signal error:', error);
        }
    }

    /**
     * Queue copy trade for execution
     */
    async queueCopyTrade(signal, follower) {
        try {
            // Validate trade
            const validation = await this.validateCopyTrade(signal, follower);
            if (!validation.valid) {
                logger.warn(`Copy trade validation failed for user ${follower.userId}: ${validation.reason}`);
                return;
            }

            // Calculate position size
            const positionSize = await this.calculatePositionSize(signal, follower);
            if (positionSize < this.MIN_POSITION_SIZE) {
                logger.warn(`Position size too small for user ${follower.userId}: $${positionSize}`);
                return;
            }

            // Add to execution queue
            this.executionQueue.push({
                signalId: signal.id,
                userId: follower.userId,
                signal,
                follower,
                positionSize,
                timestamp: Date.now()
            });

            logger.debug(`Queued copy trade for user ${follower.userId}, signal ${signal.id}`);
        } catch (error) {
            logger.error('Queue copy trade error:', error);
        }
    }

    /**
     * Validate copy trade
     */
    async validateCopyTrade(signal, follower) {
        try {
            // Check if already copied this signal
            const existingTrade = await prisma.trade.findFirst({
                where: {
                    userId: follower.userId,
                    signalId: signal.id
                }
            });

            if (existingTrade) {
                return { valid: false, reason: 'Signal already copied' };
            }

            // Check available balance
            const balance = await this.getAvailableBalance(follower);
            if (balance < this.MIN_POSITION_SIZE) {
                return { valid: false, reason: 'Insufficient balance' };
            }

            // Check max positions limit
            const openPositions = await prisma.position.count({
                where: {
                    userId: follower.userId,
                    status: 'OPEN'
                }
            });

            const maxPositions = follower.riskSettings?.maxPositions || 10;
            if (openPositions >= maxPositions) {
                return { valid: false, reason: 'Max positions limit reached' };
            }

            // Check daily loss limit
            const dailyLoss = await this.getDailyLoss(follower.userId);
            const maxDailyLoss = follower.riskSettings?.maxDailyLoss || 0.05; // 5%
            if (dailyLoss >= maxDailyLoss * balance) {
                return { valid: false, reason: 'Daily loss limit reached' };
            }

            return { valid: true };
        } catch (error) {
            logger.error('Validate copy trade error:', error);
            return { valid: false, reason: 'Validation error' };
        }
    }

    /**
     * Calculate position size based on follower settings
     */
    async calculatePositionSize(signal, follower) {
        try {
            // Get available balance
            const balance = await this.getAvailableBalance(follower);

            // Calculate base position size
            let positionSize = signal.positionSize * follower.scaleFactor;

            // Apply max position size limit
            const maxPosition = balance * follower.maxPositionSize;
            positionSize = Math.min(positionSize, maxPosition);

            // Ensure minimum position
            if (positionSize < this.MIN_POSITION_SIZE) {
                return 0;
            }

            return positionSize;
        } catch (error) {
            logger.error('Calculate position size error:', error);
            return 0;
        }
    }

    /**
     * Get available balance for user
     */
    async getAvailableBalance(follower) {
        try {
            // Get user's portfolio
            const portfolio = await prisma.portfolio.findFirst({
                where: {
                    userId: follower.userId,
                    isDefault: true,
                    isPaperTrading: false
                }
            });

            if (!portfolio) {
                // Try to get balance from exchange
                const exchange = await this.getUserExchange(follower);
                if (exchange) {
                    const balance = await exchange.fetchBalance();
                    return balance.USDT?.free || 0;
                }
                return 0;
            }

            return portfolio.availableBalance || 0;
        } catch (error) {
            logger.error('Get available balance error:', error);
            return 0;
        }
    }

    /**
     * Get daily loss for user
     */
    async getDailyLoss(userId) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const trades = await prisma.trade.findMany({
                where: {
                    userId,
                    closedAt: {
                        gte: today
                    },
                    realizedPnl: {
                        lt: 0
                    }
                }
            });

            return Math.abs(trades.reduce((sum, t) => sum + t.realizedPnl, 0));
        } catch (error) {
            logger.error('Get daily loss error:', error);
            return 0;
        }
    }

    /**
     * Get or create user exchange instance
     */
    async getUserExchange(follower) {
        try {
            const cacheKey = `${follower.userId}_${follower.apiKeys[0].exchange}`;

            if (this.exchanges.has(cacheKey)) {
                return this.exchanges.get(cacheKey);
            }

            const apiKey = follower.apiKeys[0];
            const exchangeClass = ccxt[apiKey.exchange];

            if (!exchangeClass) {
                throw new Error(`Exchange ${apiKey.exchange} not supported`);
            }

            const exchange = new exchangeClass({
                apiKey: apiKey.apiKey,
                secret: apiKey.apiSecret,
                password: apiKey.apiPassphrase,
                enableRateLimit: true
            });

            await exchange.loadMarkets();
            this.exchanges.set(cacheKey, exchange);

            return exchange;
        } catch (error) {
            logger.error('Get user exchange error:', error);
            return null;
        }
    }

    /**
     * Start queue processor
     */
    startQueueProcessor() {
        setInterval(async () => {
            if (this.isProcessing || this.executionQueue.length === 0) {
                return;
            }

            this.isProcessing = true;

            try {
                // Process one trade at a time to avoid rate limits
                const copyTrade = this.executionQueue.shift();
                await this.executeCopyTrade(copyTrade);
            } catch (error) {
                logger.error('Queue processor error:', error);
            } finally {
                this.isProcessing = false;
            }
        }, 1000); // Process every second

        logger.info('Copy trading queue processor started');
    }

    /**
     * Execute copy trade on exchange
     */
    async executeCopyTrade(copyTrade) {
        const { signalId, userId, signal, follower, positionSize } = copyTrade;

        try {
            logger.info(`Executing copy trade for user ${userId}, signal ${signalId}`);

            // Get user's exchange
            const exchange = await this.getUserExchange(follower);
            if (!exchange) {
                throw new Error('Exchange not available');
            }

            // Get current market price
            const ticker = await exchange.fetchTicker(signal.pair);
            const currentPrice = signal.side === 'BUY' ? ticker.ask : ticker.bid;

            // Check slippage
            const slippage = Math.abs(currentPrice - signal.entryPrice) / signal.entryPrice;
            if (slippage > this.MAX_SLIPPAGE) {
                logger.warn(`Slippage too high: ${(slippage * 100).toFixed(2)}%`);
                return;
            }

            // Calculate quantity
            const quantity = positionSize / currentPrice;

            // Place order
            const order = await exchange.createOrder(
                signal.pair,
                'market',
                signal.side.toLowerCase(),
                quantity,
                undefined,
                {
                    stopLoss: follower.riskSettings?.useStopLoss ? signal.stopLoss : undefined,
                    takeProfit: follower.riskSettings?.useTakeProfit ? signal.takeProfit : undefined
                }
            );

            // Create trade record
            const trade = await prisma.trade.create({
                data: {
                    userId,
                    signalId,
                    portfolioId: (await this.getDefaultPortfolio(userId))?.id,
                    exchange: follower.apiKeys[0].exchange,
                    pair: signal.pair,
                    side: signal.side,
                    orderType: 'MARKET',
                    orderId: order.id,
                    status: 'FILLED',
                    quantity,
                    price: currentPrice,
                    executedQuantity: order.filled || quantity,
                    executedPrice: order.average || currentPrice,
                    commission: order.fee?.cost || 0,
                    commissionAsset: order.fee?.currency,
                    stopLoss: signal.stopLoss,
                    takeProfit: signal.takeProfit,
                    copyTrade: true,
                    executedAt: new Date()
                }
            });

            // Create position
            await prisma.position.create({
                data: {
                    userId,
                    symbol: signal.pair,
                    side: signal.side,
                    quantity,
                    entryPrice: currentPrice,
                    currentPrice,
                    marketValue: quantity * currentPrice,
                    unrealizedPnl: 0,
                    unrealizedPnlPercent: 0,
                    stopLoss: signal.stopLoss,
                    takeProfit: signal.takeProfit
                }
            });

            logger.info(`Copy trade executed successfully: ${trade.id}`);

            // Send notification
            await this.sendCopyTradeNotification(userId, trade);

            return {
                success: true,
                trade
            };
        } catch (error) {
            logger.error(`Execute copy trade error for user ${userId}:`, error);

            // Record failed trade
            await prisma.trade.create({
                data: {
                    userId,
                    signalId,
                    exchange: follower.apiKeys[0].exchange,
                    pair: signal.pair,
                    side: signal.side,
                    orderType: 'MARKET',
                    status: 'FAILED',
                    quantity: 0,
                    price: signal.entryPrice,
                    copyTrade: true,
                    notes: `Copy trade failed: ${error.message}`
                }
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Close all positions for user
     */
    async closeAllPositions(userId) {
        try {
            const positions = await prisma.position.findMany({
                where: {
                    userId,
                    status: 'OPEN'
                }
            });

            for (const position of positions) {
                await this.closePosition(userId, position.id);
            }

            logger.info(`Closed ${positions.length} positions for user ${userId}`);
        } catch (error) {
            logger.error('Close all positions error:', error);
        }
    }

    /**
     * Close specific position
     */
    async closePosition(userId, positionId) {
        try {
            const position = await prisma.position.findFirst({
                where: {
                    id: positionId,
                    userId,
                    status: 'OPEN'
                }
            });

            if (!position) {
                throw new Error('Position not found');
            }

            // Get user's follower config
            const follower = this.activeFollowers.get(userId);
            if (!follower) {
                throw new Error('User not found in active followers');
            }

            // Get exchange
            const exchange = await this.getUserExchange(follower);
            if (!exchange) {
                throw new Error('Exchange not available');
            }

            // Get current price
            const ticker = await exchange.fetchTicker(position.symbol);
            const currentPrice = position.side === 'BUY' ? ticker.bid : ticker.ask;

            // Place close order
            const closeOrder = await exchange.createOrder(
                position.symbol,
                'market',
                position.side === 'BUY' ? 'sell' : 'buy',
                position.quantity
            );

            // Calculate PnL
            const pnl = position.side === 'BUY'
                ? (currentPrice - position.entryPrice) * position.quantity
                : (position.entryPrice - currentPrice) * position.quantity;

            // Update position
            await prisma.position.update({
                where: { id: positionId },
                data: {
                    status: 'CLOSED',
                    currentPrice,
                    realizedPnl: pnl,
                    realizedPnlPercent: (pnl / (position.entryPrice * position.quantity)) * 100,
                    closedAt: new Date()
                }
            });

            logger.info(`Position ${positionId} closed for user ${userId}, PnL: $${pnl.toFixed(2)}`);

            return {
                success: true,
                position,
                pnl
            };
        } catch (error) {
            logger.error('Close position error:', error);
            throw error;
        }
    }

    /**
     * Get default portfolio for user
     */
    async getDefaultPortfolio(userId) {
        return await prisma.portfolio.findFirst({
            where: {
                userId,
                isDefault: true
            }
        });
    }

    /**
     * Send copy trade notification
     */
    async sendCopyTradeNotification(userId, trade) {
        try {
            await prisma.notification.create({
                data: {
                    userId,
                    type: 'TRADE',
                    title: 'Copy Trade Executed',
                    message: `${trade.side} ${trade.pair} at $${trade.executedPrice?.toFixed(4)}`,
                    data: {
                        tradeId: trade.id,
                        pair: trade.pair,
                        side: trade.side,
                        price: trade.executedPrice,
                        quantity: trade.quantity
                    }
                }
            });
        } catch (error) {
            logger.error('Send copy trade notification error:', error);
        }
    }

    /**
     * Get copy trading statistics
     */
    async getCopyTradingStats(userId) {
        try {
            const trades = await prisma.trade.findMany({
                where: {
                    userId,
                    copyTrade: true,
                    status: 'FILLED'
                },
                orderBy: {
                    executedAt: 'desc'
                }
            });

            const closedTrades = trades.filter(t => t.realizedPnl !== null);
            const profitableTrades = closedTrades.filter(t => t.realizedPnl > 0);

            const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
            const winRate = closedTrades.length > 0
                ? (profitableTrades.length / closedTrades.length) * 100
                : 0;

            const openPositions = await prisma.position.count({
                where: {
                    userId,
                    status: 'OPEN'
                }
            });

            return {
                totalTrades: trades.length,
                closedTrades: closedTrades.length,
                openPositions,
                winRate,
                totalPnl,
                avgPnl: closedTrades.length > 0 ? totalPnl / closedTrades.length : 0,
                bestTrade: closedTrades.reduce((best, t) =>
                    (!best || t.realizedPnl > best.realizedPnl) ? t : best, null),
                worstTrade: closedTrades.reduce((worst, t) =>
                    (!worst || t.realizedPnl < worst.realizedPnl) ? t : worst, null)
            };
        } catch (error) {
            logger.error('Get copy trading stats error:', error);
            throw error;
        }
    }

    /**
     * Update follower risk settings
     */
    async updateRiskSettings(userId, settings) {
        try {
            const follower = this.activeFollowers.get(userId);
            if (!follower) {
                throw new Error('Copy trading not enabled');
            }

            // Update in memory
            follower.maxPositionSize = settings.maxPositionSize || follower.maxPositionSize;
            follower.scaleFactor = settings.scaleFactor || follower.scaleFactor;
            follower.riskSettings = {
                ...follower.riskSettings,
                ...settings
            };

            // Update in database
            await prisma.subscription.updateMany({
                where: {
                    userId,
                    copyTradingEnabled: true
                },
                data: {
                    maxPositionSize: follower.maxPositionSize,
                    scaleFactor: follower.scaleFactor,
                    copyTradingSettings: follower.riskSettings
                }
            });

            logger.info(`Updated risk settings for user ${userId}`);

            return {
                success: true,
                settings: follower
            };
        } catch (error) {
            logger.error('Update risk settings error:', error);
            throw error;
        }
    }

    /**
     * Monitor and update open positions
     */
    async monitorPositions() {
        try {
            const openPositions = await prisma.position.findMany({
                where: {
                    status: 'OPEN'
                },
                include: {
                    user: {
                        include: {
                            apiKeys: true
                        }
                    }
                }
            });

            for (const position of openPositions) {
                try {
                    // Get current price
                    const currentPrice = await realDataService.getRealPrice(
                        position.symbol,
                        position.user.apiKeys[0]?.exchange || 'bybit'
                    );

                    // Calculate unrealized PnL
                    const unrealizedPnl = position.side === 'BUY'
                        ? (currentPrice.price - position.entryPrice) * position.quantity
                        : (position.entryPrice - currentPrice.price) * position.quantity;

                    // Update position
                    await prisma.position.update({
                        where: { id: position.id },
                        data: {
                            currentPrice: currentPrice.price,
                            marketValue: position.quantity * currentPrice.price,
                            unrealizedPnl,
                            unrealizedPnlPercent: (unrealizedPnl / (position.entryPrice * position.quantity)) * 100
                        }
                    });

                    // Check stop loss / take profit
                    if (position.stopLoss && currentPrice.price <= position.stopLoss && position.side === 'BUY') {
                        await this.closePosition(position.userId, position.id);
                    }
                    if (position.takeProfit && currentPrice.price >= position.takeProfit && position.side === 'BUY') {
                        await this.closePosition(position.userId, position.id);
                    }
                } catch (error) {
                    logger.error(`Error monitoring position ${position.id}:`, error);
                }
            }
        } catch (error) {
            logger.error('Monitor positions error:', error);
        }
    }

    /**
     * Start position monitoring
     */
    startPositionMonitoring() {
        // Monitor positions every 30 seconds
        setInterval(async () => {
            await this.monitorPositions();
        }, 30000);

        logger.info('Position monitoring started');
    }
}

// Export singleton instance
module.exports = new CopyTradingService();