# 🎯 Feature Specifications - AutomatedTradeBot Platform

**Version:** 1.0
**Last Updated:** October 25, 2025

---

## 🏪 MARKETPLACE SYSTEM

### Strategy Listing Page (`/marketplace`)

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo | Marketplace | Signals | Pricing | Login     │
├─────────────────────────────────────────────────────────────┤
│  Hero Banner: "Trade Smarter with Verified Strategies"      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────────────────────────────┐ │
│  │  Filters    │  │  Strategy Grid (3-4 columns)         │ │
│  │             │  │  ┌────────┐  ┌────────┐  ┌────────┐  │ │
│  │  Type       │  │  │Strategy│  │Strategy│  │Strategy│  │ │
│  │  ☐ DCA      │  │  │  Card  │  │  Card  │  │  Card  │  │ │
│  │  ☐ Grid     │  │  └────────┘  └────────┘  └────────┘  │ │
│  │  ☐ Scalping │  │  ┌────────┐  ┌────────┐  ┌────────┐  │ │
│  │             │  │  │Strategy│  │Strategy│  │Strategy│  │ │
│  │  Asset      │  │  │  Card  │  │  Card  │  │  Card  │  │ │
│  │  ☐ Crypto   │  │  └────────┘  └────────┘  └────────┘  │ │
│  │  ☐ Forex    │  │                                        │ │
│  │             │  │  Pagination: ‹ 1 2 3 ... 10 ›         │ │
│  │  Metrics    │  └──────────────────────────────────────┘ │
│  │  ROI: [_|_] │                                            │
│  │  DD: [_|_]  │  Sort By: [Highest ROI ▼]                │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

#### Strategy Card Design
```javascript
// Card Component
{
  badge: "VERIFIED" | "TOP RATED" | "TRENDING",

  header: {
    name: "7RSI DCA Strategy",
    provider: "AI Strategy Engine",
    providerAvatar: "url",
    verified: true
  },

  metrics: {
    roi: "+582%",
    sharpe: "2.8",
    winRate: "82.3%",
    drawdown: "-8.2%"
  },

  miniChart: {
    type: "sparkline",
    data: [/* last 30 days equity */],
    color: "#00ff88" // green for positive
  },

  pricing: {
    type: "one-time" | "subscription",
    amount: "$99.99",
    currency: "USD"
  },

  stats: {
    downloads: 1234,
    rating: 4.9,
    reviews: 567
  },

  footer: {
    buttons: ["View Details", "Purchase"]
  }
}
```

#### Sorting Options
```javascript
const sortOptions = [
  { value: 'roi_desc', label: '🔥 Highest ROI' },
  { value: 'sharpe_desc', label: '⭐ Best Sharpe Ratio' },
  { value: 'dd_asc', label: '📉 Lowest Drawdown' },
  { value: 'winrate_desc', label: '🎯 Best Win Rate' },
  { value: 'sortino_desc', label: '💪 Best Sortino Ratio' },
  { value: 'profit_desc', label: '💰 Most Profitable' },
  { value: 'downloads_desc', label: '👥 Most Popular' },
  { value: 'rating_desc', label: '⭐ Highest Rated' },
  { value: 'newest', label: '🆕 Newest First' },
  { value: 'price_asc', label: '💲 Lowest Price' },
  { value: 'price_desc', label: '💲 Highest Price' }
];
```

