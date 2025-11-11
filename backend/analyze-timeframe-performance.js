const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Extract timeframe from signal rawText
function extractTimeframe(rawText) {
  if (!rawText) return 'unknown';

  // Try to extract timeframe from various formats
  // Format 1: "AJAY{...}BTCUSDT.P, 1h" or "7RSI{...}, 15m"
  const timeframeMatch = rawText.match(/,\s*(\d+[mhd]|1\s*day)/i);
  if (timeframeMatch) {
    let tf = timeframeMatch[1].trim().toLowerCase();
    if (tf === '1 day') tf = '1d';
    return tf;
  }

  // Format 2: Inside JSON {"timeframe": "1h"}
  try {
    const jsonStart = rawText.indexOf('{');
    const jsonEnd = rawText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = rawText.substring(jsonStart, jsonEnd + 1);
      const data = JSON.parse(jsonStr);
      if (data.timeframe) return data.timeframe.toLowerCase();
    }
  } catch (e) {
    // Ignore parse errors
  }

  return 'unknown';
}

// Calculate PnL percentage
function calculatePnL(entry, exit, direction) {
  if (!entry || !exit || entry <= 0 || exit <= 0) return 0;

  const fee = 0.1; // 0.1% trading fee

  if (direction === 'LONG') {
    return ((exit - entry) / entry * 100) - fee;
  } else if (direction === 'SHORT') {
    return ((entry - exit) / entry * 100) - fee;
  }

  return 0;
}

