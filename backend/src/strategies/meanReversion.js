// Mean Reversion Strategy
// Buys when price is oversold (below lower Bollinger Band), sells when overbought

import { Indicators } from '../utils/indicators.js';

export default {
  name: 'Mean Reversion',
  type: 'Mean Reversion',
  description: 'Buys oversold conditions, sells overbought conditions using Bollinger Bands and RSI',

  params: {
    bbPeriod: 20,
    bbStdDev: 2,
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    atrPeriod: 14,
    atrMultiplierSL: 2.0,  // Stop loss: 2x ATR
    atrMultiplierTP: 3.0,  // Take profit: 3x ATR (R:R = 1.5:1)
    minRR: 1.5             // Minimum Risk/Reward ratio
  },

  // Initialize indicators
  init(candles, params = this.params) {
    const { highs, lows, closes } = Indicators.extractOHLCV(candles);

    const bb = Indicators.bbands(closes, params.bbPeriod, params.bbStdDev);
    const rsi = Indicators.rsi(closes, params.rsiPeriod);
    const atr = Indicators.atr(highs, lows, closes, params.atrPeriod);

    return { bb, rsi, atr };
  },

  // Check entry/exit signals for each candle
  next(index, candles, indicators, params = this.params) {
    const close = candles[index][4];
    const { bb, rsi, atr } = indicators;

    if (!bb.result.outRealLowerBand || !rsi.result.outReal || !atr.result.outReal) return null;

    // Calculate array indices
    const bbIndex = index - bb.begIndex;
    const rsiIndex = index - rsi.begIndex;
    const atrIndex = index - atr.begIndex;

    // Check if indices are valid (not negative and within array bounds)
    if (bbIndex < 0 || bbIndex >= bb.result.outRealLowerBand.length) return null;
    if (rsiIndex < 0 || rsiIndex >= rsi.result.outReal.length) return null;
    if (atrIndex < 0 || atrIndex >= atr.result.outReal.length) return null;

    const lowerBand = bb.result.outRealLowerBand[bbIndex];
    const upperBand = bb.result.outRealUpperBand[bbIndex];
    const rsiValue = rsi.result.outReal[rsiIndex];
    const atrValue = atr.result.outReal[atrIndex];

    // Entry: Price below lower BB and RSI oversold
    if (close < lowerBand && rsiValue < params.rsiOversold) {
      // Calculate dynamic stop loss and take profit based on ATR
      const stopLoss = close - (atrValue * params.atrMultiplierSL);
      const takeProfit = close + (atrValue * params.atrMultiplierTP);

      // Risk/Reward check
      const risk = close - stopLoss;
      const reward = takeProfit - close;
      const rr = reward / risk;

      // Only enter if R:R ratio is favorable
      if (rr >= params.minRR) {
        return {
          signal: 'buy',
          price: close,
          stopLoss,
          takeProfit,
          reason: `Oversold: RSI ${rsiValue.toFixed(2)}, BB breach, R:R ${rr.toFixed(2)}`
        };
      }
    }

    // Exit: Price above upper BB and RSI overbought (PROFIT TARGET)
    if (close > upperBand && rsiValue > params.rsiOverbought) {
      return {
        signal: 'sell',
        price: close,
        reason: `Overbought: RSI ${rsiValue.toFixed(2)}, Price above BB - PROFIT TARGET`
      };
    }

    // Early exit: RSI reaches 50 (mean reversion complete)
    if (rsiValue >= 48 && rsiValue <= 52) {
      return {
        signal: 'sell',
        price: close,
        reason: `Mean Reversion Complete: RSI ${rsiValue.toFixed(2)} - QUICK EXIT`
      };
    }

    return null;
  }
};
