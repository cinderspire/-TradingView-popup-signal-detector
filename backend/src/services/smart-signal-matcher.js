/**
 * SMART SIGNAL MATCHER V2
 *
 * Solves ALL signal matching problems:
 * 1. Duplicate prevention (same signal sent multiple times)
 * 2. Auto-close on new entry (new LONG closes old LONG)
 * 3. Direction conflict detection (SHORT signal on LONG position = CLOSE)
 * 4. Auto-expire old signals (48 hours)
 * 5. NULL handling
 * 6. Position size changes detection
 * 7. Reversal detection (position flips)
 * 8. marketPosition: 'flat' detection
 * 9. action: 'close' detection
 */

const { PrismaClient } = require('@prisma/client');

class SmartSignalMatcher {
  constructor(tradeMatcher) {
    this.tradeMatcher = tradeMatcher;
    this.prisma = new PrismaClient();
    this.recentSignals = new Map(); // For duplicate detection
    this.DUPLICATE_WINDOW_MS = 5000; // 5 seconds
    this.AUTO_EXPIRE_HOURS = 48;
  }

  /**
   * Process new signal from database (added for signal-coordinator integration)
   */
  async processNewSignal(signal) {
    try {
      // Parse rawText to extract pattern data
      const signalData = this.parseSignalData(signal.rawText);

      // Check for EXIT patterns
      const exitCheck = this.isExitSignal(signal, signalData);

      if (!exitCheck.isExit) {
        console.log(`ℹ️  [SmartMatcher] Not an EXIT signal: ${signal.pair || signal.symbol}`);
        return null;
      }

      console.log(`🔍 [SmartMatcher] EXIT pattern detected: ${exitCheck.pattern}`);

      // Find matching open ENTRY
      const openEntry = await this.findOpenEntry(signal, exitCheck.exitDirection, signalData);

      if (!openEntry) {
        console.log(`⚠️  [SmartMatcher] No matching open ENTRY found for ${signal.pair || signal.symbol} ${exitCheck.exitDirection}`);
        return null;
      }

      // Calculate P&L
      const exitPrice = signal.entry || signal.entryPrice;
      const pnl = this.calculatePnL(openEntry.entryPrice, exitPrice, openEntry.direction);

      // Close the ENTRY signal
      await this.prisma.signal.update({
        where: { id: openEntry.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(signal.timestamp || Date.now()),
          exitPrice: exitPrice,
          profitLoss: pnl
        }
      });

      // CRITICAL FIX: Mark the EXIT signal as EXECUTED
      await this.prisma.signal.update({
        where: { id: signal.id },
        data: {
          status: 'EXECUTED'
        }
      });

      const emoji = pnl > 0 ? '✅' : '❌';
      console.log(`${emoji} [SmartMatcher] Closed: ${openEntry.symbol} ${openEntry.direction} | ${pnl.toFixed(2)}% | Pattern: ${exitCheck.pattern}`);

      return {
        matched: true,
        pnl,
        pattern: exitCheck.pattern
      };

    } catch (error) {
      console.error('❌ [SmartMatcher] Error:', error);
      return null;
    }
  }

  /**
   * Parse signal rawText JSON
   */
  parseSignalData(rawText) {
    if (!rawText) return null;

    try {
      const jsonStart = rawText.indexOf('{');
      const jsonEnd = rawText.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) return null;

      const jsonStr = rawText.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonStr);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if signal represents an EXIT
   */
  isExitSignal(signal, data) {
    // Case 1: Explicit EXIT type
    if (signal.type === 'EXIT') {
      return { isExit: true, exitDirection: signal.direction, pattern: 'explicit_exit' };
    }

    if (!data) return { isExit: false };

    // Case 2: marketPosition is 'flat'
    if (data.marketPosition === 'flat') {
      const exitDirection = data.prevMarketPosition === 'long' ? 'LONG' : 'SHORT';
      return { isExit: true, exitDirection, pattern: 'flat_position' };
    }

    // Case 3: action is 'close'
    if (data.action === 'close') {
      const exitDirection = data.prevMarketPosition === 'long' ? 'LONG' : 'SHORT';
      return { isExit: true, exitDirection, pattern: 'close_action' };
    }

    // Case 4: Reversal (position flip)
    if (data.prevMarketPosition &&
        data.prevMarketPosition !== 'flat' &&
        data.prevMarketPosition !== data.marketPosition) {
      const exitDirection = data.prevMarketPosition === 'long' ? 'LONG' : 'SHORT';
      return { isExit: true, exitDirection, pattern: 'reversal', newDirection: data.marketPosition };
    }

    return { isExit: false };
  }

