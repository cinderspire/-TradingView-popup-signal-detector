#!/usr/bin/env node
/**
 * TEST ORDER FOR MEXC
 *
 * Simulates a signal and sends a test order to MEXC
 * Uses AI + Adaptive TP/SL system
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../src/utils/logger');
const prisma = new PrismaClient();

async function sendTestOrder() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 SENDING TEST ORDER TO MEXC');
    console.log('='.repeat(80) + '\n');

    // Find suyttru user
    const user = await prisma.user.findFirst({
      where: { username: 'suyttru' }
    });

    if (!user) {
      console.error('❌ User suyttru not found');
      process.exit(1);
    }

    console.log(`✅ User: ${user.username} (${user.email})\n`);

    // Get MEXC API credentials
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        userId: user.id,
        exchange: 'mexc',
        isActive: true
      }
    });

    if (!apiKey) {
      console.error('❌ MEXC API key not found for suyttru');
      console.log('\nAvailable API keys:');
      const allKeys = await prisma.apiKey.findMany({
        where: { userId: user.id },
        select: { exchange: true, isActive: true }
      });
      console.table(allKeys);
      process.exit(1);
    }

    console.log(`✅ MEXC API Key found (Active: ${apiKey.isActive})\n`);

    // Get active subscription for 7RSI strategy (has TRBUSDT.P)
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        strategyId: 'ad36636f-5871-432b-bb2e-a168a7d8395c' // 7RSI
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

    console.log(`✅ Subscription: ${subscription.strategy.name}`);
    console.log(`   Pairs: ${subscription.subscribedPairs.join(', ')}`);
    console.log(`   AI Enabled: ${subscription.useAIRiskControl}`);
    console.log(`   Adaptive TP/SL: ${subscription.useAdaptiveTPSL}\n`);

    // Create test signal for TRBUSDT.P
    const testSymbol = 'TRBUSDT.P';
    const testEntry = 22.50; // Current price around $22.60

    console.log('━'.repeat(80));
    console.log('📊 TEST SIGNAL');
    console.log('━'.repeat(80));
    console.log(`Symbol: ${testSymbol}`);
    console.log(`Direction: LONG`);
    console.log(`Entry Price: $${testEntry}`);
    console.log(`Strategy: ${subscription.strategy.name}\n`);

    // Calculate AI + Adaptive TP/SL
    console.log('🤖 Calculating AI + Adaptive TP/SL...\n');

    let takeProfitPercent = null;
    let stopLossPercent = null;

    if (subscription.useAIRiskControl) {
      const AIRiskControl = require('../src/services/ai-risk-control');
      const aiService = AIRiskControl.getInstance();

      const aiContext = {
        symbol: testSymbol,
        direction: 'LONG',
        entryPrice: testEntry,
        currentPrice: testEntry,
        balance: 1000, // Test balance
        openPositionsCount: 0,
        recentPnL: 0,
        historicalPerformance: {
          winRate: 65,
          avgWin: 33.81,
          avgLoss: -1.04,
          maxProfit: 100,
          maxLoss: -10,
          recommendedTP: 33.81,
          recommendedSL: -1.04
        }
      };

      try {
        const aiRecommendation = await aiService.getTPSLRecommendation(aiContext);
        takeProfitPercent = aiRecommendation.takeProfit;
        stopLossPercent = Math.abs(aiRecommendation.stopLoss);

        console.log(`✅ AI Recommendation:`);
        console.log(`   TP: ${takeProfitPercent}%`);
        console.log(`   SL: ${stopLossPercent}%`);
        console.log(`   Confidence: ${aiRecommendation.confidence}`);
        console.log(`   Reasoning: ${aiRecommendation.reasoning}\n`);
      } catch (error) {
        console.log(`⚠️  AI unavailable, using Adaptive TP/SL...\n`);
      }
    }

    if (!takeProfitPercent && subscription.useAdaptiveTPSL) {
      const AdaptiveTPSLCalculator = require('../src/services/adaptive-tpsl-calculator');
      const calculator = AdaptiveTPSLCalculator.getInstance();

      const tpsl = calculator.calculateTPSL(testSymbol, subscription.riskProfile || 'balanced', {
        trailingStopEnabled: subscription.useTrailingStop,
        breakEvenEnabled: subscription.useBreakEven
      });

      takeProfitPercent = tpsl.tp;
      stopLossPercent = Math.abs(tpsl.sl);

      console.log(`✅ Adaptive TP/SL:`);
      console.log(`   TP: ${takeProfitPercent}%`);
      console.log(`   SL: ${stopLossPercent}%`);
      console.log(`   Based on: ${tpsl.basedOn}\n`);
    }

    // Calculate actual prices
    const takeProfitPrice = testEntry * (1 + takeProfitPercent / 100);
    const stopLossPrice = testEntry * (1 - stopLossPercent / 100);

    console.log('━'.repeat(80));
    console.log('📈 ORDER DETAILS');
    console.log('━'.repeat(80));
    console.log(`Entry: $${testEntry}`);
    console.log(`Take Profit: $${takeProfitPrice.toFixed(4)} (+${takeProfitPercent}%)`);
    console.log(`Stop Loss: $${stopLossPrice.toFixed(4)} (-${stopLossPercent}%)\n`);

    // Initialize MEXC exchange
    const ccxt = require('ccxt');
    const exchange = new ccxt.mexc({
      apiKey: apiKey.key,
      secret: apiKey.secret,
      enableRateLimit: true,
      options: {
        defaultType: 'swap' // Futures
      }
    });

    await exchange.loadMarkets();
    console.log('✅ MEXC exchange initialized\n');

    // Fetch balance
    const balance = await exchange.fetchBalance();
    const usdtBalance = balance.free['USDT'] || 0;
    console.log(`💰 MEXC Balance: ${usdtBalance} USDT\n`);

    if (usdtBalance < 10) {
      console.log('⚠️  WARNING: Low balance! Need at least $10 USDT');
      console.log('   Continuing with test order anyway...\n');
    }

    // Calculate position size (2% of balance or minimum $10)
    const orderSizePercent = subscription.orderSizePercent || 2.0;
    let orderSizeUSDT = Math.max(usdtBalance * (orderSizePercent / 100), 10);
    orderSizeUSDT = Math.min(orderSizeUSDT, usdtBalance * 0.5); // Max 50% of balance

    const leverage = 3; // 3x leverage for safer trading
    const amount = (orderSizeUSDT * leverage) / testEntry;

    console.log('━'.repeat(80));
    console.log('⚙️  POSITION SIZING');
    console.log('━'.repeat(80));
    console.log(`Risk per trade: ${orderSizePercent}%`);
    console.log(`Position size: $${orderSizeUSDT.toFixed(2)} USDT`);
    console.log(`Leverage: ${leverage}x`);
    console.log(`Amount: ${amount.toFixed(4)} TRB\n`);

    // Set leverage
    console.log(`🔧 Setting ${leverage}x leverage on ${testSymbol.replace('.P', '')}...`);
    try {
      await exchange.setLeverage(leverage, testSymbol.replace('.P', ''));
      console.log(`✅ Leverage set to ${leverage}x\n`);
    } catch (error) {
      console.log(`⚠️  Could not set leverage: ${error.message}\n`);
    }

    // Place order
    console.log('━'.repeat(80));
    console.log('🚀 PLACING TEST ORDER ON MEXC');
    console.log('━'.repeat(80));

    const orderParams = {
      stopLoss: { triggerPrice: stopLossPrice },
      takeProfit: { triggerPrice: takeProfitPrice }
    };

    console.log(`Symbol: ${testSymbol.replace('.P', '')}`);
    console.log(`Type: MARKET`);
    console.log(`Side: LONG`);
    console.log(`Amount: ${amount.toFixed(4)} TRB`);
    console.log(`Entry: ~$${testEntry}`);
    console.log(`TP: $${takeProfitPrice.toFixed(4)}`);
    console.log(`SL: $${stopLossPrice.toFixed(4)}\n`);

    console.log('⏳ Sending order to MEXC...\n');

    try {
      const order = await exchange.createOrder(
        testSymbol.replace('.P', ''), // Remove .P for MEXC
        'market',
        'buy',
        amount,
        null,
        orderParams
      );

      console.log('✅ ORDER PLACED SUCCESSFULLY!\n');
      console.log('Order Details:');
      console.log(JSON.stringify(order, null, 2));
      console.log('\n' + '━'.repeat(80));
      console.log('🎉 TEST ORDER COMPLETED!');
      console.log('━'.repeat(80));
      console.log(`\n💡 Check your MEXC account to verify the position\n`);

      // Save to database
      await prisma.signal.create({
        data: {
          id: `test-${Date.now()}`,
          strategyId: subscription.strategyId,
          type: 'ENTRY',
          symbol: testSymbol,
          direction: 'LONG',
          entryPrice: testEntry,
          takeProfit: takeProfitPrice,
          stopLoss: stopLossPrice,
          source: 'TEST',
          rawText: `TEST ORDER - AI+Adaptive TP/SL: TP ${takeProfitPercent}%, SL ${stopLossPercent}%`,
          status: 'ACTIVE',
          executedAt: new Date()
        }
      });

      console.log('✅ Signal saved to database\n');

    } catch (error) {
      console.error('\n❌ ORDER FAILED:');
      console.error(error.message);
      if (error.response) {
        console.error('\nAPI Response:');
        console.error(JSON.stringify(error.response, null, 2));
      }
    }

    await exchange.close();
    await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

sendTestOrder();
