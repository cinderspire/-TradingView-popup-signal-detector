#!/usr/bin/env node
/**
 * Manual Position Closer
 * Closes all open positions for a specific user
 */

const { PrismaClient } = require('@prisma/client');
const ccxt = require('ccxt');
const { decrypt } = require('../src/utils/encryption');

const prisma = new PrismaClient();

// Positions to close (from user's list)
const POSITIONS_TO_CLOSE = [
  { symbol: 'BGB/USDT', amount: null },  // Will fetch from exchange
  { symbol: 'SPX/USDT', amount: null },
  { symbol: 'TRX/USDT', amount: null },
  { symbol: 'CRV/USDT', amount: null },
  { symbol: 'JUP/USDT', amount: null },
  { symbol: 'SYN/USDT', amount: null },
  { symbol: 'RED/USDT', amount: null },
  { symbol: 'GRT/USDT', amount: null },
  { symbol: 'CAKE/USDT', amount: null },
  { symbol: 'MAV/USDT', amount: null },
  { symbol: 'XDC/USDT', amount: null },
  { symbol: 'TRUMP/USDT', amount: null },
  { symbol: 'ID/USDT', amount: null },
  { symbol: 'MOODENG/USDT', amount: null },
  { symbol: 'PYTH/USDT', amount: null },
  { symbol: 'XRP/USDT', amount: null },
  { symbol: 'CHR/USDT', amount: null }
];

async function closeAllPositions() {
  try {
    console.log('🔍 Finding user subscription...');

    // Find ANY subscription with API keys (including cancelled ones)
    const subscription = await prisma.subscription.findFirst({
      where: {
        exchangeApiKey: { not: null },
        exchangeApiSecret: { not: null }
      },
      include: {
        user: {
          select: { id: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }  // Get most recent
    });

    if (!subscription) {
      console.error('❌ No subscription with API keys found');
      process.exit(1);
    }

    console.log(`✅ Found subscription for user: ${subscription.user.email}`);
    console.log(`   Exchange: ${subscription.activeExchange || 'binance'}`);
    console.log(`   Order Type: ${subscription.orderType || 'FUTURES'}`);

    // Decrypt API keys
    const apiKey = decrypt(subscription.exchangeApiKey);
    const apiSecret = decrypt(subscription.exchangeApiSecret);

    // Initialize exchange
    const exchangeName = subscription.activeExchange || 'binance';
    const ExchangeClass = ccxt[exchangeName];

    if (!ExchangeClass) {
      console.error(`❌ Exchange ${exchangeName} not supported`);
      process.exit(1);
    }

    const exchange = new ExchangeClass({
      apiKey: apiKey,
      secret: apiSecret,
      enableRateLimit: true,
      options: {
        defaultType: subscription.orderType === 'SPOT' ? 'spot' : 'future'
      }
    });

    await exchange.loadMarkets();
    console.log('✅ Exchange connected and markets loaded');

    // Fetch current positions
    console.log('\n🔍 Fetching current positions from exchange...');
    let positions = [];

    try {
      if (subscription.orderType === 'FUTURES' || subscription.orderType === 'SPOT') {
        positions = await exchange.fetchPositions();
        console.log(`✅ Found ${positions.length} positions`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not fetch positions: ${error.message}`);
    }

    // Close each position
    console.log('\n🔄 Closing positions...\n');
    let successCount = 0;
    let failCount = 0;

    for (const pos of POSITIONS_TO_CLOSE) {
      try {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🎯 Processing: ${pos.symbol}`);

        // Check if position exists on exchange
        const exchangePosition = positions.find(p =>
          p.symbol === pos.symbol && parseFloat(p.contracts || 0) > 0
        );

        if (exchangePosition) {
          console.log(`   Found on exchange: ${exchangePosition.contracts} contracts`);
          pos.amount = Math.abs(parseFloat(exchangePosition.contracts));
        }

        // Try to close via market order
        let closeOrder;

        if (subscription.orderType === 'SPOT') {
          // SPOT: Need to know balance
          console.log(`   SPOT mode - fetching balance...`);
          const balance = await exchange.fetchBalance();
          const base = pos.symbol.split('/')[0]; // e.g., BGB from BGB/USDT
          const available = balance.free[base] || 0;

          if (available > 0) {
            console.log(`   Available: ${available} ${base}`);
            closeOrder = await exchange.createMarketSellOrder(pos.symbol, available);
            console.log(`   ✅ Sold ${available} ${base}`);
          } else {
            console.log(`   ⚠️  No ${base} balance to sell`);
            continue;
          }
        } else {
          // FUTURES: Close position with reduceOnly
          if (!pos.amount && !exchangePosition) {
            console.log(`   ⚠️  No position found on exchange`);
            failCount++;
            continue;
          }

          const amount = pos.amount || Math.abs(parseFloat(exchangePosition.contracts));
          console.log(`   Closing ${amount} contracts...`);

          closeOrder = await exchange.createOrder(
            pos.symbol,
            'market',
            'sell',
            amount,
            undefined,
            { reduceOnly: true }
          );

          console.log(`   ✅ Position closed - Order ID: ${closeOrder.id}`);
        }

        successCount++;

        // Wait a bit to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`   ❌ Failed to close ${pos.symbol}: ${error.message}`);
        failCount++;
      }
    }

    await exchange.close();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 SUMMARY');
    console.log(`   ✅ Successfully closed: ${successCount}`);
    console.log(`   ❌ Failed to close: ${failCount}`);
    console.log(`   📝 Total processed: ${POSITIONS_TO_CLOSE.length}`);
    console.log('');

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run
closeAllPositions();
