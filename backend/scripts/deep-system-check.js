#!/usr/bin/env node
/**
 * DEEP SYSTEM CHECK - Comprehensive diagnostic
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deepCheck() {
  console.log('═══════════════════════════════════════');
  console.log('🔍 DEEP SYSTEM CHECK');
  console.log('═══════════════════════════════════════\n');

  // 1. User check
  const user = await prisma.user.findFirst({
    where: { username: 'suyttru' }
  });
  console.log('1️⃣  USER:');
  console.log(`   ✅ Username: ${user.username}`);
  console.log(`   ✅ Email: ${user.email}`);
  console.log(`   ✅ ID: ${user.id}\n`);

  // 2. API Key check
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      userId: user.id,
      exchange: 'mexc',
      isActive: true
    }
  });
  console.log('2️⃣  API KEYS:');
  apiKeys.forEach(k => {
    console.log(`   ✅ Exchange: ${k.exchange}`);
    console.log(`   ✅ Has apiKey: ${k.apiKey ? 'YES' : 'NO'}`);
    console.log(`   ✅ Has apiSecret: ${k.apiSecret ? 'YES' : 'NO'}`);
    console.log(`   ✅ Active: ${k.isActive}`);
    console.log(`   ✅ Permissions: ${k.permissions.join(', ')}\n`);
  });

  // 3. Subscriptions check
  const subs = await prisma.subscription.findMany({
    where: {
      userId: user.id,
      status: 'ACTIVE'
    },
    include: {
      strategy: true
    }
  });

  console.log('3️⃣  SUBSCRIPTIONS:');
  subs.forEach(s => {
    console.log(`   Strategy: ${s.strategy.name}`);
    console.log(`   ├─ Status: ${s.status}`);
    console.log(`   ├─ Exchange: ${s.activeExchange}`);
    console.log(`   ├─ Order Type: ${s.orderType}`);
    console.log(`   ├─ Pairs: ${s.subscribedPairs.length}`);
    console.log(`   ├─ Sample pairs: ${s.subscribedPairs.slice(0, 3).join(', ')}`);
    console.log(`   ├─ AI: ${s.useAIRiskControl ? '✅' : '❌'}`);
    console.log(`   └─ Adaptive TP/SL: ${s.useAdaptiveTPSL ? '✅' : '❌'}\n`);
  });

  // 4. Recent signals check
  const recentSignals = await prisma.signal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('4️⃣  RECENT SIGNALS (last 10):');
  recentSignals.forEach(s => {
    const time = new Date(s.createdAt).toLocaleString('tr-TR');
    const strategy = s.strategy || 'N/A';
    console.log(`   ${time} | ${strategy.padEnd(10)} | ${s.symbol.padEnd(20)} | ${s.direction}`);
  });

  // 5. Check if signals match our pairs
  console.log('\n5️⃣  SIGNAL MATCHING TEST:\n');

  let matchCount = 0;
  let noMatchCount = 0;

  for (const testSignal of recentSignals.slice(0, 10)) {
    // Normalize strategy
    let normalized = testSignal.strategy;
    if (testSignal.strategy && testSignal.strategy.startsWith('P')) {
      normalized = testSignal.strategy.substring(1);
    }

    // Check if in any subscription
    const matchingSub = subs.find(s =>
      s.strategy.name === normalized &&
      s.subscribedPairs.includes(testSignal.symbol)
    );

    if (matchingSub) {
      matchCount++;
      console.log(`   ✅ ${testSignal.symbol.padEnd(20)} | ${testSignal.strategy} → ${normalized} | MATCHED`);
    } else {
      noMatchCount++;
      console.log(`   ❌ ${testSignal.symbol.padEnd(20)} | ${testSignal.strategy} → ${normalized} | NOT IN PAIRS`);
    }
  }

  console.log(`\n   Summary: ${matchCount} matched, ${noMatchCount} not matched\n`);

  // 6. Backend service check
  console.log('6️⃣  BACKEND SERVICES:');
  console.log('   Run: pm2 status');
  console.log('   Check: automatedtradebot-api should be online\n');

  // 7. Subscription Executor check
  console.log('7️⃣  CRITICAL SETTINGS:');
  console.log('   All subscriptions MUST have:');
  console.log(`   ├─ Status: ACTIVE ${subs.every(s => s.status === 'ACTIVE') ? '✅' : '❌'}`);
  console.log(`   ├─ Exchange: mexc ${subs.every(s => s.activeExchange === 'mexc') ? '✅' : '❌'}`);
  console.log(`   ├─ Order Type: SPOT ${subs.every(s => s.orderType === 'SPOT') ? '✅' : '❌'}`);
  console.log(`   └─ Pairs > 0 ${subs.every(s => s.subscribedPairs.length > 0) ? '✅' : '❌'}\n`);

  console.log('═══════════════════════════════════════');
  console.log('NEXT STEPS:');
  console.log('═══════════════════════════════════════');
  console.log('1. pm2 restart automatedtradebot-api');
  console.log('2. pm2 logs automatedtradebot-api --lines 50');
  console.log('3. Look for: "Found X matching subscription(s)"');
  console.log('4. Wait for next signal...\n');

  await prisma.$disconnect();
}

deepCheck().catch(console.error);
