// Prediction Tracker - Tracks strategy signal accuracy
// Measures how accurate strategy predictions are vs real price movements

export class PredictionTracker {
  constructor(paperTradeEngine) {
    this.paperTradeEngine = paperTradeEngine;
    this.predictions = [];
    this.accuracyByStrategy = new Map();
    this.accuracyByPair = new Map();
    this.checkInterval = 60000; // 1 minute
  }

  /**
   * Start tracking predictions
   */
  start() {
    console.log('🎯 Prediction Tracker starting...');

    // Check predictions every minute
    setInterval(() => {
      this.updatePredictions();
    }, this.checkInterval);

    console.log('✅ Prediction Tracker active - monitoring signal accuracy');
  }

  /**
   * Track a new prediction
   */
  trackPrediction(sessionId, signal, currentPrice) {
    const prediction = {
      sessionId,
      signal: signal.signal,
      reason: signal.reason,
      predictedPrice: signal.takeProfit || signal.price,
      entryPrice: currentPrice,
      timestamp: Date.now(),
      outcome: null,
      accuracy: null
    };

    this.predictions.push(prediction);
  }

  /**
   * Update prediction outcomes
   */
  updatePredictions() {
    const sessions = this.paperTradeEngine.getAllSessions();

    for (const prediction of this.predictions) {
      if (prediction.outcome !== null) continue; // Already resolved

      const session = sessions.find(s => s.id === prediction.sessionId);
      if (!session) continue;

      const trades = session.metrics?.totalTrades || 0;
      if (trades === 0) continue;

      // Check if prediction was correct based on recent trades
      const sessionFull = this.paperTradeEngine.getSession(prediction.sessionId);
      if (!sessionFull || !sessionFull.trades || sessionFull.trades.length === 0) continue;

      const recentTrade = sessionFull.trades[sessionFull.trades.length - 1];

      // Prediction was correct if trade was profitable
      const wasCorrect = recentTrade.pnl > 0;
      prediction.outcome = wasCorrect ? 'correct' : 'incorrect';
      prediction.accuracy = wasCorrect ? 100 : 0;
      prediction.actualPnL = recentTrade.pnl;
      prediction.actualPnLPercent = recentTrade.pnlPercent;

      // Update strategy accuracy stats
      this.updateStrategyAccuracy(session.strategy, wasCorrect);
      this.updatePairAccuracy(session.pair, wasCorrect);
    }
  }

  /**
   * Update strategy accuracy statistics
   */
  updateStrategyAccuracy(strategy, wasCorrect) {
    if (!this.accuracyByStrategy.has(strategy)) {
      this.accuracyByStrategy.set(strategy, {
        total: 0,
        correct: 0,
        accuracy: 0
      });
    }

    const stats = this.accuracyByStrategy.get(strategy);
    stats.total++;
    if (wasCorrect) stats.correct++;
    stats.accuracy = (stats.correct / stats.total) * 100;
  }

  /**
   * Update pair accuracy statistics
   */
  updatePairAccuracy(pair, wasCorrect) {
    if (!this.accuracyByPair.has(pair)) {
      this.accuracyByPair.set(pair, {
        total: 0,
        correct: 0,
        accuracy: 0
      });
    }

    const stats = this.accuracyByPair.get(pair);
    stats.total++;
    if (wasCorrect) stats.correct++;
    stats.accuracy = (stats.correct / stats.total) * 100;
  }

  /**
   * Get prediction accuracy statistics
   */
  getAccuracyStats() {
    const strategyAccuracy = Array.from(this.accuracyByStrategy.entries()).map(([strategy, stats]) => ({
      strategy,
      accuracy: stats.accuracy.toFixed(2) + '%',
      total: stats.total,
      correct: stats.correct
    }));

    const pairAccuracy = Array.from(this.accuracyByPair.entries())
      .map(([pair, stats]) => ({
        pair,
        accuracy: stats.accuracy.toFixed(2) + '%',
        total: stats.total,
        correct: stats.correct
      }))
      .sort((a, b) => parseFloat(b.accuracy) - parseFloat(a.accuracy))
      .slice(0, 10); // Top 10 pairs

    return {
      totalPredictions: this.predictions.length,
      resolvedPredictions: this.predictions.filter(p => p.outcome !== null).length,
      strategyAccuracy,
      pairAccuracy,
      recentPredictions: this.predictions.slice(-10).map(p => ({
        signal: p.signal,
        reason: p.reason,
        outcome: p.outcome,
        pnl: p.actualPnLPercent ? p.actualPnLPercent.toFixed(2) + '%' : 'pending'
      }))
    };
  }
}

export default PredictionTracker;
