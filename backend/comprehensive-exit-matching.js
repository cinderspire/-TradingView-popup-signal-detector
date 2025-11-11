const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * COMPREHENSIVE EXIT MATCHING CLEANUP
 *
 * Matches ALL unused EXIT signals with open ENTRY signals
 * Uses FIFO (First In First Out) for matching
 */

let totalMatched = 0;
let totalPnL = 0;
let errors = 0;

async function matchExitSignals() {
  console.log('🚀 COMPREHENSIVE EXIT SIGNAL MATCHING');
  console.log('='.repeat(80));
  console.log('Finding and matching ALL unused EXIT signals...\n');

  // Get all unused EXIT signals
  const unusedExits = await prisma.signal.findMany({
    where: {
      type: 'EXIT',
      status: 'PENDING', // Unused
      source: 'tradingview'
    },
    orderBy: { createdAt: 'asc' }, // Oldest first (FIFO)
    select: {
      id: true,
      rawText: true,
      symbol: true,
      direction: true,
      entryPrice: true,
      createdAt: true
    }
  });

  console.log(`📊 Found ${unusedExits.length} unused EXIT signals\n`);

  // Group by strategy
  const byStrategy = {};
  for (const exit of unusedExits) {
    const strategyMatch = exit.rawText.match(/^([A-Za-z0-9 ]+?)[\{:]/);
    if (!strategyMatch) continue;

    const strategy = strategyMatch[1].trim();
    if (!byStrategy[strategy]) {
      byStrategy[strategy] = [];
    }
    byStrategy[strategy].push(exit);
  }

  console.log(`📋 Grouped into ${Object.keys(byStrategy).length} strategies\n`);

  // Process each strategy
  for (const [strategy, exits] of Object.entries(byStrategy)) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 Processing: ${strategy} (${exits.length} EXIT signals)`);
    console.log('='.repeat(80));

    let matched = 0;
    let skipped = 0;

    for (const exit of exits) {
      try {
        // Find matching open ENTRY
        const openEntry = await prisma.signal.findFirst({
          where: {
            symbol: exit.symbol,
            rawText: { startsWith: strategy },
            type: 'ENTRY',
            direction: exit.direction,
            status: { in: ['ACTIVE', 'PENDING'] },
            createdAt: { lte: exit.createdAt } // Only entries created BEFORE this exit
          },
          orderBy: { createdAt: 'asc' } // FIFO: oldest first
        });

        if (!openEntry) {
          skipped++;
          continue;
        }

        // Calculate P&L
        const entryPrice = openEntry.entryPrice;
        const exitPrice = exit.entryPrice;
        let pnl = 0;

        if (entryPrice && exitPrice) {
          if (openEntry.direction === 'LONG') {
            pnl = ((exitPrice - entryPrice) / entryPrice * 100) - 0.1;
          } else {
            pnl = ((entryPrice - exitPrice) / entryPrice * 100) - 0.1;
          }
        }

        // Update ENTRY to CLOSED
        await prisma.signal.update({
          where: { id: openEntry.id },
          data: {
            status: 'CLOSED',
            closedAt: exit.createdAt,
            exitPrice: exitPrice,
            profitLoss: pnl
          }
        });

        // Mark EXIT as EXECUTED
        await prisma.signal.update({
          where: { id: exit.id },
          data: { status: 'EXECUTED' }
        });

        matched++;
        totalMatched++;
        totalPnL += pnl;

        if (matched % 100 === 0) {
          console.log(`  ✅ Matched ${matched}/${exits.length}...`);
        }

      } catch (error) {
        errors++;
        if (errors < 10) {
          console.error(`  ❌ Error matching ${exit.id}:`, error.message);
        }
      }
    }

    console.log(`\n📊 ${strategy} Results:`);
    console.log(`  ✅ Matched: ${matched}`);
    console.log(`  ⏭️  Skipped: ${skipped} (no matching ENTRY found)`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Total matches: ${totalMatched}`);
  console.log(`💰 Total P&L: ${totalPnL.toFixed(2)}%`);
  console.log(`📈 Average P&L: ${totalMatched > 0 ? (totalPnL / totalMatched).toFixed(2) : 0}%`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(80) + '\n');

  await prisma.$disconnect();
}

matchExitSignals().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
