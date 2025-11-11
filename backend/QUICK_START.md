# AutomatedTradeBot - Quick Start Guide

Get your trading signal marketplace up and running in minutes!

---

## 🚀 5-Minute Quick Start

### 1. Check System Status

```bash
# Verify the server is running
curl http://localhost:6864/health

# Run system verification
node scripts/verify-system.js
```

Expected output:
```json
{
  "status": "ok",
  "timestamp": "2025-10-22T...",
  "uptime": 123.456
}
```

### 2. Test Real-Time Data

```bash
# Get live prices from exchanges
curl "http://localhost:6864/api/realtime/prices?symbols=BTC/USDT,ETH/USDT,XRP/USDT"

# Verify exchange connections
curl http://localhost:6864/api/realtime/verify

# Test exchange latency
curl http://localhost:6864/api/realtime/latency
```

### 3. Access Frontend Pages

Open in your browser:
- **Homepage**: http://localhost:6864/
- **Signals Page**: http://localhost:6864/signals.html
- **Providers**: http://localhost:6864/providers.html
- **Dashboard**: http://localhost:6864/dashboard.html
- **Admin Panel**: http://localhost:6864/admin.html
- **Onboarding**: http://localhost:6864/onboarding.html

### 4. Test API Endpoints

```bash
# List all providers
curl http://localhost:6864/api/providers

# List all signals
curl http://localhost:6864/api/signals

# Get provider leaderboard
curl http://localhost:6864/api/analytics/leaderboard
```

---

## 📝 Create Your First User

### Register via API

```bash
curl -X POST http://localhost:6864/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "SecurePassword123!",
    "username": "cryptotrader",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login and Get Token

```bash
curl -X POST http://localhost:6864/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "SecurePassword123!"
  }'
```

Save the token from the response:
```bash
export TOKEN="eyJhbGc..."
```

### Use Authenticated Endpoints

```bash
# Get user profile
curl http://localhost:6864/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Get onboarding progress
curl http://localhost:6864/api/onboarding/progress \
  -H "Authorization: Bearer $TOKEN"

# Get analytics overview
curl http://localhost:6864/api/analytics/overview \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🎯 Common Use Cases

### For Traders

#### 1. Browse Providers
```javascript
const response = await fetch('http://localhost:6864/api/providers?sort=roi&limit=10');
const { data } = await response.json();
console.log('Top providers:', data.providers);
```

#### 2. Subscribe to Provider
```javascript
const response = await fetch('http://localhost:6864/api/subscriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    providerId: 'provider-uuid',
    paymentMethodId: 'stripe-pm-id'
  })
});
```

#### 3. Enable Copy Trading
```javascript
const response = await fetch('http://localhost:6864/api/copy-trading/enable', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    providerId: 'provider-uuid',
    strategyId: 'strategy-uuid',
    riskSettings: {
      maxPositionSize: 100,
      scaleFactor: 1.0,
      useStopLoss: true,
      useTakeProfit: true
    }
  })
});
```

### For Providers

#### 1. Register as Provider
```javascript
const response = await fetch('http://localhost:6864/api/providers', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    displayName: 'Crypto Master Pro',
    description: 'Professional trader with 5 years experience',
    tradingExperience: 5,
    specialties: ['XRP', 'SOL', 'BTC']
  })
});
```

#### 2. Create Trading Strategy
```javascript
const response = await fetch('http://localhost:6864/api/trading/strategies', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: '7RSI Momentum',
    description: 'Multi-timeframe RSI strategy',
    type: 'TECHNICAL',
    parameters: {
      rsiPeriod: 7,
      rsiOverbought: 70,
      rsiOversold: 30
    }
  })
});
```

#### 3. Publish Signal
```javascript
const response = await fetch('http://localhost:6864/api/signals', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    strategyId: 'strategy-uuid',
    pair: 'XRP/USDT',
    side: 'BUY',
    entryPrice: 0.5234,
    stopLoss: 0.5000,
    takeProfit: 0.5800,
    confidence: 85,
    risk: 'MEDIUM',
    analysis: 'Strong momentum on 1H and 4H timeframes'
  })
});
```

#### 4. Run Backtest
```javascript
const response = await fetch('http://localhost:6864/api/trading/backtest', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    strategyId: 'strategy-uuid',
    pair: 'XRP/USDT',
    timeframe: '1h',
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-12-31T23:59:59Z',
    initialCapital: 1000
  })
});
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` file:
```bash
# Server
NODE_ENV=production
PORT=6864

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/automatedtradebot"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_SECRET="your-refresh-secret"
REFRESH_TOKEN_EXPIRES_IN="7d"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Email
EMAIL_PROVIDER="sendgrid"
SENDGRID_API_KEY="SG...."
EMAIL_FROM="noreply@automatedtradebot.com"

# Exchanges (optional)
BYBIT_API_KEY="..."
BYBIT_API_SECRET="..."
```

### Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Run onboarding migrations
psql -U user -d automatedtradebot -f prisma/migrations/add_onboarding_tables.sql
```

---

## 📊 Monitor Your System

### View Logs

```bash
# Real-time logs
pm2 logs automatedtradebot-api

# Application logs
tail -f logs/combined.log

# Error logs only
tail -f logs/error.log
```

### System Metrics

```bash
# PM2 monitoring
pm2 monit

