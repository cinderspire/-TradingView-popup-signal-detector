// Backtest Simulator - Realistic market simulation with slippage, spread, and volatility
// Uses REAL historical data with realistic trading conditions

import settings from '../config/settings.js';
import { Helpers } from '../utils/helpers.js';

export class BacktestSimulator {
  constructor(dataService, strategyLoader) {
    this.dataService = dataService;
    this.strategyLoader = strategyLoader;
  }

  /**
   * Run backtest with realistic simulation mode
   * Includes: dynamic slippage, spread simulation, order rejection, partial fills
   */
  async runRealisticBacktest(strategyName, pair, timeframe = '1h', dateRange = null, params = null, simulationOptions = {}) {
    const {
      enableDynamicSlippage = true,
      enableSpreadSimulation = true,
      enableOrderRejection = true,
      enablePartialFills = false,
      marketImpact = 'low', // low, medium, high
      volatilityAdjustment = true
    } = simulationOptions;

    // Load strategy
    const strategy = this.strategyLoader.getStrategy(strategyName);
    if (!strategy) throw new Error(`Strategy ${strategyName} not found`);

    // Load REAL historical data
    const allCandles = await this.dataService.loadHistoricalData(pair, timeframe);
    if (!allCandles || allCandles.length === 0) {
      throw new Error(`No historical data for ${pair} ${timeframe}`);
    }

    // Initialize strategy
    const strategyParams = params || strategy.params;
    const indicators = strategy.init(allCandles, strategyParams);

    // Determine test range
    let testStartIndex = 0;
    let testEndIndex = allCandles.length - 1;

    if (dateRange) {
      testStartIndex = allCandles.findIndex(c => c[0] >= dateRange.start);
      for (let i = allCandles.length - 1; i >= 0; i--) {
        if (allCandles[i][0] <= dateRange.end) {
          testEndIndex = i;
          break;
        }
      }
      if (testStartIndex === -1) testStartIndex = 0;
    }

    console.log(`\n🎮 REALISTIC Backtest: ${strategyName} on ${pair} ${timeframe}`);
    console.log(`   Mode: Slippage=${enableDynamicSlippage}, Spread=${enableSpreadSimulation}, Rejection=${enableOrderRejection}`);
    console.log(`   Data: ${allCandles.length} candles, Testing: ${testEndIndex - testStartIndex + 1}`);

    // Simulation state
    let capital = settings.initialCapital;
    let position = null;
    const trades = [];
    const equityCurve = [capital];
    const rejectedOrders = [];

    // Calculate volatility for dynamic adjustments
    const volatility = this.calculateVolatility(allCandles.slice(testStartIndex, testEndIndex + 1));

    // Iterate through candles
    for (let i = testStartIndex; i <= testEndIndex; i++) {
      const candle = allCandles[i];
      const [timestamp, open, high, low, close, volume] = candle;

      // Calculate realistic spread based on volatility
      const spread = enableSpreadSimulation ? this.calculateSpread(close, volatility, volume) : 0;

      // Get strategy signal
      const signal = strategy.next(i, allCandles, indicators, strategyParams);

      if (!signal) {
        const positionValue = position ? position.size * close : 0;
        equityCurve.push(capital + positionValue);
        continue;
      }

      // Entry signal
      if (signal.signal === 'buy' && !position) {
        // Check order rejection conditions
        if (enableOrderRejection && this.shouldRejectOrder(volume, volatility)) {
          rejectedOrders.push({
            timestamp,
            type: 'buy',
            reason: 'Low liquidity',
            price: signal.price
          });
          console.log(`  ⚠️  Order REJECTED: ${pair} @ ${signal.price.toFixed(4)} - Low liquidity`);
          continue;
        }

        const positionSize = capital * settings.positionSize;
        const fee = positionSize * settings.tradingFee;

        // Calculate realistic slippage
        let slippage = settings.slippage;
        if (enableDynamicSlippage) {
          slippage = this.calculateDynamicSlippage(volatility, volume, marketImpact);
        }

        // Entry price = signal price + spread/2 + slippage
        const entryPrice = signal.price + (spread / 2) + (signal.price * slippage);

        // Partial fill simulation
        let fillSize = positionSize;
        if (enablePartialFills && volume < 100000) {
          fillSize = positionSize * 0.7; // Only 70% filled
          console.log(`  📉 PARTIAL FILL: Only ${(fillSize / positionSize * 100).toFixed(0)}% filled`);
        }

        position = {
          type: 'long',
          entryPrice,
          entryTime: timestamp,
          size: fillSize / entryPrice,
          cost: fillSize + fee,
          stopLoss: signal.stopLoss || null,
          takeProfit: signal.takeProfit || null,
          reason: signal.reason,
          spread,
          slippage: slippage * 100
        };

        capital -= (fillSize + fee);
        console.log(`  🟢 BUY ${pair} @ ${entryPrice.toFixed(4)} (spread: ${spread.toFixed(4)}, slippage: ${(slippage * 100).toFixed(2)}%)`);
      }

      // Exit signal or stop/TP hit
      if (position && (signal.signal === 'sell' ||
          (position.stopLoss && close <= position.stopLoss) ||
          (position.takeProfit && close >= position.takeProfit))) {

        const exitReason = signal.signal === 'sell' ? signal.reason :
                          (close <= position.stopLoss ? 'Stop Loss' : 'Take Profit');

        // Calculate exit slippage
        let exitSlippage = settings.slippage;
        if (enableDynamicSlippage) {
          exitSlippage = this.calculateDynamicSlippage(volatility, volume, marketImpact);
        }

        // Exit price = signal price - spread/2 - slippage (worse for sells)
        let basePrice = signal.signal === 'sell' ? signal.price :
                        (close <= position.stopLoss ? position.stopLoss : position.takeProfit);

        const exitPrice = basePrice - (spread / 2) - (basePrice * exitSlippage);

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
          exitReason,
          entrySpread: position.spread,
          exitSpread: spread,
          entrySlippage: position.slippage,
          exitSlippage: exitSlippage * 100
        });

        console.log(`  🔴 SELL ${pair} @ ${exitPrice.toFixed(4)} - ${exitReason} | PnL: ${pnl.toFixed(2)} (${trades[trades.length - 1].pnlPercent.toFixed(2)}%)`);

        position = null;
      }

