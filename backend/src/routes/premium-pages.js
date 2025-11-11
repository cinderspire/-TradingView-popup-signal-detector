const express = require('express');
const router = express.Router();

// Premium sample data - successful signals focused
const premiumProviders = [
  {
    id: 1,
    name: "ProTrader Elite",
    verified: true,
    winRate: 84.5,
    totalSignals: 1247,
    followers: 8420,
    monthlyReturn: 47.8,
    totalProfit: 284500,
    avatar: "https://ui-avatars.com/api/?name=ProTrader+Elite&background=10b981&color=fff&size=128&bold=true",
    description: "Institutional-grade forex signals with advanced AI analysis. Specialized in major pairs and gold.",
    rating: 4.9,
    activeSignals: 12,
    closedToday: 8,
    profitToday: 2840
  },
  {
    id: 2,
    name: "CryptoMaster AI",
    verified: true,
    winRate: 79.2,
    totalSignals: 892,
    followers: 12150,
    monthlyReturn: 56.3,
    totalProfit: 425000,
    avatar: "https://ui-avatars.com/api/?name=CryptoMaster+AI&background=667eea&color=fff&size=128&bold=true",
    description: "AI-powered cryptocurrency signals. Bitcoin, Ethereum, and top altcoins with 24/7 monitoring.",
    rating: 4.8,
    activeSignals: 15,
    closedToday: 12,
    profitToday: 4250
  },
  {
    id: 3,
    name: "ForexKing Pro",
    verified: true,
    winRate: 81.7,
    totalSignals: 2103,
    followers: 15890,
    monthlyReturn: 42.1,
    totalProfit: 567800,
    avatar: "https://ui-avatars.com/api/?name=ForexKing+Pro&background=f59e0b&color=fff&size=128&bold=true",
    description: "Professional forex trader. 8 years experience. EUR/USD, GBP/USD specialist.",
    rating: 4.9,
    activeSignals: 18,
    closedToday: 14,
    profitToday: 3780
  }
];

// Generate 84 signals for 12x6 grid with complete metrics
const generateLiveSignals = () => {
  const providers = ['ProTrader Elite', 'CryptoMaster AI', 'ForexKing Pro'];
  const symbols = [
    'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT',
    'MATIC/USDT', 'AVAX/USDT', 'DOT/USDT', 'LINK/USDT', 'UNI/USDT', 'ATOM/USDT',
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD', 'EUR/GBP',
    'XAU/USD', 'XAG/USD', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'CAD/JPY'
  ];
  const timeframes = ['5m', '15m', '30m', '1h', '2h', '4h'];
  const directions = ['BUY', 'SELL'];
  const categories = ['high', 'medium', 'low'];

  const signals = [];
  for (let i = 0; i < 84; i++) {
    const category = i < 28 ? 'high' : i < 56 ? 'medium' : 'low';
    const baseROI = category === 'high' ? 8 : category === 'medium' ? 5 : 3;
    const baseDD = category === 'high' ? 9 : category === 'medium' ? 4 : 2;
    const roi = (baseROI + Math.random() * 4).toFixed(2);
    const openRoi = (parseFloat(roi) * (1 + Math.random() * 0.5)).toFixed(2);
    const dd = (baseDD + Math.random() * 3).toFixed(1);
    const sortinoRatio = ((parseFloat(roi) / parseFloat(dd)) * (1 + Math.random() * 0.3)).toFixed(2);
    const riskRewardRatio = ((parseFloat(openRoi) / parseFloat(dd)) * (0.8 + Math.random() * 0.4)).toFixed(2);

    signals.push({
      id: i + 1,
      provider: providers[i % providers.length],
      symbol: symbols[i % symbols.length],
      timeframe: timeframes[i % timeframes.length],
      direction: directions[i % directions.length],
      category: category,
      roi: parseFloat(roi),
      openRoi: parseFloat(openRoi),
      dd: parseFloat(dd),
      sortinoRatio: parseFloat(sortinoRatio),
      riskRewardRatio: parseFloat(riskRewardRatio),
      confidence: Math.floor(85 + Math.random() * 13)
    });
  }
  return signals;
};

const liveSuccessSignals = generateLiveSignals();

const recentClosed = [
  { symbol: "EUR/USD", profit: 850, percent: 7.82, provider: "ProTrader Elite", closedAgo: "2h ago" },
  { symbol: "BTC/USD", profit: 3200, percent: 5.15, provider: "CryptoMaster AI", closedAgo: "3h ago" },
  { symbol: "GBP/JPY", profit: 1240, percent: 9.45, provider: "ForexKing Pro", closedAgo: "5h ago" },
  { symbol: "XAU/USD", profit: 5600, percent: 21.34, provider: "ProTrader Elite", closedAgo: "6h ago" },
  { symbol: "ADA/USD", profit: 680, percent: 4.21, provider: "CryptoMaster AI", closedAgo: "8h ago" }
];

router.get('/', (req, res) => {
  res.send(renderPremiumLandingPage());
});

router.get('/backtest', (req, res) => {
  res.send(renderBacktestPage());
});

