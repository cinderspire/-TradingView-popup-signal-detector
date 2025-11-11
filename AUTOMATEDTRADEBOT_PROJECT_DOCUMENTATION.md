# AutomatedTradeBot - Complete Project Documentation

> **Documentation Date:** November 11, 2025
> **Project Location:** `/home/automatedtradebot/`
> **Domain:** automatedtradebot.com
> **Server:** CloudPanel Hosted (Multi-site Server)

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Backend Components](#backend-components)
6. [Frontend Components](#frontend-components)
7. [Database Schema](#database-schema)
8. [Configuration](#configuration)
9. [API Endpoints](#api-endpoints)
10. [Services & Features](#services--features)
11. [Deployment Setup](#deployment-setup)
12. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 📖 Project Overview

**AutomatedTradeBot** is a comprehensive trading signal marketplace and automation platform that combines:

- **Real-time TradingView Signal Capture** using Puppeteer automation
- **Telegram Bot Integration** for signal distribution
- **Paper Trading Engine** with 10x leverage simulation
- **Real Trading Engine** supporting 100+ exchanges via CCXT
- **Signal Marketplace** for signal providers and subscribers
- **WebSocket Distribution** for ultra-low latency signal broadcasting
- **Multi-strategy Backtesting** with real historical data
- **Risk Management System** with adaptive controls
- **News Sentiment Monitoring** with emergency controls

### Key Features

✅ TradingView popup signal detection (<100ms latency)
✅ Real-time price feeds via Binance WebSocket
✅ Paper trading with 10x leverage and real-time PnL tracking
✅ Multi-exchange support (Bybit, MEXC, Bitget, Binance)
✅ Strategy marketplace with performance analytics
✅ Automated signal matching and execution
✅ Portfolio copy trading functionality
✅ Advanced risk management with adaptive TP/SL
✅ AI-powered strategy optimization
✅ News calendar integration with trading controls

---

## 🏗 Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                    │
│  Dashboard | Strategies | Signals | Marketplace | Analytics │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST API + WebSocket
┌───────────────────────┴─────────────────────────────────────┐
│                 Backend (Node.js/Express)                    │
│  API Server | Signal Coordinator | Trading Engines          │
├──────────────────────────────────────────────────────────────┤
│  TradingView Capture | Telegram Bot | Price Services        │
│  Paper Trade Engine  | Real Trade Engine | Risk Manager     │
└───────────────┬──────────────────────────┬──────────────────┘
                │                          │
        ┌───────┴────────┐        ┌───────┴────────┐
        │   PostgreSQL   │        │     Redis      │
        │  (Main Data)   │        │   (Caching)    │
        └────────────────┘        └────────────────┘
                │
        ┌───────┴────────┐
        │  External APIs │
        │  CCXT | Bybit  │
        │  MEXC | Bitget │
        └────────────────┘
```

### Signal Flow Architecture

```
TradingView Alert → Puppeteer Capture (10ms polling)
                 ↓
          Signal Coordinator
                 ↓
    ┌────────────┴────────────┐
    ↓                         ↓
Telegram Bot            Signal Distributor
    ↓                    (WebSocket)
Subscribers                  ↓
                    ┌────────┴────────┐
                    ↓                 ↓
            Paper Trade         Exchange Executor
            Engine (10x)        (CCXT - Real)
```

---

## 💻 Technology Stack

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express.js 4.18
- **Database:** PostgreSQL 16
- **ORM:** Prisma 5.7
- **Caching:** Redis 4.6 + ioredis
- **WebSocket:** Socket.io 4.6
- **Automation:** Puppeteer Core 21.11
- **Exchange API:** CCXT 4.5
- **Bot Framework:** node-telegram-bot-api
- **OCR:** Tesseract.js 5.0
- **Process Manager:** PM2

### Frontend
- **Framework:** Next.js 14
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Hooks
- **Charts:** Chart.js
- **HTTP Client:** Axios

### DevOps & Infrastructure
- **Server:** Ubuntu 24.04 LTS
- **Web Server:** Nginx
- **SSL:** Let's Encrypt
- **Process Management:** PM2
- **Version Control:** Git
- **Hosting:** CloudPanel

### External Services
- **Exchanges:** Bybit, MEXC, Bitget, Binance
- **Signal Source:** TradingView
- **Messaging:** Telegram Bot API

---

## 📁 Project Structure

```
/home/automatedtradebot/
├── backend/                      # Node.js Backend API
│   ├── src/
│   │   ├── server.js            # Main entry point
│   │   ├── routes/              # API route handlers
│   │   ├── services/            # Business logic services
│   │   ├── controllers/         # Request controllers
│   │   ├── middleware/          # Express middleware
│   │   ├── engines/             # Trading engines
│   │   ├── strategies/          # Trading strategies
│   │   ├── utils/               # Utility functions
│   │   ├── config/              # Configuration files
│   │   ├── backtests/           # Backtest scripts
│   │   ├── paper_trading/       # Paper trading scripts
│   │   └── tools/               # Development tools
│   ├── prisma/
│   │   └── schema.prisma        # Database schema
│   ├── logs/                    # Application logs
│   ├── ecosystem.config.js      # PM2 configuration
│   ├── package.json             # Node dependencies
│   └── .env                     # Environment variables
│
├── frontend/                    # Next.js Frontend
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   │   ├── dashboard/       # Dashboard page
│   │   │   ├── marketplace/     # Signal marketplace
│   │   │   ├── strategies/      # Strategy management
│   │   │   ├── signals/         # Signals page
│   │   │   ├── positions/       # Position tracking
│   │   │   ├── providers/       # Signal providers
│   │   │   ├── analytics/       # Analytics dashboard
│   │   │   ├── backtests/       # Backtesting interface
│   │   │   ├── risk-management/ # Risk controls
│   │   │   ├── news-calendar/   # News monitoring
│   │   │   ├── leaderboard/     # Provider rankings
│   │   │   ├── profile/         # User profile
│   │   │   ├── settings/        # Account settings
│   │   │   ├── login/           # Login page
│   │   │   └── register/        # Registration page
│   │   ├── components/          # React components
│   │   ├── lib/                 # API client libraries
│   │   ├── hooks/               # Custom React hooks
│   │   ├── types/               # TypeScript types
│   │   └── styles/              # CSS styles
│   ├── public/                  # Static assets
│   ├── next.config.js           # Next.js configuration
│   └── package.json             # Frontend dependencies
│
├── database/                    # Database related
│   └── DATABASE_SCHEMA.sql      # Database dump
│
├── shared/                      # Shared resources
├── docker/                      # Docker configs (if any)
├── docs/                        # Documentation
├── backups/                     # Backup files
└── logs/                        # Application logs
```

---

## 🔧 Backend Components

### 1. Core Services (`src/services/`)

#### Signal Processing
- **`tradingview-capture.js`** - Puppeteer-based TradingView signal capture
- **`telegram-bot.js`** - Telegram bot for signal reception
- **`signal-coordinator.js`** - Aggregates signals from all sources
- **`signal-distributor.js`** - WebSocket signal broadcasting
- **`signal-matcher.js`** - Matches entry/exit signals
- **`signal-persistence.js`** - Signal data persistence

#### Trading Engines
- **`paper-trade-engine.js`** - Paper trading with 10x leverage
- **`realTradeEngine.js`** - Real trading execution
- **`exchange-executor.js`** - CCXT exchange integration
- **`unifiedTradingEngine.js`** - Unified trading interface

#### Market Data
- **`price-service.js`** - Binance WebSocket price feeds
- **`multi-source-price-service.js`** - Multi-exchange pricing
- **`price-batch-fetcher.js`** - Batch price fetching
- **`dataService.js`** - Historical data management

#### Risk Management
- **`risk-manager.js`** - Risk limits and controls
- **`adaptiveRiskController.js`** - Adaptive risk adjustment
- **`adaptive-tpsl-calculator.js`** - Dynamic TP/SL calculation
- **`ai-risk-control.js`** - AI-powered risk management

#### Analytics & Monitoring
- **`performanceAnalyzer.js`** - Strategy performance analysis
- **`analyticsService.js`** - Analytics data aggregation
- **`pnlTracker.js`** - PnL tracking and calculation
- **`position-monitor.js`** - Real-time position monitoring
- **`newsMonitor.js`** - News sentiment monitoring

#### Strategy Management
- **`strategyLoader.js`** - Strategy loading and management
- **`backtestEngine.js`** - Backtesting engine
- **`autoOptimizer.js`** - Strategy parameter optimization
- **`aiStrategyConsultant.js`** - AI strategy recommendations

#### User Management
- **`authService.js`** - Authentication and JWT
- **`subscriptionService.js`** - Subscription management
- **`providerService.js`** - Signal provider management
- **`copyTradingService.js`** - Copy trading functionality

#### Utilities
- **`encryption-service.js`** - API key encryption
- **`logger.js`** - Winston logging
- **`cache.js`** - Redis caching
- **`backupService.js`** - Database backups

### 2. API Routes (`src/routes/`)

- **`auth.js`** - Authentication endpoints
- **`signals.js`** - Signal CRUD operations
- **`strategies.js`** - Strategy management
- **`providers.js`** - Provider management
- **`subscriptions.js`** - Subscription handling
- **`positions.js`** - Position tracking
- **`trades.js`** - Trade history
- **`marketplace.js`** - Marketplace data
- **`backtests.js`** - Backtesting API
- **`riskManagement.js`** - Risk configuration
- **`newsCalendar.js`** - News calendar data
- **`analytics.js`** - Analytics endpoints
- **`leaderboard.js`** - Provider rankings
- **`bots.js`** - Trading bot management
- **`admin.js`** - Admin operations
- **`tradingview-webhook.js`** - TradingView webhooks

### 3. Middleware (`src/middleware/`)

- **`auth.js`** - JWT authentication middleware
- **`rate-limiter.js`** - Rate limiting
- **`errorHandler.js`** - Global error handler

### 4. Trading Strategies (`src/strategies/`)

- **`3RSI_3CCI_BB_5ORDERS_DCA.js`** - 3RSI + 3CCI + Bollinger Bands DCA
- **`7RSI_DCA.js`** - 7 RSI Multi-timeframe DCA
- **`7RSI_STRATEGY.js`** - 7 RSI Strategy
- **`meanReversion.js`** - Mean reversion strategy
- **`momentum.js`** - Momentum strategy
- **`scalping.js`** - Scalping strategy

---

## 🎨 Frontend Components

### Pages (`src/app/`)

1. **Dashboard** (`/dashboard`)
   - Account overview
   - Total PnL (Open + Realized)
   - Active positions with live PnL
   - Recent trades
   - Performance metrics

2. **Marketplace** (`/marketplace`)
   - Browse signal providers
   - Performance statistics
   - Subscription management
   - Provider details

3. **Strategies** (`/strategies`)
   - Strategy library
   - Performance comparison
   - Quick backtest interface
   - Strategy builder

4. **Signals** (`/signals`)
   - Live signal feed
   - Signal history
   - Signal creation (providers)
   - Performance tracking

5. **Positions** (`/positions`)
   - Active positions
   - Position history
   - Real-time PnL updates
   - Position management

6. **Providers** (`/providers`)
   - Provider list
   - Provider profiles
   - Performance analytics
   - Apply to become provider

7. **Analytics** (`/analytics`)
   - Performance charts
   - Win rate analysis
   - Drawdown tracking
   - Strategy comparison

8. **Backtests** (`/backtests`)
   - Backtest runner
   - Historical results
   - Parameter optimization
   - Performance reports

9. **Risk Management** (`/risk-management`)
   - Risk settings
   - Position sizing rules
   - Stop loss configuration
   - Drawdown limits

10. **News Calendar** (`/news-calendar`)
    - Economic calendar
    - News sentiment
    - Emergency controls
    - Trading restrictions

### Components (`src/components/`)

- **`auth/`** - Login, register, password reset
- **`dashboard/`** - Dashboard widgets
- **`strategies/`** - Strategy cards, forms
- **`signals/`** - Signal cards, feed
- **`positions/`** - Position tables, cards
- **`providers/`** - Provider profiles, stats
- **`charts/`** - Chart.js visualizations
- **`common/`** - Shared UI components
- **`layout/`** - Navigation, headers, footers

---

## 🗄 Database Schema

### Core Tables (Prisma Schema)

#### Users & Authentication
```prisma
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  username  String    @unique
  password  String
  role      UserRole  @default(USER)
  firstName String?
  lastName  String?
  avatar    String?
  bio       String?

  apiKeys       ApiKey[]
  strategies    Strategy[]
  signals       Signal[]
  subscriptions Subscription[]
  positions     Position[]
  trades        Trade[]
}
```

#### Signals & Trading
```prisma
model Signal {
  id           String       @id @default(uuid())
  providerId   String
  strategyId   String?
  symbol       String
  side         OrderSide
  type         SignalType
  status       SignalStatus
  entryPrice   Decimal
  takeProfit   Decimal?
  stopLoss     Decimal?
  leverage     Int?
  description  String?
  createdAt    DateTime     @default(now())

  provider     User         @relation(fields: [providerId])
  strategy     Strategy?    @relation(fields: [strategyId])
  positions    Position[]
}

model Position {
  id            String         @id @default(uuid())
  userId        String
  signalId      String?
  symbol        String
  side          OrderSide
  status        PositionStatus
  entryPrice    Decimal
  exitPrice     Decimal?
  quantity      Decimal
  leverage      Int
  realizedPnL   Decimal?
  openPnL       Decimal?
  mode          TradingMode
  openedAt      DateTime       @default(now())
  closedAt      DateTime?

  user          User           @relation(fields: [userId])
  signal        Signal?        @relation(fields: [signalId])
  trades        Trade[]
}
```

#### Strategies & Backtests
```prisma
model Strategy {
  id              String    @id @default(uuid())
  name            String
  description     String?
  providerId      String
  parameters      Json
  backtestResults Json?
  isPublic        Boolean   @default(false)
  createdAt       DateTime  @default(now())

  provider        User      @relation(fields: [providerId])
  signals         Signal[]
  subscriptions   Subscription[]
}
```

#### Subscriptions & Marketplace
```prisma
model Subscription {
  id          String             @id @default(uuid())
  userId      String
  providerId  String
  strategyId  String?
  status      SubscriptionStatus
  startDate   DateTime           @default(now())
  endDate     DateTime?
  price       Decimal

  user        User               @relation(fields: [userId])
  provider    User               @relation(fields: [providerId])
  strategy    Strategy?          @relation(fields: [strategyId])
}
```

---

## ⚙ Configuration

### Environment Variables (`.env`)

**SENSITIVE DATA MASKED - Do not commit actual values to version control**

```bash
# Environment
NODE_ENV=production
PORT=6864

# Database
DATABASE_URL=postgresql://[USERNAME]:[PASSWORD]@localhost:5432/automatedtradebot

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=[MASKED]
REDIS_DB=0

# JWT Authentication
JWT_SECRET=[MASKED_MIN_32_CHARS]
JWT_REFRESH_SECRET=[MASKED_MIN_32_CHARS]
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Frontend URL
FRONTEND_URL=http://[SERVER_IP]:6864

# TradingView Signal Capture
ENABLE_TRADINGVIEW_CAPTURE=true
TRADINGVIEW_CHART_URL=https://www.tradingview.com/chart/[CHART_ID]/
TRADINGVIEW_SESSION_ID=[MASKED]
TRADINGVIEW_SESSION_SIGN=[MASKED]
CHROME_EXECUTABLE_PATH=/usr/bin/chromium-browser
PUPPETEER_HEADLESS=true

# Telegram Bot (Optional)
TELEGRAM_BOT_TOKEN=[MASKED]
TELEGRAM_AUTHORIZED_USERS=[MASKED]
TELEGRAM_CHANNEL_ID=[MASKED]
TELEGRAM_ADMIN_CHAT_ID=[MASKED]

# Signal Distribution
SIGNAL_BROADCAST_TIMEOUT=5000
MAX_SUBSCRIBERS=10000

# Paper Trading
PAPER_TRADING_STARTING_BALANCE=10000
PAPER_TRADING_DEFAULT_LEVERAGE=10

# Risk Management
DEFAULT_RISK_PERCENT=2
DEFAULT_MAX_POSITION_PERCENT=50
DEFAULT_LEVERAGE=10
TRADING_FEE_PERCENT=0.1

# Logging
LOG_LEVEL=info
LOG_DIR=/home/automatedtradebot/logs

# Admin
ADMIN_EMAIL=admin@automatedtradebot.com
ADMIN_DEFAULT_PASSWORD=[MASKED]

# Encryption (for API keys storage)
ENCRYPTION_SECRET=[MASKED]
ENCRYPTION_SALT=[MASKED]
```

### PM2 Ecosystem Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'automatedtradebot-api',
      script: './src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 6864,
        ENABLE_TRADINGVIEW_CAPTURE: 'true',
        PUPPETEER_HEADLESS: 'true'
      },
      error_file: '/home/automatedtradebot/logs/api-error.log',
      out_file: '/home/automatedtradebot/logs/api-out.log',
      max_memory_restart: '2G',
      autorestart: true,
      kill_timeout: 10000
    },
    {
      name: 'automatedtradebot-worker',
      script: './src/workers/backtestWorker.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G'
    },
    {
      name: 'automatedtradebot-signals',
      script: './src/workers/signalWorker.js',
      instances: 1,
      max_memory_restart: '512M'
    }
  ]
};
```

---

## 🔗 API Endpoints

### Authentication
```
POST   /api/auth/register          # User registration
POST   /api/auth/login             # User login
GET    /api/auth/me                # Get current user
POST   /api/auth/refresh           # Refresh JWT token
POST   /api/auth/logout            # Logout user
```

### Signals
```
GET    /api/signals                # List signals
POST   /api/signals                # Create signal (providers)
GET    /api/signals/:id            # Get signal details
PUT    /api/signals/:id            # Update signal
DELETE /api/signals/:id            # Delete signal
GET    /api/signals/live           # Live signal feed
```

### Strategies
```
GET    /api/strategies             # List strategies
POST   /api/strategies             # Create strategy
GET    /api/strategies/:id         # Get strategy details
PUT    /api/strategies/:id         # Update strategy
DELETE /api/strategies/:id         # Delete strategy
POST   /api/strategies/test        # Test strategy
GET    /api/strategies/:id/performance  # Strategy performance
```

### Providers
```
GET    /api/providers              # List providers
GET    /api/providers/:id          # Provider profile
POST   /api/providers/apply        # Apply to become provider
GET    /api/providers/:id/performance  # Provider stats
GET    /api/providers/:id/signals  # Provider signals
```

### Subscriptions
```
GET    /api/subscriptions          # User subscriptions
POST   /api/subscriptions          # Subscribe to provider
DELETE /api/subscriptions/:id      # Unsubscribe
GET    /api/subscriptions/active   # Active subscriptions
PUT    /api/subscriptions/:id/pause  # Pause subscription
```

### Positions
```
GET    /api/positions              # Get positions
GET    /api/positions/:id          # Position details
POST   /api/positions/close/:id    # Close position
GET    /api/positions/stats        # Position statistics
```

### Trades
```
GET    /api/trades                 # Trade history
GET    /api/trades/:id             # Trade details
GET    /api/trades/stats           # Trade statistics
```

### Backtests
```
POST   /api/backtests              # Run backtest
GET    /api/backtests              # List backtests
GET    /api/backtests/:id          # Backtest results
DELETE /api/backtests/:id          # Delete backtest
POST   /api/backtests/optimize     # Optimize parameters
```

### Risk Management
```
GET    /api/risk-management        # Get risk config
PUT    /api/risk-management        # Update risk config
POST   /api/risk-management/emergency-stop  # Emergency stop all
```

### Marketplace
```
GET    /api/marketplace/strategies # Browse strategies
GET    /api/marketplace/providers  # Browse providers
GET    /api/marketplace/leaderboard  # Top providers
GET    /api/marketplace/featured   # Featured strategies
```

### Analytics
```
GET    /api/analytics/dashboard    # Dashboard data
GET    /api/analytics/performance  # Performance metrics
GET    /api/analytics/reports      # Generate report
```

### News Calendar
```
GET    /api/news-calendar          # Economic events
GET    /api/news-calendar/impact   # High impact events
POST   /api/news-calendar/alerts   # Set event alerts
```

### WebSocket
```
WS     /ws/signals?token=JWT       # Real-time signals
WS     /ws/positions?token=JWT     # Real-time positions
WS     /ws/prices?token=JWT        # Real-time prices
```

### TradingView Webhook
```
POST   /api/tradingview/webhook    # Receive TradingView alerts
```

---

## 🚀 Services & Features

### 1. TradingView Signal Capture

**Technology:** Puppeteer, Tesseract.js OCR

**Process:**
1. Opens TradingView chart URL with session cookies
2. Polls DOM every 10ms for popup changes using MutationObserver
3. Captures signal text via OCR
4. Parses signal format (symbol, direction, entry, TP, SL)
5. Sends to Signal Coordinator

**Configuration:**
- Chart URL: Specified in environment variables
- Session authentication via cookies (supports 2FA)
- Headless mode for production
- 10ms polling interval

### 2. Telegram Bot Integration

**Commands:**
- `/signal BTCUSDT LONG 45000 TP:46000 SL:44500` - Send signal
- `/status` - Bot status
- `/stats` - Performance stats

**Features:**
- Authorized user list
- Multi-format signal parsing
- Broadcast to channels
- Admin notifications

### 3. Paper Trading Engine

**Features:**
- Starting balance: $10,000
- Default leverage: 10x
- Position monitoring: 100ms intervals
- Auto TP/SL execution
- Real-time PnL calculation
- Session persistence

**PnL Calculation:**
```javascript
// Long position
openPnL = (currentPrice - entryPrice) * quantity
// Short position
openPnL = (entryPrice - currentPrice) * quantity
```

### 4. Real Trading Engine

**Supported Exchanges:**
- Bybit (Futures & Spot)
- MEXC
- Bitget
- Binance Futures

**Features:**
- CCXT integration
- Automatic position sizing
- TP/SL order placement
- Risk limits enforcement
- Real-time execution

### 5. Signal Distribution

**Technology:** Socket.io WebSocket

**Features:**
- JWT authentication
- <100ms broadcast latency
- Auto-execution if enabled
- Signal validation
- Subscriber limits

**Event Flow:**
```
Client connects → Authenticate JWT → Subscribe to signals
Signal received → Validate → Broadcast to subscribers
Auto-execute if enabled → Update positions
```

### 6. Adaptive Risk Management

**AI-Powered Risk Control:**
- Dynamic position sizing based on market volatility
- Adaptive TP/SL calculation
- News-based risk reduction
- Drawdown protection
- Win rate tracking
- Risk per trade adjustment

**Features:**
- Real-time volatility monitoring
- ATR-based TP/SL adjustment
- News event filtering
- Emergency stop all positions
- Per-strategy risk limits

### 7. Backtesting System

**Data Sources:**
- Real historical data from exchanges (Bybit, MEXC, Bitget)
- Multiple timeframes: 5m, 15m, 1h, 4h, 1d
- OHLCV data with volume

**Metrics Calculated:**
- Win rate
- ROI
- Sharpe ratio
- Maximum drawdown
- Average trade duration
- Profit factor
- Risk/reward ratio

**Features:**
- Multi-strategy testing
- Parameter optimization (±30% range)
- Real fees (0.1%) and slippage (0.05%)
- Equity curve generation
- Performance heatmaps

### 8. News Sentiment Monitoring

**Features:**
- Economic calendar integration
- High-impact event detection
- Sentiment analysis
- Trading restrictions during events
- Emergency controls

**Actions:**
- Pause trading during high-impact news
- Close all positions
- Reduce position sizes
- Increase stop losses

---

## 🌐 Deployment Setup

### Server Requirements

- **OS:** Ubuntu 24.04 LTS
- **CPU:** 4+ cores
- **RAM:** 8GB minimum (16GB recommended)
- **Storage:** 50GB SSD
- **Network:** Stable connection with low latency to exchanges

### Installation Steps

#### 1. System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 16
sudo apt-get install -y postgresql-16 postgresql-contrib-16

# Install Redis
sudo apt-get install -y redis-server

# Install Chromium for Puppeteer
sudo apt-get install -y chromium-browser chromium-codecs-ffmpeg \
    fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 libgbm1 \
    libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0

# Install PM2
sudo npm install -g pm2
```

#### 2. Database Setup

```bash
# Create PostgreSQL database
sudo -u postgres psql
CREATE DATABASE automatedtradebot;
CREATE USER tradebot WITH ENCRYPTED PASSWORD '[SECURE_PASSWORD]';
GRANT ALL PRIVILEGES ON DATABASE automatedtradebot TO tradebot;
\q

# Run Prisma migrations
cd /home/automatedtradebot/backend
npx prisma migrate deploy
npx prisma generate
```

#### 3. Backend Setup

```bash
cd /home/automatedtradebot/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Edit with actual values

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd
```

#### 4. Frontend Setup

```bash
cd /home/automatedtradebot/frontend

# Install dependencies
npm install

# Build for production
npm run build

# Start with PM2
pm2 start npm --name "automatedtradebot-frontend" -- start
pm2 save
```

#### 5. Nginx Configuration

```nginx
server {
    listen 80;
    server_name automatedtradebot.com www.automatedtradebot.com;

    location / {
        proxy_pass http://127.0.0.1:3000;  # Next.js frontend
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://127.0.0.1:6864;  # Backend API
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }

    location /ws {
        proxy_pass http://127.0.0.1:6864;  # WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

#### 6. SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d automatedtradebot.com -d www.automatedtradebot.com
```

#### 7. Firewall Configuration

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 6864/tcp  # Backend API (if needed externally)
sudo ufw enable
```

### PM2 Management Commands

```bash
# Status
pm2 status

# Logs
pm2 logs
pm2 logs automatedtradebot-api
pm2 logs --lines 100

# Restart
pm2 restart all
pm2 restart automatedtradebot-api

# Stop
pm2 stop all
pm2 stop automatedtradebot-api

# Monitor
pm2 monit

# Save configuration
pm2 save

# Startup script
pm2 startup systemd
```

---

## 📊 Monitoring & Maintenance

### Logging

**Log Locations:**
```
/home/automatedtradebot/logs/
├── api-out.log          # API stdout
├── api-error.log        # API stderr
├── worker-out.log       # Worker stdout
├── worker-error.log     # Worker stderr
└── signals-*.log        # Signal logs
```

**View Logs:**
```bash
# Real-time logs
pm2 logs

# Tail specific log
tail -f /home/automatedtradebot/logs/api-out.log

# Search logs
grep "ERROR" /home/automatedtradebot/logs/api-error.log

# Last 100 lines
pm2 logs --lines 100
```

### Database Backups

**Automated Backup Script:**
```bash
#!/bin/bash
# /home/automatedtradebot/backup.sh

BACKUP_DIR="/home/automatedtradebot/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="automatedtradebot"

# Create backup directory
mkdir -p $BACKUP_DIR

# PostgreSQL backup
sudo -u postgres pg_dump $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Compress
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_backup_$DATE.sql.gz"
```

**Cron Job:**
```bash
# Daily backup at 2 AM
0 2 * * * /home/automatedtradebot/backup.sh
```

### Health Checks

**Check Services:**
```bash
# PM2 status
pm2 status

# PostgreSQL
sudo systemctl status postgresql

# Redis
sudo systemctl status redis

# Nginx
sudo systemctl status nginx

# Disk space
df -h

# Memory usage
free -h

# Process monitoring
pm2 monit
```

**API Health Endpoint:**
```bash
curl http://localhost:6864/api/health
```

### Performance Monitoring

**Metrics to Monitor:**
- API response time
- WebSocket connection count
- Database query performance
- Redis cache hit rate
- Signal capture latency
- Position update frequency
- Memory usage per process
- CPU usage

**PM2 Monitoring:**
```bash
pm2 monit  # Real-time monitoring
pm2 list   # Process list with metrics
```

### Troubleshooting

**Common Issues:**

1. **Chromium Not Found**
```bash
which chromium-browser
# Update CHROME_EXECUTABLE_PATH in .env
```

2. **Database Connection Failed**
```bash
sudo systemctl status postgresql
psql -U tradebot -d automatedtradebot -h localhost
```

3. **WebSocket Connection Failed**
```bash
pm2 logs automatedtradebot-api
# Check JWT token validity
# Check firewall rules
```

4. **TradingView Capture Not Working**
```bash
# Enable debug mode
PUPPETEER_HEADLESS=false pm2 restart automatedtradebot-api
pm2 logs --lines 100 | grep "TradingView"
```

5. **High Memory Usage**
```bash
pm2 restart all
# Check max_memory_restart in ecosystem.config.js
```

---

## 📝 Important Notes

### Security Considerations

1. **API Keys Storage**
   - All exchange API keys are encrypted using AES-256
   - Encryption keys stored in environment variables
   - Never commit `.env` to version control

2. **Authentication**
   - JWT tokens with 15-minute expiry
   - Refresh tokens with 7-day expiry
   - Password hashing with bcrypt

3. **Rate Limiting**
   - API endpoints rate-limited
   - WebSocket connection limits
   - Abuse prevention mechanisms

4. **Input Validation**
   - All inputs validated with express-validator
   - SQL injection prevention via Prisma ORM
   - XSS protection with Helmet.js

### Performance Optimization

1. **Caching**
   - Redis for market data (1-second TTL)
   - Session caching
   - Strategy results caching

2. **Database**
   - Indexed queries on frequently accessed fields
   - Connection pooling
   - Query optimization

3. **WebSocket**
   - Connection pooling
   - Throttled updates
   - Delta compression

### Backup Strategy

1. **Database:** Daily automated backups at 2 AM
2. **Code:** Version controlled with Git
3. **Logs:** Rotated daily, kept for 7 days
4. **Configuration:** Backed up weekly

---

## 🔐 Sensitive Information Summary

**The following information has been MASKED in this documentation:**

1. **Database Credentials**
   - PostgreSQL username and password
   - Database connection URL

2. **API Keys & Secrets**
   - JWT secret keys
   - Encryption secrets and salts
   - TradingView session cookies
   - Telegram bot token
   - Exchange API keys (Bybit, MEXC, Bitget)

3. **Server Information**
   - Public IP address
   - Server hostname
   - Admin passwords

4. **Third-party Credentials**
   - TradingView credentials
   - Telegram authorized user IDs
   - Email credentials

**Security Reminder:** Never commit actual credentials to version control. Use environment variables and secure secret management systems.

---

## 📞 Project Reference Links

- **GitHub Repository (Original Inspiration):** Similar projects exist but this is custom-built
- **TradingView:** https://www.tradingview.com
- **CCXT Documentation:** https://docs.ccxt.com
- **Prisma Documentation:** https://www.prisma.io/docs
- **Next.js Documentation:** https://nextjs.org/docs
- **PM2 Documentation:** https://pm2.keymetrics.io/docs

---

## 📄 Documentation Metadata

- **Created:** November 11, 2025
- **Author:** Project Documentation
- **Version:** 1.0.0
- **Purpose:** Complete project reference for automatedtradebot.com
- **Security Level:** SENSITIVE - Contains masked credentials

---

**End of Documentation**
