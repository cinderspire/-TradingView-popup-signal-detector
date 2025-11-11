const express = require('express');
const router = express.Router();
const path = require('path');

// Sample data for demonstration
const sampleProviders = [
  {
    id: 1,
    name: "TradeMaster Pro",
    verified: true,
    winRate: 68.5,
    totalSignals: 245,
    followers: 1420,
    monthlyReturn: 24.3,
    avatar: "https://ui-avatars.com/api/?name=TradeMaster+Pro&background=667eea&color=fff&size=128",
    description: "Professional forex trader with 5+ years experience in EUR/USD and GBP/USD pairs"
  },
  {
    id: 2,
    name: "CryptoKing",
    verified: true,
    winRate: 72.1,
    totalSignals: 189,
    followers: 2150,
    monthlyReturn: 31.8,
    avatar: "https://ui-avatars.com/api/?name=CryptoKing&background=10b981&color=fff&size=128",
    description: "Specialized in Bitcoin and Ethereum trading with advanced technical analysis"
  },
  {
    id: 3,
    name: "ForexWizard",
    verified: true,
    winRate: 65.3,
    totalSignals: 312,
    followers: 980,
    monthlyReturn: 18.7,
    avatar: "https://ui-avatars.com/api/?name=ForexWizard&background=f59e0b&color=fff&size=128",
    description: "Multi-currency expert focusing on major forex pairs and gold trading"
  },
  {
    id: 4,
    name: "SignalNinja",
    verified: false,
    winRate: 58.9,
    totalSignals: 156,
    followers: 540,
    monthlyReturn: 12.4,
    avatar: "https://ui-avatars.com/api/?name=SignalNinja&background=8b5cf6&color=fff&size=128",
    description: "Day trader specializing in high-frequency scalping strategies"
  }
];

const sampleSignals = [
  {
    id: 1,
    provider: "TradeMaster Pro",
    symbol: "EUR/USD",
    direction: "BUY",
    entry: 1.0875,
    stopLoss: 1.0820,
    takeProfit: 1.0950,
    status: "OPEN",
    timeframe: "4H",
    pnl: null,
    openedAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 2,
    provider: "CryptoKing",
    symbol: "BTC/USD",
    direction: "SELL",
    entry: 62480,
    stopLoss: 63200,
    takeProfit: 61500,
    status: "CLOSED",
    timeframe: "1H",
    pnl: 980,
    openedAt: new Date(Date.now() - 86400000).toISOString(),
    closedAt: new Date(Date.now() - 43200000).toISOString()
  },
  {
    id: 3,
    provider: "ForexWizard",
    symbol: "GBP/USD",
    direction: "BUY",
    entry: 1.2640,
    stopLoss: 1.2590,
    takeProfit: 1.2720,
    status: "OPEN",
    timeframe: "1D",
    pnl: null,
    openedAt: new Date(Date.now() - 7200000).toISOString()
  }
];

// Landing page
router.get('/', (req, res) => {
  res.send(renderLandingPage());
});

// Providers list page
router.get('/providers', (req, res) => {
  res.send(renderProvidersPage());
});

// Signals feed page
router.get('/signals', (req, res) => {
  res.send(renderSignalsPage());
});

// Provider detail page
router.get('/provider/:id', (req, res) => {
  const provider = sampleProviders.find(p => p.id === parseInt(req.params.id));
  if (!provider) {
    return res.status(404).send('<h1>Provider not found</h1>');
  }
  res.send(renderProviderDetailPage(provider));
});

function renderLandingPage() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutomatedTradeBot - Professional Trading Signal Marketplace</title>
    ${getCommonStyles()}
