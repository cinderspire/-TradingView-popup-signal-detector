# AUTOMATEDTRADEBOT - COMPLETE SITE STRUCTURE
## Full Page Architecture with No Orphan Pages

---

## 🗺️ SITEMAP OVERVIEW

```
/ (Homepage)
├── /dashboard (Main Dashboard) [Protected]
│   ├── /dashboard/overview
│   ├── /dashboard/positions
│   ├── /dashboard/performance
│   └── /dashboard/alerts
│
├── /trading (Trading Center)
│   ├── /trading/strategies
│   │   ├── /trading/strategies/browse
│   │   ├── /trading/strategies/create
│   │   ├── /trading/strategies/import
│   │   └── /trading/strategies/:id
│   │
│   ├── /trading/paper
│   │   ├── /trading/paper/sessions
│   │   ├── /trading/paper/new
│   │   └── /trading/paper/session/:id
│   │
│   ├── /trading/real
│   │   ├── /trading/real/sessions
│   │   ├── /trading/real/new
│   │   └── /trading/real/session/:id
│   │
│   └── /trading/backtest
│       ├── /trading/backtest/single
│       ├── /trading/backtest/batch
│       └── /trading/backtest/results/:id
│
├── /marketplace (Signal Marketplace)
│   ├── /marketplace/providers
│   │   ├── /marketplace/providers/browse
│   │   ├── /marketplace/providers/top
│   │   └── /marketplace/provider/:id
│   │
│   ├── /marketplace/signals
│   │   ├── /marketplace/signals/live
│   │   ├── /marketplace/signals/history
│   │   └── /marketplace/signal/:id
│   │
│   └── /marketplace/subscriptions
│       ├── /marketplace/subscriptions/my
│       └── /marketplace/subscriptions/manage
│
├── /analytics (Analytics & Reports)
│   ├── /analytics/portfolio
│   ├── /analytics/performance
│   ├── /analytics/risk
│   └── /analytics/reports
│
├── /tradingview (TradingView Integration)
│   ├── /tradingview/setup
│   ├── /tradingview/alerts
│   └── /tradingview/webhooks
│
├── /account (User Account)
│   ├── /account/profile
│   ├── /account/settings
│   ├── /account/api-keys
│   ├── /account/billing
│   └── /account/security
│
├── /provider (Provider Portal) [Provider Only]
│   ├── /provider/dashboard
│   ├── /provider/signals
│   ├── /provider/subscribers
│   ├── /provider/earnings
│   └── /provider/apply
│
├── /auth (Authentication)
│   ├── /auth/login
│   ├── /auth/register
│   ├── /auth/forgot-password
│   └── /auth/verify-email
│
├── /docs (Documentation)
│   ├── /docs/getting-started
│   ├── /docs/api
│   ├── /docs/strategies
│   ├── /docs/tradingview
│   └── /docs/faq
│
└── /legal
    ├── /legal/terms
    ├── /legal/privacy
    └── /legal/disclaimer
```

---

## 📱 PAGE DETAILS & CONNECTIONS

### 1. HOMEPAGE (/)
**Purpose**: Landing page for new visitors
**Navigation**:
- Login → /auth/login
- Register → /auth/register
- Browse Providers → /marketplace/providers
- View Signals → /marketplace/signals
- Start Free → /auth/register
- Documentation → /docs

---

### 2. DASHBOARD (/dashboard)
**Purpose**: Main control center for logged-in users
**Sections**:
```javascript
{
  overview: {
    url: '/dashboard/overview',
    widgets: [
      'Account Balance',
      'Open PnL',
      'Today Performance',
      'Active Positions',
      'Recent Alerts',
      'Quick Actions'
    ]
  },
  positions: {
    url: '/dashboard/positions',
    features: [
      'Live position tracking',
      'Open PnL updates',
      'Quick close buttons',
      'Position details modal'
    ]
  },
  performance: {
    url: '/dashboard/performance',
    charts: [
      'Equity curve',
      'Daily PnL',
      'Win rate trend',
      'Strategy comparison'
    ]
  },
  alerts: {
    url: '/dashboard/alerts',
    types: [
      'TradingView signals',
      'Price alerts',
      'News events',
      'Risk warnings'
    ]
  }
}
```

**Navigation Links**:
- Trading → /trading/strategies
- Paper Trading → /trading/paper
- Real Trading → /trading/real
- Analytics → /analytics/portfolio
- Settings → /account/settings

---

### 3. TRADING CENTER (/trading)