#### Filter System
```javascript
const filters = {
  strategyType: {
    label: "Strategy Type",
    options: [
      { value: 'dca', label: 'DCA (Dollar Cost Averaging)', count: 45 },
      { value: 'grid', label: 'Grid Trading', count: 32 },
      { value: 'scalping', label: 'Scalping', count: 28 },
      { value: 'swing', label: 'Swing Trading', count: 19 },
      { value: 'momentum', label: 'Momentum', count: 15 },
      { value: 'mean_reversion', label: 'Mean Reversion', count: 12 },
      { value: 'arbitrage', label: 'Arbitrage', count: 8 },
      { value: 'custom', label: 'Custom Algorithm', count: 23 }
    ]
  },

  assetClass: {
    label: "Asset Class",
    options: [
      { value: 'crypto', label: 'Cryptocurrency', count: 120 },
      { value: 'forex', label: 'Forex', count: 45 },
      { value: 'stocks', label: 'Stocks', count: 18 },
      { value: 'commodities', label: 'Commodities', count: 9 }
    ]
  },

  timeframe: {
    label: "Timeframe",
    options: [
      { value: '1m', label: '1 Minute', count: 15 },
      { value: '5m', label: '5 Minutes', count: 34 },
      { value: '15m', label: '15 Minutes', count: 42 },
      { value: '1h', label: '1 Hour', count: 56 },
      { value: '4h', label: '4 Hours', count: 38 },
      { value: '1d', label: '1 Day', count: 27 }
    ]
  },

  performance: {
    label: "Performance Metrics",
    fields: [
      {
        id: 'roi',
        label: 'Total ROI (%)',
        type: 'range',
        min: -100,
        max: 1000,
        step: 10,
        default: [0, 1000]
      },
      {
        id: 'sharpe',
        label: 'Sharpe Ratio',
        type: 'range',
        min: 0,
        max: 5,
        step: 0.1,
        default: [0, 5]
      },
      {
        id: 'winrate',
        label: 'Win Rate (%)',
        type: 'range',
        min: 0,
        max: 100,
        step: 5,
        default: [50, 100]
      },
      {
        id: 'drawdown',
        label: 'Max Drawdown (%)',
        type: 'range',
        min: 0,
        max: 50,
        step: 1,
        default: [0, 20]
      }
    ]
  },

  pricing: {
    label: "Price Range",
    type: 'range',
    min: 0,
    max: 500,
    step: 10,
    default: [0, 500],
    currency: 'USD'
  },

  status: {
    label: "Status",
    options: [
      { value: 'verified', label: '✓ Verified Only', count: 89 },
      { value: 'active', label: '🟢 Active Trading', count: 156 },
      { value: 'backtested', label: '📊 Backtested', count: 182 }
    ]
  },

  exchange: {
    label: "Supported Exchanges",
    options: [
      { value: 'bybit', label: 'Bybit', count: 98 },
      { value: 'binance', label: 'Binance', count: 112 },
      { value: 'mexc', label: 'MEXC', count: 76 },
      { value: 'bitget', label: 'Bitget', count: 54 },
      { value: 'okx', label: 'OKX', count: 43 },
      { value: 'kucoin', label: 'KuCoin', count: 38 }
    ]
  }
};
```

---

## 📊 STRATEGY DETAIL PAGE

### Page Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Breadcrumb: Marketplace › DCA Strategies › 7RSI DCA        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Strategy Header                                     │   │
│  │  ┌────────┐  7RSI DCA Strategy      ✓ VERIFIED      │   │
│  │  │Provider│  by AI Strategy Engine  ⭐⭐⭐⭐⭐ 4.9   │   │
│  │  │ Avatar │  1,234 downloads • 567 reviews          │   │
│  │  └────────┘  Price: $99.99 [Purchase Now]           │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Performance Summary (4 Key Metrics Cards)           │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │   │
│  │  │+582%   │ │ 2.8    │ │82.3%   │ │-8.2%   │       │   │
│  │  │Total   │ │Sharpe  │ │Win     │ │Max     │       │   │
│  │  │ROI     │ │Ratio   │ │Rate    │ │Drawdown│       │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘       │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  📈 Equity Curve Chart (TradingView Style)           │   │
│  │  ───────────────────────────────────────────────     │   │
│  │                                            ╱          │   │
│  │                                      ╱────╱           │   │
│  │                             ╱───────╱                 │   │
│  │  ─────────────────────────────────────────────────   │   │
│  │  [1M] [3M] [6M] [1Y] [ALL]                           │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────────────────────┐    │
│  │  Drawdown      │  │  Monthly Returns Heatmap       │    │
│  │  Chart         │  │  Jan Feb Mar Apr May Jun ...   │    │
│  │  (Area chart)  │  │  [Colored cells with % values] │    │
│  └────────────────┘  └────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Tabs: [Overview] [Backtest] [Live Results] [Reviews]      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tab Content Area                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Performance Metrics Display

