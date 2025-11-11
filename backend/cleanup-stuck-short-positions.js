const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Cleanup script for stuck SHORT ENTRY positions
 *
 * Problem: EXIT signals for SHORT positions were incorrectly saved with direction='LONG'
 * because tradingview-capture.js was checking 'previousPosition' instead of 'prevMarketPosition'
 *
 * Solution: Find stuck SHORT entries and match them with misclassified EXIT signals
 */

async function cleanupStuckShortPositions() {
  console.log('🧹 Cleaning up stuck SHORT positions...\n');

  let totalClosed = 0;
  let totalPnL = 0;

  // Find all stuck SHORT ENTRY signals (grouped by strategy+symbol)
  const stuckEntries = await prisma.signal.findMany({
    where: {
      type: 'ENTRY',
      direction: 'SHORT',
      status: { in: ['ACTIVE', 'PENDING'] },
      source: 'tradingview'
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${stuckEntries.length} stuck SHORT ENTRY signals\n`);

  // Group by strategy+symbol
  const grouped = {};
  for (const entry of stuckEntries) {
    const strategyMatch = entry.rawText.match(/^([A-Za-z0-9 ]+?)[\{:]/);
    const strategy = strategyMatch ? strategyMatch[1].trim() : null;

    if (!strategy) continue;

    const key = `${strategy}|${entry.symbol}`;
    if (!grouped[key]) {
      grouped[key] = {
        strategy,
        symbol: entry.symbol,
        entries: []
      };
    }
    grouped[key].entries.push(entry);
  }

  console.log(`Processing ${Object.keys(grouped).length} strategy+symbol pairs...\n`);

  // Process each group
  for (const [key, group] of Object.entries(grouped)) {
    console.log(`\n📊 ${group.strategy} + ${group.symbol} (${group.entries.length} stuck SHORT entries)`);

    let closedInGroup = 0;

    // For each SHORT entry, find matching EXIT
    for (const entry of group.entries) {
      // Look for EXIT signals with prevMarketPosition='short' in JSON
      const potentialExits = await prisma.signal.findMany({
        where: {
          symbol: group.symbol,
          rawText: { contains: group.strategy },
          type: 'EXIT',
          status: 'PENDING',
          createdAt: { gte: entry.createdAt }
        },
        orderBy: { createdAt: 'asc' },
        take: 10
      });

      // Filter for actual SHORT exits by checking prevMarketPosition in JSON
      let matchedExit = null;
      for (const exit of potentialExits) {
        const jsonMatch = exit.rawText.match(/\{[^}]+\}/);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[0]);
            if (data.prevMarketPosition === 'short') {
              matchedExit = exit;
              break; // FIFO - use first (oldest) match
            }
          } catch (e) {
            continue;
          }
        }
      }

      if (!matchedExit) {
        console.log(`  ⚠️  No EXIT found for ENTRY ${entry.id} (${entry.createdAt.toISOString().split('T')[0]})`);
        continue;
      }

      // Calculate P&L
      const entryPrice = entry.entryPrice;
      const exitPrice = matchedExit.entryPrice;
      let pnl = 0;
      if (entryPrice && exitPrice) {
        // SHORT: profit when price goes down
        pnl = ((entryPrice - exitPrice) / entryPrice * 100) - 0.1;
      }

      // Close the ENTRY
      await prisma.signal.update({
        where: { id: entry.id },
        data: {
          status: 'CLOSED',
          closedAt: matchedExit.createdAt,
          exitPrice: exitPrice,
          profitLoss: pnl
        }
      });

      // Mark EXIT as used (set status to EXECUTED)
      await prisma.signal.update({
        where: { id: matchedExit.id },
        data: { status: 'EXECUTED' }
      });

      const emoji = pnl > 0 ? '✅' : '❌';
      console.log(`  ${emoji} Closed: ENTRY ${entry.id.substring(0, 13)}... → EXIT ${matchedExit.id.substring(0, 13)}... | ${pnl.toFixed(2)}%`);

      closedInGroup++;
      totalClosed++;
      totalPnL += pnl;
    }

    console.log(`  → Closed ${closedInGroup}/${group.entries.length} positions`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ Cleanup complete!`);
  console.log(`   Total positions closed: ${totalClosed}`);
  console.log(`   Total P&L: ${totalPnL.toFixed(2)}%`);
  console.log(`   Average P&L: ${totalClosed > 0 ? (totalPnL / totalClosed).toFixed(2) : 0}%`);
  console.log(`${'='.repeat(80)}\n`);

  await prisma.$disconnect();
}

cleanupStuckShortPositions().catch(console.error);
