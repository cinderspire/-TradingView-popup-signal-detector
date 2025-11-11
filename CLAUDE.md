# AutomatedTradeBot - Trading Signal Marketplace Platform

## 🎯 Project Overview

AutomatedTradeBot is a comprehensive trading signal marketplace platform similar to SignalStart but with enhanced features:
- **Real-time signal distribution** via WebSocket
- **Advanced analytics** with open PnL, max DD tracking
- **Rich animated charts** and performance metrics
- **Two-sided marketplace** - users can both buy and sell signals
- **Multi-broker integration** - MT4/MT5, crypto exchanges
- **Subscription management** with payment processing

**Domain:** automatedtradebot.com
**Tech Stack:** Node.js, Next.js, PostgreSQL, Redis, WebSocket

---

## 📁 Project Structure

```
/home/automatedtradebot/
├── backend/                    # Node.js/Express API Server
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── models/            # Database models (Sequelize/Prisma)
│   │   ├── routes/            # API route definitions
│   │   ├── services/          # Business logic layer
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── utils/             # Helper functions
│   │   └── websocket/         # Real-time signal distribution
│   ├── config/                # Environment configs
│   └── tests/                 # Unit & integration tests
│
├── frontend/                   # Next.js 14+ Application
│   ├── src/
│   │   ├── app/               # App router (Next.js 14)
│   │   │   ├── (auth)/        # Auth pages (login, register)
│   │   │   ├── dashboard/     # User dashboard
│   │   │   ├── providers/     # Signal providers list
│   │   │   ├── signals/       # Signals feed
│   │   │   └── api/           # API routes
│   │   ├── components/
│   │   │   ├── charts/        # Recharts components
│   │   │   ├── dashboard/     # Dashboard widgets
│   │   │   ├── providers/     # Provider cards, profiles
│   │   │   ├── signals/       # Signal cards, feed
│   │   │   ├── auth/          # Auth forms
│   │   │   └── common/        # Reusable UI components
│   │   ├── lib/               # Utilities, API clients
│   │   ├── hooks/             # Custom React hooks
│   │   ├── styles/            # Global CSS, Tailwind
│   │   └── types/             # TypeScript types
│   └── public/                # Static assets
│
├── shared/                     # Shared code between backend/frontend
│   ├── types/                 # TypeScript interfaces
│   ├── constants/             # Shared constants
│   └── utils/                 # Shared utilities
│
├── database/                   # Database management
│   ├── migrations/            # DB schema migrations
│   ├── seeds/                 # Seed data for development
│   └── schemas/               # Schema definitions
│
├── docker/                     # Docker configurations
│   ├── docker-compose.yml     # Multi-container setup
│   ├── Dockerfile.backend     # Backend container
│   └── Dockerfile.frontend    # Frontend container
│
└── docs/                       # Additional documentation
    ├── API.md                 # API documentation
    ├── DEPLOYMENT.md          # Deployment guide
    └── ARCHITECTURE.md        # System architecture
```

---

## 🛠️ Technology Stack

### Backend
- **Runtime:** Node.js 20+ LTS
- **Framework:** Express.js
- **Database:** PostgreSQL 16+ (main data)
- **Cache/Queue:** Redis 7+ (sessions, rate limiting, job queue)
- **ORM:** Prisma / Sequelize
- **Real-time:** Socket.io (WebSocket)
- **Auth:** JWT + Refresh tokens
- **Payment:** Stripe API
- **Validation:** Joi / Zod
- **Testing:** Jest, Supertest

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **UI Library:** React 18+
- **Styling:** TailwindCSS + Shadcn/ui components
- **Charts:** Recharts, Chart.js, TradingView widgets
- **State Management:** Zustand / React Context
- **Forms:** React Hook Form + Zod validation
- **HTTP Client:** Axios / Fetch API
- **WebSocket Client:** Socket.io-client
- **Animations:** Framer Motion
- **Icons:** Lucide React / Heroicons

### DevOps
- **Containerization:** Docker, Docker Compose
- **Reverse Proxy:** Nginx
- **CI/CD:** GitHub Actions
- **Monitoring:** PM2, Winston (logging)
- **SSL:** Let's Encrypt (Certbot)

---

## 🚀 Key Features

### For Signal Providers (Sellers)
1. **Provider Dashboard**
   - Real-time portfolio statistics
   - Subscriber management
   - Revenue analytics
   - Signal history

2. **Signal Publishing**
   - Manual signal entry
   - API integration (MT4/MT5 copier)
   - Automated signal forwarding
   - TradingView alerts webhook

3. **Performance Tracking**
   - Win rate, profit factor
   - Sharpe ratio, max drawdown
   - Open PnL visualization
   - Historical equity curve

4. **Subscription Management**
   - Set pricing tiers (monthly/yearly)
   - Free trial options
   - Subscriber analytics
   - Revenue reports

