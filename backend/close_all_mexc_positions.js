const ccxt = require('ccxt');
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./src/utils/encryption');

const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🚀 Starting MEXC Position Closer...\n');

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

    console.log('💰 Initial USDT Balance:', balance.total.USDT || 0, 'USDT\n');

    // Find all non-zero, non-USDT balances
    const positions = [];
    for (const [coin, amount] of Object.entries(balance.total)) {
      if (coin === 'USDT' || amount === 0 || amount < 0.000001) {
        continue;
      }

      const pair = coin + '/USDT';

      // Check if market exists
      if (!exchange.markets[pair]) {
        console.log(`⚠️ ${pair} market not found on MEXC, skipping`);
        continue;
      }

      // Get current price
      let ticker;
      try {
        ticker = await exchange.fetchTicker(pair);
      } catch (e) {
        console.log(`❌ ${pair} ticker error: ${e.message}`);
        continue;
      }

      const currentPrice = ticker.last;
      const valueUSDT = amount * currentPrice;

      // Only close if value > $1 to avoid dust
      if (valueUSDT < 1) {
        console.log(`⏭️ ${coin} value too small ($${valueUSDT.toFixed(2)}), skipping`);
        continue;
      }

      positions.push({
        coin,
        pair,
        amount,
        currentPrice,
        valueUSDT
      });
    }

    if (positions.length === 0) {
      console.log('✅ No positions to close!');
      await prisma.$disconnect();
      return;
    }

    console.log(`📊 Found ${positions.length} positions to close:\n`);
    positions.forEach(pos => {
      console.log(`  ${pos.coin}: ${pos.amount.toFixed(6)} @ $${pos.currentPrice.toFixed(6)} = $${pos.valueUSDT.toFixed(2)}`);
    });

    console.log('\n🔄 Starting position closure...\n');

    let totalRecovered = 0;
    let successCount = 0;
    let failCount = 0;

    for (const pos of positions) {
      try {
        console.log(`📤 Selling ${pos.amount.toFixed(6)} ${pos.coin}...`);

        // Create market sell order
        const order = await exchange.createMarketSellOrder(
          pos.pair,
          pos.amount
        );

        const filledPrice = order.average || order.price || pos.currentPrice;
        const filledAmount = order.filled || pos.amount;
        const usdtReceived = filledPrice * filledAmount;

        totalRecovered += usdtReceived;
        successCount++;

        console.log(`  ✅ ${pos.coin} sold: ${filledAmount.toFixed(6)} @ $${filledPrice.toFixed(6)} = $${usdtReceived.toFixed(2)} USDT`);
        console.log(`  📋 Order ID: ${order.id}\n`);

        // Update position status in database if it exists
        try {
          await prisma.position.updateMany({
            where: {
              userId: apiKeyRecord.userId,
              symbol: pos.pair,
              status: 'OPEN'
            },
            data: {
              status: 'CLOSED',
              exitPrice: filledPrice,
              pnl: 0, // Can't calculate without knowing entry price
              notes: `Manually closed via close_all_mexc_positions.js - Order: ${order.id}`
            }
          });
        } catch (dbError) {
          console.log(`  ⚠️ DB update failed for ${pos.coin}: ${dbError.message}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        failCount++;
        console.error(`  ❌ Failed to sell ${pos.coin}: ${error.message}\n`);
      }
    }

    // Get final balance
    await new Promise(resolve => setTimeout(resolve, 2000));
    const finalBalance = await exchange.fetchBalance();
    const finalUSDT = finalBalance.total.USDT || 0;

    console.log('\n' + '='.repeat(60));
    console.log('📊 CLOSURE SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully closed: ${successCount} positions`);
    console.log(`❌ Failed to close: ${failCount} positions`);
    console.log(`💰 Total USDT recovered: $${totalRecovered.toFixed(2)}`);
    console.log(`💵 Final USDT balance: $${finalUSDT.toFixed(2)}`);
    console.log('='.repeat(60) + '\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Critical Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
