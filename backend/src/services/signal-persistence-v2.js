const fs = require('fs').promises;
const path = require('path');
const TradeMatcher = require('./trade-matcher');
const SmartSignalMatcher = require('./smart-signal-matcher');

/**
 * ULTRA STABLE SIGNAL PERSISTENCE SYSTEM V3
 *
 * Features:
 * - Active/Closed signals in separate files (FAST)
 * - Monthly archives (NEVER DELETED)
 * - Signal age tracking (hours/days)
 * - Signal ID + Strategy/Pair matching (PRECISE)
 * - Zero data loss (ATOMIC WRITES)
 * - Race condition free (QUEUE SYSTEM)
 * - FIFO Trade Matching (ACCURATE PnL)
 * - Smart Signal Matching (DUPLICATE PREVENTION + AUTO-CLOSE)
 */
class SignalPersistenceV2 {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data/signals');
    this.activePath = path.join(this.dataDir, 'active.json');
    this.metadataPath = path.join(this.dataDir, 'metadata.json');
    this.tradeMatcher = new TradeMatcher(); // FIFO matching engine
    this.smartMatcher = new SmartSignalMatcher(this.tradeMatcher); // Smart matcher

    this.activeSignals = []; // In-memory cache for speed
    this.metadata = {
      totalSignals: 0,
      totalClosed: 0,
      totalActive: 0,
      lastUpdate: null
    };

    this.initialized = false;
    this.saveQueue = Promise.resolve(); // Prevent race conditions

    // Auto-cleanup interval (every 1 hour)
    this.autoCleanupInterval = setInterval(() => {
      this.autoCleanupExpiredSignals().catch(err => {
        console.error('❌ Auto-cleanup error:', err);
      });
    }, 60 * 60 * 1000); // 1 hour
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Signal Persistence V2...');

