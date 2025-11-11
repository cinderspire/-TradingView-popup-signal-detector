const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deepAnalyze7RSI() {
  try {
    console.log('🔬 DEEP ANALYSIS: 7RSI Strategy\n');
    console.log('=' .repeat(80));

    // Get all 7RSI signals
    const all7RSISignals = await prisma.signal.findMany({
      where: {
        rawText: { startsWith: '7RSI{' }
      },
      select: {
        id: true,
        type: true,
        status: true,
        profitLoss: true,
        direction: true,
        symbol: true,
        entryPrice: true,
        exitPrice: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`\n📊 Total 7RSI signals found: ${all7RSISignals.length}\n`);

    // Breakdown by type
    const entrySignals = all7RSISignals.filter(s => s.type === 'ENTRY');
    const exitSignals = all7RSISignals.filter(s => s.type === 'EXIT');

    console.log(`ENTRY signals: ${entrySignals.length}`);
    console.log(`EXIT signals: ${exitSignals.length}`);

    // Breakdown by status (ENTRY signals only)
    const pending = entrySignals.filter(s => s.status === 'PENDING').length;
    const active = entrySignals.filter(s => s.status === 'ACTIVE').length;
    const executed = entrySignals.filter(s => s.status === 'EXECUTED').length;

    console.log(`\nENTRY Signal Status:`);
    console.log(`  PENDING: ${pending}`);
    console.log(`  ACTIVE: ${active}`);
    console.log(`  EXECUTED: ${executed}`);

    // Get executed trades with P&L
    const executedWithPnL = entrySignals.filter(s =>
      s.status === 'EXECUTED' && s.profitLoss !== null
    );

    console.log(`\n💰 EXECUTED with P&L: ${executedWithPnL.length}`);

    if (executedWithPnL.length > 0) {
      // Calculate statistics
      const totalPnL = executedWithPnL.reduce((sum, s) => sum + s.profitLoss, 0);
      const avgPnL = totalPnL / executedWithPnL.length;

      const winning = executedWithPnL.filter(s => s.profitLoss > 0);
      const losing = executedWithPnL.filter(s => s.profitLoss < 0);

      const winRate = (winning.length / executedWithPnL.length) * 100;

      console.log(`\nTotal P&L: ${totalPnL.toFixed(2)}%`);
      console.log(`Average P&L per trade: ${avgPnL.toFixed(2)}%`);
      console.log(`\nWinning trades: ${winning.length}`);
      console.log(`Losing trades: ${losing.length}`);
      console.log(`Win Rate: ${winRate.toFixed(2)}%`);

      // Expected marketplace metrics
      console.log(`\n📊 EXPECTED MARKETPLACE METRICS:`);
      console.log(`Total ROI (sum): ${totalPnL.toFixed(2)}%`);
      console.log(`Closed Trades: ${executedWithPnL.length}`);
      console.log(`Active Signals: ${pending + active}`);
      console.log(`Win Rate: ${winRate.toFixed(2)}%`);

      // Distribution
      const winningSum = winning.reduce((sum, s) => sum + s.profitLoss, 0);
      const losingSum = losing.reduce((sum, s) => sum + s.profitLoss, 0);

      console.log(`\n💹 P&L Distribution:`);
      console.log(`Total from winning trades: +${winningSum.toFixed(2)}%`);
      console.log(`Total from losing trades: ${losingSum.toFixed(2)}%`);
      console.log(`Net: ${(winningSum + losingSum).toFixed(2)}%`);

      // Worst trades
      const worst = executedWithPnL.sort((a, b) => a.profitLoss - b.profitLoss).slice(0, 10);
      console.log(`\n📉 Worst 10 trades:`);
      worst.forEach((s, i) => {
        console.log(`  ${i+1}. ${s.symbol} ${s.direction}: ${s.profitLoss.toFixed(2)}% - ${s.createdAt.toISOString().slice(0,10)}`);
      });

      // Best trades
      const best = executedWithPnL.sort((a, b) => b.profitLoss - a.profitLoss).slice(0, 10);
      console.log(`\n📈 Best 10 trades:`);
      best.forEach((s, i) => {
        console.log(`  ${i+1}. ${s.symbol} ${s.direction}: ${s.profitLoss.toFixed(2)}% - ${s.createdAt.toISOString().slice(0,10)}`);
      });

      // Check for outliers
      console.log(`\n⚠️  OUTLIER ANALYSIS:`);
      const extremeLosses = executedWithPnL.filter(s => s.profitLoss < -20);
      const extremeGains = executedWithPnL.filter(s => s.profitLoss > 20);

      console.log(`Extreme losses (< -20%): ${extremeLosses.length}`);
      if (extremeLosses.length > 0) {
        console.log('Sample extreme losses:');
        extremeLosses.slice(0, 5).forEach(s => {
          console.log(`  ${s.symbol}: ${s.profitLoss.toFixed(2)}% (Entry: ${s.entryPrice}, Exit: ${s.exitPrice})`);
        });
      }

      console.log(`\nExtreme gains (> 20%): ${extremeGains.length}`);
      if (extremeGains.length > 0) {
        console.log('Sample extreme gains:');
        extremeGains.slice(0, 5).forEach(s => {
          console.log(`  ${s.symbol}: ${s.profitLoss.toFixed(2)}% (Entry: ${s.entryPrice}, Exit: ${s.exitPrice})`);
        });
      }

      // Duplicate check
      console.log(`\n🔍 DUPLICATE CHECK:`);
      const duplicates = new Map();
      executedWithPnL.forEach(s => {
        const key = `${s.symbol}_${s.entryPrice}_${s.exitPrice}_${s.profitLoss}`;
        if (!duplicates.has(key)) {
          duplicates.set(key, []);
        }
        duplicates.get(key).push(s.id);
      });

      const dupes = Array.from(duplicates.entries()).filter(([k, v]) => v.length > 1);
      console.log(`Found ${dupes.length} duplicate trade patterns`);
      if (dupes.length > 0) {
        console.log('Top 5 duplicates:');
        dupes.slice(0, 5).forEach(([key, ids]) => {
          const [symbol, entry, exit, pnl] = key.split('_');
          console.log(`  ${symbol}: ${ids.length}x duplicates, P&L: ${pnl}%`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deepAnalyze7RSI();
