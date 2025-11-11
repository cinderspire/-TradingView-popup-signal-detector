const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const authenticateToken = authenticate;
const requireRole = authorize;

/**
 * COMPLETE PAGE ROUTES - TEMPORARY HTML RESPONSES
 * Will be replaced with proper React frontend
 */

// Homepage with complete trading platform HTML
router.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutomatedTradeBot - Professional Trading Signal Marketplace</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        header {
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px);
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            position: fixed;
            width: 100%;
            top: 0;
            z-index: 1000;
        }
        nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 5%;
            max-width: 1400px;
            margin: 0 auto;
        }
        .logo {
            font-size: 1.8rem;
            font-weight: bold;
            color: #667eea;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .nav-links {
            display: flex;
            gap: 2rem;
            list-style: none;
        }
        .nav-links a {
            text-decoration: none;
            color: #4a5568;
            font-weight: 500;
            transition: color 0.3s;
        }
        .nav-links a:hover {
            color: #667eea;
        }
        .hero {
            padding: 120px 5% 80px;
            text-align: center;
            color: white;
        }
        .hero h1 {
            font-size: 3.5rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .hero p {
            font-size: 1.3rem;
            margin-bottom: 2rem;
            opacity: 0.95;
        }
        .cta-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
        }
        .btn {
            padding: 1rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s;
            display: inline-block;
        }
        .btn-primary {
            background: white;
            color: #667eea;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        .btn-secondary {
            background: transparent;
            color: white;
            border: 2px solid white;
        }
        .btn-secondary:hover {
            background: white;
            color: #667eea;
        }
        .features {
            background: white;
            padding: 80px 5%;
        }
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 3rem;
            max-width: 1200px;
            margin: 0 auto;
        }
        .feature-card {
            text-align: center;
            padding: 2rem;
        }
        .feature-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
        .feature-title {
            font-size: 1.3rem;
            color: #1a202c;
            margin-bottom: 0.5rem;
        }
        .feature-desc {
            color: #718096;
            line-height: 1.6;
        }
        .stats {
            background: #f7fafc;
            padding: 60px 5%;
            text-align: center;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 2rem;
            max-width: 1000px;
            margin: 2rem auto 0;
        }
        .stat-item {
            padding: 1.5rem;
        }
        .stat-number {
            font-size: 2.5rem;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #718096;
            margin-top: 0.5rem;
        }
        footer {
            background: #1a202c;
            color: #a0aec0;
            padding: 40px 5%;
            text-align: center;
        }
        .footer-links {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }
        .footer-links a {
            color: #a0aec0;
            text-decoration: none;
        }
        .footer-links a:hover {
            color: white;
        }
        @media (max-width: 768px) {
            .hero h1 {
                font-size: 2.5rem;
            }
            .nav-links {
                display: none;
            }
        }
    </style>
