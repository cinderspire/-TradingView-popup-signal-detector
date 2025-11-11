// Scalping Strategy
// Quick trades based on RSI extreme conditions

import { Indicators } from '../utils/indicators.js';

export default {
  name: 'Scalping',
  type: 'Scalping',
  description: 'Quick scalping trades using RSI extremes and tight stops',

  params: {
    rsiPeriod: 7,
    rsiOversold: 20,
    rsiOverbought: 80,
    atrPeriod: 14,
    atrMultiplierSL: 1.0,  // Very tight stop for scalping
    atrMultiplierTP: 2.0,  // Quick profit target: R:R = 2:1
    minRR: 1.8,
    quickExitRSI: 50,      // Exit when RSI normalizes
    emaPeriod: 9           // Trend filter
  },

  init(candles, params = this.params) {
    const { highs, lows, closes } = Indicators.extractOHLCV(candles);

    const rsi = Indicators.rsi(closes, params.rsiPeriod);
    const atr = Indicators.atr(highs, lows, closes, params.atrPeriod);
    const ema = Indicators.ema(closes, params.emaPeriod);

    return { rsi, atr, ema };
  },

  next(index, candles, indicators, params = this.params) {
    const close = candles[index][4];
    const { rsi, atr, ema } = indicators;

    if (!rsi.result.outReal || !atr.result.outReal || !ema.result.outReal) return null;

    const rsiValue = rsi.result.outReal[index - rsi.begIndex];
    const atrValue = atr.result.outReal[index - atr.begIndex];
    const emaValue = ema.result.outReal[index - ema.begIndex];

    // Buy: Extreme oversold AND price above EMA (uptrend filter)
    if (rsiValue < params.rsiOversold && close >= emaValue) {
      const stopLoss = close - (atrValue * params.atrMultiplierSL);
      const takeProfit = close + (atrValue * params.atrMultiplierTP);

      const risk = close - stopLoss;
      const reward = takeProfit - close;
      const rr = reward / risk;

      if (rr >= params.minRR) {
        return {
          signal: 'buy',
          price: close,
          stopLoss,
          takeProfit,
          reason: `SCALP ENTRY: RSI ${rsiValue.toFixed(2)}, EMA filter OK, R:R ${rr.toFixed(2)}`
        };
      }
    }

    // Quick exit 1: RSI normalizes (fast profit taking)
    if (rsiValue >= params.quickExitRSI - 5 && rsiValue <= params.quickExitRSI + 5) {
      return {
        signal: 'sell',
        price: close,
        reason: `QUICK EXIT: RSI normalized to ${rsiValue.toFixed(2)}`
      };
    }

    // Quick exit 2: Extreme overbought (profit target)
    if (rsiValue > params.rsiOverbought) {
      return {
        signal: 'sell',
        price: close,
        reason: `PROFIT TARGET: RSI ${rsiValue.toFixed(2)} overbought`
      };
    }

    // Quick exit 3: Price drops below EMA (trend reversal)
    if (close < emaValue) {
      return {
        signal: 'sell',
        price: close,
        reason: `TREND REVERSAL: Price below EMA`
      };
    }

    return null;
  }
};
