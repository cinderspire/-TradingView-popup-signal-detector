const WebSocket = require('ws');
const { EventEmitter } = require('events');
const jwt = require('jsonwebtoken');
const SignalPnLTracker = require('./signal-pnl-tracker');
const StrategyStatistics = require('./strategy-statistics');
const SignalPersistenceV2 = require('./signal-persistence-v2'); // ULTRA STABLE V2

class SignalDistributor extends EventEmitter {
  constructor(server) {
    super();

    this.wss = new WebSocket.Server({
      server,
      perMessageDeflate: false, // Disable compression for speed
      clientTracking: true,
      maxPayload: 10 * 1024, // 10KB max
      path: '/ws/signals'
    });

    this.subscribers = new Map(); // userId -> client info
    this.signalHistory = []; // Last 100 signals
    this.stats = {
      totalSignals: 0,
      totalBroadcasts: 0,
      activeConnections: 0
    };

    this.setupWebSocket();
    this.setupPnLTracking();
    this.loadPersistedSignals();
    console.log('✅ Signal Distributor initialized');
  }

  async loadPersistedSignals() {
    try {
      await SignalPersistenceV2.initialize();
      const allSignals = await SignalPersistenceV2.getAllSignals();

      // Load all signals into history (active + closed this month)
      this.signalHistory = allSignals;

      const stats = SignalPersistenceV2.getStats();
      console.log(`✅ Loaded ${allSignals.length} signals (${stats.activeSignals} active, ${stats.totalClosed} total closed)`);
      console.log(`📊 Signal history initialized`);

    } catch (error) {
      console.error('❌ Error loading persisted signals:', error);
    }
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const startTime = Date.now();

      try {
        // TEMPORARILY ALLOW ALL CONNECTIONS - NO AUTH REQUIRED
        // Generate unique userId for unauthenticated connections
        const userId = 'viewer_' + Math.random().toString(36).substring(7);

        console.log(`🔓 WebSocket connection established: ${userId}`);
        console.log(`   Referer: ${req.headers.referer || 'none'}`);
        console.log(`   Origin: ${req.headers.origin || 'none'}`);
        console.log(`   User-Agent: ${req.headers['user-agent'] || 'none'}`);

        // Store subscriber info
        this.subscribers.set(userId, {
          ws,
          userId,
          connectedAt: Date.now(),
          subscriptions: [], // Strategy/provider IDs
          settings: {
            paperTradeEnabled: false,
            realTradeEnabled: false,
            autoExecute: false
          },
          exchanges: [], // Connected exchange accounts
          latency: []
        });

        this.stats.activeConnections++;

        // Send welcome message
        this.sendToClient(ws, {
          type: 'CONNECTED',
          timestamp: Date.now(),
          userId,
          message: 'Connected to signal stream'
        });

        // Send ALL signals from V2 persistence (instance method)
        console.log(`🔍 About to call getAllSignals() for user ${userId}`);
        SignalPersistenceV2.getAllSignals().then(allSignals => {
          console.log(`✅ getAllSignals() resolved with ${allSignals.length} signals`);

          // Send signals in chunks to prevent WebSocket overflow (25MB is too much!)
          const CHUNK_SIZE = 1000;
          const totalChunks = Math.ceil(allSignals.length / CHUNK_SIZE);

          console.log(`📦 Sending ${allSignals.length} signals in ${totalChunks} chunks...`);

          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, allSignals.length);
            const chunk = allSignals.slice(start, end);

            this.sendToClient(ws, {
              type: i === 0 ? 'HISTORY' : 'HISTORY_CHUNK',
              signals: chunk,
              chunkInfo: {
                current: i + 1,
                total: totalChunks,
                isLast: i === totalChunks - 1
              }
            });

            // Small delay between chunks to prevent overwhelming the client
            if (i < totalChunks - 1) {
              // Don't wait after last chunk
              setTimeout(() => {}, 10);
            }
          }

          console.log(`📤 Sent ${allSignals.length} signals in ${totalChunks} chunks to client ${userId}`);
        }).catch(err => {
          console.error('❌ Error sending signal history:', err);
          console.error('❌ Error details:', err.message, err.stack);
          // Fallback to in-memory signals
          this.sendToClient(ws, {
            type: 'HISTORY',
            signals: this.signalHistory
          });
          console.log(`📤 Sent ${this.signalHistory.length} fallback signals to client`);
        });

