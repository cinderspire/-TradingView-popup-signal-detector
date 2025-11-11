const ccxt = require('ccxt');
const logger = require('../utils/logger');

/**
 * MULTI-SOURCE PRICE SERVICE
 *
 * Fetches real-time prices from multiple exchanges to ensure accuracy
 * and redundancy for Open PnL calculations.
 *
 * Supported exchanges:
 * - Binance (primary)
 * - Bybit (secondary)
 * - MEXC (tertiary)
 * - OKX (fallback)
 *
 * Features:
 * - Caching (60 seconds)
 * - Automatic failover
 * - Price aggregation (median of available sources)
 * - Websocket support for real-time updates (optional)
 */
class MultiSourcePriceService {
  constructor() {
    this.exchanges = {
      binance: new ccxt.binance({ enableRateLimit: true }),
      bybit: new ccxt.bybit({ enableRateLimit: true }),
      mexc: new ccxt.mexc({ enableRateLimit: true }),
      okx: new ccxt.okx({ enableRateLimit: true })
    };

    // Price cache: { symbol: { price, timestamp, sources: {} } }
    this.priceCache = new Map();
    this.CACHE_TTL_MS = 60000; // 60 seconds

    // Exchange status tracking
    this.exchangeStatus = {
      binance: { available: true, lastError: null, errorCount: 0 },
      bybit: { available: true, lastError: null, errorCount: 0 },
      mexc: { available: true, lastError: null, errorCount: 0 },
      okx: { available: true, lastError: null, errorCount: 0 }
    };

    this.MAX_ERRORS_BEFORE_DISABLE = 5;

    logger.info('✅ Multi-Source Price Service initialized');
  }