# Check memory usage
pm2 status

# Check API health
curl http://localhost:6864/health
```

### Create Manual Backup

```bash
# Create backup
node scripts/backup.js create manual

# List backups
node scripts/backup.js list

# View backup stats
node scripts/backup.js stats

# Verify backup
node scripts/backup.js verify <backup-id>
```

---

## 🧪 Testing

### Test WebSocket Connection

```javascript
// In browser console
const ws = new WebSocket('ws://localhost:6864/realtime');

ws.onopen = () => {
  console.log('Connected!');

  // Subscribe to prices
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'prices:BTC/USDT'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Load Testing

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Run load test
ab -n 1000 -c 10 http://localhost:6864/health
```

---

## 📚 Documentation

### Available Docs

- **API_DOCUMENTATION.md** - Complete API reference (70+ pages)
- **API_QUICK_REFERENCE.md** - Quick API guide
- **BACKUP_GUIDE.md** - Backup system documentation
- **PRODUCTION_DEPLOYMENT.md** - Production deployment guide
- **SYSTEM_STATUS.md** - Current system status
- **PROJECT_SUMMARY.md** - Project overview
- **QUICK_START.md** - This guide

### Useful Links

- Health Check: http://localhost:6864/health
- API Root: http://localhost:6864/
- Real-Time Verify: http://localhost:6864/api/realtime/verify

---

## 🎬 Demo Workflow

### Complete User Journey

```bash
# 1. Register user
curl -X POST http://localhost:6864/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@test.com","password":"Demo123!","username":"demouser"}'

# 2. Login
TOKEN=$(curl -X POST http://localhost:6864/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@test.com","password":"Demo123!"}' \
  | jq -r '.data.token')

# 3. View profile
curl http://localhost:6864/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 4. Browse providers
curl http://localhost:6864/api/providers?limit=5

# 5. View signals
curl http://localhost:6864/api/signals?status=ACTIVE&limit=10

# 6. Get analytics
curl http://localhost:6864/api/analytics/overview?period=30d \
  -H "Authorization: Bearer $TOKEN"

# 7. Check onboarding
curl http://localhost:6864/api/onboarding/progress \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔥 Power User Tips

### 1. Use Aliases

Add to `~/.bashrc`:
```bash
alias atb-health="curl http://localhost:6864/health"
alias atb-logs="pm2 logs automatedtradebot-api"
alias atb-restart="pm2 restart automatedtradebot-api"
alias atb-backup="cd /home/automatedtradebot/backend && node scripts/backup.js"
alias atb-verify="cd /home/automatedtradebot/backend && node scripts/verify-system.js"
```

### 2. Monitor Real-Time

```bash
# Watch logs in real-time
watch -n 1 'curl -s http://localhost:6864/health | jq'

# Monitor specific endpoint
watch -n 5 'curl -s http://localhost:6864/api/realtime/latency | jq'
```

### 3. Quick Debugging

```bash
# Check if server is responding
curl -I http://localhost:6864/health

# Test specific endpoint
curl -v http://localhost:6864/api/providers

# View PM2 process details
pm2 show automatedtradebot-api
```

---

## ⚡ Performance Optimization

### Increase PM2 Instances

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'automatedtradebot-api',
    script: './src/server.js',
    instances: 4,  // Change from 'max' to specific number
    exec_mode: 'cluster'
  }]
};
```

```bash
pm2 reload ecosystem.config.js
```

### Enable Redis Caching (Optional)

```bash
# Install Redis
sudo apt install redis-server

# Add to .env
REDIS_URL="redis://localhost:6379"
```

---

## 🐛 Troubleshooting

### Server Won't Start

```bash
# Check PM2 logs
pm2 logs automatedtradebot-api --lines 50

# Check port availability
sudo netstat -tlnp | grep 6864

# Restart PM2
pm2 restart automatedtradebot-api
```

### Database Connection Failed

```bash
# Test PostgreSQL
psql -U user -d automatedtradebot -c "SELECT 1;"

# Check connection string
echo $DATABASE_URL

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### High Memory Usage

```bash
# Check memory
pm2 monit

# Restart if needed
pm2 restart automatedtradebot-api

# Clear logs
pm2 flush
```

---

## 📞 Get Help

### Check Documentation
```bash
# List all documentation
ls -lh *.md

# View specific doc
cat API_DOCUMENTATION.md | less
```

### System Information
```bash
# Node version
node --version

# PM2 version
pm2 --version

# PostgreSQL version
psql --version

# Check running processes
pm2 status
```

### Log Locations
```
Application Logs: /home/automatedtradebot/backend/logs/
PM2 Logs: ~/.pm2/logs/
Nginx Logs: /var/log/nginx/
Backup Files: /home/automatedtradebot/backups/
```

---

## ✅ Quick Checklist

Before going to production:
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Exchange API keys added
- [ ] Stripe keys configured
- [ ] Email service set up
- [ ] SSL certificate installed
- [ ] Backup system tested
- [ ] Monitoring configured
- [ ] Health checks passing
- [ ] Load testing completed

---

**Need More Help?**

- Full API Docs: `./API_DOCUMENTATION.md`
- Deployment Guide: `./PRODUCTION_DEPLOYMENT.md`
- System Status: `./SYSTEM_STATUS.md`

**Happy Trading! 🚀📈**