#### Key Metrics Cards
```javascript
const keyMetrics = [
  {
    id: 'total_roi',
    label: 'Total ROI',
    value: '+582%',
    icon: '🚀',
    color: '#00ff88',
    tooltip: 'Total return on investment since strategy inception',
    calculation: '(Final Equity - Initial Capital) / Initial Capital * 100'
  },
  {
    id: 'sharpe_ratio',
    label: 'Sharpe Ratio',
    value: '2.8',
    icon: '⚡',
    color: '#00d4ff',
    tooltip: 'Risk-adjusted return metric. Above 2.0 is excellent',
    calculation: '(Average Return - Risk-Free Rate) / Standard Deviation',
    benchmark: 'Good: > 1.0, Great: > 2.0, Excellent: > 3.0'
  },
  {
    id: 'win_rate',
    label: 'Win Rate',
    value: '82.3%',
    icon: '🎯',
    color: '#ffaa00',
    tooltip: 'Percentage of profitable trades',
    calculation: 'Profitable Trades / Total Trades * 100'
  },
  {
    id: 'max_drawdown',
    label: 'Max Drawdown',
    value: '-8.2%',
    icon: '📉',
    color: '#ff3366',
    tooltip: 'Maximum peak-to-trough decline',
    calculation: '(Trough Value - Peak Value) / Peak Value * 100'
  }
];
```

#### Additional Metrics Table
```javascript
const additionalMetrics = [
  {
    category: 'Return Metrics',
    metrics: [
      { label: 'Avg ROI per Trade', value: '3.2%', trend: 'positive' },
      { label: 'Best Trade', value: '+24.5%', trend: 'positive' },
      { label: 'Worst Trade', value: '-5.1%', trend: 'negative' },
      { label: 'Profit Factor', value: '2.4', trend: 'positive' },
      { label: 'Monthly Avg Return', value: '+12.3%', trend: 'positive' }
    ]
  },
  {
    category: 'Risk Metrics',
    metrics: [
      { label: 'Sortino Ratio', value: '3.2', trend: 'positive' },
      { label: 'Calmar Ratio', value: '7.1', trend: 'positive' },
      { label: 'Volatility (StdDev)', value: '4.8%', trend: 'neutral' },
      { label: 'Avg Drawdown', value: '-2.1%', trend: 'neutral' },
      { label: 'Recovery Factor', value: '71', trend: 'positive' }
    ]
  },
  {
    category: 'Trade Statistics',
    metrics: [
      { label: 'Total Trades', value: '1,247', trend: 'neutral' },
      { label: 'Profitable Trades', value: '1,026 (82.3%)', trend: 'positive' },
      { label: 'Losing Trades', value: '221 (17.7%)', trend: 'neutral' },
      { label: 'Avg Trade Duration', value: '4.2 hours', trend: 'neutral' },
      { label: 'Avg Win/Loss Ratio', value: '2.8', trend: 'positive' }
    ]
  },
  {
    category: 'Performance by Market',
    metrics: [
      { label: 'Bull Market ROI', value: '+45.2%', trend: 'positive' },
      { label: 'Bear Market ROI', value: '+8.1%', trend: 'positive' },
      { label: 'Sideways Market ROI', value: '+15.3%', trend: 'positive' },
      { label: 'High Volatility', value: '+32.1%', trend: 'positive' },
      { label: 'Low Volatility', value: '+9.8%', trend: 'positive' }
    ]
  }
];
```

### Chart Components

#### 1. Equity Curve Chart
```javascript
// Using TradingView Lightweight Charts
const equityCurveConfig = {
  type: 'area',
  data: [
    // Time series data
    { time: '2024-01-01', value: 1000 },
    { time: '2024-01-02', value: 1032 },
    // ... more data points
  ],
  options: {
    chart: {
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false
      }
    },
    series: {
      topColor: 'rgba(0, 255, 136, 0.5)',
      bottomColor: 'rgba(0, 255, 136, 0.05)',
      lineColor: '#00ff88',
      lineWidth: 2
    },
    priceScale: {
      mode: 0, // Normal
      autoScale: true
    },
    grid: {
      vertLines: { color: 'rgba(0, 212, 255, 0.1)' },
      horzLines: { color: 'rgba(0, 212, 255, 0.1)' }
    }
  },
  overlays: [
    {
      type: 'line',
      name: 'Initial Capital',
      data: 1000,
      style: { color: '#8892b0', lineStyle: 'dashed' }
    }
  ]
};
```