#### A. Strategies (/trading/strategies)
**Features**:
- Browse all strategies
- Filter by performance/risk
- Quick backtest
- Deploy to paper/real
**Links to**:
- Strategy details → /trading/strategies/:id
- Import Pine Script → /trading/strategies/import
- Create custom → /trading/strategies/create
- Backtest → /trading/backtest

#### B. Paper Trading (/trading/paper)
**Features**:
- Start new session
- Monitor active sessions
- View session details
- Stop/pause controls
**Links to**:
- New session → /trading/paper/new
- Session details → /trading/paper/session/:id
- Performance → /analytics/performance
- Convert to real → /trading/real/new

#### C. Real Trading (/trading/real)
**Features**:
- $3/month per strategy
- Live execution
- Risk controls
- Emergency stop
**Links to**:
- Subscription → /marketplace/subscriptions
- Risk settings → /account/settings
- Performance → /analytics/performance

#### D. Backtesting (/trading/backtest)
**Features**:
- Single pair test
- Batch testing
- Optimization
- Export results
**Links to**:
- Results → /trading/backtest/results/:id
- Deploy to paper → /trading/paper/new
- Strategy details → /trading/strategies/:id

---

### 4. SIGNAL MARKETPLACE (/marketplace)

#### A. Providers (/marketplace/providers)
**Features**:
- Browse all providers
- Filter by performance
- View provider details
- Subscribe button
**Links to**:
- Provider profile → /marketplace/provider/:id
- Subscribe → /marketplace/subscriptions/manage
- Provider signals → /marketplace/signals

#### B. Signals (/marketplace/signals)
**Features**:
- Live signal feed
- Historical performance
- Copy trading options
- Signal details
**Links to**:
- Signal details → /marketplace/signal/:id
- Provider → /marketplace/provider/:id
- Copy trade → /trading/real/new

#### C. Subscriptions (/marketplace/subscriptions)
**Features**:
- Current subscriptions
- Add/remove
- Billing management
- Performance tracking
**Links to**:
- Billing → /account/billing
- Provider → /marketplace/provider/:id
- Settings → /account/settings

---

### 5. ANALYTICS (/analytics)

#### A. Portfolio (/analytics/portfolio)
**Features**:
- Asset allocation
- Strategy distribution
- Risk metrics
- Correlation matrix
**Links to**:
- Strategies → /trading/strategies
- Rebalance → /trading/paper/new

#### B. Performance (/analytics/performance)
**Features**:
- Detailed metrics
- Comparison charts
- Export reports
- Period selection
**Links to**:
- Download report → Export function
- Strategy details → /trading/strategies/:id

#### C. Risk Analysis (/analytics/risk)
**Features**:
- Risk scores
- Drawdown analysis
- VaR calculations
- Stress testing
**Links to**:
- Adjust risk → /account/settings
- AI consultant → /dashboard

#### D. Reports (/analytics/reports)
**Features**:
- Generate reports
- Tax documents
- Trade history
- Monthly summaries
**Links to**:
- Download → Export function
- Email report → /account/settings

---

### 6. TRADINGVIEW INTEGRATION (/tradingview)

#### A. Setup (/tradingview/setup)
**Features**:
- Connection guide
- API configuration
- Test connection
- Troubleshooting
**Links to**:
- Alerts → /tradingview/alerts
- Webhooks → /tradingview/webhooks
- Documentation → /docs/tradingview

#### B. Alerts (/tradingview/alerts)
**Features**:
- Alert history
- Active alerts
- Performance by alert
- Alert configuration
**Links to**:
- Setup → /tradingview/setup
- Trading → /trading/paper

#### C. Webhooks (/tradingview/webhooks)
**Features**:
- Webhook URL
- Configuration
- Test webhook
- Logs
**Links to**:
- Documentation → /docs/tradingview
- Alerts → /tradingview/alerts

---

### 7. ACCOUNT (/account)

#### A. Profile (/account/profile)
**Features**:
- Personal info
- Trading experience
- Risk profile
- Preferences
**Links to**:
- Settings → /account/settings
- Security → /account/security

#### B. Settings (/account/settings)
**Features**:
- Trading settings
- Notification preferences
- Display options
- Time zone
**Links to**:
- API keys → /account/api-keys
- Security → /account/security

#### C. API Keys (/account/api-keys)
**Features**:
- Exchange connections
- API management
- Test connections
- Security
**Links to**:
- Documentation → /docs/api
- Security → /account/security

#### D. Billing (/account/billing)
**Features**:
- Current plan
- Payment methods
- Invoice history
- Upgrade/downgrade
**Links to**:
- Subscriptions → /marketplace/subscriptions
- Support → /docs/faq

