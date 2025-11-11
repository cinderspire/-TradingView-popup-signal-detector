const ccxt = require('ccxt');
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./src/utils/encryption');

const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🚀 Closing remaining MX position...\n');

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
    const mxAmount = balance.total.MX || 0;

    if (mxAmount === 0 || mxAmount < 0.000001) {
      console.log('✅ No MX balance to close!');
      await prisma.$disconnect();
      return;
    }

    const ticker = await exchange.fetchTicker('MX/USDT');
    const currentPrice = ticker.last;
    const valueUSDT = mxAmount * currentPrice;

    console.log(`📊 MX Position: ${mxAmount.toFixed(8)} @ $${currentPrice.toFixed(6)} = $${valueUSDT.toFixed(2)} USDT\n`);

    console.log('📤 Selling MX...');

    const order = await exchange.createMarketSellOrder('MX/USDT', mxAmount);

    const filledPrice = order.average || order.price || currentPrice;
    const filledAmount = order.filled || mxAmount;
    const usdtReceived = filledPrice * filledAmount;

    console.log(`✅ MX sold: ${filledAmount.toFixed(8)} @ $${filledPrice.toFixed(6)} = $${usdtReceived.toFixed(2)} USDT`);
    console.log(`📋 Order ID: ${order.id}\n`);

    // Get final balance
    await new Promise(resolve => setTimeout(resolve, 2000));
    const finalBalance = await exchange.fetchBalance();
    const finalUSDT = finalBalance.total.USDT || 0;

    console.log('='.repeat(60));
    console.log(`💵 Final USDT balance: $${finalUSDT.toFixed(2)} USDT`);
    console.log('='.repeat(60) + '\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
