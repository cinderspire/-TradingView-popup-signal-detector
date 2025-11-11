# AutomatedTradeBot - Scripts Directory

Comprehensive utility scripts for testing, deployment, database management, and system verification.

---

## 📋 Available Scripts

### 1. `test-api.js` - API Testing Suite

Comprehensive API endpoint testing with multiple modes.

#### Usage

```bash
# Quick health checks only (fastest)
node scripts/test-api.js --quick

# Standard test suite (recommended)
node scripts/test-api.js

# Full comprehensive test (all endpoints)
node scripts/test-api.js --full

# Verbose output (show detailed responses)
node scripts/test-api.js --verbose
```

#### Features
- ✅ Tests 40+ API endpoints
- ✅ Automatic authentication token management
- ✅ Color-coded pass/fail output
- ✅ Response time tracking
- ✅ Success rate calculation
- ✅ Validation checks for data integrity

#### Test Categories
- Health checks
- Authentication (register/login)
- Providers marketplace
- Trading signals
- Real-time data & exchange connectivity
- Analytics & reporting
- Backtests management
- Positions tracking
- Strategies management
- Trading operations
- User onboarding

#### Exit Codes
- `0` - All tests passed
- `1` - Some tests failed (non-critical)
- `2` - Critical failures detected
- `3` - Fatal error

---

### 2. `seed-database.js` - Database Seeding

Populate database with demo data for testing and development.

#### Usage

```bash
# Standard seed (recommended for first time)
node scripts/seed-database.js

# Clear existing data first, then seed
node scripts/seed-database.js --clear

# Minimal dataset (users + basic data only)
node scripts/seed-database.js --minimal

# Full dataset (maximum demo data)
node scripts/seed-database.js --full
```

#### What Gets Seeded

**Users (3):**
- **Trader**: demo@test.com / Demo123!
- **Provider**: provider@test.com / Provider123!
- **Admin**: admin@test.com / Admin123!

**Providers (2):**
- Crypto Master Pro (5 years experience)
- Whale Watcher (3 years experience)

**Strategies (3):**
- 7RSI Momentum Strategy
- 3RSI Scalping Strategy
- MACD Crossover Strategy

**Signals (3):**
- XRP/USDT BUY (ACTIVE)
- SOL/USDT BUY (ACTIVE)
- BTC/USDT SELL (CLOSED)

**Backtests (optional, not in minimal):**
- Historical backtest results for each strategy
- Performance metrics (ROI, win rate, Sharpe ratio)

#### Features
- ✅ Safe data clearing with confirmation
- ✅ Realistic demo data
- ✅ Password hashing (bcrypt)
- ✅ Configurable dataset size
- ✅ Progress reporting with color output
- ✅ Error handling and rollback

#### Demo Credentials

After seeding, you can login with:

```
Email:    demo@test.com
Password: Demo123!
Role:     Trader
```

```
Email:    provider@test.com
Password: Provider123!
Role:     Provider
```

```
Email:    admin@test.com
Password: Admin123!
Role:     Admin
```

---

### 3. `deployment-check.js` - Production Readiness Checker

Verify system is ready for production deployment with comprehensive checks.

#### Usage

```bash
# Run all deployment checks
node scripts/deployment-check.js
```

#### What Gets Checked

**Environment Variables:**
- Required vars: NODE_ENV, PORT, DATABASE_URL, JWT secrets
- Optional vars: Stripe keys, email service, exchange APIs
- Production mode configuration

**Database:**
- Connection successful
- Tables exist and are accessible
- User count and basic queries

**Dependencies:**
- Critical packages installed (express, prisma, etc.)
- node_modules directory exists
- Package.json validity

**Required Files:**
- server.js, schema.prisma, ecosystem.config.js
- .env file exists
- Public HTML files

**PM2 Process Manager:**
- PM2 installed and working
- automatedtradebot-api process running
- Process status and health

**Nginx (Optional):**
- Nginx installed
- Configuration valid
- SSL certificate configured

**Backup System:**
- Backup directory exists
- Backup script present
- Recent backups available

**Logging:**
- logs directory exists
- Log files present and writable

**Security:**
- JWT secrets customized (not defaults)
- File permissions appropriate
- CORS configuration
- Password requirements

**API Health:**
- Server responding
- Health endpoint accessible
- Uptime tracking

#### Output

The script provides:
- ✅ Pass (green) - Check passed
- ⚠️  Warning (yellow) - Optional or non-critical
- ❌ Failed (red) - Critical issue

**Readiness Score:** Calculated as percentage of passed checks

**Exit Codes:**
- `0` - Ready for production (all critical checks passed)
- `1` - Not ready (some critical checks failed)
- `2` - Fatal error occurred

---

### 4. `backup.js` - Automated Backup Management

Create, manage, and restore database and file backups.

#### Usage

```bash
# Create manual backup
node scripts/backup.js create manual

# Create scheduled backup (called by cron)
node scripts/backup.js create daily
node scripts/backup.js create weekly
node scripts/backup.js create monthly

# List all backups
node scripts/backup.js list

# Show backup statistics
node scripts/backup.js stats

# Verify backup integrity
node scripts/backup.js verify <backup-id>

# Restore from backup
node scripts/backup.js restore <backup-id>

# Cleanup old backups (retention policy)
node scripts/backup.js cleanup
```

#### What Gets Backed Up

- **Database**: Full PostgreSQL dump (gzipped)
- **Files**: User uploads and important files
- **Logs**: Application logs
- **Configuration**: .env and config files

#### Backup Types & Retention

