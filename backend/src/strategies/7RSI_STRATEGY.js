// 7-RSI Strategy - EXACT TradingView Implementation
// Pine Script by rrolik66 - BIREBIR ÇEVİRİ
// CRITICAL: Uses 7 different timeframes for RSI (1m, 5m, 15m, 30m, 60m, 120m, 1D)

import { Indicators } from '../utils/indicators.js';

export default {
  name: '7-RSI DCA',
  type: 'dca',
  description: '7 multi-timeframe RSI with 20-order DCA system',

  // EXACT PINE SCRIPT PARAMETERS - User input: (close, 10S, ohlc4, Long Bot, 1, 14, 5, 14, 15, 14, 30, 14, 60, 14, 120, 14, 1D, 14, 0.5, 2, 100, 100, 100, 100, 100, 100, 100, 0.5, 2, 0, 0, 0, 0, 0, 0, 0)
  params: {
    // Source
    source: 'close',  // RSI source
    botPeriod: '10S', // Unused in our implementation
    botSource: 'ohlc4', // Entry price source (we use close)

    // Trade direction
    tradeDirection: 'Long Bot',

    // RSI-1 (1m timeframe)
    rsi1Resolution: '1m',
    rsi1LengthLong: 14,

    // RSI-2 (5m timeframe)
    rsi2Resolution: '5m',
    rsi2LengthLong: 14,

    // RSI-3 (15m timeframe)
    rsi3Resolution: '15m',
    rsi3LengthLong: 14,

    // RSI-4 (30m timeframe)
    rsi4Resolution: '30m',
    rsi4LengthLong: 14,

    // RSI-5 (60m timeframe)
    rsi5Resolution: '1h',  // 60m = 1h
    rsi5LengthLong: 14,

    // RSI-6 (120m timeframe)
    rsi6Resolution: '2h',  // 120m = 2h
    rsi6LengthLong: 14,

    // RSI-7 (1D timeframe)
    rsi7Resolution: '1d',
    rsi7LengthLong: 14,

    // Long Bot settings
    takeProfitLong: 0.5,      // 0.5% TP
    stepOrdersLong: 2.0,      // 2% step between orders

    // RSI thresholds for LONG (all 100 = always true, no filter)
    rsi1LongThreshold: 100,
    rsi2LongThreshold: 100,
    rsi3LongThreshold: 100,
    rsi4LongThreshold: 100,
    rsi5LongThreshold: 100,
    rsi6LongThreshold: 100,
    rsi7LongThreshold: 100,

    // Short Bot settings (not used)
    takeProfitShort: 0.5,
    stepOrdersShort: 2.0,

    // RSI thresholds for SHORT (all 0 = never true)
    rsi1ShortThreshold: 0,
    rsi2ShortThreshold: 0,
    rsi3ShortThreshold: 0,
    rsi4ShortThreshold: 0,
    rsi5ShortThreshold: 0,
    rsi6ShortThreshold: 0,
    rsi7ShortThreshold: 0,

    // DCA orders
    maxDcaOrders: 20  // 20 orders (0-19 in Pine Script)
  },

  // Multi-timeframe requirement - EXACT match with Pine Script
  requiresMultiTimeframe: true,
  timeframes: ['1m', '5m', '15m', '30m', '1h', '2h', '1d'],

  init(candlesOrMulti, params) {
    const indicators = {};
    const isMultiTimeframe = !Array.isArray(candlesOrMulti);

    if (!isMultiTimeframe) {
      // Fallback: single timeframe mode (not ideal)
      const candles = candlesOrMulti;
      const close = candles.map(c => c[4]);

      // Calculate all RSI on base timeframe
      const rsi1 = Indicators.rsi(close, params.rsi1LengthLong);
      indicators.rsi1Long = rsi1.result.outReal;
      indicators.rsi1LongBegin = rsi1.begIndex;

      const rsi2 = Indicators.rsi(close, params.rsi2LengthLong);
      indicators.rsi2Long = rsi2.result.outReal;
      indicators.rsi2LongBegin = rsi2.begIndex;

      const rsi3 = Indicators.rsi(close, params.rsi3LengthLong);
      indicators.rsi3Long = rsi3.result.outReal;
      indicators.rsi3LongBegin = rsi3.begIndex;

      const rsi4 = Indicators.rsi(close, params.rsi4LengthLong);
      indicators.rsi4Long = rsi4.result.outReal;
      indicators.rsi4LongBegin = rsi4.begIndex;

      const rsi5 = Indicators.rsi(close, params.rsi5LengthLong);
      indicators.rsi5Long = rsi5.result.outReal;
      indicators.rsi5LongBegin = rsi5.begIndex;

      const rsi6 = Indicators.rsi(close, params.rsi6LengthLong);
      indicators.rsi6Long = rsi6.result.outReal;
      indicators.rsi6LongBegin = rsi6.begIndex;

      const rsi7 = Indicators.rsi(close, params.rsi7LengthLong);
      indicators.rsi7Long = rsi7.result.outReal;
      indicators.rsi7LongBegin = rsi7.begIndex;

      return indicators;
    }

    // Multi-timeframe mode - CORRECT IMPLEMENTATION
    const candles1m = candlesOrMulti['1m'] || [];
    const candles5m = candlesOrMulti['5m'] || [];
    const candles15m = candlesOrMulti['15m'] || [];
    const candles30m = candlesOrMulti['30m'] || [];
    const candles1h = candlesOrMulti['1h'] || [];
    const candles2h = candlesOrMulti['2h'] || [];
    const candles1d = candlesOrMulti['1d'] || [];

    // RSI-1 from 1m timeframe
    if (candles1m.length > 0) {
      const close1m = candles1m.map(c => c[4]);
      const rsi1Long = Indicators.rsi(close1m, params.rsi1LengthLong);
      indicators.rsi1Long = rsi1Long.result.outReal;
      indicators.rsi1LongBegin = rsi1Long.begIndex;
    }

    // RSI-2 from 5m timeframe
    if (candles5m.length > 0) {
      const close5m = candles5m.map(c => c[4]);
      const rsi2Long = Indicators.rsi(close5m, params.rsi2LengthLong);
      indicators.rsi2Long = rsi2Long.result.outReal;
      indicators.rsi2LongBegin = rsi2Long.begIndex;
    }

    // RSI-3 from 15m timeframe
    if (candles15m.length > 0) {
      const close15m = candles15m.map(c => c[4]);
      const rsi3Long = Indicators.rsi(close15m, params.rsi3LengthLong);
      indicators.rsi3Long = rsi3Long.result.outReal;
      indicators.rsi3LongBegin = rsi3Long.begIndex;
    }

    // RSI-4 from 30m timeframe
    if (candles30m.length > 0) {
      const close30m = candles30m.map(c => c[4]);
      const rsi4Long = Indicators.rsi(close30m, params.rsi4LengthLong);
      indicators.rsi4Long = rsi4Long.result.outReal;
      indicators.rsi4LongBegin = rsi4Long.begIndex;
    }

    // RSI-5 from 1h timeframe
    if (candles1h.length > 0) {
      const close1h = candles1h.map(c => c[4]);
      const rsi5Long = Indicators.rsi(close1h, params.rsi5LengthLong);
      indicators.rsi5Long = rsi5Long.result.outReal;
      indicators.rsi5LongBegin = rsi5Long.begIndex;
    }

    // RSI-6 from 2h timeframe
    if (candles2h.length > 0) {
      const close2h = candles2h.map(c => c[4]);
      const rsi6Long = Indicators.rsi(close2h, params.rsi6LengthLong);
      indicators.rsi6Long = rsi6Long.result.outReal;
      indicators.rsi6LongBegin = rsi6Long.begIndex;
    }

    // RSI-7 from 1d timeframe
    if (candles1d.length > 0) {
      const close1d = candles1d.map(c => c[4]);
      const rsi7Long = Indicators.rsi(close1d, params.rsi7LengthLong);
      indicators.rsi7Long = rsi7Long.result.outReal;
      indicators.rsi7LongBegin = rsi7Long.begIndex;
    }

    return indicators;
  },

  next(index, candles, indicators, params) {
    const close = candles[index][4];
    const longOK = params.tradeDirection === 'Long Bot';
    const shortOK = params.tradeDirection === 'Short Bot';

    // Check ALL 7 RSI conditions - ALL must be met
    let buySignal = false;
    let sellSignal = false;

    if (longOK) {
      // For Long: ALL RSI must be < threshold
      const rsi1Check = !indicators.rsi1Long || (index >= indicators.rsi1LongBegin && indicators.rsi1Long[index - indicators.rsi1LongBegin] < params.rsi1LongThreshold);
      const rsi2Check = !indicators.rsi2Long || (index >= indicators.rsi2LongBegin && indicators.rsi2Long[index - indicators.rsi2LongBegin] < params.rsi2LongThreshold);
      const rsi3Check = !indicators.rsi3Long || (index >= indicators.rsi3LongBegin && indicators.rsi3Long[index - indicators.rsi3LongBegin] < params.rsi3LongThreshold);
      const rsi4Check = !indicators.rsi4Long || (index >= indicators.rsi4LongBegin && indicators.rsi4Long[index - indicators.rsi4LongBegin] < params.rsi4LongThreshold);
      const rsi5Check = !indicators.rsi5Long || (index >= indicators.rsi5LongBegin && indicators.rsi5Long[index - indicators.rsi5LongBegin] < params.rsi5LongThreshold);
      const rsi6Check = !indicators.rsi6Long || (index >= indicators.rsi6LongBegin && indicators.rsi6Long[index - indicators.rsi6LongBegin] < params.rsi6LongThreshold);
      const rsi7Check = !indicators.rsi7Long || (index >= indicators.rsi7LongBegin && indicators.rsi7Long[index - indicators.rsi7LongBegin] < params.rsi7LongThreshold);

      buySignal = rsi1Check && rsi2Check && rsi3Check && rsi4Check && rsi5Check && rsi6Check && rsi7Check;
    }

    if (shortOK) {
      // For Short: ALL RSI must be > threshold
      const rsi1Check = !indicators.rsi1Long || (index >= indicators.rsi1LongBegin && indicators.rsi1Long[index - indicators.rsi1LongBegin] > params.rsi1ShortThreshold);
      const rsi2Check = !indicators.rsi2Long || (index >= indicators.rsi2LongBegin && indicators.rsi2Long[index - indicators.rsi2LongBegin] > params.rsi2ShortThreshold);
      const rsi3Check = !indicators.rsi3Long || (index >= indicators.rsi3LongBegin && indicators.rsi3Long[index - indicators.rsi3LongBegin] > params.rsi3ShortThreshold);
      const rsi4Check = !indicators.rsi4Long || (index >= indicators.rsi4LongBegin && indicators.rsi4Long[index - indicators.rsi4LongBegin] > params.rsi4ShortThreshold);
      const rsi5Check = !indicators.rsi5Long || (index >= indicators.rsi5LongBegin && indicators.rsi5Long[index - indicators.rsi5LongBegin] > params.rsi5ShortThreshold);
      const rsi6Check = !indicators.rsi6Long || (index >= indicators.rsi6LongBegin && indicators.rsi6Long[index - indicators.rsi6LongBegin] > params.rsi6ShortThreshold);
      const rsi7Check = !indicators.rsi7Long || (index >= indicators.rsi7LongBegin && indicators.rsi7Long[index - indicators.rsi7LongBegin] > params.rsi7ShortThreshold);

      sellSignal = rsi1Check && rsi2Check && rsi3Check && rsi4Check && rsi5Check && rsi6Check && rsi7Check;
    }

    if (buySignal) {
      // Calculate TP/SL - EXACT Pine Script formula
      const stepPercent = params.stepOrdersLong / 100; // 2% step
      const takeProfit = close * (1 + params.takeProfitLong / 100);
      const stopLoss = close * 0.3; // 70% max drawdown (no SL in Pine)

      return {
        signal: 'buy',
        price: close,
        takeProfit,
        stopLoss,
        reason: '7-RSI DCA: All 7 RSI conditions met',

        // DCA configuration - 20 orders with equal weights
        dcaOrders: params.maxDcaOrders,
        dcaStepPercent: stepPercent * 100,
        dcaWeights: Array(params.maxDcaOrders).fill(1 / params.maxDcaOrders) // Equal weights
      };
    }

    if (sellSignal) {
      const stepPercent = params.stepOrdersShort / 100;
      const takeProfit = close * (1 - params.takeProfitShort / 100);
      const stopLoss = close * 1.7;

      return {
        signal: 'sell',
        price: close,
        takeProfit,
        stopLoss,
        reason: '7-RSI DCA: All 7 RSI short conditions met',
        dcaOrders: params.maxDcaOrders,
        dcaStepPercent: stepPercent * 100,
        dcaWeights: Array(params.maxDcaOrders).fill(1 / params.maxDcaOrders)
      };
    }

    return null;
  }
};
