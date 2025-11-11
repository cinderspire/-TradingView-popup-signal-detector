/**
 * IP Rotation Service for Exchange API Requests
 * Prevents rate limiting when user traffic increases
 */

class IPRotationService {
  constructor() {
    // Pool of proxy servers (can be expanded with real proxies)
    this.proxyPool = [
      { host: 'proxy1.example.com', port: 8080, user: '', pass: '', active: true },
      { host: 'proxy2.example.com', port: 8080, user: '', pass: '', active: true },
      { host: 'proxy3.example.com', port: 8080, user: '', pass: '', active: true }
    ];

    // Exchange-specific rate limits (requests per minute)
    this.exchangeLimits = {
      'binance': { public: 1200, private: 1200, weight: 6000 },
      'bybit': { public: 120, private: 120 },
      'mexc': { public: 20, private: 20 },
      'bitget': { public: 20, private: 10 },
      'kucoin': { public: 100, private: 100 },
      'okx': { public: 20, private: 20 },
      'huobi': { public: 100, private: 100 },
      'gateio': { public: 900, private: 900 }
    };

    // Request tracking per exchange
    this.requestTracking = new Map();

    // User session mapping to proxy
    this.userProxyMap = new Map();

    // Initialize request tracking for each exchange
    Object.keys(this.exchangeLimits).forEach(exchange => {
      this.requestTracking.set(exchange, {
        public: [],
        private: [],
        weight: 0
      });
    });

    // Cleanup old requests every minute
    setInterval(() => this.cleanupOldRequests(), 60000);
  }

  /**
   * Get best proxy for user session
   */
  getProxyForUser(userId) {
    // Check if user already has assigned proxy
    if (this.userProxyMap.has(userId)) {
      return this.userProxyMap.get(userId);
    }

    // Assign least loaded proxy
    const proxy = this.getLeastLoadedProxy();
    this.userProxyMap.set(userId, proxy);

    // Clean up old mappings after 1 hour
    setTimeout(() => {
      this.userProxyMap.delete(userId);
    }, 3600000);

    return proxy;
  }

  /**
   * Get least loaded proxy from pool
   */
  getLeastLoadedProxy() {
    const activeProxies = this.proxyPool.filter(p => p.active);

    if (activeProxies.length === 0) {
      return null; // No proxy, use direct connection
    }

    // Simple round-robin for now (can be enhanced with load metrics)
    const randomIndex = Math.floor(Math.random() * activeProxies.length);
    return activeProxies[randomIndex];
  }

  /**
   * Check if request can be made without hitting rate limit
   */
  canMakeRequest(exchange, requestType = 'public', weight = 1) {
    const limits = this.exchangeLimits[exchange];
    if (!limits) return true; // Unknown exchange, allow

    const tracking = this.requestTracking.get(exchange);
    if (!tracking) return true;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Filter requests in last minute
    tracking[requestType] = tracking[requestType].filter(t => t > oneMinuteAgo);

    // Check rate limit
    const currentRequests = tracking[requestType].length;
    const limit = limits[requestType];

    // For Binance, also check weight limits
    if (exchange === 'binance' && limits.weight) {
      const currentWeight = tracking.weight;
      if (currentWeight + weight > limits.weight) {
        return false;
      }
    }

    return currentRequests < limit;
  }

  /**
   * Record a request
   */
  recordRequest(exchange, requestType = 'public', weight = 1) {
    const tracking = this.requestTracking.get(exchange);
    if (!tracking) return;

    tracking[requestType].push(Date.now());

    // For Binance, track weight
    if (exchange === 'binance') {
      tracking.weight += weight;
    }
  }

  /**
   * Get wait time before next request can be made
   */
  getWaitTime(exchange, requestType = 'public') {
    if (this.canMakeRequest(exchange, requestType)) {
      return 0;
    }

    const tracking = this.requestTracking.get(exchange);
    if (!tracking || tracking[requestType].length === 0) {
      return 0;
    }

    // Find oldest request
    const oldestRequest = Math.min(...tracking[requestType]);
    const oneMinuteLater = oldestRequest + 60000;
    const now = Date.now();

    return Math.max(0, oneMinuteLater - now);
  }

