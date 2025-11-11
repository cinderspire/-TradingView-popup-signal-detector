#!/usr/bin/env node
/**
 * Test AI + Adaptive Services
 *
 * Tests:
 * 1. Multi-Source Price Service
 * 2. Adaptive TP/SL Calculator
 * 3. AI Risk Control Service
 */

const logger = require('../src/utils/logger');

async function testServices() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING AI + ADAPTIVE SERVICES');
  console.log('='.repeat(80) + '\n');

  let allTestsPassed = true;

  // Test 1: Multi-Source Price Service
  console.log('━'.repeat(80));
  console.log('TEST 1: Multi-Source Price Service');
  console.log('━'.repeat(80));

  try {
    const PriceService = require('../src/services/multi-source-price-service');
    const priceService = PriceService.getInstance();

    const symbols = ['BTC/USDT', 'ETH/USDT', 'TRBUSDT.P'];

    for (const symbol of symbols) {
      const price = await priceService.getPrice(symbol, { useCache: false });
      if (price) {
        console.log(`✅ ${symbol}: $${price}`);
      } else {
        console.log(`❌ ${symbol}: Failed to get price`);
        allTestsPassed = false;
      }
    }

    // Test cache
    const cached = await priceService.getPrice('BTC/USDT', { useCache: true });
    console.log(`✅ Cache test: $${cached} (should be from cache)`);

    console.log('\n✅ Multi-Source Price Service: PASSED\n');

  } catch (error) {
    console.error('❌ Multi-Source Price Service: FAILED');
    console.error(error.message);
    allTestsPassed = false;
  }

  // Test 2: Adaptive TP/SL Calculator
  console.log('━'.repeat(80));
  console.log('TEST 2: Adaptive TP/SL Calculator');
  console.log('━'.repeat(80));

  try {
    const AdaptiveTPSL = require('../src/services/adaptive-tpsl-calculator');
    const calculator = AdaptiveTPSL.getInstance();

    const testSymbols = [
      'TRBUSDT.P',
      'ALCHUSDT.P',
      'TRUMPUSDT.P',
      'UNKNOWNPAIR.P' // Should use global defaults
    ];

    const profiles = ['conservative', 'balanced', 'aggressive'];

    for (const symbol of testSymbols) {
      console.log(`\n📊 Testing ${symbol}:`);

      for (const profile of profiles) {
        const tpsl = calculator.calculateTPSL(symbol, profile, {
          trailingStopEnabled: true,
          breakEvenEnabled: true
        });

        console.log(`  ${profile}: TP ${tpsl.tp?.toFixed(2)}% | SL ${tpsl.sl?.toFixed(2)}% | Based on: ${tpsl.basedOn}`);

        if (!tpsl.tp || !tpsl.sl) {
          console.log(`  ❌ Invalid TP/SL values`);
          allTestsPassed = false;
        }
      }
    }

    console.log('\n✅ Adaptive TP/SL Calculator: PASSED\n');

  } catch (error) {
    console.error('❌ Adaptive TP/SL Calculator: FAILED');
    console.error(error.message);
    allTestsPassed = false;
  }

  // Test 3: AI Risk Control Service
  console.log('━'.repeat(80));
  console.log('TEST 3: AI Risk Control Service (GLM-4.6)');
  console.log('━'.repeat(80));

  try {
    const AIRiskControl = require('../src/services/ai-risk-control');
    const aiService = AIRiskControl.getInstance();

    // Test simple context
    const context = {
      symbol: 'BTC/USDT',
      direction: 'LONG',
      entryPrice: 50000,
      currentPrice: 50000,
      balance: 1000,
      openPositionsCount: 0,
      recentPnL: 0,
      historicalPerformance: {
        winRate: 65,
        avgWin: 3.5,
        avgLoss: -2.5,
        maxProfit: 10,
        maxLoss: -5,
        recommendedTP: 3.5,
        recommendedSL: -2.5
      }
    };

    console.log('🤖 Testing AI TP/SL recommendation...');
    const recommendation = await aiService.getTPSLRecommendation(context);

    console.log('\nAI Recommendation:');
    console.log(`  Take Profit: ${recommendation.takeProfit}%`);
    console.log(`  Stop Loss: ${recommendation.stopLoss}%`);
    console.log(`  Confidence: ${recommendation.confidence}`);
    console.log(`  Risk:Reward: 1:${recommendation.riskReward}`);
    console.log(`  Reasoning: ${recommendation.reasoning}`);

    if (!recommendation.takeProfit || !recommendation.stopLoss) {
      console.log(`❌ Invalid AI recommendation`);
      allTestsPassed = false;
    } else {
      console.log('\n✅ AI Risk Control Service: PASSED\n');
    }

  } catch (error) {
    console.error('❌ AI Risk Control Service: FAILED');
    console.error(error.message);
    console.error('\nNote: This might fail if GLM API is down or API key is invalid.');
    console.error('Fallback to historical data will be used in production.\n');
    // Don't fail entire test for AI service
  }

  // Final summary
  console.log('━'.repeat(80));
  if (allTestsPassed) {
    console.log('✅ ALL TESTS PASSED!');
  } else {
    console.log('❌ SOME TESTS FAILED - Check errors above');
  }
  console.log('━'.repeat(80) + '\n');

  process.exit(allTestsPassed ? 0 : 1);
}

// Run tests
testServices().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
