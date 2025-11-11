const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSignals() {
  console.log('\n🔍 COMPREHENSIVE SIGNAL MECHANISM CHECK\n');
  console.log('='.repeat(70));

  try {
    // 1. Total signals
    const total = await prisma.signal.count();
    console.log(`\n📊 Total Signals in DB: ${total}`);

    // 2. Signal type distribution
    console.log('\n📋 Signal Type Distribution:');
    const types = await prisma.signal.groupBy({
      by: ['type'],
      _count: { type: true }
    });
    types.forEach(t => console.log(`   ${t.type}: ${t._count.type}`));

    // 3. Signal status distribution
    console.log('\n📊 Signal Status Distribution:');
    const statuses = await prisma.signal.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    statuses.forEach(s => console.log(`   ${s.status}: ${s._count.status}`));

    // 4. Last 10 signals
    console.log('\n📜 Last 10 Signals:');
    const recent = await prisma.signal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        status: true,
        symbol: true,
        direction: true,
        entryPrice: true,
        exitPrice: true,
        profitLoss: true,
        createdAt: true,
        closedAt: true
      }
    });
    recent.forEach((s, i) => {
      console.log(`\n   ${i+1}. ${s.symbol} ${s.direction} ${s.type} - ${s.status}`);
      console.log(`      Entry: ${s.entryPrice || 'N/A'} | Exit: ${s.exitPrice || 'N/A'}`);
      if (s.profitLoss) console.log(`      P&L: ${s.profitLoss.toFixed(2)}%`);
      console.log(`      Created: ${s.createdAt.toLocaleString()}`);
      if (s.closedAt) console.log(`      Closed: ${s.closedAt.toLocaleString()}`);
    });

    // 5. Active ENTRY signals (open positions)
    console.log('\n\n🟢 Active ENTRY Signals (Open Positions):');
    const activeEntries = await prisma.signal.findMany({
      where: {
        type: 'ENTRY',
        closedAt: null,
        status: { in: ['PENDING', 'ACTIVE', 'EXECUTED'] }
      },
      select: {
        symbol: true,
        direction: true,
        entryPrice: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`   Total Open Positions: ${activeEntries.length}`);
    activeEntries.slice(0, 5).forEach((s, i) => {
      console.log(`   ${i+1}. ${s.symbol} ${s.direction} @ ${s.entryPrice} - ${s.status}`);
      console.log(`      Opened: ${s.createdAt.toLocaleString()}`);
    });

    // 6. Recently closed positions with P&L
    console.log('\n\n💰 Recently Closed Positions (Last 10):');
    const closedPositions = await prisma.signal.findMany({
      where: {
        type: 'ENTRY',
        closedAt: { not: null },
        profitLoss: { not: null }
      },
      orderBy: { closedAt: 'desc' },
      take: 10,
      select: {
        symbol: true,
        direction: true,
        entryPrice: true,
        exitPrice: true,
        profitLoss: true,
        closedAt: true
      }
    });
    closedPositions.forEach((s, i) => {
      const emoji = s.profitLoss > 0 ? '✅' : '❌';
      console.log(`\n   ${emoji} ${i+1}. ${s.symbol} ${s.direction}`);
      console.log(`      Entry: ${s.entryPrice} → Exit: ${s.exitPrice}`);
      console.log(`      P&L: ${s.profitLoss.toFixed(2)}%`);
      console.log(`      Closed: ${s.closedAt.toLocaleString()}`);
    });

    // 7. Signals from last hour
    console.log('\n\n⏰ Signals from Last Hour:');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const lastHour = await prisma.signal.findMany({
      where: {
        createdAt: { gte: oneHourAgo }
      },
      select: {
        type: true,
        symbol: true,
        direction: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`   Count: ${lastHour.length}`);
    lastHour.forEach((s, i) => {
      console.log(`   ${i+1}. ${s.createdAt.toLocaleTimeString()} - ${s.symbol} ${s.direction} ${s.type}`);
    });

    // 8. Signal sources
    console.log('\n\n📡 Signal Sources:');
    const sources = await prisma.signal.groupBy({
      by: ['source'],
      _count: { source: true }
    });
    sources.forEach(s => console.log(`   ${s.source || 'N/A'}: ${s._count.source}`));

    console.log('\n' + '='.repeat(70));
    console.log('✅ Signal Mechanism Check Complete\n');

  } catch (error) {
    console.error('❌ Error during signal check:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSignals();
