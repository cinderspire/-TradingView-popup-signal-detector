const puppeteer = require('puppeteer-core');
const { EventEmitter } = require('events');

class TradingViewCaptureService extends EventEmitter {
  constructor() {
    super();
    this.browser = null;
    this.page = null;
    this.isMonitoring = false;
    this.alertCount = 0;
    this.latencyStats = [];
    this.restartAttempts = 0;
    this.maxRestartAttempts = 5;
    this.restartDelay = 5000; // 5 seconds
    this.isRestarting = false;
  }

  async initialize() {
    console.log('🚀 Initializing TradingView Capture Service...');

    try {
      // Launch headless Chrome with ultra-low latency optimizations
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--no-first-run',
          '--no-zygote',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-notifications',
          '--disable-popup-blocking',
          '--disable-renderer-backgrounding',
          '--disable-sync',
          '--hide-scrollbars',
          '--metrics-recording-only',
          '--mute-audio'
        ],
        executablePath: '/usr/bin/chromium-browser',
        defaultViewport: { width: 1920, height: 1080 }
      });

      this.page = await this.browser.newPage();

      // Set aggressive network caching
      await this.page.setCacheEnabled(true);

      console.log('✅ Browser launched successfully');

      // Navigate to TradingView
      console.log('📊 Loading TradingView...');
      await this.page.goto('https://www.tradingview.com/chart/', {
        waitUntil: 'domcontentloaded', // Faster than networkidle
        timeout: 30000
      });

      console.log('✅ TradingView loaded');

      // Cookie-based authentication (for 2FA accounts)
      if (process.env.TRADINGVIEW_SESSION_ID && process.env.TRADINGVIEW_SESSION_SIGN) {
        await this.loginWithCookies();
      } else if (process.env.TV_USERNAME && process.env.TV_PASSWORD) {
        await this.login();
      } else {
        console.log('⚠️  No TradingView credentials provided - manual login required');
      }

      console.log('✅ TradingView Capture Service initialized');
      return true;
    } catch (error) {
      console.error('❌ Initialization error:', error);
      throw error;
    }
  }

  async login() {
    try {
      console.log('🔐 Logging in to TradingView...');

      // Wait for sign-in button
      await this.page.waitForSelector('[data-name="header-user-menu-sign-in"]', {
        timeout: 10000
      });

      await this.page.click('[data-name="header-user-menu-sign-in"]');

      // Wait for login form
      await this.page.waitForSelector('input[name="username"]', {
        timeout: 10000
      });

      // Fill credentials
      await this.page.type('input[name="username"]', process.env.TV_USERNAME, {
        delay: 10
      });
      await this.page.type('input[name="password"]', process.env.TV_PASSWORD, {
        delay: 10
      });

      // Submit
      await this.page.click('button[type="submit"]');

      // Wait for navigation
      await this.page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      console.log('✅ Logged in successfully');
    } catch (error) {
      console.error('❌ Login error:', error.message);
      console.log('⚠️  Continuing without login - manual login may be required');
    }
  }

  async loginWithCookies() {
    try {
      console.log('🍪 Authenticating with session cookies...');

      // Set TradingView session cookies
      const cookies = [
        {
          name: 'sessionid',
          value: process.env.TRADINGVIEW_SESSION_ID,
          domain: '.tradingview.com',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax'
        },
        {
          name: 'sessionid_sign',
          value: process.env.TRADINGVIEW_SESSION_SIGN,
          domain: '.tradingview.com',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax'
        }
      ];

      await this.page.setCookie(...cookies);
      console.log('✅ Session cookies set');

      // Reload page to apply authentication
      console.log('🔄 Reloading to apply authentication...');
      await this.page.goto(process.env.TRADINGVIEW_CHART_URL || 'https://www.tradingview.com/chart/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait a bit for auth to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Take screenshot for debugging
      try {
        await this.page.screenshot({
          path: '/home/automatedtradebot/logs/tradingview-auth-debug.png',
          fullPage: false
        });
        console.log('📸 Screenshot saved to /home/automatedtradebot/logs/tradingview-auth-debug.png');
      } catch (e) {
        console.log('⚠️  Could not take screenshot:', e.message);
      }

      // Check if we're logged in by looking for various indicators
      const isLoggedIn = await this.page.evaluate(() => {
        // Check multiple possible indicators
        const indicators = [
          document.querySelector('[data-name="header-user-menu-button"]'),
          document.querySelector('[class*="userMenu"]'),
          document.querySelector('[data-role="button"][data-name*="user"]'),
          document.cookie.includes('sessionid'),
          !document.querySelector('[data-name="header-user-menu-sign-in"]')
        ];
        return indicators.some(indicator => indicator);
      });

      if (isLoggedIn) {
        console.log('✅ Authenticated successfully with cookies!');
        return true;
      } else {
        console.log('⚠️  Could not verify authentication - checking cookies...');

        // Print current cookies for debugging
        const cookies = await this.page.cookies();
        const sessionCookie = cookies.find(c => c.name === 'sessionid');
        if (sessionCookie) {
          console.log('✅ Session cookie is present');
        } else {
          console.log('❌ Session cookie not found - cookies may be expired or invalid');
        }

        return false;
      }

    } catch (error) {
      console.error('❌ Cookie authentication error:', error.message);
      console.log('⚠️  Continuing without authentication - manual login may be required');
      return false;
    }
  }

  async startMonitoring() {
    console.log('👀 Starting alert monitoring...');
    this.isMonitoring = true;

    // Enable console logs from page
    this.page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[ALERT') || text.includes('[Monitor]') || text.includes('triggered')) {
        console.log('🖥️  Browser Console:', text);
      }
    });

    // Inject alert monitoring script
    await this.page.evaluate(() => {
      // Global variable to store captured alerts
      window.__tradingViewAlerts = [];

      console.log('[Monitor] Initializing alert detection...');

      // MutationObserver to detect alert popups - AGGRESSIVE MODE
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            // Check if node is an element
            if (!node.classList && !node.nodeType) return;

            const nodeText = node.textContent || node.innerText || '';
            const classList = node.classList ? Array.from(node.classList).join(' ') : '';

            // ULTRA AGGRESSIVE - Detect ANY notification-like element
            const isAlert =
                classList.includes('tv-dialog') ||
                classList.includes('tv-alert') ||
                classList.includes('tv-toast') ||
                classList.includes('toast') ||
                classList.includes('notification') ||
                classList.includes('popup') ||
                nodeText.includes('Alert on') ||
                nodeText.includes('triggered') ||
                nodeText.includes('LONG') ||
                nodeText.includes('SHORT') ||
                nodeText.includes('BUY') ||
                nodeText.includes('SELL') ||
                (node.nodeName === 'DIV' && nodeText.length > 10 && nodeText.length < 500 &&
                 (nodeText.includes('USD') || nodeText.includes('BTC') || nodeText.includes('ETH')));

            if (isAlert) {
              const timestamp = Date.now();
              const alertText = nodeText.trim();

              // Store alert
              window.__tradingViewAlerts.push({
                timestamp,
                text: alertText,
                type: 'popup',
                className: classList,
                html: node.outerHTML ? node.outerHTML.substring(0, 500) : ''
              });

              console.log('[ALERT CAPTURED]', timestamp, alertText.substring(0, 100));
            }
          });
        });
      });

      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Also intercept browser notifications
      if (window.Notification) {
        const originalNotification = window.Notification;
        window.Notification = function(title, options) {
          console.log('[NOTIFICATION INTERCEPTED]', title, options);
          window.__tradingViewAlerts.push({
            timestamp: Date.now(),
            text: title + ' ' + (options?.body || ''),
            type: 'notification'
          });
          return new originalNotification(title, options);
        };
      }

      console.log('[Monitor] Alert detection active - AGGRESSIVE MODE');
      console.log('[Monitor] Watching for: toast, dialog, notification, LONG, SHORT, BUY, SELL');
    });

    // Poll for captured alerts with minimal latency
    this.pollForAlerts();

    console.log('✅ Alert monitoring active');
  }

  async pollForAlerts() {
    const pollInterval = 10; // 10ms for ultra-low latency

    const poll = async () => {
      if (!this.isMonitoring) return;

      try {
        const alerts = await this.page.evaluate(() => {
          const captured = window.__tradingViewAlerts || [];
          window.__tradingViewAlerts = []; // Clear after reading
          return captured;
        });

        if (alerts && alerts.length > 0) {
          for (const alert of alerts) {
            await this.processAlert(alert);
          }
        }
      } catch (error) {
        if (error.message.includes('Session closed') ||
            error.message.includes('Target closed') ||
            error.message.includes('Protocol error')) {
          console.error('❌ Browser session closed or crashed');
          this.isMonitoring = false;
          this.emit('error', error);

          // Attempt automatic restart
          if (!this.isRestarting) {
            this.attemptRestart();
          }
          return;
        }
        // Ignore other errors to avoid stopping monitoring
      }

      // Schedule next poll
      if (this.isMonitoring) {
        setTimeout(poll, pollInterval);
      }
    };

    poll();
  }

  async processAlert(alert) {
    const startTime = Date.now();
    const captureLatency = startTime - alert.timestamp;

    try {
      const parsed = this.parseAlert(alert.text);

      if (parsed) {
        const totalLatency = Date.now() - alert.timestamp;

        // Record stats
        this.alertCount++;
        this.latencyStats.push(totalLatency);

        // Keep last 100 samples
        if (this.latencyStats.length > 100) {
          this.latencyStats.shift();
        }

        const signal = {
          id: this.generateId(),
          timestamp: alert.timestamp,
          captureLatency,
          processingLatency: Date.now() - startTime,
          totalLatency,
          rawText: alert.text,
          ...parsed
        };

        console.log(`📡 Signal captured: ${signal.pair} ${signal.direction} @ ${signal.entry} (${totalLatency}ms)`);

        // Emit signal event
        this.emit('signal', signal);
      } else {
        console.log('⚠️  Could not parse alert:', alert.text.substring(0, 100));
      }
    } catch (error) {
      console.error('❌ Alert processing error:', error);
    }
  }

  parseAlert(text) {
    // Parse various alert formats
    console.log('🔍 Parsing alert text (length ' + text.length + '):', text.substring(0, 200));

    // Format 0: JSON Strategy Format - "3RSI{"action":"sell","contracts":"18.712",...}"
    // Match patterns: "3RSI{", "Alert on XYZ 3RSI{", "Alert on XYZ.P3RSI{"
    const jsonPattern = /([A-Z0-9]+)\{/;
    const jsonMatch = text.match(jsonPattern);

    if (jsonMatch && text.includes('{')) {
      try {
        const strategyName = jsonMatch[1];
        const jsonStart = text.indexOf('{');

        // Find the closing brace - handle nested objects
        let braceCount = 0;
        let jsonEnd = jsonStart;
        for (let i = jsonStart; i < text.length; i++) {
          if (text[i] === '{') braceCount++;
          if (text[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }

        const jsonText = text.substring(jsonStart, jsonEnd);
        console.log('🔍 JSON candidate (length ' + jsonText.length + '):', jsonText.substring(0, 150));
        const data = JSON.parse(jsonText);

        // Detect signal type: ENTRY or EXIT
        // CRITICAL: Check marketPosition vs prevMarketPosition to determine ENTRY vs EXIT
        let signalType = 'ENTRY';
        let direction = 'LONG';

        const currPos = (data.marketPosition || '').toLowerCase();
        const prevPos = (data.prevMarketPosition || '').toLowerCase();

        // ENTRY Detection: Going from flat → long/short
        const isNewEntry = (prevPos === 'flat' && (currPos === 'long' || currPos === 'short'));

        // EXIT Detection: Going from long/short → flat (or explicit close actions)
        const isExit = (
          // Explicit close/exit actions
          data.action === 'close' ||
          data.action === 'exit' ||
          // Position going flat (was in position, now flat)
          (currPos === 'flat' && (prevPos === 'long' || prevPos === 'short')) ||
          // Explicit text indicators
          text.toLowerCase().includes('close position') ||
          text.toLowerCase().includes('exit position')
        );

        console.log(`🔍 Signal Detection: currPos="${currPos}", prevPos="${prevPos}", action="${data.action}"`);

        if (isExit) {
          signalType = 'EXIT';
          // Direction = which position is being CLOSED
          if (prevPos === 'long' || data.action === 'sell') {
            direction = 'LONG'; // Closing a LONG position
          } else if (prevPos === 'short' || data.action === 'buy') {
            direction = 'SHORT'; // Closing a SHORT position
          }
          console.log(`   ✅ Detected EXIT signal (closing ${direction} position)`);
        } else if (isNewEntry) {
          signalType = 'ENTRY';
          // Direction = new position being OPENED
          if (currPos === 'short' || data.action === 'sell') {
            direction = 'SHORT';
          } else if (currPos === 'long' || data.action === 'buy') {
            direction = 'LONG';
          }
          console.log(`   ✅ Detected ENTRY signal (opening ${direction} position)`);
        } else {
          // Fallback: Use action to determine
          if (data.action === 'sell' || data.action === 'short') {
            direction = 'SHORT';
          } else if (data.action === 'buy' || data.action === 'long') {
            direction = 'LONG';
          }
          console.log(`   ⚠️  Using fallback detection (action=${data.action} → ${direction})`);
        }

        // Extract pair from strategy name or use default
        // Common patterns: 3RSI, 7RSI, GRID, BTCUSDT, etc.
        let pair = data.ticker || data.pair || data.symbol || 'BTC/USDT';

        // If pair doesn't have /, try to format it
        if (!pair.includes('/') && pair.length > 3) {
          if (pair.endsWith('USDT')) {
            pair = pair.replace('USDT', '') + '/USDT';
          } else if (pair.endsWith('USD')) {
            pair = pair.replace('USD', '') + '/USD';
          }
        }

        return {
          pair,
          direction,
          signalType,  // NEW: ENTRY or EXIT
          entry: parseFloat(data.price || data.close || data.entry || 0) || null,
          takeProfit: parseFloat(data.tp || data.take_profit || 0) || null,
          stopLoss: parseFloat(data.sl || data.stop_loss || 0) || null,
          strategy: strategyName,
          contracts: parseFloat(data.contracts || 0) || null,
          marketPosition: data.marketPosition,
          format: 'json'
        };
      } catch (e) {
        console.log('⚠️  JSON parse error:', e.message);
        // Fall through to text patterns
      }
    }

    // Check for CLOSE/EXIT patterns in text
    const isCloseSignal = text.toLowerCase().includes('close') ||
                          text.toLowerCase().includes('exit') ||
                          text.toLowerCase().includes('flat');

    // Format 1: "BTC/USDT LONG @ 45000 TP: 46000 SL: 44500"
    const pattern1 = /([A-Z]+\/[A-Z]+)\s+(LONG|SHORT|BUY|SELL|CLOSE|EXIT)\s+(?:@|at|price:?)\s*([\d,.]+)(?:\s+TP:?\s*([\d,.]+))?(?:\s+SL:?\s*([\d,.]+))?/i;

    // Format 2: "Alert on BTCUSDT: BUY at 45000"
    const pattern2 = /Alert on ([A-Z]+):\s+(BUY|SELL|LONG|SHORT|CLOSE|EXIT)\s+(?:at|@)\s*([\d,.]+)/i;

    // Format 3: "BTCUSDT triggered @ 45000 - LONG"
    const pattern3 = /([A-Z]+)\s+triggered\s+@\s*([\d,.]+)\s*-?\s*(LONG|SHORT|BUY|SELL|CLOSE|EXIT)?/i;

    // Format 4: Simple "BTC LONG 45000"
    const pattern4 = /([A-Z]+)\s+(LONG|SHORT|BUY|SELL|CLOSE|EXIT)\s+([\d,.]+)/i;

    const patterns = [pattern1, pattern2, pattern3, pattern4];

    for (const pattern of patterns) {
      const match = text.match(pattern);

      if (match) {
        // Normalize pair format
        let pair = match[1];
        if (!pair.includes('/')) {
          // Convert BTCUSDT to BTC/USDT
          if (pair.endsWith('USDT')) {
            pair = pair.replace('USDT', '') + '/USDT';
          } else if (pair.endsWith('USD')) {
            pair = pair.replace('USD', '') + '/USD';
          } else if (pair.endsWith('BTC')) {
            pair = pair.replace('BTC', '') + '/BTC';
          }
        }

        // Detect signal type
        let signalType = 'ENTRY';
        let direction = (match[2] || match[3] || 'LONG').toUpperCase();

        if (direction === 'CLOSE' || direction === 'EXIT' || isCloseSignal) {
          signalType = 'EXIT';
          // For text patterns, we may not know the original direction
          // Default to LONG for EXIT if not specified
          direction = 'LONG';
        } else {
          // Normalize direction for ENTRY
          if (direction === 'BUY') direction = 'LONG';
          if (direction === 'SELL') direction = 'SHORT';
        }

        // Parse prices (remove commas)
        const entry = parseFloat((match[3] || match[2] || '0').replace(/,/g, ''));
        const takeProfit = parseFloat((match[4] || '0').replace(/,/g, '')) || null;
        const stopLoss = parseFloat((match[5] || '0').replace(/,/g, '')) || null;

        if (entry > 0) {
          return {
            pair,
            direction,
            signalType,  // NEW: ENTRY or EXIT
            entry,
            takeProfit,
            stopLoss,
            format: 'parsed'
          };
        }
      }
    }

    return null;
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    const avgLatency = this.latencyStats.length > 0
      ? this.latencyStats.reduce((a, b) => a + b, 0) / this.latencyStats.length
      : 0;

    return {
      alertCount: this.alertCount,
      avgLatency: Math.round(avgLatency),
      isMonitoring: this.isMonitoring,
      recentLatencies: this.latencyStats.slice(-10)
    };
  }

  /**
   * Attempt to restart the browser after a crash
   */
  async attemptRestart() {
    if (this.isRestarting) {
      console.log('⚠️  Restart already in progress, skipping...');
      return;
    }

    this.isRestarting = true;
    this.restartAttempts++;

    if (this.restartAttempts > this.maxRestartAttempts) {
      console.error(`❌ Maximum restart attempts (${this.maxRestartAttempts}) reached. Manual intervention required.`);
      this.emit('fatal-error', new Error('Max restart attempts exceeded'));
      this.isRestarting = false;
      return;
    }

    console.log(`🔄 Attempting browser restart (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`);

    try {
      // Clean up existing browser
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (closeError) {
          console.log('⚠️  Error closing browser:', closeError.message);
        }
      }

      // Wait before restarting
      await new Promise(resolve => setTimeout(resolve, this.restartDelay));

      // Reinitialize
      await this.initialize();

      // Start monitoring again
      await this.startMonitoring();

      console.log('✅ Browser successfully restarted');
      this.restartAttempts = 0; // Reset on success
      this.emit('restarted');

    } catch (error) {
      console.error(`❌ Restart attempt ${this.restartAttempts} failed:`, error.message);

      // Try again with exponential backoff
      this.restartDelay = Math.min(this.restartDelay * 1.5, 60000); // Max 60 seconds

      setTimeout(() => {
        this.isRestarting = false;
        this.attemptRestart();
      }, 2000);
    }

    this.isRestarting = false;
  }

  async stop() {
    console.log('⏹️  Stopping TradingView Capture Service...');
    this.isMonitoring = false;

    if (this.browser) {
      await this.browser.close();
    }

    console.log('✅ Service stopped');
  }
}

module.exports = TradingViewCaptureService;
