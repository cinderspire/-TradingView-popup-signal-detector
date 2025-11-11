// Backtest Engine - Real historical data backtesting with fees and slippage
// CRITICAL: Uses ONLY real downloaded OHLCV data - NO SIMULATIONS

import settings from '../config/settings.js';
import { Helpers } from '../utils/helpers.js';

export class BacktestEngine {
  constructor(dataService, strategyLoader) {
    this.dataService = dataService;
    this.strategyLoader = strategyLoader;
  }

  /**
   * Run backtest for a strategy on a pair
   * @param {String} strategyName - Strategy to test
   * @param {String} pair - Trading pair
   * @param {String} timeframe - Timeframe
   * @param {Object} dateRange - {start, end} timestamps
   * @param {Object} params - Strategy parameters (optional)
   * @param {Boolean} skipDownload - If true, skip pairs without data (for batch tests)
   */
  async runBacktest(strategyName, pair, timeframe = '1h', dateRange = null, params = null, skipDownload = false) {
    // Load strategy
    const strategy = this.strategyLoader.getStrategy(strategyName);
    if (!strategy) throw new Error(`Strategy ${strategyName} not found`);

    const strategyParams = params || strategy.params;
    let allCandles, indicators;

    // Check if strategy requires multi-timeframe data
    if (strategy.requiresMultiTimeframe && strategy.timeframes) {
      // Load data for all required timeframes
      const multiTimeframeCandles = {};

      for (const tf of strategy.timeframes) {
        try {
          const tfCandles = await this.dataService.loadHistoricalData(pair, tf, skipDownload);
          if (tfCandles && tfCandles.length > 0) {
            multiTimeframeCandles[tf] = tfCandles;
          }
        } catch (err) {
          console.warn(`⚠️  Failed to load ${tf} data for ${pair}: ${err.message}`);
        }
      }

      // Initialize indicators with multi-timeframe data
      indicators = strategy.init(multiTimeframeCandles, strategyParams);

      // Primary candles are from the main timeframe
      allCandles = multiTimeframeCandles[timeframe] || [];

      if (!allCandles || allCandles.length === 0) {
        throw new Error(`No historical data for ${pair} ${timeframe}`);
      }
    } else {
      // Single timeframe mode (standard)
      allCandles = await this.dataService.loadHistoricalData(pair, timeframe, skipDownload);
      if (!allCandles || allCandles.length === 0) {
        throw new Error(`No historical data for ${pair} ${timeframe}`);
      }

      // Initialize strategy indicators with ALL candles (for warmup)
      indicators = strategy.init(allCandles, strategyParams);
    }

    // Determine which candles to backtest
    let testStartIndex = 0;
    let testEndIndex = allCandles.length - 1;

    if (dateRange) {
      // Find indices for date range
      testStartIndex = allCandles.findIndex(c => c[0] >= dateRange.start);

      // Find last candle within range (not the first one after)
      for (let i = allCandles.length - 1; i >= 0; i--) {
        if (allCandles[i][0] <= dateRange.end) {
          testEndIndex = i;
          break;
        }
      }

      if (testStartIndex === -1) testStartIndex = 0;
    }

    const testCandles = allCandles.slice(testStartIndex, testEndIndex + 1);

    console.log(`\n🔬 Backtesting ${strategyName} on ${pair} ${timeframe}`);
    console.log(`   Data: ${testCandles.length} candles (${new Date(testCandles[0][0]).toISOString()} - ${new Date(testCandles[testCandles.length - 1][0]).toISOString()})`);
    console.log(`   Using ${allCandles.length} total candles for indicator calculation`);

    // Backtest state
    let capital = settings.initialCapital;
    let position = null;
    const trades = [];
    const equityCurve = [capital];

    // Iterate through test range candles
    for (let i = testStartIndex; i <= testEndIndex; i++) {
      const candle = allCandles[i];
      const timestamp = candle[0];
      const close = candle[4];

      // Get strategy signal (use original index for indicator arrays)
      const signal = strategy.next(i, allCandles, indicators, strategyParams);

      if (!signal) {
        // Equity = Cash + Position Value
        const positionValue = position ? position.size * close : 0;
        equityCurve.push(capital + positionValue);
        continue;
      }

      // Entry signal
      if (signal.signal === 'buy' && !position) {
        const positionSize = capital * settings.positionSize;
        const fee = positionSize * settings.tradingFee;
        const slippage = signal.price * settings.slippage;
        const entryPrice = signal.price + slippage;

        position = {
          type: 'long',
          entryPrice,
          entryTime: timestamp,
          size: positionSize / entryPrice,
          cost: positionSize + fee,
          stopLoss: signal.stopLoss || null,
          takeProfit: signal.takeProfit || null,
          reason: signal.reason
        };

        capital -= (positionSize + fee);
      }

      // Exit signal or stop/TP hit
      if (position && (signal.signal === 'sell' ||
          (position.stopLoss && close <= position.stopLoss) ||
          (position.takeProfit && close >= position.takeProfit))) {

        const exitReason = signal.signal === 'sell' ? signal.reason :
                          (close <= position.stopLoss ? 'Stop Loss' : 'Take Profit');

        // Apply slippage on exit (always negative for sells)
        let exitPrice;
        if (signal.signal === 'sell') {
          exitPrice = signal.price - (signal.price * settings.slippage);
        } else if (close <= position.stopLoss) {
          exitPrice = position.stopLoss - (position.stopLoss * settings.slippage);
        } else {
          exitPrice = position.takeProfit - (position.takeProfit * settings.slippage);
        }

        const exitValue = position.size * exitPrice;
        const fee = exitValue * settings.tradingFee;
        const pnl = exitValue - position.cost - fee;

        capital += exitValue - fee;

        trades.push({
          pair,
          type: position.type,
          entryTime: position.entryTime,
          exitTime: timestamp,
          entryPrice: position.entryPrice,
          exitPrice,
          size: position.size,
          pnl,
          pnlPercent: (pnl / position.cost) * 100,
          holdingTime: timestamp - position.entryTime,
          entryReason: position.reason,
          exitReason
        });

        position = null;
      }

      // Update equity curve
      // Equity = Cash + Position Value
      const positionValue = position ? position.size * close : 0;
      equityCurve.push(capital + positionValue);
    }

    // Calculate metrics
    const metrics = this.calculateMetrics(trades, equityCurve, settings.initialCapital);

    console.log(`   ✓ Backtest complete: ${trades.length} trades, ${metrics.winRate.toFixed(2)}% win rate, ${metrics.roi.toFixed(2)}% ROI\n`);

    return {
      strategy: strategyName,
      pair,
      timeframe,
      dateRange,
      params: strategyParams,
      trades,
      equityCurve,
      metrics,
      candles: testCandles // Include test candles for chart display
    };
  }

