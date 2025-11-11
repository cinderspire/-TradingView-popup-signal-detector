const rateLimit = require('express-rate-limit');

// General rate limiter (memory store - for development)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  },
  skipSuccessfulRequests: true
});

// Signal creation limiter (prevent spam)
const signalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 signals per minute
  message: {
    success: false,
    message: 'Too many signals created, please slow down.'
  }
});

// Dummy redis client for now
const redisClient = null;

module.exports = limiter;
module.exports.authLimiter = authLimiter;
module.exports.signalLimiter = signalLimiter;
module.exports.redisClient = redisClient;
