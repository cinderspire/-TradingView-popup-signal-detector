#!/usr/bin/env node

/**
 * Create ETH/USDT Test Signal for MEXC
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestSignal() {
  try {
    console.log('🔥 Creating ETH/USDT Test Signal for MEXC');
    console.log('========================================\n');

    // Get the 3RSI strategy
    const strategy = await prisma.strategy.findFirst({
      where: {
        name: {
          contains: '3RSI'
        }
      }
    });

    if (!strategy) {
      console.error('❌ 3RSI strategy not found');
      process.exit(1);
    }

    const testSignal = {
      id: `test-${Date.now()}-mexc-eth`,
      strategyId: strategy.id,
      symbol: 'ETH/USDT',
      type: 'ENTRY',
      direction: 'LONG',
      entryPrice: 3000,  // Example ETH price
      stopLoss: 2900,
      takeProfit: 3200,
      source: 'manual-test',
      status: 'ACTIVE'
    };

    const signal = await prisma.signal.create({
      data: testSignal
    });

    console.log('✅ Test signal created:');
    console.log(`   ID: ${signal.id}`);
    console.log(`   Symbol: ${signal.symbol}`);
    console.log(`   Direction: ${signal.direction}`);
    console.log(`   Entry: ${signal.entryPrice}`);
    console.log(`   Strategy: ${strategy.name}`);
    console.log('');

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createTestSignal();
