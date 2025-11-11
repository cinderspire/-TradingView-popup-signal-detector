// 7-RSI DCA Strategy
// Based on TradingView strategy by rrolik66
// 7 multi-timeframe RSI indicators with 20-order DCA system
// CRITICAL: Requires multi-timeframe data (1m, 5m, 15m, 30m, 1h, 2h, 1d)

import { Indicators } from '../utils/indicators.js';

export default {
  name: '7-RSI DCA',
  type: 'trend',
  description: '7 multi-timeframe RSI with 20-order aggressive DCA',

  // Multi-timeframe requirement (matches TradingView security() calls)
  requiresMultiTimeframe: true,
  timeframes: ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '1d'],  // Added 3m for base timeframe

  // EXACT INPUTS FROM TRADINGVIEW
  params: {
    // Long Bot settings
    takeProfitLong: 0.5,     // 0.5% take profit
    stepOrdersLong: 2.0,     // 2% step between orders

    // Short Bot settings
    takeProfitShort: 0.5,    // 0.5% take profit
    stepOrdersShort: 2.0,    // 2% step between orders

    // RSI-1 (1m timeframe)
    rsi1LengthLong: 14,
    rsi1LongThreshold: 100,   // 100 = always true
    rsi1LengthShort: 14,
    rsi1ShortThreshold: 0,    // 0 = always true

    // RSI-2 (5m timeframe)
    rsi2LengthLong: 14,
    rsi2LongThreshold: 100,
    rsi2LengthShort: 14,
    rsi2ShortThreshold: 0,

    // RSI-3 (15m timeframe)
    rsi3LengthLong: 14,
    rsi3LongThreshold: 100,
    rsi3LengthShort: 14,
    rsi3ShortThreshold: 0,

    // RSI-4 (30m timeframe)
    rsi4LengthLong: 14,
    rsi4LongThreshold: 100,
    rsi4LengthShort: 14,
    rsi4ShortThreshold: 0,

    // RSI-5 (60m timeframe)
    rsi5LengthLong: 14,
    rsi5LongThreshold: 100,
    rsi5LengthShort: 14,
    rsi5ShortThreshold: 0,

    // RSI-6 (120m timeframe)
    rsi6LengthLong: 14,
    rsi6LongThreshold: 100,
    rsi6LengthShort: 14,
    rsi6ShortThreshold: 0,

    // RSI-7 (1D timeframe)
    rsi7LengthLong: 14,
    rsi7LongThreshold: 100,
    rsi7LengthShort: 14,
    rsi7ShortThreshold: 0,

    // Trading direction
    tradeDirection: 'Long Bot',  // 'Long Bot' or 'Short Bot'

    // DCA orders (20 orders total)
    dcaOrders: 20
  },

  init(candlesOrMulti, params) {
    const indicators = {};

    // Check if multi-timeframe data (object with timeframe keys) or single array
    const isMultiTimeframe = !Array.isArray(candlesOrMulti);

    if (isMultiTimeframe) {
      // Multi-timeframe mode - EXACT match with TradingView security() calls
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
        const rsi1Short = Indicators.rsi(close1m, params.rsi1LengthShort);
        indicators.rsi1Long = rsi1Long.result.outReal;
        indicators.rsi1Short = rsi1Short.result.outReal;
        indicators.rsi1LongBegin = rsi1Long.begIndex;
        indicators.rsi1ShortBegin = rsi1Short.begIndex;
      }

      // RSI-2 from 5m timeframe
      if (candles5m.length > 0) {
        const close5m = candles5m.map(c => c[4]);
        const rsi2Long = Indicators.rsi(close5m, params.rsi2LengthLong);
        const rsi2Short = Indicators.rsi(close5m, params.rsi2LengthShort);
        indicators.rsi2Long = rsi2Long.result.outReal;
        indicators.rsi2Short = rsi2Short.result.outReal;
        indicators.rsi2LongBegin = rsi2Long.begIndex;
        indicators.rsi2ShortBegin = rsi2Short.begIndex;
      }

      // RSI-3 from 15m timeframe
      if (candles15m.length > 0) {
        const close15m = candles15m.map(c => c[4]);
        const rsi3Long = Indicators.rsi(close15m, params.rsi3LengthLong);
        const rsi3Short = Indicators.rsi(close15m, params.rsi3LengthShort);
        indicators.rsi3Long = rsi3Long.result.outReal;
        indicators.rsi3Short = rsi3Short.result.outReal;
        indicators.rsi3LongBegin = rsi3Long.begIndex;
        indicators.rsi3ShortBegin = rsi3Short.begIndex;
      }

      // RSI-4 from 30m timeframe
      if (candles30m.length > 0) {
        const close30m = candles30m.map(c => c[4]);
        const rsi4Long = Indicators.rsi(close30m, params.rsi4LengthLong);
        const rsi4Short = Indicators.rsi(close30m, params.rsi4LengthShort);
        indicators.rsi4Long = rsi4Long.result.outReal;
        indicators.rsi4Short = rsi4Short.result.outReal;
        indicators.rsi4LongBegin = rsi4Long.begIndex;
        indicators.rsi4ShortBegin = rsi4Short.begIndex;
      }

      // RSI-5 from 1h timeframe
      if (candles1h.length > 0) {
        const close1h = candles1h.map(c => c[4]);
        const rsi5Long = Indicators.rsi(close1h, params.rsi5LengthLong);
        const rsi5Short = Indicators.rsi(close1h, params.rsi5LengthShort);
        indicators.rsi5Long = rsi5Long.result.outReal;
        indicators.rsi5Short = rsi5Short.result.outReal;
        indicators.rsi5LongBegin = rsi5Long.begIndex;
        indicators.rsi5ShortBegin = rsi5Short.begIndex;
      }

      // RSI-6 from 2h timeframe
      if (candles2h.length > 0) {
        const close2h = candles2h.map(c => c[4]);
        const rsi6Long = Indicators.rsi(close2h, params.rsi6LengthLong);
        const rsi6Short = Indicators.rsi(close2h, params.rsi6LengthShort);
        indicators.rsi6Long = rsi6Long.result.outReal;
        indicators.rsi6Short = rsi6Short.result.outReal;
        indicators.rsi6LongBegin = rsi6Long.begIndex;
        indicators.rsi6ShortBegin = rsi6Short.begIndex;
      }

      // RSI-7 from 1d timeframe
      if (candles1d.length > 0) {
        const close1d = candles1d.map(c => c[4]);
        const rsi7Long = Indicators.rsi(close1d, params.rsi7LengthLong);
        const rsi7Short = Indicators.rsi(close1d, params.rsi7LengthShort);
        indicators.rsi7Long = rsi7Long.result.outReal;
        indicators.rsi7Short = rsi7Short.result.outReal;
        indicators.rsi7LongBegin = rsi7Long.begIndex;
        indicators.rsi7ShortBegin = rsi7Short.begIndex;
      }
    } else {
      // Fallback: single timeframe mode (all 7 RSI from same data)
      // This is not correct per TradingView but provides backward compatibility
      const close = candlesOrMulti.map(c => c[4]);

      const rsi1Long = Indicators.rsi(close, params.rsi1LengthLong);
      const rsi1Short = Indicators.rsi(close, params.rsi1LengthShort);
      indicators.rsi1Long = rsi1Long.result.outReal;
      indicators.rsi1Short = rsi1Short.result.outReal;
      indicators.rsi1LongBegin = rsi1Long.begIndex;
      indicators.rsi1ShortBegin = rsi1Short.begIndex;

      // Copy same RSI for all 7 (not accurate but prevents crashes)
      for (let i = 2; i <= 7; i++) {
        indicators[`rsi${i}Long`] = indicators.rsi1Long;
        indicators[`rsi${i}Short`] = indicators.rsi1Short;
        indicators[`rsi${i}LongBegin`] = indicators.rsi1LongBegin;
        indicators[`rsi${i}ShortBegin`] = indicators.rsi1ShortBegin;
      }
    }

    return indicators;
  },

  next(index, candles, indicators, params) {
    const close = candles[index][4];
    const longOK = params.tradeDirection === 'Long Bot';
    const shortOK = params.tradeDirection === 'Short Bot';

    // Check all 7 RSI conditions - ALL must be true
    let buySignals = 0;
    let sellSignals = 0;

    // RSI-1
    if (indicators.rsi1Long) {
      const rsi1LongIdx = index - indicators.rsi1LongBegin;
      if (longOK && rsi1LongIdx >= 0 && rsi1LongIdx < indicators.rsi1Long.length) {
        const rsi1Val = indicators.rsi1Long[rsi1LongIdx];
        if (rsi1Val < params.rsi1LongThreshold) buySignals++;
      }
    }

    if (indicators.rsi1Short) {
      const rsi1ShortIdx = index - indicators.rsi1ShortBegin;
      if (shortOK && rsi1ShortIdx >= 0 && rsi1ShortIdx < indicators.rsi1Short.length) {
        const rsi1Val = indicators.rsi1Short[rsi1ShortIdx];
        if (rsi1Val > params.rsi1ShortThreshold) sellSignals++;
      }
    }

    // RSI-2
    if (indicators.rsi2Long) {
      const rsi2LongIdx = index - indicators.rsi2LongBegin;
      if (longOK && rsi2LongIdx >= 0 && rsi2LongIdx < indicators.rsi2Long.length) {
        const rsi2Val = indicators.rsi2Long[rsi2LongIdx];
        if (rsi2Val < params.rsi2LongThreshold) buySignals++;
      }
    }

    if (indicators.rsi2Short) {
      const rsi2ShortIdx = index - indicators.rsi2ShortBegin;
      if (shortOK && rsi2ShortIdx >= 0 && rsi2ShortIdx < indicators.rsi2Short.length) {
        const rsi2Val = indicators.rsi2Short[rsi2ShortIdx];
        if (rsi2Val > params.rsi2ShortThreshold) sellSignals++;
      }
    }

    // RSI-3
    if (indicators.rsi3Long) {
      const rsi3LongIdx = index - indicators.rsi3LongBegin;
      if (longOK && rsi3LongIdx >= 0 && rsi3LongIdx < indicators.rsi3Long.length) {
        const rsi3Val = indicators.rsi3Long[rsi3LongIdx];
        if (rsi3Val < params.rsi3LongThreshold) buySignals++;
      }
    }

    if (indicators.rsi3Short) {
      const rsi3ShortIdx = index - indicators.rsi3ShortBegin;
      if (shortOK && rsi3ShortIdx >= 0 && rsi3ShortIdx < indicators.rsi3Short.length) {
        const rsi3Val = indicators.rsi3Short[rsi3ShortIdx];
        if (rsi3Val > params.rsi3ShortThreshold) sellSignals++;
      }
    }

    // RSI-4
    if (indicators.rsi4Long) {
      const rsi4LongIdx = index - indicators.rsi4LongBegin;
      if (longOK && rsi4LongIdx >= 0 && rsi4LongIdx < indicators.rsi4Long.length) {
        const rsi4Val = indicators.rsi4Long[rsi4LongIdx];
        if (rsi4Val < params.rsi4LongThreshold) buySignals++;
      }
    }

    if (indicators.rsi4Short) {
      const rsi4ShortIdx = index - indicators.rsi4ShortBegin;
      if (shortOK && rsi4ShortIdx >= 0 && rsi4ShortIdx < indicators.rsi4Short.length) {
        const rsi4Val = indicators.rsi4Short[rsi4ShortIdx];
        if (rsi4Val > params.rsi4ShortThreshold) sellSignals++;
      }
    }

    // RSI-5
    if (indicators.rsi5Long) {
      const rsi5LongIdx = index - indicators.rsi5LongBegin;
      if (longOK && rsi5LongIdx >= 0 && rsi5LongIdx < indicators.rsi5Long.length) {
        const rsi5Val = indicators.rsi5Long[rsi5LongIdx];
        if (rsi5Val < params.rsi5LongThreshold) buySignals++;
      }
    }

    if (indicators.rsi5Short) {
      const rsi5ShortIdx = index - indicators.rsi5ShortBegin;
      if (shortOK && rsi5ShortIdx >= 0 && rsi5ShortIdx < indicators.rsi5Short.length) {
        const rsi5Val = indicators.rsi5Short[rsi5ShortIdx];
        if (rsi5Val > params.rsi5ShortThreshold) sellSignals++;
      }
    }

    // RSI-6
    if (indicators.rsi6Long) {
      const rsi6LongIdx = index - indicators.rsi6LongBegin;
      if (longOK && rsi6LongIdx >= 0 && rsi6LongIdx < indicators.rsi6Long.length) {
        const rsi6Val = indicators.rsi6Long[rsi6LongIdx];
        if (rsi6Val < params.rsi6LongThreshold) buySignals++;
      }
    }

    if (indicators.rsi6Short) {
      const rsi6ShortIdx = index - indicators.rsi6ShortBegin;
      if (shortOK && rsi6ShortIdx >= 0 && rsi6ShortIdx < indicators.rsi6Short.length) {
        const rsi6Val = indicators.rsi6Short[rsi6ShortIdx];
        if (rsi6Val > params.rsi6ShortThreshold) sellSignals++;
      }
    }

    // RSI-7
    if (indicators.rsi7Long) {
      const rsi7LongIdx = index - indicators.rsi7LongBegin;
      if (longOK && rsi7LongIdx >= 0 && rsi7LongIdx < indicators.rsi7Long.length) {
        const rsi7Val = indicators.rsi7Long[rsi7LongIdx];
        if (rsi7Val < params.rsi7LongThreshold) buySignals++;
      }
    }

    if (indicators.rsi7Short) {
      const rsi7ShortIdx = index - indicators.rsi7ShortBegin;
      if (shortOK && rsi7ShortIdx >= 0 && rsi7ShortIdx < indicators.rsi7Short.length) {
        const rsi7Val = indicators.rsi7Short[rsi7ShortIdx];
        if (rsi7Val > params.rsi7ShortThreshold) sellSignals++;
      }
    }

    // All 7 RSI conditions must be met
    const buyOK = buySignals === 7 && longOK;
    const sellOK = sellSignals === 7 && shortOK;

    if (buyOK) {
      // Generate 20 equal-weight DCA orders
      const orderWeights = Array(20).fill(1.0 / 20); // Equal 5% each

      // Calculate TP/SL for backtest engine
      const takeProfit = close * (1 + params.takeProfitLong / 100);
      const stopLoss = close * (1 - (params.stepOrdersLong * 20) / 100);  // 20 orders * 2% step = 40% max DD

      return {
        signal: 'buy',
        price: close,
        takeProfit,
        stopLoss,
        type: 'DCA',
        orders: 20,
        reason: `7-RSI DCA Long: ${buySignals}/7 RSI signals met`,
        dcaConfig: {
          orderWeights: orderWeights,
          stepPercent: params.stepOrdersLong,
          takeProfit: params.takeProfitLong,
          stopLoss: null
        }
      };
    }

    if (sellOK) {
      const orderWeights = Array(20).fill(1.0 / 20);

      // Calculate TP/SL for backtest engine
      const takeProfit = close * (1 - params.takeProfitShort / 100);
      const stopLoss = close * (1 + (params.stepOrdersShort * 20) / 100);

      return {
        signal: 'sell',
        price: close,
        takeProfit,
        stopLoss,
        type: 'DCA',
        orders: 20,
        reason: `7-RSI DCA Short: ${sellSignals}/7 RSI signals met`,
        dcaConfig: {
          orderWeights: orderWeights,
          stepPercent: params.stepOrdersShort,
          takeProfit: params.takeProfitShort,
          stopLoss: null
        }
      };
    }

    return null;
  }
};
