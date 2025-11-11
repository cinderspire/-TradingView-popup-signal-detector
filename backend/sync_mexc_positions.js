/**
 * MEXC'deki mevcut pozisyonları database'e senkronize et
 * GRT, CAKE, MAV pozisyonlarını database'e ekleyeceğiz
 */

const ccxt = require('ccxt');
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./src/utils/encryption');

const prisma = new PrismaClient();

(async () => {
  try {
    // Get MEXC API keys
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: { exchange: 'mexc', isActive: true },
      include: { user: true }
    });

    if (!apiKeyRecord) {
      console.error('❌ MEXC API key not found!');
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

    // Get current balances
    const balance = await exchange.fetchBalance();

    console.log('\n💰 MEXC SPOT BALANCES:');
    console.log('USDT:', balance.total.USDT || 0);

    // Target positions to sync
    const targetCoins = ['GRT', 'CAKE', 'MAV'];
    const positions = [];

    for (const coin of targetCoins) {
      const amount = balance.total[coin];
      if (!amount || amount === 0) {
        console.log(`⚠️ ${coin} balance is zero, skipping`);
        continue;
      }

      const pair = coin + '/USDT';

      // Get current price
      let ticker;
      try {
        ticker = await exchange.fetchTicker(pair);
      } catch (e) {
        console.log(`❌ ${pair} ticker not found:`, e.message);
        continue;
      }

      const currentPrice = ticker.last;
      const valueUSDT = amount * currentPrice;

      // Estimate entry price (assume bought 2% lower than current)
      const estimatedEntry = currentPrice * 0.98;
      // TP/SL calculated from ENTRY price, not current price
      const takeProfit = estimatedEntry * 1.05; // +5% TP from entry
      const stopLoss = estimatedEntry * 0.97; // -3% SL from entry

      positions.push({
        coin,
        pair,
        amount,
        currentPrice,
        valueUSDT,
        estimatedEntry,
        takeProfit,
        stopLoss
      });

      console.log(`\n✅ ${coin}:`);
      console.log(`   Amount: ${amount}`);
      console.log(`   Price: ${currentPrice} USDT`);
      console.log(`   Value: ${valueUSDT.toFixed(2)} USDT`);
      console.log(`   Est. Entry: ${estimatedEntry.toFixed(6)}`);
      console.log(`   TP: ${takeProfit.toFixed(6)} (+5%)`);
      console.log(`   SL: ${stopLoss.toFixed(6)} (-3%)`);
    }

    console.log(`\n\n📊 Creating ${positions.length} positions in database...`);

    // Create positions in database
    for (const pos of positions) {
      try {
        const position = await prisma.position.create({
          data: {
            userId: apiKeyRecord.userId,
            symbol: pos.pair,
            side: 'LONG',
            size: pos.amount,
            entryPrice: pos.estimatedEntry,
            currentPrice: pos.currentPrice,
            stopLoss: pos.stopLoss,
            takeProfit: pos.takeProfit,
            status: 'OPEN',
            notes: `Synced from MEXC exchange - Real position`
          }
        });

        console.log(`✅ ${pos.coin} position created: ${position.id}`);

      } catch (dbError) {
        console.error(`❌ Failed to create ${pos.coin} position:`, dbError.message);
      }
    }

    console.log('\n✅ Position sync complete!');
    console.log('🎯 Position Monitor will now track these positions');
    console.log('📈 They will auto-close when TP/SL is reached');

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