### For Subscribers (Buyers)
1. **Signal Discovery**
   - Advanced filtering (asset, strategy, performance)
   - Provider comparison
   - Real-time performance metrics
   - Social proof (reviews, ratings)

2. **Signal Reception**
   - Real-time signal notifications
   - WebSocket live feed
   - Email/SMS alerts
   - Mobile app (future)

3. **Portfolio Management**
   - Active subscriptions
   - Performance tracking per provider
   - Aggregate P&L
   - Risk metrics

4. **Copy Trading**
   - Automated trade execution
   - Position sizing customization
   - Risk management rules
   - Broker API integration

5. **Premium Risk Management (Paid Account Management)**
   - **Adaptive Risk Control**
     - Dynamic position sizing based on account performance
     - Auto-adjusting leverage based on market volatility
     - Progressive risk reduction after losses
     - Risk scaling on winning streaks
   - **Non-Adaptive Risk Control**
     - Fixed percentage per trade
     - Fixed lot size trading
     - Maximum daily/weekly loss limits
     - Maximum concurrent positions
   - **News Sentiment-Based Stop Loss**
     - Automatic SL adjustment before high-impact news
     - Economic calendar integration
     - Tighter stops during volatile sessions
     - Weekend/holiday position protection
   - **Advanced Features**
     - Trailing stop management
     - Break-even automation
     - Partial take-profit levels
     - Time-based exit rules
     - Correlation-based exposure limits

### Admin Features
1. **Provider Verification**
   - KYC/AML checks
   - Performance verification
   - Fraud detection

2. **Platform Analytics**
   - User metrics
   - Revenue dashboard
   - System health monitoring

---

## 📊 Database Schema

### Core Tables

**users**
- id, email, password_hash
- role (provider/subscriber/admin)
- created_at, updated_at

**providers**
- id, user_id
- display_name, bio, avatar_url
- verification_status
- performance_metrics (JSON)

**subscriptions**
- id, provider_id, subscriber_id
- plan_type, amount, currency
- status (active/cancelled/expired)
- start_date, end_date

**signals**
- id, provider_id
- symbol, direction (buy/sell)
- entry_price, stop_loss, take_profit
- status (open/closed)
- opened_at, closed_at, pnl

**trades** (copy trading executions)
- id, signal_id, subscriber_id
- broker, account_id
- executed_price, quantity
- pnl, status

**risk_management_configs**
- id, user_id, subscription_id
- config_type (adaptive/non_adaptive/news_based)
- is_active, tier (free/premium)
- settings (JSON: position_size, max_risk, etc.)
- created_at, updated_at

**news_calendar**
- id, datetime, currency, event_name
- impact (low/medium/high)
- actual, forecast, previous

---

## 🔐 Authentication Flow

1. **Registration:**
   - Email/password
   - OAuth (Google, Twitter)
   - Email verification

2. **Login:**
   - JWT access token (15min expiry)
   - Refresh token (7 days, httpOnly cookie)
   - 2FA optional (TOTP)

3. **Authorization:**
   - Role-based access control (RBAC)
   - Subscription-based permissions

---

## 🎨 UI/UX Design Principles

1. **Modern & Professional**
   - Dark/light theme support
   - Glassmorphism effects
   - Smooth animations (Framer Motion)

2. **Data Visualization**
   - Interactive charts (Recharts)
   - Real-time updates
   - Color-coded performance indicators

3. **Responsive Design**
   - Mobile-first approach
   - Desktop optimized layouts
   - Touch-friendly interactions

4. **Trust Indicators**
   - Verified badges
   - Performance disclaimers
   - Transparent metrics

---

## 🌐 API Endpoints

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
```

### Providers
```
GET    /api/providers              # List all providers
GET    /api/providers/:id          # Get provider details
GET    /api/providers/:id/signals  # Provider's signals
GET    /api/providers/:id/stats    # Performance statistics
POST   /api/providers              # Become a provider
PUT    /api/providers/:id          # Update provider profile
```

### Signals
```
GET    /api/signals                # List signals (filtered)
GET    /api/signals/:id            # Signal details
POST   /api/signals                # Create signal (provider only)
PUT    /api/signals/:id            # Update signal
DELETE /api/signals/:id            # Close signal
```

### Subscriptions
```
GET    /api/subscriptions          # User's subscriptions
POST   /api/subscriptions          # Subscribe to provider
DELETE /api/subscriptions/:id      # Cancel subscription
GET    /api/subscriptions/revenue  # Provider's revenue (provider only)
```

### Risk Management (Premium)
```
GET    /api/risk-management          # Get user's risk configs
POST   /api/risk-management          # Create risk config
PUT    /api/risk-management/:id      # Update risk config
DELETE /api/risk-management/:id      # Delete risk config
GET    /api/news-calendar            # Get economic calendar
POST   /api/risk-management/test     # Test risk settings
```

### WebSocket Events
```
connect              # Client connects
authenticate         # Authenticate with JWT
signal:new           # New signal published
signal:update        # Signal updated (TP/SL hit, etc)
signal:close         # Signal closed
performance:update   # Provider performance update
```

---

## 🏗️ Development Setup

### Prerequisites
```bash
- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (optional)
```

### Installation

1. **Clone & Install Dependencies**
```bash
cd /home/automatedtradebot

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

