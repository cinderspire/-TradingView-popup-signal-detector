const ccxt = require('ccxt');
const { EventEmitter } = require('events');
const WebSocket = require('ws');

class PriceService extends EventEmitter {
  constructor() {
    super();
    this.prices = new Map(); // pair -> { price, timestamp }
    this.subscriptions = new Set(); // pairs to monitor
    this.wsConnections = new Map(); // exchange -> WebSocket
    this.restExchange = null;
    this.isRunning = false;
    this.tvPriceScraper = null; // TradingView price scraper reference

    console.log('✅ Price Service initialized');
  }

  /**
   * Set TradingView price scraper reference
   * This allows us to use TradingView prices as primary source
   */
  setTradingViewScraper(scraper) {
    this.tvPriceScraper = scraper;
    console.log('✅ TradingView price scraper linked to Price Service');
  }

  async initialize() {
    console.log('🔌 Initializing Price Service...');

    // Initialize REST exchange for fallback
    this.restExchange = new ccxt.binance({
      enableRateLimit: true,
      options: {
        defaultType: 'future'
      }
    });

    await this.restExchange.loadMarkets();

    // Start WebSocket connections
    await this.startWebSocketFeeds();

    // Start price polling as backup
    this.startPricePolling();

    this.isRunning = true;

    console.log('✅ Price Service ready');
  }

  async startWebSocketFeeds() {
    console.log('📡 Starting WebSocket price feeds...');

    // Binance Futures WebSocket
    const binanceWs = new WebSocket('wss://fstream.binance.com/ws/!miniTicker@arr');

    binanceWs.on('open', () => {
      console.log('✅ Connected to Binance price feed');
    });

    binanceWs.on('message', (data) => {
      try {
        const tickers = JSON.parse(data);

        for (const ticker of tickers) {
          // Convert symbol format: BTCUSDT -> BTC/USDT
          const symbol = ticker.s;
          let pair = symbol;

          if (symbol.endsWith('USDT')) {
            pair = symbol.replace('USDT', '/USDT');
          } else if (symbol.endsWith('BUSD')) {
            pair = symbol.replace('BUSD', '/BUSD');
          }

          const price = parseFloat(ticker.c);

          if (price > 0) {
            this.updatePrice(pair, price);
          }
        }
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
      }
    });

    binanceWs.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    binanceWs.on('close', () => {
      console.warn('⚠️  WebSocket closed, reconnecting...');
      setTimeout(() => this.startWebSocketFeeds(), 5000);
    });

    this.wsConnections.set('binance', binanceWs);
  }

  startPricePolling() {
    // Poll for prices every 5 seconds as backup
    setInterval(async () => {
      if (!this.isRunning) return;

      // Poll for subscribed pairs
      for (const pair of this.subscriptions) {
        try {
          const ticker = await this.restExchange.fetchTicker(pair);
          this.updatePrice(pair, ticker.last);
        } catch (error) {
          // Silently fail - WebSocket is primary source
        }
      }
    }, 5000);

    console.log('✅ Price polling started (backup)');
  }

  updatePrice(pair, price) {
    const previous = this.prices.get(pair);

    this.prices.set(pair, {
      price,
      timestamp: Date.now(),
      change: previous ? ((price - previous.price) / previous.price) * 100 : 0
    });

    // Emit price update event
    this.emit('price_update', {
      pair,
      price,
      timestamp: Date.now()
    });
  }

  async getPrice(pair) {
    // PRIORITY 1: Try TradingView scraper first (user's primary request)
    if (this.tvPriceScraper) {
      const tvPrice = this.tvPriceScraper.getPrice(pair);
      if (tvPrice) {
        return tvPrice;
      }
    }

    // PRIORITY 2: Return cached price if fresh (< 2 seconds old) from WebSocket
    const cached = this.prices.get(pair);

    if (cached && Date.now() - cached.timestamp < 2000) {
      return cached.price;
    }

    // PRIORITY 3: Fetch fresh price from Binance Futures API (simple HTTP)
    try {
      // Convert pair format: BTCUSDT.P or BTC/USDT -> BTCUSDT
      let symbol = pair;
      symbol = symbol.replace('.P', '').replace('.p', '').replace('/', '');

      // Fetch from Binance Futures API
      const https = require('https');
      const url = `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`;

      const price = await new Promise((resolve, reject) => {
        https.get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.price) {
                const priceValue = parseFloat(json.price);
                this.updatePrice(pair, priceValue);
                resolve(priceValue);
              } else {
                resolve(0);
              }
            } catch (err) {
              resolve(0);
            }
          });
        }).on('error', () => resolve(0));

        // Timeout after 3 seconds
        setTimeout(() => resolve(cached ? cached.price : 0), 3000);
      });

      return price;
    } catch (error) {
      // Return cached price even if old
      return cached ? cached.price : 0;
    }
  }

  subscribe(pair) {
    this.subscriptions.add(pair);
    console.log(`📊 Subscribed to ${pair} price updates`);
  }

  unsubscribe(pair) {
    this.subscriptions.delete(pair);
    console.log(`📊 Unsubscribed from ${pair} price updates`);
  }

  getAllPrices() {
    const result = {};

    for (const [pair, data] of this.prices.entries()) {
      result[pair] = {
        price: data.price,
        change: data.change,
        timestamp: data.timestamp
      };
    }

    return result;
  }

  getStats() {
    return {
      totalPairs: this.prices.size,
      subscriptions: this.subscriptions.size,
      isRunning: this.isRunning,
      wsConnections: this.wsConnections.size
    };
  }

  async stop() {
    console.log('⏹️  Stopping Price Service...');

    this.isRunning = false;

    // Close WebSocket connections
    for (const ws of this.wsConnections.values()) {
      ws.close();
    }

    this.wsConnections.clear();

    console.log('✅ Price Service stopped');
  }
}

// Singleton instance
module.exports = new PriceService();
