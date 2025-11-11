/**
 * BACKFILL ORPHANED SIGNALS
 *
 * Matches 19,609 open ENTRY signals with EXIT signals
 * Using smart pattern detection:
 * - Explicit EXIT type
 * - marketPosition: 'flat'
 * - action: 'close'
 * - Reversals (position flips)
 *
 * Usage:
 *   node backfill-orphaned-signals.js [--dry-run] [--limit=N] [--batch-size=N]
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));

const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

// Stats
const stats = {
  totalOpen: 0,
  processed: 0,
  matched: 0,
  profitable: 0,
  losing: 0,
  totalPnL: 0,
  errors: 0,
  patterns: {
    explicit_exit: 0,
    flat_position: 0,
    close_action: 0,
    reversal: 0
  }
};

// Helper: Parse signal rawText JSON
function parseSignalData(rawText) {
  if (!rawText) return null;
  try {
    const jsonStart = rawText.indexOf('{');
    const jsonEnd = rawText.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const jsonStr = rawText.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonStr);
  } catch (error) {
    return null;
  }
}

// Helper: Check if signal is EXIT
function isExitSignal(signal, data) {
  if (signal.type === 'EXIT') {
    return { isExit: true, exitDirection: signal.direction, pattern: 'explicit_exit' };
  }

  if (!data) return { isExit: false };

  if (data.marketPosition === 'flat') {
    const exitDirection = data.prevMarketPosition === 'long' ? 'LONG' : 'SHORT';
    return { isExit: true, exitDirection, pattern: 'flat_position' };
  }

  if (data.action === 'close') {
    const exitDirection = data.prevMarketPosition === 'long' ? 'LONG' : 'SHORT';
    return { isExit: true, exitDirection, pattern: 'close_action' };
  }

  if (data.prevMarketPosition &&
      data.prevMarketPosition !== 'flat' &&
      data.prevMarketPosition !== data.marketPosition) {
    const exitDirection = data.prevMarketPosition === 'long' ? 'LONG' : 'SHORT';
    return { isExit: true, exitDirection, pattern: 'reversal' };
  }

  return { isExit: false };
}

// Helper: Calculate P&L
function calculatePnL(entryPrice, exitPrice, direction) {
  if (!entryPrice || !exitPrice || entryPrice <= 0 || exitPrice <= 0) return 0;

  const fee = 0.1;
  let pnl;

  if (direction === 'LONG') {
    pnl = ((exitPrice - entryPrice) / entryPrice * 100) - fee;
  } else if (direction === 'SHORT') {
    pnl = ((entryPrice - exitPrice) / entryPrice * 100) - fee;
  } else {
    return 0;
  }

  return parseFloat(pnl.toFixed(4));
}

// Main backfill function
async function backfillOrphanedSignals() {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 BACKFILL ORPHANED SIGNALS');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? '🧪 DRY RUN (no database changes)' : '🔴 LIVE (will update database)'}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Limit: ${LIMIT || 'No limit (process all)'}`);
  console.log('='.repeat(80) + '\n');

  if (!dryRun) {
    console.log('⚠️  WARNING: This will modify the database!');
    console.log('⚠️  Press Ctrl+C now to cancel or wait 5 seconds to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ Starting backfill...\n');
  }

  try {
    // Get all open ENTRY signals
    console.log('📊 Fetching open ENTRY signals...');
    const openEntries = await prisma.signal.findMany({
      where: {
        source: 'tradingview',
        type: 'ENTRY',
        closedAt: null
      },
      orderBy: { createdAt: 'asc' },
      take: LIMIT || undefined,
      select: {
        id: true,
        symbol: true,
        direction: true,
        entryPrice: true,
        createdAt: true,
        rawText: true
      }
    });

    stats.totalOpen = openEntries.length;
    console.log(`✅ Found ${stats.totalOpen} open ENTRY signals\n`);

    if (stats.totalOpen === 0) {
      console.log('✅ No orphaned signals to process!');
      return;
    }

    // Process in batches
    for (let i = 0; i < openEntries.length; i += BATCH_SIZE) {
      const batch = openEntries.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(openEntries.length / BATCH_SIZE);

      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} signals)...`);

      for (const entry of batch) {
        try {
          stats.processed++;

          // Extract strategy name
          const strategyName = entry.rawText ? entry.rawText.match(/^([A-Z0-9]+)\{/)?.[1] : null;

          // Find potential EXIT signals after this ENTRY
          const potentialExits = await prisma.signal.findMany({
            where: {
              symbol: entry.symbol,
              createdAt: { gt: entry.createdAt },
              rawText: strategyName ? { startsWith: strategyName } : undefined
            },
            orderBy: { createdAt: 'asc' },
            take: 20, // Check next 20 signals
            select: {
              id: true,
              type: true,
              direction: true,
              entryPrice: true,
              createdAt: true,
              rawText: true
            }
          });

          // Check each potential exit
          for (const potentialExit of potentialExits) {
            const data = parseSignalData(potentialExit.rawText);
            const exitCheck = isExitSignal(potentialExit, data);

            // Check if this exit matches our entry
            if (exitCheck.isExit && exitCheck.exitDirection === entry.direction) {
              // Found a match!
              const exitPrice = potentialExit.entryPrice;
              const pnl = calculatePnL(entry.entryPrice, exitPrice, entry.direction);

              if (!dryRun) {
                await prisma.signal.update({
                  where: { id: entry.id },
                  data: {
                    status: 'CLOSED',
                    closedAt: potentialExit.createdAt,
                    exitPrice: exitPrice,
                    profitLoss: pnl
                  }
                });
              }

              // Update stats
              stats.matched++;
              stats.totalPnL += pnl;
              stats.patterns[exitCheck.pattern]++;

              if (pnl > 0) stats.profitable++;
              else stats.losing++;

              // Log progress every 10 matches
              if (stats.matched % 10 === 0) {
                const progress = ((i + batch.indexOf(entry) + 1) / openEntries.length * 100).toFixed(1);
                console.log(`   Progress: ${progress}% | Matched: ${stats.matched} | Win Rate: ${(stats.profitable / stats.matched * 100).toFixed(1)}%`);
              }

              break; // Found exit for this entry, move to next entry
            }
          }

        } catch (error) {
          console.error(`   ❌ Error processing entry ${entry.id}:`, error.message);
          stats.errors++;
        }
      }

      // Batch summary
      console.log(`   ✅ Batch ${batchNum} complete`);
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ BACKFILL COMPLETE!');
    console.log('='.repeat(80));
    console.log(`Mode: ${dryRun ? '🧪 DRY RUN' : '🔴 LIVE'}`);
    console.log(`\nResults:`);
    console.log(`  Total Open Signals: ${stats.totalOpen}`);
    console.log(`  Processed: ${stats.processed}`);
    console.log(`  Matched & Closed: ${stats.matched} (${(stats.matched / stats.totalOpen * 100).toFixed(1)}%)`);
    console.log(`  Still Open: ${stats.totalOpen - stats.matched} (${((stats.totalOpen - stats.matched) / stats.totalOpen * 100).toFixed(1)}%)`);
    console.log(`\nPerformance:`);
    console.log(`  Profitable Trades: ${stats.profitable}`);
    console.log(`  Losing Trades: ${stats.losing}`);
    console.log(`  Win Rate: ${stats.matched > 0 ? (stats.profitable / stats.matched * 100).toFixed(1) : 0}%`);
    console.log(`  Total P&L: ${stats.totalPnL > 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}%`);
    console.log(`  Avg P&L per Trade: ${stats.matched > 0 ? (stats.totalPnL / stats.matched).toFixed(2) : 0}%`);
    console.log(`\nExit Patterns Detected:`);
    console.log(`  Explicit EXIT: ${stats.patterns.explicit_exit}`);
    console.log(`  Flat Position: ${stats.patterns.flat_position}`);
    console.log(`  Close Action: ${stats.patterns.close_action}`);
    console.log(`  Reversals: ${stats.patterns.reversal}`);
    console.log(`\nErrors: ${stats.errors}`);
    console.log('='.repeat(80) + '\n');

    if (dryRun) {
      console.log('💡 This was a DRY RUN - no changes were made to the database.');
      console.log('💡 Run without --dry-run to apply changes.\n');
    } else {
      console.log('✅ Database has been updated with matched trades.\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run
console.clear();
backfillOrphanedSignals();
