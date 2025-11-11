# AutomatedTradeBot - Quick Reference Card

## Essential Commands

### Database
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# View database
npx prisma studio

# Reset database (DEV ONLY!)
npx prisma migrate reset
```

### Application
```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production mode
npm start

# With PM2
pm2 start ecosystem.config.js --env production
pm2 status
pm2 logs
pm2 restart all
```

### Nginx
```bash
# Test configuration
sudo nginx -t

# Reload
sudo systemctl reload nginx

# Restart
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/error.log
```

## File Locations

### Configuration
- Database schema: `/home/automatedtradebot/backend/prisma/schema.prisma`
- Environment: `/home/automatedtradebot/backend/.env`
- PM2 config: `/home/automatedtradebot/backend/ecosystem.config.js`
- Nginx config: `/home/automatedtradebot/nginx.conf`

### Core Files
- Trading engine: `/home/automatedtradebot/backend/src/engines/unifiedTradingEngine.js`
- Exchange manager: `/home/automatedtradebot/backend/src/services/exchangeManager.js`
- Signal distributor: `/home/automatedtradebot/backend/src/services/signalDistributor.js`
- WebSocket: `/home/automatedtradebot/backend/src/websocket/index.js`

### Documentation
- Complete guide: `/home/automatedtradebot/PLATFORM_COMPLETE_GUIDE.md`
- Deployment: `/home/automatedtradebot/DEPLOYMENT_CHECKLIST.md`
- This file: `/home/automatedtradebot/README.md`

## Quick Tests

### Test Database Connection
```bash
psql -U automatedtradebot -d automatedtradebot -h localhost
```

### Test Exchange Connection
```bash
node -e "
const em = require('./src/services/exchangeManager');
em.getSystemExchange('bybit').then(e => 
  e.fetchTicker('BTC/USDT')
).then(console.log);
"
```

### Test API Health
```bash
curl http://localhost:6864/health
# or
curl https://yourdomain.com/health
```

### Test Backtest Engine
```bash
node -e "
const engine = require('./src/engines/unifiedTradingEngine');
engine.initialize().then(() => {
  console.log('Trading engine initialized');
  console.log('Strategies:', engine.getStrategies().length);
  process.exit(0);
});
"
```

## Database Models

Quick reference for main models:

```javascript
// User
{
  id, email, username, password, role,
  apiKeys[], strategies[], positions[], subscriptions[]
}

// Strategy
{
  id, name, description, type, parameters,
  supportedPairs[], winRate, avgProfit, monthlyPrice,
  signals[], subscriptions[], backtests[]
}

// Signal
{
  id, strategyId, type, pair, side,
  entryPrice, stopLoss, takeProfit,
  status, pnl, positions[]
}

// Position
{
  id, userId, signalId, pair, side,
  quantity, entryPrice, exitPrice,
  realizedPnl, unrealizedPnl, status
}

// Subscription
{
  id, userId, strategyId, status,
  monthlyPrice, startDate, endDate,
  totalPnl, totalTrades
}
```

## API Quick Reference

### Authentication
```bash
# Register
curl -X POST http://localhost:6864/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123","username":"user"}'

# Login
curl -X POST http://localhost:6864/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'
```

### Backtest
```bash
curl -X POST http://localhost:6864/api/backtest/run \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "strategyName": "RSI_Strategy",
    "symbol": "XRPUSDT",
    "timeframe": "15m",
    "startDate": "2024-01-01",
    "endDate": "2024-10-01"
  }'
```

## Environment Variables Checklist

Essential variables to configure:

```env
# MUST CHANGE
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
ENCRYPTION_KEY=...

# Exchange APIs
BYBIT_API_KEY=...
BYBIT_API_SECRET=...

# Payments
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...

# Email
SMTP_USER=...
SMTP_PASS=...

