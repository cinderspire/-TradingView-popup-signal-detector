#!/bin/bash

# ============================================================================
# AutomatedTradeBot Installation Script for Ubuntu 24.04
# ============================================================================
# This script installs all dependencies for the signal capture system:
# - Node.js 20+
# - PostgreSQL 16
# - Redis
# - Chromium (for Puppeteer/TradingView capture)
# - PM2 (for process management)
# - Nginx (for reverse proxy)
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "This script should NOT be run as root"
   log_info "Please run as regular user with sudo privileges"
   exit 1
fi

# Update system
log_info "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y
log_success "System updated"

# Install essential build tools
log_info "Installing build essentials..."
sudo apt-get install -y \
    build-essential \
    curl \
    wget \
    git \
    unzip \
    ca-certificates \
    gnupg \
    lsb-release
log_success "Build tools installed"

# ============================================================================
# Install Node.js 20.x
# ============================================================================
log_info "Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
log_success "Node.js installed: $(node -v)"
log_success "NPM installed: $(npm -v)"

# ============================================================================
# Install PostgreSQL 16
# ============================================================================
log_info "Installing PostgreSQL 16..."
sudo apt-get install -y postgresql-16 postgresql-contrib-16
sudo systemctl enable postgresql
sudo systemctl start postgresql
log_success "PostgreSQL installed"

# Create database and user
log_info "Creating database and user..."
sudo -u postgres psql << SQL
CREATE DATABASE automatedtradebot;
CREATE USER tradebot WITH ENCRYPTED PASSWORD 'changeme123';
GRANT ALL PRIVILEGES ON DATABASE automatedtradebot TO tradebot;
ALTER DATABASE automatedtradebot OWNER TO tradebot;
SQL
log_success "Database created"

# ============================================================================
# Install Redis
# ============================================================================
log_info "Installing Redis..."
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
log_success "Redis installed and running"

# ============================================================================
# Install Chromium for Puppeteer (TradingView Capture)
# ============================================================================
log_info "Installing Chromium browser for TradingView signal capture..."
sudo apt-get install -y \
    chromium-browser \
    chromium-codecs-ffmpeg \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils
log_success "Chromium installed: $(chromium-browser --version)"

# ============================================================================
# Install PM2 globally
# ============================================================================
log_info "Installing PM2 for process management..."
sudo npm install -g pm2
pm2 startup systemd -u $USER --hp $HOME
log_success "PM2 installed: $(pm2 -v)"

# ============================================================================
# Install Nginx
# ============================================================================
log_info "Installing Nginx..."
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
log_success "Nginx installed and running"

# ============================================================================
# Setup project directory
# ============================================================================
log_info "Setting up project directory..."
cd /home/automatedtradebot/backend

# Install Node.js dependencies
log_info "Installing Node.js dependencies..."
npm install
log_success "Dependencies installed"

# ============================================================================
# Create .env file
# ============================================================================
if [ ! -f .env ]; then
    log_info "Creating .env file..."
    cp .env.example .env
    log_warning "Please edit .env file with your configuration:"
    log_warning "  - Database credentials"
    log_warning "  - TradingView credentials"
    log_warning "  - Telegram bot token"
    log_warning "  - Exchange API keys"
fi

# ============================================================================
# Setup database with Prisma
# ============================================================================
log_info "Generating Prisma client..."
npx prisma generate
log_success "Prisma client generated"

log_info "Running database migrations..."
npx prisma migrate deploy
log_success "Database migrated"

# ============================================================================
# Create log directory
# ============================================================================
log_info "Creating log directory..."
sudo mkdir -p /home/automatedtradebot/logs
sudo chown -R $USER:$USER /home/automatedtradebot/logs
log_success "Log directory created"

# ============================================================================
# Configure Nginx reverse proxy
# ============================================================================
log_info "Configuring Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/automatedtradebot > /dev/null << 'NGINX'
upstream automatedtradebot_backend {
    server 127.0.0.1:6864;
    keepalive 64;
}

server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # WebSocket support
    location /ws {
        proxy_pass http://automatedtradebot_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # API and static files
    location / {
        proxy_pass http://automatedtradebot_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Max upload size
    client_max_body_size 10M;
}
NGINX

sudo ln -sf /etc/nginx/sites-available/automatedtradebot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
log_success "Nginx configured"

# ============================================================================
# Setup firewall
# ============================================================================
log_info "Configuring firewall..."
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
log_success "Firewall configured"

# ============================================================================
# Print summary
# ============================================================================
echo ""
echo "============================================================================"
log_success "AutomatedTradeBot installation completed!"
echo "============================================================================"
echo ""
log_info "Next steps:"
echo "  1. Edit /home/automatedtradebot/backend/.env with your configuration"
echo "  2. Start the application: pm2 start ecosystem.config.js"
echo "  3. Save PM2 process list: pm2 save"
echo ""
log_info "Useful commands:"
echo "  - View logs:        pm2 logs automatedtradebot-api"
echo "  - Restart:          pm2 restart automatedtradebot-api"
echo "  - Stop:             pm2 stop automatedtradebot-api"
echo "  - Status:           pm2 status"
echo "  - Monitoring:       pm2 monit"
echo ""
log_info "Service endpoints:"
echo "  - API:              http://localhost:6864"
echo "  - WebSocket:        ws://localhost:6864/ws/signals"
echo "  - Health check:     http://localhost:6864/health"
echo ""
log_warning "IMPORTANT:"
echo "  - Default database password: changeme123 (CHANGE THIS!)"
echo "  - Configure TradingView credentials in .env"
echo "  - Add Telegram bot token in .env"
echo "  - Set up exchange API keys in .env"
echo ""
echo "============================================================================"
