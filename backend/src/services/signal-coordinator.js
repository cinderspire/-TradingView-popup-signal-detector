const TradingViewCaptureService = require('./tradingview-capture');
const TradingViewPriceScraper = require('./tradingview-price-scraper');
const TelegramSignalBot = require('./telegram-bot');
const PriceService = require('./price-service');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

class SignalCoordinator extends EventEmitter {
  constructor() {
    super();
    this.tvCapture = null;
    this.tvPriceScraper = null;
    this.telegramBot = null;
    this.signalDistributor = null;
    this.signalCount = 0;
    this.blacklist = [];
    this.blacklistedCount = 0;

    // Load blacklist
    try {
      const blacklistPath = path.join(__dirname, '../config/signal-blacklist.json');
      const blacklistData = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));
      this.blacklist = blacklistData.blacklistedPairs || [];
      console.log(`🚫 Loaded blacklist: ${this.blacklist.length} pairs filtered`);
    } catch (error) {
      console.warn('⚠️  Blacklist file not found, no pairs will be filtered');
    }

    console.log('✅ Signal Coordinator initialized');
  }

  async initialize(signalDistributor) {
    console.log('🚀 Initializing Signal Coordinator...');

    this.signalDistributor = signalDistributor;

    // Initialize TradingView Capture
    if (process.env.ENABLE_TRADINGVIEW_CAPTURE === 'true') {
      try {
        this.tvCapture = new TradingViewCaptureService();
        await this.tvCapture.initialize();
        await this.tvCapture.startMonitoring();

        // Listen for signals
        this.tvCapture.on('signal', async (signal) => {
          await this.handleSignal({
            ...signal,
            source: 'tradingview'
          });
        });

        console.log('✅ TradingView capture initialized');

        // Initialize TradingView Price Scraper
        this.tvPriceScraper = new TradingViewPriceScraper(this.tvCapture);
        await this.tvPriceScraper.startScraping();

        // Link price scraper to Price Service (priority source for prices)
        PriceService.setTradingViewScraper(this.tvPriceScraper);

        console.log('✅ TradingView price scraping initialized');

      } catch (error) {
        console.error('❌ TradingView capture init error:', error);
      }
    }

    // Initialize Telegram Bot
    if (process.env.TELEGRAM_BOT_TOKEN) {
      try {
        this.telegramBot = new TelegramSignalBot();
        await this.telegramBot.initialize();

        // Listen for signals
        this.telegramBot.on('signal', async (signal) => {
          await this.handleSignal({
            ...signal,
            source: 'telegram'
          });
        });

        console.log('✅ Telegram bot initialized');
      } catch (error) {
        console.error('❌ Telegram bot init error:', error);
      }
    }

    console.log('✅ Signal Coordinator ready');
  }

  async handleSignal(signal) {
    const processStart = Date.now();

    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📡 NEW SIGNAL RECEIVED`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Source:    ${signal.source}`);
      console.log(`Pair:      ${signal.pair}`);
      console.log(`Direction: ${signal.direction}`);
      console.log(`Entry:     ${signal.entry}`);
      console.log(`TP:        ${signal.takeProfit || 'N/A'}`);
      console.log(`SL:        ${signal.stopLoss || 'N/A'}`);
      console.log(`Time:      ${new Date().toISOString()}`);
      console.log(`${'='.repeat(80)}\n`);

      // Check blacklist BEFORE counting
      if (this.blacklist.includes(signal.pair)) {
        this.blacklistedCount++;
        console.log(`🚫 BLACKLISTED PAIR: ${signal.pair} - Signal rejected (Poor historical performance)`);
        console.log(`   Total blacklisted signals rejected: ${this.blacklistedCount}\n`);
        return;
      }

      this.signalCount++;

      // Validate signal
      if (!this.validateSignal(signal)) {
        console.error('❌ Signal validation failed');
        return;
      }

      // Save to database
      await this.saveSignal(signal);

      // Broadcast to all subscribers
      if (this.signalDistributor) {
        const broadcastResult = await this.signalDistributor.broadcastSignal(signal);

        console.log(`✅ Broadcast complete:`);
        console.log(`   - Success: ${broadcastResult.success} clients`);
        console.log(`   - Failed:  ${broadcastResult.failed} clients`);
        console.log(`   - Latency: ${broadcastResult.latency}ms`);
      }

      // Emit event for other services
      this.emit('signal_processed', signal);

      const totalLatency = Date.now() - processStart;

      console.log(`\n✅ Signal processing complete: ${totalLatency}ms\n`);

    } catch (error) {
      console.error('❌ Signal handling error:', error);
    }
  }

  validateSignal(signal) {
    // Basic validation
    if (!signal.pair || !signal.direction || !signal.entry) {
      console.error('❌ Missing required fields');
      return false;
    }

    // Validate direction
    if (!['LONG', 'SHORT'].includes(signal.direction)) {
      console.error('❌ Invalid direction');
      return false;
    }

    // Validate entry price
    if (signal.entry <= 0) {
      console.error('❌ Invalid entry price');
      return false;
    }

    // Validate TP/SL if present
    if (signal.takeProfit && signal.takeProfit <= 0) {
      console.error('❌ Invalid take profit');
      return false;
    }

    if (signal.stopLoss && signal.stopLoss <= 0) {
      console.error('❌ Invalid stop loss');
      return false;
    }

    // Validate TP/SL logic
    if (signal.direction === 'LONG') {
      if (signal.takeProfit && signal.takeProfit <= signal.entry) {
        console.error('❌ TP must be above entry for LONG');
        return false;
      }
      if (signal.stopLoss && signal.stopLoss >= signal.entry) {
        console.error('❌ SL must be below entry for LONG');
        return false;
      }
    } else {
      if (signal.takeProfit && signal.takeProfit >= signal.entry) {
        console.error('❌ TP must be below entry for SHORT');
        return false;
      }
      if (signal.stopLoss && signal.stopLoss <= signal.entry) {
        console.error('❌ SL must be above entry for SHORT');
        return false;
      }
    }

    return true;
  }

  async saveSignal(signal) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      // Determine signal type from parsed data
      const signalType = signal.signalType || 'ENTRY';

      await prisma.signal.create({
        data: {
          id: signal.id,
          source: signal.source,
          type: signalType, // Use detected signal type (ENTRY, EXIT, UPDATE)
          symbol: signal.pair, // Database uses 'symbol' field
          direction: signal.direction,
          entryPrice: signal.entry, // Database uses 'entryPrice' field
          stopLoss: signal.stopLoss || null,
          takeProfit: signal.takeProfit || null,
          strategy: signal.strategy || null, // CRITICAL: Save strategy for subscription matching
          rawText: signal.rawText || '',
          createdAt: new Date(signal.timestamp)
        }
      });

      await prisma.$disconnect();

      console.log(`💾 Signal saved to database (Type: ${signalType})`);

      // ALWAYS check for EXIT patterns and trigger matching
      // This handles: explicit EXIT, reversals, flat marketPosition, close action
      const SignalMatcher = require('./signal-matcher');
      const SmartSignalMatcherModule = require('./smart-signal-matcher');
      const SmartSignalMatcher = SmartSignalMatcherModule.instance; // Use singleton

      // Try smart matcher first (handles all patterns)
      try {
        await SmartSignalMatcher.processNewSignal({
          ...signal,
          type: signalType
        });
      } catch (error) {
        console.error('⚠️ Smart matcher error:', error.message);

        // Fallback to legacy matcher for explicit EXIT
        if (signalType === 'EXIT') {
          try {
            await SignalMatcher.matchExitSignal(signal);
          } catch (matchError) {
            console.error('⚠️ Legacy matcher error:', matchError.message);
          }
        }
      }

    } catch (error) {
      console.error('❌ Database save error:', error);
    }
  }

  getStats() {
    const stats = {
      signalCount: this.signalCount,
      blacklistedCount: this.blacklistedCount,
      sources: {}
    };

    if (this.tvCapture) {
      stats.sources.tradingview = this.tvCapture.getStats();
    }

    if (this.tvPriceScraper) {
      stats.sources.priceScraper = this.tvPriceScraper.getStats();
    }

    if (this.telegramBot) {
      stats.sources.telegram = {
        signalCount: this.telegramBot.signalCount,
        authorizedUsers: this.telegramBot.authorizedUsers.size
      };
    }

    return stats;
  }

  async stop() {
    console.log('⏹️  Stopping Signal Coordinator...');

    if (this.tvPriceScraper) {
      this.tvPriceScraper.stop();
    }

    if (this.tvCapture) {
      await this.tvCapture.stop();
    }

    if (this.telegramBot) {
      await this.telegramBot.stop();
    }

    console.log('✅ Signal Coordinator stopped');
  }
}

module.exports = SignalCoordinator;
