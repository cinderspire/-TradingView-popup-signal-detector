const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const { redisClient } = require('./rateLimit');

// Verify JWT token and attach user to request
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided. Please log in.', 401);
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted (logged out) - skip if no Redis
    if (redisClient) {
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new AppError('Token is no longer valid. Please log in again.', 401);
      }
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired. Please log in again.', 401));
    }
    next(error);
  }
};

// Check if user has required role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

// Check if user is provider
const requireProvider = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    // Check if user has provider profile
    // This would query the database - simplified here
    const hasProviderProfile = req.user.role === 'PROVIDER' || req.user.role === 'ADMIN';

    if (!hasProviderProfile) {
      return next(
        new AppError('You must be a signal provider to perform this action', 403)
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Check if user has active subscription to provider
const requireSubscription = (providerIdParam = 'providerId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401));
      }

      const providerId = req.params[providerIdParam] || req.body.providerId;

      // Skip check for admin
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if user has active subscription to this provider
      // This would query the database - simplified here
      // const hasSubscription = await checkSubscriptionExists(req.user.id, providerId);

      // For now, just pass through - implement actual check in production
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Optional authentication (don't fail if no token)
const authenticateOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    // If token is invalid, just continue without user
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  requireProvider,
  requireSubscription,
  authenticateOptional
};
