const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateReport() {
  try {
    console.log('📊 PERFORMANCE REPORT - Top 10 Strategies & Top 10 Pairs\n');
    console.log('=' .repeat(80));

    // Get all signals from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const allSignals = await prisma.signal.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        id: true,
        source: true,
        rawText: true,
        type: true,
        status: true,
        profitLoss: true,
        direction: true,
        symbol: true,
        entryPrice: true,
        exitPrice: true,
        createdAt: true
      }
    });

    console.log(`📈 Analyzing ${allSignals.length} signals from last 30 days...\n`);

    // Strategy names from TradingView
    const strategyNames = ['3RSI', '7RSI', 'AJAY', 'AMF', 'AUTOGRID', 'COW', 'FLUXGATE', 'GRID', 'MTB', 'MTF', 'POINT', 'TURTLE', 'XAU5M', 'ZP'];

    // Calculate metrics for each strategy
    const strategyMetrics = {};
    const pairMetrics = {};

    for (const signal of allSignals) {
      let strategyName = null;

      // Extract strategy name from rawText
      if (signal.rawText) {
        const match = signal.rawText.match(/^([A-Z0-9]+)\{/);
        if (match) {
          strategyName = match[1];
        }
      }

      if (!strategyName) continue;

      // Initialize strategy metrics
      if (!strategyMetrics[strategyName]) {
        strategyMetrics[strategyName] = {
          totalSignals: 0,
          entrySignals: 0,
          closedTrades: 0,
          activeTrades: 0,
          totalPnL: 0,
          winningTrades: 0,
          losingTrades: 0,
          pairBreakdown: {}
        };
      }

      const metrics = strategyMetrics[strategyName];
      metrics.totalSignals++;

      if (signal.type === 'ENTRY') {
        metrics.entrySignals++;

        if (signal.status === 'EXECUTED' && signal.profitLoss !== null) {
          metrics.closedTrades++;
          metrics.totalPnL += signal.profitLoss;

          if (signal.profitLoss > 0) {
            metrics.winningTrades++;
          } else if (signal.profitLoss < 0) {
            metrics.losingTrades++;
          }
        } else if (signal.status === 'ACTIVE' || signal.status === 'PENDING') {
          metrics.activeTrades++;
        }
      }

      // Track pair performance
      if (signal.symbol) {
        if (!pairMetrics[signal.symbol]) {
          pairMetrics[signal.symbol] = {
            totalSignals: 0,
            closedTrades: 0,
            totalPnL: 0,
            winningTrades: 0,
            strategies: new Set()
          };
        }

        const pairM = pairMetrics[signal.symbol];
        pairM.totalSignals++;
        pairM.strategies.add(strategyName);

        if (signal.type === 'ENTRY' && signal.status === 'EXECUTED' && signal.profitLoss !== null) {
          pairM.closedTrades++;
          pairM.totalPnL += signal.profitLoss;
          if (signal.profitLoss > 0) pairM.winningTrades++;
        }

        // Track pair performance within strategy
        if (!metrics.pairBreakdown[signal.symbol]) {
          metrics.pairBreakdown[signal.symbol] = {
            signals: 0,
            closedTrades: 0,
            pnl: 0
          };
        }
        metrics.pairBreakdown[signal.symbol].signals++;
        if (signal.type === 'ENTRY' && signal.status === 'EXECUTED' && signal.profitLoss !== null) {
          metrics.pairBreakdown[signal.symbol].closedTrades++;
          metrics.pairBreakdown[signal.symbol].pnl += signal.profitLoss;
        }
      }
    }

    // Calculate win rates and sort strategies
    const strategyResults = Object.entries(strategyMetrics).map(([name, m]) => ({
      name,
      totalSignals: m.totalSignals,
      closedTrades: m.closedTrades,
      activeTrades: m.activeTrades,
      totalROI: m.totalPnL,
      avgROI: m.closedTrades > 0 ? m.totalPnL / m.closedTrades : 0,
      winRate: m.closedTrades > 0 ? (m.winningTrades / m.closedTrades * 100) : 0,
      pairBreakdown: m.pairBreakdown
    })).sort((a, b) => b.totalROI - a.totalROI);

    // Sort pairs
    const pairResults = Object.entries(pairMetrics).map(([pair, m]) => ({
      pair,
      totalSignals: m.totalSignals,
      closedTrades: m.closedTrades,
      totalROI: m.totalPnL,
      avgROI: m.closedTrades > 0 ? m.totalPnL / m.closedTrades : 0,
      winRate: m.closedTrades > 0 ? (m.winningTrades / m.closedTrades * 100) : 0,
      strategiesCount: m.strategies.size
    })).sort((a, b) => b.totalROI - a.totalROI);

    // Print Top 10 Strategies
    console.log('\n🏆 TOP 10 STRATEGIES (by Total ROI)\n');
    console.log('Rank | Strategy    | Signals | Closed | Active | Total ROI | Avg ROI | Win Rate');
    console.log('-'.repeat(80));

    strategyResults.slice(0, 10).forEach((s, i) => {
      console.log(
        `${(i+1).toString().padStart(2)}   | ` +
        `${s.name.padEnd(11)} | ` +
        `${s.totalSignals.toString().padStart(7)} | ` +
        `${s.closedTrades.toString().padStart(6)} | ` +
        `${s.activeTrades.toString().padStart(6)} | ` +
        `${s.totalROI.toFixed(2).padStart(9)}% | ` +
        `${s.avgROI.toFixed(2).padStart(7)}% | ` +
        `${s.winRate.toFixed(1).padStart(7)}%`
      );
    });

    // Print Top 10 Pairs
    console.log('\n\n🏆 TOP 10 PAIRS (by Total ROI)\n');
    console.log('Rank | Pair          | Signals | Closed | Total ROI | Avg ROI | Win Rate | Strategies');
    console.log('-'.repeat(80));

    pairResults.slice(0, 10).forEach((p, i) => {
      console.log(
        `${(i+1).toString().padStart(2)}   | ` +
        `${p.pair.padEnd(13)} | ` +
        `${p.totalSignals.toString().padStart(7)} | ` +
        `${p.closedTrades.toString().padStart(6)} | ` +
        `${p.totalROI.toFixed(2).padStart(9)}% | ` +
        `${p.avgROI.toFixed(2).padStart(7)}% | ` +
        `${p.winRate.toFixed(1).padStart(7)}% | ` +
        `${p.strategiesCount.toString().padStart(10)}`
      );
    });

    // Detailed breakdown for top 3 strategies
    console.log('\n\n📊 DETAILED BREAKDOWN - Top 3 Strategies by Pair\n');
    console.log('='.repeat(80));

    strategyResults.slice(0, 3).forEach((strategy, idx) => {
      console.log(`\n${idx + 1}. ${strategy.name} (Total ROI: ${strategy.totalROI.toFixed(2)}%)`);
      console.log('-'.repeat(80));
      console.log('   Pair          | Signals | Closed | Total ROI | Avg ROI');
      console.log('   ' + '-'.repeat(76));

      const pairsSorted = Object.entries(strategy.pairBreakdown)
        .map(([pair, data]) => ({
          pair,
          signals: data.signals,
          closedTrades: data.closedTrades,
          totalROI: data.pnl,
          avgROI: data.closedTrades > 0 ? data.pnl / data.closedTrades : 0
        }))
        .sort((a, b) => b.totalROI - a.totalROI)
        .slice(0, 10);

      pairsSorted.forEach(p => {
        console.log(
          `   ${p.pair.padEnd(13)} | ` +
          `${p.signals.toString().padStart(7)} | ` +
          `${p.closedTrades.toString().padStart(6)} | ` +
          `${p.totalROI.toFixed(2).padStart(9)}% | ` +
          `${p.avgROI.toFixed(2).padStart(7)}%`
        );
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Report generation complete!\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateReport();
