// Real Data Service - CCXT Integration for Historical and Real-time Data
// CRITICAL: ONLY REAL DATA - NO SIMULATIONS

import ccxt from 'ccxt';
import { exchangeConfigs } from '../config/exchanges.js';
import { pairDistribution, getExchangeForPair } from '../config/pairs.js';
import settings from '../config/settings.js';
import { TimeframeConverter } from '../utils/timeframeConverter.js';
import { Helpers } from '../utils/helpers.js';
import path from 'path';

export class DataService {
  constructor() {
    this.exchanges = {};
    this.converter = new TimeframeConverter();
    this.initExchanges();
  }

  /**
   * Initialize CCXT exchanges
   */
  initExchanges() {
    for (const [name, config] of Object.entries(exchangeConfigs)) {
      try {
        const ExchangeClass = ccxt[name];
        this.exchanges[name] = new ExchangeClass({
          apiKey: config.apiKey,
          secret: config.secret,
          password: config.password,
          enableRateLimit: config.enableRateLimit,
          ...config.options
        });
        console.log(`✓ ${name} exchange initialized`);
      } catch (err) {
        console.error(`✗ Failed to initialize ${name}:`, err.message);
      }
    }
  }

  /**
   * Download historical OHLCV data from exchange
   * @param {String} exchange - Exchange name (bybit, bitget, mexc)
   * @param {String} pair - Trading pair (e.g., 'BTC/USDT')
   * @param {String} timeframe - Timeframe (1m, 5m, 15m, etc.)
   * @param {Number} since - Start timestamp
   * @param {Number} limit - Number of candles
   */
  async fetchOHLCV(exchange, pair, timeframe = '1m', since = null, limit = 1000) {
    const ex = this.exchanges[exchange];
    if (!ex) throw new Error(`Exchange ${exchange} not initialized`);

    try {
      const candles = await ex.fetchOHLCV(pair, timeframe, since, limit);
      return candles;
    } catch (err) {
      console.error(`Error fetching ${pair} on ${exchange}:`, err.message);
      return [];
    }
  }

  /**
   * Download 2 months of historical 1m data for a pair
   */
  async downloadHistoricalData(pair, months = 2) {
    const exchange = getExchangeForPair(pair);
    if (!exchange) throw new Error(`No exchange found for pair ${pair}`);

    const now = Date.now();
    const monthsAgo = now - (months * 30 * 24 * 60 * 60 * 1000);

    console.log(`Downloading ${months} months of 1m data for ${pair} from ${exchange}...`);

    const allCandles = [];
    let since = monthsAgo;
    const batchSize = 1000; // Most exchanges limit to 1000 candles per request

    while (since < now) {
      const candles = await this.fetchOHLCV(exchange, pair, '1m', since, batchSize);

      if (candles.length === 0) break;

      allCandles.push(...candles);
      since = candles[candles.length - 1][0] + 60000; // Next minute

      // Rate limit protection
      await Helpers.sleep(100);
    }

    console.log(`✓ Downloaded ${allCandles.length} candles for ${pair}`);

    // Save 1m data
    const dataPath = path.join(settings.historicalDataPath, exchange, pair.replace('/', '_'), '1m.json');
    await Helpers.saveJSON(dataPath, allCandles);

    // Generate and save all timeframes
    const allTimeframes = this.converter.convertToAllTimeframes(allCandles);

    for (const [tf, candles] of Object.entries(allTimeframes)) {
      if (tf === '1m') continue; // Already saved
      const tfPath = path.join(settings.historicalDataPath, exchange, pair.replace('/', '_'), `${tf}.json`);
      await Helpers.saveJSON(tfPath, candles);
      console.log(`✓ Generated ${tf} data: ${candles.length} candles`);
    }

    return allCandles;
  }

  /**
   * Download historical data for all pairs
   */
  async downloadAllHistoricalData(months = 2) {
    const allPairs = [...pairDistribution.bybit, ...pairDistribution.bitget, ...pairDistribution.mexc];

    console.log(`\n📥 Downloading ${months} months of data for ${allPairs.length} pairs...\n`);

    let completed = 0;
    for (const pair of allPairs) {
      try {
        await this.downloadHistoricalData(pair, months);
        completed++;
        console.log(`Progress: ${completed}/${allPairs.length}\n`);
      } catch (err) {
        console.error(`Failed to download ${pair}:`, err.message);
      }
    }

    console.log(`\n✅ Download complete! ${completed}/${allPairs.length} pairs successful`);
  }

  /**
   * Load historical data from disk
   * @param {String} pair - Trading pair
   * @param {String} timeframe - Timeframe
   * @param {Boolean} skipDownload - If true, don't download missing data (for batch tests)
   */
  async loadHistoricalData(pair, timeframe = '1m', skipDownload = false) {
    const exchange = getExchangeForPair(pair);
    const dataPath = path.join(settings.historicalDataPath, exchange, pair.replace('/', '_'), `${timeframe}.json`);

    const data = await Helpers.loadJSON(dataPath);
    if (!data) {
      if (skipDownload) {
        // For batch tests, skip pairs without data instead of downloading
        return null;
      }
      console.warn(`No data found for ${pair} ${timeframe}, downloading...`);
      await this.downloadHistoricalData(pair, settings.initialDataMonths);
      return await Helpers.loadJSON(dataPath);
    }

    return data;
  }

  /**
   * Update data with latest candles (for continuous updates)
   */
  async updateLatestData(pair, timeframe = '1m') {
    const exchange = getExchangeForPair(pair);
    const ex = this.exchanges[exchange];

    const dataPath = path.join(settings.historicalDataPath, exchange, pair.replace('/', '_'), `${timeframe}.json`);
    const existingData = await Helpers.loadJSON(dataPath) || [];

    const lastTimestamp = existingData.length > 0 ? existingData[existingData.length - 1][0] : null;
    const since = lastTimestamp ? lastTimestamp + this.converter.getTimeframeMs(timeframe) : null;

    const newCandles = await this.fetchOHLCV(exchange, pair, timeframe, since, 1000);

    if (newCandles.length > 0) {
      const updated = [...existingData, ...newCandles];
      await Helpers.saveJSON(dataPath, updated);
      console.log(`✓ Updated ${pair} ${timeframe}: +${newCandles.length} candles`);
      return newCandles;
    }

    return [];
  }

  /**
   * Get real-time ticker data
   */
  async getTicker(pair) {
    const exchange = getExchangeForPair(pair);
    const ex = this.exchanges[exchange];

    try {
      return await ex.fetchTicker(pair);
    } catch (err) {
      console.error(`Error fetching ticker for ${pair}:`, err.message);
      return null;
    }
  }

  /**
   * Subscribe to real-time WebSocket updates (for paper/real trading)
   */
  async subscribeToTicker(pair, callback) {
    const exchange = getExchangeForPair(pair);
    const ex = this.exchanges[exchange];

    if (!ex.has['ws']) {
      console.warn(`${exchange} does not support WebSocket, falling back to polling (60s interval)`);
      // Fallback to polling - 60 seconds to avoid rate limiting
      const interval = setInterval(async () => {
        const ticker = await this.getTicker(pair);
        if (ticker) callback(ticker);
      }, 60000); // 60 seconds instead of 1 second

      return () => clearInterval(interval);
    }

    // Use WebSocket if available
    try {
      await ex.watchTicker(pair, (ticker) => {
        callback(ticker);
      });
    } catch (err) {
      console.error(`WebSocket error for ${pair}:`, err.message);
    }
  }

  /**
   * Get exchange instance (for trading)
   */
  getExchange(name) {
    return this.exchanges[name];
  }
}

export default DataService;
