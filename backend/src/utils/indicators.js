// Technical Indicators (using technicalindicators library)
import { SMA, EMA, RSI, MACD, BollingerBands, ATR, Stochastic, ADX, CCI } from 'technicalindicators';

export class Indicators {
  /**
   * Calculate SMA (Simple Moving Average)
   */
  static sma(closes, period) {
    const result = SMA.calculate({ period, values: closes });
    return {
      result: { outReal: result },
      begIndex: closes.length - result.length
    };
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  static ema(closes, period) {
    const result = EMA.calculate({ period, values: closes });
    return {
      result: { outReal: result },
      begIndex: closes.length - result.length
    };
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  static rsi(closes, period = 14) {
    const result = RSI.calculate({ period, values: closes });
    return {
      result: { outReal: result },
      begIndex: closes.length - result.length
    };
  }

  /**
   * Calculate MACD
   */
  static macd(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const result = MACD.calculate({
      values: closes,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });

    return {
      result: {
        outMACD: result.map(r => r.MACD),
        outMACDSignal: result.map(r => r.signal),
        outMACDHist: result.map(r => r.histogram)
      },
      begIndex: closes.length - result.length
    };
  }

  /**
   * Calculate Bollinger Bands
   */
  static bbands(closes, period = 20, stdDev = 2) {
    const result = BollingerBands.calculate({
      period,
      values: closes,
      stdDev
    });

    return {
      result: {
        outRealUpperBand: result.map(r => r.upper),
        outRealMiddleBand: result.map(r => r.middle),
        outRealLowerBand: result.map(r => r.lower)
      },
      begIndex: closes.length - result.length
    };
  }

  /**
   * Calculate ATR (Average True Range)
   */
  static atr(highs, lows, closes, period = 14) {
    const result = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period
    });

    return {
      result: { outReal: result },
      begIndex: closes.length - result.length
    };
  }

  /**
   * Calculate Stochastic Oscillator
   */
  static stoch(highs, lows, closes, fastK = 14, slowK = 3, slowD = 3) {
    const result = Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: fastK,
      signalPeriod: slowD
    });

    return {
      result: {
        outSlowK: result.map(r => r.k),
        outSlowD: result.map(r => r.d)
      },
      begIndex: closes.length - result.length
    };
  }

  /**
   * Calculate ADX (Average Directional Index)
   */
  static adx(highs, lows, closes, period = 14) {
    const result = ADX.calculate({
      high: highs,
      low: lows,
      close: closes,
      period
    });

    return {
      result: { outReal: result.map(r => r.adx) },
      begIndex: closes.length - result.length
    };
  }

  /**
   * Calculate CCI (Commodity Channel Index)
   */
  static cci(highs, lows, closes, period = 20) {
    const result = CCI.calculate({
      high: highs,
      low: lows,
      close: closes,
      period
    });

    return {
      result: { outReal: result },
      begIndex: closes.length - result.length
    };
  }

  /**
   * Extract OHLCV arrays from candles
   */
  static extractOHLCV(candles) {
    return {
      opens: candles.map(c => c[1]),
      highs: candles.map(c => c[2]),
      lows: candles.map(c => c[3]),
      closes: candles.map(c => c[4]),
      volumes: candles.map(c => c[5])
    };
  }
}

export default Indicators;
