const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🔍 SEARCHING FOR MISSING STRATEGIES IN DATABASE:\n');

    // Get ALL signals to see all strategy names
    const allSignals = await prisma.signal.findMany({
      where: {
        rawText: { not: null }
      },
      select: {
        rawText: true,
        source: true,
        createdAt: true
      }
    });

    console.log(`Total signals to analyze: ${allSignals.length}\n`);

    const strategyStats = new Map();

    for (const signal of allSignals) {
      // Try multiple extraction patterns
      let stratName = null;

      // Pattern 1: Traditional (uppercase only, before {)
      let match = signal.rawText.match(/^([A-Z0-9]+)\{/);
      if (match) {
        stratName = match[1];
      } else {
        // Pattern 2: With spaces and mixed case (e.g., "YJ V2{")
        match = signal.rawText.match(/^([A-Z][A-Za-z0-9 ]+?)[\{:]/);
        if (match) {
          stratName = match[1].trim();
        } else {
          // Pattern 3: Anything before { or :
          match = signal.rawText.match(/^([^\{:]+)[\{:]/);
          if (match) {
            stratName = match[1].trim();
          }
        }
      }

      if (stratName) {
        if (!strategyStats.has(stratName)) {
          strategyStats.set(stratName, {
            name: stratName,
            count: 0,
            source: signal.source,
            sample: signal.rawText.substring(0, 120)
          });
        }
        strategyStats.get(stratName).count++;
      }
    }

    const sorted = Array.from(strategyStats.values()).sort((a, b) => b.count - a.count);

    console.log('📊 ALL STRATEGIES FOUND (ALL SOURCES, ALL PATTERNS):');
    console.log('='.repeat(100));
    console.log(`Total Unique Strategies: ${sorted.length}`);
    console.log('='.repeat(100));

    sorted.forEach((s, i) => {
      console.log(`${(i+1).toString().padStart(3)}. ${s.name.padEnd(30)} | Count: ${s.count.toString().padStart(6)} | Source: ${s.source}`);
    });

    // Search specifically for mentioned strategies
    console.log('\n\n🎯 SEARCHING FOR USER-MENTIONED STRATEGIES:');
    console.log('='.repeat(100));

    const searchTerms = ['YJ', 'V2', 'MAC', 'MEAN', 'REVERS'];
    const found = sorted.filter(s =>
      searchTerms.some(term => s.name.toUpperCase().includes(term))
    );

    if (found.length > 0) {
      console.log('✅ FOUND IN DATABASE:');
      found.forEach(s => {
        console.log(`\n   Strategy: ${s.name}`);
        console.log(`   Signals: ${s.count}`);
        console.log(`   Source: ${s.source}`);
        console.log(`   Sample rawText: ${s.sample}...`);
      });
    } else {
      console.log('❌ NOT FOUND in database with current patterns');
    }

    // Check sources
    console.log('\n\n📊 SIGNALS BY SOURCE:');
    const sourceStats = {};
    allSignals.forEach(s => {
      sourceStats[s.source] = (sourceStats[s.source] || 0) + 1;
    });
    Object.entries(sourceStats).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} signals`);
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
