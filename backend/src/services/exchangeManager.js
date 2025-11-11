const ccxt = require('ccxt');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Exchange Manager Service
 * Manages multiple exchange connections, API key encryption, and order execution
 */
class ExchangeManager {
  constructor() {
    this.exchanges = new Map(); // userId_exchange -> exchange instance
    this.encryptionAlgorithm = process.env.API_KEY_ENCRYPTION_ALGO || 'aes-256-gcm';
    this.encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-change-this-in-production', 'utf8');
  }

  /**
   * Initialize exchange for a user
   */
  async initializeExchange(userId, exchangeName, options = {}) {
    try {
      // Get user's API keys from database
      const apiKeyRecord = await prisma.apiKey.findFirst({
        where: {
          userId,
          exchange: exchangeName,
          isActive: true
        }
      });

      if (!apiKeyRecord) {
        throw new Error(`No active API keys found for ${exchangeName}`);
      }

      // Decrypt API keys
      const apiKey = this.decrypt(apiKeyRecord.apiKey);
      const apiSecret = this.decrypt(apiKeyRecord.apiSecret);
      const apiPassphrase = apiKeyRecord.apiPassphrase ? this.decrypt(apiKeyRecord.apiPassphrase) : null;

      // Create exchange instance
      const ExchangeClass = ccxt[exchangeName];
      if (!ExchangeClass) {
        throw new Error(`Exchange ${exchangeName} not supported`);
      }

      const exchangeConfig = {
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        options: {
          defaultType: options.defaultType || 'future',
          ...options
        }
      };

      if (apiPassphrase) {
        exchangeConfig.password = apiPassphrase;
      }

      // Add testnet URLs if configured
      if (options.testnet || process.env[`${exchangeName.toUpperCase()}_TESTNET`] === 'true') {
        exchangeConfig.urls = this.getTestnetUrls(exchangeName);
      }

      const exchange = new ExchangeClass(exchangeConfig);
      
      // Load markets
      await exchange.loadMarkets();

      // Store exchange instance
      const key = `${userId}_${exchangeName}`;
      this.exchanges.set(key, exchange);

      console.log(`[ExchangeManager] Initialized ${exchangeName} for user ${userId}`);

      return exchange;
    } catch (error) {
      console.error(`[ExchangeManager] Failed to initialize exchange:`, error);
      throw error;
    }
  }

  /**
   * Get exchange instance for user
   */
  getExchange(userId, exchangeName) {
    const key = `${userId}_${exchangeName}`;
    return this.exchanges.get(key);
  }

  /**
   * Get or create exchange instance
   */
  async getOrCreateExchange(userId, exchangeName, options = {}) {
    let exchange = this.getExchange(userId, exchangeName);
    
    if (!exchange) {
      exchange = await this.initializeExchange(userId, exchangeName, options);
    }
    
    return exchange;
  }

  /**
   * Save encrypted API keys to database
   */
  async saveApiKeys(userId, exchangeName, apiKey, apiSecret, apiPassphrase = null, permissions = []) {
    try {
      // Encrypt API credentials
      const encryptedKey = this.encrypt(apiKey);
      const encryptedSecret = this.encrypt(apiSecret);
      const encryptedPassphrase = apiPassphrase ? this.encrypt(apiPassphrase) : null;

      // Save to database
      const record = await prisma.apiKey.create({
        data: {
          userId,
          exchange: exchangeName,
          apiKey: encryptedKey,
          apiSecret: encryptedSecret,
          apiPassphrase: encryptedPassphrase,
          permissions,
          isActive: true
        }
      });

      console.log(`[ExchangeManager] API keys saved for user ${userId} on ${exchangeName}`);

      return record;
    } catch (error) {
      console.error(`[ExchangeManager] Failed to save API keys:`, error);
      throw error;
    }
  }

  /**
   * Execute market order
   */
  async executeMarketOrder(userId, exchangeName, symbol, side, amount, params = {}) {
    try {
      const exchange = await this.getOrCreateExchange(userId, exchangeName);
      
      const order = await exchange.createOrder(
        symbol,
        'market',
        side,
        amount,
        undefined,
        params
      );

      console.log(`[ExchangeManager] Market order executed:`, order);

      return order;
    } catch (error) {
      console.error(`[ExchangeManager] Market order failed:`, error);
      throw error;
    }
  }

  /**
   * Execute limit order
   */
  async executeLimitOrder(userId, exchangeName, symbol, side, amount, price, params = {}) {
    try {
      const exchange = await this.getOrCreateExchange(userId, exchangeName);
      
      const order = await exchange.createOrder(
        symbol,
        'limit',
        side,
        amount,
        price,
        params
      );

      console.log(`[ExchangeManager] Limit order executed:`, order);

      return order;
    } catch (error) {
      console.error(`[ExchangeManager] Limit order failed:`, error);
      throw error;
    }
  }

