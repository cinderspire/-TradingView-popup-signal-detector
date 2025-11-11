#!/usr/bin/env node
/**
 * SIMPLE MEXC SPOT TEST ORDER
 * Places a small test order and closes it after 2 seconds
 */

const { PrismaClient } = require('@prisma/client');
const ccxt = require('ccxt');
const prisma = new PrismaClient();

async function sendTestOrder() {
  let exchange = null;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 MEXC SPOT TEST ORDER');
    console.log('='.repeat(80) + '\n');

    // Find user and API key
    const user = await prisma.user.findFirst({
      where: { username: 'suyttru' }
    });

    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    console.log(`✅ User: ${user.username}\n`);

    const apiKey = await prisma.apiKey.findFirst({
      where: {
        userId: user.id,
        exchange: 'mexc',
        isActive: true
      }
    });

    if (!apiKey) {
      console.error('❌ MEXC API key not found');
      console.log('\n💡 Add MEXC API key with:');
      console.log('   cd /home/automatedtradebot/backend');
      console.log('   npm run cli -- api-keys add\n');
      process.exit(1);
    }

    console.log('✅ MEXC API key found\n');

    // Initialize MEXC exchange for SPOT trading
    exchange = new ccxt.mexc({
      apiKey: apiKey.key,
      secret: apiKey.secret,
      enableRateLimit: true,
      options: {
        defaultType: 'spot' // SPOT trading
      }
    });

    await exchange.loadMarkets();
    console.log('✅ MEXC exchange connected (SPOT mode)\n');

    // Check balance
    const balance = await exchange.fetchBalance();
    const usdtBalance = balance.free['USDT'] || 0;
    console.log(`💰 USDT Balance: ${usdtBalance.toFixed(2)}\n`);

    if (usdtBalance < 2) {
      console.log('⚠️  Insufficient balance for test order (need $2 USDT)');
      process.exit(1);
    }

    // Use one of the top 15 pairs - ALCHUSDT (top performer)
    const testSymbol = 'ALCH/USDT'; // SPOT format
    const orderSize = 2; // $2 USDT

    console.log('━'.repeat(80));
    console.log('📊 TEST ORDER DETAILS');
    console.log('━'.repeat(80));
    console.log(`Symbol: ${testSymbol}`);
    console.log(`Type: SPOT MARKET`);
    console.log(`Size: $${orderSize} USDT`);
    console.log(`Direction: BUY\n`);

    // Get current price
    const ticker = await exchange.fetchTicker(testSymbol);
    const currentPrice = ticker.last;
    const amount = orderSize / currentPrice;

    console.log(`Current Price: $${currentPrice.toFixed(4)}`);
    console.log(`Amount: ${amount.toFixed(6)} ALCH\n`);

    // Place market buy order
    console.log('🚀 Placing SPOT market BUY order...\n');

    const order = await exchange.createMarketBuyOrder(testSymbol, amount);

    console.log('✅ ORDER PLACED!\n');
    console.log('Order ID:', order.id);
    console.log('Status:', order.status);
    console.log('Filled:', order.filled);
    console.log('Average Price:', order.average || 'N/A');

    // Wait 2 seconds
    console.log('\n⏳ Waiting 2 seconds before closing...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check filled amount and sell it back
    const filledAmount = order.filled || amount;

    console.log('🔄 Closing position (selling back)...\n');

    const closeOrder = await exchange.createMarketSellOrder(testSymbol, filledAmount);

    console.log('✅ POSITION CLOSED!\n');
    console.log('Close Order ID:', closeOrder.id);
    console.log('Status:', closeOrder.status);

    console.log('\n' + '━'.repeat(80));
    console.log('🎉 TEST COMPLETED SUCCESSFULLY!');
    console.log('━'.repeat(80));
    console.log('\n✅ System is working correctly:');
    console.log('   • MEXC SPOT connection ✓');
    console.log('   • Market order execution ✓');
    console.log('   • Position opening ✓');
    console.log('   • Position closing ✓\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('API Response:', JSON.stringify(error.response, null, 2));
    }
    console.error('\nStack:', error.stack);
  } finally {
    if (exchange) {
      await exchange.close();
    }
    await prisma.$disconnect();
  }
}

sendTestOrder();
