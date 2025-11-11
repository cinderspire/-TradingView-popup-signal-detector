# AUTOMATEDTRADEBOT PLATFORM ARCHITECTURE
## Unified Trading Platform with Signal Marketplace

### OVERVIEW
Complete trading automation platform combining:
- Real backtesting with historical data
- Paper trading with live market data
- Signal marketplace and copy trading
- TradingView webhook integration
- Multi-strategy execution
- Real-time open PnL tracking

---

## 1. CORE COMPONENTS

### A. TRADING ENGINE CORE
```
Location: /home/automatedtradebot/backend/src/engines/
```

#### Components:
1. **BacktestEngine**
   - Uses REAL historical data from exchanges (Bybit, MEXC, Bitget)
   - Multi-timeframe support (1m, 5m, 15m, 1h, 4h, 1d)
   - Real fees (0.1%) and slippage (0.05%)
   - Comprehensive metrics calculation

2. **PaperTradeEngine**
   - Real-time market data polling (60-second intervals)
   - Virtual position management
   - Open PnL calculation in real-time
   - Session persistence to PostgreSQL
   - WebSocket updates for live tracking

3. **RealTradeEngine**
   - CCXT integration for real execution
   - Risk limits enforcement
   - Position sizing controls
   - Emergency stop functionality

4. **TradingViewWebhookEngine** (NEW)
   - Webhook receiver for TradingView alerts
   - Auto-detection of strategy patterns
   - Signal validation and execution
   - Open PnL tracking for webhook-based trades

---

## 2. DATABASE SCHEMA (PostgreSQL)

### Enhanced Models:

```prisma
model Strategy {
  id                String   @id @default(uuid())
  name              String
  type              String   // 'manual', 'tradingview', 'pine_script'
  source            String   // 'local', 'tradingview_webhook', 'user_upload'
  code              String?  @db.Text
  parameters        Json
  defaultSettings   Json
  backtestResults   Json?
  isActive          Boolean  @default(true)
  createdBy         String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  sessions          TradingSession[]
  signals           Signal[]
}

model TradingSession {
  id                String   @id @default(uuid())
  userId            String
  strategyId        String
  type              String   // 'paper', 'real', 'backtest'
  status            String   // 'active', 'paused', 'stopped', 'completed'
  startCapital      Decimal  @db.Decimal(20, 8)
  currentBalance    Decimal  @db.Decimal(20, 8)
  openPnL           Decimal  @db.Decimal(20, 8)
  realizedPnL       Decimal  @db.Decimal(20, 8)
  totalPnL          Decimal  @db.Decimal(20, 8)
  roi               Decimal  @db.Decimal(10, 4)
  winRate           Decimal  @db.Decimal(10, 4)
  totalTrades       Int
  winningTrades     Int
  losingTrades      Int
  maxDrawdown       Decimal  @db.Decimal(10, 4)
  sharpeRatio       Decimal? @db.Decimal(10, 4)
  equityCurve       Json
  positions         Json
  startedAt         DateTime @default(now())
  stoppedAt         DateTime?

  user              User     @relation(fields: [userId], references: [id])
  strategy          Strategy @relation(fields: [strategyId], references: [id])
  trades            Trade[]
}

model TradingViewAlert {
  id                String   @id @default(uuid())
  alertId           String   @unique
  strategyName      String
  action            String   // 'buy', 'sell', 'close'
  symbol            String
  price             Decimal  @db.Decimal(20, 8)
  quantity          Decimal? @db.Decimal(20, 8)
  stopLoss          Decimal? @db.Decimal(20, 8)
  takeProfit        Decimal? @db.Decimal(20, 8)
  message           String?  @db.Text
  processed         Boolean  @default(false)
  processedAt       DateTime?
  sessionId         String?
  tradeId           String?
  receivedAt        DateTime @default(now())

  @@index([strategyName, symbol])
  @@index([processed, receivedAt])
}

model Position {
  id                String   @id @default(uuid())
  sessionId         String
  symbol            String
  side              String   // 'long', 'short'
  entryPrice        Decimal  @db.Decimal(20, 8)
  currentPrice      Decimal  @db.Decimal(20, 8)
  quantity          Decimal  @db.Decimal(20, 8)
  openPnL           Decimal  @db.Decimal(20, 8)
  openPnLPercent    Decimal  @db.Decimal(10, 4)
  stopLoss          Decimal? @db.Decimal(20, 8)
  takeProfit        Decimal? @db.Decimal(20, 8)
  status            String   // 'open', 'closed', 'liquidated'
  openedAt          DateTime @default(now())
  closedAt          DateTime?
  closePrice        Decimal? @db.Decimal(20, 8)
  realizedPnL       Decimal? @db.Decimal(20, 8)

  @@index([sessionId, status])
  @@index([symbol, status])
}
```

