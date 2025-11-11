# 🚀 TradingView Signal Capture System - Technical Architecture

**Priority:** 🔥 CRITICAL - Core Platform Functionality
**Goal:** Capture TradingView popup alerts with minimal latency (<100ms)
**Server:** Ubuntu 24.04

---

## 📋 SYSTEM OVERVIEW

### Signal Flow
```
TradingView Alert Popup
    ↓ (Screen Capture/Browser Automation)
Signal Capture Service (Puppeteer + OCR)
    ↓ (WebSocket - <50ms)
Signal Processing Engine
    ↓ (Parallel Distribution)
    ├─→ Paper Trading Engine
    ├─→ Signal Database (PostgreSQL)
    ├─→ WebSocket Broadcast (All Subscribers)
    └─→ Real Account Integration (CCXT/MetaAPI)
```

---

## 🔧 TECHNICAL ARCHITECTURE

### 1. TradingView Signal Capture Service
**Technology:** Puppeteer + Tesseract OCR + Custom Parser
**Latency Target:** <50ms from popup to capture

#### Components:

**A. Headless Browser Monitor**
```javascript
// /backend/src/services/tradingview-capture.js

const puppeteer = require('puppeteer-core');
const { EventEmitter } = require('events');

class TradingViewCaptureService extends EventEmitter {
  constructor() {
    super();
    this.browser = null;
    this.page = null;
    this.isMonitoring = false;
  }

  async initialize() {
    // Launch headless Chrome with optimizations
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
        '--disable-web-security', // For faster loading
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      executablePath: '/usr/bin/chromium-browser' // Ubuntu path
    });

    this.page = await this.browser.newPage();

    // Set viewport for consistent popup detection
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Navigate to TradingView
    await this.page.goto('https://www.tradingview.com/chart/', {
      waitUntil: 'networkidle2'
    });

    // Login automation (credentials from env)
    await this.login();

    console.log('✅ TradingView Capture Service initialized');
  }

  async login() {
    // Auto-login to TradingView
    await this.page.click('[data-name="header-user-menu-sign-in"]');
    await this.page.waitForSelector('input[name="username"]');

    await this.page.type('input[name="username"]', process.env.TV_USERNAME);
    await this.page.type('input[name="password"]', process.env.TV_PASSWORD);
    await this.page.click('button[type="submit"]');

    await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
  }

  async startMonitoring() {
    this.isMonitoring = true;

    // Monitor for alert popups using MutationObserver
    await this.page.evaluateOnNewDocument(() => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            // Detect TradingView alert dialog
            if (node.classList &&
                (node.classList.contains('tv-dialog') ||
                 node.classList.contains('tv-alert-dialog'))) {

              // Extract alert text
              const alertText = node.innerText || node.textContent;

              // Send to parent (captured by Puppeteer)
              window.__tradingViewAlert = {
                timestamp: Date.now(),
                text: alertText,
                type: 'popup'
              };
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });

    // Poll for captured alerts
    this.pollForAlerts();
  }

  async pollForAlerts() {
    setInterval(async () => {
      if (!this.isMonitoring) return;

      try {
        const alert = await this.page.evaluate(() => {
          const data = window.__tradingViewAlert;
          window.__tradingViewAlert = null; // Clear after reading
          return data;
        });

        if (alert) {
          this.processAlert(alert);
        }
      } catch (error) {
        console.error('Alert polling error:', error);
      }
    }, 10); // Poll every 10ms for minimal latency
  }

  processAlert(alert) {
    try {
      const parsed = this.parseAlert(alert.text);

      if (parsed) {
        // Emit signal event
        this.emit('signal', {
          timestamp: alert.timestamp,
          latency: Date.now() - alert.timestamp,
          ...parsed
        });
      }
    } catch (error) {
      console.error('Alert processing error:', error);
    }
  }

  parseAlert(text) {
    // Parse alert format: "BTC/USDT LONG @ 45000 TP: 46000 SL: 44500"
    const patterns = {
      // Standard format
      standard: /^([A-Z]+\/[A-Z]+)\s+(LONG|SHORT)\s+@\s+([\d.]+)(?:\s+TP:\s*([\d.]+))?(?:\s+SL:\s*([\d.]+))?/i,

      // Alternative formats
      simple: /^([A-Z]+\/[A-Z]+)\s+(BUY|SELL)/i
    };

    for (const [name, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);

      if (match) {
        return {
          pair: match[1],
          direction: match[2].toUpperCase(),
          entry: parseFloat(match[3] || 0),
          takeProfit: parseFloat(match[4] || 0),
          stopLoss: parseFloat(match[5] || 0),
          rawText: text,
          format: name
        };
      }
    }

    return null;
  }

  async stop() {
    this.isMonitoring = false;
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = TradingViewCaptureService;
```