  /**
   * Get current price for a symbol from multiple sources
   * Returns median price if multiple sources available
   */
  async getPrice(symbol, options = {}) {
    const {
      preferredExchange = null,
      useCache = true,
      minSources = 1
    } = options;

    try {
      // Normalize symbol format
      const normalizedSymbol = this.normalizeSymbol(symbol);

      // Check cache
      if (useCache) {
        const cached = this.getCachedPrice(normalizedSymbol);
        if (cached) {
          logger.debug(`💰 Cache hit for ${normalizedSymbol}: ${cached.price}`);
          return cached.price;
        }
      }

      // Fetch from multiple sources
      const prices = await this.fetchPricesFromSources(normalizedSymbol, preferredExchange);

      if (prices.length === 0) {
        logger.error(`❌ No price sources available for ${normalizedSymbol}`);
        return null;
      }

      if (prices.length < minSources) {
        logger.warn(`⚠️  Only ${prices.length} source(s) for ${normalizedSymbol}, minimum required: ${minSources}`);
      }

      // Calculate median price
      const medianPrice = this.calculateMedian(prices.map(p => p.price));

      // Cache result
      this.cachePrice(normalizedSymbol, medianPrice, prices);

      logger.info(`💰 Price for ${normalizedSymbol}: ${medianPrice} (${prices.length} sources)`);

      return medianPrice;

    } catch (error) {
      logger.error(`❌ Error getting price for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch prices from multiple exchanges
   */
  async fetchPricesFromSources(symbol, preferredExchange = null) {
    const sources = [];

    // Preferred exchange first
    if (preferredExchange && this.exchangeStatus[preferredExchange]?.available) {
      const price = await this.fetchPriceFromExchange(preferredExchange, symbol);
      if (price) {
        sources.push({ exchange: preferredExchange, price, preferred: true });
      }
    }

    // Try all other exchanges in parallel
    const promises = Object.keys(this.exchanges)
      .filter(ex => ex !== preferredExchange && this.exchangeStatus[ex].available)
      .map(async (exchangeName) => {
        const price = await this.fetchPriceFromExchange(exchangeName, symbol);
        if (price) {
          return { exchange: exchangeName, price, preferred: false };
        }
        return null;
      });

    const results = await Promise.allSettled(promises);

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        sources.push(result.value);
      }
    });

    return sources;
  }

  /**
   * Fetch price from a specific exchange
   */
  async fetchPriceFromExchange(exchangeName, symbol) {
    try {
      const exchange = this.exchanges[exchangeName];

      if (!exchange) {
        logger.warn(`⚠️  Exchange ${exchangeName} not configured`);
        return null;
      }

      // Load markets if not loaded
      if (!exchange.markets) {
        await exchange.loadMarkets();
      }

      // Try to fetch ticker
      const ticker = await exchange.fetchTicker(symbol);

      if (!ticker || !ticker.last) {
        logger.warn(`⚠️  No price from ${exchangeName} for ${symbol}`);
        return null;
      }

      // Reset error count on success
      this.exchangeStatus[exchangeName].errorCount = 0;
      this.exchangeStatus[exchangeName].lastError = null;

      logger.debug(`✅ ${exchangeName}: ${symbol} = ${ticker.last}`);
      return ticker.last;

    } catch (error) {
      this.handleExchangeError(exchangeName, error);
      return null;
    }
  }

  /**
   * Handle exchange errors and disable if too many failures
   */
  handleExchangeError(exchangeName, error) {
    const status = this.exchangeStatus[exchangeName];
    status.errorCount++;
    status.lastError = error.message;

    logger.warn(`⚠️  ${exchangeName} error (${status.errorCount}/${this.MAX_ERRORS_BEFORE_DISABLE}): ${error.message}`);

    if (status.errorCount >= this.MAX_ERRORS_BEFORE_DISABLE) {
      status.available = false;
      logger.error(`❌ ${exchangeName} disabled after ${status.errorCount} consecutive errors`);

      // Re-enable after 5 minutes
      setTimeout(() => {
        status.available = true;
        status.errorCount = 0;
        logger.info(`✅ ${exchangeName} re-enabled`);
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Normalize symbol format (handle .P suffix for perpetuals)
   */
  normalizeSymbol(symbol) {
    // Remove .P suffix for perpetual futures
    let normalized = symbol.replace('.P', '');

    // Ensure format is BASE/QUOTE
    if (!normalized.includes('/')) {
      // Assume USDT quote if not specified
      if (normalized.endsWith('USDT')) {
        const base = normalized.replace('USDT', '');
        normalized = `${base}/USDT`;
      } else {
        normalized = `${normalized}/USDT`;
      }
    }

    return normalized;
  }

  /**
   * Get cached price if still valid
   */
  getCachedPrice(symbol) {
    const cached = this.priceCache.get(symbol);

    if (!cached) return null;

    const age = Date.now() - cached.timestamp;

    if (age > this.CACHE_TTL_MS) {
      this.priceCache.delete(symbol);
      return null;
    }

    return cached;
  }

  /**
   * Cache price with metadata
   */
  cachePrice(symbol, price, sources) {
    const sourcesMap = {};
    sources.forEach(s => {
      sourcesMap[s.exchange] = s.price;
    });

    this.priceCache.set(symbol, {
      price,
      timestamp: Date.now(),
      sources: sourcesMap,
      sourceCount: sources.length
    });
  }

  /**
   * Calculate median of array
   */
  calculateMedian(numbers) {
    if (numbers.length === 0) return null;
    if (numbers.length === 1) return numbers[0];

    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * Get price with detailed source information
   */
  async getPriceDetailed(symbol) {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const prices = await this.fetchPricesFromSources(normalizedSymbol);

    if (prices.length === 0) {
      return {
        symbol: normalizedSymbol,
        price: null,
        sources: [],
        error: 'No sources available'
      };
    }

    const medianPrice = this.calculateMedian(prices.map(p => p.price));

    return {
      symbol: normalizedSymbol,
      price: medianPrice,
      sources: prices,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get exchange health status
   */
  getExchangeStatus() {
    return Object.entries(this.exchangeStatus).map(([name, status]) => ({
      exchange: name,
      available: status.available,
      errorCount: status.errorCount,
      lastError: status.lastError
    }));
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.priceCache.clear();
    logger.info('🗑️  Price cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = {
      size: this.priceCache.size,
      entries: []
    };

    this.priceCache.forEach((value, key) => {
      stats.entries.push({
        symbol: key,
        price: value.price,
        age: Date.now() - value.timestamp,
        sourceCount: value.sourceCount
      });
    });

    return stats;
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new MultiSourcePriceService();
    }
    return instance;
  },
  MultiSourcePriceService
};
