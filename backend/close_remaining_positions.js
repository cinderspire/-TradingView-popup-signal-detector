const ccxt = require('ccxt');
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./src/utils/encryption');

const prisma = new PrismaClient();

(async () => {
  try {
    // Get MEXC API keys
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: { exchange: 'mexc', isActive: true }
    });

    if (!apiKeyRecord) {
      console.error('❌ MEXC API key not found!');
      process.exit(1);
    }

    const apiKey = decrypt(apiKeyRecord.apiKey);
    const apiSecret = decrypt(apiKeyRecord.apiSecret);

    console.log('✅ Connecting to MEXC...');

    const exchange = new ccxt.mexc({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
      options: { defaultType: 'spot' }
    });

    await exchange.loadMarkets();
    console.log('✅ Markets loaded');

    // Target positions to close
    const targetCoins = ['ICP', 'ORDI', 'AIA', 'KSM', 'PNUT', 'CORE', 'DOT'];

    // Get current balance
    const balance = await exchange.fetchBalance();

    console.log('\n💰 CURRENT USDT BALANCE:', balance.total.USDT || 0);
    console.log('\n🔴 CLOSING 7 POSITIONS...\n');

    let closedCount = 0;
    let totalValue = 0;

    for (const coin of targetCoins) {
      const amount = balance.total[coin] || 0;

      if (amount <= 0) {
        console.log(`⚠️ ${coin}: No balance found, skipping...`);
        continue;
      }

      const pair = coin + '/USDT';

      try {
        console.log(`\n🔄 Closing ${pair}...`);
        console.log(`   Amount: ${amount} ${coin}`);

        // Get current price
        const ticker = await exchange.fetchTicker(pair);
        const estimatedValue = amount * ticker.last;
        console.log(`   Price: ~${ticker.last} USDT`);
        console.log(`   Est. Value: ~${estimatedValue.toFixed(2)} USDT`);

        // Create market sell order
        const order = await exchange.createMarketSellOrder(pair, amount);

        console.log(`✅ ${pair} CLOSED!`);
        console.log(`   Order ID: ${order.id}`);

        closedCount++;
        totalValue += estimatedValue;

        // Wait 1 second between orders
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Failed to close ${pair}:`, error.message);
      }
    }

    console.log('\n\n✅ CLOSURE COMPLETE!');
    console.log(`📊 Closed positions: ${closedCount}/${targetCoins.length}`);
    console.log(`💵 Estimated total value: ${totalValue.toFixed(2)} USDT`);

    // Check final balance
    const finalBalance = await exchange.fetchBalance();
    console.log('\n💰 FINAL USDT BALANCE:', finalBalance.total.USDT || 0);

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