        // Handle messages from client
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message);
            this.handleClientMessage(userId, data);
          } catch (error) {
            console.error('❌ Message parse error:', error);
          }
        });

        // Handle connection close
        ws.on('close', () => {
          console.log(`📱 User ${userId} disconnected`);
          this.subscribers.delete(userId);
          this.stats.activeConnections--;
        });

        // Handle errors
        ws.on('error', (error) => {
          console.error(`❌ WebSocket error for user ${userId}:`, error);
        });

        // Ping/pong for connection health
        ws.isAlive = true;
        ws.on('pong', () => {
          ws.isAlive = true;
        });

      } catch (error) {
        console.error('❌ Connection error:', error);
        ws.close(1008, 'Authentication failed');
      }
    });

    // Heartbeat interval
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds

    console.log('✅ WebSocket handlers configured');
  }

  extractToken(req) {
    // Extract JWT from query string or headers
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token') ||
                  req.headers.authorization?.replace('Bearer ', '');

    return token;
  }

  handleClientMessage(userId, data) {
    const client = this.subscribers.get(userId);
    if (!client) return;

    switch (data.type) {
      case 'SUBSCRIBE':
        // Subscribe to specific strategy/provider
        if (!client.subscriptions.includes(data.id)) {
          client.subscriptions.push(data.id);
          console.log(`✅ User ${userId} subscribed to ${data.id}`);
        }
        break;

      case 'UNSUBSCRIBE':
        client.subscriptions = client.subscriptions.filter(id => id !== data.id);
        console.log(`✅ User ${userId} unsubscribed from ${data.id}`);
        break;

      case 'SETTINGS':
        // Update user settings
        client.settings = { ...client.settings, ...data.settings };
        console.log(`⚙️  User ${userId} updated settings`);
        break;

      case 'PONG':
        // Latency measurement
        const latency = Date.now() - data.timestamp;
        client.latency.push(latency);
        if (client.latency.length > 10) client.latency.shift();
        break;

      default:
        console.log(`⚠️  Unknown message type: ${data.type}`);
    }
  }

  async broadcastSignal(signal) {
    const broadcastStart = Date.now();

    console.log(`📡 Broadcasting signal: ${signal.pair} ${signal.direction} @ ${signal.entry}`);

    // Start PnL tracking for this signal
    const tracked = SignalPnLTracker.startTracking(signal);

    // Add to strategy statistics
    StrategyStatistics.addSignal(signal);

    // Enhance signal with PnL data
    const enhancedSignal = {
      ...signal,
      broadcastTime: broadcastStart,
      pnlHistory: tracked.pnlHistory,
      currentPnL: tracked.currentPnL,
      currentPrice: tracked.currentPrice,
      status: tracked.status
    };

    // Add to history (in memory)
    this.signalHistory.push(enhancedSignal);

    // PERSIST TO V2 DATABASE - ULTRA STABLE
    SignalPersistenceV2.addSignal(enhancedSignal).catch(err => {
      console.error('❌ Failed to persist signal:', err);
    });

    this.stats.totalSignals++;

    // Prepare message
    const message = JSON.stringify({
      type: 'SIGNAL',
      timestamp: Date.now(),
      signal: enhancedSignal
    });

    // Broadcast to all connected subscribers
    const broadcasts = [];
    let successCount = 0;
    let failCount = 0;

    for (const [userId, client] of this.subscribers.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        broadcasts.push(
          new Promise((resolve) => {
            try {
              client.ws.send(message, (err) => {
                if (err) {
                  failCount++;
                  console.error(`❌ Failed to send to user ${userId}:`, err.message);
                } else {
                  successCount++;
                  this.stats.totalBroadcasts++;

                  // Auto-execute if enabled
                  if (client.settings.autoExecute) {
                    this.executeSignal(userId, signal, client).catch(console.error);
                  }
                }
                resolve();
              });
            } catch (error) {
              failCount++;
              resolve();
            }
          })
        );
      }
    }

    await Promise.all(broadcasts);

    const broadcastLatency = Date.now() - broadcastStart;

    console.log(`✅ Broadcast complete: ${successCount} success, ${failCount} failed (${broadcastLatency}ms)`);

    return {
      success: successCount,
      failed: failCount,
      latency: broadcastLatency
    };
  }

  /**
   * Setup PnL tracking listeners
   */
  setupPnLTracking() {
    // Listen for PnL updates
    SignalPnLTracker.on('pnl-update', (updates) => {
      this.broadcastPnLUpdates(updates);
    });

    // Listen for signal closes
    SignalPnLTracker.on('signal-closed', (closeEvent) => {
      this.broadcastSignalClose(closeEvent);
    });

    console.log('✅ PnL tracking listeners configured');
  }

  /**
   * Broadcast PnL updates to all connected clients
   */
  broadcastPnLUpdates(updates) {
    // Update strategy statistics
    for (const update of updates) {
      StrategyStatistics.updateSignalPnL(update.signalId, update.currentPnL, update.currentPrice);

      // UPDATE SIGNAL IN HISTORY
      const signalIndex = this.signalHistory.findIndex(s => s.id === update.signalId);
      if (signalIndex !== -1) {
        this.signalHistory[signalIndex] = {
          ...this.signalHistory[signalIndex],
          currentPnL: update.currentPnL,
          currentPrice: update.currentPrice,
          lastUpdate: new Date().toISOString()
        };
      }

      // UPDATE IN V2 PERSISTENCE (batch update every 10 updates to avoid disk thrashing)
      if (Math.random() < 0.1) { // 10% chance to persist
        SignalPersistenceV2.updateSignal(update.signalId, {
          currentPnL: update.currentPnL,
          currentPrice: update.currentPrice,
          lastUpdate: new Date().toISOString()
        }).catch(err => {
          // Silent fail - not critical
        });
      }
    }

    const message = JSON.stringify({
      type: 'PNL_UPDATE',
      timestamp: Date.now(),
      updates
    });

    for (const [userId, client] of this.subscribers.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message, (err) => {
          if (err) {
            console.error(`❌ Failed to send PnL update to ${userId}:`, err.message);
          }
        });
      }
    }
  }

  /**
   * Close signal by strategy and pair (for TradingView close signals)
   * ULTRA STABLE - Uses V2 persistence with signal ID support
   */
  async closeSignalByStrategyAndPair(strategy, pair, exitPrice, reason = 'Manual Close', signalId = null) {
    // Try to find by signal ID first (MOST PRECISE)
    let openSignal = null;

    if (signalId) {
      openSignal = SignalPersistenceV2.findActiveSignalById(signalId);
      if (openSignal) {
        console.log(`✅ Found signal by ID: ${signalId}`);
      }
    }

    // Fallback: Find by strategy + pair (RELIABLE)
    if (!openSignal) {
      openSignal = SignalPersistenceV2.findActiveSignalByStrategyPair(strategy, pair);
      if (openSignal) {
        console.log(`✅ Found signal by strategy+pair: ${strategy} ${pair}`);
      }
    }

    if (!openSignal) {
      console.log(`⚠️  No open signal found for ${strategy} ${pair}`);
      return null;
    }

    // Calculate PnL
    const entry = openSignal.entry || openSignal.entryPrice || 0;
    const direction = (openSignal.direction || 'LONG').toUpperCase();

    let pnl = 0;
    if (entry && exitPrice) {
      if (direction === 'LONG') {
        pnl = ((exitPrice - entry) / entry) * 100;
      } else { // SHORT
        pnl = ((entry - exitPrice) / entry) * 100;
      }
    }

    console.log(`🔒 Closing signal: ${openSignal.id} | ${strategy} ${pair} | Entry: ${entry} → Exit: ${exitPrice} | PnL: ${pnl.toFixed(2)}%`);

    // Close in V2 persistence (moves to closed archive)
    await SignalPersistenceV2.closeSignal(openSignal.id, exitPrice, pnl, reason);

    // Broadcast close event
    this.broadcastSignalClose({
      signalId: openSignal.id,
      strategy,
      pair,
      exitPrice,
      finalPnL: pnl,
      reason
    });

    return {
      signalId: openSignal.id,
      finalPnL: pnl,
      exitPrice
    };
  }

  /**
   * Broadcast signal close event
   */
  broadcastSignalClose(closeEvent) {
    // Update strategy statistics
    StrategyStatistics.closeSignal(
      closeEvent.signalId,
      closeEvent.exitPrice,
      closeEvent.finalPnL,
      closeEvent.reason
    );

    // UPDATE SIGNAL IN MEMORY HISTORY
    const signalIndex = this.signalHistory.findIndex(s => s.id === closeEvent.signalId);
    if (signalIndex !== -1) {
      this.signalHistory[signalIndex] = {
        ...this.signalHistory[signalIndex],
        status: 'Closed',
        finalPnL: closeEvent.finalPnL,
        exitPrice: closeEvent.exitPrice,
        closedAt: new Date().toISOString(),
        closeReason: closeEvent.reason
      };
    }
    // Note: V2 persistence already handled in closeSignalByStrategyAndPair

    const message = JSON.stringify({
      type: 'SIGNAL_CLOSED',
      timestamp: Date.now(),
      ...closeEvent
    });

    for (const [userId, client] of this.subscribers.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message, (err) => {
          if (err) {
            console.error(`❌ Failed to send signal close to ${userId}:`, err.message);
          }
        });
      }
    }

    console.log(`📢 Broadcasted signal close: ${closeEvent.signalId} (${closeEvent.reason})`);
  }

  async executeSignal(userId, signal, client) {
    const executionStart = Date.now();

    try {
      const executions = [];

      // Paper trade execution
      if (client.settings.paperTradeEnabled) {
        const PaperTradeEngine = require('./paper-trade-engine');
        executions.push(
          PaperTradeEngine.executeSignal(userId, signal)
        );
      }

      // Real trade execution
      if (client.settings.realTradeEnabled && client.exchanges.length > 0) {
        const ExchangeExecutor = require('./exchange-executor');

        for (const exchange of client.exchanges) {
          if (exchange.enabled) {
            executions.push(
              ExchangeExecutor.executeSignal(
                userId,
                exchange.id,
                signal,
                exchange.config
              )
            );
          }
        }
      }

      const results = await Promise.allSettled(executions);

      const executionLatency = Date.now() - executionStart;

      // Send execution result to client
      this.sendToClient(client.ws, {
        type: 'EXECUTION_RESULT',
        signalId: signal.id,
        results: results.map(r => ({
          status: r.status,
          value: r.status === 'fulfilled' ? r.value : r.reason?.message
        })),
        latency: executionLatency
      });

      console.log(`✅ Signal executed for user ${userId} (${executionLatency}ms)`);

    } catch (error) {
      console.error(`❌ Execution error for user ${userId}:`, error);

      this.sendToClient(client.ws, {
        type: 'EXECUTION_ERROR',
        signalId: signal.id,
        error: error.message
      });
    }
  }

  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      const msgType = data.type || 'UNKNOWN';
      const dataSize = JSON.stringify(data).length;
      console.log(`📨 sendToClient: type=${msgType}, size=${dataSize} bytes, readyState=OPEN`);
      ws.send(JSON.stringify(data));
    } else {
      console.warn(`⚠️ Cannot send ${data.type}: WebSocket readyState=${ws.readyState} (not OPEN)`);
    }
  }

  getStats() {
    const avgLatency = [];

    for (const client of this.subscribers.values()) {
      if (client.latency.length > 0) {
        const avg = client.latency.reduce((a, b) => a + b, 0) / client.latency.length;
        avgLatency.push(avg);
      }
    }

    return {
      ...this.stats,
      avgClientLatency: avgLatency.length > 0
        ? Math.round(avgLatency.reduce((a, b) => a + b, 0) / avgLatency.length)
        : 0,
      recentSignals: this.signalHistory.slice(-5)
    };
  }

  async stop() {
    console.log('⏹️  Stopping Signal Distributor...');

    // Close all connections
    for (const client of this.subscribers.values()) {
      client.ws.close(1000, 'Server shutting down');
    }

    this.wss.close();

    console.log('✅ Signal Distributor stopped');
  }
}

module.exports = SignalDistributor;
