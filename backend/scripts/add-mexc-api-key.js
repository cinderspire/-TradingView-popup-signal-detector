#!/usr/bin/env node
/**
 * ADD MEXC API KEY FOR SUYTTRU
 *
 * Interactive script to add MEXC API credentials
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function addMEXCAPIKey() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔑 ADD MEXC API KEY FOR SUYTTRU');
    console.log('='.repeat(80) + '\n');

    // Find user
    const user = await prisma.user.findFirst({
      where: { username: 'suyttru' }
    });

    if (!user) {
      console.error('❌ User suyttru not found');
      process.exit(1);
    }

    console.log(`✅ User found: ${user.username} (${user.email})\n`);

    // Check existing keys
    const existingKeys = await prisma.apiKey.findMany({
      where: {
        userId: user.id,
        exchange: 'mexc'
      }
    });

    if (existingKeys.length > 0) {
      console.log('⚠️  Existing MEXC API keys found:');
      existingKeys.forEach((key, idx) => {
        console.log(`   ${idx + 1}. ID: ${key.id} (Active: ${key.isActive})`);
      });
      console.log('');

      const deleteExisting = await question('Delete existing keys? (y/n): ');

      if (deleteExisting.toLowerCase() === 'y') {
        await prisma.apiKey.deleteMany({
          where: {
            userId: user.id,
            exchange: 'mexc'
          }
        });
        console.log('✅ Existing keys deleted\n');
      }
    }

    // Get API credentials
    console.log('━'.repeat(80));
    console.log('📝 ENTER MEXC API CREDENTIALS');
    console.log('━'.repeat(80));
    console.log('\n💡 Get your API keys from: https://www.mexc.com/user/openapi');
    console.log('   Make sure to enable SPOT trading permissions!\n');

    const apiKey = await question('MEXC API Key: ');
    const secret = await question('MEXC API Secret: ');

    if (!apiKey || !secret) {
      console.error('\n❌ API Key and Secret are required!');
      process.exit(1);
    }

    // Create new API key
    console.log('\n🔧 Saving API credentials...\n');

    const newKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        exchange: 'mexc',
        key: apiKey,
        secret: secret,
        isActive: true
      }
    });

    console.log('✅ MEXC API key saved successfully!\n');
    console.log(`   ID: ${newKey.id}`);
    console.log(`   Exchange: ${newKey.exchange}`);
    console.log(`   Active: ${newKey.isActive}\n`);

    // Test connection
    console.log('━'.repeat(80));
    console.log('🧪 TESTING CONNECTION');
    console.log('━'.repeat(80) + '\n');

    const ccxt = require('ccxt');

    const exchange = new ccxt.mexc({
      apiKey: apiKey,
      secret: secret,
      enableRateLimit: true,
      options: {
        defaultType: 'spot'
      }
    });

    try {
      await exchange.loadMarkets();
      console.log('✅ Successfully connected to MEXC!\n');

      const balance = await exchange.fetchBalance();
      const usdtBalance = balance.free['USDT'] || 0;
      console.log(`💰 USDT Balance: $${usdtBalance.toFixed(2)}\n`);

      if (usdtBalance < 10) {
        console.log('⚠️  Note: Balance is low. Need at least $10 USDT for testing\n');
      }

      await exchange.close();

      console.log('━'.repeat(80));
      console.log('🎉 SETUP COMPLETE!');
      console.log('━'.repeat(80));
      console.log('\n✅ MEXC API key is configured and working');
      console.log('✅ You can now run test orders\n');
      console.log('💡 Next steps:');
      console.log('   1. Restart service: pm2 restart automatedtradebot-api');
      console.log('   2. Run test: node scripts/full-system-test.js\n');

    } catch (error) {
      console.error('\n❌ Connection test failed:', error.message);
      console.log('\n⚠️  API key saved but connection test failed');
      console.log('   Please verify:');
      console.log('   - API key and secret are correct');
      console.log('   - SPOT trading is enabled');
      console.log('   - IP whitelist includes your server (if configured)\n');
      await exchange.close();
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

addMEXCAPIKey();
