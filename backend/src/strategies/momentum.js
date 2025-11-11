// Momentum Strategy
// Follows trends using MACD and EMA crossovers

import { Indicators } from '../utils/indicators.js';

export default {
  name: 'Momentum',
  type: 'Momentum',
  description: 'Trend-following strategy using MACD and EMA crossovers',

  params: {
    emaFast: 12,
    emaSlow: 26,
    macdSignal: 9,
    atrPeriod: 14,
    atrMultiplierSL: 1.5,  // Tighter stop for momentum
    atrMultiplierTP: 2.5,  // Good R:R = 1.67:1
    minRR: 1.5,
    rsiPeriod: 14,
    rsiOverbought: 70,     // Exit on extreme overbought
    rsiOversold: 30
  },

  init(candles, params = this.params) {
    const { highs, lows, closes } = Indicators.extractOHLCV(candles);

    const emaFast = Indicators.ema(closes, params.emaFast);
    const emaSlow = Indicators.ema(closes, params.emaSlow);
    const macd = Indicators.macd(closes, params.emaFast, params.emaSlow, params.macdSignal);
    const atr = Indicators.atr(highs, lows, closes, params.atrPeriod);
    const rsi = Indicators.rsi(closes, params.rsiPeriod);

    return { emaFast, emaSlow, macd, atr, rsi };
  },

  next(index, candles, indicators, params = this.params) {
    const close = candles[index][4];
    const { emaFast, emaSlow, macd, atr, rsi } = indicators;

    if (!emaFast.result.outReal || !macd.result.outMACD || !atr.result.outReal || !rsi.result.outReal) return null;

    const emaFastVal = emaFast.result.outReal[index - emaFast.begIndex];
    const emaSlowVal = emaSlow.result.outReal[index - emaSlow.begIndex];
    const macdLine = macd.result.outMACD[index - macd.begIndex];
    const signalLine = macd.result.outMACDSignal[index - macd.begIndex];
    const atrValue = atr.result.outReal[index - atr.begIndex];
    const rsiValue = rsi.result.outReal[index - rsi.begIndex];

    // Previous values for crossover detection
    const prevEmaFast = emaFast.result.outReal[index - emaFast.begIndex - 1];
    const prevEmaSlow = emaSlow.result.outReal[index - emaSlow.begIndex - 1];
    const prevMacd = macd.result.outMACD[index - macd.begIndex - 1];
    const prevSignal = macd.result.outMACDSignal[index - macd.begIndex - 1];

    // Buy: EMA fast crosses above slow AND MACD crosses above signal
    // AND RSI not overbought (avoid buying at peaks)
    if (prevEmaFast <= prevEmaSlow && emaFastVal > emaSlowVal &&
        prevMacd <= prevSignal && macdLine > signalLine &&
        rsiValue < params.rsiOverbought) {

      // Dynamic SL/TP based on ATR
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
          reason: `Bullish momentum: EMA & MACD cross, RSI ${rsiValue.toFixed(2)}, R:R ${rr.toFixed(2)}`
        };
      }
    }

    // Sell: EMA fast crosses below slow OR RSI extremely overbought (profit taking)
    if ((prevEmaFast >= prevEmaSlow && emaFastVal < emaSlowVal &&
         prevMacd >= prevSignal && macdLine < signalLine) ||
        rsiValue > params.rsiOverbought) {
      return {
        signal: 'sell',
        price: close,
        reason: rsiValue > params.rsiOverbought
          ? `PROFIT TARGET: RSI ${rsiValue.toFixed(2)} overbought`
          : 'Bearish momentum: EMA & MACD reversal'
      };
    }

    return null;
  }
};