- **Daily**: Kept for 7 days
- **Weekly**: Kept for 30 days (Sunday 3 AM)
- **Monthly**: Kept for 365 days (1st of month, 4 AM)
- **Manual**: Kept indefinitely

#### Features
- ✅ Automatic compression (gzip)
- ✅ Integrity verification
- ✅ Remote storage (S3-compatible)
- ✅ Retention policy enforcement
- ✅ Metadata tracking
- ✅ Progress reporting

#### Configuration

Set in `.env`:
```bash
BACKUP_ENABLED=true
BACKUP_DIR=/home/automatedtradebot/backups
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
```

---

### 5. `verify-system.js` - System Verification

Quick system health and endpoint verification.

#### Usage

```bash
# Run system verification
node scripts/verify-system.js
```

#### What Gets Verified

- API server health
- All major endpoints (13 tests)
- Exchange connectivity
- Response times
- Status codes
- Data validation

#### Output

- ✅ Pass - Endpoint working correctly
- ❌ Fail - Issue detected
- Test summary with success rate
- Exchange connectivity status
- Recommendations based on results

---

## 🚀 Quick Start Workflow

### First Time Setup

```bash
# 1. Check deployment readiness
node scripts/deployment-check.js

# 2. Seed demo data
node scripts/seed-database.js --clear

# 3. Verify system
node scripts/verify-system.js

# 4. Test API
node scripts/test-api.js --quick

# 5. Create initial backup
node scripts/backup.js create manual
```

### Daily Development

```bash
# Morning: Check system health
node scripts/verify-system.js

# After changes: Run tests
node scripts/test-api.js

# Before deployment: Full check
node scripts/deployment-check.js
```

### Production Deployment

```bash
# 1. Full deployment check
node scripts/deployment-check.js

# 2. Create pre-deployment backup
node scripts/backup.js create manual

# 3. Run full API tests
node scripts/test-api.js --full

# 4. Verify all systems
node scripts/verify-system.js
```

---

## 📊 Script Comparison

| Script | Purpose | Speed | When to Use |
|--------|---------|-------|-------------|
| `verify-system.js` | Quick health check | ⚡ Fast (5s) | Every day, after changes |
| `test-api.js --quick` | Basic API tests | ⚡⚡ Fast (10s) | After API changes |
| `test-api.js` | Standard tests | ⚡⚡⚡ Medium (30s) | Before commits |
| `test-api.js --full` | Comprehensive tests | ⚡⚡⚡⚡ Slow (60s+) | Before deployment |
| `deployment-check.js` | Production readiness | ⚡⚡ Fast (10s) | Before deployment |
| `seed-database.js` | Database population | ⚡⚡⚡ Medium (30s) | First setup, testing |
| `backup.js` | Backup management | ⚡⚡⚡⚡ Varies | Daily/weekly/monthly |

---

## 🔧 Troubleshooting

### Script Won't Run

```bash
# Make sure you're in the backend directory
cd /home/automatedtradebot/backend

# Check if dependencies are installed
npm install

# Verify Node.js version
node --version  # Should be v22+

# Check script permissions
chmod +x scripts/*.js
```

### Database Seeding Fails

```bash
# Check database connection
psql -U automatedtradebot -d automatedtradebot -c "SELECT 1;"

# Clear existing data first
node scripts/seed-database.js --clear

# Try minimal seed first
node scripts/seed-database.js --minimal
```

### API Tests Failing

```bash
# Check if server is running
pm2 status

# Restart server
pm2 restart automatedtradebot-api

# Check health endpoint
curl http://localhost:6864/health

# Run in verbose mode to see details
node scripts/test-api.js --verbose
```

### Backup Issues

```bash
# Check backup directory exists
ls -la /home/automatedtradebot/backups

# Create directory if needed
mkdir -p /home/automatedtradebot/backups

# Check disk space
df -h

# Test database access
pg_dump --version
```

---

## 📝 Best Practices

### Development
1. Run `verify-system.js` daily
2. Run `test-api.js` before commits
3. Seed fresh data when testing features
4. Create backups before major changes

### Testing
1. Use `--quick` for rapid iterations
2. Use standard mode for feature testing
3. Use `--full` before merging to main
4. Always check deployment readiness before deploying

### Production
1. Run `deployment-check.js` before every deployment
2. Create manual backup before updates
3. Verify system after deployment
4. Monitor backup schedules are working

### Maintenance
1. Check backups weekly
2. Clean up old test data monthly
3. Review logs regularly
4. Update scripts as needed

---

## 🔐 Security Notes

- Never commit `.env` file
- Rotate JWT secrets regularly
- Keep backup encryption keys secure
- Restrict script execution permissions in production
- Review deployment checklist security warnings

---

## 📚 Additional Resources

- **API Documentation**: `../API_DOCUMENTATION.md`
- **Deployment Guide**: `../PRODUCTION_DEPLOYMENT.md`
- **Backup Guide**: `../BACKUP_GUIDE.md`
- **Quick Start**: `../QUICK_START.md`

---

## 🆘 Getting Help

### Common Issues

**"Cannot find module"**: Run `npm install`
**"Permission denied"**: Run `chmod +x scripts/*.js`
**"Database connection failed"**: Check `.env` DATABASE_URL
**"PM2 not found"**: Install with `npm install -g pm2`

### Script Locations

All scripts are in: `/home/automatedtradebot/backend/scripts/`

### Log Files

- Application logs: `../logs/`
- PM2 logs: `~/.pm2/logs/`
- Backup logs: Included in backup metadata

---

**Last Updated:** 2025-10-22
**Scripts Version:** 1.0.0
**Total Scripts:** 5
**Total Features:** 20+

---

🎯 **Tip:** Bookmark this README for quick reference during development!
