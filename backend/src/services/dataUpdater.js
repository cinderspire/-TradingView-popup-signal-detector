// Continuous Data Updater - Keeps historical data up-to-date
// Runs in background and updates candles for all priority pairs

import settings from '../config/settings.js';
import { pairDistribution } from '../config/pairs.js';

export class DataUpdater {
  constructor(dataService) {
    this.dataService = dataService;
    this.updateInterval = null;
    this.isRunning = false;
  }

  /**
   * Start continuous data updates
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Data updater already running');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting continuous data updater...');

    // Get priority pairs (first 20 most important)
    const priorityPairs = [
      ...pairDistribution.bybit.slice(0, 10),
      ...pairDistribution.bitget.slice(0, 5),
      ...pairDistribution.mexc.slice(0, 5)
    ];

    // Update immediately
    this.updateAllPairs(priorityPairs);

    // Then update every 1 minute
    this.updateInterval = setInterval(() => {
      this.updateAllPairs(priorityPairs);
    }, 60000); // 1 minute

    console.log(`✅ Data updater started for ${priorityPairs.length} pairs`);
  }

  /**
   * Stop continuous updates
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️  Data updater stopped');
  }

  /**
   * Update data for all pairs
   */
  async updateAllPairs(pairs) {
    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    
    for (const pair of pairs) {
      for (const timeframe of timeframes) {
        try {
          await this.dataService.updateLatestData(pair, timeframe);
        } catch (err) {
          // Silent fail for individual updates
          if (err.message.includes('No data found')) {
            // Skip pairs without existing data
            continue;
          }
          console.error(`Update failed for ${pair} ${timeframe}:`, err.message);
        }
      }
      
      // Small delay between pairs to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🔄 Updated ${pairs.length} pairs at ${new Date().toISOString()}`);
  }
}

export default DataUpdater;
