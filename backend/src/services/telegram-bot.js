const TelegramBot = require('node-telegram-bot-api');
const { EventEmitter } = require('events');

class TelegramSignalBot extends EventEmitter {
  constructor() {
    super();
    this.bot = null;
    this.authorizedUsers = new Set();
    this.signalCount = 0;
  }

  async initialize() {
    console.log('🤖 Initializing Telegram Signal Bot...');

    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN not found in environment variables');
    }

    this.bot = new TelegramBot(token, { polling: true });

    // Load authorized users from env
    const authorizedUsersStr = process.env.TELEGRAM_AUTHORIZED_USERS || '';
    authorizedUsersStr.split(',').forEach(userId => {
      if (userId.trim()) {
        this.authorizedUsers.add(parseInt(userId.trim()));
      }
    });

    console.log(`✅ Authorized users: ${this.authorizedUsers.size}`);

    // Setup command handlers
    this.setupHandlers();

    console.log('✅ Telegram Signal Bot initialized');
  }

  setupHandlers() {
    // /start command
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      console.log(`📱 /start from user ${userId}`);

      if (this.authorizedUsers.has(userId)) {
        await this.bot.sendMessage(chatId,
          `✅ Welcome to AutomatedTradeBot Signal System!\n\n` +
          `You are authorized to send signals.\n\n` +
          `**Signal Format:**\n` +
          `BTC/USDT LONG @ 45000 TP: 46000 SL: 44500\n\n` +
          `**Commands:**\n` +
          `/stats - View signal statistics\n` +
          `/help - Show help\n\n` +
          `Just send your signals directly!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await this.bot.sendMessage(chatId,
          `⚠️ You are not authorized to send signals.\n\n` +
          `Your User ID: ${userId}\n\n` +
          `Contact the administrator to get access.`
        );
      }
    });

    // /stats command
    this.bot.onText(/\/stats/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      if (!this.authorizedUsers.has(userId)) {
        await this.bot.sendMessage(chatId, '⚠️ Unauthorized');
        return;
      }

      await this.bot.sendMessage(chatId,
        `📊 **Signal Statistics**\n\n` +
        `Total Signals Sent: ${this.signalCount}\n` +
        `Authorized Users: ${this.authorizedUsers.size}\n` +
        `Status: ✅ Active`,
        { parse_mode: 'Markdown' }
      );
    });

    // /help command
    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;

      await this.bot.sendMessage(chatId,
        `📖 **Signal Format Examples:**\n\n` +
        `**Standard Format:**\n` +
        `BTC/USDT LONG @ 45000 TP: 46000 SL: 44500\n` +
        `ETH/USDT SHORT @ 3000 TP: 2900 SL: 3050\n\n` +
        `**Simple Format:**\n` +
        `BTC LONG 45000\n` +
        `ETHUSDT SHORT 3000\n\n` +
        `**With Multiple TPs:**\n` +
        `BTC/USDT LONG @ 45000\n` +
        `TP1: 45500\n` +
        `TP2: 46000\n` +
        `SL: 44500\n\n` +
        `**Supported Pairs:**\n` +
        `Crypto: BTC, ETH, SOL, XRP, ADA, DOGE, etc.\n` +
        `Quote: USDT, USD, BTC\n\n` +
        `**Directions:** LONG, SHORT, BUY, SELL`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle all text messages (signals)
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text;

      // Skip commands
      if (text && text.startsWith('/')) return;

      // Check authorization
      if (!this.authorizedUsers.has(userId)) {
        return; // Silently ignore unauthorized messages
      }

      // Parse as signal
      await this.handleSignalMessage(chatId, userId, text);
    });

    console.log('✅ Telegram handlers configured');
  }

  async handleSignalMessage(chatId, userId, text) {
    const timestamp = Date.now();

    try {
      const parsed = this.parseSignal(text);

      if (parsed) {
        const signal = {
          id: this.generateId(),
          timestamp,
          source: 'telegram',
          userId,
          chatId,
          rawText: text,
          ...parsed
        };

        this.signalCount++;

        console.log(`📱 Telegram signal: ${signal.pair} ${signal.direction} @ ${signal.entry}`);

        // Emit signal event
        this.emit('signal', signal);

        // Confirm to user
        await this.bot.sendMessage(chatId,
          `✅ **Signal Received**\n\n` +
          `Pair: ${signal.pair}\n` +
          `Direction: ${signal.direction}\n` +
          `Entry: ${signal.entry}\n` +
          `${signal.takeProfit ? `TP: ${signal.takeProfit}\n` : ''}` +
          `${signal.stopLoss ? `SL: ${signal.stopLoss}\n` : ''}` +
          `\n📡 Broadcasting to all subscribers...`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await this.bot.sendMessage(chatId,
          `⚠️ **Could not parse signal**\n\n` +
          `Please use correct format:\n` +
          `BTC/USDT LONG @ 45000 TP: 46000 SL: 44500\n\n` +
          `Type /help for examples.`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error('❌ Error handling signal:', error);
      await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  }

  parseSignal(text) {
    // Normalize text
    text = text.trim().replace(/\n/g, ' ');

    // Pattern 1: Full format "BTC/USDT LONG @ 45000 TP: 46000 SL: 44500"
    const pattern1 = /([A-Z]+\/[A-Z]+|[A-Z]+USDT|[A-Z]+USD)\s+(LONG|SHORT|BUY|SELL)\s+(?:@|at|price:?)\s*([\d,.]+)(?:\s+TP:?\s*([\d,.]+))?(?:\s+SL:?\s*([\d,.]+))?/i;

    // Pattern 2: Simple "BTC LONG 45000"
    const pattern2 = /([A-Z]+)\s+(LONG|SHORT|BUY|SELL)\s+([\d,.]+)/i;

    // Pattern 3: Multi-line format
    const pattern3 = /([A-Z]+\/[A-Z]+|[A-Z]+USDT)\s+(LONG|SHORT|BUY|SELL)\s+(?:@|at)\s*([\d,.]+)/i;

    const patterns = [pattern1, pattern2, pattern3];

    for (const pattern of patterns) {
      const match = text.match(pattern);

      if (match) {
        // Normalize pair
        let pair = match[1].toUpperCase();
        if (!pair.includes('/')) {
          if (pair.endsWith('USDT')) {
            pair = pair.replace('USDT', '/USDT');
          } else if (pair.endsWith('USD')) {
            pair = pair.replace('USD', '/USD');
          } else {
            pair = pair + '/USDT'; // Default to USDT
          }
        }

        // Normalize direction
        let direction = match[2].toUpperCase();
        if (direction === 'BUY') direction = 'LONG';
        if (direction === 'SELL') direction = 'SHORT';

        // Parse prices
        const entry = parseFloat(match[3].replace(/,/g, ''));

        // Look for TP and SL in rest of text if not found in main match
        let takeProfit = match[4] ? parseFloat(match[4].replace(/,/g, '')) : null;
        let stopLoss = match[5] ? parseFloat(match[5].replace(/,/g, '')) : null;

        if (!takeProfit) {
          const tpMatch = text.match(/TP:?\s*([\d,.]+)/i);
          if (tpMatch) takeProfit = parseFloat(tpMatch[1].replace(/,/g, ''));
        }

        if (!stopLoss) {
          const slMatch = text.match(/SL:?\s*([\d,.]+)/i);
          if (slMatch) stopLoss = parseFloat(slMatch[1].replace(/,/g, ''));
        }

        if (entry > 0) {
          return {
            pair,
            direction,
            entry,
            takeProfit,
            stopLoss
          };
        }
      }
    }

    return null;
  }

  generateId() {
    return `tg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async broadcastToChannel(signal, channelId) {
    // Broadcast signal to Telegram channel
    try {
      await this.bot.sendMessage(channelId,
        `🚨 **New Signal Alert**\n\n` +
        `📊 ${signal.pair}\n` +
        `📈 ${signal.direction}\n` +
        `💰 Entry: ${signal.entry}\n` +
        `${signal.takeProfit ? `🎯 TP: ${signal.takeProfit}\n` : ''}` +
        `${signal.stopLoss ? `🛡️ SL: ${signal.stopLoss}\n` : ''}` +
        `\n⏰ ${new Date().toLocaleString()}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('❌ Error broadcasting to channel:', error);
    }
  }

  async stop() {
    console.log('⏹️  Stopping Telegram Bot...');
    if (this.bot) {
      await this.bot.stopPolling();
    }
    console.log('✅ Telegram Bot stopped');
  }
}

module.exports = TelegramSignalBot;
