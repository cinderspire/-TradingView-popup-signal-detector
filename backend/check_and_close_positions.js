const ccxt = require('ccxt');
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./src/utils/encryption');

const prisma = new PrismaClient();

(async () => {
  try {
    // Get MEXC API keys from database
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: { exchange: 'mexc', isActive: true }
    });

    if (!apiKeyRecord) {
      console.error('❌ MEXC API key bulunamadı!');
      process.exit(1);
    }

    // Decrypt API credentials
    const apiKey = decrypt(apiKeyRecord.apiKey);
    const apiSecret = decrypt(apiKeyRecord.apiSecret);

    console.log('✅ MEXC API bağlantısı kuruluyor...');

    const exchange = new ccxt.mexc({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
      options: { defaultType: 'spot' }
    });

    await exchange.loadMarkets();
    console.log('✅ Markets yüklendi');

    // Get all balances
    const balance = await exchange.fetchBalance();

    console.log('\n💰 MEXC SPOT BAKİYELER:');
    console.log('USDT:', balance.total.USDT || 0);

    // Show all non-zero balances
    console.log('\n📊 AÇIK POZİSYONLAR (Sıfır Olmayan Bakiyeler):');
    const positions = [];

    for (const [coin, amount] of Object.entries(balance.total)) {
      if (amount > 0 && coin !== 'USDT') {
        const free = balance.free[coin] || 0;
        const used = balance.used[coin] || 0;
        const pair = coin + '/USDT';

        // Get current price
        let currentPrice = 0;
        let ticker = null;
        try {
          ticker = await exchange.fetchTicker(pair);
          currentPrice = ticker.last;
        } catch (e) {
          console.log(`⚠️ ${pair} fiyatı alınamadı:`, e.message);
          continue;
        }

        positions.push({
          coin,
          total: amount,
          free: free,
          used: used,
          pair: pair,
          currentPrice: currentPrice,
          valueUSDT: amount * currentPrice
        });
      }
    }

    console.log('\n📋 BULUNAN POZİSYONLAR:');
    positions.forEach((p, i) => {
      console.log(`\n${i+1}. ${p.coin}:`);
      console.log(`   Miktar: ${p.total}`);
      console.log(`   Fiyat: ${p.currentPrice} USDT`);
      console.log(`   Değer: ${p.valueUSDT.toFixed(2)} USDT`);
      console.log(`   Pair: ${p.pair}`);
    });

    console.log('\n\n🎯 TOPLAM AÇIK POZİSYON:', positions.length);
    console.log('💵 TOPLAM DEĞER:', positions.reduce((sum, p) => sum + p.valueUSDT, 0).toFixed(2), 'USDT');

    // Ask if user wants to close positions
    console.log('\n\n🔴 MANUEL KAPAMA İŞLEMİ BAŞLIYOR...\n');

    // Close each position
    for (const pos of positions) {
      try {
        console.log(`\n🔄 ${pos.pair} kapatılıyor...`);
        console.log(`   Miktar: ${pos.total} ${pos.coin}`);
        console.log(`   Fiyat: ~${pos.currentPrice} USDT`);

        // Create market sell order
        const order = await exchange.createMarketSellOrder(pos.pair, pos.total);

        console.log(`✅ ${pos.pair} KAPATILDI!`);
        console.log(`   Order ID: ${order.id}`);
        console.log(`   Filled: ${order.filled} ${pos.coin}`);
        console.log(`   Cost: ${order.cost} USDT`);

        // Wait 1 second between orders
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ ${pos.pair} kapatılamadı:`, error.message);
      }
    }

    console.log('\n\n✅ TÜM POZİSYONLAR KAPATILDI!');

    // Check final balance
    const finalBalance = await exchange.fetchBalance();
    console.log('\n💰 SON BAKİYE:');
    console.log('USDT:', finalBalance.total.USDT || 0);

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Hata:', error.message);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
