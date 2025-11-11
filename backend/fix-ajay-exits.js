const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAJAYExits() {
  try {
    console.log('🔧 Fixing AJAY EXIT signals...\n');

    // Get all AJAY signals
    const ajaySignals = await prisma.signal.findMany({
      where: {
        rawText: { startsWith: 'AJAY{' }
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

    console.log(`Found ${ajaySignals.length} AJAY signals`);

    let exitsToCreate = [];
    let stats = {
      parsed: 0,
      reversals: 0,  // prevMarketPosition != marketPosition
      sameDirection: 0
    };

    // Parse and analyze
    for (const signal of ajaySignals) {
      try {
        // Extract JSON part (between AJAY{ and }SYMBOL)
        const jsonStart = signal.rawText.indexOf('{');
        const jsonEnd = signal.rawText.indexOf('}', jsonStart) + 1;
        const jsonStr = signal.rawText.substring(jsonStart, jsonEnd);
        const data = JSON.parse(jsonStr);

        stats.parsed++;

        // Check if this is a reversal (position flip)
        if (data.prevMarketPosition &&
            data.prevMarketPosition !== 'flat' &&
            data.prevMarketPosition !== data.marketPosition) {

          stats.reversals++;

          // Determine EXIT direction (opposite of prevMarketPosition)
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

          console.log(`  Found reversal: ${signal.symbol} ${data.prevMarketPosition} → ${data.marketPosition}`);
        } else {
          stats.sameDirection++;
        }

      } catch (e) {
        console.error(`  Parse error for signal ${signal.id}:`, e.message);
      }
    }

    console.log(`\n📊 Analysis:`);
    console.log(`  Parsed: ${stats.parsed}`);
    console.log(`  Reversals (need EXIT): ${stats.reversals}`);
    console.log(`  Same direction: ${stats.sameDirection}`);
    console.log(`\n  EXIT signals to create: ${exitsToCreate.length}`);

    if (exitsToCreate.length === 0) {
      console.log('\n✅ No EXIT signals needed!');
      return;
    }

    // Ask for confirmation
    console.log(`\n⚠️  About to create ${exitsToCreate.length} EXIT signals.`);
    console.log('Sample:');
    exitsToCreate.slice(0, 5).forEach((e, i) => {
      console.log(`  ${i+1}. EXIT ${e.direction} ${e.symbol} @ ${e.entryPrice}`);
    });

    // Create EXIT signals in batches
    console.log(`\n🔄 Creating EXIT signals...`);
    const batchSize = 100;
    let created = 0;

    for (let i = 0; i < exitsToCreate.length; i += batchSize) {
      const batch = exitsToCreate.slice(i, i + batchSize);

      await prisma.signal.createMany({
        data: batch,
        skipDuplicates: true
      });

      created += batch.length;
      console.log(`  Created ${created}/${exitsToCreate.length}...`);
    }

    console.log(`\n✅ Created ${created} EXIT signals!`);
    console.log('\nNow run match-signals-calculate-pnl.js to calculate P&L\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAJAYExits();
