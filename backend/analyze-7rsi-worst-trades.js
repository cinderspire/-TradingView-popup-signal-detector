const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyze7RSI() {
  try {
    console.log('🔍 7RSI Worst Trades Analysis\n');

    // Get worst trades
    const worstTrades = await prisma.signal.findMany({
      where: {
        rawText: { startsWith: '7RSI{' },
        type: 'ENTRY',
        status: 'EXECUTED',
        profitLoss: { not: null }
      },
      select: {
        id: true,
        symbol: true,
        direction: true,
        entryPrice: true,
        exitPrice: true,
        profitLoss: true,
        rawText: true,
        createdAt: true
      },
      orderBy: { profitLoss: 'asc' },
      take: 20
    });

    console.log(`Found ${worstTrades.length} worst trades:\n`);

    worstTrades.forEach((trade, i) => {
      console.log(`${i + 1}. ${trade.symbol} ${trade.direction}`);
      console.log(`   Entry: ${trade.entryPrice}, Exit: ${trade.exitPrice}`);
      console.log(`   P&L: ${trade.profitLoss.toFixed(2)}%`);

      // Calculate what P&L should be
      if (trade.entryPrice && trade.exitPrice) {
        let expectedPnL;
        if (trade.direction === 'LONG') {
          expectedPnL = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100 - 0.1;
        } else {
          expectedPnL = ((trade.entryPrice - trade.exitPrice) / trade.entryPrice) * 100 - 0.1;
        }
        console.log(`   Expected P&L: ${expectedPnL.toFixed(2)}% ${Math.abs(expectedPnL - trade.profitLoss) > 0.1 ? '⚠️ MISMATCH!' : '✅'}`);
      }

      console.log(`   Date: ${trade.createdAt.toISOString().slice(0, 10)}`);
      console.log(`   RawText: ${trade.rawText.substring(0, 80)}...\n`);
    });

    // Get overall stats
    const allExecuted = await prisma.signal.findMany({
      where: {
        rawText: { startsWith: '7RSI{' },
        type: 'ENTRY',
        status: 'EXECUTED',
        profitLoss: { not: null }
      },
      select: { profitLoss: true, direction: true }
    });

    const totalPnL = allExecuted.reduce((sum, t) => sum + t.profitLoss, 0);
    const longs = allExecuted.filter(t => t.direction === 'LONG');
    const shorts = allExecuted.filter(t => t.direction === 'SHORT');

    console.log('\n📊 Overall Stats:');
    console.log(`Total executed: ${allExecuted.length}`);
    console.log(`Total P&L: ${totalPnL.toFixed(2)}%`);
    console.log(`Avg P&L: ${(totalPnL / allExecuted.length).toFixed(2)}%`);
    console.log(`\nLONG: ${longs.length} trades, Total: ${longs.reduce((sum, t) => sum + t.profitLoss, 0).toFixed(2)}%`);
    console.log(`SHORT: ${shorts.length} trades, Total: ${shorts.reduce((sum, t) => sum + t.profitLoss, 0).toFixed(2)}%`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyze7RSI();