      // Create directory structure
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'closed'), { recursive: true });

      // Load active signals
      try {
        const data = await fs.readFile(this.activePath, 'utf8');
        this.activeSignals = JSON.parse(data);
        console.log(`✅ Loaded ${this.activeSignals.length} active signals`);
      } catch (err) {
        this.activeSignals = [];
        console.log('📊 No active signals - starting fresh');
      }

      // Load metadata
      try {
        const metaData = await fs.readFile(this.metadataPath, 'utf8');
        this.metadata = JSON.parse(metaData);
        console.log(`📈 Loaded metadata: ${this.metadata.totalSignals} total signals`);
      } catch (err) {
        await this.saveMetadata();
        console.log('📊 Metadata initialized');
      }

      this.initialized = true;
      console.log('✅ Signal Persistence V2 ready');

    } catch (error) {
      console.error('❌ Error initializing Signal Persistence V2:', error);
      this.initialized = true; // Continue anyway
    }
  }

  /**
   * Add new signal with SMART matching (V3)
   */
  async addSignal(signal) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Log signal details for debugging
    console.log(`📥 Processing signal: ${signal.strategy} ${signal.pair} - dir: ${signal.direction}, marketPos: ${signal.marketPosition}, contracts: ${signal.contracts}`);

    // Use SMART MATCHER (handles duplicates, auto-close, conflicts)
    const matchResult = this.smartMatcher.processSignal(signal, this.activeSignals);

    // Handle different match results
    if (!matchResult || matchResult.skipped) {
      console.log(`⚠️  Signal skipped (duplicate or invalid)`);
      return matchResult;
    }

    if (matchResult.type === 'CLOSE_AND_OPEN') {
      // Closed old positions and opened new one
      console.log(`✅ SMART MATCH: Closed ${matchResult.closedTrades.length} old position(s), opened new`);

      // Save completed trades
      for (const trade of matchResult.closedTrades) {
        await this.saveCompletedTrade(trade);
        this.metadata.totalClosed++;
      }

      // Remove closed signals from active
      this.activeSignals = this.activeSignals.filter(s =>
        !(s.strategy === signal.strategy && s.pair === signal.pair)
      );

      // Add new position
      const enrichedSignal = this.enrichSignal(signal);
      this.activeSignals.push(enrichedSignal);
      this.metadata.totalActive = this.activeSignals.length;

      // Save
      this.queueSave();
      await this.saveMetadata();

      return { ...matchResult, newSignal: enrichedSignal };
    }

    if (matchResult.type === 'CLOSE_ONLY') {
      // Just closed positions, no new entry
      console.log(`✅ CLOSE ONLY: Closed ${matchResult.closedTrades.length} position(s)`);

      for (const trade of matchResult.closedTrades) {
        await this.saveCompletedTrade(trade);
        this.metadata.totalClosed++;
      }

      // Remove from active
      this.activeSignals = this.activeSignals.filter(s =>
        !(s.strategy === signal.strategy && s.pair === signal.pair)
      );
      this.metadata.totalActive = this.activeSignals.length;

      this.queueSave();
      await this.saveMetadata();

      return matchResult;
    }

    if (matchResult.type === 'ENTRY') {
      // New entry position
      console.log(`✅ NEW ENTRY: ${signal.strategy} ${signal.pair}`);

      const enrichedSignal = this.enrichSignal(signal);
      this.activeSignals.push(enrichedSignal);

      this.metadata.totalSignals++;
      this.metadata.totalActive = this.activeSignals.length;
      this.metadata.lastUpdate = new Date().toISOString();

      this.queueSave();

      return enrichedSignal;
    }

    // Fallback: treat as new entry
    console.log(`⚠️  Unknown match type: ${matchResult.type} - treating as new entry`);
    const enrichedSignal = this.enrichSignal(signal);
    this.activeSignals.push(enrichedSignal);
    this.metadata.totalActive = this.activeSignals.length;
    this.queueSave();

    return enrichedSignal;
  }

  /**
   * Enrich signal with metadata
   */
  enrichSignal(signal) {
    return {
      ...signal,
      createdAt: signal.timestamp || signal.createdAt || new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      status: 'Active',
      ageHours: 0,
      ageDays: 0
    };
  }

  /**
   * Save completed trade (QUEUED to prevent race conditions)
   */
  async saveCompletedTrade(trade) {
    const tradesFile = path.join(this.dataDir, 'completed_trades.json');

    // Use queue to prevent concurrent writes corrupting the file
    return this.saveQueue = this.saveQueue.then(async () => {
      try {
        let trades = [];
        try {
          const data = await fs.readFile(tradesFile, 'utf-8');
          trades = JSON.parse(data);
        } catch (err) {
          // File doesn't exist yet
        }

        trades.push(trade);

        // Save atomically
        await fs.writeFile(tradesFile + '.tmp', JSON.stringify(trades, null, 2));
        await fs.rename(tradesFile + '.tmp', tradesFile);

        console.log(`💾 Completed trade saved: ${trade.strategy} ${trade.pair} PnL: ${trade.pnlPercent.toFixed(2)}%`);
      } catch (err) {
        console.error('❌ Error saving completed trade:', err);
      }
    });
  }

  /**
   * Close signal - move from active to closed
   */
  async closeSignal(signalId, exitPrice, finalPnL, reason = 'Manual') {
    if (!this.initialized) {
      await this.initialize();
    }

    // Find in active signals
    const index = this.activeSignals.findIndex(s => s.id === signalId);
    if (index === -1) {
      console.log(`⚠️  Signal ${signalId} not found in active signals`);
      return null;
    }

    const signal = this.activeSignals[index];

    // Calculate age
    const createdAt = new Date(signal.createdAt || signal.timestamp);
    const closedAt = new Date();
    const ageMs = closedAt - createdAt;
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    const ageDays = Math.floor(ageHours / 24);

    // Create closed signal
    const closedSignal = {
      ...signal,
      status: 'Closed',
      exitPrice,
      finalPnL,
      closeReason: reason,
      closedAt: closedAt.toISOString(),
      ageHours,
      ageDays,
      ageText: this.formatAge(ageHours, ageDays)
    };

    // Remove from active
    this.activeSignals.splice(index, 1);

    // Add to closed file (monthly)
    await this.addToClosedArchive(closedSignal);

    // Update metadata
    this.metadata.totalActive--;
    this.metadata.totalClosed++;
    this.metadata.lastUpdate = new Date().toISOString();

    // Save active signals
    this.queueSave();

    console.log(`🔒 Signal closed: ${signalId} | Age: ${closedSignal.ageText} | PnL: ${finalPnL?.toFixed(2)}%`);
    return closedSignal;
  }

  /**
   * Find active signal by ID (FASTEST)
   */
  findActiveSignalById(signalId) {
    return this.activeSignals.find(s => s.id === signalId);
  }

  /**
   * Find active signal by strategy + pair (FALLBACK)
   */
  findActiveSignalByStrategyPair(strategy, pair) {
    // Get all matching signals
    const matches = this.activeSignals.filter(s =>
      s.strategy === strategy && s.pair === pair
    );

    if (matches.length === 0) return null;

    // Return the NEWEST one (last added)
    return matches[matches.length - 1];
  }

  /**
   * Get all active signals
   */
  getAllActiveSignals() {
    return [...this.activeSignals]; // Return copy
  }

  /**
   * Get closed signals for current month
   */
  async getClosedSignalsThisMonth() {
    const month = this.getCurrentMonth();
    const closedPath = path.join(this.dataDir, 'closed', `${month}.json`);

    try {
      const data = await fs.readFile(closedPath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      return [];
    }
  }

  /**
   * Get all signals (active + closed this month)
   */
  async getAllSignals() {
    const active = this.getAllActiveSignals();
    const closed = await this.getClosedSignalsThisMonth();
    return [...active, ...closed];
  }

  /**
   * Update signal (for PnL updates)
   */
  updateSignal(signalId, updates) {
    try {
      const signal = this.findActiveSignalById(signalId);
      if (!signal) return Promise.resolve(null);

      Object.assign(signal, updates, {
        lastUpdate: new Date().toISOString()
      });

      // Don't save every update (too frequent)
      // Only save on close or periodically
      return Promise.resolve(signal);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Add signal to monthly closed archive
   */
  async addToClosedArchive(closedSignal) {
    const month = this.getCurrentMonth();
    const closedPath = path.join(this.dataDir, 'closed', `${month}.json`);

    return this.saveQueue = this.saveQueue.then(async () => {
      try {
        // Read existing
        let closedSignals = [];
        try {
          const data = await fs.readFile(closedPath, 'utf8');
          closedSignals = JSON.parse(data);
        } catch (err) {
          // File doesn't exist yet
        }

        // Add new signal
        closedSignals.push(closedSignal);

        // Write atomically
        const tempPath = closedPath + '.tmp';
        await fs.writeFile(tempPath, JSON.stringify(closedSignals, null, 2), 'utf8');
        await fs.rename(tempPath, closedPath);

      } catch (error) {
        console.error('❌ Error adding to closed archive:', error);
      }
    });
  }

  /**
   * Save active signals to disk (QUEUED)
   */
  queueSave() {
    this.saveQueue = this.saveQueue.then(async () => {
      const maxRetries = 3;
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Write active signals atomically with unique suffix to avoid collisions
          const uniqueTempPath = `${this.activePath}.tmp.${Date.now()}.${process.pid}`;
          await fs.writeFile(uniqueTempPath, JSON.stringify(this.activeSignals, null, 2), 'utf8');
          await fs.rename(uniqueTempPath, this.activePath);

          // Save metadata
          await this.saveMetadata();

          // Success
          return;
        } catch (error) {
          lastError = error;

          if (attempt < maxRetries) {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 50 * attempt));
          }
        }
      }

      // All retries failed
      console.error(`❌ Error saving active signals after ${maxRetries} attempts:`, lastError.message);
    });
  }

  /**
   * Save metadata with retry logic and error handling
   */
  async saveMetadata() {
    const tempPath = this.metadataPath + '.tmp';
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add unique suffix to temp file to avoid collisions
        const uniqueTempPath = `${tempPath}.${Date.now()}.${process.pid}`;

        // Write to unique temp file
        await fs.writeFile(uniqueTempPath, JSON.stringify(this.metadata, null, 2), 'utf8');

        // Atomic rename
        await fs.rename(uniqueTempPath, this.metadataPath);

        // Success
        return;
      } catch (error) {
        lastError = error;

        // Clean up failed temp file
        try {
          await fs.unlink(tempPath).catch(() => {});
        } catch (cleanupError) {
          // Ignore cleanup errors
        }

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        }
      }
    }

    // All retries failed
    console.error(`❌ Failed to save metadata after ${maxRetries} attempts:`, lastError.message);
  }

  /**
   * Get current month string (YYYY-MM)
   */
  getCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Format age as human readable
   */
  formatAge(hours, days) {
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h`;
  }

  /**
   * Update all signal ages (run periodically)
   */
  updateSignalAges() {
    const now = new Date();

    for (const signal of this.activeSignals) {
      const createdAt = new Date(signal.createdAt || signal.timestamp);
      const ageMs = now - createdAt;
      signal.ageHours = Math.floor(ageMs / (1000 * 60 * 60));
      signal.ageDays = Math.floor(signal.ageHours / 24);
      signal.ageText = this.formatAge(signal.ageHours, signal.ageDays);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.metadata,
      activeSignals: this.activeSignals.length,
      currentMonth: this.getCurrentMonth()
    };
  }

  /**
   * Periodic cleanup: Close any flat positions that slipped through
   */
  async cleanupFlatPositions() {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log('🧹 Running flat position cleanup...');

    const flatSignals = this.activeSignals.filter(s =>
      s.marketPosition === 'flat' ||
      (s.positionSize !== null &&
       s.positionSize !== undefined &&
       parseFloat(s.positionSize) === 0)
    );

    if (flatSignals.length === 0) {
      console.log('✅ No flat positions found in active signals');
      return 0;
    }

    console.log(`🔴 Found ${flatSignals.length} flat positions to close`);

    let closedCount = 0;
    for (const signal of flatSignals) {
      try {
        await this.closeSignal(
          signal.id,
          signal.entry || 0,
          signal.currentPnL || 0,
          'cleanup:marketPosition=flat'
        );
        closedCount++;
      } catch (err) {
        console.error(`❌ Error closing signal ${signal.id}:`, err.message);
      }
    }

    console.log(`✅ Cleanup completed: ${closedCount} positions closed`);
    return closedCount;
  }

  /**
   * Auto-cleanup expired signals (48+ hours old)
   */
  async autoCleanupExpiredSignals() {
    if (!this.initialized) return 0;

    console.log('⏰ Running auto-cleanup for expired signals...');

    const expiredSignals = this.smartMatcher.expireOldSignals(this.activeSignals);

    if (expiredSignals.length === 0) {
      console.log('✅ No expired signals to clean up');
      return 0;
    }

    console.log(`🗑️  Found ${expiredSignals.length} expired signals (>48h old)`);

    let closedCount = 0;
    for (const signal of expiredSignals) {
      try {
        // Create close signal
        const closeSignal = {
          ...signal,
          id: `auto_close_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          action: 'SELL',
          marketPosition: 'flat',
          entry: signal.currentPrice || signal.entry || 0,
          closeReason: 'auto-expired (>48h)'
        };

        // Close via trade matcher
        const key = this.tradeMatcher.getPositionKey(signal);
        const result = this.tradeMatcher.handleExit(key, closeSignal);

        if (result && result.trades) {
          for (const trade of result.trades) {
            await this.saveCompletedTrade(trade);
            this.metadata.totalClosed++;
          }
        }

        // Remove from active
        this.activeSignals = this.activeSignals.filter(s => s.id !== signal.id);
        closedCount++;

      } catch (err) {
        console.error(`❌ Error auto-closing expired signal ${signal.id}:`, err.message);
      }
    }

    // Update metadata
    this.metadata.totalActive = this.activeSignals.length;
    await this.saveMetadata();
    this.queueSave();

    console.log(`✅ Auto-cleanup completed: ${closedCount}/${expiredSignals.length} expired signals closed`);
    return closedCount;
  }

  /**
   * Start periodic cleanup (runs every 5 minutes)
   */
  startPeriodicCleanup() {
    // Cleanup flat positions every 5 minutes
    setInterval(async () => {
      try {
        await this.cleanupFlatPositions();
      } catch (err) {
        console.error('❌ Periodic cleanup error:', err);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Cleanup expired signals every 1 hour
    setInterval(async () => {
      try {
        await this.autoCleanupExpiredSignals();
      } catch (err) {
        console.error('❌ Auto-expire cleanup error:', err);
      }
    }, 60 * 60 * 1000); // 1 hour

    console.log('🔄 Periodic cleanup started:');
    console.log('   - Flat positions: every 5 minutes');
    console.log('   - Expired signals (>48h): every 1 hour');
  }
}

// Singleton instance with auto-initialization
const signalPersistenceV2 = new SignalPersistenceV2();
signalPersistenceV2.initialize().then(() => {
  // Start periodic cleanup after initialization
  signalPersistenceV2.startPeriodicCleanup();
}).catch(err => {
  console.error('❌ Failed to initialize Signal Persistence V2:', err);
});
module.exports = signalPersistenceV2;
