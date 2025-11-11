const ccxt = require('ccxt');
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./src/utils/encryption');

const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🔧 FIXING AND CLOSING AIA POSITION\n');
    console.log('='.repeat(70));

    // 1. Find AIA position
    const aiaPosition = await prisma.position.findFirst({
      where: {
        symbol: 'AIA/USDT',
        status: 'OPEN'
      }
    });

    if (!aiaPosition) {
      console.log('❌ AIA position not found!');
      await prisma.$disconnect();
      return;
    }

    console.log('📍 Current AIA Position:');
    console.log(`   ID: ${aiaPosition.id}`);
    console.log(`   Entry (estimated): $${parseFloat(aiaPosition.entryPrice).toFixed(4)}`);
    console.log(`   Current: $${parseFloat(aiaPosition.currentPrice).toFixed(4)}`);

    // 2. Get real current price from MEXC
    const apiKey = await prisma.apiKey.findFirst({
      where: { exchange: 'mexc', isActive: true }
    });

    if (!apiKey) {
      console.log('❌ MEXC API key not found!');
      await prisma.$disconnect();
      return;
    }

    const exchange = new ccxt.mexc({
      apiKey: decrypt(apiKey.apiKey),
      secret: decrypt(apiKey.apiSecret),
      enableRateLimit: true,
      options: { defaultType: 'spot' }
    });

    await exchange.loadMarkets();

    const balance = await exchange.fetchBalance();
    const aiaBalance = balance.total.AIA || 0;

    if (aiaBalance === 0) {
      console.log('\n⚠️  No AIA balance on MEXC - position already closed?');
      await prisma.position.update({
        where: { id: aiaPosition.id },
        data: { status: 'CLOSED', closeReason: 'No balance on exchange' }
      });
      await prisma.$disconnect();
      return;
    }

    const ticker = await exchange.fetchTicker('AIA/USDT');
    const currentPrice = ticker.last;

    console.log(`\n💹 Real-time MEXC Data:`);
    console.log(`   Balance: ${aiaBalance} AIA`);
    console.log(`   Current Price: $${currentPrice.toFixed(4)}`);
    console.log(`   Value: $${(aiaBalance * currentPrice).toFixed(2)} USDT`);

    // 3. Calculate real entry price from user's loss (-20.28%)
    const realEntry = currentPrice / 0.7972; // Loss of 20.28%
    console.log(`\n📊 Calculated Real Entry Price:`);
    console.log(`   Entry: $${realEntry.toFixed(4)} (from -20.28% loss)`);
    console.log(`   Current: $${currentPrice.toFixed(4)}`);
    console.log(`   Loss: -${((1 - currentPrice/realEntry) * 100).toFixed(2)}%`);

    // 4. Update position with correct entry price
    await prisma.position.update({
      where: { id: aiaPosition.id },
      data: {
        entryPrice: realEntry,
        currentPrice: currentPrice
      }
    });

    console.log(`\n✅ Updated position with correct entry price`);

    // 5. Close position on MEXC
    console.log(`\n🔴 CLOSING AIA POSITION ON MEXC...`);

    try {
      const order = await exchange.createMarketSellOrder('AIA/USDT', aiaBalance);

      const filledPrice = order.average || order.price || currentPrice;
      const filledAmount = order.filled || aiaBalance;
      const usdtReceived = filledPrice * filledAmount;

      const realizedPnL = (filledPrice - realEntry) * filledAmount;

      console.log(`\n✅ POSITION CLOSED ON MEXC:`);
      console.log(`   Order ID: ${order.id}`);
      console.log(`   Sold: ${filledAmount.toFixed(4)} AIA @ $${filledPrice.toFixed(4)}`);
      console.log(`   Received: $${usdtReceived.toFixed(2)} USDT`);
      console.log(`   Realized PnL: $${realizedPnL.toFixed(2)} (${((realizedPnL / (realEntry * filledAmount)) * 100).toFixed(2)}%)`);

      // 6. Update database
      await prisma.position.update({
        where: { id: aiaPosition.id },
        data: {
          status: 'CLOSED',
          exitPrice: filledPrice,
          realizedPnL: realizedPnL,
          closedAt: new Date(),
          closeReason: `Manual close - Order: ${order.id}`
        }
      });

      console.log(`\n✅ Database updated - Position CLOSED`);

    } catch (orderError) {
      console.error(`\n❌ Failed to close on MEXC: ${orderError.message}`);
      console.log(`⚠️  Position remains OPEN - please close manually on MEXC`);
    }

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
