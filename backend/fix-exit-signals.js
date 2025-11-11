const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixExitSignals() {
  try {
    console.log('🔧 Fixing EXIT signal types...\n');

    // Find all signals with close/exit patterns
    const signalsToFix = await prisma.signal.findMany({
      where: {
        type: 'ENTRY',
        OR: [
          { rawText: { contains: '"action":"close"' } },
          { rawText: { contains: '"action":"exit"' } },
          { rawText: { contains: '"marketPosition":"flat"' } },
          { rawText: { contains: '"marketPosition":"close"' } }
        ]
      },
      select: {
        id: true,
        rawText: true,
        direction: true
      }
    });

    console.log(`Found ${signalsToFix.length} signals to fix`);

    if (signalsToFix.length === 0) {
      console.log('No signals to fix!');
      return;
    }

    console.log('Starting batch update...\n');
    let updated = 0;
    const batchSize = 100;

    for (let i = 0; i < signalsToFix.length; i += batchSize) {
      const batch = signalsToFix.slice(i, i + batchSize);

      // Update each signal in batch
      await Promise.all(batch.map(async (signal) => {
        try {
          // Parse the JSON to determine correct direction
          let direction = signal.direction;

          if (signal.rawText) {
            const jsonMatch = signal.rawText.match(/\{.*\}/);
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[0]);

              // Determine direction based on what position is being closed
              if (data.prevMarketPosition === 'long' || data.previousPosition === 'long') {
                direction = 'LONG'; // Closing a long
              } else if (data.prevMarketPosition === 'short' || data.previousPosition === 'short') {
                direction = 'SHORT'; // Closing a short
              } else if (data.action === 'sell') {
                direction = 'LONG'; // Sell to close long
              } else if (data.action === 'buy') {
                direction = 'SHORT'; // Buy to close short
              }
            }
          }

          await prisma.signal.update({
            where: { id: signal.id },
            data: {
              type: 'EXIT',
              direction: direction
            }
          });
        } catch (err) {
          console.error(`Error updating signal ${signal.id}:`, err.message);
        }
      }));

      updated += batch.length;
      console.log(`✅ Updated ${updated}/${signalsToFix.length} signals (${(updated/signalsToFix.length*100).toFixed(1)}%)`);
    }

    // Verify the update
    console.log('\n📊 Verification:');
    const entryCount = await prisma.signal.count({ where: { type: 'ENTRY' } });
    const exitCount = await prisma.signal.count({ where: { type: 'EXIT' } });
    const totalCount = await prisma.signal.count();

    console.log(`Total Signals: ${totalCount}`);
    console.log(`ENTRY: ${entryCount} (${(entryCount/totalCount*100).toFixed(1)}%)`);
    console.log(`EXIT: ${exitCount} (${(exitCount/totalCount*100).toFixed(1)}%)`);

    console.log('\n✅ Signal types fixed successfully!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixExitSignals();