**B. Alternative: Screen Capture + OCR Method**
```javascript
// For ultra-reliable detection (backup method)
const screenshot = require('screenshot-desktop');
const Tesseract = require('tesseract.js');

class ScreenCaptureService {
  async captureAndParse() {
    // Capture specific screen region where alerts appear
    const img = await screenshot({
      screen: 0,
      format: 'png'
    });

    // OCR with Tesseract
    const { data: { text } } = await Tesseract.recognize(img, 'eng', {
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/@:. '
    });

    return this.parseAlertText(text);
  }
}
```

---

### 2. Signal Distribution System

**Ultra-Low Latency WebSocket Server**
```javascript
// /backend/src/services/signal-distributor.js

const WebSocket = require('ws');
const { EventEmitter } = require('events');

class SignalDistributor extends EventEmitter {
  constructor(server) {
    super();
    this.wss = new WebSocket.Server({
      server,
      perMessageDeflate: false, // Disable compression for speed
      clientTracking: true
    });

    this.subscribers = new Map(); // userId -> WebSocket
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const userId = this.authenticateConnection(req);

      if (!userId) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      this.subscribers.set(userId, {
        ws,
        subscriptions: [], // Strategy IDs user subscribed to
        paperTradeEnabled: false,
        realTradeEnabled: false,
        exchanges: [] // Connected exchange accounts
      });

      ws.on('message', (message) => {
        this.handleClientMessage(userId, JSON.parse(message));
      });

      ws.on('close', () => {
        this.subscribers.delete(userId);
      });
    });
  }

  broadcastSignal(signal) {
    const message = JSON.stringify({
      type: 'SIGNAL',
      timestamp: Date.now(),
      data: signal
    });

    // Broadcast to all subscribers (parallel)
    const broadcasts = [];

    for (const [userId, client] of this.subscribers.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        broadcasts.push(
          new Promise((resolve) => {
            client.ws.send(message, (err) => {
              if (!err && signal.autoExecute) {
                this.executeSignal(userId, signal, client);
              }
              resolve();
            });
          })
        );
      }
    }

    return Promise.all(broadcasts);
  }

  async executeSignal(userId, signal, client) {
    const executionPromises = [];

    // Paper trade execution
    if (client.paperTradeEnabled) {
      executionPromises.push(
        this.executePaperTrade(userId, signal)
      );
    }

    // Real account execution
    if (client.realTradeEnabled && client.exchanges.length > 0) {
      executionPromises.push(
        this.executeRealTrade(userId, signal, client.exchanges)
      );
    }

    await Promise.all(executionPromises);
  }

  async executePaperTrade(userId, signal) {
    // Execute in paper trading engine
    const PaperTradeEngine = require('./paper-trade-engine');
    await PaperTradeEngine.executeSignal(userId, signal);
  }

  async executeRealTrade(userId, signal, exchanges) {
    // Execute on real exchanges
    const ExchangeExecutor = require('./exchange-executor');

    for (const exchange of exchanges) {
      await ExchangeExecutor.executeSignal(
        userId,
        exchange.id,
        signal,
        exchange.config
      );
    }
  }
}

module.exports = SignalDistributor;
```

---

### 3. Paper Trading Engine