---

## 3. API ENDPOINTS

### Trading Endpoints
```
POST   /api/trading/backtest
POST   /api/trading/backtest/batch
POST   /api/trading/optimize

POST   /api/trading/paper/start
POST   /api/trading/paper/stop
GET    /api/trading/paper/sessions
GET    /api/trading/paper/sessions/:id
GET    /api/trading/paper/positions/:sessionId
GET    /api/trading/paper/open-pnl/:sessionId

POST   /api/trading/real/start
POST   /api/trading/real/stop
POST   /api/trading/real/emergency-stop
GET    /api/trading/real/sessions
GET    /api/trading/real/positions

POST   /api/trading/tradingview/webhook
POST   /api/trading/tradingview/configure
GET    /api/trading/tradingview/alerts
DELETE /api/trading/tradingview/alerts/:id
```

### Strategy Management
```
GET    /api/strategies
POST   /api/strategies
PUT    /api/strategies/:id
DELETE /api/strategies/:id
POST   /api/strategies/import/pinescript
POST   /api/strategies/test
GET    /api/strategies/:id/performance
```

### Signal Marketplace
```
GET    /api/signals
POST   /api/signals
PUT    /api/signals/:id
DELETE /api/signals/:id
POST   /api/signals/:id/copy

GET    /api/providers
GET    /api/providers/:id
POST   /api/providers/apply
GET    /api/providers/:id/performance

POST   /api/subscriptions
DELETE /api/subscriptions/:id
GET    /api/subscriptions/active
```

---

## 4. WEBSOCKET EVENTS

### Real-time Updates
```javascript
// Client -> Server
socket.emit('subscribe:session', { sessionId, type: 'paper'|'real' })
socket.emit('subscribe:positions', { sessionId })
socket.emit('subscribe:ticker', { symbols: ['BTC/USDT', 'ETH/USDT'] })
socket.emit('subscribe:alerts', { userId })

// Server -> Client
socket.emit('session:update', { sessionId, data: {...} })
socket.emit('position:update', { position: {...}, openPnL, openPnLPercent })
socket.emit('position:opened', { position: {...} })
socket.emit('position:closed', { position: {...}, realizedPnL })
socket.emit('ticker:update', { symbol, price, change24h })
socket.emit('alert:received', { alert: {...} })
socket.emit('trade:executed', { trade: {...} })
```

---

## 5. TRADINGVIEW INTEGRATION

### Webhook Receiver
```javascript
// /api/trading/tradingview/webhook
{
  "alertId": "unique-alert-id",
  "strategy": "3RSI_Strategy",
  "action": "buy" | "sell" | "close",
  "symbol": "BTCUSDT",
  "price": "{{close}}",
  "volume": "{{volume}}",
  "time": "{{time}}",
  "exchange": "{{exchange}}",
  "message": "Custom message with indicators"
}
```

### Auto-Detection Features:
1. **Strategy Pattern Recognition**
   - Automatically identifies strategy from alert format
   - Maps TradingView symbols to exchange symbols
   - Validates signal consistency

2. **Signal Processing**
   - Validates against current market price
   - Checks for duplicate alerts
   - Applies risk management rules
   - Executes in paper/real sessions

3. **Open PnL Tracking**
   - Real-time position valuation
   - Percentage and dollar PnL
   - Updates every ticker refresh (1-5 seconds)
   - Stored in Position model

---

## 6. FRONTEND PAGES

### Dashboard (`/dashboard`)
- Account overview
- Total PnL (Open + Realized)
- Active positions with live PnL
- Recent trades
- Performance metrics

### Strategies (`/strategies`)
- Strategy library (local + TradingView)
- Performance comparison table
- Quick backtest interface
- Pine Script import tool
- Strategy builder (visual)

