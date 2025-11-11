const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🔍 DEBUGGING AIA POSITION - WHY SL DID NOT TRIGGER\n');
    console.log('='.repeat(70));

    // 1. Find AIA position in database
    console.log('\n1. SEARCHING FOR AIA POSITIONS IN DATABASE:');
    console.log('-'.repeat(70));

    const aiaPositions = await prisma.position.findMany({
      where: {
        symbol: { contains: 'AIA' }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${aiaPositions.length} AIA positions\n`);

    if (aiaPositions.length === 0) {
      console.log('❌ PROBLEM 1: NO AIA POSITION IN DATABASE!');
      console.log('   → Position was never created or was deleted');
      console.log('   → Position Monitor cannot track what is not in DB\n');
    }

    for (const pos of aiaPositions) {
      const entry = parseFloat(pos.entryPrice);
      const current = parseFloat(pos.currentPrice) || entry;
      const tp = parseFloat(pos.takeProfit);
      const sl = parseFloat(pos.stopLoss);

      const currentPnL = ((current - entry) / entry) * 100;
      const tpPercent = ((tp - entry) / entry) * 100;
      const slPercent = ((sl - entry) / entry) * 100;

      console.log(`Position ID: ${pos.id}`);
      console.log(`Symbol: ${pos.symbol}`);
      console.log(`Side: ${pos.side}`);
      console.log(`Status: ${pos.status}`);
      console.log(`Entry: $${entry.toFixed(4)}`);
      console.log(`Current: $${current.toFixed(4)} (${currentPnL >= 0 ? '+' : ''}${currentPnL.toFixed(2)}%)`);
      console.log(`Take Profit: $${tp.toFixed(4)} (${tpPercent >= 0 ? '+' : ''}${tpPercent.toFixed(2)}%)`);
      console.log(`Stop Loss: $${sl.toFixed(4)} (${slPercent >= 0 ? '+' : ''}${slPercent.toFixed(2)}%)`);
      console.log(`Created: ${pos.createdAt}`);
      console.log(`Notes: ${pos.notes || 'none'}`);

      // Check if SL should have triggered
      if (pos.side === 'LONG' && current <= sl && pos.status === 'OPEN') {
        console.log('\n❌ CRITICAL BUG: POSITION SHOULD BE CLOSED!');
        console.log(`   Current price ($${current.toFixed(4)}) <= Stop Loss ($${sl.toFixed(4)})`);
        console.log(`   But status is still: ${pos.status}`);
      }

      console.log('');
    }

    // 2. Check all OPEN positions
    console.log('\n2. ALL OPEN POSITIONS:');
    console.log('-'.repeat(70));

    const openPositions = await prisma.position.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Total OPEN positions: ${openPositions.length}\n`);

    for (const pos of openPositions) {
      const entry = parseFloat(pos.entryPrice);
      const current = parseFloat(pos.currentPrice) || entry;
      const currentPnL = ((current - entry) / entry) * 100;

      console.log(`${pos.symbol.padEnd(15)} ${pos.side.padEnd(6)} Entry: $${entry.toFixed(4)}  Current: $${current.toFixed(4)}  PnL: ${currentPnL >= 0 ? '+' : ''}${currentPnL.toFixed(2)}%`);
    }

    // 3. Check CLOSED positions with AIA
    console.log('\n3. CLOSED AIA POSITIONS (RECENT):');
    console.log('-'.repeat(70));

    const closedAIA = await prisma.position.findMany({
      where: {
        symbol: { contains: 'AIA' },
        status: 'CLOSED'
      },
      orderBy: { closedAt: 'desc' },
      take: 5
    });

    console.log(`Found ${closedAIA.length} closed AIA positions\n`);

    for (const pos of closedAIA) {
      console.log(`Closed at: ${pos.closedAt}`);
      console.log(`Reason: ${pos.closeReason}`);
      console.log(`PnL: ${pos.realizedPnL ? pos.realizedPnL.toFixed(2) : 'N/A'}`);
      console.log('');
    }

    // 4. Check Position Monitor configuration
    console.log('\n4. POSITION MONITOR CHECK:');
    console.log('-'.repeat(70));

    const positionsWithTPSL = await prisma.position.findMany({
      where: {
        status: 'OPEN',
        OR: [
          { takeProfit: { not: null } },
          { stopLoss: { not: null } }
        ]
      }
    });

    console.log(`Positions with TP/SL being monitored: ${positionsWithTPSL.length}`);
    console.log(`\nPositions being tracked:`);
    for (const pos of positionsWithTPSL) {
      console.log(`  - ${pos.symbol} (${pos.side})`);
    }

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