```javascript
// /backend/src/services/paper-trade-engine.js

class PaperTradeEngine {
  constructor() {
    this.positions = new Map(); // userId -> positions[]
    this.balances = new Map();  // userId -> { USDT: 10000, ... }
  }

  async executeSignal(userId, signal) {
    const balance = this.balances.get(userId) || { USDT: 10000 };

    // Calculate position size based on risk management
    const positionSize = this.calculatePositionSize(
      balance.USDT,
      signal.entry,
      signal.stopLoss
    );

    const position = {
      id: this.generateId(),
      userId,
      pair: signal.pair,
      direction: signal.direction,
      entryPrice: signal.entry,
      size: positionSize,
      takeProfit: signal.takeProfit,
      stopLoss: signal.stopLoss,
      timestamp: Date.now(),
      status: 'OPEN',
      pnl: 0
    };

    // Store position
    const userPositions = this.positions.get(userId) || [];
    userPositions.push(position);
    this.positions.set(userId, userPositions);

    // Update balance
    balance.USDT -= positionSize * signal.entry;
    this.balances.set(userId, balance);

    // Save to database
    await this.saveToDatabase(position);

    // Emit event
    this.emit('position_opened', position);

    return position;
  }

  calculatePositionSize(balance, entry, stopLoss) {
    const riskPercent = 0.02; // 2% risk per trade
    const riskAmount = balance * riskPercent;
    const stopDistance = Math.abs(entry - stopLoss);
    const positionSize = riskAmount / stopDistance;

    return Math.min(positionSize, balance * 0.1); // Max 10% per trade
  }

  async monitorPositions() {
    // Real-time price monitoring
    setInterval(async () => {
      for (const [userId, positions] of this.positions.entries()) {
        for (const position of positions) {
          if (position.status !== 'OPEN') continue;

          const currentPrice = await this.getCurrentPrice(position.pair);

          // Check TP/SL
          if (this.shouldClose(position, currentPrice)) {
            await this.closePosition(userId, position.id, currentPrice);
          }
        }
      }
    }, 100); // Check every 100ms
  }

  shouldClose(position, currentPrice) {
    if (position.direction === 'LONG') {
      return currentPrice >= position.takeProfit ||
             currentPrice <= position.stopLoss;
    } else {
      return currentPrice <= position.takeProfit ||
             currentPrice >= position.stopLoss;
    }
  }
}

module.exports = new PaperTradeEngine();
```

---

### 4. Real Exchange Integration

```javascript
// /backend/src/services/exchange-executor.js

const ccxt = require('ccxt');

class ExchangeExecutor {
  constructor() {
    this.exchanges = new Map(); // userId_exchangeId -> exchange instance
  }

  async executeSignal(userId, exchangeId, signal, config) {
    const exchange = await this.getExchange(userId, exchangeId, config);

    try {
      // Create market order
      const order = await exchange.createOrder(
        signal.pair,
        'market',
        signal.direction.toLowerCase(),
        signal.size,
        signal.entry
      );

      // Set TP/SL orders
      if (signal.takeProfit) {
        await exchange.createOrder(
          signal.pair,
          'limit',
          signal.direction === 'LONG' ? 'sell' : 'buy',
          signal.size,
          signal.takeProfit,
          { reduceOnly: true }
        );
      }

      if (signal.stopLoss) {
        await exchange.createOrder(
          signal.pair,
          'stop_market',
          signal.direction === 'LONG' ? 'sell' : 'buy',
          signal.size,
          signal.stopLoss,
          { reduceOnly: true, stopPrice: signal.stopLoss }
        );
      }

      return order;
    } catch (error) {
      console.error('Exchange execution error:', error);
      throw error;
    }
  }

  async getExchange(userId, exchangeId, config) {
    const key = `${userId}_${exchangeId}`;

    if (!this.exchanges.has(key)) {
      const Exchange = ccxt[exchangeId];
      const exchange = new Exchange({
        apiKey: config.apiKey,
        secret: config.secret,
        enableRateLimit: true,
        options: {
          defaultType: 'future' // For futures trading
        }
      });

      await exchange.loadMarkets();
      this.exchanges.set(key, exchange);
    }

    return this.exchanges.get(key);
  }
}

module.exports = new ExchangeExecutor();
```

---

## 🚀 SERVER INSTALLATION PLAN (Ubuntu 24.04)

### Step 1: System Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install dependencies
sudo apt install -y \
  chromium-browser \
  tesseract-ocr \
  tesseract-ocr-eng \
  build-essential \
  git \
  nginx \
  postgresql-16 \
  redis-server \
  pm2 -g

# Install Puppeteer dependencies
sudo apt install -y \
  gconf-service \
  libasound2 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgcc1 \
  libgconf-2-4 \
  libgdk-pixbuf2.0-0 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  ca-certificates \
  fonts-liberation \
  libappindicator1 \
  libnss3 \
  lsb-release \
  xdg-utils \
  wget
```

### Step 2: Project Setup
```bash
# Clone/setup project
cd /home/automatedtradebot
npm install

# Install specific dependencies
npm install \
  puppeteer-core \
  tesseract.js \
  ws \
  ccxt \
  express \
  @prisma/client \
  redis \
  dotenv \
  jsonwebtoken \
  bcrypt