### Paper Trading (`/paper-trading`)
- Active sessions management
- Live position tracking with open PnL
- Real-time charts
- Start/stop controls
- Session history

### Backtesting (`/backtesting`)
- Strategy selection
- Date range picker
- Multi-pair testing
- Optimization parameters
- Results with downloadable reports

### TradingView Alerts (`/tradingview`)
- Webhook configuration
- Alert history
- Auto-detected strategies
- Performance by alert source
- Setup instructions

### Signal Marketplace (`/marketplace`)
- Browse providers
- Signal performance
- Subscription management
- Copy trading settings

### Settings (`/settings`)
- API keys configuration
- Risk management rules
- Notification preferences
- TradingView webhook URL
- Exchange connections

---

## 7. KEY FEATURES IMPLEMENTATION

### A. Real-time Open PnL Calculation
```javascript
class PnLCalculator {
  calculateOpenPnL(position, currentPrice) {
    const { entryPrice, quantity, side } = position;

    let pnl;
    if (side === 'long') {
      pnl = (currentPrice - entryPrice) * quantity;
    } else {
      pnl = (entryPrice - currentPrice) * quantity;
    }

    const pnlPercent = (pnl / (entryPrice * quantity)) * 100;

    return {
      openPnL: pnl,
      openPnLPercent: pnlPercent,
      currentPrice
    };
  }
}
```

### B. TradingView Alert Auto-Detection
```javascript
class AlertDetector {
  detectStrategy(alert) {
    // Pattern matching for strategy identification
    const patterns = {
      '3RSI': /RSI.*cross|3.*RSI/i,
      '7RSI': /7.*RSI|seven.*RSI/i,
      'MACD': /MACD.*cross/i,
      'BB': /Bollinger|BB.*break/i
    };

    for (const [strategy, pattern] of Object.entries(patterns)) {
      if (pattern.test(alert.message || alert.strategy)) {
        return strategy;
      }
    }

    return alert.strategy || 'CUSTOM';
  }

  parseSignal(alert) {
    return {
      action: this.detectAction(alert),
      symbol: this.normalizeSymbol(alert.symbol),
      price: parseFloat(alert.price),
      confidence: this.calculateConfidence(alert)
    };
  }
}
```

### C. Optimizer with ±30% Range
```javascript
class StrategyOptimizer {
  generateOptimizationRange(baseParams) {
    const ranges = {};

    for (const [key, value] of Object.entries(baseParams)) {
      if (typeof value === 'number') {
        ranges[key] = {
          min: Math.floor(value * 0.7),  // -30%
          max: Math.ceil(value * 1.3),   // +30%
          step: Math.max(1, Math.floor(value * 0.1))
        };
      }
    }

    return ranges;
  }
}
```

---

## 8. DEPLOYMENT CONFIGURATION

### PM2 Ecosystem
```javascript
module.exports = {
  apps: [{
    name: 'automatedtradebot-unified',
    script: 'src/server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 6864
    },
    max_memory_restart: '2G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log'
  }]
}
```

### Nginx Configuration
```nginx
location /api/trading/tradingview/webhook {
    proxy_pass http://127.0.0.1:6864;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # Allow only TradingView IPs
    allow 52.89.214.238;
    allow 34.212.75.30;
    allow 54.218.53.128;
    allow 52.32.178.7;
    deny all;
}
```

---

## 9. SECURITY MEASURES

1. **API Security**
   - JWT authentication
   - Rate limiting per endpoint
   - IP whitelisting for webhooks
   - Request signature validation

2. **Trading Security**
   - Position size limits
   - Daily loss limits
   - Max drawdown protection
   - Emergency stop mechanisms

3. **Data Security**
   - Encrypted API keys
   - PostgreSQL with SSL
   - Secure WebSocket connections
   - Audit logging

---

## 10. PERFORMANCE OPTIMIZATION

1. **Caching Strategy**
   - Redis for market data
   - Session caching
   - Strategy results caching

2. **Database Optimization**
   - Indexed queries
   - Batch operations
   - Connection pooling

3. **Real-time Updates**
   - WebSocket connection pooling
   - Throttled updates
   - Delta compression

---

## NEXT STEPS

1. Migrate karsilas strategies to automatedtradebot
2. Implement TradingView webhook receiver
3. Add real-time open PnL tracking
4. Create unified dashboard
5. Test with paper trading
6. Deploy production version