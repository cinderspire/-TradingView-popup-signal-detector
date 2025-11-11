const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * FAST VERSION: Mark EXIT signals as EXECUTED if they were already used
 * Uses batch processing and in-memory lookup for speed
 */

async function markUsedExitSignalsFast() {
  console.log('⚡ FAST EXIT Signal Marking');
  console.log('='.repeat(80));
  console.log('Loading data into memory for fast processing...\n');

  // Step 1: Load ALL closed ENTRYs into memory
  console.log('📥 Loading closed ENTRYs...');
  const closedEntries = await prisma.signal.findMany({
    where: {
      type: 'ENTRY',
      status: 'CLOSED',
      source: 'tradingview',
      closedAt: { not: null },
      exitPrice: { not: null }
    },
    select: {
      id: true,
      symbol: true,
      rawText: true,
      direction: true,
      exitPrice: true,
      closedAt: true
    }
  });

  console.log(`✅ Loaded ${closedEntries.length} closed ENTRYs\n`);

  // Step 2: Create lookup map for fast searching
  console.log('🗺️  Building lookup map...');
  const lookupMap = new Map();

  for (const entry of closedEntries) {
    const strategyMatch = entry.rawText.match(/^([A-Za-z0-9 ]+?)[\{:]/);
    if (!strategyMatch) continue;
    const strategy = strategyMatch[1].trim();

    // Create key: symbol_strategy_direction_exitPrice_closedTime
    const closedTimestamp = Math.floor(entry.closedAt.getTime() / 1000); // Round to second
    const key = `${entry.symbol}_${strategy}_${entry.direction}_${entry.exitPrice}_${closedTimestamp}`;

    if (!lookupMap.has(key)) {
      lookupMap.set(key, []);
    }
    lookupMap.get(key).push(entry.id);
  }

  console.log(`✅ Built lookup map with ${lookupMap.size} unique keys\n`);

  // Step 3: Load all PENDING EXITs
  console.log('📥 Loading PENDING EXIT signals...');
  const pendingExits = await prisma.signal.findMany({
    where: {
      type: 'EXIT',
      status: 'PENDING',
      source: 'tradingview'
    },
    select: {
      id: true,
      symbol: true,
      rawText: true,
      direction: true,
      entryPrice: true, // EXIT's entryPrice = ENTRY's exitPrice
      createdAt: true
    }
  });

  console.log(`✅ Loaded ${pendingExits.length} PENDING EXIT signals\n`);

  // Step 4: Match and mark
  console.log('🔍 Matching EXIT signals to closed ENTRYs...\n');
  const toMark = [];

  for (const exit of pendingExits) {
    const strategyMatch = exit.rawText.match(/^([A-Za-z0-9 ]+?)[\{:]/);
    if (!strategyMatch) continue;
    const strategy = strategyMatch[1].trim();

    // Create key to lookup
    const createdTimestamp = Math.floor(exit.createdAt.getTime() / 1000);
    const key = `${exit.symbol}_${strategy}_${exit.direction}_${exit.entryPrice}_${createdTimestamp}`;

    if (lookupMap.has(key)) {
      toMark.push(exit.id);
    }
  }

  console.log(`✅ Found ${toMark.length} EXIT signals to mark as EXECUTED\n`);

  // Step 5: Batch update
  if (toMark.length > 0) {
    console.log('💾 Updating database...');

    // Update in batches of 500
    const batchSize = 500;
    for (let i = 0; i < toMark.length; i += batchSize) {
      const batch = toMark.slice(i, i + batchSize);

      await prisma.signal.updateMany({
        where: { id: { in: batch } },
        data: { status: 'EXECUTED' }
      });

      console.log(`  ✅ Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toMark.length / batchSize)} (${batch.length} signals)`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ EXIT signals marked as EXECUTED: ${toMark.length}`);
  console.log(`📝 Total PENDING EXIT signals checked: ${pendingExits.length}`);
  console.log(`⏭️  Remaining PENDING (genuinely unused): ${pendingExits.length - toMark.length}`);
  console.log('='.repeat(80) + '\n');

  await prisma.$disconnect();
}

markUsedExitSignalsFast().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
