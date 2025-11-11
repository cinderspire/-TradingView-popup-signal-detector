#!/usr/bin/env node

/**
 * Manual Test Execution Trigger
 * Triggers SubscriptionExecutor to process a test signal
 */

const { getInstance } = require('../src/services/subscription-executor');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function triggerTestExecution() {
  try {
    console.log('🔥 Manual Test Execution Trigger');
    console.log('================================\n');

    // Get the test signal
    const signal = await prisma.signal.findFirst({
      where: {
        id: {
          startsWith: 'test-'
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!signal) {
      console.error('❌ No test signal found');
      process.exit(1);
    }

    console.log('✅ Found test signal:');
    console.log(`   ID: ${signal.id}`);
    console.log(`   Symbol: ${signal.symbol}`);
    console.log(`   Direction: ${signal.direction}`);
    console.log(`   Entry: ${signal.entryPrice}`);
    console.log('');

    // Get strategy for the signal
    const strategy = await prisma.strategy.findUnique({
      where: { id: signal.strategyId },
      select: { name: true }
    });

    // Format signal for executor (match service format)
    const formattedSignal = {
      id: signal.id,
      pair: signal.symbol,
      symbol: signal.symbol,
      direction: signal.direction,
      entry: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      strategy: strategy?.name || 'TEST',
      strategyId: signal.strategyId,
      source: signal.source,
      timestamp: signal.createdAt.getTime()
    };

    console.log('🎯 Triggering SubscriptionExecutor...\n');

    // Get executor instance
    const executor = getInstance();

    // Manually trigger processing
    await executor.processSignal(formattedSignal);

    console.log('\n✅ Execution triggered!');
    console.log('📊 Check execution logs with:');
    console.log('   pm2 logs automatedtradebot-api | grep "SUBSCRIPTION EXECUTOR"');
    console.log('');
    console.log('📊 Check database with:');
    console.log('   psql -d automatedtradebot -c "SELECT * FROM \\"ExecutionLog\\" ORDER BY \\"executedAt\\" DESC LIMIT 5;"');

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

triggerTestExecution();