#### 2. Drawdown Chart
```javascript
const drawdownConfig = {
  type: 'area',
  data: [
    { time: '2024-01-01', value: 0 },
    { time: '2024-01-15', value: -3.2 },
    { time: '2024-02-01', value: -1.5 },
    { time: '2024-02-20', value: -8.2 }, // Max drawdown
    // ... recovery
  ],
  options: {
    chart: { height: 300 },
    series: {
      topColor: 'rgba(255, 51, 102, 0.05)',
      bottomColor: 'rgba(255, 51, 102, 0.3)',
      lineColor: '#ff3366',
      lineWidth: 2,
      invertScale: true
    }
  },
  annotations: [
    {
      type: 'marker',
      time: '2024-02-20',
      position: 'belowBar',
      text: 'Max DD: -8.2%',
      color: '#ff3366'
    }
  ]
};
```

#### 3. Monthly Returns Heatmap
```javascript
const monthlyReturnsHeatmap = {
  type: 'heatmap',
  data: {
    2024: {
      Jan: 12.3,
      Feb: -2.1,
      Mar: 18.5,
      Apr: 9.2,
      May: 15.8,
      Jun: 7.4,
      Jul: 22.1,
      Aug: 11.3,
      Sep: 6.9,
      Oct: 14.7,
      Nov: null, // Future month
      Dec: null
    },
    2023: {
      Jan: 8.1,
      Feb: 13.4,
      // ... full year
    }
  },
  colorScale: {
    negative: '#ff3366',
    neutral: '#8892b0',
    positive: '#00ff88',
    ranges: [
      { min: -Infinity, max: -5, color: '#cc0000' },
      { min: -5, max: 0, color: '#ff3366' },
      { min: 0, max: 5, color: '#ffaa00' },
      { min: 5, max: 15, color: '#00ff88' },
      { min: 15, max: Infinity, color: '#00cc66' }
    ]
  },
  cellFormat: (value) => value > 0 ? `+${value}%` : `${value}%`
};
```

#### 4. Win/Loss Distribution Chart
```javascript
const winLossDistribution = {
  type: 'bar',
  data: {
    labels: ['-10%+', '-5 to -10%', '-2 to -5%', '0 to -2%', '0 to 2%', '2 to 5%', '5 to 10%', '10%+'],
    datasets: [
      {
        label: 'Number of Trades',
        data: [5, 18, 54, 144, 289, 412, 245, 80],
        backgroundColor: (context) => {
          const value = context.dataset.data[context.dataIndex];
          const index = context.dataIndex;
          return index < 4 ? '#ff3366' : '#00ff88';
        }
      }
    ]
  },
  options: {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Number of Trades' }
      },
      x: {
        title: { display: true, text: 'ROI Range (%)' }
      }
    }
  }
};
```

---

## 📡 SIGNAL PLATFORM

### Signal Provider Card
```javascript
const signalProviderCard = {
  header: {
    badge: "TOP RATED" | "VERIFIED" | "RISING STAR",
    avatar: "url",
    name: "AI Strategy Engine",
    verified: true,
    yearsExperience: 5
  },

  rating: {
    stars: 4.9,
    reviews: 2341,
    totalFollowers: 3421
  },

  performance: {
    winRate: "82.3%",
    totalROI: "+582%",
    avgROIperSignal: "+3.2%",
    sharpeRatio: "2.8",
    maxDrawdown: "-8.2%",
    avgLatency: "32ms",
    totalSignals: 1247
  },

  activePairs: ["BTC/USDT", "ETH/USDT", "SOL/USDT"],

  pricing: {
    monthlyFee: "$3.00",
    trialDays: 7
  },

  liveSignals: {
    active: 3,
    profitable: 2,
    openPnL: "+$234.50"
  },

  chart: {
    type: "mini-equity-curve",
    data: [/* last 30 days */],
    height: 80
  }
};
```

