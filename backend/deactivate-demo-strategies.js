const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deactivateDemoStrategies() {
  try {
    console.log('🔧 Deactivating demo strategies...\n');

    // Deactivate demo strategies
    const result = await prisma.strategy.updateMany({
      where: {
        OR: [
          { name: '3RSI Scalping Strategy' },
          { name: '7RSI Momentum Strategy' },
          { name: 'MACD Crossover Strategy' }
        ]
      },
      data: {
        isActive: false,
        isPublic: false
      }
    });

    console.log(`✅ Deactivated ${result.count} demo strategies\n`);

    // Verify
    const active = await prisma.strategy.findMany({
      where: { isActive: true, isPublic: true },
      select: { name: true, providerId: true }
    });

    console.log(`✅ Active public strategies: ${active.length}`);
    active.forEach((s, i) => {
      console.log(`  ${i+1}. ${s.name} (Provider: ${s.providerId})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deactivateDemoStrategies();