```

### Step 3: Environment Configuration
```bash
# Create .env file
cat > /home/automatedtradebot/.env << EOF
# TradingView Credentials
TV_USERNAME=your_tradingview_email
TV_PASSWORD=your_tradingview_password

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/automatedtradebot"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET=your_super_secret_key_here

# WebSocket
WS_PORT=8080

# API
API_PORT=3000
EOF
```

### Step 4: Database Setup
```bash
# Initialize PostgreSQL
sudo -u postgres psql << EOF
CREATE DATABASE automatedtradebot;
CREATE USER tradebot WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE automatedtradebot TO tradebot;
EOF

# Run migrations
cd /home/automatedtradebot
npx prisma migrate deploy
npx prisma generate
```

### Step 5: PM2 Process Management
```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'tradingview-capture',
      script: './src/services/tradingview-capture-runner.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'signal-distributor',
      script: './src/services/signal-distributor-runner.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    },
    {
      name: 'api-server',
      script: './src/server.js',
      instances: 2,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    },
    {
      name: 'paper-trade-engine',
      script: './src/services/paper-trade-runner.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    }
  ]
};
EOF

# Start all services
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## ⚡ LATENCY OPTIMIZATIONS

### 1. Puppeteer Optimizations
```javascript
// Disable unnecessary features
{
  args: [
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-domain-reliability',
    '--disable-extensions',
    '--disable-features=AudioServiceOutOfProcess',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-notifications',
    '--disable-offer-store-unmasked-wallet-cards',
    '--disable-popup-blocking',
    '--disable-print-preview',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-setuid-sandbox',
    '--disable-speech-api',
    '--disable-sync',
    '--hide-scrollbars',
    '--ignore-gpu-blacklist',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-pings',
    '--no-sandbox',
    '--password-store=basic',
    '--use-gl=swiftshader',
    '--use-mock-keychain'
  ]
}
```

### 2. WebSocket Optimizations
```javascript
// Disable compression, use binary frames
const wss = new WebSocket.Server({
  perMessageDeflate: false,
  maxPayload: 1024, // Small messages
  clientTracking: true,
  noDelay: true // Disable Nagle's algorithm
});
```

### 3. PostgreSQL Connection Pool
```javascript
// Use connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 4. Redis Caching
```javascript
// Cache current prices
const redis = require('redis');
const client = redis.createClient();

// Cache prices for 100ms
await client.setEx(`price:${pair}`, 0.1, price);
```

---

## 📊 MONITORING & ALERTS

```javascript
// Track latency metrics
class LatencyMonitor {
  constructor() {
    this.metrics = {
      captureLatency: [], // Popup to capture
      processingLatency: [], // Capture to parse
      distributionLatency: [], // Parse to broadcast
      totalLatency: [] // Popup to subscriber
    };
  }

  recordMetric(type, value) {
    this.metrics[type].push(value);

    // Keep last 1000 samples
    if (this.metrics[type].length > 1000) {
      this.metrics[type].shift();
    }

    // Alert if latency exceeds threshold
    if (value > 100) { // 100ms threshold
      console.warn(`⚠️ High ${type}: ${value}ms`);
    }
  }

  getStats() {
    return Object.entries(this.metrics).reduce((acc, [key, values]) => {
      acc[key] = {
        avg: this.average(values),
        p50: this.percentile(values, 0.5),
        p95: this.percentile(values, 0.95),
        p99: this.percentile(values, 0.99)
      };
      return acc;
    }, {});
  }
}
```

---

## 🔐 SECURITY CONSIDERATIONS

1. **TradingView Credentials:** Store in environment variables, encrypt in database
2. **API Keys:** Per-user encryption, never log
3. **WebSocket Authentication:** JWT tokens
4. **Rate Limiting:** Prevent abuse
5. **IP Whitelisting:** Optional for API access

---

## 📝 NEXT STEPS

1. Install dependencies on Ubuntu 24 server
2. Configure TradingView account credentials
3. Test Puppeteer capture with your alerts
4. Deploy signal distribution system
5. Connect paper trading engine
6. Test end-to-end latency (<100ms target)
7. Add real exchange integration (CCXT)
8. Monitor and optimize

**Expected Total Latency:** 30-80ms (popup to subscriber)

---

*Ready for server access to begin installation.*