  /**
   * Clean up old request records
   */
  cleanupOldRequests() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    this.requestTracking.forEach((tracking, exchange) => {
      tracking.public = tracking.public.filter(t => t > oneMinuteAgo);
      tracking.private = tracking.private.filter(t => t > oneMinuteAgo);

      // Reset Binance weight counter every minute
      if (exchange === 'binance') {
        tracking.weight = 0;
      }
    });
  }

  /**
   * Get request configuration with proxy if needed
   */
  getRequestConfig(userId, exchange, requestType = 'public') {
    const config = {};

    // Check if we need to use proxy
    const shouldUseProxy = this.shouldUseProxy(exchange, requestType);

    if (shouldUseProxy) {
      const proxy = this.getProxyForUser(userId);
      if (proxy) {
        config.proxy = {
          host: proxy.host,
          port: proxy.port
        };

        if (proxy.user && proxy.pass) {
          config.proxy.auth = {
            username: proxy.user,
            password: proxy.pass
          };
        }
      }
    }

    // Add headers to avoid detection
    config.headers = {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache'
    };

    return config;
  }

  /**
   * Determine if proxy should be used
   */
  shouldUseProxy(exchange, requestType) {
    const tracking = this.requestTracking.get(exchange);
    if (!tracking) return false;

    const limits = this.exchangeLimits[exchange];
    if (!limits) return false;

    // Use proxy if we're above 70% of rate limit
    const currentRequests = tracking[requestType].length;
    const limit = limits[requestType];

    return currentRequests > (limit * 0.7);
  }

  /**
   * Get random user agent
   */
  getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
    ];

    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Distribute load across multiple exchange accounts
   */
  async distributeLoad(exchange, requests) {
    const batchSize = this.exchangeLimits[exchange]?.public || 10;
    const batches = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    const results = [];

    for (const batch of batches) {
      // Wait if needed
      const waitTime = this.getWaitTime(exchange, 'public');
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }

      // Process batch
      const batchResults = await Promise.all(
        batch.map(req => this.executeWithRetry(req, exchange))
      );

      results.push(...batchResults);

      // Small delay between batches
      await this.sleep(100);
    }

    return results;
  }

  /**
   * Execute request with retry logic
   */
  async executeWithRetry(requestFn, exchange, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Check rate limit
        if (!this.canMakeRequest(exchange)) {
          const waitTime = this.getWaitTime(exchange);
          await this.sleep(waitTime);
        }

        // Record request
        this.recordRequest(exchange);

        // Execute
        const result = await requestFn();
        return result;

      } catch (error) {
        lastError = error;

        // Check if rate limited
        if (error.message?.includes('rate') || error.code === 429) {
          // Exponential backoff
          const backoffTime = Math.pow(2, i) * 1000;
          await this.sleep(backoffTime);
        } else {
          throw error; // Non-rate-limit error
        }
      }
    }

    throw lastError;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current load statistics
   */
  getLoadStats() {
    const stats = {};

    this.requestTracking.forEach((tracking, exchange) => {
      const limits = this.exchangeLimits[exchange];
      stats[exchange] = {
        public: {
          current: tracking.public.length,
          limit: limits.public,
          percentage: (tracking.public.length / limits.public) * 100
        },
        private: {
          current: tracking.private.length,
          limit: limits.private,
          percentage: (tracking.private.length / limits.private) * 100
        }
      };

      if (exchange === 'binance') {
        stats[exchange].weight = {
          current: tracking.weight,
          limit: limits.weight,
          percentage: (tracking.weight / limits.weight) * 100
        };
      }
    });

    return stats;
  }

  /**
   * Mark proxy as inactive
   */
  markProxyInactive(proxyHost) {
    const proxy = this.proxyPool.find(p => p.host === proxyHost);
    if (proxy) {
      proxy.active = false;

      // Reactivate after 5 minutes
      setTimeout(() => {
        proxy.active = true;
      }, 300000);
    }
  }

  /**
   * Add new proxy to pool
   */
  addProxy(proxyConfig) {
    this.proxyPool.push({
      ...proxyConfig,
      active: true
    });
  }

  /**
   * Remove proxy from pool
   */
  removeProxy(proxyHost) {
    this.proxyPool = this.proxyPool.filter(p => p.host !== proxyHost);
  }
}

module.exports = new IPRotationService();