async function analyzeTimeframePerformance() {
  console.log('📊 ANALYZING LAST 1500 TRADINGVIEW SIGNALS BY TIMEFRAME\n');

  try {
    // Fetch last 1500 TradingView signals
    console.log('Fetching signals from database...');
    const signals = await prisma.signal.findMany({
      where: {
        source: 'tradingview'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1500,
      select: {
        id: true,
        symbol: true,
        type: true,
        direction: true,
        entryPrice: true,
        exitPrice: true,
        stopLoss: true,
        takeProfit: true,
        status: true,
        profitLoss: true,
        profitLossAmount: true,
        createdAt: true,
        closedAt: true,
        rawText: true
      }
    });

    console.log(`✅ Fetched ${signals.length} signals\n`);

    // Initialize timeframe stats
    const timeframes = {};
    const allTimeframeStats = {
      name: 'all1',
      totalSignals: 0,
      entrySignals: 0,
      exitSignals: 0,
      closedTrades: 0,
      openPositions: 0,
      closedPnL: 0,
      openPnL: 0,
      wins: 0,
      losses: 0,
      symbols: new Set()
    };

    // Process each signal
    for (const signal of signals) {
      const timeframe = extractTimeframe(signal.rawText);

      // Initialize timeframe if not exists
      if (!timeframes[timeframe]) {
        timeframes[timeframe] = {
          name: timeframe,
          totalSignals: 0,
          entrySignals: 0,
          exitSignals: 0,
          closedTrades: 0,
          openPositions: 0,
          closedPnL: 0,
          openPnL: 0,
          wins: 0,
          losses: 0,
          symbols: new Set()
        };
      }

      const tf = timeframes[timeframe];

      // Count signals
      tf.totalSignals++;
      allTimeframeStats.totalSignals++;

      if (signal.type === 'ENTRY') {
        tf.entrySignals++;
        allTimeframeStats.entrySignals++;
      } else if (signal.type === 'EXIT') {
        tf.exitSignals++;
        allTimeframeStats.exitSignals++;
      }

      // Track symbols
      tf.symbols.add(signal.symbol);
      allTimeframeStats.symbols.add(signal.symbol);

      // Calculate PnL for closed trades
      // NOTE: status can never be 'CLOSED' because it's not in the enum!
      // Instead, check if closedAt timestamp is set
      if (signal.type === 'ENTRY' && signal.closedAt && signal.exitPrice) {
        tf.closedTrades++;
        allTimeframeStats.closedTrades++;

        let pnl = signal.profitLoss || 0;

        // If profitLoss is not set, calculate it
        if (pnl === 0 && signal.entryPrice && signal.exitPrice) {
          pnl = calculatePnL(signal.entryPrice, signal.exitPrice, signal.direction);
        }

        tf.closedPnL += pnl;
        allTimeframeStats.closedPnL += pnl;

        if (pnl > 0) {
          tf.wins++;
          allTimeframeStats.wins++;
        } else {
          tf.losses++;
          allTimeframeStats.losses++;
        }
      }
      // Calculate PnL for open positions
      else if (signal.type === 'ENTRY' && !signal.closedAt) {
        tf.openPositions++;
        allTimeframeStats.openPositions++;

        // Try to calculate current PnL if we have entry price
        if (signal.entryPrice && signal.entryPrice > 0) {
          // For now, use stored profitLoss if available
          // In real system, you'd fetch current price and calculate
          const pnl = signal.profitLoss || 0;
          tf.openPnL += pnl;
          allTimeframeStats.openPnL += pnl;
        }
      }
    }

    // Print results
    console.log('='*80);
    console.log('📊 TIMEFRAME PERFORMANCE ANALYSIS');
    console.log('='*80 + '\n');

    // Sort timeframes by performance
    const sortedTimeframes = Object.values(timeframes)
      .sort((a, b) => {
        const aCombined = a.closedPnL + a.openPnL;
        const bCombined = b.closedPnL + b.openPnL;
        return bCombined - aCombined;
      });

    // Print each timeframe
    for (const tf of sortedTimeframes) {
      const combinedPnL = tf.closedPnL + tf.openPnL;
      const winRate = tf.closedTrades > 0 ? (tf.wins / tf.closedTrades * 100).toFixed(1) : 0;

      console.log(`\n📈 TIMEFRAME: ${tf.name.toUpperCase()}`);
      console.log('-'.repeat(60));
      console.log(`Total Signals: ${tf.totalSignals} (${tf.entrySignals} ENTRY, ${tf.exitSignals} EXIT)`);
      console.log(`Closed Trades: ${tf.closedTrades} (${tf.wins} wins, ${tf.losses} losses)`);
      console.log(`Open Positions: ${tf.openPositions}`);
      console.log(`Win Rate: ${winRate}%`);
      console.log(`Closed PnL: ${tf.closedPnL > 0 ? '+' : ''}${tf.closedPnL.toFixed(2)}%`);
      console.log(`Open PnL: ${tf.openPnL > 0 ? '+' : ''}${tf.openPnL.toFixed(2)}%`);
      console.log(`Combined PnL: ${combinedPnL > 0 ? '+' : ''}${combinedPnL.toFixed(2)}%`);
      console.log(`Unique Symbols: ${tf.symbols.size}`);
    }

    // Print ALL1 aggregate
    const all1Combined = allTimeframeStats.closedPnL + allTimeframeStats.openPnL;
    const all1WinRate = allTimeframeStats.closedTrades > 0
      ? (allTimeframeStats.wins / allTimeframeStats.closedTrades * 100).toFixed(1)
      : 0;

    console.log('\n' + '='*80);
    console.log('📊 ALL1 (AGGREGATE OF ALL TIMEFRAMES)');
    console.log('='*80);
    console.log(`Total Signals: ${allTimeframeStats.totalSignals} (${allTimeframeStats.entrySignals} ENTRY, ${allTimeframeStats.exitSignals} EXIT)`);
    console.log(`Closed Trades: ${allTimeframeStats.closedTrades} (${allTimeframeStats.wins} wins, ${allTimeframeStats.losses} losses)`);
    console.log(`Open Positions: ${allTimeframeStats.openPositions}`);
    console.log(`Win Rate: ${all1WinRate}%`);
    console.log(`Closed PnL: ${allTimeframeStats.closedPnL > 0 ? '+' : ''}${allTimeframeStats.closedPnL.toFixed(2)}%`);
    console.log(`Open PnL: ${allTimeframeStats.openPnL > 0 ? '+' : ''}${allTimeframeStats.openPnL.toFixed(2)}%`);
    console.log(`Combined PnL: ${all1Combined > 0 ? '+' : ''}${all1Combined.toFixed(2)}%`);
    console.log(`Unique Symbols: ${allTimeframeStats.symbols.size}`);
    console.log('='*80);

    // Compare with provided report
    console.log('\n\n🔍 COMPARISON WITH PROVIDED REPORT:');
    console.log('='*80);
    console.log('\nProvided Report Claims (all1):');
    console.log('  Combined PnL: +614.82%');
    console.log('  Closed Profit: +1,085.77%');
    console.log('  Open Losses: -470.95%');
    console.log('  Open Positions: 987');

    console.log('\nOur Analysis (all1):');
    console.log(`  Combined PnL: ${all1Combined > 0 ? '+' : ''}${all1Combined.toFixed(2)}%`);
    console.log(`  Closed Profit: ${allTimeframeStats.closedPnL > 0 ? '+' : ''}${allTimeframeStats.closedPnL.toFixed(2)}%`);
    console.log(`  Open PnL: ${allTimeframeStats.openPnL > 0 ? '+' : ''}${allTimeframeStats.openPnL.toFixed(2)}%`);
    console.log(`  Open Positions: ${allTimeframeStats.openPositions}`);

    const pnlDiff = Math.abs(all1Combined - 614.82);
    const closedDiff = Math.abs(allTimeframeStats.closedPnL - 1085.77);
    const openDiff = Math.abs(allTimeframeStats.openPnL - (-470.95));

    console.log('\nDifferences:');
    console.log(`  Combined PnL Diff: ${pnlDiff.toFixed(2)}%`);
    console.log(`  Closed PnL Diff: ${closedDiff.toFixed(2)}%`);
    console.log(`  Open PnL Diff: ${openDiff.toFixed(2)}%`);
    console.log(`  Open Positions Diff: ${Math.abs(allTimeframeStats.openPositions - 987)}`);

    if (pnlDiff > 50 || closedDiff > 100 || openDiff > 100) {
      console.log('\n⚠️ WARNING: SIGNIFICANT DISCREPANCIES DETECTED!');
      console.log('Possible issues:');
      console.log('  1. PnL calculations may be incorrect in database');
      console.log('  2. Closed trades may not be properly marked');
      console.log('  3. Open positions may not have current PnL calculated');
      console.log('  4. Signal matching (ENTRY-EXIT pairs) may have issues');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeTimeframePerformance();
