/**
 * Advanced Rate Limiting Middleware
 * Protect API endpoints from abuse
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

/**
 * General API rate limiter - 100 requests per 15 minutes
 */
const generalLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:general:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for auth endpoints - 5 requests per 15 minutes
 */
const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * Trading endpoint limiter - 30 requests per minute
 */
const tradingLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:trading:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: {
    success: false,
    error: 'Trading rate limit exceeded',
    retryAfter: '1 minute'
  },
});

/**
 * Marketplace limiter - 20 requests per minute
 */
const marketplaceLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:marketplace:',
  }),
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Marketplace rate limit exceeded',
    retryAfter: '1 minute'
  },
});

/**
 * Export limiter - 3 requests per hour
 */
const exportLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:export:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    error: 'Export rate limit exceeded',
    retryAfter: '1 hour'
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  tradingLimiter,
  marketplaceLimiter,
  exportLimiter,
};
