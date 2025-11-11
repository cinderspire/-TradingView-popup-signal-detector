/**
 * SETUP SUBSCRIPTION WITH ADAPTIVE TP/SL
 * Creates or updates subscription with adaptive TP/SL settings
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    console.log('⚙️  SETTING UP SUBSCRIPTION WITH ADAPTIVE TP/SL\n');

    // Get user
    const user = await prisma.user.findFirst({
      where: { email: { contains: '@' } }
    });

    if (!user) {
      console.error('❌ No user found!');
      process.exit(1);
    }

    console.log(`✅ User: ${user.email}`);

    // Get or create strategy
    let strategy = await prisma.strategy.findFirst({
      where: { providerId: user.id }
    });

    if (!strategy) {
      strategy = await prisma.strategy.create({
        data: {
          providerId: user.id,
          name: 'Adaptive TP/SL Strategy',
          description: 'Strategy using adaptive take profit and stop loss',
          category: 'Technical',
          type: 'CUSTOM',
          parameters: {},
          supportedPairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT'],
          supportedTimeframes: ['5m', '15m', '1h', '4h'],
          monthlyPrice: 0,
          isActive: true,
          isPublic: false
        }
      });
      console.log(`✅ Created strategy: ${strategy.name}`);
    } else {
      console.log(`✅ Using existing strategy: ${strategy.name}`);
    }

    // Check for existing subscription
    let subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        strategyId: strategy.id
      }
    });

    if (subscription) {
      // Update existing subscription
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          useAdaptiveTPSL: true,
          riskProfile: 'balanced',
          customTakeProfit: null,  // Use adaptive instead of custom
          customStopLoss: null,
          useTrailingStop: true,
          useBreakEven: true,
          usePairSpecificTPSL: true,
          orderType: 'SPOT',
          fixedOrderSize: 10,  // $10 USDT per trade
          subscribedPairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'GRT/USDT', 'CAKE/USDT'],
          exchanges: ['mexc']
        }
      });
      console.log(`✅ Updated subscription`);
    } else {
      // Create new subscription
      subscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          strategyId: strategy.id,
          status: 'ACTIVE',
          useAdaptiveTPSL: true,
          riskProfile: 'balanced',
          customTakeProfit: null,
          customStopLoss: null,
          useTrailingStop: true,
          useBreakEven: true,
          usePairSpecificTPSL: true,
          orderType: 'SPOT',
          fixedOrderSize: 10,  // $10 USDT per trade
          subscribedPairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'GRT/USDT', 'CAKE/USDT'],
          exchanges: ['mexc'],
          allPairs: false,
          monthlyPrice: 0,
          isFree: true
        }
      });
      console.log(`✅ Created subscription`);
    }

    console.log('\n📊 SUBSCRIPTION SETTINGS:');
    console.log('─'.repeat(60));
    console.log(`Status: ${subscription.status}`);
    console.log(`Adaptive TP/SL: ${subscription.useAdaptiveTPSL}`);
    console.log(`Risk Profile: ${subscription.riskProfile}`);
    console.log(`Trailing Stop: ${subscription.useTrailingStop}`);
    console.log(`Breakeven: ${subscription.useBreakEven}`);
    console.log(`Pair-Specific TP/SL: ${subscription.usePairSpecificTPSL}`);
    console.log(`Order Size: $${subscription.fixedOrderSize} USDT`);
    console.log(`Exchanges: ${subscription.exchanges.join(', ')}`);
    console.log(`Pairs: ${subscription.subscribedPairs.join(', ')}`);

    console.log('\n✅ SETUP COMPLETE!\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
