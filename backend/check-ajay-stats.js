const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const ajaySignals = await prisma.signal.findMany({
      where: { rawText: { startsWith: 'AJAY{' } },
      select: { type: true, status: true, profitLoss: true }
    });

    const byType = {};
    ajaySignals.forEach(s => {
      if (!byType[s.type]) byType[s.type] = { total: 0, executed: 0, pending: 0 };
      byType[s.type].total++;
      if (s.status === 'EXECUTED') byType[s.type].executed++;
      if (s.status === 'PENDING') byType[s.type].pending++;
    });

    const executed = ajaySignals.filter(s => s.status === 'EXECUTED' && s.type === 'ENTRY' && s.profitLoss !== null);
    const totalPnL = executed.reduce((sum, s) => sum + s.profitLoss, 0);
    const winning = executed.filter(s => s.profitLoss > 0).length;
    const winRate = (winning / executed.length) * 100;

    console.log('🎯 AJAY Strategy - Updated Stats:\n');
    console.log('Total signals:', ajaySignals.length);
    console.log('\nBy Type:');
    Object.entries(byType).forEach(([type, stats]) => {
      console.log(`  ${type}: ${stats.total} (Executed: ${stats.executed}, Pending: ${stats.pending})`);
    });

    console.log(`\n💰 Performance:`);
    console.log(`  Closed Trades: ${executed.length}`);
    console.log(`  Total ROI: ${totalPnL.toFixed(2)}%`);
    console.log(`  Win Rate: ${winRate.toFixed(2)}%`);
    console.log(`  Winning: ${winning} | Losing: ${executed.length - winning}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
