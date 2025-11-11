/**
 * COMPREHENSIVE SYSTEM TEST
 * Tests the complete TP/SL workflow:
 * 1. Create test position in database
 * 2. Verify Position Monitor fetches real-time prices
 * 3. Simulate TP hit by updating currentPrice
 * 4. Verify automatic closure executes REAL sell order on MEXC
 */

const { PrismaClient } = require('@prisma/client');
const ccxt = require('ccxt');
const { decrypt } = require('./src/utils/encryption');

const prisma = new PrismaClient();

(async () => {
  try {
    console.log('\n🧪 COMPREHENSIVE SYSTEM TEST\n');

    // Get API keys
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: { exchange: 'mexc', isActive: true },
      include: { user: true }
    });

    if (!apiKeyRecord) {
      console.error('❌ MEXC API key not found');
      process.exit(1);
    }

    const apiKey = decrypt(apiKeyRecord.apiKey);
    const apiSecret = decrypt(apiKeyRecord.apiSecret);

    const exchange = new ccxt.mexc({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
      options: { defaultType: 'spot' }
    });

    await exchange.loadMarkets();

    // Choose a test coin with low value (to minimize risk)
    const testCoin = 'DOGE'; // Small position for testing
    const testPair = testCoin + '/USDT';

    console.log(`📊 Test coin: ${testCoin}`);

    // Get current price
    const ticker = await exchange.fetchTicker(testPair);
    const currentPrice = ticker.last;

    console.log(`💹 Current ${testCoin} price: ${currentPrice} USDT`);

    // Calculate test position (small size for safety)
    const testSizeUSDT = 2.0; // Only 2 USDT worth
    const testSize = testSizeUSDT / currentPrice;

    // Calculate proper TP/SL from entry
    const entryPrice = currentPrice * 0.99; // Simulate entry at 1% lower
    const takeProfit = entryPrice * 1.05; // +5% TP
    const stopLoss = entryPrice * 0.97; // -3% SL

    console.log(`\n📝 Creating test position:`);
    console.log(`   Symbol: ${testPair}`);
    console.log(`   Size: ${testSize.toFixed(6)} ${testCoin} (~${testSizeUSDT} USDT)`);
    console.log(`   Entry: ${entryPrice.toFixed(6)} USDT`);
    console.log(`   Current: ${currentPrice.toFixed(6)} USDT (${((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)}%)`);
    console.log(`   TP: ${takeProfit.toFixed(6)} USDT (+5.00%)`);
    console.log(`   SL: ${stopLoss.toFixed(6)} USDT (-3.00%)`);

    // Verify TP/SL percentages
    const tpPct = ((takeProfit - entryPrice) / entryPrice * 100);
    const slPct = ((stopLoss - entryPrice) / entryPrice * 100);

    console.log(`\n✅ Verification:`);
    console.log(`   TP is ${tpPct.toFixed(2)}% from entry (should be ~5%)`);
    console.log(`   SL is ${slPct.toFixed(2)}% from entry (should be ~-3%)`);

    if (Math.abs(tpPct - 5.0) > 0.01 || Math.abs(slPct + 3.0) > 0.01) {
      console.error('❌ TP/SL calculation is wrong!');
      process.exit(1);
    }

    // Create position in database
    const position = await prisma.position.create({
      data: {
        userId: apiKeyRecord.userId,
        symbol: testPair,
        side: 'LONG',
        size: testSize,
        entryPrice: entryPrice,
        currentPrice: currentPrice,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        status: 'OPEN',
        notes: 'SYSTEM TEST - Auto TP/SL verification'
      }
    });

    console.log(`\n✅ Position created in database: ${position.id}`);

    console.log(`\n⏳ Position Monitor will check this position every 5 seconds...`);
    console.log(`🔍 Watch the logs with: pm2 logs automatedtradebot-api`);

    console.log(`\n📋 TEST SCENARIOS:`);
    console.log(`\n1️⃣  NORMAL MONITORING (happening now):`);
    console.log(`   - Position Monitor fetches real-time ${testCoin} price`);
    console.log(`   - Compares against TP (${takeProfit.toFixed(6)}) and SL (${stopLoss.toFixed(6)})`);
    console.log(`   - Position stays OPEN until price reaches TP or SL`);

    console.log(`\n2️⃣  SIMULATE TP HIT (manual test):`);
    console.log(`   Run this to trigger TP:`);
    console.log(`   node -e "const {PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();await p.position.update({where:{id:'${position.id}'},data:{currentPrice:${takeProfit}}});await p.\\$disconnect();console.log('✅ Price set to TP level')})()"`);

    console.log(`\n3️⃣  VERIFY REAL ORDER EXECUTION:`);
    console.log(`   When TP is hit, check logs for:`);
    console.log(`   - "🔴 CLOSING POSITION: ${testPair}"`);
    console.log(`   - "✅ REAL ORDER EXECUTED on MEXC"`);
    console.log(`   - "✅ Position closed on exchange and in database"`);

    console.log(`\n4️⃣  VERIFY MEXC BALANCE:`);
    console.log(`   After auto-close, ${testCoin} should be sold`);
    console.log(`   USDT balance should increase by ~${testSizeUSDT} USDT`);

    console.log(`\n\n🎯 NEXT STEPS:`);
    console.log(`1. Wait 10 seconds for Position Monitor to detect position`);
    console.log(`2. Check logs: pm2 logs automatedtradebot-api --lines 50`);
    console.log(`3. Either wait for real price to hit TP, or manually trigger TP with command above`);
    console.log(`4. Verify REAL sell order is executed on MEXC\n`);

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
