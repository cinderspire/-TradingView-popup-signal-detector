const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkExitSignals() {
  try {
    console.log('🔍 Checking EXIT signals...\n');

    const totalSignals = await prisma.signal.count();
    const entrySignals = await prisma.signal.count({ where: { type: 'ENTRY' } });
    const exitSignals = await prisma.signal.count({ where: { type: 'EXIT' } });
    const updateSignals = await prisma.signal.count({ where: { type: 'UPDATE' } });

    console.log('📊 Signal Type Distribution:');
    console.log(`Total Signals: ${totalSignals}`);
    console.log(`ENTRY: ${entrySignals} (${(entrySignals/totalSignals*100).toFixed(1)}%)`);
    console.log(`EXIT: ${exitSignals} (${(exitSignals/totalSignals*100).toFixed(1)}%)`);
    console.log(`UPDATE: ${updateSignals} (${(updateSignals/totalSignals*100).toFixed(1)}%)`);

    // Check signals with profitLoss
    const signalsWithPnL = await prisma.signal.count({
      where: { profitLoss: { not: null } }
    });
    console.log(`\n💰 Signals with P&L: ${signalsWithPnL}`);

    // Sample some rawText to see close patterns
    console.log('\n📝 Sample recent signals (last 20):');
    const samples = await prisma.signal.findMany({
      where: { source: 'tradingview' },
      select: {
        rawText: true,
        type: true,
        status: true,
        profitLoss: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    samples.forEach((s, i) => {
      const text = s.rawText ? s.rawText.substring(0, 120) : 'null';
      console.log(`${i+1}. [${s.type}/${s.status}] ${text}... (PnL: ${s.profitLoss})`);
    });

    // Look for close/exit patterns in rawText
    console.log('\n🔍 Searching for close/exit patterns...');
    const closePatterns = await prisma.signal.count({
      where: {
        OR: [
          { rawText: { contains: '"action":"close"' } },
          { rawText: { contains: '"action":"exit"' } },
          { rawText: { contains: '"marketPosition":"flat"' } },
          { rawText: { contains: '"marketPosition":"close"' } }
        ]
      }
    });
    console.log(`Signals with close/exit patterns: ${closePatterns}`);

    if (closePatterns > 0) {
      console.log('\n📝 Sample close/exit signals:');
      const closeSamples = await prisma.signal.findMany({
        where: {
          OR: [
            { rawText: { contains: '"action":"close"' } },
            { rawText: { contains: '"action":"exit"' } },
            { rawText: { contains: '"marketPosition":"flat"' } },
            { rawText: { contains: '"marketPosition":"close"' } }
          ]
        },
        select: { rawText: true, type: true },
        take: 5
      });
      closeSamples.forEach((s, i) => {
        console.log(`${i+1}. [${s.type}] ${s.rawText.substring(0, 150)}...`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkExitSignals();
