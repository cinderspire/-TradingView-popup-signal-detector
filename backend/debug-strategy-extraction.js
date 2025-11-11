const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugExtraction() {
  console.log('🔍 Debugging strategy name extraction...\n');

  // Get one EXIT signal
  const exit = await prisma.signal.findFirst({
    where: {
      symbol: 'ARUSDT.P',
      rawText: { contains: '3RSI' },
      type: 'EXIT'
    }
  });

  // Get one ENTRY signal
  const entry = await prisma.signal.findFirst({
    where: {
      symbol: 'ARUSDT.P',
      rawText: { contains: '3RSI' },
      type: 'ENTRY',
      status: { in: ['ACTIVE', 'PENDING'] }
    }
  });

  console.log('=== EXIT SIGNAL ===');
  console.log('RawText:', exit.rawText);
  console.log('\nExtraction logic:');
  const exitSymbol = exit.symbol;
  const exitBeforeBrace = exit.rawText.split('{')[0];
  console.log('1. Before {:', exitBeforeBrace);
  const exitStep1 = exitBeforeBrace.replace(/^Alert on /i, '');
  console.log('2. Remove "Alert on":', exitStep1);
  const exitStep2 = exitStep1.replace(new RegExp(exitSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  console.log('3. Remove symbol:', exitStep2);
  const exitStep3 = exitStep2.replace(/[^A-Za-z0-9 ]/g, '');
  console.log('4. Remove special chars:', exitStep3);
  const exitFinal = exitStep3.trim();
  console.log('5. Final strategy name:', exitFinal);

  console.log('\n=== ENTRY SIGNAL ===');
  console.log('RawText:', entry.rawText);
  console.log('\nExtraction logic:');
  const entrySymbol = entry.symbol;
  const entryBeforeBrace = entry.rawText.split('{')[0];
  console.log('1. Before {:', entryBeforeBrace);
  const entryStep1 = entryBeforeBrace.replace(/^Alert on /i, '');
  console.log('2. Remove "Alert on":', entryStep1);
  const entryStep2 = entryStep1.replace(new RegExp(entrySymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  console.log('3. Remove symbol:', entryStep2);
  const entryStep3 = entryStep2.replace(/[^A-Za-z0-9 ]/g, '');
  console.log('4. Remove special chars:', entryStep3);
  const entryFinal = entryStep3.trim();
  console.log('5. Final strategy name:', entryFinal);

  console.log('\n=== QUERY TEST ===');
  console.log(`Looking for ENTRY signals with rawText.startsWith("${entryFinal}")...\n`);

  const matchingEntries = await prisma.signal.findMany({
    where: {
      symbol: 'ARUSDT.P',
      type: 'ENTRY',
      status: { in: ['ACTIVE', 'PENDING'] },
      rawText: { startsWith: entryFinal }
    },
    take: 3
  });

  console.log(`Found ${matchingEntries.length} matching ENTRY signals`);
  matchingEntries.forEach(e => {
    console.log(`  - ID: ${e.id}, Created: ${e.createdAt.toISOString()}`);
    console.log(`    RawText: ${e.rawText.substring(0, 80)}...`);
  });

  await prisma.$disconnect();
}

debugExtraction().catch(console.error);
