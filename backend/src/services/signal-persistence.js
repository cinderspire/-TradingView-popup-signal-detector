const fs = require('fs').promises;
const path = require('path');

class SignalPersistence {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/signals-history.json');
    this.signals = [];
    this.initialized = false;
    this.saveQueue = Promise.resolve(); // Serialize saves to prevent race conditions
  }

  async initialize() {
    try {
      // Create data directory if not exists
      const dataDir = path.dirname(this.dbPath);
      try {
        await fs.mkdir(dataDir, { recursive: true });
      } catch (err) {
        // Directory already exists
      }

      // Load existing signals
      try {
        const data = await fs.readFile(this.dbPath, 'utf8');
        this.signals = JSON.parse(data);
        console.log(`✅ Loaded ${this.signals.length} signals from database`);
      } catch (err) {
        // File doesn't exist yet
        this.signals = [];
        console.log('📊 No existing signals database - starting fresh');
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Error initializing signal persistence:', error);
      this.signals = [];
      this.initialized = true;
    }
  }

  async saveSignal(signal) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Add signal to memory
    this.signals.push({
      ...signal,
      savedAt: new Date().toISOString()
    });

    // Save to disk (async, don't wait)
    this.saveToDisk().catch(err => {
      console.error('❌ Error saving signals to disk:', err);
    });

    return signal;
  }

  async updateSignal(signalId, updates) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Find and update signal in memory
    const signalIndex = this.signals.findIndex(s => s.id === signalId);
    if (signalIndex !== -1) {
      this.signals[signalIndex] = {
        ...this.signals[signalIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Save to disk (async, don't wait)
      this.saveToDisk().catch(err => {
        console.error('❌ Error saving updated signal to disk:', err);
      });

      return this.signals[signalIndex];
    }

    return null;
  }

  async saveToDisk() {
    // Queue saves to prevent concurrent writes
    this.saveQueue = this.saveQueue.then(async () => {
      try {
        await fs.writeFile(
          this.dbPath,
          JSON.stringify(this.signals, null, 2),
          'utf8'
        );
      } catch (error) {
        console.error('❌ Error writing signals to disk:', error);
      }
    });
    return this.saveQueue;
  }

  async getAllSignals() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.signals;
  }

  async getSignalsByStrategy(strategy) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.signals.filter(s => s.strategy === strategy);
  }

  async getStats() {
    if (!this.initialized) {
      await this.initialize();
    }

    const strategies = new Map();
    for (const signal of this.signals) {
      const name = signal.strategy || 'Unknown';
      strategies.set(name, (strategies.get(name) || 0) + 1);
    }

    return {
      totalSignals: this.signals.length,
      strategies: Array.from(strategies.entries()).map(([name, count]) => ({
        name,
        count
      }))
    };
  }
}

// Singleton instance
const signalPersistence = new SignalPersistence();

module.exports = signalPersistence;
