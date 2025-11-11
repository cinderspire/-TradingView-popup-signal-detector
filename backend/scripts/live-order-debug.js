#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function liveTest() {
  console.log('═══════════════════════════════════════');
  console.log('🔴 LIVE ORDER DEBUG - WHY NO ORDERS?');
  console.log('═══════════════════════════════════════\n');

  // Son 10 signal
  const signals = await prisma.signal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('📡 LAST 10 SIGNALS:\n');
  signals.forEach((s, i) => {
    const time = new Date(s.createdAt).toLocaleString('tr-TR');
    console.log(`${i + 1}. ${time}`);
    console.log(`   Symbol: ${s.symbol}`);
    console.log(`   Strategy: ${s.strategy || 'NULL ❌'}`);
    console.log(`   Direction: ${s.direction}`);
    console.log('');
  });

  // Subscriptions
  const user = await prisma.user.findFirst({ where: { username: 'suyttru' } });
  const subs = await prisma.subscription.findMany({
    where: { userId: user.id, status: 'ACTIVE' },
    include: { strategy: true }
  });

  console.log('\n📋 SUBSCRIPTIONS:\n');
  subs.forEach(s => {
    console.log(`Strategy: ${s.strategy.name}`);
    console.log(`Pairs (${s.subscribedPairs.length}): ${s.subscribedPairs.slice(0, 5).join(', ')}...`);
    console.log('');
  });

  // Manual matching test
  console.log('\n🔍 MANUAL MATCHING TEST:\n');

  for (const signal of signals.slice(0, 5)) {
    console.log(`Testing: ${signal.symbol} (${signal.strategy || 'NO STRATEGY'})`);

    if (!signal.strategy) {
      console.log(`  ❌ SKIP: No strategy field!\n`);
      continue;
    }

    // Normalize
    let normalized = signal.strategy;
    if (signal.strategy.startsWith('P')) {
      normalized = signal.strategy.substring(1);
    }
    console.log(`  Normalized: ${signal.strategy} → ${normalized}`);

    // Find matching sub
    const matchingSub = subs.find(s => s.strategy.name === normalized);
    if (!matchingSub) {
      console.log(`  ❌ NO SUB: Strategy ${normalized} not found\n`);
      continue;
    }

    console.log(`  ✅ Strategy matched: ${normalized}`);

    // Check if pair in list
    const pairMatch = matchingSub.subscribedPairs.includes(signal.symbol);
    if (pairMatch) {
      console.log(`  ✅ PAIR MATCHED: ${signal.symbol} IS IN LIST!`);
      console.log(`  🎯 THIS SHOULD HAVE EXECUTED!\n`);
    } else {
      console.log(`  ❌ Pair not in list: ${signal.symbol}\n`);
    }
  }

  // Check backend logs
  console.log('\n═══════════════════════════════════════');
  console.log('📊 BACKEND PROCESS CHECK:');
  console.log('═══════════════════════════════════════\n');
  console.log('Run: pm2 logs automatedtradebot-api --lines 100 | grep -E "matching|subscription|execute|order"');
  console.log('\nLook for these messages:');
  console.log('  ✅ "Found X matching subscription(s)"');
  console.log('  ❌ "No matching subscriptions found"');
  console.log('  ✅ "Executing order for..."');
  console.log('  ❌ Any errors\n');

  await prisma.$disconnect();
}

liveTest().catch(console.error);
