const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Check GRID signals
    const gridSignals = await prisma.signal.findMany({
      where: {
        source: 'tradingview',
        rawText: { startsWith: 'GRID' }
      },
      select: {
        id: true,
        type: true,
        status: true,
        symbol: true,
        direction: true,
        entryPrice: true,
        closedAt: true,
        rawText: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    console.log('\n📊 GRID SIGNALS ANALYSIS:');
    console.log('='.repeat(80));
    console.log('Total GRID signals:', gridSignals.length);

    const entryCount = gridSignals.filter(s => s.type === 'ENTRY').length;
    const exitCount = gridSignals.filter(s => s.type === 'EXIT').length;
    const closedCount = gridSignals.filter(s => s.closedAt !== null).length;
    const openCount = gridSignals.filter(s => s.type === 'ENTRY' && s.closedAt === null).length;

    console.log('ENTRY signals:', entryCount);
    console.log('EXIT signals:', exitCount);
    console.log('Closed signals:', closedCount);
    console.log('Open ENTRY signals:', openCount);

    console.log('\n📋 Sample GRID signals (last 5):');
    console.log('='.repeat(80));

    gridSignals.slice(0, 5).forEach((s, i) => {
      const jsonStart = s.rawText.indexOf('{');
      const jsonEnd = s.rawText.lastIndexOf('}');
      const json = jsonStart !== -1 && jsonEnd !== -1
        ? s.rawText.substring(jsonStart, jsonEnd + 1)
        : '{}';

      let data = null;
      try {
        data = JSON.parse(json);
      } catch (e) {
        data = null;
      }

      console.log(`\n${i + 1}. Signal ID: ${s.id.substring(0, 8)}...`);
      console.log(`   Type: ${s.type} | Status: ${s.status} | Closed: ${s.closedAt ? 'YES' : 'NO'}`);
      console.log(`   Symbol: ${s.symbol} | Direction: ${s.direction}`);
      console.log(`   Created: ${s.createdAt.toISOString()}`);

      if (data) {
        console.log(`   Data:`);
        console.log(`     marketPosition: ${data.marketPosition}`);
        console.log(`     prevMarketPosition: ${data.prevMarketPosition}`);
        console.log(`     action: ${data.action}`);
        console.log(`     contracts: ${data.contracts}`);
      }
    });

    // Check for EXIT patterns in GRID
    console.log('\n\n🔍 EXIT PATTERN DETECTION IN GRID:');
    console.log('='.repeat(80));

    let flatCount = 0;
    let closeActionCount = 0;
    let reversalCount = 0;

    for (const signal of gridSignals) {
      const jsonStart = signal.rawText.indexOf('{');
      const jsonEnd = signal.rawText.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) continue;

      try {
        const json = signal.rawText.substring(jsonStart, jsonEnd + 1);
        const data = JSON.parse(json);

        if (data.marketPosition === 'flat') flatCount++;
        if (data.action === 'close') closeActionCount++;
        if (data.prevMarketPosition &&
            data.prevMarketPosition !== 'flat' &&
            data.prevMarketPosition !== data.marketPosition) {
          reversalCount++;
        }
      } catch (e) {
        // Skip parse errors
      }
    }

    console.log(`Signals with marketPosition='flat': ${flatCount}`);
    console.log(`Signals with action='close': ${closeActionCount}`);
    console.log(`Signals with reversals: ${reversalCount}`);
    console.log(`Total EXIT patterns: ${flatCount + closeActionCount + reversalCount}`);

    if (flatCount + closeActionCount + reversalCount > 0 && closedCount === 0) {
      console.log('\n⚠️  WARNING: EXIT patterns detected but NO signals closed!');
      console.log('   This means the matcher is NOT working for GRID strategy.');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