### Signal Feed (Real-time)
```javascript
const signalFeed = {
  signal: {
    id: "sig_abc123",
    provider: {
      id: "prov_xyz789",
      name: "AI Strategy Engine",
      avatar: "url",
      verified: true
    },

    timestamp: "2025-10-25T14:32:15Z",
    latency: "28ms",

    trade: {
      symbol: "BTC/USDT",
      exchange: "Bybit",
      type: "LONG" | "SHORT",
      entryPrice: 73680.50,
      stopLoss: 72100.00,
      takeProfit: 76500.00,
      leverage: 5,
      riskReward: "1:2.8"
    },

    status: "ACTIVE" | "CLOSED" | "CANCELLED",

    results: {
      exitPrice: 75200.00, // if closed
      pnl: "+2.06%",
      duration: "4h 23m"
    },

    analysis: {
      signal: "Buy when RSI crosses above 30 on all 7 timeframes",
      confidence: 87,
      marketCondition: "Bullish momentum detected"
    },

    followers: {
      total: 234,
      copied: 189,
      pending: 45
    }
  }
};
```

### Signal Detail Modal
```
┌──────────────────────────────────────────────────┐
│  BTC/USDT • LONG • Active for 2h 15m             │
│  ✓ AI Strategy Engine                            │
├──────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │ Entry      │  │ Stop Loss  │  │ Take Profit│ │
│  │ $73,680.50 │  │ $72,100.00 │  │ $76,500.00 │ │
│  └────────────┘  └────────────┘  └────────────┘ │
├──────────────────────────────────────────────────┤
│  Current Price: $74,820.30                       │
│  Unrealized PnL: +1.55% (+$1,140.00)             │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │  📈 Price Chart (TradingView)              │  │
│  │  [Entry, SL, TP markers shown]             │  │
│  └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│  Signal Analysis:                                │
│  "Buy when RSI crosses above 30 on all 7         │
│  timeframes simultaneously. Strong bullish       │
│  momentum detected with volume confirmation."    │
│                                                   │
│  Confidence: ███████████░░ 87%                   │
├──────────────────────────────────────────────────┤
│  Auto-Copy Settings:                             │
│  Position Size: [$1,000] Leverage: [5x ▼]       │
│  ☑ Copy this signal                              │
│                                                   │
│  [Copy Signal] [Close]                           │
└──────────────────────────────────────────────────┘
```

---

## 💎 PREMIUM FEATURES

### 1. AI Risk Manager ($10/mo)

#### Dashboard Widget
```javascript
const aiRiskManagerWidget = {
  status: "ACTIVE" | "LEARNING" | "PAUSED",

  currentSettings: {
    riskMode: "ADAPTIVE" | "CONSERVATIVE" | "AGGRESSIVE",
    maxRiskPerTrade: "2.5%",
    maxDailyRisk: "10%",
    maxDrawdown: "15%",
    correlationLimit: "0.7"
  },

  aiRecommendations: {
    currentRecommendation: "Reduce position sizes by 20%",
    reason: "Recent drawdown of 8.2% detected. Market volatility increased by 34%.",
    confidence: 92,
    expectedImpact: "Risk reduction of 35%, potential return reduction of 15%"
  },

  recentActions: [
    {
      timestamp: "2025-10-25T14:30:00Z",
      action: "Reduced position size on BTC/USDT from $1,000 to $800",
      reason: "High correlation with existing ETH/USDT position",
      result: "Diversification score improved from 0.45 to 0.72"
    }
  ],

  performanceImpact: {
    withAI: {
      roi: "+45.2%",
      sharpe: "2.8",
      maxDD: "-8.2%"
    },
    withoutAI: {
      roi: "+52.1%",
      sharpe: "1.9",
      maxDD: "-18.5%"
    },
    improvement: {
      riskAdjustedReturn: "+47%",
      drawdownReduction: "56%",
      sharpeImprovement: "+47%"
    }
  }
};
```

