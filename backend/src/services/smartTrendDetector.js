// Smart Trend Detector - Real multi-indicator trend detection
// DOĞRULUK BAZINDA SİSTEME ETKİSİ OLSUN - Affects actual trading decisions

import { Indicators } from '../utils/indicators.js';

export class SmartTrendDetector {
  constructor() {
    this.signals = [];
    this.performance = {
      totalSignals: 0,
      correctSignals: 0,
      accuracy: 0
    };
  }

  /**
   * Detect trend using multiple indicators
   * CRITICAL: This AFFECTS trading decisions
   */
  detectTrend(candles, currentIndex) {
    if (currentIndex < 200) return { trend: 'neutral', confidence: 0, signal: null };

    const close = candles.map(c => c[4]);
    const high = candles.map(c => c[2]);
    const low = candles.map(c => c[3]);
    const volume = candles.map(c => c[5]);

    // 1. EMA Analysis - Trend Direction
    const ema20Data = Indicators.ema(close, 20);
    const ema50Data = Indicators.ema(close, 50);
    const ema200Data = Indicators.ema(close, 200);
    const ema20 = ema20Data.result.outReal[ema20Data.result.outReal.length - 1];
    const ema50 = ema50Data.result.outReal[ema50Data.result.outReal.length - 1];
    const ema200 = ema200Data.result.outReal[ema200Data.result.outReal.length - 1];
    const currentPrice = close[currentIndex];

    // 2. RSI - Overbought/Oversold
    const rsiData = Indicators.rsi(close, 14);
    const rsi = rsiData.result.outReal[rsiData.result.outReal.length - 1];

    // 3. MACD - Momentum
    const macdData = Indicators.macd(close, 12, 26, 9);
    const macdResult = macdData.result;
    const macdLine = macdResult.outMACD[macdResult.outMACD.length - 1];
    const signalLine = macdResult.outMACDSignal[macdResult.outMACDSignal.length - 1];
    const histogram = macdResult.outMACDHist[macdResult.outMACDHist.length - 1];
    const prevHistogram = macdResult.outMACDHist[macdResult.outMACDHist.length - 2];

    // 4. Bollinger Bands - Volatility
    const bbData = Indicators.bbands(close, 20, 2);
    const bbResult = bbData.result;
    const upperBB = bbResult.outRealUpperBand[bbResult.outRealUpperBand.length - 1];
    const lowerBB = bbResult.outRealLowerBand[bbResult.outRealLowerBand.length - 1];
    const middleBB = bbResult.outRealMiddleBand[bbResult.outRealMiddleBand.length - 1];

    // 5. Volume Analysis
    const avgVolume = volume.slice(currentIndex - 20, currentIndex).reduce((a, b) => a + b, 0) / 20;
    const volumeSpike = volume[currentIndex] > avgVolume * 1.5;

    // TREND SCORING SYSTEM
    let bullishScore = 0;
    let bearishScore = 0;

    // EMA Alignment (40 points)
    if (currentPrice > ema20 && ema20 > ema50 && ema50 > ema200) {
      bullishScore += 40; // Perfect bullish alignment
    } else if (currentPrice < ema20 && ema20 < ema50 && ema50 < ema200) {
      bearishScore += 40; // Perfect bearish alignment
    } else if (currentPrice > ema20 && ema20 > ema50) {
      bullishScore += 25; // Partial bullish
    } else if (currentPrice < ema20 && ema20 < ema50) {
      bearishScore += 25; // Partial bearish
    }

    // MACD (30 points)
    if (macdLine > signalLine && histogram > 0 && histogram > prevHistogram) {
      bullishScore += 30; // Strong bullish momentum
    } else if (macdLine < signalLine && histogram < 0 && histogram < prevHistogram) {
      bearishScore += 30; // Strong bearish momentum
    } else if (macdLine > signalLine) {
      bullishScore += 15; // Weak bullish
    } else if (macdLine < signalLine) {
      bearishScore += 15; // Weak bearish
    }

    // RSI (15 points)
    if (rsi < 30) {
      bullishScore += 15; // Oversold - potential reversal
    } else if (rsi > 70) {
      bearishScore += 15; // Overbought - potential reversal
    } else if (rsi > 50) {
      bullishScore += 7; // Slight bullish bias
    } else if (rsi < 50) {
      bearishScore += 7; // Slight bearish bias
    }

    // Bollinger Bands (10 points)
    if (currentPrice < lowerBB) {
      bullishScore += 10; // Near lower band - potential bounce
    } else if (currentPrice > upperBB) {
      bearishScore += 10; // Near upper band - potential drop
    }

    // Volume Confirmation (5 points)
    if (volumeSpike) {
      if (bullishScore > bearishScore) {
        bullishScore += 5;
      } else {
        bearishScore += 5;
      }
    }

    // DETERMINE TREND AND CONFIDENCE
    const totalScore = bullishScore + bearishScore;
    const netScore = bullishScore - bearishScore;
    const confidence = Math.abs(netScore) / 100; // 0-1 scale

    let trend, signal;

    if (bullishScore > bearishScore + 20) {
      trend = 'bullish';
      // Generate BUY signal if strong enough
      if (confidence > 0.6 && rsi < 70 && currentPrice > middleBB * 0.98) {
        signal = 'buy';
      }
    } else if (bearishScore > bullishScore + 20) {
      trend = 'bearish';
      // Generate SELL signal if strong enough
      if (confidence > 0.6 && rsi > 30 && currentPrice < middleBB * 1.02) {
        signal = 'sell';
      }
    } else {
      trend = 'neutral';
      signal = null;
    }

    const result = {
      trend,
      confidence: Math.min(confidence, 1),
      signal,
      scores: { bullish: bullishScore, bearish: bearishScore },
      indicators: {
        ema: { ema20, ema50, ema200, price: currentPrice },
        rsi,
        macd: { macdLine, signalLine, histogram },
        bb: { upper: upperBB, lower: lowerBB, middle: middleBB },
        volume: { current: volume[currentIndex], avg: avgVolume, spike: volumeSpike }
      }
    };

    // Track signal for performance measurement
    if (signal) {
      this.signals.push({
        timestamp: Date.now(),
        pair: null, // Set by caller
        signal,
        trend,
        confidence,
        price: currentPrice,
        result: null // Will be updated when outcome is known
      });
      this.performance.totalSignals++;
    }

    return result;
  }

