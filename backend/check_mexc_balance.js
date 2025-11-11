const ccxt = require('ccxt');
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./src/utils/encryption');

const prisma = new PrismaClient();

(async () => {
  try {
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

    const balance = await exchange.fetchBalance();

    console.log('\n💰 MEXC BALANCES (ALL NON-ZERO):');
    console.log('='.repeat(60));

    let totalValueUSDT = balance.total.USDT || 0;
    console.log(`USDT: ${totalValueUSDT.toFixed(6)} USDT`);

    const positions = [];

    for (const [coin, amount] of Object.entries(balance.total)) {
      if (coin === 'USDT' || amount === 0 || amount < 0.000001) {
        continue;
      }

      const pair = coin + '/USDT';

      if (!exchange.markets[pair]) {
        console.log(`${coin}: ${amount.toFixed(8)} (no USDT market)`);
        continue;
      }

      try {
        const ticker = await exchange.fetchTicker(pair);
        const currentPrice = ticker.last;
        const valueUSDT = amount * currentPrice;
        totalValueUSDT += valueUSDT;

        positions.push({
          coin,
          amount,
          currentPrice,
          valueUSDT
        });

        console.log(`${coin}: ${amount.toFixed(8)} @ $${currentPrice.toFixed(6)} = $${valueUSDT.toFixed(2)} USDT`);
      } catch (e) {
        console.log(`${coin}: ${amount.toFixed(8)} (ticker error: ${e.message})`);
      }
    }

    console.log('='.repeat(60));
    console.log(`Total Portfolio Value: $${totalValueUSDT.toFixed(2)} USDT`);
    console.log(`Number of Open Positions: ${positions.length}`);
    console.log('='.repeat(60) + '\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