</head>
<body>
    ${getHeader()}

    <!-- Hero Section -->
    <section class="hero">
        <div class="container">
            <div class="hero-content">
                <div class="hero-text">
                    <span class="badge-new">New Platform</span>
                    <h1 class="hero-title">Professional Trading Signals<br><span class="gradient-text">Marketplace</span></h1>
                    <p class="hero-desc">Connect with verified signal providers, copy trades automatically, and grow your portfolio with advanced risk management tools.</p>
                    <div class="hero-buttons">
                        <a href="/providers" class="btn btn-primary btn-lg">Browse Providers</a>
                        <a href="/signals" class="btn btn-secondary btn-lg">View Live Signals</a>
                    </div>
                    <div class="hero-stats">
                        <div class="stat-item">
                            <div class="stat-value">2,450+</div>
                            <div class="stat-label">Active Signals</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">180+</div>
                            <div class="stat-label">Verified Providers</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">12,500+</div>
                            <div class="stat-label">Subscribers</div>
                        </div>
                    </div>
                </div>
                <div class="hero-image">
                    <div class="chart-preview">
                        <div class="chart-header">
                            <span class="chart-title">Live Performance</span>
                            <span class="chart-value profit">+24.3%</span>
                        </div>
                        <svg class="chart-svg" viewBox="0 0 400 250">
                            <polyline fill="none" stroke="#10b981" stroke-width="3" points="0,200 50,180 100,150 150,160 200,120 250,100 300,80 350,60 400,40"/>
                            <polyline fill="url(#gradient)" stroke="none" points="0,200 50,180 100,150 150,160 200,120 250,100 300,80 350,60 400,40 400,250 0,250"/>
                            <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" style="stop-color:#10b981;stop-opacity:0.3" />
                                    <stop offset="100%" style="stop-color:#10b981;stop-opacity:0" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section class="features">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">Why Choose AutomatedTradeBot?</h2>
                <p class="section-desc">Everything you need to succeed in trading signals marketplace</p>
            </div>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">⚡</div>
                    <h3>Real-Time Signals</h3>
                    <p>Get instant notifications via WebSocket. Never miss a trading opportunity with our ultra-fast signal distribution.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🛡️</div>
                    <h3>Advanced Risk Management</h3>
                    <p>Adaptive position sizing, news sentiment-based stop loss, and intelligent risk control algorithms.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📊</div>
                    <h3>Rich Analytics</h3>
                    <p>Track open PnL, maximum drawdown, Sharpe ratio, and profit factor with beautiful animated charts.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">✓</div>
                    <h3>Verified Providers</h3>
                    <p>All signal providers are verified based on their trading history and performance metrics.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔄</div>
                    <h3>Copy Trading</h3>
                    <p>Automatically copy trades from top performers with customizable position sizing and risk parameters.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔐</div>
                    <h3>Secure & Transparent</h3>
                    <p>Bank-level security with transparent performance tracking. Your data is always encrypted and protected.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Top Providers Section -->
    <section class="top-providers">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">Top Signal Providers</h2>
                <p class="section-desc">Join thousands of traders following these verified providers</p>
            </div>
            <div class="providers-grid">
                ${sampleProviders.slice(0, 3).map(provider => `
                    <div class="provider-card">
                        <div class="provider-header">
                            <img src="${provider.avatar}" alt="${provider.name}" class="provider-avatar">
                            <div class="provider-info">
                                <div class="provider-name-row">
                                    <h3>${provider.name}</h3>
                                    ${provider.verified ? '<span class="verified-badge">✓</span>' : ''}
                                </div>
                                <p class="provider-desc">${provider.description}</p>
                            </div>
                        </div>
                        <div class="provider-stats">
                            <div class="stat">
                                <div class="stat-label">Win Rate</div>
                                <div class="stat-value profit">${provider.winRate}%</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Monthly Return</div>
                                <div class="stat-value profit">+${provider.monthlyReturn}%</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Followers</div>
                                <div class="stat-value">${provider.followers.toLocaleString()}</div>
                            </div>
                        </div>
                        <a href="/provider/${provider.id}" class="btn btn-primary btn-block">View Profile</a>
                    </div>
                `).join('')}
            </div>
            <div style="text-align: center; margin-top: 40px;">
                <a href="/providers" class="btn btn-secondary btn-lg">View All Providers →</a>
            </div>
        </div>
    </section>

    ${getFooter()}
