const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBot() {
  try {
    // Check recent signals (last 10 minutes)
    const recentSignals = await prisma.signal.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000)
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Check open positions
    const openPositions = await prisma.signal.findMany({
      where: {
        status: 'OPEN',
        type: 'ENTRY'
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Check recent matched signals (last hour)
    const recentMatched = await prisma.signal.findMany({
      where: {
        status: 'CLOSED',
        closedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      },
      orderBy: { closedAt: 'desc' },
      take: 5,
      select: {
        symbol: true,
        type: true,
        price: true,
        closedPrice: true,
        pnl: true,
        closedAt: true
      }
    });

    // Check signal rate (last hour)
    const lastHourCount = await prisma.signal.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      }
    });

    console.log('=== AUTO TRADE BOT STATUS ===\n');
    console.log('📊 SIGNAL FLOW:');
    console.log('  - Last 10 min: ' + recentSignals.length + ' signals');
    console.log('  - Last hour: ' + lastHourCount + ' signals');
    console.log('  - Rate: ' + Math.round(lastHourCount / 60) + ' signals/min\n');

    console.log('📈 OPEN POSITIONS: ' + openPositions.length);
    if (openPositions.length > 0) {
      openPositions.forEach(p => {
        const age = Math.round((Date.now() - p.createdAt.getTime()) / 60000);
        console.log('  - ' + p.symbol + ': ' + p.direction + ' @ ' + p.price + ' (' + age + ' min ago)');
      });
    }
    console.log('');

    console.log('✅ RECENT MATCHED SIGNALS (last hour): ' + recentMatched.length);
    if (recentMatched.length > 0) {
      recentMatched.forEach(s => {
        console.log('  - ' + s.symbol + ': P&L ' + (s.pnl || 0).toFixed(2) + '%');
      });
    }
    console.log('');

    // Check if signals are too old
    if (recentSignals.length > 0) {
      const latestSignal = recentSignals[0];
      const ageMinutes = Math.round((Date.now() - latestSignal.createdAt.getTime()) / 60000);
      console.log('⏱️  LATEST SIGNAL:');
      console.log('  - ' + latestSignal.symbol + ' ' + latestSignal.type);
      console.log('  - ' + ageMinutes + ' minutes ago');
      console.log('  - Status: ' + (ageMinutes < 5 ? '🟢 ACTIVE' : '🟡 SLOW'));
    } else {
      console.log('⚠️  WARNING: No signals in last 10 minutes!');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkBot();
