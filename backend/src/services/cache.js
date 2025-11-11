/**
 * Redis Cache Service
 * High-performance caching layer for API responses, prices, and analytics
 */

const Redis = require('ioredis');

class CacheService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: false,
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected');
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    this.redis.on('ready', () => {
      console.log('🚀 Redis ready for caching');
    });

    // Default TTLs (Time To Live)
    this.TTL = {
      MARKETPLACE: 300,      // 5 minutes - marketplace strategies
      PRICES: 10,            // 10 seconds - real-time prices
      ANALYTICS: 60,         // 1 minute - analytics data
      SIGNALS: 5,            // 5 seconds - active signals
      USER_DATA: 30,         // 30 seconds - user portfolio
      HEALTH: 15,            // 15 seconds - health check
      BACKTEST: 3600,        // 1 hour - backtest results
      CORRELATION: 1800,     // 30 minutes - correlation matrix
    };
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      // Try to parse JSON, if fails return raw value
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      console.error(`❌ Cache GET error for ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttl = this.TTL.MARKETPLACE) {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error(`❌ Cache SET error for ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Cache DEL error for ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async delPattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error(`❌ Cache DEL PATTERN error for ${pattern}:`, error.message);
      return 0;
    }
  }

  /**
   * Increment value (for counters)
   */
  async incr(key, ttl = 86400) {
    try {
      const value = await this.redis.incr(key);
      if (value === 1 && ttl) {
        // First increment, set TTL
        await this.redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      console.error(`❌ Cache INCR error for ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Get multiple values at once
   */
  async mget(keys) {
    try {
      const values = await this.redis.mget(keys);
      return values.map(v => {
        if (!v) return null;
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      });
    } catch (error) {
      console.error('❌ Cache MGET error:', error.message);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values at once
   */
  async mset(keyValuePairs, ttl = this.TTL.MARKETPLACE) {
    try {
      const pipeline = this.redis.pipeline();

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        pipeline.setex(key, ttl, serialized);
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('❌ Cache MSET error:', error.message);
      return false;
    }
  }

  /**
   * Cache wrapper for async functions
   * Usage: const result = await cache.wrap('my-key', () => expensiveOperation(), 300);
   */
  async wrap(key, fn, ttl = this.TTL.MARKETPLACE) {
    // Try to get from cache
    const cached = await this.get(key);
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, ttl);

    return { data: result, fromCache: false };
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const info = await this.redis.info('stats');
      const dbsize = await this.redis.dbsize();

      return {
        keysCount: dbsize,
        info: info,
      };
    } catch (error) {
      console.error('❌ Cache stats error:', error.message);
      return null;
    }
  }

  /**
   * Flush all cache
   */
  async flushAll() {
    try {
      await this.redis.flushall();
      console.log('🗑️  All cache flushed');
      return true;
    } catch (error) {
      console.error('❌ Cache flush error:', error.message);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
  }
}

// Singleton instance
module.exports = new CacheService();
