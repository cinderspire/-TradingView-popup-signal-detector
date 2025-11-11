const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAllStrategyExits() {
  try {
    console.log('🔧 Fixing EXIT signals for ALL TradingView strategies...\n');

    // Get all TradingView signals
    const allSignals = await prisma.signal.findMany({
      where: {
        source: 'tradingview',
        rawText: { not: null }
      },
      select: {
        id: true,
        type: true,
        direction: true,
        symbol: true,
        entryPrice: true,
        rawText: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Processing ${allSignals.length} signals...`);

    let stats = {
      total: allSignals.length,
      parsed: 0,
      reversals: 0,  // Need EXIT before ENTRY (AJAY style)
      exitFlat: 0,   // marketPosition flat (7RSI, COW style)
      actionClose: 0, // action: close
      alreadyExit: 0,
      parseErrors: 0
    };

    const exitsToCreate = [];
    const entriesToFixAsExit = []; // Signals currently marked as ENTRY but should be EXIT

    for (const signal of allSignals) {
      try {
        // Extract strategy name
        const strategyMatch = signal.rawText.match(/^([A-Z0-9]+)\{/);
        if (!strategyMatch) continue;

        const strategyName = strategyMatch[1];

        // Extract JSON
        const jsonStart = signal.rawText.indexOf('{');
        const jsonEnd = signal.rawText.indexOf('}', jsonStart) + 1;
        if (jsonEnd <= jsonStart) continue;

        const jsonStr = signal.rawText.substring(jsonStart, jsonEnd);
        const data = JSON.parse(jsonStr);

        stats.parsed++;

        // CASE 1: marketPosition is "flat" - this is an EXIT
        if (data.marketPosition === 'flat') {
          stats.exitFlat++;
          if (signal.type !== 'EXIT') {
            entriesToFixAsExit.push({
              id: signal.id,
              direction: data.prevMarketPosition === 'long' ? 'LONG' : 'SHORT'
            });
          }
        }

        // CASE 2: action is "close" - this is an EXIT
        else if (data.action === 'close') {
          stats.actionClose++;
          if (signal.type !== 'EXIT') {
            entriesToFixAsExit.push({
              id: signal.id,
              direction: signal.direction
            });
          }
        }

        // CASE 3: Reversal (prevMarketPosition != marketPosition, both not flat)
        else if (data.prevMarketPosition &&
                 data.prevMarketPosition !== 'flat' &&
                 data.marketPosition !== 'flat' &&
                 data.prevMarketPosition !== data.marketPosition) {

          stats.reversals++;

          // This signal is an ENTRY, but we need to create an EXIT for the previous position
          const exitDirection = data.prevMarketPosition === 'long' ? 'LONG' : 'SHORT';

          exitsToCreate.push({
            type: 'EXIT',
            direction: exitDirection,
            symbol: signal.symbol,
            entryPrice: parseFloat(data.price),
            rawText: signal.rawText,
            createdAt: new Date(signal.createdAt.getTime() - 1000), // 1 second before ENTRY
            source: 'tradingview',
            status: 'PENDING'
          });
        }

        if (signal.type === 'EXIT') stats.alreadyExit++;

      } catch (e) {
        stats.parseErrors++;
      }
    }

    console.log(`\n📊 Analysis:`);
    console.log(`  Total signals: ${stats.total}`);
    console.log(`  Successfully parsed: ${stats.parsed}`);
    console.log(`  Parse errors: ${stats.parseErrors}`);
    console.log(`  Already marked as EXIT: ${stats.alreadyExit}`);
    console.log(`\n  Detection patterns:`);
    console.log(`    marketPosition flat: ${stats.exitFlat}`);
    console.log(`    action close: ${stats.actionClose}`);
    console.log(`    Reversals (need new EXIT): ${stats.reversals}`);

    console.log(`\n💡 Actions needed:`);
    console.log(`  Signals to fix (ENTRY→EXIT): ${entriesToFixAsExit.length}`);
    console.log(`  New EXIT signals to create: ${exitsToCreate.length}`);

    // Fix signals currently marked as ENTRY but should be EXIT
    if (entriesToFixAsExit.length > 0) {
      console.log(`\n🔄 Fixing ${entriesToFixAsExit.length} signals to EXIT...`);
      for (const fix of entriesToFixAsExit) {
        await prisma.signal.update({
          where: { id: fix.id },
          data: {
            type: 'EXIT',
            direction: fix.direction
          }
        });
      }
      console.log(`✅ Fixed!`);
    }

    // Create new EXIT signals for reversals
    if (exitsToCreate.length > 0) {
      console.log(`\n🔄 Creating ${exitsToCreate.length} new EXIT signals...`);
      const batchSize = 100;
      let created = 0;

      for (let i = 0; i < exitsToCreate.length; i += batchSize) {
        const batch = exitsToCreate.slice(i, i + batchSize);
        await prisma.signal.createMany({
          data: batch,
          skipDuplicates: true
        });
        created += batch.length;
        if (created % 500 === 0) {
          console.log(`  Created ${created}/${exitsToCreate.length}...`);
        }
      }
      console.log(`✅ Created ${created} EXIT signals!`);
    }

    console.log(`\n✅ All done! Run match-signals-calculate-pnl.js to recalculate P&L\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllStrategyExits();
