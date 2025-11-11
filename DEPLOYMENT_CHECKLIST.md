# AutomatedTradeBot - Deployment Checklist

## Pre-Deployment Requirements

### System Requirements
- [ ] Ubuntu 20.04+ or similar Linux distribution
- [ ] Node.js 18+ installed
- [ ] PostgreSQL 14+ installed and running
- [ ] Redis 6+ installed and running
- [ ] Nginx installed
- [ ] SSL certificate (Let's Encrypt recommended)
- [ ] Minimum 4GB RAM
- [ ] Minimum 20GB storage

### Software Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
```

## Step-by-Step Deployment

### 1. Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE automatedtradebot;
CREATE USER automatedtradebot WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE automatedtradebot TO automatedtradebot;
ALTER DATABASE automatedtradebot OWNER TO automatedtradebot;
\q

# Test connection
psql -U automatedtradebot -d automatedtradebot -h localhost
```

### 2. Configure Environment

```bash
cd /home/automatedtradebot/backend

# Copy and edit .env file
cp .env.example .env
nano .env
```

**CRITICAL .env Variables to Update:**

```env
# Database - UPDATE THIS!
DATABASE_URL=postgresql://automatedtradebot:your_password@localhost:5432/automatedtradebot

# JWT Secrets - GENERATE NEW RANDOM STRINGS!
JWT_SECRET=generate_a_32_character_random_string_here
JWT_REFRESH_SECRET=generate_another_32_char_random_string_here

# Encryption Key - MUST BE 32 CHARACTERS!
ENCRYPTION_KEY=generate_32_character_encryption_key

# Exchange API Keys - ADD YOUR REAL KEYS
BYBIT_API_KEY=your_actual_bybit_api_key
BYBIT_API_SECRET=your_actual_bybit_secret
BYBIT_TESTNET=false  # Set to false for production

# Stripe - ADD YOUR KEYS
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key

# Email - CONFIGURE YOUR SMTP
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL
FRONTEND_URL=https://automatedtradebot.com
```

### 3. Install Dependencies

```bash
cd /home/automatedtradebot/backend
npm install --production

# Install development dependencies if needed
npm install --only=dev
```

### 4. Run Database Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Verify database
npx prisma studio
# This opens a browser-based database viewer on http://localhost:5555
```

### 5. Create Required Directories

```bash
# Create log directory
sudo mkdir -p /home/automatedtradebot/logs
sudo chown -R automatedtradebot:automatedtradebot /home/automatedtradebot/logs

# Create data directory
sudo mkdir -p /home/karsilas/Tamoto/historical_data/bybit
sudo chown -R automatedtradebot:automatedtradebot /home/karsilas/Tamoto

# Create nginx cache directory
sudo mkdir -p /var/cache/nginx/automatedtradebot
sudo chown -R www-data:www-data /var/cache/nginx/automatedtradebot
```

### 6. Configure Nginx

```bash
# Copy nginx config
sudo cp /home/automatedtradebot/nginx.conf /etc/nginx/sites-available/automatedtradebot

# Create symbolic link
sudo ln -s /etc/nginx/sites-available/automatedtradebot /etc/nginx/sites-enabled/

# Remove default config if exists
sudo rm /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

### 7. Setup SSL Certificate

```bash
# Get Let's Encrypt certificate
sudo certbot --nginx -d automatedtradebot.com -d www.automatedtradebot.com

# Auto-renewal (certbot usually sets this up automatically)
sudo certbot renew --dry-run
```

### 8. Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### 9. Start Application with PM2

```bash
cd /home/automatedtradebot/backend

# Start all processes
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions shown by the command above

# Check status
pm2 status
pm2 logs

# Monitor in real-time
pm2 monit
```

### 10. Verify Deployment

```bash
# Check API health
curl https://automatedtradebot.com/health

# Check WebSocket
# (Use a WebSocket client or browser console)

# Check logs
pm2 logs automatedtradebot-api --lines 100

# Check nginx logs
sudo tail -f /var/log/nginx/automatedtradebot-access.log
sudo tail -f /var/log/nginx/automatedtradebot-error.log
```

## Post-Deployment Configuration

### 1. Create Admin User

```bash
cd /home/automatedtradebot/backend
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  const password = await bcrypt.hash('your_admin_password', 10);
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@automatedtradebot.com',
      username: 'admin',
      password: password,
      role: 'ADMIN',
      emailVerified: true,
      isActive: true
    }
  });
  
  console.log('Admin user created:', admin.email);
  process.exit(0);
}

createAdmin();
"
```

### 2. Test Exchange Connections

```bash
node -e "
const exchangeManager = require('./src/services/exchangeManager');

async function test() {
  const exchange = await exchangeManager.getSystemExchange('bybit');
  const ticker = await exchange.fetchTicker('BTC/USDT');
  console.log('Exchange connection OK:', ticker);
  process.exit(0);
}

test();
"
```

### 3. Download Initial Historical Data

```bash
node -e "
const DataService = require('./src/services/dataService');

async function download() {
  await DataService.initialize();
  
  const pairs = ['XRPUSDT', 'SOLUSDT', 'BTCUSDT', 'ETHUSDT'];
  const timeframes = ['5m', '15m', '1h', '4h'];
  
  for (const pair of pairs) {
    for (const timeframe of timeframes) {
      console.log('Downloading', pair, timeframe);
      await DataService.downloadHistoricalData(
        pair, 
        timeframe, 
        '2024-01-01', 
        new Date().toISOString().split('T')[0]
      );
    }
  }
  
  console.log('All data downloaded');
  process.exit(0);
}

download();
"
```

### 4. Setup Monitoring

```bash
# Install PM2 log rotate
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true

# Install PM2 monitoring (optional)
pm2 install pm2-server-monit
```

### 5. Setup Automated Backups

```bash
# Create backup script
cat > /home/automatedtradebot/backup.sh << 'EOFBACKUP'
#!/bin/bash
BACKUP_DIR="/home/automatedtradebot/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U automatedtradebot automatedtradebot > $BACKUP_DIR/db_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql.gz"
EOFBACKUP

chmod +x /home/automatedtradebot/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add this line:
# 0 2 * * * /home/automatedtradebot/backup.sh
```

## Production Checklist

- [ ] Database is created and migrations applied
- [ ] All .env variables are configured with production values
- [ ] SSL certificate is installed and working
- [ ] Nginx is configured and running
- [ ] PM2 is running all processes
- [ ] PM2 startup script is configured
- [ ] Firewall rules are configured
- [ ] Admin user is created
- [ ] Exchange connections are tested
- [ ] Historical data is downloaded
- [ ] Backups are configured
- [ ] Monitoring is setup
- [ ] Logs are rotating properly
- [ ] WebSocket connections are working
- [ ] API endpoints are responding
- [ ] Email notifications are working
- [ ] Stripe integration is tested (if using payments)

## Monitoring Commands

```bash
# Check application status
pm2 status

# View logs
pm2 logs

# View specific app logs
pm2 logs automatedtradebot-api

# Monitor resources
pm2 monit

# Check Nginx status
sudo systemctl status nginx

# Check PostgreSQL status
sudo systemctl status postgresql

# Check Redis status
sudo systemctl status redis

# View application metrics
curl https://automatedtradebot.com/api/health

# Check database connection
psql -U automatedtradebot -d automatedtradebot -c "SELECT COUNT(*) FROM \"User\";"
```

## Troubleshooting

### Application won't start
```bash
# Check logs
pm2 logs automatedtradebot-api --lines 50

# Check environment
cat .env | grep -v "^#" | grep -v "^$"

# Test database connection
psql -U automatedtradebot -d automatedtradebot -h localhost

# Check Node version
node --version  # Should be 18+
```

### Database connection errors
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check credentials in .env
grep DATABASE_URL .env

# Test connection manually
psql -U automatedtradebot -d automatedtradebot -h localhost
```

### Nginx errors
```bash
# Check configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log

# Restart nginx
sudo systemctl restart nginx
```

### WebSocket not connecting
```bash
# Check nginx WebSocket proxy configuration
sudo nginx -t

# Check firewall
sudo ufw status

# Check SSL certificate
sudo certbot certificates
```

## Performance Tuning

### PostgreSQL Optimization

Edit `/etc/postgresql/14/main/postgresql.conf`:

```conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 5MB
min_wal_size = 1GB
max_wal_size = 4GB
```

### Node.js Memory

Update PM2 config to increase memory:

```javascript
node_args: '--max-old-space-size=4096'
```

### Redis Configuration

Edit `/etc/redis/redis.conf`:

```conf
maxmemory 512mb
maxmemory-policy allkeys-lru
```

## Security Hardening

```bash
# Disable password authentication for SSH (use keys only)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart ssh

# Install fail2ban
sudo apt install fail2ban

# Configure fail2ban for nginx
sudo nano /etc/fail2ban/jail.local
```

## Maintenance Schedule

- **Daily**: Automated database backups
- **Weekly**: Review error logs
- **Monthly**: Update dependencies (npm update)
- **Quarterly**: Review and optimize database indexes
- **As needed**: Security updates (apt update && apt upgrade)

---

## Support & Maintenance

For ongoing support:
1. Monitor PM2 dashboard: `pm2 monit`
2. Review logs regularly: `pm2 logs`
3. Check system resources: `htop`
4. Monitor database size: `du -sh /var/lib/postgresql/`

**Your platform is now deployed and ready for production use!**