  /**
   * Set leverage for a symbol
   */
  async setLeverage(userId, exchangeName, symbol, leverage) {
    try {
      const exchange = await this.getOrCreateExchange(userId, exchangeName);
      
      if (exchange.has['setLeverage']) {
        await exchange.setLeverage(leverage, symbol);
        console.log(`[ExchangeManager] Leverage set to ${leverage}x for ${symbol}`);
      }
    } catch (error) {
      console.error(`[ExchangeManager] Failed to set leverage:`, error);
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(userId, exchangeName) {
    try {
      const exchange = await this.getOrCreateExchange(userId, exchangeName);
      const balance = await exchange.fetchBalance();
      
      return balance;
    } catch (error) {
      console.error(`[ExchangeManager] Failed to fetch balance:`, error);
      throw error;
    }
  }

  /**
   * Get open positions
   */
  async getPositions(userId, exchangeName, symbol = null) {
    try {
      const exchange = await this.getOrCreateExchange(userId, exchangeName);
      
      if (exchange.has['fetchPositions']) {
        const positions = await exchange.fetchPositions(symbol ? [symbol] : undefined);
        return positions;
      }
      
      return [];
    } catch (error) {
      console.error(`[ExchangeManager] Failed to fetch positions:`, error);
      throw error;
    }
  }

  /**
   * Get ticker data
   */
  async getTicker(exchangeName, symbol) {
    try {
      // Use system exchange (no user auth needed for public data)
      const exchange = await this.getSystemExchange(exchangeName);
      const ticker = await exchange.fetchTicker(symbol);
      
      return ticker;
    } catch (error) {
      console.error(`[ExchangeManager] Failed to fetch ticker:`, error);
      throw error;
    }
  }

  /**
   * Get OHLCV data
   */
  async getOHLCV(exchangeName, symbol, timeframe = '15m', limit = 500) {
    try {
      const exchange = await this.getSystemExchange(exchangeName);
      const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
      
      return ohlcv;
    } catch (error) {
      console.error(`[ExchangeManager] Failed to fetch OHLCV:`, error);
      throw error;
    }
  }

  /**
   * Get system exchange (for public data, no auth required)
   */
  async getSystemExchange(exchangeName) {
    const key = `system_${exchangeName}`;
    let exchange = this.exchanges.get(key);
    
    if (!exchange) {
      const ExchangeClass = ccxt[exchangeName];
      if (!ExchangeClass) {
        throw new Error(`Exchange ${exchangeName} not supported`);
      }

      const exchangeConfig = {
        enableRateLimit: true,
        options: {
          defaultType: 'future'
        }
      };

      // Add testnet URLs if configured
      if (process.env[`${exchangeName.toUpperCase()}_TESTNET`] === 'true') {
        exchangeConfig.urls = this.getTestnetUrls(exchangeName);
      }

      exchange = new ExchangeClass(exchangeConfig);
      await exchange.loadMarkets();
      
      this.exchanges.set(key, exchange);
    }
    
    return exchange;
  }

  /**
   * Encrypt data
   */
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.encryptionAlgorithm, this.encryptionKey.slice(0, 32), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data
   */
  decrypt(encryptedData) {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, this.encryptionKey.slice(0, 32), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get testnet URLs for exchanges
   */
  getTestnetUrls(exchangeName) {
    const testnetUrls = {
      bybit: {
        api: {
          public: 'https://api-testnet.bybit.com',
          private: 'https://api-testnet.bybit.com'
        }
      },
      binance: {
        api: {
          public: 'https://testnet.binancefuture.com',
          private: 'https://testnet.binancefuture.com'
        }
      }
    };

    return testnetUrls[exchangeName] || {};
  }

  /**
   * Test API keys
   */
  async testApiKeys(userId, exchangeName) {
    try {
      const exchange = await this.getOrCreateExchange(userId, exchangeName);
      const balance = await exchange.fetchBalance();
      
      return {
        success: true,
        message: 'API keys are valid',
        balance: balance.total
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.toString()
      };
    }
  }

  /**
   * Remove exchange instance
   */
  removeExchange(userId, exchangeName) {
    const key = `${userId}_${exchangeName}`;
    this.exchanges.delete(key);
    console.log(`[ExchangeManager] Removed exchange instance for ${userId} on ${exchangeName}`);
  }

  /**
   * Get supported exchanges
   */
  getSupportedExchanges() {
    return ['bybit', 'binance', 'mexc', 'bitget', 'okx', 'kucoin'];
  }
}

module.exports = new ExchangeManager();
