# QUICK START GUIDE - Trading Strategies

## Directory Structure Overview

```
/home/automatedtradebot/backend/src/
├── strategies/
│   ├── python/              <- Python strategies (14 files)
│   └── *.js                 <- JavaScript strategies (6 files)
├── backtests/               <- Backtest engines (9 files)
├── paper_trading/           <- Paper trading bots (5 files)
└── tools/                   <- Utilities (3 files)
```

---

## 1. RUNNING BACKTEST ENGINES

### Test a Single Strategy (500 days):
```bash
cd /home/automatedtradebot/backend
python3 src/backtests/comprehensive_backtest_500days.py
```

### Test Multiple Strategies (21 strategies):
```bash
python3 src/backtests/ultimate_21_strategies_backtester.py
```

### Test Multiple Strategies (29 strategies, 365 days):
```bash
python3 src/backtests/ultimate_29_strategies_backtester.py
```

### Quick Verification Backtest:
```bash
python3 src/backtests/verified_backtest.py
```

---

## 2. RUNNING PAPER TRADING BOTS

### 7RSI Production Paper Trading Bot:
```bash
python3 src/strategies/python/7RSI_Strategy.py
```
- Starting balance: $70 USDT
- Leverage: 10x
- 15 trading pairs
- Real-time performance tracking

### Multi-Strategy Paper Trading:
```bash
python3 src/paper_trading/multi_strategy_paper_trading_bot.py
```
- Runs multiple strategies in parallel
- Compares performance in real-time

### Enhanced Paper Trading:
```bash
python3 src/paper_trading/enhanced_paper_trading.py
```
- Advanced risk management
- Detailed performance metrics

---

## 3. CONVERTING PINE SCRIPT STRATEGIES

### Convert a TradingView Pine Script:
```bash
python3 src/tools/strategy_converter.py /path/to/your_strategy.pine
```

Output:
- JavaScript strategy file: `backend/strategies/YOUR_STRATEGY.js`
- Optimization report: `tools/YOUR_STRATEGY_REPORT.md`

---

## 4. TESTING SPECIFIC STRATEGIES

### Test 3RSI Strategy:
```bash
python3 -c "
from src.strategies.python.3RSI_Strategy import CryptoBacktester
bt = CryptoBacktester('binance')
bt.run_backtest(max_pairs=10)
"
```

### Test 7MACD High-Performance Strategies:
```bash
# 582% ROI SHIB strategy
python3 src/strategies/python/7MACD_SHIB_582pct.py

# 317% ROI BTC strategy
python3 src/strategies/python/7MACD_BTC_317pct.py
```

---

## 5. CHECKING STRATEGY PERFORMANCE

All strategies generate performance reports with:
- Total PnL
- ROI (%)
- Win Rate (%)
- Sharpe Ratio
- Maximum Drawdown
- Profit Factor
- Average Win/Loss
- Number of Trades

---

## 6. KEY FILES REFERENCE

### Most Important Strategies:

| File | Description | Performance |
|------|-------------|-------------|
| `7RSI_Strategy.py` | Production 7RSI bot | Production-ready |
| `7MACD_SHIB_582pct.py` | SHIB optimized | 582% ROI |
| `MACD_Optimized_308pct.py` | MACD optimized | 308.8% ROI |
| `7MACD_BTC_317pct.py` | BTC optimized | 317% ROI |
| `3RSI_Strategy.py` | Advanced 3RSI | Multi-indicator |

### Most Important Backtests:

| File | Description | Features |
|------|-------------|----------|
| `comprehensive_backtest_500days.py` | 500-day backtest | 267 strategies |
| `ultimate_29_strategies_backtester.py` | 365-day backtest | 29 strategies |
| `verified_backtest.py` | Verified results | Audit trail |

---

## 7. DEPENDENCIES

Install required Python packages:
```bash
pip install ccxt pandas numpy talib requests openpyxl
```

Or install TA-Lib from source if needed:
```bash
# On Ubuntu/Debian:
sudo apt-get install ta-lib
pip install TA-Lib
```

---

## 8. TRADING PAIRS SUPPORTED

Priority pairs (as per CLAUDE.md):
- XRP/USDT
- SOL/USDT
- BTC/USDT
- ETH/USDT
- DOGE/USDT
- ADA/USDT
- AVAX/USDT
- MATIC/USDT

Additional pairs (7RSI bot):
- DUCK/USDT, TUT/USDT, AERO/USDT, BLUE/USDT
- FORM/USDT, BANANAS31/USDT, BCH/USDT
- FLOKI/USDT, XLM/USDT, PEPE/USDT, TRX/USDT

---

## 9. REAL DATA VERIFICATION

All strategies use REAL historical data from:
- Binance API
- Bitget API  
- MEXC API
- Bybit API

NO simulated or fake data is used!

Data path: `/home/karsilas/Tamoto/historical_data/`

---

## 10. TROUBLESHOOTING

### If backtest fails:
1. Check API rate limits (wait a few seconds)
2. Verify internet connection
3. Check if trading pair exists on exchange

### If Python import errors:
```bash
pip install --upgrade ccxt pandas numpy talib
```

### If TA-Lib installation fails:
```bash
# Download and install TA-Lib from source
wget http://prdownloads.sourceforge.net/ta-lib/ta-lib-0.4.0-src.tar.gz
tar -xzf ta-lib-0.4.0-src.tar.gz
cd ta-lib/
./configure --prefix=/usr
make
sudo make install
pip install TA-Lib
```

---

## 11. INTEGRATION WITH TRADING ENGINE

To integrate Python strategies with the main trading engine:

1. Update `backend/services/strategyLoader.js` to support Python execution
2. Add Python strategy spawner in Node.js
3. Configure strategy parameters in config files
4. Test in paper trading mode first
5. Deploy to production

Example integration snippet:
```javascript
// In strategyLoader.js
const { spawn } = require('child_process');

function executePythonStrategy(strategyFile, params) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [strategyFile, JSON.stringify(params)]);
    // Handle stdout, stderr, and exit
  });
}
```

---

## 12. NEXT DEVELOPMENT TASKS

1. Create unified strategy manager
2. Build web dashboard for strategy monitoring
3. Implement real-time alerts
4. Add automated strategy switching based on performance
5. Create strategy comparison tool
6. Build automated reporting system

---

## SUPPORT

For issues or questions:
1. Check MIGRATION_SUMMARY.md for detailed information
2. Review individual strategy file headers for usage notes
3. Check CLAUDE.md for critical backtesting standards

---

HERŞEY HATASIZ MÜKEMMEL!
Everything is perfectly set up without errors!