</head>
<body>
    <header>
        <nav>
            <div class="logo">📈 AutomatedTradeBot</div>
            <ul class="nav-links">
                <li><a href="/">Home</a></li>
                <li><a href="/signals">Signals</a></li>
                <li><a href="/providers">Providers</a></li>
                <li><a href="/backtest">Backtest</a></li>
                <li><a href="/documentation">Docs</a></li>
                <li><a href="/pricing">Pricing</a></li>
                <li><a href="/dashboard">Dashboard</a></li>
                <li><a href="/login">Login</a></li>
            </ul>
        </nav>
    </header>

    <main>
        <section class="hero">
            <h1>Professional Crypto Trading Signals</h1>
            <p>SignalStart for Crypto - Automated copy trading with real-time performance tracking</p>
            <div class="cta-buttons">
                <a href="/register" class="btn btn-primary">Start Free Trial</a>
                <a href="/providers" class="btn btn-secondary">Browse Providers</a>
            </div>
        </section>

        <section class="features">
            <h2 style="text-align: center; font-size: 2.5rem; margin-bottom: 3rem; color: #1a202c;">Platform Features</h2>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">⚡</div>
                    <div class="feature-title">Ultra-Fast Execution</div>
                    <div class="feature-desc">TradingView screen capture with <100ms latency vs 3-5s webhooks</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📊</div>
                    <div class="feature-title">Real-Time PnL</div>
                    <div class="feature-desc">Live position tracking with open PnL and drawdown monitoring</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🤖</div>
                    <div class="feature-title">AI Strategy Advisor</div>
                    <div class="feature-desc">Personalized portfolio recommendations based on risk profile</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📈</div>
                    <div class="feature-title">Advanced Backtesting</div>
                    <div class="feature-desc">Test strategies with real historical data from major exchanges</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">💰</div>
                    <div class="feature-title">$3/Month Per Strategy</div>
                    <div class="feature-desc">Affordable pricing with 70/30 revenue share for providers</div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔄</div>
                    <div class="feature-title">Multi-Exchange</div>
                    <div class="feature-desc">Bybit, MEXC, Bitget, Binance + 100 more via CCXT</div>
                </div>
            </div>
        </section>

        <section class="stats">
            <h2 style="font-size: 2.5rem; margin-bottom: 1rem; color: #1a202c;">Platform Statistics</h2>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number">500+</div>
                    <div class="stat-label">Active Strategies</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">10,000+</div>
                    <div class="stat-label">Traders</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">$50M+</div>
                    <div class="stat-label">Trading Volume</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">100+</div>
                    <div class="stat-label">Supported Exchanges</div>
                </div>
            </div>
        </section>
    </main>

    <footer>
        <div class="footer-links">
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/api">API</a>
            <a href="/status">Status</a>
        </div>
        <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
        <p style="margin-top: 1rem; font-size: 0.9rem;">🚀 Powered by Node.js, WebSocket, PostgreSQL, and AI</p>
    </footer>
</body>
</html>
  `);
});

// Other page routes return simple responses for now
router.get('/signals', (req, res) => {
  res.json({ message: 'Signals page - Will display all trading signals' });
});

router.get('/providers', (req, res) => {
  res.json({ message: 'Providers page - Will display signal providers list' });
});

router.get('/backtest', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Backtest - AutomatedTradeBot</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 600px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #1a202c;
            margin-bottom: 20px;
        }
        .description {
            color: #718096;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .button {
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .button:hover {
            background: #5a67d8;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔬 Backtesting Engine</h1>
        <p class="description">
            Test your trading strategies with real historical data from multiple exchanges.
            Our backtesting engine supports:<br><br>
            ✅ Real OHLCV data from Bybit, MEXC, Bitget<br>
            ✅ Multiple timeframes (5m, 15m, 1h, 4h, 1d)<br>
            ✅ Accurate fee calculations (0.1% maker/taker)<br>
            ✅ Slippage simulation<br>
            ✅ Position sizing and risk management<br>
            ✅ Comprehensive performance metrics
        </p>
        <button class="button" onclick="window.location.href='/'">Back to Home</button>
    </div>
</body>
</html>
  `);
});

router.get('/documentation', (req, res) => {
  res.json({ message: 'Documentation page - API docs and guides' });
});

router.get('/pricing', (req, res) => {
  res.json({ message: 'Pricing page - $3/month per strategy' });
});

router.get('/dashboard', authenticateToken, (req, res) => {
  res.json({
    message: 'Dashboard - Protected route',
    user: req.user
  });
});

router.get('/login', (req, res) => {
  res.json({ message: 'Login page' });
});

router.get('/register', (req, res) => {
  res.json({ message: 'Register page' });
});

// Admin routes
router.get('/admin', authenticateToken, requireRole(['ADMIN']), (req, res) => {
  res.json({ message: 'Admin panel', user: req.user });
});

// Provider routes
router.get('/provider/dashboard', authenticateToken, requireRole(['PROVIDER', 'ADMIN']), (req, res) => {
  res.json({ message: 'Provider dashboard', user: req.user });
});

module.exports = router;