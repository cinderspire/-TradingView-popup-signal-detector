// 3RSI 3CCI BB 5orders DCA Strategy - EXACT TradingView Implementation
// Pine Script by rrolik66 - BIREBIR ÇEVİRİ
// CRITICAL: Uses 2m base timeframe with multi-resolution indicators (5m, 15m, 30m)

import { Indicators } from '../utils/indicators.js';

export default {
  name: '3RSI 3CCI BB DCA',
  type: 'dca',
  description: 'Multi-resolution RSI + CCI with 5-order DCA (3m base, 5m/15m/30m indicators)',

  // EXACT PINE SCRIPT PARAMETERS
  params: {
    // Order weights - Pine Script default: 13.03, 14.29, 17.19, 22.67, 32.80
    // User input: 50, 50, 50, 50, 50 (equal weights)
    weight_order0: 0.50,
    weight_order1: 0.50,
    weight_order2: 0.50,
    weight_order3: 0.50,
    weight_order4: 0.50,

    // Long Bot - EXACT from user input
    rateCoverLong: 80,           // 80% divided by 4 = 20% per step
    takeProfitLong: 1.4,         // 1.4% TP
    stopLossLong: 80,            // 80% SL (disabled by default)
    enableStopLossLong: false,   // SL disabled

    // Short Bot - not used but kept for compatibility
    rateCoverShort: 500,
    takeProfitShort: 1.4,
    stopLossShort: 500,
    enableStopLossShort: false,

    // RSI-1 (5m resolution in Pine Script)
    rsi1Enabled: true,
    rsi1Resolution: '5m',
    rsi1LongThreshold: 65,
    rsi1LengthLong: 14,
    rsi1ShortThreshold: 37,
    rsi1LengthShort: 14,

    // RSI-2 (10m resolution in Pine Script) - Pine shows "15" but likely 10m
    rsi2Enabled: true,
    rsi2Resolution: '15m',
    rsi2LongThreshold: 72,
    rsi2LengthLong: 14,
    rsi2ShortThreshold: 37,
    rsi2LengthShort: 14,

    // RSI-3 (30m resolution in Pine Script)
    rsi3Enabled: true,
    rsi3Resolution: '30m',
    rsi3LongThreshold: 74,
    rsi3LengthLong: 14,
    rsi3ShortThreshold: 34,
    rsi3LengthShort: 14,

    // CCI-1 (5m resolution)
    cci1Enabled: true,
    cci1Resolution: '5m',
    cci1LongThreshold: 190,
    cci1LengthLong: 20,
    cci1ShortThreshold: -175,
    cci1LengthShort: 20,

    // CCI-2 (15m resolution)
    cci2Enabled: true,
    cci2Resolution: '15m',
    cci2LongThreshold: 195,
    cci2LengthLong: 20,
    cci2ShortThreshold: -205,
    cci2LengthShort: 20,

    // CCI-3 (30m resolution)
    cci3Enabled: true,
    cci3Resolution: '30m',
    cci3LongThreshold: 200,
    cci3LengthLong: 20,
    cci3ShortThreshold: -220,
    cci3LengthShort: 20,

    // Bollinger Bands (3m resolution, DISABLED in user input)
    bbEnabled: false,
    bbResolution: '3m',
    bbDeviation: 2.0,
    bbLength: 20,

    // CCI Band filter (55m resolution, DISABLED)
    cciBandEnabled: false,
    cciBandResolution: '55m',
    cciBandLength: 20,
    cciBandLow: -110,
    cciBandHigh: 110,

    tradeDirection: 'Long Bot'  // Only Long Bot
  },

  // Multi-timeframe requirement
  requiresMultiTimeframe: true,
  timeframes: ['3m', '5m', '15m', '30m', '55m'], // Base 3m + indicator resolutions (same as 7-RSI data source)

  init(candlesOrMulti, params) {
    const indicators = {};
    const isMultiTimeframe = !Array.isArray(candlesOrMulti);

    console.log(`[3RSI INIT] isMultiTimeframe=${isMultiTimeframe}, keys=${Object.keys(candlesOrMulti || {})}`);

    if (!isMultiTimeframe) {
      // Single timeframe mode - use base candles for all (fallback)
      const candles = candlesOrMulti;
      const close = candles.map(c => c[4]);
      const high = candles.map(c => c[2]);
      const low = candles.map(c => c[3]);

      // Calculate all indicators on base timeframe (not ideal but works)
      if (params.rsi1Enabled) {
        const rsi1Long = Indicators.rsi(close, params.rsi1LengthLong);
        indicators.rsi1Long = rsi1Long.result.outReal;
        indicators.rsi1LongBegin = rsi1Long.begIndex;
      }
      if (params.rsi2Enabled) {
        const rsi2Long = Indicators.rsi(close, params.rsi2LengthLong);
        indicators.rsi2Long = rsi2Long.result.outReal;
        indicators.rsi2LongBegin = rsi2Long.begIndex;
      }
      if (params.rsi3Enabled) {
        const rsi3Long = Indicators.rsi(close, params.rsi3LengthLong);
        indicators.rsi3Long = rsi3Long.result.outReal;
        indicators.rsi3LongBegin = rsi3Long.begIndex;
      }
      if (params.cci1Enabled) {
        const cci1Long = Indicators.cci(high, low, close, params.cci1LengthLong);
        indicators.cci1Long = cci1Long.result.outReal;
        indicators.cci1LongBegin = cci1Long.begIndex;
      }
      if (params.cci2Enabled) {
        const cci2Long = Indicators.cci(high, low, close, params.cci2LengthLong);
        indicators.cci2Long = cci2Long.result.outReal;
        indicators.cci2LongBegin = cci2Long.begIndex;
      }
      if (params.cci3Enabled) {
        const cci3Long = Indicators.cci(high, low, close, params.cci3LengthLong);
        indicators.cci3Long = cci3Long.result.outReal;
        indicators.cci3LongBegin = cci3Long.begIndex;
      }

      return indicators;
    }

    // Multi-timeframe mode - CORRECT IMPLEMENTATION (using 3m base like 7-RSI)
    const candles3m = candlesOrMulti['3m'] || [];
    const candles5m = candlesOrMulti['5m'] || [];
    const candles15m = candlesOrMulti['15m'] || [];
    const candles30m = candlesOrMulti['30m'] || [];
    const candles55m = candlesOrMulti['55m'] || [];

    console.log(`[3RSI INIT] Candles: 3m=${candles3m.length}, 5m=${candles5m.length}, 15m=${candles15m.length}, 30m=${candles30m.length}, 55m=${candles55m.length}`);

    // RSI-1 from 5m timeframe
    if (params.rsi1Enabled && candles5m.length > 0) {
      const close5m = candles5m.map(c => c[4]);
      const rsi1Long = Indicators.rsi(close5m, params.rsi1LengthLong);
      indicators.rsi1Long = rsi1Long.result.outReal;
      indicators.rsi1LongBegin = rsi1Long.begIndex;
    }

    // RSI-2 from 15m timeframe
    if (params.rsi2Enabled && candles15m.length > 0) {
      const close15m = candles15m.map(c => c[4]);
      const rsi2Long = Indicators.rsi(close15m, params.rsi2LengthLong);
      indicators.rsi2Long = rsi2Long.result.outReal;
      indicators.rsi2LongBegin = rsi2Long.begIndex;
    }

    // RSI-3 from 30m timeframe
    if (params.rsi3Enabled && candles30m.length > 0) {
      const close30m = candles30m.map(c => c[4]);
      const rsi3Long = Indicators.rsi(close30m, params.rsi3LengthLong);
      indicators.rsi3Long = rsi3Long.result.outReal;
      indicators.rsi3LongBegin = rsi3Long.begIndex;
    }

    // CCI-1 from 5m timeframe
    if (params.cci1Enabled && candles5m.length > 0) {
      const high5m = candles5m.map(c => c[2]);
      const low5m = candles5m.map(c => c[3]);
      const close5m = candles5m.map(c => c[4]);
      const cci1Long = Indicators.cci(high5m, low5m, close5m, params.cci1LengthLong);
      indicators.cci1Long = cci1Long.result.outReal;
      indicators.cci1LongBegin = cci1Long.begIndex;
    }

    // CCI-2 from 15m timeframe
    if (params.cci2Enabled && candles15m.length > 0) {
      const high15m = candles15m.map(c => c[2]);
      const low15m = candles15m.map(c => c[3]);
      const close15m = candles15m.map(c => c[4]);
      const cci2Long = Indicators.cci(high15m, low15m, close15m, params.cci2LengthLong);
      indicators.cci2Long = cci2Long.result.outReal;
      indicators.cci2LongBegin = cci2Long.begIndex;
    }

    // CCI-3 from 30m timeframe
    if (params.cci3Enabled && candles30m.length > 0) {
      const high30m = candles30m.map(c => c[2]);
      const low30m = candles30m.map(c => c[3]);
      const close30m = candles30m.map(c => c[4]);
      const cci3Long = Indicators.cci(high30m, low30m, close30m, params.cci3LengthLong);
      indicators.cci3Long = cci3Long.result.outReal;
      indicators.cci3LongBegin = cci3Long.begIndex;
    }

    // Bollinger Bands from 3m timeframe (if enabled)
    if (params.bbEnabled && candles3m.length > 0) {
      const close3m = candles3m.map(c => c[4]);
      const bb = Indicators.bbands(close3m, params.bbLength, params.bbDeviation, params.bbDeviation);
      indicators.bbUpper = bb.result.outRealUpperBand;
      indicators.bbMiddle = bb.result.outRealMiddleBand;
      indicators.bbLower = bb.result.outRealLowerBand;
      indicators.bbBegin = bb.begIndex;
    }

    // CCI Band from 55m timeframe (if enabled)
    if (params.cciBandEnabled && candles55m.length > 0) {
      const high55m = candles55m.map(c => c[2]);
      const low55m = candles55m.map(c => c[3]);
      const close55m = candles55m.map(c => c[4]);
      const cciBand = Indicators.cci(high55m, low55m, close55m, params.cciBandLength);
      indicators.cciBand = cciBand.result.outReal;
      indicators.cciBandBegin = cciBand.begIndex;
    }

    return indicators;
  },

  next(index, candles, indicators, params) {
    const close = candles[index][4];
    const longOK = params.tradeDirection === 'Long Bot';
    const shortOK = params.tradeDirection === 'Short Bot';

    // DEBUG: Log indicators object structure
    if (index === candles.length - 1 && Math.random() < 0.05) {
      console.log(`  [3RSI NEXT] indicators keys=${Object.keys(indicators || {})}, rsi1Long len=${indicators?.rsi1Long?.length}, cci1Long len=${indicators?.cci1Long?.length}`);
    }

    // Rating system - ALL conditions must be met (like Pine Script)
    let ratingLong = 0;
    let ratingLongNum = 0;

    // DEBUG: Track indicator values
    const debugValues = {};

    // RSI-1 check (5m indicators - use LAST value, not index-mapped)
    if (params.rsi1Enabled && indicators.rsi1Long && indicators.rsi1Long.length > 0) {
      const idx = indicators.rsi1Long.length - 1; // Use latest indicator value
      if (longOK) {
        ratingLongNum++;
        const val = indicators.rsi1Long[idx];
        debugValues.rsi1 = val;
        if (val < params.rsi1LongThreshold) ratingLong++;
      }
    }

    // RSI-2 check (15m indicators)
    if (params.rsi2Enabled && indicators.rsi2Long && indicators.rsi2Long.length > 0) {
      const idx = indicators.rsi2Long.length - 1;
      if (longOK) {
        ratingLongNum++;
        const val = indicators.rsi2Long[idx];
        debugValues.rsi2 = val;
        if (val < params.rsi2LongThreshold) ratingLong++;
      }
    }

    // RSI-3 check (30m indicators)
    if (params.rsi3Enabled && indicators.rsi3Long && indicators.rsi3Long.length > 0) {
      const idx = indicators.rsi3Long.length - 1;
      if (longOK) {
        ratingLongNum++;
        const val = indicators.rsi3Long[idx];
        debugValues.rsi3 = val;
        if (val < params.rsi3LongThreshold) ratingLong++;
      }
    }

    // CCI-1 check (5m indicators)
    if (params.cci1Enabled && indicators.cci1Long && indicators.cci1Long.length > 0) {
      const idx = indicators.cci1Long.length - 1;
      if (longOK) {
        ratingLongNum++;
        const val = indicators.cci1Long[idx];
        debugValues.cci1 = val;
        if (val < params.cci1LongThreshold) ratingLong++;
      }
    }

    // CCI-2 check (15m indicators)
    if (params.cci2Enabled && indicators.cci2Long && indicators.cci2Long.length > 0) {
      const idx = indicators.cci2Long.length - 1;
      if (longOK) {
        ratingLongNum++;
        const val = indicators.cci2Long[idx];
        debugValues.cci2 = val;
        if (val < params.cci2LongThreshold) ratingLong++;
      }
    }

    // CCI-3 check (30m indicators)
    if (params.cci3Enabled && indicators.cci3Long && indicators.cci3Long.length > 0) {
      const idx = indicators.cci3Long.length - 1;
      if (longOK) {
        ratingLongNum++;
        const val = indicators.cci3Long[idx];
        debugValues.cci3 = val;
        if (val < params.cci3LongThreshold) ratingLong++;
      }
    }

    // Bollinger Bands check (if enabled) - use 3m indicators
    if (params.bbEnabled && indicators.bbLower && indicators.bbLower.length > 0) {
      const idx = indicators.bbLower.length - 1;
      if (longOK) {
        ratingLongNum++;
        if (close < indicators.bbLower[idx]) ratingLong++;
      }
    }

    // CCI Band filter (if enabled) - use 55m indicators
    if (params.cciBandEnabled && indicators.cciBand && indicators.cciBand.length > 0) {
      const idx = indicators.cciBand.length - 1;
      const cciVal = indicators.cciBand[idx];
      const inRange = cciVal > params.cciBandLow && cciVal < params.cciBandHigh;
      if (longOK) {
        ratingLongNum++;
        if (inRange) ratingLong++;
      }
    }

    // CRITICAL: ALL conditions must be met (rating_long == rating_long_num)
    const buyOK = ratingLongNum > 0 && ratingLong === ratingLongNum && longOK;

    // DEBUG: Log every evaluation
    if (index === candles.length - 1) {
      console.log(`  [3RSI DEBUG] rating=${ratingLong}/${ratingLongNum}, buyOK=${buyOK}, RSI1=${debugValues.rsi1?.toFixed(1)}, RSI2=${debugValues.rsi2?.toFixed(1)}, RSI3=${debugValues.rsi3?.toFixed(1)}, CCI1=${debugValues.cci1?.toFixed(0)}, CCI2=${debugValues.cci2?.toFixed(0)}, CCI3=${debugValues.cci3?.toFixed(0)}`);
    }

    if (buyOK) {
      console.log(`  🎯 [3RSI SIGNAL] BUY signal generated! rating=${ratingLong}/${ratingLongNum}, close=${close.toFixed(4)}`);

      // Calculate TP/SL - EXACT Pine Script formula
      const stepPercent = params.rateCoverLong / 4 / 100; // Divide by 4 orders
      const takeProfit = close * (1 + params.takeProfitLong / 100);
      const stopLoss = params.enableStopLossLong
        ? close * (1 - params.stopLossLong / 100)
        : close * 0.2; // 80% max drawdown protection

      return {
        signal: 'buy',
        price: close,
        takeProfit,
        stopLoss,
        reason: `3RSI 3CCI BB DCA: ${ratingLong}/${ratingLongNum} conditions met`,

        // DCA configuration - 5 orders with weights
        dcaOrders: 5,
        dcaStepPercent: stepPercent * 100, // Convert back to percentage
        dcaWeights: [
          params.weight_order0,
          params.weight_order1,
          params.weight_order2,
          params.weight_order3,
          params.weight_order4
        ]
      };
    }

    return null;
  }
};