#### Risk Calculation Logic
```javascript
// Adaptive Position Sizing Algorithm
function calculatePositionSize(params) {
  const {
    accountEquity,
    riskPercent,
    entryPrice,
    stopLoss,
    recentPerformance,
    marketVolatility,
    correlationScore
  } = params;

  // Base position size
  let baseSize = (accountEquity * (riskPercent / 100)) /
                 Math.abs(entryPrice - stopLoss);

  // AI Adjustments
  const performanceMultiplier = calculatePerformanceMultiplier(recentPerformance);
  const volatilityMultiplier = calculateVolatilityMultiplier(marketVolatility);
  const correlationMultiplier = calculateCorrelationMultiplier(correlationScore);

  // Final position size
  const adjustedSize = baseSize *
                       performanceMultiplier *
                       volatilityMultiplier *
                       correlationMultiplier;

  return {
    positionSize: adjustedSize,
    adjustments: {
      performance: performanceMultiplier,
      volatility: volatilityMultiplier,
      correlation: correlationMultiplier
    },
    reasoning: generateReasoning(params, adjustedSize)
  };
}

function calculatePerformanceMultiplier(recentPerformance) {
  // Reduce size after losses, increase after wins
  const { winRate, recentTrades, consecutiveLosses } = recentPerformance;

  if (consecutiveLosses >= 3) return 0.5; // Reduce by 50%
  if (consecutiveLosses === 2) return 0.7;
  if (winRate > 0.7 && recentTrades > 10) return 1.2; // Increase by 20%

  return 1.0; // No adjustment
}

function calculateVolatilityMultiplier(marketVolatility) {
  // Reduce size in high volatility
  const { current, average, stdDev } = marketVolatility;

  if (current > average + (2 * stdDev)) return 0.6; // High volatility
  if (current > average + stdDev) return 0.8;
  if (current < average - stdDev) return 1.1; // Low volatility

  return 1.0;
}

function calculateCorrelationMultiplier(correlationScore) {
  // Reduce size if high correlation with existing positions
  if (correlationScore > 0.8) return 0.5; // Highly correlated
  if (correlationScore > 0.6) return 0.7;
  if (correlationScore < 0.3) return 1.1; // Low correlation (good diversification)

  return 1.0;
}
```

### 2. Adaptive TP/SL ($5/mo)

#### Settings Panel
```javascript
const adaptiveTPSL = {
  enabled: true,

  modes: [
    {
      id: 'volatility_based',
      name: 'Volatility-Based',
      description: 'Adjust TP/SL based on ATR (Average True Range)',
      enabled: true,
      settings: {
        atrPeriod: 14,
        atrMultiplier: 2.0,
        minDistance: '1%',
        maxDistance: '10%'
      }
    },
    {
      id: 'support_resistance',
      name: 'Support/Resistance',
      description: 'Place SL below support, TP above resistance',
      enabled: true,
      settings: {
        lookbackPeriod: 20,
        buffer: '0.5%'
      }
    },
    {
      id: 'trailing_stop',
      name: 'Trailing Stop',
      description: 'Move SL as price moves in favor',
      enabled: true,
      settings: {
        activationPercent: '2%',
        trailingDistance: '1.5%',
        stepSize: '0.5%'
      }
    },
    {
      id: 'time_based',
      name: 'Time-Based',
      description: 'Tighten SL over time',
      enabled: false,
      settings: {
        initialSL: '3%',
        finalSL: '1%',
        duration: '24h'
      }
    }
  ],

  profitProtection: {
    breakEven: {
      enabled: true,
      triggerPercent: '1.5%',
      offsetPercent: '0.2%'
    },
    partialProfit: {
      enabled: true,
      levels: [
        { triggerPercent: '2%', closePercent: '25%' },
        { triggerPercent: '4%', closePercent: '25%' },
        { triggerPercent: '6%', closePercent: '25%' }
      ]
    }
  }
};
```

### 3. News & Sentiment Monitor ($5/mo)

