# 🚀 Quick Start Guide

Get AutomatedTradeBot up and running in 5 minutes!

## Prerequisites

Before you begin, ensure you have:
- Docker & Docker Compose installed
- At least 4GB RAM available
- Ports 3000, 3001, 5432, 6379 available

## Step 1: Environment Setup

```bash
cd /home/automatedtradebot

# Copy environment file
cp .env.example .env

# Edit with your configuration (optional for development)
nano .env
```

**Minimum required changes for production:**
- `JWT_SECRET` - Change to a random 32+ character string
- `JWT_REFRESH_SECRET` - Change to a different random 32+ character string
- `POSTGRES_PASSWORD` - Change default password
- `REDIS_PASSWORD` - Change default password

## Step 2: Start Services

```bash
cd docker
docker-compose up -d
```

This will start:
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- Backend API (port 3001)
- Frontend UI (port 3000)
- Nginx reverse proxy (port 80)

## Step 3: Initialize Database

```bash
# Wait 30 seconds for services to start, then run migrations
docker exec -it automatedtradebot-backend npx prisma migrate deploy

# (Optional) Seed with sample data
docker exec -it automatedtradebot-backend npm run db:seed
```

## Step 4: Access Application

Open your browser and navigate to:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/health

## Step 5: Create Admin Account

You can register through the UI or use the backend API:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@automatedtradebot.com",
    "password": "YourSecurePassword123!",
    "role": "ADMIN"
  }'
```

## 🎉 You're Done!

Your trading signal marketplace is now running. Here's what you can do next:

### For Signal Providers:
1. Register an account
2. Navigate to "Become a Provider"
3. Fill out your profile and strategy information
4. Start publishing signals

### For Subscribers:
1. Register an account
2. Browse available signal providers
3. Subscribe to providers you like
4. Receive real-time signal notifications

## Development Mode

If you want to run in development mode with hot-reload:

### Backend
```bash
cd /home/automatedtradebot/backend
npm install
cp .env.example .env
# Edit .env with database connection
npx prisma migrate dev
npm run dev
```

### Frontend
```bash
cd /home/automatedtradebot/frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with API URLs
npm run dev
```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs -f

# Restart services
docker-compose down
docker-compose up -d
```

### Database connection errors
```bash
# Check PostgreSQL is running
docker exec -it automatedtradebot-postgres pg_isready

# Check connection string in backend logs
docker logs automatedtradebot-backend
```

### Port already in use
```bash
# Find what's using the port
lsof -i :3000
lsof -i :3001

# Kill the process or change ports in docker-compose.yml
```

### Frontend can't connect to backend
- Ensure `NEXT_PUBLIC_API_URL` in frontend/.env.local points to the correct backend URL
- Check CORS settings in backend/src/server.js

## Next Steps

1. **Configure Stripe** for payment processing
   - Add Stripe API keys to .env
   - Set up webhook endpoint

2. **Setup Email** for notifications
   - Configure SMTP settings in .env
   - Test email sending

3. **Enable SSL** for production
   - Uncomment SSL sections in docker/nginx.conf
   - Add SSL certificates to docker/ssl/

4. **Setup News Calendar API** for risk management
   - Get API key from economic calendar provider
   - Add to NEWS_CALENDAR_API_KEY in .env

5. **Configure Broker APIs** for copy trading
   - Add MT4/MT5 API credentials
   - Add exchange API keys (Binance, etc.)

## Features Overview

### ✅ Real-time Signal Distribution
- WebSocket-based instant notifications
- Subscribe to multiple providers
- Live signal feed

### ✅ Advanced Risk Management
- **Adaptive Risk Control** - Dynamic position sizing
- **Non-Adaptive Risk Control** - Fixed parameters
- **News Sentiment-Based SL** - Economic calendar integration

### ✅ Rich Analytics
- Equity curve charts
- Performance metrics (win rate, profit factor, Sharpe ratio)
- Open P&L tracking
- Maximum drawdown visualization

### ✅ Provider Verification
- KYC/AML checks
- Performance history validation
- Community ratings and reviews

### ✅ Copy Trading
- Automated trade execution
- Customizable position sizing
- Broker API integration

## Support

- **Documentation:** /home/automatedtradebot/CLAUDE.md
- **API Docs:** /home/automatedtradebot/docs/API.md
- **Issues:** Create issue in project tracker

---

**Happy Trading! 📈💰**
