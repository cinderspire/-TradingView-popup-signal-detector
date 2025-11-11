const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Mark EXIT signals as EXECUTED if they were already used
 *
 * Problem: EXIT signals that closed ENTRYs were not marked as EXECUTED
 * This script finds EXIT signals where:
 * - Status is PENDING
 * - An ENTRY was closed at the same time with matching exit price
 * - Marks those EXIT signals as EXECUTED
 */

let totalMarked = 0;
let totalChecked = 0;

async function markUsedExitSignals() {
  console.log('🔍 Finding EXIT signals that were used but not marked...\n');

  // Get all PENDING EXIT signals
  const pendingExits = await prisma.signal.findMany({
    where: {
      type: 'EXIT',
      status: 'PENDING',
      source: 'tradingview'
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`📊 Found ${pendingExits.length} PENDING EXIT signals\n`);
  console.log('Checking which ones were actually used...\n');

  for (const exit of pendingExits) {
    totalChecked++;

    try {
      // Extract strategy name
      const strategyMatch = exit.rawText.match(/^([A-Za-z0-9 ]+?)[\{:]/);
      if (!strategyMatch) continue;
      const strategy = strategyMatch[1].trim();

      // Look for ENTRY that was closed at same time with matching price
      const matchingEntry = await prisma.signal.findFirst({
        where: {
          symbol: exit.symbol,
          rawText: { startsWith: strategy },
          type: 'ENTRY',
          status: 'CLOSED',
          direction: exit.direction,
          exitPrice: exit.entryPrice, // EXIT's entryPrice = ENTRY's exitPrice
          closedAt: {
            gte: new Date(exit.createdAt.getTime() - 1000), // Within 1 second
            lte: new Date(exit.createdAt.getTime() + 1000)
          }
        }
      });

      if (matchingEntry) {
        // Mark EXIT as EXECUTED
        await prisma.signal.update({
          where: { id: exit.id },
          data: { status: 'EXECUTED' }
        });

        totalMarked++;

        if (totalMarked % 100 === 0) {
          console.log(`  ✅ Marked ${totalMarked}/${totalChecked} EXIT signals as EXECUTED...`);
        }
      }

    } catch (error) {
      console.error(`  ❌ Error processing ${exit.id}:`, error.message);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Total EXIT signals marked as EXECUTED: ${totalMarked}`);
  console.log(`📝 Total EXIT signals checked: ${totalChecked}`);
  console.log(`⏭️  Remaining PENDING (genuinely unused): ${totalChecked - totalMarked}`);
  console.log('='.repeat(80) + '\n');

  await prisma.$disconnect();
}

markUsedExitSignals().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
