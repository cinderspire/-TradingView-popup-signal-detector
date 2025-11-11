const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check7RSI() {
  try {
    const strategyId = 'ad36636f-5871-432b-bb2e-a168a7d8395c'; // 7RSI from DB

    console.log('🔍 Checking 7RSI strategy signals\n');

    // Count signals with this strategyId
    const withStrategyId = await prisma.signal.count({
      where: { strategyId: strategyId }
    });

    console.log(`Signals with strategyId=${strategyId}: ${withStrategyId}\n`);

    if (withStrategyId > 0) {
      // Get executed trades
      const executed = await prisma.signal.findMany({
        where: {
          strategyId: strategyId,
          type: 'ENTRY',
          status: 'EXECUTED',
          profitLoss: { not: null }
        },
        select: {
          profitLoss: true,
          symbol: true,
          direction: true
        },
        take: 20,
        orderBy: { profitLoss: 'asc' }
      });

      console.log(`Executed trades with P&L: ${executed.length}`);
      if (executed.length > 0) {
        const total = executed.reduce((sum, s) => sum + s.profitLoss, 0);
        console.log(`Total P&L: ${total.toFixed(2)}%`);
        console.log(`Avg P&L: ${(total / executed.length).toFixed(2)}%\n`);

        console.log('Worst 10 trades:');
        executed.slice(0, 10).forEach((s, i) => {
          console.log(`  ${i + 1}. ${s.symbol} ${s.direction}: ${s.profitLoss.toFixed(2)}%`);
        });
      }
    }

    // Check rawText signals
    const rawTextSignals = await prisma.signal.count({
      where: {
        rawText: { startsWith: '7RSI{' },
        strategyId: null
      }
    });

    console.log(`\n📊 Signals with rawText='7RSI{' and no strategyId: ${rawTextSignals}`);

    // Check if there are any signals with this strategy linked through rawText matching
    const rawTextWithPnL = await prisma.signal.count({
      where: {
        rawText: { startsWith: '7RSI{' },
        type: 'ENTRY',
        status: 'EXECUTED',
        profitLoss: { not: null }
      }
    });

    console.log(`Signals with 7RSI rawText and P&L: ${rawTextWithPnL}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check7RSI();