</body>
</html>
  `;
}

function renderProvidersPage() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Signal Providers - AutomatedTradeBot</title>
    ${getCommonStyles()}
</head>
<body>
    ${getHeader()}

    <div class="page-header">
        <div class="container">
            <h1>Signal Providers</h1>
            <p>Browse and subscribe to verified signal providers</p>
        </div>
    </div>

    <section class="providers-section">
        <div class="container">
            <div class="filters-bar">
                <input type="text" class="search-input" placeholder="Search providers...">
                <select class="filter-select">
                    <option>All Categories</option>
                    <option>Forex</option>
                    <option>Crypto</option>
                    <option>Stocks</option>
                </select>
                <select class="filter-select">
                    <option>Sort by: Win Rate</option>
                    <option>Sort by: Followers</option>
                    <option>Sort by: Monthly Return</option>
                </select>
            </div>

            <div class="providers-grid">
                ${sampleProviders.map(provider => `
                    <div class="provider-card">
                        <div class="provider-header">
                            <img src="${provider.avatar}" alt="${provider.name}" class="provider-avatar">
                            <div class="provider-info">
                                <div class="provider-name-row">
                                    <h3>${provider.name}</h3>
                                    ${provider.verified ? '<span class="verified-badge">✓</span>' : ''}
                                </div>
                                <p class="provider-desc">${provider.description}</p>
                            </div>
                        </div>
                        <div class="provider-stats">
                            <div class="stat">
                                <div class="stat-label">Win Rate</div>
                                <div class="stat-value ${provider.winRate >= 60 ? 'profit' : ''}">${provider.winRate}%</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Total Signals</div>
                                <div class="stat-value">${provider.totalSignals}</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Monthly Return</div>
                                <div class="stat-value profit">+${provider.monthlyReturn}%</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">Followers</div>
                                <div class="stat-value">${provider.followers.toLocaleString()}</div>
                            </div>
                        </div>
                        <a href="/provider/${provider.id}" class="btn btn-primary btn-block">View Profile</a>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>

    ${getFooter()}