#### News Feed Widget
```javascript
const newsSentimentWidget = {
  liveNews: [
    {
      id: 'news_123',
      timestamp: '2025-10-25T14:45:00Z',
      source: 'Reuters',
      title: 'Fed Chair Powell Hints at Rate Cut',
      impact: 'HIGH',
      sentiment: 72, // Bullish
      affectedAssets: ['USD', 'EUR', 'BTC'],

      analysis: {
        summary: 'Bullish for risk assets',
        expectedMove: 'USD weakness, crypto strength',
        tradingRecommendation: 'Consider long positions on BTC/USDT'
      },

      autoActions: {
        pauseTrading: false,
        adjustRisk: true,
        newRiskLevel: '3%' // from 2%
      }
    }
  ],

  economicCalendar: [
    {
      time: '2025-10-25T15:30:00Z',
      event: 'US Unemployment Claims',
      currency: 'USD',
      impact: 'MEDIUM',
      forecast: '215K',
      previous: '218K',

      settings: {
        pauseBefore: '15min',
        pauseAfter: '5min',
        resumeCondition: 'Manual' | 'Automatic'
      }
    }
  ],

  sentimentScore: {
    overall: 65, // Bullish
    crypto: 72,
    forex: 58,
    stocks: 61,

    breakdown: {
      news: 70,
      social: 68,
      onchain: 75,
      technical: 60
    },

    trend: 'INCREASING', // Last 24h
    confidence: 85
  },

  tradingStatus: {
    active: true,
    pausedUntil: null,
    reason: null,
    affectedPairs: []
  }
};
```

---

## 🤖 AI CHATBOT

### Chat Interface
```
┌─────────────────────────────────────────────────┐
│  💬 AI Trading Assistant                    [×] │
├─────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐  │
│  │  Chat History                            │  │
│  │                                          │  │
│  │  You: I have $5,000 and want moderate   │  │
│  │       risk. Recommend a portfolio.      │  │
│  │                                          │  │
│  │  🤖 AI: Based on your $5,000 capital    │  │
│  │      and moderate risk profile...       │  │
│  │                                          │  │
│  │      Recommended Portfolio:             │  │
│  │      ┌───────────────────────────┐      │  │
│  │      │ 40% - 7RSI Strategy       │      │  │
│  │      │ • Expected: 15%/mo        │      │  │
│  │      │ • Max DD: -8%             │      │  │
│  │      │ • Cost: $99 one-time      │      │  │
│  │      ├───────────────────────────┤      │  │
│  │      │ 30% - MACD Grid           │      │  │
│  │      │ • Expected: 10%/mo        │      │  │
│  │      │ • Max DD: -5%             │      │  │
│  │      │ • Cost: $79 one-time      │      │  │
│  │      ├───────────────────────────┤      │  │
│  │      │ 30% - AI Signal Provider  │      │  │
│  │      │ • Expected: 12%/mo        │      │  │
│  │      │ • Max DD: -6%             │      │  │
│  │      │ • Cost: $3/mo             │      │  │
│  │      └───────────────────────────┘      │  │
│  │                                          │  │
│  │      Total Expected Monthly: 12.5%      │  │
│  │      Total Risk (Max DD): 6.5%          │  │
│  │      Risk-Reward Ratio: 1:1.9           │  │
│  │                                          │  │
│  │      Add-Ons Recommended:               │  │
│  │      • AI Risk Manager ($10/mo)         │  │
│  │      • Server Account ($25/mo)          │  │
│  │                                          │  │
│  │      [Apply Portfolio] [Customize]      │  │
│  │                                          │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Type your message...                     [➤]  │
└─────────────────────────────────────────────────┘
```

### AI Capabilities
```javascript
const aiChatbot = {
  capabilities: [
    {
      name: 'Portfolio Recommendation',
      description: 'Suggest optimal portfolio based on user profile',
      inputs: ['capital', 'riskTolerance', 'timeHorizon', 'preferences'],
      outputs: ['strategies', 'allocation', 'expectedReturns', 'costs']
    },
    {
      name: 'Risk Assessment',
      description: 'Analyze portfolio risk and suggest improvements',
      inputs: ['currentPortfolio', 'marketConditions'],
      outputs: ['riskScore', 'diversificationScore', 'recommendations']
    },
    {
      name: 'Strategy Analysis',
      description: 'Deep dive into strategy performance and suitability',
      inputs: ['strategyId', 'userProfile'],
      outputs: ['analysis', 'pros', 'cons', 'suitability', 'alternatives']
    },
    {
      name: 'Market Insights',
      description: 'Provide market analysis and trading ideas',
      inputs: ['assets', 'timeframe'],
      outputs: ['marketOverview', 'opportunities', 'risks']
    },
    {
      name: 'Education',
      description: 'Explain trading concepts and strategies',
      inputs: ['question'],
      outputs: ['explanation', 'examples', 'resources']
    }
  ],

  prompts: {
    systemPrompt: `You are an expert trading assistant for AutomatedTradeBot platform.
