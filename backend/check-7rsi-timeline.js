const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Count 7RSI signals by date
    const signals = await prisma.signal.findMany({
      where: { rawText: { startsWith: '7RSI{' } },
      select: { createdAt: true, type: true, status: true }
    });

    console.log('📅 7RSI Signal Timeline:\n');
    console.log(`Total signals: ${signals.length}`);

    // Group by date
    const byDate = {};
    signals.forEach(s => {
      const date = s.createdAt.toISOString().slice(0, 10);
      if (!byDate[date]) byDate[date] = { entry: 0, exit: 0, total: 0 };
      if (s.type === 'ENTRY') byDate[date].entry++;
      else byDate[date].exit++;
      byDate[date].total++;
    });

    // Last 10 days
    const dates = Object.keys(byDate).sort().reverse().slice(0, 10);
    console.log('\nLast 10 days:');
    dates.forEach(date => {
      const d = byDate[date];
      console.log(`  ${date}: ${d.total} total (${d.entry} ENTRY, ${d.exit} EXIT)`);
    });

    // 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30Days = signals.filter(s => s.createdAt >= thirtyDaysAgo);

    console.log(`\nLast 30 days: ${last30Days.length} signals`);
    console.log(`Before 30 days: ${signals.length - last30Days.length} signals (not shown in marketplace)`);

    // Check if marketplace only shows last 30 days
    console.log('\n⚠️  IMPORTANT:');
    console.log('Marketplace API filters signals from last 30 days only.');
    console.log(`This means ${signals.length - last30Days.length} older signals are excluded.`);

    await prisma.$disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
