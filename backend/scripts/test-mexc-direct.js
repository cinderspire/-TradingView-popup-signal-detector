#!/usr/bin/env node

/**
 * Test MEXC API directly with user's keys
 */

const ccxt = require('ccxt');
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('../src/utils/encryption');

const prisma = new PrismaClient();

async function testMexcDirect() {
  try {
    console.log('🔍 Testing MEXC API with user keys...\n');

    // Get user subscription with API keys
    const subscription = await prisma.subscription.findFirst({
      where: {
        user: { email: 'suyttru@gmail.com' },
        activeExchange: 'mexc',
        status: 'ACTIVE'
      }
    });

    if (!subscription || !subscription.exchangeApiKey) {
      console.error('❌ No MEXC API keys found');
      process.exit(1);
    }

    const apiKey = decrypt(subscription.exchangeApiKey);
    const apiSecret = decrypt(subscription.exchangeApiSecret);

    console.log('✅ API keys loaded');
    console.log('   Key:', apiKey.substring(0, 10) + '...');
    console.log('');

    // Test with SPOT market
    const exchange = new ccxt.mexc({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'spot'
      }
    });

    await exchange.loadMarkets();
    console.log('✅ Markets loaded');

    // Check balance
    console.log('\n📊 Fetching balance...');
    const balance = await exchange.fetchBalance();
    console.log('USDT Balance:', balance.free['USDT'] || 0, 'USDT');
    console.log('');

    // Try to get account info
    console.log('📊 Account info:');
    console.log('   Permissions:', balance.info?.permissions || 'N/A');
    console.log('');

    // Check if ETH/USDT is active for this account
    if (exchange.markets['ETH/USDT']) {
      console.log('✅ ETH/USDT market info:');
      console.log('   Active:', exchange.markets['ETH/USDT'].active);
      console.log('   Spot:', exchange.markets['ETH/USDT'].spot);
      console.log('   isSpotTradingAllowed:', exchange.markets['ETH/USDT'].info.isSpotTradingAllowed);
    }

    await exchange.close();
    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response);
    }
    await prisma.$disconnect();
    process.exit(1);
  }
}

testMexcDirect();
