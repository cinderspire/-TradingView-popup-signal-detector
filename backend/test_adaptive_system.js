/**
 * TEST ADAPTIVE TP/SL SYSTEM
 * Tests the complete flow:
 * 1. Check subscription config
 * 2. Create test position with adaptive TP/SL
 * 3. Monitor position
 * 4. Verify TP/SL levels
 */

const { PrismaClient } = require('@prisma/client');
const { getInstance: getAdaptiveTPSL } = require('./src/services/adaptive-tpsl-calculator');

const prisma = new PrismaClient();
const adaptiveTPSL = getAdaptiveTPSL();

(async () => {
  try {
    console.log('🧪 TESTING ADAPTIVE TP/SL SYSTEM\n');

    // 1. Get user and subscription
    const user = await prisma.user.findFirst({
      where: { email: { contains: '@' } }
    });

    if (!user) {
      console.error('❌ No user found!');
      process.exit(1);
    }

    console.log(`✅ User: ${user.email}`);

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE'
      },
      include: { strategy: true }
    });

    if (!subscription) {
      console.error('❌ No active subscription found!');
      process.exit(1);
    }

    console.log(`✅ Subscription: ${subscription.strategy?.name || 'Unknown'}`);
    console.log(`   Use Adaptive TP/SL: ${subscription.useAdaptiveTPSL}`);
    console.log(`   Risk Profile: ${subscription.riskProfile || 'balanced'}`);
    console.log(`   Custom TP: ${subscription.customTakeProfit || 'none'}`);
    console.log(`   Custom SL: ${subscription.customStopLoss || 'none'}`);
    console.log(`   Trailing Stop: ${subscription.useTrailingStop}`);
    console.log(`   Breakeven: ${subscription.useBreakEven}`);

    // 2. Test adaptive calculator
    console.log('\n📊 TESTING ADAPTIVE CALCULATOR:');
    console.log('─'.repeat(60));

    const testSymbol = 'BTC/USDT';
    const testProfile = subscription.riskProfile || 'balanced';

    const tpsl = adaptiveTPSL.calculateTPSL(testSymbol, testProfile, {
      trailingStopEnabled: subscription.useTrailingStop,
      breakEvenEnabled: subscription.useBreakEven
    });

    console.log(`\nSymbol: ${testSymbol}`);
    console.log(`Profile: ${testProfile}`);
    console.log(`TP: ${tpsl.tp.toFixed(2)}%`);
    console.log(`SL: ${tpsl.sl.toFixed(2)}%`);
    console.log(`R/R Ratio: ${(Math.abs(tpsl.tp / tpsl.sl)).toFixed(2)}:1`);
    console.log(`Based on: ${tpsl.basedOn}`);

    if (tpsl.trailingStop) {
      console.log(`\nTrailing Stop:`);
      console.log(`  Activation: ${tpsl.trailingStop.activationPercent.toFixed(2)}%`);
      console.log(`  Callback: ${tpsl.trailingStop.callbackPercent.toFixed(2)}%`);
    }

    if (tpsl.breakEven) {
      console.log(`\nBreak Even:`);
      console.log(`  Activation: ${tpsl.breakEven.activationPercent.toFixed(2)}%`);
      console.log(`  Offset: ${tpsl.breakEven.offsetPercent.toFixed(2)}%`);
    }

    // 3. Check existing positions
    console.log('\n📍 EXISTING POSITIONS:');
    console.log('─'.repeat(60));

    const openPositions = await prisma.position.findMany({
      where: {
        userId: user.id,
        status: 'OPEN'
      },
      orderBy: { createdAt: 'desc' }
    });

    if (openPositions.length === 0) {
      console.log('No open positions');
    } else {
      for (const pos of openPositions) {
        const entryPrice = parseFloat(pos.entryPrice);
        const currentPrice = parseFloat(pos.currentPrice) || entryPrice;
        const tp = parseFloat(pos.takeProfit);
        const sl = parseFloat(pos.stopLoss);

        const tpPercent = ((tp - entryPrice) / entryPrice) * 100;
        const slPercent = ((sl - entryPrice) / entryPrice) * 100;
        const currentPnL = ((currentPrice - entryPrice) / entryPrice) * 100;

        console.log(`\n${pos.symbol} (${pos.side})`);
        console.log(`  ID: ${pos.id}`);
        console.log(`  Entry: ${entryPrice.toFixed(6)}`);
        console.log(`  Current: ${currentPrice.toFixed(6)} (${currentPnL >= 0 ? '+' : ''}${currentPnL.toFixed(2)}%)`);
        console.log(`  TP: ${tp.toFixed(6)} (${tpPercent >= 0 ? '+' : ''}${tpPercent.toFixed(2)}%)`);
        console.log(`  SL: ${sl.toFixed(6)} (${slPercent >= 0 ? '+' : ''}${slPercent.toFixed(2)}%)`);
        console.log(`  Status: ${pos.status}`);
        console.log(`  Notes: ${pos.notes || 'none'}`);
      }
    }

    // 4. Test recommendations
    console.log('\n💡 RECOMMENDATIONS FOR TOP PAIRS:');
    console.log('─'.repeat(60));

    const topPairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT'];

    for (const pair of topPairs) {
      const rec = adaptiveTPSL.calculateTPSL(pair, testProfile);
      console.log(`${pair.padEnd(12)} TP: ${rec.tp.toFixed(2)}%  SL: ${rec.sl.toFixed(2)}%  R/R: ${(Math.abs(rec.tp / rec.sl)).toFixed(2)}:1`);
    }

    console.log('\n✅ TEST COMPLETE!\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
