/**
 * COMPREHENSIVE SYSTEM TEST
 * Tests all components of the adaptive TP/SL system
 */

const { PrismaClient } = require('@prisma/client');
const { getInstance: getAdaptiveTPSL } = require('./src/services/adaptive-tpsl-calculator');
const { decrypt } = require('./src/utils/encryption');
const ccxt = require('ccxt');

const prisma = new PrismaClient();
const adaptiveTPSL = getAdaptiveTPSL();

async function runTests() {
  console.log('🧪 COMPREHENSIVE SYSTEM TEST');
  console.log('='.repeat(70));
  console.log('');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // TEST 1: Database Connection
  console.log('TEST 1: Database Connection');
  console.log('-'.repeat(70));
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ PASSED: Database connection successful\n');
    results.passed++;
    results.tests.push({ name: 'Database Connection', status: 'PASSED' });
  } catch (error) {
    console.log('❌ FAILED: Database connection failed:', error.message, '\n');
    results.failed++;
    results.tests.push({ name: 'Database Connection', status: 'FAILED', error: error.message });
  }

  // TEST 2: User & Subscription Check
  console.log('TEST 2: User & Subscription Check');
  console.log('-'.repeat(70));
  try {
    const user = await prisma.user.findFirst({ where: { email: { contains: '@' } } });
    if (!user) throw new Error('No user found');

    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { strategy: true }
    });
    if (!subscription) throw new Error('No active subscription');

    const strategyName = subscription.strategy ? subscription.strategy.name : 'Unknown';
    console.log(`✅ User: ${user.email}`);
    console.log(`✅ Subscription: ${strategyName}`);
    console.log(`   Adaptive TP/SL: ${subscription.useAdaptiveTPSL}`);
    console.log(`   Risk Profile: ${subscription.riskProfile || 'balanced'}`);
    console.log(`   Trailing Stop: ${subscription.useTrailingStop}`);
    console.log(`   Breakeven: ${subscription.useBreakEven}\n`);

    results.passed++;
    results.tests.push({ name: 'User & Subscription', status: 'PASSED' });
  } catch (error) {
    console.log('❌ FAILED:', error.message, '\n');
    results.failed++;
    results.tests.push({ name: 'User & Subscription', status: 'FAILED', error: error.message });
  }

  // TEST 3: Adaptive TP/SL Calculator - Conservative
  console.log('TEST 3: Adaptive TP/SL Calculator - Conservative Profile');
  console.log('-'.repeat(70));
  try {
    const tpsl = adaptiveTPSL.calculateTPSL('BTC/USDT', 'conservative');
    console.log(`Symbol: BTC/USDT`);
    console.log(`Profile: conservative`);
    console.log(`TP: ${tpsl.tp.toFixed(2)}%`);
    console.log(`SL: ${tpsl.sl.toFixed(2)}%`);
    console.log(`R/R Ratio: ${(Math.abs(tpsl.tp / tpsl.sl)).toFixed(2)}:1`);

    if (tpsl.tp > 0 && tpsl.sl < 0) {
      console.log('✅ PASSED: TP positive, SL negative\n');
      results.passed++;
      results.tests.push({ name: 'Adaptive Calculator - Conservative', status: 'PASSED' });
    } else {
      throw new Error('Invalid TP/SL values');
    }
  } catch (error) {
    console.log('❌ FAILED:', error.message, '\n');
    results.failed++;
    results.tests.push({ name: 'Adaptive Calculator - Conservative', status: 'FAILED', error: error.message });
  }

  // TEST 4: Adaptive TP/SL Calculator - Balanced
  console.log('TEST 4: Adaptive TP/SL Calculator - Balanced Profile');
  console.log('-'.repeat(70));
  try {
    const tpsl = adaptiveTPSL.calculateTPSL('ETH/USDT', 'balanced');
    console.log(`Symbol: ETH/USDT`);
    console.log(`Profile: balanced`);
    console.log(`TP: ${tpsl.tp.toFixed(2)}%`);
    console.log(`SL: ${tpsl.sl.toFixed(2)}%`);
    console.log(`R/R Ratio: ${(Math.abs(tpsl.tp / tpsl.sl)).toFixed(2)}:1`);

    if (tpsl.tp > 0 && tpsl.sl < 0) {
      console.log('✅ PASSED: TP positive, SL negative\n');
      results.passed++;
      results.tests.push({ name: 'Adaptive Calculator - Balanced', status: 'PASSED' });
    } else {
      throw new Error('Invalid TP/SL values');
    }
  } catch (error) {
    console.log('❌ FAILED:', error.message, '\n');
    results.failed++;
    results.tests.push({ name: 'Adaptive Calculator - Balanced', status: 'FAILED', error: error.message });
  }

  // TEST 5: Adaptive TP/SL Calculator - Aggressive
  console.log('TEST 5: Adaptive TP/SL Calculator - Aggressive Profile');
  console.log('-'.repeat(70));
  try {
    const tpsl = adaptiveTPSL.calculateTPSL('SOL/USDT', 'aggressive');
    console.log(`Symbol: SOL/USDT`);
    console.log(`Profile: aggressive`);
    console.log(`TP: ${tpsl.tp.toFixed(2)}%`);
    console.log(`SL: ${tpsl.sl.toFixed(2)}%`);
    console.log(`R/R Ratio: ${(Math.abs(tpsl.tp / tpsl.sl)).toFixed(2)}:1`);

    if (tpsl.tp > 0 && tpsl.sl < 0) {
      console.log('✅ PASSED: TP positive, SL negative\n');
      results.passed++;
      results.tests.push({ name: 'Adaptive Calculator - Aggressive', status: 'PASSED' });
    } else {
      throw new Error('Invalid TP/SL values');
    }
  } catch (error) {
    console.log('❌ FAILED:', error.message, '\n');
    results.failed++;
    results.tests.push({ name: 'Adaptive Calculator - Aggressive', status: 'FAILED', error: error.message });
  }

  // TEST 6: Position Database Query
  console.log('TEST 6: Position Database Query');
  console.log('-'.repeat(70));
  try {
    const positions = await prisma.position.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`Found ${positions.length} open positions`);

    if (positions.length > 0) {
      const pos = positions[0];
      console.log(`\nLatest Position:`);
      console.log(`  Symbol: ${pos.symbol}`);
      console.log(`  Side: ${pos.side}`);
      console.log(`  Entry: ${pos.entryPrice}`);
      console.log(`  TP: ${pos.takeProfit}`);
      console.log(`  SL: ${pos.stopLoss}`);
      console.log(`  Status: ${pos.status}`);
    }

    console.log('✅ PASSED: Position query successful\n');
    results.passed++;
    results.tests.push({ name: 'Position Database Query', status: 'PASSED' });
  } catch (error) {
    console.log('❌ FAILED:', error.message, '\n');
    results.failed++;
    results.tests.push({ name: 'Position Database Query', status: 'FAILED', error: error.message });
  }

  // TEST 7: MEXC API Connection
  console.log('TEST 7: MEXC API Connection');
  console.log('-'.repeat(70));
  try {
    const user = await prisma.user.findFirst({ where: { email: { contains: '@' } } });
    const apiKey = await prisma.apiKey.findFirst({
      where: { userId: user.id, exchange: 'mexc', isActive: true }
    });

    if (!apiKey) throw new Error('No MEXC API key found');

    const exchange = new ccxt.mexc({
      apiKey: decrypt(apiKey.apiKey),
      secret: decrypt(apiKey.apiSecret),
      enableRateLimit: true,
      options: { defaultType: 'spot' }
    });

    await exchange.loadMarkets();
    const balance = await exchange.fetchBalance();
    const usdtBalance = balance.total.USDT || 0;

    console.log(`✅ MEXC API Connected`);
    console.log(`   USDT Balance: ${usdtBalance.toFixed(2)}`);
    console.log(`   Markets Loaded: ${Object.keys(exchange.markets).length}\n`);

    results.passed++;
    results.tests.push({ name: 'MEXC API Connection', status: 'PASSED' });
  } catch (error) {
    console.log('❌ FAILED:', error.message, '\n');
    results.failed++;
    results.tests.push({ name: 'MEXC API Connection', status: 'FAILED', error: error.message });
  }

  // TEST 8: Real-Time Price Fetching
  console.log('TEST 8: Real-Time Price Fetching');
  console.log('-'.repeat(70));
  try {
    const user = await prisma.user.findFirst({ where: { email: { contains: '@' } } });
    const apiKey = await prisma.apiKey.findFirst({
      where: { userId: user.id, exchange: 'mexc', isActive: true }
    });

    const exchange = new ccxt.mexc({
      apiKey: decrypt(apiKey.apiKey),
      secret: decrypt(apiKey.apiSecret),
      enableRateLimit: true,
      options: { defaultType: 'spot' }
    });

    await exchange.loadMarkets();

    const testPairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
    let pricesFetched = 0;

    for (const pair of testPairs) {
      try {
        const ticker = await exchange.fetchTicker(pair);
        console.log(`${pair.padEnd(12)} Price: $${ticker.last.toFixed(2)}`);
        pricesFetched++;
      } catch (e) {
        console.log(`${pair.padEnd(12)} Error: ${e.message}`);
      }
    }

    if (pricesFetched > 0) {
      console.log(`\n✅ PASSED: Fetched ${pricesFetched}/${testPairs.length} prices\n`);
      results.passed++;
      results.tests.push({ name: 'Real-Time Price Fetching', status: 'PASSED' });
    } else {
      throw new Error('No prices fetched');
    }
  } catch (error) {
    console.log('❌ FAILED:', error.message, '\n');
    results.failed++;
    results.tests.push({ name: 'Real-Time Price Fetching', status: 'FAILED', error: error.message });
  }

  // TEST 9: Dynamic TP/SL Calculation (Breakeven & Trailing)
  console.log('TEST 9: Dynamic TP/SL Calculation (Breakeven & Trailing)');
  console.log('-'.repeat(70));
  try {
    const entryPrice = 100;
    const currentPrice = 105; // +5% profit

    const dynamicUpdate = adaptiveTPSL.calculateDynamicTPSL(
      entryPrice,
      currentPrice,
      'LONG',
      {
        originalTP: 110,
        originalSL: 95,
        trailingStop: {
          enabled: true,
          activationPercent: 3.0,
          callbackPercent: 2.0
        },
        breakEven: {
          enabled: true,
          activationPercent: 2.0,
          offsetPercent: 0.1
        }
      }
    );

    console.log(`Entry: $${entryPrice}`);
    console.log(`Current: $${currentPrice} (+5%)`);
    console.log(`Original SL: $95 (-5%)`);
    console.log(`\nDynamic Update:`);
    console.log(`  Should Update: ${dynamicUpdate.shouldUpdate}`);
    console.log(`  New SL: ${dynamicUpdate.newSL.toFixed(2)}%`);
    console.log(`  Modifications: ${dynamicUpdate.modifications.join(', ')}`);

    if (dynamicUpdate.modifications.includes('break_even')) {
      console.log('\n✅ PASSED: Breakeven activated at +5% profit\n');
      results.passed++;
      results.tests.push({ name: 'Dynamic TP/SL Calculation', status: 'PASSED' });
    } else {
      throw new Error('Breakeven should activate at +5% profit');
    }
  } catch (error) {
    console.log('❌ FAILED:', error.message, '\n');
    results.failed++;
    results.tests.push({ name: 'Dynamic TP/SL Calculation', status: 'FAILED', error: error.message });
  }

  // TEST 10: PM2 Process Status
  console.log('TEST 10: PM2 Process Status');
  console.log('-'.repeat(70));
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout);
    const api = processes.find(p => p.name === 'automatedtradebot-api');

    if (api && api.pm2_env.status === 'online') {
      console.log(`✅ PM2 Process: ${api.name}`);
      console.log(`   Status: ${api.pm2_env.status}`);
      console.log(`   Uptime: ${Math.floor((Date.now() - api.pm2_env.pm_uptime) / 1000)}s`);
      console.log(`   Memory: ${(api.monit.memory / 1024 / 1024).toFixed(2)} MB\n`);

      results.passed++;
      results.tests.push({ name: 'PM2 Process Status', status: 'PASSED' });
    } else {
      throw new Error('Process not online');
    }
  } catch (error) {
    console.log('❌ FAILED:', error.message, '\n');
    results.failed++;
    results.tests.push({ name: 'PM2 Process Status', status: 'FAILED', error: error.message });
  }

  // SUMMARY
  console.log('='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n✅ PASSED: ${results.passed}`);
  console.log(`❌ FAILED: ${results.failed}`);
  console.log(`📊 SUCCESS RATE: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%\n`);

  console.log('Detailed Results:');
  console.log('-'.repeat(70));
  results.tests.forEach((test, i) => {
    const icon = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`${i + 1}. ${icon} ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });
  console.log('');

  await prisma.$disconnect();

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests();