      // Update equity
      const positionValue = position ? position.size * close : 0;
      equityCurve.push(capital + positionValue);
    }

    // Calculate metrics
    const metrics = this.calculateMetrics(trades, equityCurve, settings.initialCapital);

    console.log(`   ✓ Realistic backtest complete: ${trades.length} trades, ${rejectedOrders.length} rejected`);
    console.log(`     Win Rate: ${metrics.winRate.toFixed(2)}%, ROI: ${metrics.roi.toFixed(2)}%, Max DD: ${metrics.maxDrawdown.toFixed(2)}%\n`);

    return {
      strategy: strategyName,
      pair,
      timeframe,
      dateRange,
      params: strategyParams,
      trades,
      equityCurve,
      metrics,
      rejectedOrders,
      simulationOptions,
      realism: {
        avgEntrySlippage: trades.length > 0 ? trades.reduce((sum, t) => sum + t.entrySlippage, 0) / trades.length : 0,
        avgExitSlippage: trades.length > 0 ? trades.reduce((sum, t) => sum + t.exitSlippage, 0) / trades.length : 0,
        avgSpread: trades.length > 0 ? trades.reduce((sum, t) => sum + (t.entrySpread || 0), 0) / trades.length : 0,
        orderRejectionRate: (rejectedOrders.length / Math.max(trades.length + rejectedOrders.length, 1)) * 100,
        volatilityLevel: volatility
      }
    };
  }

  /**
   * Calculate market volatility (ATR-based)
   */
  calculateVolatility(candles) {
    if (candles.length < 14) return 0.01; // Default low volatility

    let atrSum = 0;
    for (let i = 1; i < Math.min(candles.length, 14); i++) {
      const high = candles[i][2];
      const low = candles[i][3];
      const prevClose = candles[i - 1][4];
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      atrSum += tr;
    }

    const atr = atrSum / 14;
    const avgPrice = candles.slice(-14).reduce((sum, c) => sum + c[4], 0) / 14;
    return atr / avgPrice; // ATR as percentage of price
  }

  /**
   * Calculate dynamic slippage based on volatility and market impact
   */
  calculateDynamicSlippage(volatility, volume, marketImpact) {
    const baseSlippage = settings.slippage;

    // Volatility multiplier (higher volatility = more slippage)
    const volatilityMultiplier = 1 + (volatility * 10);

    // Volume multiplier (lower volume = more slippage)
    const volumeMultiplier = volume < 50000 ? 1.5 : volume < 100000 ? 1.2 : 1.0;

    // Market impact multiplier
    const impactMultiplier = marketImpact === 'high' ? 2.0 : marketImpact === 'medium' ? 1.5 : 1.0;

    return baseSlippage * volatilityMultiplier * volumeMultiplier * impactMultiplier;
  }

  /**
   * Calculate realistic spread based on market conditions
   */
  calculateSpread(price, volatility, volume) {
    // Base spread (0.05% for crypto)
    const baseSpread = price * 0.0005;

    // Volatility increases spread
    const volatilitySpread = price * volatility * 0.5;

    // Low volume increases spread
    const volumeSpread = volume < 50000 ? price * 0.001 : volume < 100000 ? price * 0.0005 : 0;

    return baseSpread + volatilitySpread + volumeSpread;
  }

  /**
   * Determine if order should be rejected
   */
  shouldRejectOrder(volume, volatility) {
    // Reject if extremely low volume and high volatility
    if (volume < 10000 && volatility > 0.05) {
      return Math.random() < 0.3; // 30% rejection rate
    }
    if (volume < 5000) {
      return Math.random() < 0.5; // 50% rejection rate
    }
    return false;
  }

  /**
   * Calculate metrics (same as BacktestEngine)
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
}

export default BacktestSimulator;