</body>
</html>
  `;
}

function renderSignalsPage() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Signals - AutomatedTradeBot</title>
    ${getCommonStyles()}
</head>
<body>
    ${getHeader()}

    <div class="page-header">
        <div class="container">
            <h1>Live Trading Signals</h1>
            <p>Real-time signals from verified providers</p>
        </div>
    </div>

    <section class="signals-section">
        <div class="container">
            <div class="signals-grid">
                ${sampleSignals.map(signal => `
                    <div class="signal-card ${signal.direction.toLowerCase()}">
                        <div class="signal-header">
                            <div class="signal-symbol">
                                <h3>${signal.symbol}</h3>
                                <span class="signal-direction ${signal.direction.toLowerCase()}">${signal.direction}</span>
                            </div>
                            <span class="signal-status ${signal.status.toLowerCase()}">${signal.status}</span>
                        </div>
                        <div class="signal-provider">
                            <span class="provider-label">Provider:</span>
                            <span class="provider-name">${signal.provider}</span>
                        </div>
                        <div class="signal-details">
                            <div class="detail-row">
                                <span class="detail-label">Entry Price:</span>
                                <span class="detail-value">${signal.entry.toFixed(signal.symbol.includes('USD') && !signal.symbol.includes('BTC') ? 4 : 0)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Stop Loss:</span>
                                <span class="detail-value loss">${signal.stopLoss.toFixed(signal.symbol.includes('USD') && !signal.symbol.includes('BTC') ? 4 : 0)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Take Profit:</span>
                                <span class="detail-value profit">${signal.takeProfit.toFixed(signal.symbol.includes('USD') && !signal.symbol.includes('BTC') ? 4 : 0)}</span>
                            </div>
                            ${signal.pnl !== null ? `
                            <div class="detail-row">
                                <span class="detail-label">P&L:</span>
                                <span class="detail-value ${signal.pnl >= 0 ? 'profit' : 'loss'}">${signal.pnl >= 0 ? '+' : ''}$${signal.pnl}</span>
                            </div>
                            ` : ''}
                        </div>
                        <div class="signal-time">
                            <span>Timeframe: ${signal.timeframe}</span>
                            <span>${new Date(signal.openedAt).toLocaleString()}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>

    ${getFooter()}
</body>
</html>
  `;
}

function renderProviderDetailPage(provider) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${provider.name} - AutomatedTradeBot</title>
    ${getCommonStyles()}
</head>
<body>
    ${getHeader()}

    <div class="provider-detail">
        <div class="container">
            <div class="provider-profile">
                <div class="profile-left">
                    <img src="${provider.avatar}" alt="${provider.name}" class="profile-avatar">
                    <div class="profile-info">
                        <div class="profile-name-row">
                            <h1>${provider.name}</h1>
                            ${provider.verified ? '<span class="verified-badge-lg">✓ Verified</span>' : ''}
                        </div>
                        <p class="profile-desc">${provider.description}</p>
                        <div class="profile-meta">
                            <span>👥 ${provider.followers.toLocaleString()} Followers</span>
                            <span>📊 ${provider.totalSignals} Signals</span>
                        </div>
                    </div>
                </div>
                <div class="profile-actions">
                    <button class="btn btn-primary btn-lg">Subscribe Now</button>
                    <button class="btn btn-secondary">View Pricing</button>
                </div>
            </div>

            <div class="stats-cards">
                <div class="stats-card">
                    <div class="stats-icon">🎯</div>
                    <div class="stats-content">
                        <div class="stats-label">Win Rate</div>
                        <div class="stats-value profit">${provider.winRate}%</div>
                    </div>
                </div>
                <div class="stats-card">
                    <div class="stats-icon">📈</div>
                    <div class="stats-content">
                        <div class="stats-label">Monthly Return</div>
                        <div class="stats-value profit">+${provider.monthlyReturn}%</div>
                    </div>
                </div>
                <div class="stats-card">
                    <div class="stats-icon">📊</div>
                    <div class="stats-content">
                        <div class="stats-label">Total Signals</div>
                        <div class="stats-value">${provider.totalSignals}</div>
                    </div>
                </div>
                <div class="stats-card">
                    <div class="stats-icon">⭐</div>
                    <div class="stats-content">
                        <div class="stats-label">Rating</div>
                        <div class="stats-value">4.8/5.0</div>
                    </div>
                </div>
            </div>

            <div class="recent-signals">
                <h2>Recent Signals</h2>
                <div class="signals-grid">
                    ${sampleSignals.map(signal => `
                        <div class="signal-card ${signal.direction.toLowerCase()}">
                            <div class="signal-header">
                                <div class="signal-symbol">
                                    <h3>${signal.symbol}</h3>
                                    <span class="signal-direction ${signal.direction.toLowerCase()}">${signal.direction}</span>
                                </div>
                                <span class="signal-status ${signal.status.toLowerCase()}">${signal.status}</span>
                            </div>
                            <div class="signal-details">
                                <div class="detail-row">
                                    <span class="detail-label">Entry:</span>
                                    <span class="detail-value">${signal.entry.toFixed(signal.symbol.includes('USD') && !signal.symbol.includes('BTC') ? 4 : 0)}</span>
                                </div>
                                ${signal.pnl !== null ? `
                                <div class="detail-row">
                                    <span class="detail-label">P&L:</span>
                                    <span class="detail-value ${signal.pnl >= 0 ? 'profit' : 'loss'}">${signal.pnl >= 0 ? '+' : ''}$${signal.pnl}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>

    ${getFooter()}
</body>
</html>
  `;
}

function getHeader() {
  return `
    <header class="header">
        <nav class="navbar">
            <div class="container nav-container">
                <a href="/" class="logo">
                    <span class="logo-icon">📈</span>
                    <span class="logo-text">AutomatedTradeBot</span>
                </a>
                <div class="nav-menu">
                    <a href="/providers" class="nav-link">Providers</a>
                    <a href="/signals" class="nav-link">Live Signals</a>
                    <a href="#" class="nav-link">Pricing</a>
                    <a href="#" class="nav-link">About</a>
                </div>
                <div class="nav-actions">
                    <a href="#" class="btn btn-ghost">Sign In</a>
                    <a href="#" class="btn btn-primary">Get Started</a>
                </div>
            </div>
        </nav>
    </header>
  `;
}

function getFooter() {
  return `
    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-section">
                    <h3>AutomatedTradeBot</h3>
                    <p>Professional trading signal marketplace with advanced risk management and copy trading features.</p>
                </div>
                <div class="footer-section">
                    <h4>Platform</h4>
                    <a href="/providers">Signal Providers</a>
                    <a href="/signals">Live Signals</a>
                    <a href="#">Pricing</a>
                    <a href="#">API Docs</a>
                </div>
                <div class="footer-section">
                    <h4>Company</h4>
                    <a href="#">About Us</a>
                    <a href="#">Contact</a>
                    <a href="#">Terms</a>
                    <a href="#">Privacy</a>
                </div>
                <div class="footer-section">
                    <h4>Connect</h4>
                    <a href="#">Twitter</a>
                    <a href="#">Discord</a>
                    <a href="#">Telegram</a>
                    <a href="#">Support</a>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                <p class="disclaimer">Trading involves risk. Past performance is not indicative of future results.</p>
            </div>
        </div>
    </footer>
  `;
}

function getCommonStyles() {
  return `
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            --primary: #667eea;
            --primary-dark: #5a67d8;
            --secondary: #764ba2;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
            --dark: #1a202c;
            --gray: #718096;
            --light: #f7fafc;
            --border: #e2e8f0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: var(--dark);
            line-height: 1.6;
            background: #fff;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }

        /* Header & Navigation */
        .header {
            background: #fff;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }

        .navbar {
            padding: 16px 0;
        }

        .nav-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: var(--dark);
            font-weight: 700;
            font-size: 20px;
        }

        .logo-icon {
            font-size: 28px;
        }

        .nav-menu {
            display: flex;
            gap: 32px;
        }

        .nav-link {
            text-decoration: none;
            color: var(--gray);
            font-weight: 500;
            transition: color 0.2s;
        }

        .nav-link:hover {
            color: var(--primary);
        }

        .nav-actions {
            display: flex;
            gap: 12px;
        }

        /* Buttons */
        .btn {
            display: inline-block;
            padding: 10px 24px;
            border-radius: 8px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }

        .btn-primary {
            background: var(--primary);
            color: white;
        }

        .btn-primary:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
            background: white;
            color: var(--primary);
            border: 2px solid var(--primary);
        }

        .btn-secondary:hover {
            background: var(--light);
        }

        .btn-ghost {
            background: transparent;
            color: var(--gray);
        }

        .btn-ghost:hover {
            background: var(--light);
        }

        .btn-lg {
            padding: 14px 32px;
            font-size: 16px;
        }

        .btn-block {
            display: block;
            width: 100%;
            text-align: center;
        }

        /* Hero Section */
        .hero {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 80px 0;
            color: white;
        }

        .hero-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 60px;
            align-items: center;
        }

        .badge-new {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            margin-bottom: 20px;
        }

        .hero-title {
            font-size: 48px;
            font-weight: 800;
            line-height: 1.2;
            margin-bottom: 20px;
        }

        .gradient-text {
            background: linear-gradient(to right, #10b981, #06b6d4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .hero-desc {
            font-size: 18px;
            opacity: 0.9;
            margin-bottom: 32px;
            line-height: 1.8;
        }

        .hero-buttons {
            display: flex;
            gap: 16px;
            margin-bottom: 48px;
        }

        .hero-stats {
            display: flex;
            gap: 40px;
        }

        .stat-item {
            text-align: center;
        }

        .stat-value {
            font-size: 32px;
            font-weight: 700;
        }

        .stat-label {
            font-size: 14px;
            opacity: 0.8;
        }

        .chart-preview {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 24px;
            border: 1px solid rgba(255,255,255,0.2);
        }

        .chart-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .chart-title {
            font-weight: 600;
        }

        .chart-value {
            font-size: 20px;
            font-weight: 700;
        }

        .chart-svg {
            width: 100%;
            height: auto;
        }

        /* Features Section */
        .features {
            padding: 80px 0;
            background: var(--light);
        }

        .section-header {
            text-align: center;
            margin-bottom: 60px;
        }

        .section-title {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 16px;
        }

        .section-desc {
            font-size: 18px;
            color: var(--gray);
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 32px;
        }

        .feature-card {
            background: white;
            padding: 32px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            transition: all 0.3s;
        }

        .feature-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }

        .feature-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }

        .feature-card h3 {
            font-size: 20px;
            margin-bottom: 12px;
        }

        .feature-card p {
            color: var(--gray);
            line-height: 1.7;
        }

        /* Providers Section */
        .top-providers {
            padding: 80px 0;
        }

        .providers-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 32px;
        }

        .provider-card {
            background: white;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            transition: all 0.3s;
        }

        .provider-card:hover {
            box-shadow: 0 8px 24px rgba(0,0,0,0.1);
            transform: translateY(-4px);
        }

        .provider-header {
            display: flex;
            gap: 16px;
            margin-bottom: 20px;
        }

        .provider-avatar {
            width: 64px;
            height: 64px;
            border-radius: 50%;
        }

        .provider-name-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .provider-name-row h3 {
            font-size: 18px;
        }

        .verified-badge {
            background: var(--success);
            color: white;
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 12px;
        }

        .provider-desc {
            color: var(--gray);
            font-size: 14px;
            line-height: 1.5;
        }

        .provider-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-bottom: 20px;
        }

        .stat {
            text-align: center;
        }

        .stat-label {
            font-size: 12px;
            color: var(--gray);
            margin-bottom: 4px;
        }

        .stat-value {
            font-size: 18px;
            font-weight: 700;
        }

        .profit {
            color: var(--success);
        }

        .loss {
            color: var(--danger);
        }

        /* Page Header */
        .page-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 60px 0;
            color: white;
            text-align: center;
        }

        .page-header h1 {
            font-size: 42px;
            margin-bottom: 12px;
        }

        /* Filters */
        .filters-bar {
            display: flex;
            gap: 16px;
            margin-bottom: 32px;
        }

        .search-input, .filter-select {
            padding: 12px 16px;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
        }

        .search-input {
            flex: 1;
        }

        /* Signals */
        .signals-section, .providers-section {
            padding: 40px 0;
        }

        .signals-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
        }

        .signal-card {
            background: white;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            border-left: 4px solid var(--primary);
        }

        .signal-card.buy {
            border-left-color: var(--success);
        }

        .signal-card.sell {
            border-left-color: var(--danger);
        }

        .signal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

        .signal-symbol h3 {
            font-size: 20px;
            margin-bottom: 4px;
        }

        .signal-direction {
            font-size: 12px;
            padding: 4px 12px;
            border-radius: 12px;
            font-weight: 600;
        }

        .signal-direction.buy {
            background: rgba(16, 185, 129, 0.1);
            color: var(--success);
        }

        .signal-direction.sell {
            background: rgba(239, 68, 68, 0.1);
            color: var(--danger);
        }

        .signal-status {
            font-size: 12px;
            padding: 4px 12px;
            border-radius: 12px;
            font-weight: 600;
        }

        .signal-status.open {
            background: rgba(59, 130, 246, 0.1);
            color: #3b82f6;
        }

        .signal-status.closed {
            background: rgba(107, 114, 128, 0.1);
            color: #6b7280;
        }

        .signal-provider {
            font-size: 14px;
            color: var(--gray);
            margin-bottom: 16px;
        }

        .provider-name {
            color: var(--dark);
            font-weight: 600;
        }

        .signal-details {
            border-top: 1px solid var(--border);
            padding-top: 12px;
        }

        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .detail-label {
            font-size: 13px;
            color: var(--gray);
        }

        .detail-value {
            font-weight: 600;
        }

        .signal-time {
            margin-top: 12px;
            font-size: 12px;
            color: var(--gray);
            display: flex;
            justify-content: space-between;
        }

        /* Provider Detail */
        .provider-detail {
            padding: 40px 0;
        }

        .provider-profile {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            background: white;
            padding: 32px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            margin-bottom: 32px;
        }

        .profile-left {
            display: flex;
            gap: 24px;
        }

        .profile-avatar {
            width: 120px;
            height: 120px;
            border-radius: 50%;
        }

        .profile-name-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }

        .profile-name-row h1 {
            font-size: 32px;
        }

        .verified-badge-lg {
            background: var(--success);
            color: white;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
        }

        .profile-desc {
            color: var(--gray);
            margin-bottom: 16px;
            line-height: 1.6;
        }

        .profile-meta {
            display: flex;
            gap: 24px;
            font-size: 14px;
            color: var(--gray);
        }

        .profile-actions {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .stats-cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            margin-bottom: 40px;
        }

        .stats-card {
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            display: flex;
            gap: 16px;
        }

        .stats-icon {
            font-size: 32px;
        }

        .stats-label {
            font-size: 13px;
            color: var(--gray);
            margin-bottom: 4px;
        }

        .stats-value {
            font-size: 24px;
            font-weight: 700;
        }

        .recent-signals {
            margin-top: 40px;
        }

        .recent-signals h2 {
            margin-bottom: 24px;
        }

        /* Footer */
        .footer {
            background: var(--dark);
            color: white;
            padding: 60px 0 20px;
            margin-top: 80px;
        }

        .footer-content {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 40px;
            margin-bottom: 40px;
        }

        .footer-section h3, .footer-section h4 {
            margin-bottom: 16px;
        }

        .footer-section p {
            color: rgba(255,255,255,0.7);
            line-height: 1.6;
        }

        .footer-section a {
            display: block;
            color: rgba(255,255,255,0.7);
            text-decoration: none;
            margin-bottom: 8px;
            transition: color 0.2s;
        }

        .footer-section a:hover {
            color: white;
        }

        .footer-bottom {
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 20px;
            text-align: center;
            color: rgba(255,255,255,0.6);
        }

        .disclaimer {
            margin-top: 8px;
            font-size: 13px;
        }

        @media (max-width: 768px) {
            .hero-content {
                grid-template-columns: 1fr;
            }

            .features-grid, .providers-grid, .signals-grid {
                grid-template-columns: 1fr;
            }

            .nav-menu {
                display: none;
            }

            .footer-content {
                grid-template-columns: 1fr;
            }

            .stats-cards {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
  `;
}

module.exports = router;
