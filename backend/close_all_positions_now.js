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

    // Get current balances
    const balance = await exchange.fetchBalance();

    const targetCoins = ['GRT', 'CAKE', 'MAV'];
    let totalProfit = 0;

    console.log('\n🔴 CLOSING ALL POSITIONS:\n');

    for (const coin of targetCoins) {
      const amount = balance.total[coin];

      if (!amount || amount === 0) {
        console.log(`⚠️ ${coin} balance is zero, skipping`);
        continue;
      }

      const pair = coin + '/USDT';

      try {
        // Get current price
        const ticker = await exchange.fetchTicker(pair);
        const currentPrice = ticker.last;
        const valueUSDT = amount * currentPrice;

        console.log(`\n📊 ${coin}:`);
        console.log(`   Amount: ${amount}`);
        console.log(`   Price: ${currentPrice} USDT`);
        console.log(`   Value: ${valueUSDT.toFixed(2)} USDT`);

        // Create market sell order
        const order = await exchange.createMarketSellOrder(pair, amount);

        console.log(`✅ ${coin} SOLD successfully`);
        console.log(`   Order ID: ${order.id}`);
        console.log(`   Filled: ${order.filled || amount} ${coin}`);

        totalProfit += valueUSDT;

        // Update position in database to CLOSED
        const positions = await prisma.position.findMany({
          where: {
            symbol: pair,
            status: 'OPEN',
            userId: apiKeyRecord.userId
          }
        });

        for (const pos of positions) {
          const entryPrice = parseFloat(pos.entryPrice);
          const pnl = (currentPrice - entryPrice) * amount;

          await prisma.position.update({
            where: { id: pos.id },
            data: {
              status: 'CLOSED',
              exitPrice: currentPrice,
              realizedPnL: pnl,
              closedAt: new Date(),
              closeReason: 'Manual closure - System fix'
            }
          });

          console.log(`   Database updated: Position ${pos.id} CLOSED`);
          console.log(`   P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ ${coin} failed to close:`, error.message);
      }
    }

    console.log(`\n✅ ALL POSITIONS CLOSED`);
    console.log(`💰 Total value converted to USDT: ${totalProfit.toFixed(2)} USDT`);

    // Check final USDT balance
    const finalBalance = await exchange.fetchBalance();
    console.log(`\n💵 Final USDT balance: ${finalBalance.total.USDT || 0} USDT`);

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