  /**
   * Update signal outcome - used to calculate accuracy
   */
  updateSignalResult(signalIndex, wasCorrect) {
    if (this.signals[signalIndex]) {
      this.signals[signalIndex].result = wasCorrect;
      if (wasCorrect) {
        this.performance.correctSignals++;
      }
      this.performance.accuracy = (this.performance.correctSignals / this.performance.totalSignals) * 100;
    }
  }

  /**
   * Should this signal override strategy?
   * CRITICAL: This makes Smart Trend Detector AFFECT trades
   */
  shouldOverrideStrategy(trendAnalysis, strategySignal) {
    // If no strategy signal, use trend detector
    if (!strategySignal) {
      return trendAnalysis.signal && trendAnalysis.confidence > 0.65;
    }

    // If strategy conflicts with strong trend, override
    if (strategySignal === 'buy' && trendAnalysis.trend === 'bearish' && trendAnalysis.confidence > 0.7) {
      return 'block'; // Block bad buy signal
    }

    if (strategySignal === 'sell' && trendAnalysis.trend === 'bullish' && trendAnalysis.confidence > 0.7) {
      return 'block'; // Block bad sell signal
    }

    // Enhance weak signals with trend confirmation
    if (strategySignal === 'buy' && trendAnalysis.trend === 'bullish' && trendAnalysis.confidence > 0.6) {
      return 'confirm'; // Confirm good buy
    }

    if (strategySignal === 'sell' && trendAnalysis.trend === 'bearish' && trendAnalysis.confidence > 0.6) {
      return 'confirm'; // Confirm good sell
    }

    return 'neutral';
  }

  /**
   * Get performance stats
   */
  getStats() {
    return {
      totalSignals: this.performance.totalSignals,
      correctSignals: this.performance.correctSignals,
      accuracy: this.performance.accuracy.toFixed(1) + '%',
      recentSignals: this.signals.slice(-10)
    };
  }

  /**
   * Get feature impact data
   */
  getImpact(sessions) {
    const sessionsUsingDetector = sessions.filter(s => s.useTrendDetector);

    let totalPnL = 0;
    let blockedLosses = 0;
    let enhancedWins = 0;

    sessionsUsingDetector.forEach(session => {
      if (session.trades) {
        session.trades.forEach(trade => {
          if (trade.blockedByTrend) {
            blockedLosses++;
          }
          if (trade.enhancedByTrend) {
            enhancedWins++;
            totalPnL += trade.pnl || 0;
          }
        });
      }
    });

    return {
      status: 'active',
      liveData: `${this.performance.totalSignals} signals`,
      realImpact: this.performance.accuracy > 0 ? `+${this.performance.accuracy.toFixed(1)}% accuracy` : 'Collecting data...',
      successRate: this.performance.accuracy.toFixed(1) + '%',
      description: 'Multi-indicator trend detection with RSI, MACD, EMA',
      metrics: {
        totalSignals: this.performance.totalSignals,
        correctSignals: this.performance.correctSignals,
        blockedLosses,
        enhancedWins,
        totalPnL: totalPnL.toFixed(2)
      }
    };
  }
}

export default SmartTrendDetector;
