# Production Deployment Guide

Complete step-by-step guide to deploy AutomatedTradeBot to production.

---

## Prerequisites

- ✅ Node.js 22+ installed
- ✅ PostgreSQL 14+ running
- ✅ PM2 installed globally
- ✅ Nginx installed
- ✅ Domain configured (automatedtradebot.com)
- ✅ SSL certificate ready
- ⏳ Stripe account
- ⏳ Exchange API keys
- ⏳ Email service account

---

## Step 1: Environment Configuration

### 1.1 Create Production Environment File

```bash
cd /home/automatedtradebot/backend
cp .env.example .env.production
nano .env.production
```

### 1.2 Configure Required Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=6864
FRONTEND_URL=https://automatedtradebot.com

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/automatedtradebot"

# JWT Secrets (GENERATE NEW SECRETS FOR PRODUCTION!)
JWT_SECRET="GENERATE_STRONG_SECRET_HERE_64_CHARS_MIN"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_SECRET="GENERATE_DIFFERENT_STRONG_SECRET_HERE"
REFRESH_TOKEN_EXPIRES_IN="7d"

# Stripe Payment (REQUIRED)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email Service (Choose one)
EMAIL_PROVIDER="sendgrid"  # or "ses" or "smtp"
EMAIL_FROM="noreply@automatedtradebot.com"

# SendGrid
SENDGRID_API_KEY="SG...."

# OR AWS SES
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."

# OR SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Exchange API Keys (Optional, for automated trading)
BYBIT_API_KEY="..."
BYBIT_API_SECRET="..."
MEXC_API_KEY="..."
MEXC_API_SECRET="..."
BITGET_API_KEY="..."
BITGET_API_SECRET="..."
BINANCE_API_KEY="..."
BINANCE_API_SECRET="..."

# Backup Configuration
BACKUP_DIR="/home/automatedtradebot/backups"
BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=30
BACKUP_RETENTION_MONTHLY=365
BACKUP_SCHEDULE_DAILY="0 2 * * *"
BACKUP_SCHEDULE_WEEKLY="0 3 * * 0"
BACKUP_SCHEDULE_MONTHLY="0 4 1 * *"

# S3 Backup (Optional but recommended)
BACKUP_S3_ENABLED=false
BACKUP_S3_ENDPOINT="https://s3.amazonaws.com"
BACKUP_S3_BUCKET="automatedtradebot-backups"
BACKUP_S3_ACCESS_KEY="..."
BACKUP_S3_SECRET_KEY="..."

# Monitoring (Optional)
SENTRY_DSN="https://...@sentry.io/..."
```

### 1.3 Generate Strong Secrets

```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Step 2: Database Setup

### 2.1 Create Production Database

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE automatedtradebot;
CREATE USER automatedtradebot_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE automatedtradebot TO automatedtradebot_user;
\q
```

### 2.2 Run Migrations

```bash
cd /home/automatedtradebot/backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Run onboarding migrations
psql -U automatedtradebot_user -d automatedtradebot -f prisma/migrations/add_onboarding_tables.sql
```

### 2.3 Seed Initial Data (Optional)

```bash
# Create admin user
npx prisma db seed

# Or manually via psql
psql -U automatedtradebot_user -d automatedtradebot
```

---

## Step 3: Install Dependencies

```bash
cd /home/automatedtradebot/backend

# Install production dependencies only
npm ci --production

# If you need all dependencies for build
npm install

# Install global dependencies
npm install -g pm2
```

---

## Step 4: Build & Optimize

```bash
cd /home/automatedtradebot/backend

# If you have a build script
npm run build

# Optimize node_modules (optional)
npm prune --production
```

---

## Step 5: PM2 Configuration

### 5.1 Create PM2 Ecosystem File

```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'automatedtradebot-api',
    script: './src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 6864
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'backups'],
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 5.2 Start PM2

```bash
# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Follow the instructions from the command output

# Check status
pm2 status
pm2 logs automatedtradebot-api
```

---

## Step 6: Nginx Configuration