  /**
   * Calculate performance metrics
   */
  calculateMetrics(trades, equityCurve, initialCapital) {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalProfit: 0,
        totalLoss: 0,
        netProfit: 0,
        roi: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        avgHoldingTime: 0,
        avgWin: 0,
        avgLoss: 0
      };
    }

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    const totalProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const netProfit = trades.reduce((sum, t) => sum + t.pnl, 0);

    const returns = trades.map(t => t.pnlPercent / 100);

    return {
      totalTrades: trades.length,
      winRate: Helpers.winRate(trades) * 100,
      totalProfit,
      totalLoss,
      netProfit,
      roi: (netProfit / initialCapital) * 100,
      profitFactor: Helpers.profitFactor(trades),
      sharpeRatio: Helpers.sharpeRatio(returns),
      sortinoRatio: Helpers.sortinoRatio(returns),
      maxDrawdown: Helpers.maxDrawdown(equityCurve) * 100,
      avgHoldingTime: trades.reduce((sum, t) => sum + t.holdingTime, 0) / trades.length,
      avgWin: wins.length > 0 ? totalProfit / wins.length : 0,
      avgLoss: losses.length > 0 ? totalLoss / losses.length : 0,
      finalCapital: equityCurve[equityCurve.length - 1]
    };
  }

  /**
   * Run batch backtest on multiple pairs
   */
  async runBatchBacktest(strategyName, pairs, timeframe = '1h', dateRange = null) {
    const results = [];

    console.log(`\n📊 Batch backtest: ${strategyName} on ${pairs.length} pairs\n`);

    for (const pair of pairs) {
      try {
        // Pass skipDownload=true for batch tests to avoid downloading during test
        const result = await this.runBacktest(strategyName, pair, timeframe, dateRange, null, true);
        results.push(result);
      } catch (err) {
        console.log(`⏭️  Skipped ${pair}: ${err.message}`);
        // Don't include failed pairs in results to keep output clean
      }
    }

    // Sort by ROI
    results.sort((a, b) => (b.metrics?.roi || 0) - (a.metrics?.roi || 0));

    console.log(`\n✅ Batch backtest complete! Tested ${results.length}/${pairs.length} pairs with data\n`);

    return results;
  }
}

export default BacktestEngine;
