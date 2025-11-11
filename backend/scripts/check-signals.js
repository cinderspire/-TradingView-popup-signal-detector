const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🔍 CHECKING RECENT SIGNALS...\n');

  // Get recent signals
  const signals = await prisma.signal.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      source: true,
      type: true,
      direction: true,
      status: true,
      symbol: true,
      rawText: true,
      createdAt: true
    }
  });

  console.log(`Total signals: ${signals.length}\n`);

  // Group by type/direction
  const grouped = {};
  signals.forEach(s => {
    const key = `${s.type}-${s.direction}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  console.log('📊 SIGNAL BREAKDOWN:\n');
  Object.keys(grouped).sort().forEach(key => {
    console.log(`  ${key}: ${grouped[key].length} signals`);
  });

  console.log('\n📝 SAMPLE SIGNALS:\n');

  // Show 10 most recent
  signals.slice(0, 10).forEach(s => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`ID: ${s.id}`);
    console.log(`Type: ${s.type} | Direction: ${s.direction} | Status: ${s.status}`);
    console.log(`Symbol: ${s.symbol}`);
    console.log(`Created: ${s.createdAt.toISOString()}`);
    console.log(`Raw Text: ${s.rawText.substring(0, 300)}`);
  });

  // Check for patterns like "460 open position"
  console.log('\n\n🔍 CHECKING FOR OPEN POSITION PATTERNS:\n');
  const openPosSignals = signals.filter(s =>
    s.rawText && (
      s.rawText.includes('open position') ||
      s.rawText.includes('Open Position') ||
      s.rawText.includes('OPEN POSITION')
    )
  );

  console.log(`Found ${openPosSignals.length} signals with "open position" text\n`);
  openPosSignals.slice(0, 5).forEach(s => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Symbol: ${s.symbol}`);
    console.log(`Type: ${s.type} | Direction: ${s.direction}`);
    console.log(`Raw: ${s.rawText.substring(0, 300)}`);
  });

  await prisma.$disconnect();
})();
