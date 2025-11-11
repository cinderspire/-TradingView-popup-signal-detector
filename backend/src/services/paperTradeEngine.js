// Paper Trading Engine - Real-time simulation with REAL market data
// CRITICAL: Uses real-time price feeds - NO FAKE DATA

import settings from '../config/settings.js';
import { Helpers } from '../utils/helpers.js';
import path from 'path';

export class PaperTradeEngine {
  constructor(dataService, strategyLoader, newsMonitor = null, trendDetector = null, riskController = null, performanceTracker = null) {
    this.dataService = dataService;
    this.strategyLoader = strategyLoader;
    this.newsMonitor = newsMonitor;
    this.trendDetector = trendDetector;
    this.riskController = riskController;
    this.performanceTracker = performanceTracker;
    this.realTradeEngine = null; // Set externally for signal syncing
    this.activeSessions = new Map();
    this.sessionsPath = path.join(settings.dataPath, 'sessions');

    // Don't auto-load sessions in constructor (async issue)
    // Call init() explicitly instead
    // this.loadSessions();
  }

  /**
   * Set real trade engine for signal syncing
   */
  setRealTradeEngine(realTradeEngine) {
    this.realTradeEngine = realTradeEngine;
    console.log('✅ Paper trade engine linked to real trade for signal forwarding');
  }

  /**
   * Initialize paper trade engine (load sessions)
   */
  async init() {
    console.log('📋 Loading paper trade sessions from disk...');
    await this.loadSessions();
  }

  /**
   * Save sessions to disk
   */
  async saveSessions() {
    const sessionsData = Array.from(this.activeSessions.values()).map(s => ({
      id: s.id,
      strategy: s.strategy,
      pair: s.pair,
      timeframe: s.timeframe,
      params: s.params,
      capital: s.capital,
      position: s.position,
      trades: s.trades,
      startTime: s.startTime,
      active: s.active,
      metrics: this.calculateMetrics(s)
    }));

    const filePath = path.join(this.sessionsPath, 'paper_sessions.json');
    await Helpers.saveJSON(filePath, sessionsData);
  }

  /**
   * Load sessions from disk
   */
  async loadSessions() {
    try {
      const filePath = path.join(this.sessionsPath, 'paper_sessions.json');
      const sessionsData = await Helpers.loadJSON(filePath);

      if (sessionsData && Array.isArray(sessionsData)) {
        let successCount = 0;
        let failCount = 0;

        for (const sessionData of sessionsData) {
          if (sessionData.active) {
            try {
              // Restart active sessions
              await this.startPaperTrade(
                sessionData.id,
                sessionData.strategy,
                sessionData.pair,
                sessionData.timeframe,
                sessionData.params
              );

              // Restore previous state
              const session = this.activeSessions.get(sessionData.id);
              if (session) {
                // Fix capital initialization: if capital is ~0 or negative, reset to initialCapital
                if (!sessionData.capital || sessionData.capital < 1) {
                  session.capital = settings.initialCapital;
                } else {
                  session.capital = sessionData.capital;
                }
                session.position = sessionData.position;
                session.trades = sessionData.trades || [];
                session.startTime = sessionData.startTime;
              }
              successCount++;
            } catch (sessionErr) {
              failCount++;
              console.warn(`⚠️  Failed to restore session ${sessionData.id}: ${sessionErr.message}`);
            }
          }
        }

        const activeCount = sessionsData.filter(s => s.active).length;
        console.log(`✅ Restored ${successCount}/${activeCount} paper trade sessions (${failCount} failed)`);

        if (failCount > 0) {
          console.log(`   💡 Tip: Failed sessions may be missing historical data or have invalid parameters`);
        }
      }
    } catch (err) {
      console.log('No previous sessions to restore:', err.message);
    }
  }

