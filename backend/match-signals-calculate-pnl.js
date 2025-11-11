const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function matchSignalsAndCalculatePnL() {
  try {
    console.log('💰 Matching signals and calculating P&L...\n');

    // Get all signals, sorted by createdAt (FIFO)
    const allSignals = await prisma.signal.findMany({
      where: {
        source: 'tradingview'
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        id: true,
        type: true,
        direction: true,
        symbol: true,
        entryPrice: true,
        exitPrice: true,
        status: true,
        profitLoss: true,
        rawText: true,
        createdAt: true
      }
    });

    console.log(`Processing ${allSignals.length} signals...`);

    // Group by strategy name
    const signalsByStrategy = {};

    for (const signal of allSignals) {
      let strategyName = null;
      if (signal.rawText) {
        const match = signal.rawText.match(/^([A-Z0-9]+)\{/);
        if (match) strategyName = match[1];
      }
      if (!strategyName) continue;

      if (!signalsByStrategy[strategyName]) {
        signalsByStrategy[strategyName] = [];
      }
      signalsByStrategy[strategyName].push(signal);
    }

    console.log(`\nGrouped into ${Object.keys(signalsByStrategy).length} strategies\n`);

    let totalMatched = 0;
    let totalPnLCalculated = 0;

    // Process each strategy
    for (const [strategyName, signals] of Object.entries(signalsByStrategy)) {
      // Group by symbol within strategy
      const bySymbol = {};
      for (const sig of signals) {
        if (!bySymbol[sig.symbol]) bySymbol[sig.symbol] = [];
        bySymbol[sig.symbol].push(sig);
      }

      // Match ENTRY-EXIT pairs for each symbol
      for (const [symbol, symbolSignals] of Object.entries(bySymbol)) {
        // Separate ENTRY and EXIT
        const entries = symbolSignals.filter(s => s.type === 'ENTRY');
        const exits = symbolSignals.filter(s => s.type === 'EXIT');

        // Track open positions (FIFO queue)
        const openPositions = [];

        // Process entries and exits in chronological order
        const allSorted = symbolSignals.sort((a, b) =>
          new Date(a.createdAt) - new Date(b.createdAt)
        );

        for (const signal of allSorted) {
          if (signal.type === 'ENTRY') {
            // Add to open positions
            openPositions.push(signal);
          } else if (signal.type === 'EXIT') {
            // Match with oldest ENTRY (FIFO)
            if (openPositions.length > 0) {
              const entrySignal = openPositions.shift(); // Remove first (oldest)

              // Calculate P&L
              if (entrySignal.entryPrice && signal.entryPrice) {
                let pnl = 0;

                if (entrySignal.direction === 'LONG') {
                  // Long position: profit = (exit - entry) / entry * 100
                  pnl = ((signal.entryPrice - entrySignal.entryPrice) / entrySignal.entryPrice) * 100;
                } else if (entrySignal.direction === 'SHORT') {
                  // Short position: profit = (entry - exit) / entry * 100
                  pnl = ((entrySignal.entryPrice - signal.entryPrice) / entrySignal.entryPrice) * 100;
                }

                // Subtract fees (0.05% entry + 0.05% exit = 0.1% total)
                pnl -= 0.1;

                // Update ENTRY signal with P&L
                await prisma.signal.update({
                  where: { id: entrySignal.id },
                  data: {
                    status: 'EXECUTED',
                    profitLoss: pnl,
                    exitPrice: signal.entryPrice
                  }
                });

                totalMatched++;
                totalPnLCalculated++;

                if (totalMatched % 100 === 0) {
                  console.log(`✅ Matched ${totalMatched} pairs...`);
                }
              }
            }
          }
        }
      }
    }

    console.log(`\n✅ Matching complete!`);
    console.log(`Total pairs matched: ${totalMatched}`);
    console.log(`Total P&L calculated: ${totalPnLCalculated}`);

    // Verification
    console.log('\n📊 Verification:');
    const withPnL = await prisma.signal.count({
      where: { profitLoss: { not: null } }
    });
    const executed = await prisma.signal.count({
      where: { status: 'EXECUTED' }
    });

    console.log(`Signals with P&L: ${withPnL}`);
    console.log(`Signals EXECUTED: ${executed}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

matchSignalsAndCalculatePnL();
