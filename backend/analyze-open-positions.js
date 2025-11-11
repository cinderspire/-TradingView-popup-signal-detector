const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeOpenPositions() {
  console.log('🔍 Analyzing pairs with many open positions...\n');

  // Get all active ENTRY signals grouped by strategy and symbol
  const activeSignals = await prisma.signal.findMany({
    where: {
      OR: [
        { status: 'ACTIVE' },
        { status: 'PENDING' }
      ],
      type: 'ENTRY',
      source: 'tradingview'
    },
    select: {
      id: true,
      rawText: true,
      symbol: true,
      direction: true,
      entryPrice: true,
      createdAt: true,
      status: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 2000
  });

  console.log(`Total active ENTRY signals: ${activeSignals.length}\n`);

  // Group by strategy and symbol
  const groupedByPair = {};

  for (const signal of activeSignals) {
    const strategyMatch = signal.rawText.match(/^([A-Za-z0-9 ]+?)[\{:]/);
    const strategy = strategyMatch ? strategyMatch[1].trim() : 'Unknown';
    const key = `${strategy}|${signal.symbol}`;

    if (!groupedByPair[key]) {
      groupedByPair[key] = {
        strategy,
        symbol: signal.symbol,
        signals: []
      };
    }

    groupedByPair[key].signals.push(signal);
  }

  // Find pairs with 5+ open positions
  const problematicPairs = Object.values(groupedByPair)
    .filter(p => p.signals.length >= 5)
    .sort((a, b) => b.signals.length - a.signals.length)
    .slice(0, 15);

  console.log('📊 Top 15 pairs with most open positions:\n');

  for (const pair of problematicPairs) {
    console.log(`${pair.strategy.padEnd(20)} | ${pair.symbol.padEnd(20)} | ${pair.signals.length} open`);

    // Check if there are EXIT signals for this strategy+symbol
    const exitSignals = await prisma.signal.findMany({
      where: {
        rawText: { contains: pair.strategy },
        symbol: pair.symbol,
        OR: [
          { type: 'EXIT' },
          { rawText: { contains: 'flat' } },
          { rawText: { contains: 'close' } }
        ],
        createdAt: {
          gte: pair.signals[pair.signals.length - 1].createdAt
        }
      },
      select: {
        id: true,
        type: true,
        createdAt: true,
        rawText: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`  → Found ${exitSignals.length} potential EXIT signals`);

    if (exitSignals.length > 0) {
      exitSignals.forEach(exit => {
        const isFlat = exit.rawText.includes('flat');
        const isClose = exit.rawText.includes('close');
        const type = exit.type === 'EXIT' ? 'EXIT' : (isFlat ? 'FLAT' : isClose ? 'CLOSE' : 'OTHER');
        console.log(`  → ${type}: ${exit.createdAt.toISOString().split('T')[0]}`);
      });
    } else {
      console.log(`  ⚠️  NO EXIT signals found - positions stuck!`);
    }

    console.log('');
  }

  await prisma.$disconnect();
}

analyzeOpenPositions().catch(console.error);