# URLs
FRONTEND_URL=https://...
```

## Common Tasks

### Add New Strategy
```javascript
const strategy = await prisma.strategy.create({
  data: {
    providerId: userId,
    name: "My Strategy",
    description: "Description",
    type: "RSI",
    parameters: { rsiPeriod: 14 },
    supportedPairs: ["BTC/USDT"],
    supportedTimeframes: ["15m"],
    monthlyPrice: 99.99,
    isActive: true,
    isPublic: true
  }
});
```

### Create Signal
```javascript
const signal = await signalDistributor.createSignal(strategyId, {
  type: "ENTRY",
  pair: "XRPUSDT",
  side: "BUY",
  entryPrice: 0.52,
  stopLoss: 0.51,
  takeProfit: 0.54,
  leverage: 10
});
```

### Run Backtest
```javascript
const result = await tradingEngine.runBacktest({
  strategyName: "RSI_Strategy",
  symbol: "XRPUSDT",
  timeframe: "15m",
  startDate: "2024-01-01",
  endDate: "2024-10-01",
  initialCapital: 10000
});
```

### Start Paper Trading
```javascript
const session = await tradingEngine.startPaperTrading({
  userId: userId,
  strategyName: "RSI_Strategy",
  symbol: "XRPUSDT",
  timeframe: "15m",
  initialCapital: 10000
});
```

## Monitoring

### Check Application Status
```bash
pm2 status
pm2 logs --lines 50
pm2 monit
```

### Check System Resources
```bash
htop
df -h
free -h
```

### Check Database
```bash
# Database size
du -sh /var/lib/postgresql/

# Active connections
psql -U automatedtradebot -d automatedtradebot -c "SELECT count(*) FROM pg_stat_activity;"

# Table sizes
psql -U automatedtradebot -d automatedtradebot -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

### View Logs
```bash
# Application logs
pm2 logs automatedtradebot-api --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/automatedtradebot-access.log
sudo tail -f /var/log/nginx/automatedtradebot-error.log

# System logs
sudo journalctl -u nginx -f
```

## Troubleshooting

### Application Won't Start
```bash
# Check logs
pm2 logs --lines 50

# Check environment
node --version  # Should be 18+
npm --version

# Test database connection
psql -U automatedtradebot -d automatedtradebot
```

### Database Issues
```bash
# Restart PostgreSQL
sudo systemctl restart postgresql

# Check status
sudo systemctl status postgresql

# View logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Nginx Issues
```bash
# Test config
sudo nginx -t

# Restart
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx
```

## Performance Tips

### Database
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Vacuum database
VACUUM ANALYZE;
```

### Application
```bash
# Increase Node.js memory
node --max-old-space-size=4096 src/server.js

# Use cluster mode
pm2 start ecosystem.config.js
```

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated new JWT secrets
- [ ] Generated new encryption key
- [ ] Configured SSL certificate
- [ ] Enabled firewall (ufw)
- [ ] Configured fail2ban
- [ ] Set up automated backups
- [ ] Enabled 2FA for admin accounts

## Backup & Restore

### Backup Database
```bash
pg_dump -U automatedtradebot automatedtradebot > backup.sql
gzip backup.sql
```

### Restore Database
```bash
gunzip backup.sql.gz
psql -U automatedtradebot -d automatedtradebot < backup.sql
```

## Priority Pairs for Testing

As per CLAUDE.md requirements:
- XRP/USDT (MUST TEST)
- SOL/USDT (MUST TEST)
- BTC/USDT
- ETH/USDT
- DOGE/USDT
- ADA/USDT
- AVAX/USDT
- MATIC/USDT

## Supported Timeframes

- 5m (5 minutes)
- 15m (15 minutes)
- 1h (1 hour)
- 4h (4 hours)
- 1d (1 day)

## Important Paths

- Historical data: `/home/karsilas/Tamoto/historical_data/`
- Application logs: `/home/automatedtradebot/logs/`
- Nginx logs: `/var/log/nginx/`
- Database backups: `/home/automatedtradebot/backups/`

---

**Quick Help:** For detailed information, see PLATFORM_COMPLETE_GUIDE.md
