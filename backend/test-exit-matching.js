const { PrismaClient } = require('@prisma/client');
const SmartSignalMatcherModule = require('./src/services/smart-signal-matcher');
const SmartSignalMatcher = SmartSignalMatcherModule.instance;

const prisma = new PrismaClient();

async function testExitMatching() {
  console.log('🧪 Testing EXIT signal matching after fix...\n');

  // Test case: 3RSI + ARUSDT.P (66 open positions, 5 EXIT signals)
  const testStrategy = '3RSI';
  const testSymbol = 'ARUSDT.P';

  // Find one EXIT signal for this pair
  const exitSignal = await prisma.signal.findFirst({
    where: {
      rawText: { contains: testStrategy },
      symbol: testSymbol,
      OR: [
        { type: 'EXIT' },
        { rawText: { contains: 'flat' } }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!exitSignal) {
    console.log(`❌ No EXIT signal found for ${testStrategy} + ${testSymbol}`);
    await prisma.$disconnect();
    return;
  }

  console.log(`Found EXIT signal:`);
  console.log(`  ID: ${exitSignal.id}`);
  console.log(`  Type: ${exitSignal.type}`);
  console.log(`  Symbol: ${exitSignal.symbol}`);
  console.log(`  Created: ${exitSignal.createdAt.toISOString()}`);
  console.log(`  RawText preview: ${exitSignal.rawText.substring(0, 100)}...\n`);

  // Count open positions BEFORE
  const openBefore = await prisma.signal.count({
    where: {
      rawText: { startsWith: testStrategy },
      symbol: testSymbol,
      type: 'ENTRY',
      status: { in: ['ACTIVE', 'PENDING'] }
    }
  });

  console.log(`📊 Open positions BEFORE: ${openBefore}\n`);

  // Test the processNewSignal method
  console.log(`🔧 Running SmartSignalMatcher.processNewSignal()...\n`);

  const result = await SmartSignalMatcher.processNewSignal(exitSignal);

  // Count open positions AFTER
  const openAfter = await prisma.signal.count({
    where: {
      rawText: { startsWith: testStrategy },
      symbol: testSymbol,
      type: 'ENTRY',
      status: { in: ['ACTIVE', 'PENDING'] }
    }
  });

  console.log(`\n📊 Open positions AFTER: ${openAfter}`);
  console.log(`📉 Positions closed: ${openBefore - openAfter}\n`);

  if (result) {
    console.log(`✅ Matching result:`, result);
  } else {
    console.log(`❌ No match found (this is the bug!)`);
  }

  await prisma.$disconnect();
}

testExitMatching().catch(console.error);
