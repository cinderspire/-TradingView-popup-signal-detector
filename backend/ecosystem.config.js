module.exports = {
  apps: [
    {
      name: 'automatedtradebot-api',
      script: './src/server.js',
      instances: 1,  // Changed to 1 because signal capture runs in same process
      exec_mode: 'fork',  // Changed to fork for signal capture compatibility
      env: {
        NODE_ENV: 'production',
        PORT: 6864,
        ENABLE_TRADINGVIEW_CAPTURE: 'true',
        PUPPETEER_HEADLESS: 'true'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 6864,
        ENABLE_TRADINGVIEW_CAPTURE: 'true',
        PUPPETEER_HEADLESS: 'false'
      },
      // Logging
      error_file: '/home/automatedtradebot/logs/api-error.log',
      out_file: '/home/automatedtradebot/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Auto restart configuration
      max_memory_restart: '2G',  // Increased for Puppeteer
      min_uptime: '10s',
      max_restarts: 10,

      // Monitoring
      autorestart: true,
      watch: false,

      // Graceful shutdown (longer for signal capture cleanup)
      kill_timeout: 10000,
      listen_timeout: 5000,

      // Source map support + Chrome flags for Puppeteer
      node_args: '--max-old-space-size=4096',

      // Environment variables for Chromium
      env_production: {
        CHROME_EXECUTABLE_PATH: '/usr/bin/chromium-browser'
      }
    },
    {
      name: 'automatedtradebot-worker',
      script: './src/workers/backtestWorker.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'backtest'
      },
      error_file: '/home/automatedtradebot/logs/worker-error.log',
      out_file: '/home/automatedtradebot/logs/worker-out.log',
      max_memory_restart: '2G',
      autorestart: true
    },
    {
      name: 'automatedtradebot-signals',
      script: './src/workers/signalWorker.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'signals'
      },
      error_file: '/home/automatedtradebot/logs/signals-error.log',
      out_file: '/home/automatedtradebot/logs/signals-out.log',
      max_memory_restart: '512M',
      autorestart: true
    }
  ],
  
  deploy: {
    production: {
      user: 'automatedtradebot',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/automatedtradebot.git',
      path: '/home/automatedtradebot',
      'post-deploy': 'npm install && npx prisma migrate deploy && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'npm install pm2 -g'
    }
  }
};
