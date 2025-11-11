/**
 * WEBSOCKET SERVER - REAL-TIME DATA STREAMING
 * Handles all real-time connections for live price updates, signals, and notifications
 * ONLY REAL DATA - NO FAKE/DEMO CONTENT
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('./utils/logger');
const realDataService = require('./services/realDataService');

class WebSocketServer {
    constructor() {
        this.wss = null;
        this.clients = new Map();
        this.channels = new Map();
        this.realDataService = realDataService;
        this.priceUpdateInterval = null;
        this.signalUpdateInterval = null;
        this.metricsUpdateInterval = null;
    }

    /**
     * Initialize WebSocket server
     */
    initialize(server) {
        this.wss = new WebSocket.Server({
            server,
            path: '/ws',
            clientTracking: true,
            maxPayload: 10 * 1024 * 1024 // 10MB max message size
        });

        this.setupEventHandlers();
        this.startRealTimeUpdates();

        logger.info('✅ WebSocket server initialized');
        return this.wss;
    }

    /**
     * Setup WebSocket event handlers
     */
    setupEventHandlers() {
        this.wss.on('connection', (ws, request) => {
            const clientId = this.generateClientId();
            const clientIp = request.socket.remoteAddress;

            // Initialize client
            this.clients.set(clientId, {
                ws,
                id: clientId,
                ip: clientIp,
                authenticated: false,
                userId: null,
                role: null,
                subscriptions: new Set(),
                connectedAt: new Date(),
                lastActivity: new Date()
            });

            logger.info(`New WebSocket connection: ${clientId} from ${clientIp}`);

            // Send welcome message with real exchange status
            this.sendWelcomeMessage(ws, clientId);

            // Setup client event handlers
            ws.on('message', (message) => this.handleMessage(clientId, message));
            ws.on('pong', () => this.handlePong(clientId));
            ws.on('close', () => this.handleDisconnect(clientId));
            ws.on('error', (error) => this.handleError(clientId, error));

            // Setup heartbeat
            this.setupHeartbeat(clientId);
        });

        this.wss.on('error', (error) => {
            logger.error('WebSocket server error:', error);
        });
    }

    /**
     * Send welcome message with real exchange connection status
     */
    async sendWelcomeMessage(ws, clientId) {
        try {
            const exchangeStatus = await this.realDataService.verifyRealConnections();

            const welcome = {
                type: 'welcome',
                clientId,
                timestamp: new Date().toISOString(),
                server: {
                    name: 'AutomatedTradeBot WebSocket',
                    version: '2.0.0',
                    dataSource: 'REAL_EXCHANGES_ONLY'
                },
                exchanges: exchangeStatus.exchanges,
                availableChannels: [
                    'prices:*',        // Real-time prices
                    'signals:*',       // Trading signals
                    'trades:*',        // Live trades
                    'orderbook:*',     // Order book updates
                    'portfolio',       // Portfolio updates
                    'notifications',   // System notifications
                    'metrics',         // Performance metrics
                    'news'            // Market news
                ],
                message: 'Connected to REAL DATA streaming - NO FAKE/DEMO content'
            };

            ws.send(JSON.stringify(welcome));
        } catch (error) {
            logger.error('Error sending welcome message:', error);
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    async handleMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            const data = JSON.parse(message);
            client.lastActivity = new Date();

            switch (data.type) {
                case 'auth':
                    await this.handleAuthentication(clientId, data);
                    break;

                case 'subscribe':
                    await this.handleSubscribe(clientId, data);
                    break;

                case 'unsubscribe':
                    await this.handleUnsubscribe(clientId, data);
                    break;

                case 'ping':
                    this.handlePing(clientId);
                    break;

                case 'request':
                    await this.handleDataRequest(clientId, data);
                    break;

                case 'order':
                    await this.handleOrderRequest(clientId, data);
                    break;

                default:
                    this.sendError(client.ws, 'Unknown message type');
            }
        } catch (error) {
            logger.error(`Error handling message from ${clientId}:`, error);
            this.sendError(client.ws, 'Invalid message format');
        }
    }

    /**
     * Handle authentication
     */
    async handleAuthentication(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            const { token } = data;
            if (!token) {
                this.sendError(client.ws, 'No token provided');
                return;
            }

            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Update client authentication status
            client.authenticated = true;
            client.userId = decoded.userId;
            client.role = decoded.role;

            // Send authentication success
            client.ws.send(JSON.stringify({
                type: 'auth_success',
                userId: decoded.userId,
                role: decoded.role,
                permissions: this.getPermissionsByRole(decoded.role)
            }));

            logger.info(`Client ${clientId} authenticated as user ${decoded.userId}`);
        } catch (error) {
            logger.error(`Authentication failed for ${clientId}:`, error);
            this.sendError(client.ws, 'Authentication failed');
        }
    }

    /**
     * Handle channel subscription
     */
    async handleSubscribe(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { channel } = data;
        if (!channel) {
            this.sendError(client.ws, 'No channel specified');
            return;
        }

        // Check if channel requires authentication
        if (this.requiresAuth(channel) && !client.authenticated) {
            this.sendError(client.ws, 'Authentication required for this channel');
            return;
        }

        // Add to channel
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Set());
        }
        this.channels.get(channel).add(clientId);
        client.subscriptions.add(channel);

        // Send confirmation
        client.ws.send(JSON.stringify({
            type: 'subscribed',
            channel,
            message: `Subscribed to ${channel}`
        }));

        // Send initial data for the channel
        await this.sendInitialChannelData(clientId, channel);

        logger.info(`Client ${clientId} subscribed to ${channel}`);
    }

    /**
     * Handle channel unsubscription
     */
    handleUnsubscribe(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { channel } = data;
        if (!channel) return;

        // Remove from channel
        if (this.channels.has(channel)) {
            this.channels.get(channel).delete(clientId);
        }
        client.subscriptions.delete(channel);

        // Send confirmation
        client.ws.send(JSON.stringify({
            type: 'unsubscribed',
            channel,
            message: `Unsubscribed from ${channel}`
        }));

        logger.info(`Client ${clientId} unsubscribed from ${channel}`);
    }

    /**
     * Handle data requests
     */
    async handleDataRequest(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { requestType, params } = data;

        try {
            let response;

            switch (requestType) {
                case 'historical':
                    response = await this.realDataService.getRealHistoricalData(
                        params.symbol,
                        params.timeframe,
                        params.startDate,
                        params.endDate,
                        params.exchange
                    );
                    break;

                case 'orderbook':
                    response = await this.realDataService.getRealOrderBook(
                        params.symbol,
                        params.exchange
                    );
                    break;

                case 'trades':
                    response = await this.realDataService.getRealTrades(
                        params.symbol,
                        params.limit,
                        params.exchange
                    );
                    break;

                case 'signals':
                    response = await this.realDataService.getRealTradingSignals();
                    break;

                default:
                    this.sendError(client.ws, 'Unknown request type');
                    return;
            }

            client.ws.send(JSON.stringify({
                type: 'data_response',
                requestType,
                data: response,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            logger.error(`Error handling data request from ${clientId}:`, error);
            this.sendError(client.ws, 'Failed to fetch data');
        }
    }

    /**
     * Send initial data when client subscribes to a channel
     */
    async sendInitialChannelData(clientId, channel) {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            if (channel.startsWith('prices:')) {
                const symbol = channel.split(':')[1];
                const priceData = await this.realDataService.getRealPrice(symbol);

                client.ws.send(JSON.stringify({
                    type: 'price_update',
                    channel,
                    data: priceData,
                    timestamp: new Date().toISOString()
                }));
            } else if (channel === 'signals:all') {
                const signals = await this.realDataService.getRealTradingSignals();

                client.ws.send(JSON.stringify({
                    type: 'signals_update',
                    channel,
                    data: signals,
                    timestamp: new Date().toISOString()
                }));
            } else if (channel === 'metrics') {
                const metrics = await this.getSystemMetrics();

                client.ws.send(JSON.stringify({
                    type: 'metrics_update',
                    channel,
                    data: metrics,
                    timestamp: new Date().toISOString()
                }));
            }
        } catch (error) {
            logger.error(`Error sending initial data for ${channel}:`, error);
        }
    }

    /**
     * Start real-time update intervals
     */
    startRealTimeUpdates() {
        // Update prices every second
        this.priceUpdateInterval = setInterval(async () => {
            await this.broadcastPriceUpdates();
        }, 1000);

        // Update signals every 5 seconds
        this.signalUpdateInterval = setInterval(async () => {
            await this.broadcastSignalUpdates();
        }, 5000);

        // Update system metrics every 10 seconds
        this.metricsUpdateInterval = setInterval(async () => {
            await this.broadcastMetricsUpdates();
        }, 10000);

        logger.info('Started real-time update intervals');
    }

    /**
     * Broadcast price updates to subscribed clients
     */
    async broadcastPriceUpdates() {
        const priceChannels = Array.from(this.channels.keys())
            .filter(channel => channel.startsWith('prices:'));

        for (const channel of priceChannels) {
            const symbol = channel.split(':')[1];
            const subscribers = this.channels.get(channel);

            if (subscribers && subscribers.size > 0) {
                try {
                    const priceData = await this.realDataService.getRealPrice(symbol);

                    const update = {
                        type: 'price_update',
                        channel,
                        data: priceData,
                        timestamp: new Date().toISOString()
                    };

                    this.broadcastToChannel(channel, update);
                } catch (error) {
                    logger.error(`Error broadcasting price update for ${symbol}:`, error);
                }
            }
        }
    }

    /**
     * Broadcast signal updates
     */
    async broadcastSignalUpdates() {
        const signalChannel = 'signals:all';
        const subscribers = this.channels.get(signalChannel);

        if (subscribers && subscribers.size > 0) {
            try {
                const signals = await this.realDataService.getRealTradingSignals();

                const update = {
                    type: 'signals_update',
                    channel: signalChannel,
                    data: signals,
                    timestamp: new Date().toISOString()
                };

                this.broadcastToChannel(signalChannel, update);
            } catch (error) {
                logger.error('Error broadcasting signal updates:', error);
            }
        }
    }

    /**
     * Broadcast system metrics
     */
    async broadcastMetricsUpdates() {
        const metricsChannel = 'metrics';
        const subscribers = this.channels.get(metricsChannel);

        if (subscribers && subscribers.size > 0) {
            try {
                const metrics = await this.getSystemMetrics();

                const update = {
                    type: 'metrics_update',
                    channel: metricsChannel,
                    data: metrics,
                    timestamp: new Date().toISOString()
                };

                this.broadcastToChannel(metricsChannel, update);
            } catch (error) {
                logger.error('Error broadcasting metrics:', error);
            }
        }
    }

    /**
     * Get system metrics
     */
    async getSystemMetrics() {
        const connectedClients = this.clients.size;
        const authenticatedClients = Array.from(this.clients.values())
            .filter(client => client.authenticated).length;
        const activeChannels = this.channels.size;
        const totalSubscriptions = Array.from(this.clients.values())
            .reduce((sum, client) => sum + client.subscriptions.size, 0);

        // Get exchange metrics
        const exchangeStatus = await this.realDataService.verifyRealConnections();

        return {
            websocket: {
                connectedClients,
                authenticatedClients,
                activeChannels,
                totalSubscriptions,
                uptime: process.uptime()
            },
            exchanges: exchangeStatus.exchanges,
            server: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Broadcast message to all subscribers of a channel
     */
    broadcastToChannel(channel, message) {
        const subscribers = this.channels.get(channel);
        if (!subscribers) return;

        const messageStr = JSON.stringify(message);
        let sent = 0;

        subscribers.forEach(clientId => {
            const client = this.clients.get(clientId);
            if (client && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(messageStr);
                sent++;
            }
        });

        if (sent > 0) {
            logger.debug(`Broadcast to ${sent} clients on channel ${channel}`);
        }
    }

    /**
     * Broadcast to all connected clients
     */
    broadcastToAll(message) {
        const messageStr = JSON.stringify(message);
        let sent = 0;

        this.clients.forEach(client => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(messageStr);
                sent++;
            }
        });

        logger.info(`Broadcast to ${sent} clients`);
    }

    /**
     * Send notification to specific user
     */
    sendToUser(userId, message) {
        let sent = 0;
        const messageStr = JSON.stringify(message);

        this.clients.forEach(client => {
            if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(messageStr);
                sent++;
            }
        });

        return sent > 0;
    }

    /**
     * Setup heartbeat for connection monitoring
     */
    setupHeartbeat(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const interval = setInterval(() => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.ping();
            } else {
                clearInterval(interval);
            }
        }, 30000); // Ping every 30 seconds

        client.heartbeatInterval = interval;
    }

    /**
     * Handle pong response
     */
    handlePong(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.lastActivity = new Date();
        }
    }

    /**
     * Handle ping request
     */
    handlePing(clientId) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({ type: 'pong' }));
        }
    }

    /**
     * Handle client disconnect
     */
    handleDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Clean up subscriptions
        client.subscriptions.forEach(channel => {
            if (this.channels.has(channel)) {
                this.channels.get(channel).delete(clientId);
                if (this.channels.get(channel).size === 0) {
                    this.channels.delete(channel);
                }
            }
        });

        // Clear heartbeat
        if (client.heartbeatInterval) {
            clearInterval(client.heartbeatInterval);
        }

        // Remove client
        this.clients.delete(clientId);

        logger.info(`Client ${clientId} disconnected`);
    }

    /**
     * Handle WebSocket errors
     */
    handleError(clientId, error) {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        this.handleDisconnect(clientId);
    }

    /**
     * Send error message to client
     */
    sendError(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'error',
                message,
                timestamp: new Date().toISOString()
            }));
        }
    }

    /**
     * Check if channel requires authentication
     */
    requiresAuth(channel) {
        const publicChannels = ['prices:', 'signals:all', 'metrics', 'news'];
        return !publicChannels.some(publicChannel => channel.startsWith(publicChannel));
    }

    /**
     * Get permissions by role
     */
    getPermissionsByRole(role) {
        const permissions = {
            USER: [
                'view_signals',
                'view_prices',
                'view_own_portfolio',
                'subscribe_providers'
            ],
            PROVIDER: [
                'view_signals',
                'view_prices',
                'view_own_portfolio',
                'subscribe_providers',
                'create_signals',
                'manage_own_strategies',
                'view_followers'
            ],
            ADMIN: [
                'all'
            ]
        };

        return permissions[role] || permissions.USER;
    }

    /**
     * Generate unique client ID
     */
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Broadcast new signal event to strategy subscribers
     */
    broadcastSignalCreated(signal) {
        const strategyChannel = `strategy:${signal.strategyId}`;
        const signalsAllChannel = 'signals:all';

        const message = {
            type: 'signal:new',
            event: 'signal_created',
            data: signal,
            timestamp: new Date().toISOString()
        };

        // Broadcast to strategy-specific channel
        this.broadcastToChannel(strategyChannel, message);

        // Also broadcast to general signals channel
        this.broadcastToChannel(signalsAllChannel, message);

        logger.info(`Broadcasted new signal ${signal.id} to strategy ${signal.strategyId}`);
    }

    /**
     * Broadcast signal update event
     */
    broadcastSignalUpdated(signal) {
        const strategyChannel = `strategy:${signal.strategyId}`;
        const signalsAllChannel = 'signals:all';

        const message = {
            type: 'signal:update',
            event: 'signal_updated',
            data: signal,
            timestamp: new Date().toISOString()
        };

        // Broadcast to strategy-specific channel
        this.broadcastToChannel(strategyChannel, message);

        // Also broadcast to general signals channel
        this.broadcastToChannel(signalsAllChannel, message);

        logger.info(`Broadcasted signal update ${signal.id} to strategy ${signal.strategyId}`);
    }

    /**
     * Broadcast signal closed/cancelled event
     */
    broadcastSignalClosed(signal, reason = 'CANCELLED') {
        const strategyChannel = `strategy:${signal.strategyId}`;
        const signalsAllChannel = 'signals:all';

        const message = {
            type: 'signal:closed',
            event: 'signal_closed',
            data: {
                ...signal,
                closeReason: reason
            },
            timestamp: new Date().toISOString()
        };

        // Broadcast to strategy-specific channel
        this.broadcastToChannel(strategyChannel, message);

        // Also broadcast to general signals channel
        this.broadcastToChannel(signalsAllChannel, message);

        logger.info(`Broadcasted signal closed ${signal.id} (${reason}) to strategy ${signal.strategyId}`);
    }

    /**
     * Broadcast signal execution event
     */
    broadcastSignalExecuted(signal, position) {
        const strategyChannel = `strategy:${signal.strategyId}`;
        const signalsAllChannel = 'signals:all';

        const message = {
            type: 'signal:executed',
            event: 'signal_executed',
            data: {
                signal,
                position
            },
            timestamp: new Date().toISOString()
        };

        // Broadcast to strategy-specific channel
        this.broadcastToChannel(strategyChannel, message);

        // Also broadcast to general signals channel
        this.broadcastToChannel(signalsAllChannel, message);

        // Send to specific user who executed
        if (position && position.userId) {
            this.sendToUser(position.userId, {
                type: 'position:opened',
                event: 'position_opened',
                data: position,
                timestamp: new Date().toISOString()
            });
        }

        logger.info(`Broadcasted signal execution ${signal.id} to strategy ${signal.strategyId}`);
    }

    /**
     * Broadcast position update to user
     */
    broadcastPositionUpdate(position) {
        if (!position || !position.userId) return;

        const message = {
            type: 'position:update',
            event: 'position_updated',
            data: position,
            timestamp: new Date().toISOString()
        };

        this.sendToUser(position.userId, message);
        logger.info(`Broadcasted position update ${position.id} to user ${position.userId}`);
    }

    /**
     * Broadcast position closed to user
     */
    broadcastPositionClosed(position, realizedPnL, pnlPercentage) {
        if (!position || !position.userId) return;

        const message = {
            type: 'position:closed',
            event: 'position_closed',
            data: {
                position,
                realizedPnL,
                pnlPercentage
            },
            timestamp: new Date().toISOString()
        };

        this.sendToUser(position.userId, message);
        logger.info(`Broadcasted position closed ${position.id} to user ${position.userId}`);
    }

    /**
     * Cleanup and shutdown
     */
    shutdown() {
        // Clear intervals
        if (this.priceUpdateInterval) clearInterval(this.priceUpdateInterval);
        if (this.signalUpdateInterval) clearInterval(this.signalUpdateInterval);
        if (this.metricsUpdateInterval) clearInterval(this.metricsUpdateInterval);

        // Notify all clients
        this.broadcastToAll({
            type: 'server_shutdown',
            message: 'Server is shutting down',
            timestamp: new Date().toISOString()
        });

        // Close all connections
        this.clients.forEach(client => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.close(1000, 'Server shutdown');
            }
        });

        // Close WebSocket server
        if (this.wss) {
            this.wss.close();
        }

        logger.info('WebSocket server shut down');
    }
}

// Singleton instance
let wsServer = null;

/**
 * Setup WebSocket server
 */
function setupWebSocket(server) {
    if (!wsServer) {
        wsServer = new WebSocketServer();
        wsServer.initialize(server);
    }
    return wsServer;
}

/**
 * Get WebSocket server instance
 */
function getWebSocketServer() {
    return wsServer;
}

module.exports = {
    setupWebSocket,
    getWebSocketServer,
    WebSocketServer
};

/**
 * WEBSOCKET CLIENT CONNECTION EXAMPLE:
 *
 * const ws = new WebSocket('wss://automatedtradebot.com/ws');
 *
 * // Subscribe to price updates
 * ws.send(JSON.stringify({
 *     type: 'subscribe',
 *     channel: 'prices:BTC/USDT'
 * }));
 *
 * // Subscribe to all signals
 * ws.send(JSON.stringify({
 *     type: 'subscribe',
 *     channel: 'signals:all'
 * }));
 *
 * // Authenticate for private channels
 * ws.send(JSON.stringify({
 *     type: 'auth',
 *     token: 'your_jwt_token_here'
 * }));
 *
 * // Listen for updates
 * ws.on('message', (data) => {
 *     const message = JSON.parse(data);
 *     console.log('Received:', message);
 * });
 */