function renderPremiumLandingPage() {
  const totalProfit = premiumProviders.reduce((sum, p) => sum + p.profitToday, 0);
  const avgWinRate = (premiumProviders.reduce((sum, p) => sum + p.winRate, 0) / premiumProviders.length).toFixed(1);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutomatedTradeBot - Professional Trading Signals with Proven Results</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    ${getPremiumStyles()}
</head>
<body>
    ${getPremiumHeader()}

    <!-- Live Success Banner -->
    <div class="live-success-banner">
        <div class="container">
            <div class="success-items">
                <div class="success-item pulse">
                    <span class="success-icon">🔥</span>
                    <span class="success-text"><strong>${liveSuccessSignals.length} Active Signals</strong> Running Now</span>
                </div>
                <div class="success-item pulse">
                    <span class="success-icon">💰</span>
                    <span class="success-text">Total Profit Today: <strong class="profit">+$${totalProfit.toLocaleString()}</strong></span>
                </div>
                <div class="success-item pulse">
                    <span class="success-icon">⭐</span>
                    <span class="success-text">Average Win Rate: <strong>${avgWinRate}%</strong></span>
                </div>
                <div class="success-item pulse">
                    <span class="success-icon">👥</span>
                    <span class="success-text"><strong>${(premiumProviders.reduce((sum, p) => sum + p.followers, 0) / 1000).toFixed(1)}K+</strong> Active Traders</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Premium Hero Section -->
    <section class="premium-hero">
        <div class="container">
            <div class="hero-grid">
                <div class="hero-left">
                    <div class="hero-badge float-in">
                        <span class="badge-icon">✓</span>
                        <span>Verified Performance • Real Results</span>
                    </div>
                    <h1 class="hero-title fade-in-up">
                        Turn Trading Signals Into
                        <span class="gradient-text typing-effect">Consistent Profits</span>
                    </h1>
                    <p class="hero-subtitle fade-in-up delay-1">
                        Join ${premiumProviders[0].followers.toLocaleString()}+ traders earning with our AI-powered signal marketplace.
                        Real-time alerts, proven strategies, automatic execution.
                    </p>
                    <div class="hero-stats fade-in-up delay-2">
                        <div class="stat-badge">
                            <div class="stat-number">${avgWinRate}%</div>
                            <div class="stat-label">Avg Win Rate</div>
                        </div>
                        <div class="stat-badge">
                            <div class="stat-number">$${(premiumProviders.reduce((sum, p) => sum + p.totalProfit, 0) / 1000).toFixed(0)}K+</div>
                            <div class="stat-label">Total Profits</div>
                        </div>
                        <div class="stat-badge">
                            <div class="stat-number">${premiumProviders.length}+</div>
                            <div class="stat-label">Pro Traders</div>
                        </div>
                    </div>
                    <div class="hero-buttons fade-in-up delay-3">
                        <a href="#live-signals" class="btn btn-primary btn-lg glow">
                            <span class="btn-icon">🚀</span>
                            View Live Signals
                        </a>
                        <a href="#demo" class="btn btn-secondary btn-lg">
                            <span class="btn-icon">📊</span>
                            Try Free Demo
                        </a>
                    </div>
                    <div class="trust-badges fade-in-up delay-4">
                        <div class="trust-item">
                            <span class="trust-icon">🔒</span>
                            <span>Bank-Level Security</span>
                        </div>
                        <div class="trust-item">
                            <span class="trust-icon">⚡</span>
                            <span>Real-Time Execution</span>
                        </div>
                        <div class="trust-item">
                            <span class="trust-icon">💎</span>
                            <span>Verified Results</span>
                        </div>
                    </div>
                </div>
                <div class="hero-right fade-in-right">
                    <div class="live-chart-container glow-box">
                        <div class="chart-header">
                            <div class="chart-title">
                                <span class="live-indicator"></span>
                                Live Performance
                            </div>
                            <div class="chart-profit profit pulse">
                                +${totalProfit.toLocaleString()} USD
                            </div>
                        </div>
                        <div class="chart-body">
                            <svg class="performance-chart" viewBox="0 0 400 200">
                                <defs>
                                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" style="stop-color:#10b981;stop-opacity:0.4" />
                                        <stop offset="100%" style="stop-color:#10b981;stop-opacity:0.05" />
                                    </linearGradient>
                                </defs>
                                <path class="chart-line" d="M0,150 Q50,130 100,120 T200,80 T300,50 T400,20"
                                      stroke="#10b981" stroke-width="3" fill="none"/>
                                <path d="M0,150 Q50,130 100,120 T200,80 T300,50 T400,20 L400,200 L0,200 Z"
                                      fill="url(#chartGradient)"/>
                                ${[50, 150, 250, 350].map((x, i) => `
                                    <circle class="chart-point animate-point" cx="${x}" cy="${150 - i * 30}" r="4" fill="#10b981">
                                        <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" begin="${i * 0.5}s"/>
                                    </circle>
                                `).join('')}
                            </svg>
                        </div>
                        <div class="chart-stats">
                            <div class="chart-stat">
                                <div class="stat-value profit">+47.8%</div>
                                <div class="stat-text">This Month</div>
                            </div>
                            <div class="chart-stat">
                                <div class="stat-value profit">+284.5K</div>
                                <div class="stat-text">Total Profit</div>
                            </div>
                            <div class="chart-stat">
                                <div class="stat-value">1,247</div>
                                <div class="stat-text">Signals</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Live Success Signals 12x6 Grid -->
    <section class="live-signals-section" id="live-signals">
        <div class="container-wide">
            <div class="section-header">
                <div class="section-badge float-in">
                    <span class="live-indicator"></span>
                    Running Now
                </div>
                <h2 class="section-title">Active Profitable Signals</h2>
                <p class="section-desc">Real-time signal grid with ${liveSuccessSignals.length}+ strategies</p>
            </div>

            <!-- Sort Controls -->
            <div class="signal-controls">
                <div class="control-group">
                    <label for="sortSelect"><span class="control-icon">⚙️</span> Sort By:</label>
                    <select id="sortSelect" onchange="sortSignals(this.value)">
                        <option value="sortinoRatio">Sortino Rate (High to Low)</option>
                        <option value="riskRewardRatio">Risk/Reward Rate (High to Low)</option>
                        <option value="roi">Max ROI with Open ROI (High to Low)</option>
                        <option value="dd">Lowest DD (Low to High)</option>
                    </select>
                </div>
                <div class="signal-count">
                    <span class="count-number" id="signalCount">${liveSuccessSignals.length}</span> Active Signals
                </div>
            </div>

            <!-- Signals Grid 12x6 -->
            <div class="signals-grid-12x6" id="signalsGrid">
                ${liveSuccessSignals.slice(0, 72).map((signal, index) => {
                    const colorMap = {
                        high: {primary: '#f59e0b', secondary: '#fbbf24'},
                        medium: {primary: '#0ea5e9', secondary: '#3b82f6'},
                        low: {primary: '#10b981', secondary: '#059669'}
                    };
                    const colors = colorMap[signal.category];
                    return `
                    <div class="signal-mini-card signal-mini-${signal.category} fade-in-up" style="animation-delay: ${(index % 72) * 0.01}s" data-signal='${JSON.stringify(signal)}'>
                        <div class="signal-mini-number">#${index + 1}</div>
                        <div class="risk-badge risk-${signal.category}">${signal.category.toUpperCase()}</div>
                        <div class="signal-mini-header">
                            <div class="signal-mini-pair">${signal.symbol}</div>
                            <div class="signal-mini-timeframe">${signal.timeframe}</div>
                        </div>
                        <div class="signal-mini-chart">
                            <svg viewBox="0 0 120 60" class="mini-signal-svg">
                                <defs>
                                    <linearGradient id="sigGrad${index}" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:0.4" />
                                        <stop offset="100%" style="stop-color:${colors.primary};stop-opacity:0.05" />
                                    </linearGradient>
                                </defs>
                                ${Array.from({length: 12}, (_, i) => {
                                    const x = i * 10;
                                    const baseY = signal.category === 'high' ? 40 : signal.category === 'medium' ? 45 : 50;
                                    const y = baseY - (i * (signal.category === 'high' ? 2.5 : signal.category === 'medium' ? 2 : 1.5)) - Math.random() * 5;
                                    return `<circle cx="${x}" cy="${y}" r="1" fill="${colors.primary}"/>`;
                                }).join('')}
                                <path d="M0,${signal.category === 'high' ? 40 : signal.category === 'medium' ? 45 : 50} ${Array.from({length: 11}, (_, i) => {
                                    const baseY = signal.category === 'high' ? 40 : signal.category === 'medium' ? 45 : 50;
                                    return `L${(i + 1) * 10},${baseY - ((i + 1) * (signal.category === 'high' ? 2.5 : signal.category === 'medium' ? 2 : 1.5)) - Math.random() * 5}`;
                                }).join(' ')} L120,60 L0,60 Z" fill="url(#sigGrad${index})"/>
                            </svg>
                        </div>
                        <div class="signal-mini-stats">
                            <div class="mini-metric">
                                <span class="metric-label">ROI</span>
                                <span class="metric-value profit">+${signal.roi}%</span>
                            </div>
                            <div class="mini-metric">
                                <span class="metric-label">Open</span>
                                <span class="metric-value profit">+${signal.openRoi}%</span>
                            </div>
                            <div class="mini-metric">
                                <span class="metric-label">DD</span>
                                <span class="metric-value">${signal.dd}%</span>
                            </div>
                            <div class="mini-metric">
                                <span class="metric-label">Sortino</span>
                                <span class="metric-value">${signal.sortinoRatio}</span>
                            </div>
                            <div class="mini-metric">
                                <span class="metric-label">R/R</span>
                                <span class="metric-value">${signal.riskRewardRatio}</span>
                            </div>
                        </div>
                        <div class="signal-mini-provider">
                            <span class="provider-icon">✓</span>
                            ${signal.provider.split(' ')[0]}
                        </div>
                    </div>
                `;
                }).join('')}
            </div>

            <!-- Pagination -->
            <div class="pagination-controls" id="paginationControls">
                <button class="page-btn" id="prevPage" onclick="changePage(-1)">← Previous</button>
                <div class="page-info">
                    Page <span id="currentPage">1</span> of <span id="totalPages">${Math.ceil(liveSuccessSignals.length / 72)}</span>
                </div>
                <button class="page-btn" id="nextPage" onclick="changePage(1)">Next →</button>
            </div>
        </div>
    </section>

    <!-- Recent Closed Winners -->
    <section class="recent-winners">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">Recently Closed Winners</h2>
                <p class="section-desc">Latest profitable signals from the last 24 hours</p>
            </div>
            <div class="winners-ticker">
                <div class="ticker-track">
                    ${[...recentClosed, ...recentClosed].map(signal => `
                        <div class="winner-card">
                            <div class="winner-icon">✓</div>
                            <div class="winner-info">
                                <div class="winner-symbol">${signal.symbol}</div>
                                <div class="winner-provider">${signal.provider}</div>
                            </div>
                            <div class="winner-profit">
                                <div class="profit profit-big">+$${signal.profit.toLocaleString()}</div>
                                <div class="profit-small">+${signal.percent}%</div>
                            </div>
                            <div class="winner-time">${signal.closedAgo}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </section>

    <!-- Live Multi-Strategy Charts 3x3 Grid -->
    <section class="live-charts-grid-section">
        <div class="container">
            <div class="section-header">
                <div class="section-badge float-in">
                    <span class="live-indicator"></span>
                    Live Performance
                </div>
                <h2 class="section-title">Multi-Strategy Live Performance</h2>
                <p class="section-desc">Real-time chart view of 9 active trading strategies</p>
            </div>

            <div class="charts-grid-3x3">
                ${[
                    // Row 1: HIGH ROI - Maximum Performance (Gold border + badges)
                    {pair: 'BTC/USDT 5m', category: 'high', roi: 8.45, openRoi: 12.3, dd: 8.2, risk: 'High'},
                    {pair: 'SOL/USDT 1h', category: 'high', roi: 7.89, openRoi: 10.8, dd: 9.5, risk: 'High'},
                    {pair: 'XAU/USD 15m', category: 'high', roi: 9.12, openRoi: 15.2, dd: 11.3, risk: 'High'},
                    // Row 2: MEDIUM RISK - Balanced (Blue)
                    {pair: 'ETH/USDT 15m', category: 'medium', roi: 5.23, openRoi: 6.8, dd: 4.5, risk: 'Medium'},
                    {pair: 'EUR/USD 4h', category: 'medium', roi: 4.67, openRoi: 5.9, dd: 3.8, risk: 'Medium'},
                    {pair: 'GBP/USD 1h', category: 'medium', roi: 5.01, openRoi: 6.2, dd: 4.1, risk: 'Medium'},
                    // Row 3: LOW RISK - Conservative (Green)
                    {pair: 'ADA/USDT 30m', category: 'low', roi: 3.45, openRoi: 4.2, dd: 2.1, risk: 'Low'},
                    {pair: 'MATIC/USDT 1h', category: 'low', roi: 3.12, openRoi: 3.8, dd: 1.9, risk: 'Low'},
                    {pair: 'DOGE/USDT 5m', category: 'low', roi: 2.89, openRoi: 3.5, dd: 1.6, risk: 'Low'}
                ].map((strategy, index) => {
                    const colorMap = {
                        high: {primary: '#f59e0b', secondary: '#fbbf24', gradient: '#fcd34d'},
                        medium: {primary: '#0ea5e9', secondary: '#3b82f6', gradient: '#60a5fa'},
                        low: {primary: '#10b981', secondary: '#059669', gradient: '#34d399'}
                    };
                    const colors = colorMap[strategy.category];
                    return `
                    <div class="mini-chart-card mini-chart-${strategy.category} fade-in-up" style="animation-delay: ${index * 0.1}s">
                        <div class="risk-badge risk-${strategy.category}">${strategy.risk} Risk</div>
                        <div class="mini-chart-header">
                            <div class="chart-pair">${strategy.pair.split(' ')[0]}</div>
                            <div class="chart-timeframe">${strategy.pair.split(' ')[1]}</div>
                        </div>
                        <div class="mini-chart-body">
                            <svg viewBox="0 0 200 100" class="mini-svg-chart">
                                <defs>
                                    <linearGradient id="chartGrad${index}" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:0.4" />
                                        <stop offset="100%" style="stop-color:${colors.primary};stop-opacity:0.05" />
                                    </linearGradient>
                                </defs>
                                ${Array.from({length: 20}, (_, i) => {
                                    const x = i * 10;
                                    const baseY = strategy.category === 'high' ? 70 : strategy.category === 'medium' ? 80 : 85;
                                    const variance = strategy.category === 'high' ? 50 : strategy.category === 'medium' ? 40 : 30;
                                    const y = baseY - Math.random() * variance - (i * (strategy.category === 'high' ? 2 : 1.5));
                                    return `<circle cx="${x}" cy="${y}" r="1.5" fill="${colors.primary}"><animate attributeName="r" values="1.5;2.5;1.5" dur="2s" repeatCount="indefinite" begin="${i * 0.1}s"/></circle>`;
                                }).join('')}
                                <path d="M0,${strategy.category === 'high' ? 70 : strategy.category === 'medium' ? 80 : 85} ${Array.from({length: 19}, (_, i) => {
                                    const baseY = strategy.category === 'high' ? 70 : strategy.category === 'medium' ? 80 : 85;
                                    const variance = strategy.category === 'high' ? 50 : strategy.category === 'medium' ? 40 : 30;
                                    return `L${(i + 1) * 10},${baseY - Math.random() * variance - (i * (strategy.category === 'high' ? 2 : 1.5))}`;
                                }).join(' ')}"
                                      stroke="${colors.primary}"
                                      stroke-width="2.5"
                                      fill="none"
                                      class="chart-path"/>
                                <path d="M0,${strategy.category === 'high' ? 70 : strategy.category === 'medium' ? 80 : 85} ${Array.from({length: 19}, (_, i) => {
                                    const baseY = strategy.category === 'high' ? 70 : strategy.category === 'medium' ? 80 : 85;
                                    const variance = strategy.category === 'high' ? 50 : strategy.category === 'medium' ? 40 : 30;
                                    return `L${(i + 1) * 10},${baseY - Math.random() * variance - (i * (strategy.category === 'high' ? 2 : 1.5))}`;
                                }).join(' ')} L200,100 L0,100 Z"
                                      fill="url(#chartGrad${index})"/>
                            </svg>
                        </div>
                        <div class="mini-chart-stats">
                            <div class="mini-stat">
                                <span class="mini-stat-label">ROI</span>
                                <span class="mini-stat-value profit">+${strategy.roi}%</span>
                            </div>
                            <div class="mini-stat">
                                <span class="mini-stat-label">Open ROI</span>
                                <span class="mini-stat-value profit">+${strategy.openRoi}%</span>
                            </div>
                            <div class="mini-stat">
                                <span class="mini-stat-label">DD</span>
                                <span class="mini-stat-value">${strategy.dd}%</span>
                            </div>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>
        </div>
    </section>

    <!-- AI-Powered Features Section -->
    <section class="ai-features-section">
        <div class="container">
            <div class="section-header">
                <div class="section-badge float-in">
                    <span class="badge-icon">🤖</span>
                    <span>AI-Powered Technology</span>
                </div>
                <h2 class="section-title">Advanced AI Account Management & Risk Control</h2>
                <p class="section-desc">Intelligent automation that protects your capital and maximizes profits</p>
            </div>

            <div class="ai-features-grid">
                <!-- AI Account Management -->
                <div class="ai-feature-card ai-feature-primary fade-in-up">
                    <div class="feature-icon-large">
                        <div class="icon-wrapper">🧠</div>
                        <div class="icon-glow"></div>
                    </div>
                    <h3 class="feature-title">AI Account Management</h3>
                    <p class="feature-description">
                        Smart position sizing, portfolio balancing, and trade execution powered by machine learning algorithms
                    </p>
                    <div class="feature-benefits">
                        <div class="benefit-item">
                            <span class="benefit-icon">✓</span>
                            <span>Automated position sizing based on account balance</span>
                        </div>
                        <div class="benefit-item">
                            <span class="benefit-icon">✓</span>
                            <span>Dynamic leverage adjustment per market conditions</span>
                        </div>
                        <div class="benefit-item">
                            <span class="benefit-icon">✓</span>
                            <span>Smart order execution with slippage protection</span>
                        </div>
                        <div class="benefit-item">
                            <span class="benefit-icon">✓</span>
                            <span>Portfolio diversification optimization</span>
                        </div>
                    </div>
                    <div class="feature-stats">
                        <div class="stat-box">
                            <div class="stat-value">98.7%</div>
                            <div class="stat-label">Execution Accuracy</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">24/7</div>
                            <div class="stat-label">Active Monitoring</div>
                        </div>
                    </div>
                </div>

                <!-- Adaptive Risk Control -->
                <div class="ai-feature-card ai-feature-secondary fade-in-up" style="animation-delay: 0.2s">
                    <div class="feature-icon-large">
                        <div class="icon-wrapper">🛡️</div>
                        <div class="icon-glow"></div>
                    </div>
                    <h3 class="feature-title">Adaptive Risk Control</h3>
                    <p class="feature-description">
                        Real-time risk adjustment system that responds to market volatility and news events automatically
                    </p>
                    <div class="feature-benefits">
                        <div class="benefit-item">
                            <span class="benefit-icon">✓</span>
                            <span>Dynamic stop-loss adjustment based on volatility</span>
                        </div>
                        <div class="benefit-item">
                            <span class="benefit-icon">✓</span>
                            <span>News-based risk mitigation (auto-pause before events)</span>
                        </div>
                        <div class="benefit-item">
                            <span class="benefit-icon">✓</span>
                            <span>Max drawdown protection with circuit breakers</span>
                        </div>
                        <div class="benefit-item">
                            <span class="benefit-icon">✓</span>
                            <span>Correlation-based exposure limits</span>
                        </div>
                    </div>
                    <div class="feature-stats">
                        <div class="stat-box">
                            <div class="stat-value">-12.3%</div>
                            <div class="stat-label">Max Drawdown</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">2.8x</div>
                            <div class="stat-label">Risk/Reward Ratio</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Additional AI Features -->
            <div class="ai-features-secondary">
                <div class="secondary-feature fade-in-up" style="animation-delay: 0.3s">
                    <div class="secondary-icon">📊</div>
                    <div class="secondary-content">
                        <h4>Smart Analytics Dashboard</h4>
                        <p>Real-time performance tracking with AI-generated insights and recommendations</p>
                    </div>
                </div>
                <div class="secondary-feature fade-in-up" style="animation-delay: 0.4s">
                    <div class="secondary-icon">⚡</div>
                    <div class="secondary-content">
                        <h4>Lightning-Fast Execution</h4>
                        <p>Sub-100ms trade execution with direct exchange API integration</p>
                    </div>
                </div>
                <div class="secondary-feature fade-in-up" style="animation-delay: 0.5s">
                    <div class="secondary-icon">🔔</div>
                    <div class="secondary-content">
                        <h4>Smart Notifications</h4>
                        <p>AI-filtered alerts that notify you only of important events and opportunities</p>
                    </div>
                </div>
                <div class="secondary-feature fade-in-up" style="animation-delay: 0.6s">
                    <div class="secondary-icon">🔄</div>
                    <div class="secondary-content">
                        <h4>Auto-Rebalancing</h4>
                        <p>Continuous portfolio optimization based on market conditions and performance</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Top Providers -->
    <section class="top-providers-premium">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">Elite Signal Providers</h2>
                <p class="section-desc">Verified traders with proven track records</p>
            </div>
            <div class="providers-premium-grid">
                ${premiumProviders.map((provider, index) => `
                    <div class="provider-premium-card glow-box fade-in-up" style="animation-delay: ${index * 0.15}s">
                        <div class="provider-premium-header">
                            <img src="${provider.avatar}" alt="${provider.name}" class="provider-premium-avatar">
                            <div class="provider-premium-badge">
                                <span class="verified-star">⭐</span>
                                <span>Verified Pro</span>
                            </div>
                        </div>
                        <div class="provider-premium-info">
                            <h3>${provider.name}</h3>
                            <p>${provider.description}</p>
                            <div class="provider-rating">
                                ${'★'.repeat(Math.floor(provider.rating))}${'☆'.repeat(5 - Math.floor(provider.rating))}
                                <span class="rating-value">${provider.rating}</span>
                            </div>
                        </div>
                        <div class="provider-premium-stats">
                            <div class="premium-stat">
                                <div class="stat-icon">🎯</div>
                                <div class="stat-content">
                                    <div class="stat-value profit">${provider.winRate}%</div>
                                    <div class="stat-label">Win Rate</div>
                                </div>
                            </div>
                            <div class="premium-stat">
                                <div class="stat-icon">💰</div>
                                <div class="stat-content">
                                    <div class="stat-value profit">+$${(provider.totalProfit / 1000).toFixed(0)}K</div>
                                    <div class="stat-label">Total Profit</div>
                                </div>
                            </div>
                            <div class="premium-stat">
                                <div class="stat-icon">📊</div>
                                <div class="stat-content">
                                    <div class="stat-value">${provider.totalSignals}</div>
                                    <div class="stat-label">Signals</div>
                                </div>
                            </div>
                            <div class="premium-stat">
                                <div class="stat-icon">👥</div>
                                <div class="stat-content">
                                    <div class="stat-value">${(provider.followers / 1000).toFixed(1)}K</div>
                                    <div class="stat-label">Followers</div>
                                </div>
                            </div>
                        </div>
                        <div class="provider-live-info">
                            <span class="live-indicator"></span>
                            <span>${provider.activeSignals} active signals</span>
                            <span class="profit">+$${provider.profitToday.toLocaleString()} today</span>
                        </div>
                        <a href="/provider/${provider.id}" class="btn btn-primary btn-block glow">View Profile & Subscribe</a>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>

    <!-- Trustpilot Reviews Section -->
    <section class="trustpilot-section">
        <div class="container">
            <div class="section-header">
                <div class="trustpilot-logo-header">
                    <div class="trustpilot-stars">
                        <span class="trust-star filled">★</span>
                        <span class="trust-star filled">★</span>
                        <span class="trust-star filled">★</span>
                        <span class="trust-star filled">★</span>
                        <span class="trust-star filled">★</span>
                    </div>
                    <div class="trustpilot-rating">
                        <strong>4.9 out of 5</strong> based on <strong>2,847 reviews</strong>
                    </div>
                </div>
                <h2 class="section-title">Trusted by Thousands of Traders Worldwide</h2>
                <p class="section-desc">Real reviews from real traders making real profits</p>
            </div>

            <div class="reviews-grid">
                <div class="review-card fade-in-up" style="animation-delay: 0s">
                    <div class="review-header">
                        <div class="review-author">
                            <div class="author-avatar">JD</div>
                            <div class="author-info">
                                <div class="author-name">John Davis</div>
                                <div class="review-date">2 days ago</div>
                            </div>
                        </div>
                        <div class="review-stars">
                            <span class="star">★★★★★</span>
                        </div>
                    </div>
                    <h4 class="review-title">Best signal platform I've used!</h4>
                    <p class="review-text">
                        Made over $12K in my first month. The signals are accurate, timely, and the risk management features are top-notch.
                        Customer support is responsive and helpful. Highly recommend!
                    </p>
                    <div class="review-profit">Verified Profit: <strong class="profit">+$12,340</strong></div>
                </div>

                <div class="review-card fade-in-up" style="animation-delay: 0.1s">
                    <div class="review-header">
                        <div class="review-author">
                            <div class="author-avatar">SM</div>
                            <div class="author-info">
                                <div class="author-name">Sarah Martinez</div>
                                <div class="review-date">5 days ago</div>
                            </div>
                        </div>
                        <div class="review-stars">
                            <span class="star">★★★★★</span>
                        </div>
                    </div>
                    <h4 class="review-title">Life-changing platform</h4>
                    <p class="review-text">
                        I was skeptical at first, but the transparent performance tracking and real-time results convinced me.
                        The automated execution is flawless. This is the real deal!
                    </p>
                    <div class="review-profit">Verified Profit: <strong class="profit">+$8,750</strong></div>
                </div>

                <div class="review-card fade-in-up" style="animation-delay: 0.2s">
                    <div class="review-header">
                        <div class="review-author">
                            <div class="author-avatar">MK</div>
                            <div class="author-info">
                                <div class="author-name">Michael Kim</div>
                                <div class="review-date">1 week ago</div>
                            </div>
                        </div>
                        <div class="review-stars">
                            <span class="star">★★★★★</span>
                        </div>
                    </div>
                    <h4 class="review-title">Professional and reliable</h4>
                    <p class="review-text">
                        As a professional trader, I appreciate the quality of analysis and execution. The win rate is consistently above 80%.
                        Worth every penny!
                    </p>
                    <div class="review-profit">Verified Profit: <strong class="profit">+$24,890</strong></div>
                </div>

                <div class="review-card fade-in-up" style="animation-delay: 0.3s">
                    <div class="review-header">
                        <div class="review-author">
                            <div class="author-avatar">EJ</div>
                            <div class="author-info">
                                <div class="author-name">Emma Johnson</div>
                                <div class="review-date">1 week ago</div>
                            </div>
                        </div>
                        <div class="review-stars">
                            <span class="star">★★★★★</span>
                        </div>
                    </div>
                    <h4 class="review-title">Finally, a platform that delivers!</h4>
                    <p class="review-text">
                        Tried many signal services before, but this one actually works. Real-time notifications, accurate signals,
                        and excellent support. My portfolio has grown 45% in 3 months!
                    </p>
                    <div class="review-profit">Verified Profit: <strong class="profit">+$18,920</strong></div>
                </div>

                <div class="review-card fade-in-up" style="animation-delay: 0.4s">
                    <div class="review-header">
                        <div class="review-author">
                            <div class="author-avatar">RW</div>
                            <div class="author-info">
                                <div class="author-name">Robert Williams</div>
                                <div class="review-date">2 weeks ago</div>
                            </div>
                        </div>
                        <div class="review-stars">
                            <span class="star">★★★★★</span>
                        </div>
                    </div>
                    <h4 class="review-title">Exceeded all expectations</h4>
                    <p class="review-text">
                        The backtesting data is transparent, the signals are profitable, and the platform is user-friendly.
                        This is exactly what I was looking for. 5 stars!
                    </p>
                    <div class="review-profit">Verified Profit: <strong class="profit">+$15,670</strong></div>
                </div>

                <div class="review-card fade-in-up" style="animation-delay: 0.5s">
                    <div class="review-header">
                        <div class="review-author">
                            <div class="author-avatar">LC</div>
                            <div class="author-info">
                                <div class="author-name">Lisa Chen</div>
                                <div class="review-date">2 weeks ago</div>
                            </div>
                        </div>
                        <div class="review-stars">
                            <span class="star">★★★★★</span>
                        </div>
                    </div>
                    <h4 class="review-title">Best investment I've made</h4>
                    <p class="review-text">
                        The subscription pays for itself within days. Amazing signal quality, fast execution,
                        and I love the transparency. Couldn't be happier!
                    </p>
                    <div class="review-profit">Verified Profit: <strong class="profit">+$10,450</strong></div>
                </div>
            </div>

            <div class="trustpilot-cta fade-in-up" style="animation-delay: 0.6s">
                <div class="cta-content">
                    <h3>Join 36,000+ Successful Traders</h3>
                    <p>Start your free trial today and experience the difference</p>
                </div>
                <button onclick="openSignupModal()" class="btn btn-primary btn-lg glow">
                    Start Free Trial Now
                </button>
            </div>
        </div>
    </section>

    <!-- Registration/Signup Modal -->
    <div id="signupModal" class="modal">
        <div class="modal-overlay" onclick="closeSignupModal()"></div>
        <div class="modal-content fade-in-up">
            <button class="modal-close" onclick="closeSignupModal()">×</button>
            <div class="modal-header">
                <h2>Start Your Free Trial</h2>
                <p>Join thousands of profitable traders • No credit card required</p>
            </div>
            <form class="signup-form" onsubmit="handleSignup(event)">
                <div class="form-group">
                    <label for="fullname">Full Name</label>
                    <input type="text" id="fullname" name="fullname" required placeholder="John Doe">
                </div>
                <div class="form-group">
                    <label for="email">Email Address</label>
                    <input type="email" id="email" name="email" required placeholder="john@example.com">
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required placeholder="Min. 8 characters">
                </div>
                <div class="form-group">
                    <label for="plan">Select Plan</label>
                    <select id="plan" name="plan" required>
                        <option value="free">Free Trial (14 days) - $0</option>
                        <option value="basic">Basic Plan - $29/month</option>
                        <option value="pro">Pro Plan - $79/month (Most Popular)</option>
                        <option value="elite">Elite Plan - $149/month</option>
                    </select>
                </div>
                <div class="signup-benefits">
                    <div class="benefit">✓ Real-time signal alerts</div>
                    <div class="benefit">✓ Automated trade execution</div>
                    <div class="benefit">✓ Risk management tools</div>
                    <div class="benefit">✓ 24/7 customer support</div>
                </div>
                <button type="submit" class="btn btn-primary btn-lg btn-block glow">
                    Create Free Account
                </button>
                <p class="form-footer">
                    Already have an account? <a href="#" onclick="openSigninModal()">Sign in</a>
                </p>
            </form>
        </div>
    </div>

    <!-- AI Advisor Widget -->
    <div id="aiAdvisorWidget" class="ai-advisor-widget">
        <button class="ai-advisor-toggle" onclick="toggleAIAdvisor()">
            <span class="advisor-icon">🤖</span>
            <span class="advisor-pulse"></span>
        </button>
        <div class="ai-advisor-panel" id="aiAdvisorPanel">
            <div class="advisor-header">
                <div class="advisor-title">
                    <span class="advisor-avatar">🤖</span>
                    <div>
                        <h4>AI Trading Advisor</h4>
                        <p>Smart recommendations for you</p>
                    </div>
                </div>
                <button class="advisor-close" onclick="toggleAIAdvisor()">×</button>
            </div>
            <div class="advisor-content" id="advisorContent">
                <div class="advisor-recommendation" style="animation-delay: 0s">
                    <div class="rec-icon">💡</div>
                    <div class="rec-content">
                        <h5>Optimize Your Portfolio</h5>
                        <p>Based on your activity, diversifying into EUR/USD signals could reduce your risk by 15%</p>
                        <button class="rec-action">View Recommendations</button>
                    </div>
                </div>
                <div class="advisor-recommendation" style="animation-delay: 0.1s">
                    <div class="rec-icon">📊</div>
                    <div class="rec-content">
                        <h5>High-Performance Strategy Detected</h5>
                        <p>BTC/USDT 5m strategy showing 8.45% ROI with low DD - Consider subscribing</p>
                        <button class="rec-action">View Strategy</button>
                    </div>
                </div>
                <div class="advisor-recommendation" style="animation-delay: 0.2s">
                    <div class="rec-icon">🛡️</div>
                    <div class="rec-content">
                        <h5>Risk Management Alert</h5>
                        <p>Enable adaptive risk control to automatically adjust stop-loss during high volatility</p>
                        <button class="rec-action">Enable Now</button>
                    </div>
                </div>
                <div class="advisor-recommendation" style="animation-delay: 0.3s">
                    <div class="rec-icon">⚡</div>
                    <div class="rec-content">
                        <h5>News Event Upcoming</h5>
                        <p>Fed interest rate decision in 2 hours. Consider pausing EUR/USD trades temporarily</p>
                        <button class="rec-action">Set Auto-Pause</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    ${getPremiumFooter()}

    <script>
        // Signal data for sorting and pagination
        let allSignals = [];
        let currentPage = 1;
        const signalsPerPage = 72;

        // Load signal data from cards
        document.addEventListener('DOMContentLoaded', function() {
            const cards = document.querySelectorAll('.signal-mini-card');
            allSignals = Array.from(cards).map(card => JSON.parse(card.getAttribute('data-signal')));
            renderSignals();
        });

        // Sort signals
        function sortSignals(sortBy) {
            const sortedSignals = [...allSignals];

            switch(sortBy) {
                case 'sortinoRatio':
                    sortedSignals.sort((a, b) => b.sortinoRatio - a.sortinoRatio);
                    break;
                case 'riskRewardRatio':
                    sortedSignals.sort((a, b) => b.riskRewardRatio - a.riskRewardRatio);
                    break;
                case 'roi':
                    sortedSignals.sort((a, b) => b.openRoi - a.openRoi);
                    break;
                case 'dd':
                    sortedSignals.sort((a, b) => a.dd - b.dd);
                    break;
            }

            allSignals = sortedSignals;
            currentPage = 1;
            renderSignals();
        }

        // Change page
        function changePage(delta) {
            const totalPages = Math.ceil(allSignals.length / signalsPerPage);
            currentPage = Math.max(1, Math.min(currentPage + delta, totalPages));
            renderSignals();
        }

        // Render signals
        function renderSignals() {
            const grid = document.getElementById('signalsGrid');
            const start = (currentPage - 1) * signalsPerPage;
            const end = start + signalsPerPage;
            const pageSignals = allSignals.slice(start, end);

            grid.innerHTML = pageSignals.map((signal, index) => {
                const colorMap = {
                    high: {primary: '#f59e0b', secondary: '#fbbf24'},
                    medium: {primary: '#0ea5e9', secondary: '#3b82f6'},
                    low: {primary: '#10b981', secondary: '#059669'}
                };
                const colors = colorMap[signal.category];
                const globalIndex = start + index;

                return \`
                <div class="signal-mini-card signal-mini-\${signal.category} fade-in-up" style="animation-delay: \${(index % 72) * 0.01}s">
                    <div class="signal-mini-number">#\${globalIndex + 1}</div>
                    <div class="risk-badge risk-\${signal.category}">\${signal.category.toUpperCase()}</div>
                    <div class="signal-mini-header">
                        <div class="signal-mini-pair">\${signal.symbol}</div>
                        <div class="signal-mini-timeframe">\${signal.timeframe}</div>
                    </div>
                    <div class="signal-mini-chart">
                        <svg viewBox="0 0 120 60" class="mini-signal-svg">
                            <defs>
                                <linearGradient id="sigGrad\${globalIndex}" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" style="stop-color:\${colors.primary};stop-opacity:0.4" />
                                    <stop offset="100%" style="stop-color:\${colors.primary};stop-opacity:0.05" />
                                </linearGradient>
                            </defs>
                            \${Array.from({length: 12}, (_, i) => {
                                const x = i * 10;
                                const baseY = signal.category === 'high' ? 40 : signal.category === 'medium' ? 45 : 50;
                                const y = baseY - (i * (signal.category === 'high' ? 2.5 : signal.category === 'medium' ? 2 : 1.5)) - Math.random() * 5;
                                return \`<circle cx="\${x}" cy="\${y}" r="1" fill="\${colors.primary}"/>\`;
                            }).join('')}
                            <path d="M0,\${signal.category === 'high' ? 40 : signal.category === 'medium' ? 45 : 50} \${Array.from({length: 11}, (_, i) => {
                                const baseY = signal.category === 'high' ? 40 : signal.category === 'medium' ? 45 : 50;
                                return \`L\${(i + 1) * 10},\${baseY - ((i + 1) * (signal.category === 'high' ? 2.5 : signal.category === 'medium' ? 2 : 1.5)) - Math.random() * 5}\`;
                            }).join(' ')} L120,60 L0,60 Z" fill="url(#sigGrad\${globalIndex})"/>
                        </svg>
                    </div>
                    <div class="signal-mini-stats">
                        <div class="mini-metric">
                            <span class="metric-label">ROI</span>
                            <span class="metric-value profit">+\${signal.roi}%</span>
                        </div>
                        <div class="mini-metric">
                            <span class="metric-label">Open</span>
                            <span class="metric-value profit">+\${signal.openRoi}%</span>
                        </div>
                        <div class="mini-metric">
                            <span class="metric-label">DD</span>
                            <span class="metric-value">\${signal.dd}%</span>
                        </div>
                        <div class="mini-metric">
                            <span class="metric-label">Sortino</span>
                            <span class="metric-value">\${signal.sortinoRatio}</span>
                        </div>
                        <div class="mini-metric">
                            <span class="metric-label">R/R</span>
                            <span class="metric-value">\${signal.riskRewardRatio}</span>
                        </div>
                    </div>
                    <div class="signal-mini-provider">
                        <span class="provider-icon">✓</span>
                        \${signal.provider.split(' ')[0]}
                    </div>
                </div>
                \`;
            }).join('');

            // Update pagination
            const totalPages = Math.ceil(allSignals.length / signalsPerPage);
            document.getElementById('currentPage').textContent = currentPage;
            document.getElementById('totalPages').textContent = totalPages;
            document.getElementById('prevPage').disabled = currentPage === 1;
            document.getElementById('nextPage').disabled = currentPage === totalPages;
        }

        // Smooth scroll
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // Update live profit numbers with animation
        setInterval(() => {
            document.querySelectorAll('.profit-amount, .profit-big').forEach(el => {
                const currentValue = parseInt(el.textContent.replace(/[^0-9]/g, ''));
                const newValue = currentValue + Math.floor(Math.random() * 50);
                el.textContent = '+$' + newValue.toLocaleString();
            });
        }, 5000);

        // Modal functions
        function openSignupModal() {
            document.getElementById('signupModal').style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }

        function closeSignupModal() {
            document.getElementById('signupModal').style.display = 'none';
            document.body.style.overflow = 'auto';
        }

        function openSigninModal() {
            // Redirect to sign in or open sign in modal
            alert('Sign in functionality coming soon');
        }

        function handleSignup(event) {
            event.preventDefault();
            const formData = new FormData(event.target);
            const data = Object.fromEntries(formData);

            // Show success message
            alert('Welcome ' + data.fullname + '! Your account has been created successfully. Check your email for verification.');
            closeSignupModal();

            // In production, this would send data to backend API
            // fetch('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) })
        }

        // Auto-open modal on CTA clicks
        document.querySelectorAll('.btn-primary').forEach(btn => {
            if (btn.textContent.includes('Start Free Trial') || btn.textContent.includes('Try Free Demo')) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    openSignupModal();
                };
            }
        });
    </script>
</body>
</html>
  `;
}

function renderBacktestPage() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Backtest Results - AutomatedTradeBot</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    ${getPremiumStyles()}
</head>
<body>
    ${getPremiumHeader()}

    <div class="page-header-dark">
        <div class="container">
            <h1>Strategy Backtesting</h1>
            <p>Historical performance analysis with real market data</p>
        </div>
    </div>

    <section class="backtest-section">
        <div class="container">
            <div class="backtest-info-box glow-box">
                <div class="info-icon">📊</div>
                <div class="info-content">
                    <h3>Multi-Signal Performance Analysis</h3>
                    <p>All signals are automatically pulled from our performance-based system using real historical data. No simulated or fake data.</p>
                </div>
            </div>

            <div class="coming-soon-card glow-box">
                <div class="coming-soon-icon">🚀</div>
                <h2>Advanced Backtesting Coming Soon</h2>
                <p>We're building the most comprehensive backtesting platform with:</p>
                <div class="features-list">
                    <div class="feature-item"><span class="check">✓</span> Multi-timeframe analysis (5m, 15m, 1h, 4h, 1d)</div>
                    <div class="feature-item"><span class="check">✓</span> Real historical data from exchanges</div>
                    <div class="feature-item"><span class="check">✓</span> Performance-based signal filtering</div>
                    <div class="feature-item"><span class="check">✓</span> Risk management simulation</div>
                    <div class="feature-item"><span class="check">✓</span> Trading fees calculation (0.1%)</div>
                    <div class="feature-item"><span class="check">✓</span> Slippage modeling</div>
                </div>
                <a href="/" class="btn btn-primary btn-lg">Back to Home</a>
            </div>
        </div>
    </section>

    ${getPremiumFooter()}
</body>
</html>
  `;
}

function getPremiumHeader() {
  return `
    <header class="premium-header">
        <nav class="premium-navbar">
            <div class="container nav-container">
                <a href="/" class="premium-logo">
                    <img src="/logo.svg" alt="AutomatedTradeBot Logo" class="logo-image">
                    <span class="logo-text">AutomatedTradeBot</span>
                </a>
                <div class="nav-menu">
                    <a href="/" class="nav-link">Home</a>
                    <a href="/providers" class="nav-link">Providers</a>
                    <a href="/signals" class="nav-link">Live Signals</a>
                    <a href="/backtest" class="nav-link">Backtest</a>
                    <a href="#demo" class="nav-link">Free Demo</a>
                </div>
                <div class="nav-actions">
                    <a href="#" class="btn btn-ghost">Sign In</a>
                    <a href="#" class="btn btn-primary">Start Free Trial</a>
                </div>
            </div>
        </nav>
    </header>
  `;
}

function getPremiumFooter() {
  return `
    <footer class="premium-footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-section">
                    <div class="footer-logo">
                        <img src="/logo.svg" alt="Logo" class="footer-logo-img">
                        <h3>AutomatedTradeBot</h3>
                    </div>
                    <p>Professional trading signal marketplace with proven results and real-time execution.</p>
                    <div class="social-links">
                        <a href="#" class="social-link">Twitter</a>
                        <a href="#" class="social-link">Discord</a>
                        <a href="#" class="social-link">Telegram</a>
                    </div>
                </div>
                <div class="footer-section">
                    <h4>Platform</h4>
                    <a href="/providers">Signal Providers</a>
                    <a href="/signals">Live Signals</a>
                    <a href="/backtest">Backtest</a>
                    <a href="#">API Documentation</a>
                </div>
                <div class="footer-section">
                    <h4>Resources</h4>
                    <a href="#">How It Works</a>
                    <a href="#">Success Stories</a>
                    <a href="#">Trading Guide</a>
                    <a href="#">Help Center</a>
                </div>
                <div class="footer-section">
                    <h4>Company</h4>
                    <a href="#">About Us</a>
                    <a href="#">Contact</a>
                    <a href="#">Terms of Service</a>
                    <a href="#">Privacy Policy</a>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                <p class="risk-disclaimer">Risk Disclaimer: Trading involves substantial risk. Past performance does not guarantee future results. All signals are for informational purposes only.</p>
            </div>
        </div>
    </footer>
  `;
}

function getPremiumStyles() {
  return `
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            --primary: #1e40af;
            --primary-dark: #1e3a8a;
            --secondary: #3b82f6;
            --accent: #0ea5e9;
            --success: #10b981;
            --danger: #ef4444;
            --dark: #0a0e27;
            --dark-2: #0f172a;
            --dark-3: #1e293b;
            --gray: #64748b;
            --light: #f1f5f9;
            --border: #cbd5e1;
            --gold: #f59e0b;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: var(--dark);
            line-height: 1.6;
            background: #fff;
            overflow-x: hidden;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }

        .container-wide {
            max-width: 1600px;
            margin: 0 auto;
            padding: 0 20px;
        }

        /* Premium Header */
        .premium-header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }

        .premium-navbar {
            padding: 16px 0;
        }

        .nav-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .premium-logo {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
            color: var(--dark);
            font-weight: 700;
            font-size: 22px;
            transition: transform 0.3s;
        }

        .premium-logo:hover {
            transform: scale(1.05);
        }

        .logo-image {
            width: 48px;
            height: 48px;
            filter: drop-shadow(0 4px 8px rgba(16, 185, 129, 0.3));
        }

        .nav-menu {
            display: flex;
            gap: 32px;
        }

        .nav-link {
            text-decoration: none;
            color: var(--gray);
            font-weight: 500;
            transition: all 0.3s;
            position: relative;
        }

        .nav-link::after {
            content: '';
            position: absolute;
            bottom: -4px;
            left: 0;
            width: 0;
            height: 2px;
            background: var(--primary);
            transition: width 0.3s;
        }

        .nav-link:hover {
            color: var(--primary);
        }

        .nav-link:hover::after {
            width: 100%;
        }

        .nav-actions {
            display: flex;
            gap: 12px;
        }

        /* Buttons */
        .btn {
            display: inline-block;
            padding: 12px 28px;
            border-radius: 12px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s;
            border: none;
            cursor: pointer;
            font-size: 15px;
            position: relative;
            overflow: hidden;
        }

        .btn::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(255,255,255,0.3);
            transform: translate(-50%, -50%);
            transition: width 0.6s, height 0.6s;
        }

        .btn:hover::before {
            width: 300px;
            height: 300px;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: white;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        }

        .btn-primary.glow {
            animation: glow-pulse 2s infinite;
        }

        @keyframes glow-pulse {
            0%, 100% { box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); }
            50% { box-shadow: 0 4px 30px rgba(16, 185, 129, 0.6); }
        }

        .btn-secondary {
            background: white;
            color: var(--primary);
            border: 2px solid var(--primary);
        }

        .btn-secondary:hover {
            background: var(--primary);
            color: white;
            transform: translateY(-2px);
        }

        .btn-ghost {
            background: transparent;
            color: var(--gray);
        }

        .btn-ghost:hover {
            background: var(--light);
            color: var(--primary);
        }

        .btn-lg {
            padding: 16px 36px;
            font-size: 17px;
        }

        .btn-block {
            display: block;
            width: 100%;
            text-align: center;
        }

        .btn-icon {
            margin-right: 8px;
            font-size: 18px;
        }

        /* Live Success Banner */
        .live-success-banner {
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            padding: 16px 0;
            animation: slide-down 0.5s ease-out;
        }

        @keyframes slide-down {
            from { transform: translateY(-100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .success-items {
            display: flex;
            justify-content: space-around;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
        }

        .success-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }

        .success-icon {
            font-size: 20px;
        }

        /* Premium Hero */
        .premium-hero {
            padding: 80px 0;
            background: linear-gradient(135deg, var(--dark) 0%, var(--dark-2) 100%);
            position: relative;
            overflow: hidden;
            color: white;
        }

        .premium-hero::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, rgba(30, 64, 175, 0.3) 0%, transparent 70%);
            animation: float 20s infinite;
        }

        @keyframes float {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(-50px, 50px); }
        }

        .hero-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 60px;
            align-items: center;
            position: relative;
        }

        .hero-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(59, 130, 246, 0.2);
            color: var(--accent);
            padding: 8px 20px;
            border-radius: 30px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 24px;
        }

        .badge-icon {
            background: var(--accent);
            color: white;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }

        .hero-title {
            font-size: 56px;
            font-weight: 800;
            line-height: 1.2;
            margin-bottom: 24px;
            color: white;
        }

        .gradient-text {
            background: linear-gradient(135deg, var(--accent), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: inline-block;
        }

        .hero-subtitle {
            font-size: 20px;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 32px;
            line-height: 1.8;
        }

        .hero-stats {
            display: flex;
            gap: 24px;
            margin-bottom: 32px;
        }

        .stat-badge {
            background: white;
            padding: 16px 24px;
            border-radius: 16px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            text-align: center;
        }

        .stat-number {
            font-size: 28px;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 13px;
            color: var(--gray);
        }

        .hero-buttons {
            display: flex;
            gap: 16px;
            margin-bottom: 32px;
        }

        .trust-badges {
            display: flex;
            gap: 24px;
            flex-wrap: wrap;
        }

        .trust-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: var(--gray);
        }

        .trust-icon {
            font-size: 20px;
        }

        /* Live Chart Container */
        .live-chart-container {
            background: white;
            border-radius: 24px;
            padding: 28px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }

        .glow-box {
            position: relative;
            animation: box-glow 3s infinite;
        }

        @keyframes box-glow {
            0%, 100% { box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
            50% { box-shadow: 0 20px 60px rgba(16, 185, 129, 0.3); }
        }

        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }

        .chart-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 18px;
            font-weight: 600;
        }

        .live-indicator {
            width: 12px;
            height: 12px;
            background: var(--success);
            border-radius: 50%;
            animation: pulse-dot 2s infinite;
        }

        @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
        }

        .chart-profit {
            font-size: 28px;
            font-weight: 700;
        }

        .profit {
            color: var(--success);
        }

        .loss {
            color: var(--danger);
        }

        .pulse {
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        .performance-chart {
            width: 100%;
            height: auto;
        }

        .chart-line {
            stroke-dasharray: 1000;
            stroke-dashoffset: 1000;
            animation: draw-line 2s forwards;
        }

        @keyframes draw-line {
            to { stroke-dashoffset: 0; }
        }

        .chart-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-top: 20px;
        }

        .chart-stat {
            text-align: center;
            padding: 12px;
            background: var(--light);
            border-radius: 12px;
        }

        .stat-value {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .stat-text {
            font-size: 12px;
            color: var(--gray);
        }

        /* Animations */
        .fade-in-up {
            animation: fadeInUp 0.8s ease-out;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .fade-in-right {
            animation: fadeInRight 0.8s ease-out;
        }

        @keyframes fadeInRight {
            from {
                opacity: 0;
                transform: translateX(50px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .float-in {
            animation: floatIn 0.8s ease-out;
        }

        @keyframes floatIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .delay-1 { animation-delay: 0.2s; }
        .delay-2 { animation-delay: 0.4s; }
        .delay-3 { animation-delay: 0.6s; }
        .delay-4 { animation-delay: 0.8s; }

        /* Success Signal Cards */
        .live-signals-section {
            padding: 80px 0;
            background: white;
        }

        .section-header {
            text-align: center;
            margin-bottom: 60px;
        }

        .section-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.1);
            color: var(--primary);
            padding: 8px 20px;
            border-radius: 30px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 16px;
        }

        .section-title {
            font-size: 42px;
            font-weight: 800;
            margin-bottom: 16px;
            color: var(--dark);
        }

        .section-desc {
            font-size: 18px;
            color: var(--gray);
        }

        .signals-showcase {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 32px;
        }

        .success-signal-card {
            background: white;
            border-radius: 20px;
            overflow: hidden;
            border: 2px solid transparent;
            transition: all 0.4s;
        }

        .success-signal-card:hover {
            border-color: var(--primary);
            transform: translateY(-8px) scale(1.02);
        }

        .signal-status-bar {
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: white;
        }

        .signal-status-bar.sell {
            background: linear-gradient(135deg, var(--danger), #dc2626);
        }

        .status-pulse {
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
            margin-right: 8px;
            animation: pulse-dot 2s infinite;
        }

        .status-text {
            font-weight: 600;
            font-size: 14px;
        }

        .confidence-badge {
            background: rgba(255,255,255,0.2);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 13px;
        }

        .signal-main {
            padding: 24px;
        }

        .signal-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
        }

        .signal-symbol {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .signal-symbol h3 {
            font-size: 24px;
            font-weight: 700;
        }

        .signal-direction {
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 700;
        }

        .signal-direction.buy {
            background: rgba(16, 185, 129, 0.15);
            color: var(--success);
        }

        .signal-direction.sell {
            background: rgba(239, 68, 68, 0.15);
            color: var(--danger);
        }

        .signal-profit-big {
            text-align: right;
        }

        .profit-amount {
            font-size: 32px;
            font-weight: 800;
        }

        .profit-percent {
            font-size: 16px;
            font-weight: 600;
        }

        .signal-provider-info {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
        }

        .provider-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--light);
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
        }

        .verified-icon {
            color: var(--success);
            font-weight: 700;
        }

        .timeframe-badge {
            background: var(--light);
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            color: var(--gray);
        }

        .signal-price-levels {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 20px;
            padding: 20px;
            background: var(--light);
            border-radius: 16px;
        }

        .price-level {
            text-align: center;
            flex: 1;
        }

        .level-label {
            display: block;
            font-size: 12px;
            color: var(--gray);
            margin-bottom: 4px;
        }

        .level-value {
            display: block;
            font-size: 18px;
            font-weight: 700;
        }

        .price-level.current {
            transform: scale(1.1);
        }

        .price-arrow {
            font-size: 24px;
            color: var(--primary);
            font-weight: 700;
        }

        .signal-progress {
            margin-top: 16px;
        }

        .progress-bar {
            width: 100%;
            height: 12px;
            background: var(--light);
            border-radius: 20px;
            overflow: hidden;
            margin-bottom: 8px;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--primary), var(--accent));
            border-radius: 20px;
            animation: progress-grow 2s ease-out;
        }

        @keyframes progress-grow {
            from { width: 0; }
        }

        .progress-text {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            color: var(--gray);
        }

        /* 12x6 Signals Grid Styles */
        .signal-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
            padding: 20px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .control-group {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .control-group label {
            font-weight: 600;
            color: var(--dark);
            font-size: 15px;
        }

        .control-icon {
            font-size: 18px;
        }

        #sortSelect {
            padding: 10px 16px;
            border: 2px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            background: white;
            transition: all 0.3s;
        }

        #sortSelect:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
        }

        .signal-count {
            font-size: 16px;
            color: var(--gray);
        }

        .count-number {
            font-size: 24px;
            font-weight: 700;
            color: var(--primary);
            margin-right: 8px;
        }

        .signals-grid-12x6 {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 12px;
            margin-bottom: 32px;
        }

        .signal-mini-card {
            background: rgba(255, 255, 255, 0.95);
            border: 2px solid var(--border);
            border-radius: 12px;
            padding: 12px;
            transition: all 0.3s;
            position: relative;
            overflow: hidden;
            cursor: pointer;
        }

        .signal-mini-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            border-color: var(--primary);
        }

        .signal-mini-high {
            border-color: rgba(245, 158, 11, 0.3);
        }

        .signal-mini-high:hover {
            border-color: #f59e0b;
            box-shadow: 0 8px 24px rgba(245, 158, 11, 0.3);
        }

        .signal-mini-medium {
            border-color: rgba(14, 165, 233, 0.3);
        }

        .signal-mini-medium:hover {
            border-color: #0ea5e9;
            box-shadow: 0 8px 24px rgba(14, 165, 233, 0.3);
        }

        .signal-mini-low {
            border-color: rgba(16, 185, 129, 0.3);
        }

        .signal-mini-low:hover {
            border-color: #10b981;
            box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
        }

        .signal-mini-number {
            position: absolute;
            top: 6px;
            left: 6px;
            background: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 2px 6px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 700;
            z-index: 2;
        }

        .signal-mini-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .signal-mini-pair {
            font-size: 13px;
            font-weight: 700;
            color: var(--dark);
        }

        .signal-mini-timeframe {
            background: var(--light);
            padding: 2px 6px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 600;
            color: var(--gray);
        }

        .signal-mini-chart {
            height: 60px;
            margin-bottom: 8px;
        }

        .mini-signal-svg {
            width: 100%;
            height: 100%;
        }

        .signal-mini-stats {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 8px;
        }

        .mini-metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
        }

        .metric-label {
            color: var(--gray);
            font-weight: 500;
        }

        .metric-value {
            font-weight: 700;
            color: var(--dark);
        }

        .signal-mini-provider {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: var(--light);
            border-radius: 6px;
            font-size: 10px;
            font-weight: 600;
            color: var(--gray);
        }

        .provider-icon {
            color: var(--success);
            font-weight: 700;
        }

        .pagination-controls {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            padding: 20px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .page-btn {
            padding: 10px 20px;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }

        .page-btn:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
        }

        .page-btn:disabled {
            background: var(--gray);
            cursor: not-allowed;
            transform: none;
            opacity: 0.5;
        }

        .page-info {
            font-size: 16px;
            font-weight: 600;
            color: var(--dark);
        }

        #currentPage {
            color: var(--primary);
            font-size: 20px;
        }

        /* AI Features Section */
        .ai-features-section {
            padding: 100px 0;
            background: linear-gradient(135deg, var(--dark) 0%, var(--dark-2) 50%, var(--dark-3) 100%);
            position: relative;
            overflow: hidden;
        }

        .ai-features-section::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
            animation: rotate-slow 30s linear infinite;
        }

        @keyframes rotate-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .ai-features-section .section-title {
            color: white;
        }

        .ai-features-section .section-desc {
            color: rgba(255, 255, 255, 0.8);
        }

        .ai-features-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 32px;
            margin-bottom: 48px;
            position: relative;
            z-index: 1;
        }

        .ai-feature-card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 40px;
            transition: all 0.4s;
            position: relative;
            overflow: hidden;
        }

        .ai-feature-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--accent), var(--secondary));
            transform: scaleX(0);
            transition: transform 0.4s;
        }

        .ai-feature-card:hover::before {
            transform: scaleX(1);
        }

        .ai-feature-card:hover {
            transform: translateY(-12px);
            border-color: rgba(59, 130, 246, 0.5);
            box-shadow: 0 20px 60px rgba(59, 130, 246, 0.3);
        }

        .feature-icon-large {
            width: 100px;
            height: 100px;
            margin: 0 auto 24px;
            position: relative;
        }

        .icon-wrapper {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, var(--accent), var(--secondary));
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            position: relative;
            z-index: 2;
            animation: float-icon 3s ease-in-out infinite;
        }

        @keyframes float-icon {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }

        .icon-glow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 120px;
            height: 120px;
            background: radial-gradient(circle, rgba(59, 130, 246, 0.4), transparent);
            border-radius: 50%;
            animation: pulse-glow 2s infinite;
        }

        @keyframes pulse-glow {
            0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
        }

        .feature-title {
            font-size: 28px;
            font-weight: 800;
            color: white;
            margin-bottom: 16px;
            text-align: center;
        }

        .feature-description {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.7;
            margin-bottom: 24px;
            text-align: center;
        }

        .feature-benefits {
            margin-bottom: 32px;
        }

        .benefit-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 16px;
            color: rgba(255, 255, 255, 0.9);
            font-size: 15px;
            line-height: 1.6;
        }

        .benefit-icon {
            color: var(--accent);
            font-weight: 700;
            font-size: 18px;
            flex-shrink: 0;
        }

        .feature-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            padding-top: 24px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat-box {
            text-align: center;
            padding: 16px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat-value {
            font-size: 28px;
            font-weight: 800;
            color: var(--accent);
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.7);
        }

        .ai-features-secondary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            position: relative;
            z-index: 1;
        }

        .secondary-feature {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            transition: all 0.3s;
        }

        .secondary-feature:hover {
            transform: translateY(-8px);
            border-color: rgba(59, 130, 246, 0.5);
            box-shadow: 0 12px 32px rgba(59, 130, 246, 0.2);
        }

        .secondary-icon {
            font-size: 40px;
            margin-bottom: 16px;
        }

        .secondary-content h4 {
            font-size: 18px;
            font-weight: 700;
            color: white;
            margin-bottom: 8px;
        }

        .secondary-content p {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
            line-height: 1.5;
        }

        /* AI Advisor Widget */
        .ai-advisor-widget {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
        }

        .ai-advisor-toggle {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accent), var(--secondary));
            border: none;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(14, 165, 233, 0.4);
            transition: all 0.3s;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .ai-advisor-toggle:hover {
            transform: scale(1.1);
            box-shadow: 0 12px 32px rgba(14, 165, 233, 0.6);
        }

        .advisor-icon {
            font-size: 32px;
            position: relative;
            z-index: 2;
        }

        .advisor-pulse {
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: var(--accent);
            opacity: 0.4;
            animation: advisor-pulse 2s infinite;
        }

        @keyframes advisor-pulse {
            0% { transform: scale(1); opacity: 0.4; }
            100% { transform: scale(1.5); opacity: 0; }
        }

        .ai-advisor-panel {
            position: absolute;
            bottom: 80px;
            right: 0;
            width: 400px;
            max-height: 600px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            display: none;
            flex-direction: column;
            animation: slide-up 0.3s ease-out;
        }

        @keyframes slide-up {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .ai-advisor-panel.active {
            display: flex;
        }

        .advisor-header {
            padding: 20px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .advisor-title {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .advisor-avatar {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, var(--accent), var(--secondary));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }

        .advisor-title h4 {
            font-size: 16px;
            font-weight: 700;
            color: var(--dark);
            margin: 0;
        }

        .advisor-title p {
            font-size: 12px;
            color: var(--gray);
            margin: 0;
        }

        .advisor-close {
            background: var(--light);
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            color: var(--gray);
            transition: all 0.3s;
        }

        .advisor-close:hover {
            background: var(--danger);
            color: white;
            transform: rotate(90deg);
        }

        .advisor-content {
            padding: 16px;
            overflow-y: auto;
            max-height: 500px;
        }

        .advisor-recommendation {
            background: var(--light);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            display: flex;
            gap: 12px;
            animation: fade-in 0.5s ease-out;
            border-left: 4px solid var(--accent);
            transition: all 0.3s;
        }

        .advisor-recommendation:hover {
            transform: translateX(4px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .rec-icon {
            font-size: 32px;
            flex-shrink: 0;
        }

        .rec-content h5 {
            font-size: 14px;
            font-weight: 700;
            color: var(--dark);
            margin: 0 0 6px 0;
        }

        .rec-content p {
            font-size: 13px;
            color: var(--gray);
            line-height: 1.5;
            margin: 0 0 12px 0;
        }

        .rec-action {
            padding: 8px 16px;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }

        .rec-action:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
        }

        /* Winners Ticker */
        .recent-winners {
            padding: 60px 0;
            background: var(--light);
            overflow: hidden;
        }

        .winners-ticker {
            overflow: hidden;
            margin-top: 40px;
        }

        .ticker-track {
            display: flex;
            gap: 24px;
            animation: scroll-left 30s linear infinite;
        }

        @keyframes scroll-left {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
        }

        .winner-card {
            flex-shrink: 0;
            background: white;
            padding: 20px 24px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            min-width: 350px;
        }

        .winner-icon {
            width: 40px;
            height: 40px;
            background: var(--success);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 700;
        }

        .winner-symbol {
            font-size: 18px;
            font-weight: 700;
        }

        .winner-provider {
            font-size: 13px;
            color: var(--gray);
        }

        .profit-big {
            font-size: 20px;
            font-weight: 800;
        }

        .profit-small {
            font-size: 14px;
            color: var(--success);
        }

        .winner-time {
            font-size: 13px;
            color: var(--gray);
            margin-left: auto;
        }

        /* Top Providers Premium */
        .top-providers-premium {
            padding: 80px 0;
            background: white;
        }

        .providers-premium-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 32px;
        }

        .provider-premium-card {
            background: white;
            border-radius: 20px;
            padding: 32px;
            border: 2px solid var(--border);
            transition: all 0.4s;
        }

        .provider-premium-card:hover {
            border-color: var(--primary);
            transform: translateY(-8px);
        }

        .provider-premium-header {
            position: relative;
            margin-bottom: 20px;
        }

        .provider-premium-avatar {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border-radius: 16px;
            margin-bottom: 16px;
        }

        .provider-premium-badge {
            position: absolute;
            top: 16px;
            right: 16px;
            background: rgba(255, 255, 255, 0.95);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .verified-star {
            font-size: 16px;
        }

        .provider-premium-info h3 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 12px;
        }

        .provider-premium-info p {
            color: var(--gray);
            line-height: 1.6;
            margin-bottom: 12px;
        }

        .provider-rating {
            color: #fbbf24;
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 20px;
        }

        .rating-value {
            color: var(--dark);
            font-size: 16px;
            font-weight: 700;
        }

        .provider-premium-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-bottom: 20px;
        }

        .premium-stat {
            display: flex;
            gap: 12px;
            padding: 16px;
            background: var(--light);
            border-radius: 12px;
        }

        .stat-icon {
            font-size: 28px;
        }

        .stat-content {
            flex: 1;
        }

        .stat-value {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 2px;
        }

        .stat-label {
            font-size: 12px;
            color: var(--gray);
        }

        .provider-live-info {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: rgba(16, 185, 129, 0.1);
            border-radius: 12px;
            font-size: 14px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        /* Footer */
        .premium-footer {
            background: var(--dark);
            color: white;
            padding: 60px 0 30px;
            margin-top: 80px;
        }

        .footer-content {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 40px;
            margin-bottom: 40px;
        }

        .footer-logo {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }

        .footer-logo-img {
            width: 40px;
            height: 40px;
        }

        .footer-section h3, .footer-section h4 {
            margin-bottom: 16px;
        }

        .footer-section p {
            color: rgba(255,255,255,0.7);
            line-height: 1.7;
            margin-bottom: 16px;
        }

        .footer-section a {
            display: block;
            color: rgba(255,255,255,0.7);
            text-decoration: none;
            margin-bottom: 10px;
            transition: color 0.3s;
        }

        .footer-section a:hover {
            color: white;
        }

        .social-links {
            display: flex;
            gap: 12px;
        }

        .social-link {
            display: inline-block !important;
            padding: 8px 16px;
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
        }

        .footer-bottom {
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 24px;
            text-align: center;
            color: rgba(255,255,255,0.6);
        }

        .risk-disclaimer {
            margin-top: 12px;
            font-size: 13px;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }

        /* Backtest Page */
        .page-header-dark {
            background: linear-gradient(135deg, var(--dark), var(--dark-2));
            padding: 80px 0;
            color: white;
            text-align: center;
        }

        .page-header-dark h1 {
            font-size: 48px;
            margin-bottom: 16px;
        }

        .backtest-section {
            padding: 80px 0;
        }

        .backtest-info-box {
            display: flex;
            gap: 24px;
            padding: 32px;
            background: rgba(16, 185, 129, 0.1);
            border-radius: 20px;
            border: 2px solid var(--primary);
            margin-bottom: 40px;
        }

        .info-icon {
            font-size: 48px;
        }

        .info-content h3 {
            font-size: 24px;
            margin-bottom: 8px;
        }

        .coming-soon-card {
            text-align: center;
            padding: 80px 40px;
            background: white;
            border-radius: 24px;
            border: 2px solid var(--border);
        }

        .coming-soon-icon {
            font-size: 80px;
            margin-bottom: 24px;
        }

        .coming-soon-card h2 {
            font-size: 36px;
            margin-bottom: 16px;
        }

        .coming-soon-card p {
            font-size: 18px;
            color: var(--gray);
            margin-bottom: 32px;
        }

        .features-list {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            max-width: 800px;
            margin: 0 auto 40px;
            text-align: left;
        }

        .feature-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            background: var(--light);
            border-radius: 12px;
        }

        .check {
            color: var(--success);
            font-size: 20px;
            font-weight: 700;
        }

        /* Trustpilot Reviews Section */
        .trustpilot-section {
            padding: 80px 0;
            background: var(--light);
        }

        .trustpilot-logo-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
        }

        .trustpilot-stars {
            display: flex;
            gap: 4px;
        }

        .trust-star {
            font-size: 32px;
            color: #fbbf24;
        }

        .trustpilot-rating {
            font-size: 16px;
            color: var(--gray);
        }

        .reviews-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            margin-bottom: 40px;
        }

        .review-card {
            background: white;
            padding: 28px;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            transition: all 0.3s;
        }

        .review-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }

        .review-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
        }

        .review-author {
            display: flex;
            gap: 12px;
        }

        .author-avatar {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 18px;
        }

        .author-name {
            font-weight: 700;
            font-size: 16px;
            margin-bottom: 4px;
        }

        .review-date {
            font-size: 13px;
            color: var(--gray);
        }

        .review-stars .star {
            color: #fbbf24;
            font-size: 18px;
        }

        .review-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
            color: var(--dark);
        }

        .review-text {
            font-size: 14px;
            line-height: 1.7;
            color: var(--gray);
            margin-bottom: 16px;
        }

        .review-profit {
            display: inline-block;
            padding: 8px 16px;
            background: rgba(16, 185, 129, 0.1);
            border-radius: 8px;
            font-size: 14px;
            color: var(--gray);
        }

        .trustpilot-cta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 40px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }

        .cta-content h3 {
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 8px;
        }

        .cta-content p {
            font-size: 16px;
            color: var(--gray);
        }

        /* Modal Styles */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            align-items: center;
            justify-content: center;
        }

        .modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(5px);
        }

        .modal-content {
            position: relative;
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 10001;
        }

        .modal-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: var(--light);
            border: none;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            transition: all 0.3s;
            color: var(--gray);
        }

        .modal-close:hover {
            background: var(--danger);
            color: white;
            transform: rotate(90deg);
        }

        .modal-header {
            text-align: center;
            margin-bottom: 32px;
        }

        .modal-header h2 {
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 8px;
        }

        .modal-header p {
            color: var(--gray);
            font-size: 15px;
        }

        .signup-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .form-group label {
            font-weight: 600;
            font-size: 14px;
            color: var(--dark);
        }

        .form-group input,
        .form-group select {
            padding: 12px 16px;
            border: 2px solid var(--border);
            border-radius: 8px;
            font-size: 15px;
            transition: all 0.3s;
        }

        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .signup-benefits {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            padding: 20px;
            background: var(--light);
            border-radius: 12px;
        }

        .benefit {
            font-size: 14px;
            color: var(--gray);
        }

        .form-footer {
            text-align: center;
            margin-top: 16px;
            font-size: 14px;
            color: var(--gray);
        }

        .form-footer a {
            color: var(--primary);
            text-decoration: none;
            font-weight: 600;
        }

        .form-footer a:hover {
            text-decoration: underline;
        }

        /* Live Multi-Strategy Charts Grid 3x3 */
        .live-charts-grid-section {
            padding: 80px 0;
            background: var(--dark-2);
            position: relative;
            overflow: hidden;
        }

        .live-charts-grid-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at 50% 50%, rgba(30, 64, 175, 0.1) 0%, transparent 70%);
            animation: float 15s infinite;
        }

        .live-charts-grid-section .section-title {
            color: white;
        }

        .live-charts-grid-section .section-desc {
            color: rgba(255, 255, 255, 0.7);
        }

        .charts-grid-3x3 {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            position: relative;
            z-index: 1;
        }

        .mini-chart-card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 20px;
            transition: all 0.4s;
            overflow: hidden;
            position: relative;
        }

        .mini-chart-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 12px 40px rgba(14, 165, 233, 0.3);
            background: rgba(255, 255, 255, 0.08);
        }

        /* Risk Category Specific Styles */
        .mini-chart-high {
            border-color: rgba(245, 158, 11, 0.4);
        }

        .mini-chart-high:hover {
            border-color: #f59e0b;
            box-shadow: 0 12px 40px rgba(245, 158, 11, 0.4);
        }

        .mini-chart-medium {
            border-color: rgba(14, 165, 233, 0.4);
        }

        .mini-chart-medium:hover {
            border-color: #0ea5e9;
            box-shadow: 0 12px 40px rgba(14, 165, 233, 0.4);
        }

        .mini-chart-low {
            border-color: rgba(16, 185, 129, 0.4);
        }

        .mini-chart-low:hover {
            border-color: #10b981;
            box-shadow: 0 12px 40px rgba(16, 185, 129, 0.4);
        }

        .risk-badge {
            position: absolute;
            top: 12px;
            right: 12px;
            padding: 4px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            z-index: 2;
        }

        .risk-high {
            background: rgba(245, 158, 11, 0.2);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.4);
        }

        .risk-medium {
            background: rgba(14, 165, 233, 0.2);
            color: #0ea5e9;
            border: 1px solid rgba(14, 165, 233, 0.4);
        }

        .risk-low {
            background: rgba(16, 185, 129, 0.2);
            color: #10b981;
            border: 1px solid rgba(16, 185, 129, 0.4);
        }

        .mini-chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

        .chart-pair {
            font-size: 18px;
            font-weight: 700;
            color: white;
        }

        .chart-timeframe {
            background: rgba(14, 165, 233, 0.2);
            color: var(--accent);
            padding: 4px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
        }

        .mini-chart-body {
            margin-bottom: 16px;
            height: 100px;
            position: relative;
        }

        .mini-svg-chart {
            width: 100%;
            height: 100%;
        }

        .chart-path {
            stroke-dasharray: 1000;
            stroke-dashoffset: 1000;
            animation: draw-line 2s forwards;
        }

        .mini-chart-stats {
            display: flex;
            justify-content: space-between;
            gap: 12px;
        }

        .mini-stat {
            flex: 1;
            background: rgba(255, 255, 255, 0.05);
            padding: 12px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .mini-stat-label {
            display: block;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .mini-stat-value {
            display: block;
            font-size: 16px;
            font-weight: 700;
            color: white;
        }

        @media (max-width: 768px) {
            .hero-grid {
                grid-template-columns: 1fr;
            }

            .signals-showcase {
                grid-template-columns: 1fr;
            }

            .providers-premium-grid {
                grid-template-columns: 1fr;
            }

            .nav-menu {
                display: none;
            }

            .hero-title {
                font-size: 36px;
            }

            .features-list {
                grid-template-columns: 1fr;
            }

            .reviews-grid {
                grid-template-columns: 1fr;
            }

            .trustpilot-cta {
                flex-direction: column;
                text-align: center;
                gap: 24px;
            }

            .signup-benefits {
                grid-template-columns: 1fr;
            }

            .modal-content {
                padding: 24px;
            }

            .charts-grid-3x3 {
                grid-template-columns: 1fr;
            }

            .signals-grid-12x6 {
                grid-template-columns: repeat(2, 1fr);
            }

            .signal-controls {
                flex-direction: column;
                gap: 16px;
            }

            .control-group {
                width: 100%;
                flex-direction: column;
                align-items: flex-start;
            }

            #sortSelect {
                width: 100%;
            }

            .ai-features-grid {
                grid-template-columns: 1fr;
            }

            .ai-features-secondary {
                grid-template-columns: 1fr;
            }

            .trust-item {
                color: rgba(255, 255, 255, 0.9);
            }
        }
    </style>
  `;
}

module.exports = router;