  /**
   * Find matching open ENTRY signal
   */
  async findOpenEntry(signal, direction, data) {
    const symbol = signal.pair || signal.symbol;

    // Extract strategy name from rawText (handles both EXIT and ENTRY formats)
    // EXIT format: "3RSI{..."
    // ENTRY format: "Alert on ARUSDT.P3RSI{..."
    let strategyName = null;
    if (signal.rawText) {
      // Try to find the text immediately before the first {
      const beforeBrace = signal.rawText.split('{')[0];
      // Remove common prefixes and symbol names to get the strategy name
      const cleaned = beforeBrace
        .replace(/^Alert on /i, '')
        .replace(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
        .replace(/[^A-Za-z0-9 ]/g, '')
        .trim();
      strategyName = cleaned || null;
    }

    // Build query
    const where = {
      symbol: symbol,
      type: 'ENTRY',
      direction: direction,
      closedAt: null,
      status: { in: ['PENDING', 'ACTIVE', 'EXECUTED'] }
    };

    // CRITICAL FIX: Match by strategy if identifiable
    // OLD format: "Alert on ROSEUSDT.P7RSI{..."
    // NEW format: "7RSI{..."
    // Solution: Use contains to match both formats
    if (strategyName) {
      where.rawText = { contains: strategyName };
    }

    // Find oldest open ENTRY (FIFO)
    return await this.prisma.signal.findFirst({
      where,
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Calculate P&L percentage
   */
  calculatePnL(entryPrice, exitPrice, direction) {
    if (!entryPrice || !exitPrice) return 0;

    const fee = 0.1; // 0.1% total fees
    let pnl;

    if (direction === 'LONG') {
      pnl = ((exitPrice - entryPrice) / entryPrice * 100) - fee;
    } else {
      pnl = ((entryPrice - exitPrice) / entryPrice * 100) - fee;
    }

    return parseFloat(pnl.toFixed(4));
  }

  /**
   * Process signal with smart matching
   */
  processSignal(signal, existingActiveSignals = []) {
    console.log(`\n🔍 [SmartMatcher] Processing: ${signal.strategy} ${signal.pair}`);

    // Step 1: Duplicate detection
    if (this.isDuplicate(signal)) {
      console.log(`⚠️  [SmartMatcher] DUPLICATE detected - skipping`);
      return { type: 'DUPLICATE', skipped: true };
    }

    // Step 2: Detect action
    const action = this.detectSmartAction(signal, existingActiveSignals);
    console.log(`📊 [SmartMatcher] Action detected: ${action}`);

    // Step 3: Handle based on action
    switch (action) {
      case 'CLOSE_OLD_AND_OPEN_NEW':
        return this.closeOldAndOpenNew(signal, existingActiveSignals);

      case 'CLOSE_ONLY':
        return this.closeOnly(signal, existingActiveSignals);

      case 'OPEN_NEW':
        return this.openNew(signal);

      default:
        console.log(`⚠️  [SmartMatcher] Unknown action: ${action}`);
        return null;
    }
  }

  /**
   * Check if signal is duplicate (same signal sent within 5 seconds)
   */
  isDuplicate(signal) {
    const key = `${signal.strategy}_${signal.pair}_${signal.direction}_${signal.entry || signal.entryPrice}`;
    const now = Date.now();

    // Clean old entries
    for (const [k, timestamp] of this.recentSignals.entries()) {
      if (now - timestamp > this.DUPLICATE_WINDOW_MS) {
        this.recentSignals.delete(k);
      }
    }

    // Check if duplicate
    if (this.recentSignals.has(key)) {
      const lastTime = this.recentSignals.get(key);
      if (now - lastTime < this.DUPLICATE_WINDOW_MS) {
        return true; // Duplicate!
      }
    }

    // Mark as seen
    this.recentSignals.set(key, now);
    return false;
  }

  /**
   * Smart action detection
   */
  detectSmartAction(signal, existingActiveSignals) {
    const key = `${signal.strategy}_${signal.pair}`;

    // Find existing open positions for this strategy+pair
    const openPositions = existingActiveSignals.filter(s =>
      s.strategy === signal.strategy &&
      s.pair === signal.pair &&
      s.status !== 'Closed'
    );

    console.log(`   Open positions for ${key}: ${openPositions.length}`);

    // Get signal properties
    const direction = (signal.direction || '').toUpperCase();
    const marketPos = (signal.marketPosition || '').toLowerCase();
    const contracts = parseFloat(signal.contracts || signal.positionSize || 0);
    const hasPrice = !!(signal.entry || signal.entryPrice || signal.price);

    // CASE 1: contracts = 0 → CLOSE
    if (contracts === 0 && openPositions.length > 0) {
      console.log(`   → CLOSE (contracts=0)`);
      return 'CLOSE_ONLY';
    }

    // CASE 2: marketPosition = flat → CLOSE
    if (marketPos === 'flat' && openPositions.length > 0) {
      console.log(`   → CLOSE (marketPosition=flat)`);
      return 'CLOSE_ONLY';
    }

    // CASE 3: Direction conflict (SHORT signal on LONG position) → CLOSE OLD + OPEN NEW
    if (openPositions.length > 0) {
      const oldDirection = openPositions[0].direction?.toUpperCase();

      // If direction changed (LONG→SHORT or SHORT→LONG), close old and open new
      if (direction && oldDirection && direction !== oldDirection && hasPrice) {
        console.log(`   → CLOSE OLD (${oldDirection}) + OPEN NEW (${direction})`);
        return 'CLOSE_OLD_AND_OPEN_NEW';
      }

      // If same direction but new entry price, close old and open new
      if (direction && oldDirection && direction === oldDirection && hasPrice) {
        console.log(`   → CLOSE OLD + OPEN NEW (new entry on same direction)`);
        return 'CLOSE_OLD_AND_OPEN_NEW';
      }
    }

    // CASE 4: No open positions + has entry price → OPEN NEW
    if (openPositions.length === 0 && hasPrice && contracts > 0) {
      console.log(`   → OPEN NEW`);
      return 'OPEN_NEW';
    }

    // CASE 5: Unknown - log for debugging
    console.log(`   → UNKNOWN (openPos: ${openPositions.length}, direction: ${direction}, contracts: ${contracts}, hasPrice: ${hasPrice})`);
    return 'OPEN_NEW'; // Default to open
  }

  /**
   * Close old position and open new one
   */
  closeOldAndOpenNew(signal, existingActiveSignals) {
    const key = `${signal.strategy}_${signal.pair}`;
    const openPositions = existingActiveSignals.filter(s =>
      s.strategy === signal.strategy &&
      s.pair === signal.pair &&
      s.status !== 'Closed'
    );

    const closedTrades = [];

    // Close all old positions using TradeMatcher
    for (const oldSignal of openPositions) {
      const closeSignal = {
        ...signal,
        id: `close_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        action: 'SELL',
        marketPosition: 'flat'
      };

      const result = this.tradeMatcher.handleExit(
        this.tradeMatcher.getPositionKey(oldSignal),
        closeSignal
      );

      if (result && result.trades) {
        closedTrades.push(...result.trades);
      }
    }

    console.log(`✅ [SmartMatcher] Closed ${closedTrades.length} old positions`);

    // Open new position
    const newPosition = this.tradeMatcher.handleEntry(
      this.tradeMatcher.getPositionKey(signal),
      signal
    );

    return {
      type: 'CLOSE_AND_OPEN',
      closedTrades,
      newPosition: newPosition?.position
    };
  }

  /**
   * Close only (no new position)
   */
  closeOnly(signal, existingActiveSignals) {
    const openPositions = existingActiveSignals.filter(s =>
      s.strategy === signal.strategy &&
      s.pair === signal.pair &&
      s.status !== 'Closed'
    );

    const closedTrades = [];

    for (const oldSignal of openPositions) {
      const closeSignal = {
        ...signal,
        action: 'SELL',
        marketPosition: 'flat'
      };

      const result = this.tradeMatcher.handleExit(
        this.tradeMatcher.getPositionKey(oldSignal),
        closeSignal
      );

      if (result && result.trades) {
        closedTrades.push(...result.trades);
      }
    }

    console.log(`✅ [SmartMatcher] Closed ${closedTrades.length} positions`);

    return {
      type: 'CLOSE_ONLY',
      closedTrades
    };
  }

  /**
   * Open new position
   */
  openNew(signal) {
    const result = this.tradeMatcher.processSignal(signal);
    return result;
  }

  /**
   * Auto-expire old signals (called periodically)
   */
  expireOldSignals(activeSignals) {
    const now = Date.now();
    const expireThresholdMs = this.AUTO_EXPIRE_HOURS * 60 * 60 * 1000;
    const expiredSignals = [];

    for (const signal of activeSignals) {
      const signalTime = new Date(signal.createdAt || signal.timestamp || now).getTime();
      const ageMs = now - signalTime;

      if (ageMs > expireThresholdMs) {
        expiredSignals.push(signal);
        console.log(`⏰ [SmartMatcher] Auto-expiring old signal: ${signal.strategy} ${signal.pair} (age: ${Math.floor(ageMs / 1000 / 60 / 60)}h)`);
      }
    }

    return expiredSignals;
  }
}

// Export both class and singleton instance
module.exports = SmartSignalMatcher;

// Also export singleton instance for signal-coordinator
module.exports.instance = new SmartSignalMatcher(null);
