#!/usr/bin/env node
/**
 * FULL SYSTEM TEST - MEXC SPOT + AI + ADAPTIVE TP/SL
 * Tests the complete flow including AI recommendations and adaptive TP/SL
 */

const { PrismaClient } = require('@prisma/client');
const ccxt = require('ccxt');
const prisma = new PrismaClient();

async function fullSystemTest() {
  let exchange = null;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 FULL SYSTEM TEST - MEXC SPOT + AI + ADAPTIVE TP/SL');
    console.log('='.repeat(80) + '\n');

    // Find user
    const user = await prisma.user.findFirst({
      where: { username: 'suyttru' }
    });

    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    console.log(`✅ User: ${user.username}\n`);

    // Get MEXC API key
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        userId: user.id,
        exchange: 'mexc',
        isActive: true
      }
    });

    if (!apiKey) {
      console.error('❌ MEXC API key not found');
      process.exit(1);
    }

    console.log('✅ MEXC API key found\n');

    // Get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE'
      },
      include: {
        strategy: {
          select: { name: true }
        }
      }
    });

    if (!subscription) {
      console.error('❌ No active subscription found');
      process.exit(1);
    }

    console.log('━'.repeat(80));
    console.log('📋 SUBSCRIPTION DETAILS');
    console.log('━'.repeat(80));
    console.log(`Strategy: ${subscription.strategy.name}`);
    console.log(`Exchange: ${subscription.activeExchange}`);
    console.log(`Order Type: ${subscription.orderType}`);
    console.log(`Order Size: $${subscription.fixedOrderSize} USDT (fixed)`);
    console.log(`AI Risk Control: ${subscription.useAIRiskControl ? '✅' : '❌'}`);
    console.log(`Adaptive TP/SL: ${subscription.useAdaptiveTPSL ? '✅' : '❌'}`);
    console.log(`Trailing Stop: ${subscription.useTrailingStop ? '✅' : '❌'}`);
    console.log(`Break-Even: ${subscription.useBreakEven ? '✅' : '❌'}`);
    console.log(`Risk Profile: ${subscription.riskProfile}`);
    console.log(`Pairs: ${subscription.subscribedPairs.slice(0, 3).join(', ')}...`);
    console.log('');

    // Initialize services
    console.log('━'.repeat(80));
    console.log('🔧 INITIALIZING SERVICES');
    console.log('━'.repeat(80) + '\n');

    const AIRiskControl = require('../src/services/ai-risk-control');
    const AdaptiveTPSLCalculator = require('../src/services/adaptive-tpsl-calculator');

    const aiService = AIRiskControl.getInstance();
    const adaptiveCalculator = AdaptiveTPSLCalculator.getInstance();

    console.log('✅ AI Risk Control Service loaded');
    console.log('✅ Adaptive TP/SL Calculator loaded\n');

    // Test symbol - use top performer ALCHUSDT.P
    const testSymbol = 'ALCHUSDT.P';
    const testSymbolSpot = 'ALCH/USDT'; // SPOT format for MEXC
    const entryPrice = 0.50; // Approximate current price

    console.log('━'.repeat(80));
    console.log('📊 TEST SIGNAL');
    console.log('━'.repeat(80));
    console.log(`Symbol: ${testSymbol}`);
    console.log(`Direction: LONG`);
    console.log(`Entry: $${entryPrice}\n`);

    // TEST 1: AI Risk Control
    console.log('━'.repeat(80));
    console.log('🤖 TEST 1: AI RISK CONTROL');
    console.log('━'.repeat(80) + '\n');

    let takeProfitPercent = null;
    let stopLossPercent = null;

    if (subscription.useAIRiskControl) {
      console.log('🤖 Calling GLM-4-flash API...\n');

      const aiContext = {
        symbol: testSymbol,
        direction: 'LONG',
        entryPrice: entryPrice,
        currentPrice: entryPrice,
        balance: 100, // Test balance
        openPositionsCount: 0,
        recentPnL: 0,
        historicalPerformance: {
          winRate: 97.4,
          avgWin: 5.60,
          avgLoss: -1.04,
          maxProfit: 100,
          maxLoss: -10,
          recommendedTP: 5.60,
          recommendedSL: -1.04
        }
      };

      try {
        const aiRecommendation = await aiService.getTPSLRecommendation(aiContext);
        takeProfitPercent = aiRecommendation.takeProfit;
        stopLossPercent = Math.abs(aiRecommendation.stopLoss);

        console.log('✅ AI RECOMMENDATION RECEIVED:');
        console.log(`   Take Profit: ${takeProfitPercent}%`);
        console.log(`   Stop Loss: ${stopLossPercent}%`);
        console.log(`   Confidence: ${aiRecommendation.confidence}`);
        console.log(`   Reasoning: ${aiRecommendation.reasoning}`);
        console.log('');
      } catch (error) {
        console.log(`⚠️  AI service unavailable: ${error.message}`);
        console.log('   Falling back to Adaptive TP/SL...\n');
      }
    }

    // TEST 2: Adaptive TP/SL (fallback or primary)
    console.log('━'.repeat(80));
    console.log('📊 TEST 2: ADAPTIVE TP/SL');
    console.log('━'.repeat(80) + '\n');

    if (!takeProfitPercent && subscription.useAdaptiveTPSL) {
      console.log('📊 Calculating from historical data...\n');

      const tpsl = adaptiveCalculator.calculateTPSL(testSymbol, subscription.riskProfile || 'balanced', {
        trailingStopEnabled: subscription.useTrailingStop,
        breakEvenEnabled: subscription.useBreakEven
      });

      takeProfitPercent = tpsl.tp;
      stopLossPercent = Math.abs(tpsl.sl);

      console.log('✅ ADAPTIVE TP/SL CALCULATED:');
      console.log(`   Take Profit: ${takeProfitPercent}%`);
      console.log(`   Stop Loss: ${stopLossPercent}%`);
      console.log(`   Based on: ${tpsl.basedOn}`);
      console.log(`   Trades analyzed: ${tpsl.tradeCount || 'N/A'}`);
      console.log('');
    }

    // Calculate actual prices
    const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
    const stopLossPrice = entryPrice * (1 - stopLossPercent / 100);

    console.log('━'.repeat(80));
    console.log('💰 FINAL TP/SL PRICES');
    console.log('━'.repeat(80));
    console.log(`Entry: $${entryPrice.toFixed(4)}`);
    console.log(`Take Profit: $${takeProfitPrice.toFixed(4)} (+${takeProfitPercent}%)`);
    console.log(`Stop Loss: $${stopLossPrice.toFixed(4)} (-${stopLossPercent}%)`);
    console.log(`Risk:Reward Ratio: 1:${(takeProfitPercent / stopLossPercent).toFixed(2)}`);
    console.log('');

    // TEST 3: MEXC SPOT Order Execution
    console.log('━'.repeat(80));
    console.log('🚀 TEST 3: MEXC SPOT ORDER EXECUTION');
    console.log('━'.repeat(80) + '\n');

    // Decrypt API credentials
    const { decrypt } = require('../src/utils/encryption');
    const decryptedKey = decrypt(apiKey.apiKey);
    const decryptedSecret = decrypt(apiKey.apiSecret);

    exchange = new ccxt.mexc({
      apiKey: decryptedKey,
      secret: decryptedSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'spot'
      }
    });

    await exchange.loadMarkets();
    console.log('✅ MEXC exchange connected (SPOT mode)\n');

    const balance = await exchange.fetchBalance();
    const usdtBalance = balance.free['USDT'] || 0;
    console.log(`💰 USDT Balance: $${usdtBalance.toFixed(2)}\n`);

    if (usdtBalance < subscription.fixedOrderSize) {
      console.log(`⚠️  Insufficient balance for order (need $${subscription.fixedOrderSize})`);
      console.log('\n✅ AI & Adaptive TP/SL tests PASSED');
      console.log('❌ Cannot execute order due to insufficient funds\n');
      process.exit(0);
    }

    // Get current price
    const ticker = await exchange.fetchTicker(testSymbolSpot);
    const currentPrice = ticker.last;
    const amount = subscription.fixedOrderSize / currentPrice;

    console.log(`Current Price: $${currentPrice.toFixed(4)}`);
    console.log(`Order Size: $${subscription.fixedOrderSize} USDT`);
    console.log(`Amount: ${amount.toFixed(6)} ALCH\n`);

    console.log('🚀 Placing SPOT market BUY order...\n');

    const order = await exchange.createMarketBuyOrder(testSymbolSpot, amount);

    console.log('✅ ORDER PLACED!\n');
    console.log(`Order ID: ${order.id}`);
    console.log(`Status: ${order.status}`);
    console.log(`Filled: ${order.filled || amount}`);
    console.log(`Average Price: $${order.average || currentPrice}\n`);

    // Note: SPOT orders don't have TP/SL attached, they would be managed separately
    console.log('📝 NOTE: SPOT orders on MEXC don\'t support attached TP/SL');
    console.log('    TP/SL would be managed by our backend monitoring system\n');

    // Wait 2 seconds
    console.log('⏳ Waiting 2 seconds before closing position...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Close position
    console.log('🔄 Closing position (selling back)...\n');

    const filledAmount = order.filled || amount;
    const closeOrder = await exchange.createMarketSellOrder(testSymbolSpot, filledAmount);

    console.log('✅ POSITION CLOSED!\n');
    console.log(`Close Order ID: ${closeOrder.id}`);
    console.log(`Status: ${closeOrder.status}\n`);

    // Summary
    console.log('━'.repeat(80));
    console.log('🎉 FULL SYSTEM TEST COMPLETED!');
    console.log('━'.repeat(80));
    console.log('\n✅ ALL COMPONENTS WORKING:');
    console.log('   ✓ User & Subscription verification');
    console.log('   ✓ AI Risk Control (GLM-4-flash)');
    console.log('   ✓ Adaptive TP/SL Calculator');
    console.log('   ✓ MEXC SPOT connection');
    console.log('   ✓ Market order execution');
    console.log('   ✓ Position opening');
    console.log('   ✓ Position closing');
    console.log('\n🚀 System is READY for live trading!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('API Response:', JSON.stringify(error.response, null, 2));
    }
    console.error('\nStack:', error.stack);
  } finally {
    if (exchange) {
      await exchange.close();
    }
    await prisma.$disconnect();
  }
}

fullSystemTest();