  /**
   * Start paper trading session
   */
  async startPaperTrade(sessionId, strategyName, pair, timeframe = '1m', params = null) {
    const strategy = this.strategyLoader.getStrategy(strategyName);
    if (!strategy) throw new Error(`Strategy ${strategyName} not found`);

    const strategyParams = params || strategy.params;
    let indicators, candlesData;

    // Check if strategy requires multi-timeframe data
    if (strategy.requiresMultiTimeframe && strategy.timeframes) {
      // Load data for all required timeframes
      const multiTimeframeCandles = {};

      for (const tf of strategy.timeframes) {
        try {
          const tfCandles = await this.dataService.loadHistoricalData(pair, tf);
          console.log(`  [DATA] ${pair} ${tf}: loaded ${tfCandles ? tfCandles.length : 0} candles`);
          if (tfCandles && tfCandles.length > 0) {
            multiTimeframeCandles[tf] = tfCandles;
          }
        } catch (err) {
          console.warn(`⚠️  Failed to load ${tf} data for ${pair}: ${err.message}`);
        }
      }

      // Initialize indicators with multi-timeframe data
      indicators = strategy.init(multiTimeframeCandles, strategyParams);

      // Primary candles are from the main timeframe
      candlesData = multiTimeframeCandles[timeframe] || [];

    } else {
      // Single timeframe mode (standard)
      const historicalCandles = await this.dataService.loadHistoricalData(pair, timeframe);
      console.log(`  [DATA] ${pair} ${timeframe}: loaded ${historicalCandles ? historicalCandles.length : 0} candles`);
      indicators = strategy.init(historicalCandles, strategyParams);
      candlesData = historicalCandles;
    }

    const session = {
      id: sessionId,
      strategy: strategyName,
      pair,
      timeframe,
      params: strategyParams,
      capital: settings.initialCapital,
      position: null,
      trades: [],
      candles: [...candlesData],
      indicators,
      equityCurve: [settings.initialCapital],
      startTime: Date.now(),
      active: true,
      requiresMultiTimeframe: strategy.requiresMultiTimeframe || false,
      timeframes: strategy.timeframes || [timeframe]
    };

    this.activeSessions.set(sessionId, session);

    // Subscribe to real-time data
    this.subscribeToRealTimeData(session);

    console.log(`📈 Paper trade started: ${strategyName} on ${pair} ${timeframe} (${candlesData.length} candles loaded)`);

    return session;
  }

  /**
   * Subscribe to real-time market data
   */
  subscribeToRealTimeData(session) {
    const { pair, timeframe } = session;

    // Get real-time ticker updates
    this.dataService.subscribeToTicker(pair, (ticker) => {
      if (!session.active) return;

      // Create new candle from ticker
      const newCandle = [
        ticker.timestamp,
        ticker.open || ticker.last,
        ticker.high || ticker.last,
        ticker.low || ticker.last,
        ticker.last,
        ticker.baseVolume || 0
      ];

      this.processNewCandle(session, newCandle);
    });
  }