Your role is to help users:
1. Find suitable trading strategies based on their risk profile
2. Build optimal portfolios with proper diversification
3. Understand risk management and position sizing
4. Analyze strategy performance metrics
5. Learn about trading concepts

Be professional, data-driven, and always emphasize risk management.
Provide specific numbers and calculations when recommending portfolios.`,

    portfolioRecommendation: `Analyze this user profile and recommend an optimal portfolio:
- Capital: {capital}
- Risk Tolerance: {riskTolerance}
- Time Horizon: {timeHorizon}
- Preferred Assets: {assets}
- Current Experience: {experience}

Consider available strategies and provide:
1. Portfolio allocation (% per strategy)
2. Expected monthly return
3. Risk metrics (max DD, Sharpe ratio)
4. Total cost (one-time + monthly)
5. Recommended add-on features`,

    riskAssessment: `Assess the risk of this portfolio:
{portfolioDetails}

Provide:
1. Overall risk score (0-100)
2. Diversification analysis
3. Correlation matrix
4. Concentration risk
5. Recommendations for improvement`
  }
};
```

---

## 📊 PERFORMANCE CALCULATIONS

### Real-Time Metrics Engine
```javascript
class PerformanceCalculator {

  // Calculate ROI
  calculateROI(initialCapital, currentEquity) {
    return ((currentEquity - initialCapital) / initialCapital) * 100;
  }

  // Calculate Sharpe Ratio
  calculateSharpeRatio(returns, riskFreeRate = 0.02) {
    const avgReturn = this.average(returns);
    const stdDev = this.standardDeviation(returns);

    return (avgReturn - riskFreeRate) / stdDev;
  }

  // Calculate Sortino Ratio
  calculateSortinoRatio(returns, targetReturn = 0) {
    const avgReturn = this.average(returns);
    const downsideDeviation = this.downsideDeviation(returns, targetReturn);

    return (avgReturn - targetReturn) / downsideDeviation;
  }

  // Calculate Maximum Drawdown
  calculateMaxDrawdown(equityCurve) {
    let maxDD = 0;
    let peak = equityCurve[0];

    for (let i = 1; i < equityCurve.length; i++) {
      if (equityCurve[i] > peak) {
        peak = equityCurve[i];
      }

      const drawdown = (peak - equityCurve[i]) / peak * 100;
      if (drawdown > maxDD) {
        maxDD = drawdown;
      }
    }

    return maxDD;
  }

  // Calculate Win Rate
  calculateWinRate(trades) {
    const profitable = trades.filter(t => t.pnl > 0).length;
    return (profitable / trades.length) * 100;
  }

  // Calculate Profit Factor
  calculateProfitFactor(trades) {
    const grossProfit = trades
      .filter(t => t.pnl > 0)
      .reduce((sum, t) => sum + t.pnl, 0);

    const grossLoss = Math.abs(trades
      .filter(t => t.pnl < 0)
      .reduce((sum, t) => sum + t.pnl, 0));

    return grossProfit / grossLoss;
  }

  // Calculate Risk/Reward Ratio
  calculateRiskRewardRatio(entryPrice, stopLoss, takeProfit) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);

    return reward / risk;
  }

  // Helper: Standard Deviation
  standardDeviation(values) {
    const avg = this.average(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = this.average(squareDiffs);

    return Math.sqrt(avgSquareDiff);
  }

  // Helper: Downside Deviation
  downsideDeviation(returns, targetReturn) {
    const downsideReturns = returns
      .filter(r => r < targetReturn)
      .map(r => Math.pow(r - targetReturn, 2));

    return Math.sqrt(this.average(downsideReturns));
  }

  // Helper: Average
  average(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}
```

---

*This document will be continuously updated as features are implemented.*
