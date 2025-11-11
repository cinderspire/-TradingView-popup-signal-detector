const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Load blacklist
let blacklist = [];
try {
  const blacklistPath = path.join(__dirname, '../config/signal-blacklist.json');
  const blacklistData = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));
  blacklist = blacklistData.blacklistedPairs || [];
  console.log(`🚫 Loaded blacklist: ${blacklist.length} pairs filtered`);
} catch (error) {
  console.warn('⚠️  Blacklist file not found, no pairs will be filtered');
}

// TradingView Webhook Handler
router.post('/webhook', async (req, res) => {
  try {
    const startTime = Date.now();
    
    console.log('\n' + '='.repeat(60));
    console.log('📡 TRADINGVIEW WEBHOOK RECEIVED');
    console.log('='.repeat(60));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Raw Body:', req.body);
    
    // Parse signal from webhook
    let signal;
    
    if (typeof req.body === 'string') {
      try {
        signal = JSON.parse(req.body);
      } catch (e) {
        signal = { rawText: req.body };
      }
    } else {
      signal = req.body;
    }
    
    // Extract signal data with strategy
    const tradingSignal = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      source: 'tradingview_webhook',
      strategy: signal.strategy || signal.strategyName || 'Unknown',
      pair: signal.pair || signal.ticker || signal.symbol || 'UNKNOWN',
      direction: (signal.direction || signal.action || 'LONG').toUpperCase(),
      entry: parseFloat(signal.price || signal.entry || signal.close || 0),
      takeProfit: parseFloat(signal.tp || signal.take_profit || signal.takeProfit || 0) || null,
      stopLoss: parseFloat(signal.sl || signal.stop_loss || signal.stopLoss || 0) || null,
      timestamp: new Date().toISOString(),
      rawText: JSON.stringify(signal),
      currentPnL: 0,
      status: 'Active'
    };

    console.log('📊 Parsed Signal:', tradingSignal);

    // Check blacklist
    if (blacklist.includes(tradingSignal.pair)) {
      console.log(`🚫 BLACKLISTED PAIR: ${tradingSignal.pair} - Signal rejected`);
      return res.status(200).json({
        success: true,
        message: 'Signal rejected (blacklisted pair)',
        pair: tradingSignal.pair,
        reason: 'Poor historical performance'
      });
    }

    // Send to SignalDistributor directly
    const signalDistributor = req.app.get('signalDistributor');
    if (signalDistributor) {
      await signalDistributor.broadcastSignal(tradingSignal);
      console.log('✅ Signal broadcasted via SignalDistributor');
    }

    // Also try signal coordinator (legacy)
    const signalCoordinator = req.app.get('signalCoordinator');
    if (signalCoordinator) {
      await signalCoordinator.handleSignal(tradingSignal);
      console.log('✅ Signal sent to coordinator');
    }
    
    const latency = Date.now() - startTime;
    console.log(`⚡ Processing time: ${latency}ms`);
    console.log('='.repeat(60) + '\n');
    
    res.status(200).json({
      success: true,
      message: 'Signal received',
      latency: `${latency}ms`,
      signal: tradingSignal
    });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint
router.get('/webhook/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TradingView Webhook endpoint is ready',
    endpoint: '/api/trading/tradingview/webhook',
    method: 'POST',
    example: {
      pair: 'BTCUSDT',
      direction: 'LONG',
      price: 45000,
      tp: 46000,
      sl: 44000
    }
  });
});

module.exports = router;
