const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStrategies() {
  try {
    console.log('📊 Checking database strategies...\n');

    const strategies = await prisma.strategy.findMany({
      select: {
        id: true,
        name: true,
        isPublic: true,
        isActive: true
      }
    });

    console.log(`Found ${strategies.length} strategies in database:`);
    strategies.forEach((s, i) => {
      console.log(`${i+1}. ${s.name} (${s.id}) - Public: ${s.isPublic}, Active: ${s.isActive}`);
    });

    console.log('\n✅ Summary:');
    console.log(`- Database strategies: ${strategies.length}`);
    console.log(`- Unique TradingView signal names: 14`);
    console.log(`- Expected total in marketplace: ${strategies.length} DB + ${14 - strategies.filter(s => ['3RSI', '7RSI', 'AJAY', 'AMF', 'AUTOGRID', 'COW', 'FLUXGATE', 'GRID', 'MTB', 'MTF', 'POINT', 'TURTLE', 'XAU5M', 'ZP'].includes(s.name)).length} virtual`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStrategies();