### 6.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/automatedtradebot
```

```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name automatedtradebot.com www.automatedtradebot.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name automatedtradebot.com www.automatedtradebot.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/automatedtradebot.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/automatedtradebot.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/automatedtradebot-access.log;
    error_log /var/log/nginx/automatedtradebot-error.log;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/json application/javascript;

    # Static Files
    location / {
        proxy_pass http://localhost:6864;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket
    location /realtime {
        proxy_pass http://localhost:6864;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # API Routes
    location /api {
        proxy_pass http://localhost:6864;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Rate limiting (optional)
        limit_req zone=api burst=20 nodelay;
    }

    # Health Check
    location /health {
        proxy_pass http://localhost:6864/health;
        access_log off;
    }

    # Static files cache
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf)$ {
        proxy_pass http://localhost:6864;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security - Deny access to sensitive files
    location ~ /\. {
        deny all;
    }

    location ~ \.(env|log|sql)$ {
        deny all;
    }
}

# Rate Limiting Zone
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
```

### 6.2 Enable Site

```bash
# Test Nginx configuration
sudo nginx -t

# Create symbolic link
sudo ln -s /etc/nginx/sites-available/automatedtradebot /etc/nginx/sites-enabled/

# Reload Nginx
sudo systemctl reload nginx
```

---

## Step 7: SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d automatedtradebot.com -d www.automatedtradebot.com

# Test auto-renewal
sudo certbot renew --dry-run

# Renew command (runs automatically)
# sudo certbot renew
```

---

## Step 8: Firewall Configuration

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to Node.js port
sudo ufw deny 6864/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Step 9: Monitoring Setup

### 9.1 Setup Log Rotation

```bash
sudo nano /etc/logrotate.d/automatedtradebot
```

```
/home/automatedtradebot/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    create 0644 root root
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 9.2 Setup Health Check Monitoring

```bash
# Create monitoring script
nano /home/automatedtradebot/scripts/health-check.sh
```

```bash
#!/bin/bash

# Health check script
URL="http://localhost:6864/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $URL)

if [ $RESPONSE != "200" ]; then
    echo "Health check failed: HTTP $RESPONSE"
    # Send alert email
    echo "AutomatedTradeBot health check failed" | mail -s "ALERT: API Down" admin@automatedtradebot.com
    # Restart PM2
    pm2 restart automatedtradebot-api
fi
```

```bash
# Make executable
chmod +x /home/automatedtradebot/scripts/health-check.sh

# Add to cron (every 5 minutes)
crontab -e

# Add this line:
*/5 * * * * /home/automatedtradebot/scripts/health-check.sh >> /home/automatedtradebot/logs/health-check.log 2>&1
```

---

## Step 10: Initial Backup

```bash
cd /home/automatedtradebot/backend

# Create initial backup
node scripts/backup.js create manual

# Verify backup
node scripts/backup.js list

# Test restore (optional, use with caution)
# node scripts/backup.js restore <backup-id>
```

---

## Step 11: Testing

### 11.1 API Health Check

```bash
# Test health endpoint
curl https://automatedtradebot.com/health

# Should return:
# {"status":"ok","timestamp":"...","uptime":...}
```

### 11.2 Test WebSocket

```javascript
// In browser console
const ws = new WebSocket('wss://automatedtradebot.com/realtime');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
```

### 11.3 Test API Endpoints

```bash
# Test registration (replace with actual data)
curl -X POST https://automatedtradebot.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","username":"testuser"}'

# Test login
curl -X POST https://automatedtradebot.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Test real-time prices
curl https://automatedtradebot.com/api/realtime/prices?symbols=BTC/USDT,ETH/USDT
```

### 11.4 Load Testing (Optional)

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Run load test (1000 requests, 10 concurrent)
ab -n 1000 -c 10 https://automatedtradebot.com/health

# Or use Artillery
npm install -g artillery
artillery quick --count 100 --num 10 https://automatedtradebot.com/api/realtime/prices
```

---

## Step 12: Create Admin Account

```bash
# Via Prisma Studio
npx prisma studio

# Or via psql
psql -U automatedtradebot_user -d automatedtradebot

# Create admin user (update password hash with bcrypt)
INSERT INTO "User" (id, email, username, password, role, "emailVerified", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@automatedtradebot.com',
  'admin',
  '$2b$10$...', -- Generate with: bcrypt.hash('your_password', 10)
  'ADMIN',
  true,
  NOW(),
  NOW()
);
```

---

## Step 13: Post-Deployment

### 13.1 Verify Services

```bash
# Check PM2 status
pm2 status
pm2 logs --lines 100

# Check Nginx status
sudo systemctl status nginx

# Check PostgreSQL
sudo systemctl status postgresql

# Check disk space
df -h

# Check memory
free -h
```

### 13.2 Setup Monitoring

- Configure Sentry for error tracking
- Set up UptimeRobot or Pingdom
- Enable CloudFlare (optional)
- Set up backup monitoring
- Configure alert emails

### 13.3 Documentation

- Update API documentation URL
- Share admin credentials securely
- Document deployment process
- Create runbook for common issues

---

## Step 14: Maintenance Tasks

### Daily
- Check PM2 logs: `pm2 logs`
- Monitor error rate
- Check disk space
- Verify backup completion

### Weekly
- Review system logs
- Check performance metrics
- Test backup restore
- Update dependencies (security patches)

### Monthly
- Full system audit
- Performance optimization
- Review and archive old logs
- Database maintenance (VACUUM, ANALYZE)
- Review and update documentation

---

## Troubleshooting

### API Not Responding

```bash
# Check PM2 status
pm2 status
pm2 logs automatedtradebot-api --lines 50

# Restart PM2
pm2 restart automatedtradebot-api

# Check port
sudo netstat -tlnp | grep 6864
```

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -U automatedtradebot_user -d automatedtradebot -c "SELECT 1;"

# Check connection count
psql -U automatedtradebot_user -d automatedtradebot -c "SELECT count(*) FROM pg_stat_activity;"
```

### High Memory Usage

```bash
# Check memory
free -h
pm2 monit

# Restart if needed
pm2 restart automatedtradebot-api

# Or limit memory in ecosystem.config.js
max_memory_restart: '500M'
```

### Backup Failures

```bash
# Check backup logs
tail -f logs/combined.log | grep backup

# Test backup manually
node scripts/backup.js create manual

# Check disk space
df -h /home/automatedtradebot/backups
```

---

## Emergency Procedures

### Complete System Failure

```bash
# 1. Stop PM2
pm2 stop all

# 2. Restore from backup
node scripts/backup.js restore <latest-backup-id>

# 3. Restart services
pm2 restart all

# 4. Verify health
curl http://localhost:6864/health
```

### Data Corruption

```bash
# 1. Stop application
pm2 stop automatedtradebot-api

# 2. Backup current state
pg_dump -U automatedtradebot_user automatedtradebot > /tmp/corrupted-db.sql

# 3. Restore from last good backup
node scripts/backup.js restore <backup-id>

# 4. Restart
pm2 restart automatedtradebot-api
```

---

## Support & Resources

- **Logs**: `/home/automatedtradebot/backend/logs/`
- **Backups**: `/home/automatedtradebot/backups/`
- **PM2 Logs**: `pm2 logs`
- **Nginx Logs**: `/var/log/nginx/`
- **Documentation**: `/home/automatedtradebot/backend/*.md`

---

## Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database created and migrations run
- [ ] Dependencies installed
- [ ] SSL certificate obtained
- [ ] Nginx configured
- [ ] Firewall rules set
- [ ] PM2 ecosystem configured
- [ ] Backup system tested

### Deployment
- [ ] Application started with PM2
- [ ] PM2 saved and startup configured
- [ ] Nginx enabled and restarted
- [ ] SSL working (HTTPS)
- [ ] Health check passing
- [ ] WebSocket connection working
- [ ] API endpoints responding
- [ ] Admin account created

### Post-Deployment
- [ ] Monitoring configured
- [ ] Backup schedule running
- [ ] Log rotation configured
- [ ] Health check cron job set
- [ ] Documentation updated
- [ ] Team notified
- [ ] DNS updated
- [ ] Load testing completed

---

**Deployment Date**: ___________
**Deployed By**: ___________
**Version**: 1.0.0
**Status**: ⏳ Ready for Deployment