2. **Environment Variables**

**backend/.env**
```env
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/automatedtradebot

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (SendGrid/AWS SES)
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**frontend/.env.local**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

3. **Database Setup**
```bash
cd backend
npm run db:migrate  # Run migrations
npm run db:seed     # Seed with test data
```

4. **Run Development Servers**
```bash
# Terminal 1 - Backend
cd backend
npm run dev        # Runs on http://localhost:3001

# Terminal 2 - Frontend
cd frontend
npm run dev        # Runs on http://localhost:3000
```

---

## 🐳 Docker Deployment

```bash
cd /home/automatedtradebot
docker-compose up -d
```

Services:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

---

## 📈 Performance Metrics Calculation

### Win Rate
```
win_rate = (winning_trades / total_closed_trades) * 100
```

### Profit Factor
```
profit_factor = gross_profit / gross_loss
```

### Max Drawdown
```
max_dd = max((peak_equity - current_equity) / peak_equity) * 100
```

### Sharpe Ratio
```
sharpe = (average_return - risk_free_rate) / standard_deviation_of_returns
```

### Open PnL
```
open_pnl = SUM((current_price - entry_price) * position_size * direction)
where direction = 1 for long, -1 for short
```

---

## 🔧 Development Guidelines

### Code Style
- **Backend:** ESLint + Prettier
- **Frontend:** ESLint + Prettier + TypeScript strict mode
- **Commits:** Conventional commits format

### Testing Strategy
1. **Unit Tests:** Individual functions (70%+ coverage)
2. **Integration Tests:** API endpoints
3. **E2E Tests:** Critical user flows (Playwright)

### Git Workflow
```bash
main         # Production
├── develop  # Development branch
    ├── feature/signal-feed
    ├── feature/payment-integration
    └── fix/chart-rendering
```

---

## 🚢 Deployment Checklist

### Pre-Production
- [ ] Run full test suite
- [ ] Update environment variables
- [ ] Database backup
- [ ] SSL certificates configured
- [ ] Rate limiting enabled
- [ ] CORS configured
- [ ] Monitoring setup (PM2, logging)

### Production Deployment
```bash
# Build frontend
cd frontend
npm run build

# Start backend with PM2
cd backend
pm2 start ecosystem.config.js

# Configure Nginx reverse proxy
sudo systemctl reload nginx
```

---

## 📚 Additional Resources

- **API Documentation:** `/docs/API.md`
- **Architecture Diagram:** `/docs/ARCHITECTURE.md`
- **Contributing Guide:** `/docs/CONTRIBUTING.md`

---

## 🎯 Roadmap

### Phase 1 (MVP) - 4 weeks
- [x] Project setup
- [ ] User authentication
- [ ] Provider profiles
- [ ] Signal publishing (manual)
- [ ] Basic charts
- [ ] Subscription management

### Phase 2 - 6 weeks
- [ ] Real-time WebSocket feed
- [ ] Advanced analytics
- [ ] Payment integration (Stripe)
- [ ] Email notifications
- [ ] Mobile responsive

### Phase 3 - 8 weeks
- [ ] MT4/MT5 API integration
- [ ] Automated copy trading
- [ ] TradingView webhook
- [ ] Chrome extension
- [ ] Mobile app (React Native)

### Phase 4 - Future
- [ ] Social features (comments, following)
- [ ] Strategy marketplace
- [ ] Backtesting tools
- [ ] AI-powered signal analysis
- [ ] Multi-language support

---

## 🔒 Security Considerations

1. **Input Validation:** Zod/Joi on all inputs
2. **SQL Injection:** Parameterized queries (Prisma/Sequelize)
3. **XSS Prevention:** Content Security Policy
4. **CSRF Protection:** SameSite cookies
5. **Rate Limiting:** Redis-backed (100 req/min per user)
6. **Secrets Management:** Environment variables, never commit
7. **HTTPS Only:** Force SSL in production
8. **Regular Updates:** Keep dependencies updated

---

## 📞 Support

- **Email:** support@automatedtradebot.com
- **Discord:** [Join our community](#)
- **Documentation:** https://docs.automatedtradebot.com

---

**Last Updated:** 2025-10-13
**Version:** 1.0.0
**License:** MIT