  /**
   * Process new real-time candle
   */
  async processNewCandle(session, candle) {
    const { strategy: strategyName, params, candles, indicators, pair, timeframe, requiresMultiTimeframe, timeframes } = session;
    const strategy = this.strategyLoader.getStrategy(strategyName);

    // Add candle to history
    candles.push(candle);

    // Save real-time candle to disk (async, don't block)
    this.saveRealTimeCandle(pair, timeframe, candle).catch(err =>
      console.error(`Failed to save real-time candle for ${pair}:`, err.message)
    );

    // Update indicators - CRITICAL: Multi-timeframe support!
    let updatedIndicators;
    if (requiresMultiTimeframe && timeframes) {
      // Multi-timeframe: reload ALL timeframe data for indicator calculation
      const multiTimeframeCandles = {};
      for (const tf of timeframes) {
        // Use in-memory candles if it's the main timeframe, otherwise load from disk
        if (tf === timeframe) {
          multiTimeframeCandles[tf] = candles;
        } else {
          // Load latest data from disk - MUST AWAIT!
          try {
            const tfCandles = await this.dataService.loadHistoricalData(pair, tf, true);
            if (tfCandles && tfCandles.length > 0) {
              multiTimeframeCandles[tf] = tfCandles;
            }
          } catch (err) {
            // Use existing if load fails
          }
        }
      }
      console.log(`[processNewCandle] ${strategyName} ${pair}: multiTimeframeCandles keys=${Object.keys(multiTimeframeCandles)}, isArray=${Array.isArray(multiTimeframeCandles)}`);
      updatedIndicators = strategy.init(multiTimeframeCandles, params);
    } else {
      // Single timeframe
      updatedIndicators = strategy.init(candles, params);
    }
    session.indicators = updatedIndicators;

    const index = candles.length - 1;
    const close = candle[4];
    const timestamp = candle[0];

    // Get strategy signal - NO OVERRIDES!
    const strategySignal = strategy.next(index, candles, updatedIndicators, params);

    // DEBUG: Log 3RSI strategy evaluation (track real-time candle processing)
    if (strategyName === '3RSI 3CCI BB DCA') {
      // Initialize counter if not exists
      if (!session.debugCounter) session.debugCounter = 0;
      session.debugCounter++;

      // Log first 10 real-time candles processed
      if (session.debugCounter <= 10) {
        console.log(`  [DEBUG] 3RSI ${pair} candle #${session.debugCounter} (index ${index}): signal=${strategySignal ? strategySignal.signal : 'null'}, close=${close.toFixed(4)}`);
      }
    }

    // Execute trades based on strategy signal ONLY
    if (strategySignal) {
      this.executeSignal(session, strategySignal, close, timestamp);
    }

    // 📊 DCA AVERAGING DOWN - Add new entries when price drops
    if (session.position && session.position.isDCA && params.stepOrdersLong) {
      const firstEntry = session.position.entries[0];
      const lastEntry = session.position.entries[session.position.entries.length - 1];
      const dropPercent = ((lastEntry.entryPrice - close) / lastEntry.entryPrice) * 100;

      // If price dropped by stepOrdersLong% from last entry, add new DCA order
      if (dropPercent >= params.stepOrdersLong && session.position.entries.length < 20) {
        const positionSize = settings.initialCapital * settings.positionSize * (1.0 / 20); // 5% per order
        const fee = positionSize * settings.tradingFee;
        const slippage = close * settings.slippage;
        const entryPrice = close + slippage;

        // Check if we have enough capital
        if (session.capital >= (positionSize + fee)) {
          // Add new entry
          const newEntry = {
            entryPrice,
            entryTime: timestamp,
            size: positionSize / entryPrice,
            cost: positionSize + fee,
            orderNumber: session.position.entries.length + 1
          };

          session.position.entries.push(newEntry);

          // Update position totals
          session.position.size += newEntry.size;
          session.position.cost += newEntry.cost;
          // Recalculate average entry price
          session.position.entryPrice = session.position.cost / session.position.size;

          session.capital -= (positionSize + fee);

          console.log(`  🔄 DCA ORDER #${newEntry.orderNumber} ${session.pair} @ ${entryPrice.toFixed(4)} - Price dropped ${dropPercent.toFixed(2)}% from last entry (avg entry now: $${session.position.entryPrice.toFixed(4)})`);

          // Save after DCA order
          this.saveSessions().catch(err => console.error('Failed to save sessions:', err));
        }
      }
    }

    // INFORMATIONAL - Log trend/news analysis
    if (settings.trendEnhancementEnabled && this.trendDetector && index >= 200 && index % 100 === 0) {
      const trendAnalysis = this.trendDetector.detectTrend(candles, index);
      console.log(`ℹ️  [TREND] ${pair}: ${trendAnalysis.trend} (${(trendAnalysis.confidence * 100).toFixed(0)}% confidence)`);
    }

    // 📰 NEWS MONITOR - Warning for negative news (not exiting for now)
    if (settings.newsMonitorEnabled && this.newsMonitor && index % 100 === 0 && session.position) {
      const newsCheck = this.newsMonitor.shouldEmergencyExit(pair);
      if (newsCheck.shouldExit) {
        console.log(`📰 [NEWS WARNING] ${pair}: ${newsCheck.reason} (position open but not auto-exiting)`);
        // TODO: In future version, could add emergency exit here if severity is high
      }
    }

    // Update equity curve - SAME AS BACKTEST
    // Equity = Cash + Position Value (NOT unrealized PnL)
    const positionValue = session.position ? session.position.size * close : 0;
    const equity = session.capital + positionValue;
    session.equityCurve.push(equity);

    // Update unrealized PnL for display purposes AND check TP/SL
    if (session.position) {
      const unrealizedPnL = (session.position.size * close) - session.position.cost;
      const unrealizedPnLPercent = (unrealizedPnL / session.position.cost) * 100;
      session.position.unrealizedPnL = unrealizedPnL;
      session.position.unrealizedPnLPercent = unrealizedPnLPercent;

      // 💰 PROFIT MAXIMIZATION - Update max profit for trailing
      if (settings.adaptiveRiskEnabled && this.riskController) {
        this.riskController.updateMaxProfit(session.position, close);
      }

      // 💰 PROFIT MAXIMIZATION CHECK - Take profit intelligently
      if (settings.adaptiveRiskEnabled && this.riskController && index % 5 === 0) { // Check every 5 candles
        try {
          const profitCheck = this.riskController.shouldTakeProfit(session.candles, index, session.position);

          if (profitCheck.shouldExit) {
            console.log(`  💰 [PROFIT MAX] ${session.pair} - ${profitCheck.reason} (Priority: ${profitCheck.priority})`);

            // Close position at market price
            const exitPrice = close - (close * settings.slippage);
            const exitValue = session.position.size * exitPrice;
            const fee = exitValue * settings.tradingFee;
            const pnl = exitValue - session.position.cost - fee;

            session.capital += exitValue - fee;

            const trade = {
              pair: session.pair,
              type: session.position.type,
              entryTime: session.position.entryTime,
              exitTime: timestamp,
              entryPrice: session.position.entryPrice,
              exitPrice,
              size: session.position.size,
              pnl,
              pnlPercent: (pnl / session.position.cost) * 100,
              holdingTime: timestamp - session.position.entryTime,
              entryReason: session.position.reason,
              exitReason: `Profit Max: ${profitCheck.reason}`
            };

            session.trades.push(trade);

            // Record trade in performance tracker
            if (this.performanceTracker) {
              this.performanceTracker.recordTrade(session.id, trade);
            }

            console.log(`  💰 PROFIT TAKEN ${session.pair} @ ${exitPrice.toFixed(4)} | PnL: ${pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);

            session.position = null;

            // Save sessions after trade
            this.saveSessions().catch(err => console.error('Failed to save sessions:', err));

            // Return early - position closed
            return;
          }
        } catch (err) {
          // Silently continue if profit check fails
          console.warn(`⚠️  Profit check failed for ${session.pair}: ${err.message}`);
        }
      }

      // 🛡️ ADAPTIVE RISK CONTROLLER - Trailing stop adjustment
      if (settings.adaptiveRiskEnabled && this.riskController && index % 10 === 0) { // Check every 10 candles to reduce CPU
        try {
          const adjusted = this.riskController.adjustPosition(session.candles, index, session.position);
          if (adjusted.stopLoss !== session.position.stopLoss) {
            console.log(`  🛡️ [ADAPTIVE TRAIL] ${session.pair} - SL adjusted: $${session.position.stopLoss.toFixed(2)} → $${adjusted.stopLoss.toFixed(2)}`);
            session.position.stopLoss = adjusted.stopLoss;
            session.position.takeProfit = adjusted.takeProfit;
          }
        } catch (err) {
          // Silently continue if adjustment fails
        }
      }

      // ✅ CHECK TP/SL - CRITICAL FIX!
      const tpHit = session.position.type === 'long' ? close >= session.position.takeProfit : close <= session.position.takeProfit;
      const slHit = session.position.type === 'long' ? close <= session.position.stopLoss : close >= session.position.stopLoss;

      if (tpHit || slHit) {
        const exitReason = tpHit ? 'TP HIT' : 'SL HIT';
        const exitPrice = close - (close * settings.slippage);
        const exitValue = session.position.size * exitPrice;
        const fee = exitValue * settings.tradingFee;
        const pnl = exitValue - session.position.cost - fee;

        session.capital += exitValue - fee;

        const trade = {
          pair: session.pair,
          type: session.position.type,
          entryTime: session.position.entryTime,
          exitTime: timestamp,
          entryPrice: session.position.entryPrice,
          exitPrice,
          size: session.position.size,
          pnl,
          pnlPercent: (pnl / session.position.cost) * 100,
          holdingTime: timestamp - session.position.entryTime,
          entryReason: session.position.reason,
          exitReason
        };

        session.trades.push(trade);

        // Record trade in performance tracker
        if (this.performanceTracker) {
          this.performanceTracker.recordTrade(session.id, trade);
        }

        console.log(`  ${tpHit ? '🎯 TP HIT' : '⛔ SL HIT'} ${session.pair} @ ${exitPrice.toFixed(4)} | PnL: ${pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);

        session.position = null;

        // Save sessions after trade
        this.saveSessions().catch(err => console.error('Failed to save sessions:', err));
      }
    }
  }

  /**
   * Execute trading signal
   */
  executeSignal(session, signal, price, timestamp) {
    const { position } = session;
    let hasTraded = false;

    // DEBUG: Log executeSignal call for 3RSI
    if (session.strategy === '3RSI 3CCI BB DCA') {
      console.log(`  [executeSignal 3RSI] ${session.pair}: signal=${signal.signal}, hasPosition=${!!position}, price=${price.toFixed(4)}`);
    }

    // Entry - ONLY BUY signals
    if (signal.signal === 'buy' && !position) {
      console.log(`  [BUY CONDITION MET] ${session.pair} ${session.strategy}: Entering BUY block`);
      const positionSize = session.capital * settings.positionSize;
      const fee = positionSize * settings.tradingFee;
      const slippage = price * settings.slippage;
      const entryPrice = price + slippage;

      // 🛡️ ADAPTIVE RISK CONTROLLER - Calculate dynamic TP/SL based on ATR
      let stopLoss = signal.stopLoss;
      let takeProfit = signal.takeProfit;

      if (settings.adaptiveRiskEnabled && this.riskController && session.candles.length >= 50) {
        try {
          const index = session.candles.length - 1;
          const adaptiveSL = this.riskController.calculateAdaptiveStopLoss(session.candles, index, entryPrice, 'long');
          const adaptiveTP = this.riskController.calculateAdaptiveTakeProfit(session.candles, index, entryPrice, adaptiveSL.stopLoss, 'long');

          stopLoss = adaptiveSL.stopLoss;
          takeProfit = adaptiveTP.takeProfit;

          console.log(`  🛡️ [ADAPTIVE] ${session.pair} - ATR Stop: $${stopLoss.toFixed(2)} (${adaptiveSL.multiplier}x mult, ${adaptiveSL.volatility} vol)`);
          console.log(`  🛡️ [ADAPTIVE] ${session.pair} - TP: $${takeProfit.toFixed(2)} (RR: ${adaptiveTP.riskRewardRatio}:1, ${adaptiveTP.trendStrength} trend)`);
        } catch (err) {
          console.warn(`⚠️  Adaptive calc failed for ${session.pair}: ${err.message}, using strategy defaults`);
        }
      }

      session.position = {
        type: 'long',
        entryPrice,
        entryTime: timestamp,
        size: positionSize / entryPrice,
        cost: positionSize + fee,
        stopLoss,
        takeProfit,
        reason: signal.reason,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        pair: session.pair,
        enhanced: signal.enhanced || false,
        generatedByTrend: signal.generatedByTrend || false,
        isDCA: signal.type === 'DCA' || signal.dcaConfig !== undefined,
        entries: [{
          entryPrice,
          entryTime: timestamp,
          size: positionSize / entryPrice,
          cost: positionSize + fee,
          orderNumber: 1
        }]
      };

      session.capital -= (positionSize + fee);
      hasTraded = true;

      console.log(`  🟢 BUY ${session.pair} @ ${entryPrice.toFixed(4)} - ${signal.reason}`);

      // 🔄 SYNC TO REAL TRADE if enabled
      if (this.realTradeEngine) {
        this.realTradeEngine.processPaperSignal(session.id, signal, price, timestamp).catch(err => {
          console.error(`❌ Failed to sync signal to real trade: ${err.message}`);
        });
      }
    }

    // NO AUTO-EXIT - Manual close only, except ROI protection
    // Check ROI protection (close if ROI < -40%)
    if (position) {
      const metrics = this.calculateMetrics(session);

      if (metrics.roi < -40) {
        console.log(`  ⚠️  ROI PROTECTION TRIGGERED: ${metrics.roi.toFixed(2)}% < -40%`);

        const exitPrice = price - (price * settings.slippage);
        const exitValue = position.size * exitPrice;
        const fee = exitValue * settings.tradingFee;
        const pnl = exitValue - position.cost - fee;

        session.capital += exitValue - fee;

        const trade = {
          pair: session.pair,
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
          exitReason: 'ROI Protection (-40%)'
        };

        session.trades.push(trade);

        // Record trade in performance tracker
        if (this.performanceTracker) {
          this.performanceTracker.recordTrade(session.id, trade);
        }

        session.position = null;
        hasTraded = true;

        console.log(`  🔴 SELL ${session.pair} @ ${exitPrice.toFixed(4)} - ROI Protection | PnL: ${pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
      }
    }

    // Save sessions after trade
    if (hasTraded) {
      this.saveSessions().catch(err => console.error('Failed to save sessions:', err));
    }
  }

  /**
   * Stop paper trading session - MANUAL CLOSE with position exit
   */
  async stopPaperTrade(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    // Close open position if exists (MANUAL EXIT)
    if (session.position) {
      const lastCandle = session.candles[session.candles.length - 1];
      const currentPrice = lastCandle ? lastCandle[4] : session.position.entryPrice;
      const timestamp = lastCandle ? lastCandle[0] : Date.now();

      const exitPrice = currentPrice - (currentPrice * settings.slippage);
      const exitValue = session.position.size * exitPrice;
      const fee = exitValue * settings.tradingFee;
      const pnl = exitValue - session.position.cost - fee;

      session.capital += exitValue - fee;

      const trade = {
        pair: session.pair,
        type: session.position.type,
        entryTime: session.position.entryTime,
        exitTime: timestamp,
        entryPrice: session.position.entryPrice,
        exitPrice,
        size: session.position.size,
        pnl,
        pnlPercent: (pnl / session.position.cost) * 100,
        holdingTime: timestamp - session.position.entryTime,
        entryReason: session.position.reason,
        exitReason: 'Manual Close'
      };

      session.trades.push(trade);

      // Record trade in performance tracker
      if (this.performanceTracker) {
        this.performanceTracker.recordTrade(session.id, trade);
      }

      session.position = null;

      console.log(`  🔴 MANUAL CLOSE ${session.pair} @ ${exitPrice.toFixed(4)} | PnL: ${pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
    }

    // REMOVE session from memory completely (not just deactivate)
    this.activeSessions.delete(sessionId);

    // Calculate final metrics for return
    const metrics = this.calculateMetrics(session);

    // Save to disk (session is already deleted from activeSessions, so it won't be saved)
    await this.saveSessions();

    console.log(`⏹️  Paper trade stopped & DELETED: ${session.strategy} on ${session.pair}`);
    console.log(`   Total trades: ${session.trades.length}, ROI: ${metrics.roi.toFixed(2)}%`);

    return {
      ...session,
      metrics
    };
  }

  /**
   * Calculate session metrics
   */
  calculateMetrics(session) {
    const { trades, equityCurve } = session;

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
        avgLoss: 0,
        currentCapital: settings.initialCapital,
        finalCapital: settings.initialCapital
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
      roi: (netProfit / settings.initialCapital) * 100,
      profitFactor: Helpers.profitFactor(trades),
      sharpeRatio: Helpers.sharpeRatio(returns),
      sortinoRatio: Helpers.sortinoRatio(returns),
      maxDrawdown: Helpers.maxDrawdown(equityCurve) * 100,
      avgHoldingTime: trades.length > 0 ? trades.reduce((sum, t) => sum + t.holdingTime, 0) / trades.length : 0,
      avgWin: wins.length > 0 ? totalProfit / wins.length : 0,
      avgLoss: losses.length > 0 ? totalLoss / losses.length : 0,
      currentCapital: equityCurve[equityCurve.length - 1] || settings.initialCapital,
      finalCapital: equityCurve[equityCurve.length - 1] || settings.initialCapital
    };
  }

  /**
   * Get active session
   */
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Save real-time candle to disk AND generate all higher timeframes
   */
  async saveRealTimeCandle(pair, timeframe, candle) {
    try {
      // Load existing data for base timeframe
      const existingData = await this.dataService.loadHistoricalData(pair, timeframe, true);
      if (!existingData) {
        console.log(`No existing data for ${pair} ${timeframe}, skipping save`);
        return;
      }

      const timestamp = candle[0];
      const lastCandle = existingData[existingData.length - 1];

      // Only append if this is a newer candle
      if (!lastCandle || timestamp > lastCandle[0]) {
        existingData.push(candle);

        const { getExchangeForPair } = await import('../config/pairs.js');
        const exchange = getExchangeForPair(pair);
        const pairPath = path.join(settings.historicalDataPath, exchange, pair.replace('/', '_'));

        // Save base timeframe
        const dataPath = path.join(pairPath, `${timeframe}.json`);
        await Helpers.saveJSON(dataPath, existingData);

        // CRITICAL: Generate and save ALL higher timeframes from base data (including 3m for 7-RSI!)
        const higherTimeframes = ['3m', '5m', '15m', '30m', '55m', '1h', '2h', '4h', '1d'];
        const { TimeframeConverter } = await import('../utils/timeframeConverter.js');
        const converter = new TimeframeConverter();

        for (const tf of higherTimeframes) {
          try {
            const convertedData = converter.convert(existingData, tf);
            if (convertedData && convertedData.length > 0) {
              const tfPath = path.join(pairPath, `${tf}.json`);
              await Helpers.saveJSON(tfPath, convertedData);
            }
          } catch (err) {
            // Continue on error
          }
        }

        console.log(`✅ Saved real-time ${pair} ${timeframe} + multi-timeframes @ ${new Date(timestamp).toISOString()}`);
      }
    } catch (err) {
      console.error(`Error saving real-time candle:`, err.message);
    }
  }

  /**
   * Get all sessions with metrics
   */
  getAllSessions() {
    return Array.from(this.activeSessions.values()).map(session => {
      const metrics = this.calculateMetrics(session);

      // Calculate Open PnL (unrealized PnL from open position)
      let openPnL = 0;
      if (session.position && session.candles.length > 0) {
        const currentPrice = session.candles[session.candles.length - 1][4];
        openPnL = (session.position.size * currentPrice) - session.position.cost;
      }

      // Calculate ROI including Open PnL
      const roiWithOpenPnl = ((metrics.netProfit + openPnL) / settings.initialCapital) * 100;

      return {
        id: session.id,
        strategy: session.strategy,
        pair: session.pair,
        timeframe: session.timeframe,
        active: session.active,
        startTime: session.startTime,
        totalTrades: session.trades.length,
        openPnL,
        hasOpenPosition: !!session.position,
        roiWithOpenPnl, // ROI with open positions included
        metrics
      };
    });
  }
}

export default PaperTradeEngine;
