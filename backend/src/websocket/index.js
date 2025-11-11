const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io;

const setupWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    },
    pingInterval: parseInt(process.env.WS_PING_INTERVAL) || 25000,
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT) || 60000
  });

  // Authentication middleware for WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      logger.error('WebSocket auth error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.userId} (${socket.userEmail})`);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Join provider room if user is a provider
    if (socket.userRole === 'provider' || socket.userRole === 'admin') {
      socket.join('providers');
    }

    // Subscribe to provider's signals
    socket.on('subscribe:provider', (providerId) => {
      // TODO: Verify user has active subscription to this provider
      socket.join(`provider:${providerId}`);
      logger.info(`User ${socket.userId} subscribed to provider ${providerId}`);
      socket.emit('subscribed', { providerId });
    });

    // Unsubscribe from provider's signals
    socket.on('unsubscribe:provider', (providerId) => {
      socket.leave(`provider:${providerId}`);
      logger.info(`User ${socket.userId} unsubscribed from provider ${providerId}`);
      socket.emit('unsubscribed', { providerId });
    });

    // Get online status
    socket.on('request:online_users', async () => {
      const sockets = await io.fetchSockets();
      socket.emit('online_users', { count: sockets.length });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`WebSocket client disconnected: ${socket.userId} - Reason: ${reason}`);
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`WebSocket error for user ${socket.userId}:`, error);
    });
  });

  logger.info('✅ WebSocket server initialized');
};

// Emit new signal to subscribers
const emitNewSignal = (providerId, signal) => {
  if (!io) {
    logger.error('WebSocket not initialized');
    return;
  }

  io.to(`provider:${providerId}`).emit('signal:new', signal);
  logger.info(`New signal emitted to provider ${providerId} subscribers`);
};

// Emit signal update
const emitSignalUpdate = (providerId, signal) => {
  if (!io) {
    logger.error('WebSocket not initialized');
    return;
  }

  io.to(`provider:${providerId}`).emit('signal:update', signal);
  logger.info(`Signal update emitted to provider ${providerId} subscribers`);
};

// Emit signal close
const emitSignalClose = (providerId, signal) => {
  if (!io) {
    logger.error('WebSocket not initialized');
    return;
  }

  io.to(`provider:${providerId}`).emit('signal:close', signal);
  logger.info(`Signal close emitted to provider ${providerId} subscribers`);
};

// Emit performance update
const emitPerformanceUpdate = (providerId, stats) => {
  if (!io) {
    logger.error('WebSocket not initialized');
    return;
  }

  io.to(`provider:${providerId}`).emit('performance:update', stats);
  logger.info(`Performance update emitted for provider ${providerId}`);
};

// Send notification to specific user
const sendUserNotification = (userId, notification) => {
  if (!io) {
    logger.error('WebSocket not initialized');
    return;
  }

  io.to(`user:${userId}`).emit('notification', notification);
  logger.info(`Notification sent to user ${userId}`);
};

// Broadcast to all connected clients
const broadcast = (event, data) => {
  if (!io) {
    logger.error('WebSocket not initialized');
    return;
  }

  io.emit(event, data);
  logger.info(`Broadcast event: ${event}`);
};

module.exports = {
  setupWebSocket,
  emitNewSignal,
  emitSignalUpdate,
  emitSignalClose,
  emitPerformanceUpdate,
  sendUserNotification,
  broadcast
};
