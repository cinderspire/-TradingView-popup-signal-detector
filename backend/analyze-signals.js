const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeSignals() {
  try {
    console.log('📊 Analyzing TradingView signals...\n');

    // Count total TradingView signals
    const totalSignals = await prisma.signal.count({
      where: { source: 'tradingview' }
    });
    console.log(`Total TradingView signals: ${totalSignals}`);

    // Count signals with rawText
    const signalsWithRawText = await prisma.signal.count({
      where: {
        source: 'tradingview',
        rawText: { not: null }
      }
    });
    console.log(`Signals with rawText: ${signalsWithRawText}`);

    // Get 20 sample signals to see the format
    console.log('\n📝 Sample rawText formats:');
    const samples = await prisma.signal.findMany({
      where: {
        source: 'tradingview',
        rawText: { not: null }
      },
      select: { rawText: true },
      take: 20,
      orderBy: { createdAt: 'desc' }
    });

    samples.forEach((s, i) => {
      console.log(`${i+1}. ${s.rawText.substring(0, 100)}...`);
    });

    // Extract unique strategy names
    console.log('\n🔍 Extracting unique strategy names...');
    const uniqueNames = new Set();
    const batchSize = 5000;
    let processed = 0;
    let skip = 0;

    while (true) {
      const batch = await prisma.signal.findMany({
        where: {
          source: 'tradingview',
          rawText: { not: null }
        },
        select: { rawText: true },
        skip,
        take: batchSize
      });

      if (batch.length === 0) break;

      for (const signal of batch) {
        if (signal.rawText) {
          const match = signal.rawText.match(/^([A-Z0-9]+)\{/);
          if (match) {
            uniqueNames.add(match[1]);
          }
        }
      }

      processed += batch.length;
      skip += batchSize;
      console.log(`  Processed ${processed} signals, found ${uniqueNames.size} unique strategies...`);

      if (skip > 100000) break; // Safety
    }

    console.log(`\n✅ Total unique strategy names found: ${uniqueNames.size}`);
    console.log('\n📋 Strategy names:');
    const sortedNames = Array.from(uniqueNames).sort();
    sortedNames.forEach((name, i) => {
      console.log(`${i+1}. ${name}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeSignals();
