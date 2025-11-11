const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🔍 SEARCHING FOR AIA EVERYWHERE\n');

    // 1. Paper Trades
    console.log('1. PAPER TRADES:');
    console.log('-'.repeat(70));
    const paperTrades = await prisma.paperTrade.findMany({
      where: { pair: { contains: 'AIA' } },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    console.log(`Found ${paperTrades.length} AIA paper trades\n`);

    for (const trade of paperTrades) {
      const pnl = parseFloat(trade.pnl);
      const pnlPercent = parseFloat(trade.pnlPercent);
      const currentPrice = trade.currentPrice || 'N/A';

      console.log(`Paper Trade:`);
      console.log(`  Pair: ${trade.pair}`);
      console.log(`  Status: ${trade.status}`);
      console.log(`  Entry: ${trade.entryPrice}`);
      console.log(`  Current: ${currentPrice}`);
      console.log(`  TP: ${trade.takeProfit}`);
      console.log(`  SL: ${trade.stopLoss}`);
      console.log(`  PnL: ${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
      console.log(`  Opened: ${trade.timestamp}`);
      console.log('');
    }

    // 2. Signals
    console.log('\n2. SIGNALS:');
    console.log('-'.repeat(70));
    const signals = await prisma.signal.findMany({
      where: { symbol: { contains: 'AIA' } },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`Found ${signals.length} AIA signals\n`);

    for (const signal of signals) {
      const currentPrice = signal.currentPrice || 'N/A';

      console.log(`Signal:`);
      console.log(`  Symbol: ${signal.symbol}`);
      console.log(`  Direction: ${signal.direction}`);
      console.log(`  Status: ${signal.status}`);
      console.log(`  Entry: ${signal.entryPrice}`);
      console.log(`  Current: ${currentPrice}`);
      console.log(`  TP: ${signal.takeProfit}`);
      console.log(`  SL: ${signal.stopLoss}`);
      console.log(`  Created: ${signal.createdAt}`);
      console.log('');
    }

    // 3. API Keys
    console.log('\n3. API KEYS:');
    console.log('-'.repeat(70));
    const apiKeys = await prisma.apiKey.findMany({});
    console.log(`Total API keys in database: ${apiKeys.length}`);

    for (const key of apiKeys) {
      console.log(`  ${key.exchange} - Active: ${key.isActive} - User: ${key.userId}`);
    }

    await prisma.$disconnect();

  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
})();