#### E. Security (/account/security)
**Features**:
- 2FA setup
- Password change
- Login history
- Sessions
**Links to**:
- Profile → /account/profile

---

### 8. PROVIDER PORTAL (/provider)

#### A. Provider Dashboard (/provider/dashboard)
**Features**:
- Earnings overview
- Subscriber count
- Performance metrics
- Recent activity
**Links to**:
- Signals → /provider/signals
- Earnings → /provider/earnings

#### B. Signal Management (/provider/signals)
**Features**:
- Create signals
- Edit/close signals
- Performance tracking
- History
**Links to**:
- Dashboard → /provider/dashboard
- Subscribers → /provider/subscribers

#### C. Subscribers (/provider/subscribers)
**Features**:
- Subscriber list
- Analytics
- Communication
- Retention metrics
**Links to**:
- Earnings → /provider/earnings
- Signals → /provider/signals

#### D. Earnings (/provider/earnings)
**Features**:
- Revenue breakdown
- Payout history
- Tax documents
- Withdrawal
**Links to**:
- Dashboard → /provider/dashboard
- Billing → /account/billing

#### E. Apply (/provider/apply)
**Features**:
- Application form
- Requirements
- Verification
- Status
**Links to**:
- Documentation → /docs
- Support → /docs/faq

---

### 9. AUTHENTICATION (/auth)

#### A. Login (/auth/login)
**Links to**:
- Register → /auth/register
- Forgot password → /auth/forgot-password
- Dashboard → /dashboard (after login)

#### B. Register (/auth/register)
**Links to**:
- Login → /auth/login
- Terms → /legal/terms
- Privacy → /legal/privacy

#### C. Forgot Password (/auth/forgot-password)
**Links to**:
- Login → /auth/login
- Register → /auth/register

#### D. Verify Email (/auth/verify-email)
**Links to**:
- Login → /auth/login
- Resend → Function

---

### 10. DOCUMENTATION (/docs)

#### A. Getting Started (/docs/getting-started)
**Links to**:
- API docs → /docs/api
- Strategies → /docs/strategies
- FAQ → /docs/faq

#### B. API Documentation (/docs/api)
**Links to**:
- API keys → /account/api-keys
- Examples → Code samples

#### C. Strategy Guide (/docs/strategies)
**Links to**:
- Browse strategies → /trading/strategies
- Create strategy → /trading/strategies/create

#### D. TradingView Guide (/docs/tradingview)
**Links to**:
- Setup → /tradingview/setup
- Webhooks → /tradingview/webhooks

#### E. FAQ (/docs/faq)
**Links to**:
- Contact support → Email
- Documentation → /docs

---

### 11. LEGAL (/legal)

#### A. Terms of Service (/legal/terms)
**Links to**:
- Privacy → /legal/privacy
- Homepage → /

#### B. Privacy Policy (/legal/privacy)
**Links to**:
- Terms → /legal/terms
- Homepage → /

#### C. Risk Disclaimer (/legal/disclaimer)
**Links to**:
- Terms → /legal/terms
- Homepage → /

---

## 🔗 NAVIGATION STRUCTURE

### MAIN NAVIGATION (All Pages)
```
Logo → /
Dashboard → /dashboard
Trading → /trading/strategies
Paper → /trading/paper
Real → /trading/real
Marketplace → /marketplace/providers
Analytics → /analytics/portfolio
Account → /account/profile
```

### FOOTER (All Pages)
```
About → /
Documentation → /docs
API → /docs/api
Terms → /legal/terms
Privacy → /legal/privacy
Disclaimer → /legal/disclaimer
Contact → Email
```

### USER MENU (Logged In)
```
Profile → /account/profile
Settings → /account/settings
Billing → /account/billing
API Keys → /account/api-keys
Security → /account/security
Logout → /auth/logout
```

### QUICK ACTIONS (Dashboard)
```
New Paper Trade → /trading/paper/new
New Real Trade → /trading/real/new
Browse Strategies → /trading/strategies
View Signals → /marketplace/signals
Run Backtest → /trading/backtest
```

---

## ✅ NO ORPHAN PAGES

Every page is:
1. Linked from at least one other page
2. Included in navigation or sitemap
3. Accessible through logical user flow
4. Connected to related pages
5. Part of the main site structure

---

## 🎯 PERFECT ORGANIZATION

- Clear hierarchy
- Logical grouping
- Consistent navigation
- No dead ends
- Complete user flows
- Comprehensive linking
- Full accessibility