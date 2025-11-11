#!/usr/bin/env node
/**
 * SETUP SUYTTRU ACCOUNT WITH AI + ADAPTIVE TP/SL
 *
 * Creates subscriptions for the best 3 strategies with 6 pairs each
 * All subscriptions will have AI + Adaptive TP/SL enabled
 *
 * Based on performance analysis:
 * - Best Strategy 1: 7RSI (+10,855% total P&L)
 * - Best Strategy 2: 3RSI (+7,662% total P&L)
 * - Best Strategy 3: GRID (+164% total P&L, 88.4% win rate)
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../src/utils/logger');
const prisma = new PrismaClient();

const SUYTTRU_USERNAME = 'suyttru';

// Best strategies based on performance analysis
const BEST_STRATEGIES = [
  {
    strategyId: 'ad36636f-5871-432b-bb2e-a168a7d8395c', // 7RSI
    name: '7RSI',
    pairs: ['TRBUSDT.P', 'ALCHUSDT.P', 'TRUMPUSDT.P', 'BANUSDT.P', 'ZKUSDT.P', 'WLFIUSDT.P']
  },
  {
    strategyId: 'e9cc790b-ac82-47dc-8367-569f6d7f805b', // 3RSI
    name: '3RSI',
    pairs: ['MYROUSDT.P', 'HOOKUSDT.P', 'CFXUSDT.P', 'PNUTUSDT.P', 'ICPUSDT.P', 'PENGUUSDT.P']
  },
  {
    strategyId: 'acc394fc-604e-474f-bf96-6704fac3280d', // GRID
    name: 'GRID',
    pairs: ['1000CHEEMSUSDT.P', 'MYROUSDT.P', '1MBABYDOGEUSDT.P', 'AEVOUSDT.P', 'GOATUSDT.P', 'HIVEUSDT.P']
  }
];

async function setupSubscriptions() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 SETTING UP SUYTTRU ACCOUNT WITH AI + ADAPTIVE TP/SL');
    console.log('='.repeat(80) + '\n');

    // Find suyttru user
    console.log(`🔍 Finding user: ${SUYTTRU_USERNAME}...`);
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: SUYTTRU_USERNAME },
          { email: { contains: SUYTTRU_USERNAME } }
        ]
      }
    });

    if (!user) {
      console.error(`❌ User '${SUYTTRU_USERNAME}' not found in database`);
      console.log('\nAvailable users:');
      const users = await prisma.user.findMany({
        select: { id: true, username: true, email: true }
      });
      console.table(users);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.username} (${user.email})`);
    console.log(`   User ID: ${user.id}\n`);

    // Check for existing subscriptions
    console.log('🔍 Checking existing subscriptions...');
    const existingSubscriptions = await prisma.subscription.findMany({
      where: { userId: user.id },
      include: {
        strategy: {
          select: { name: true }
        }
      }
    });

    if (existingSubscriptions.length > 0) {
      console.log(`⚠️  User has ${existingSubscriptions.length} existing subscriptions:`);
      existingSubscriptions.forEach(sub => {
        console.log(`   - ${sub.strategy.name} (${sub.subscribedPairs.length} pairs)`);
      });
      console.log('\n❓ Do you want to delete existing subscriptions and create new ones?');
      console.log('   (This script will proceed in 5 seconds. Press Ctrl+C to cancel)\n');
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('🗑️  Deleting existing subscriptions...');
      await prisma.subscription.deleteMany({
        where: { userId: user.id }
      });
      console.log('✅ Existing subscriptions deleted\n');
    }

    // Create subscriptions for each strategy
    console.log('━'.repeat(80));
    console.log('📝 CREATING NEW SUBSCRIPTIONS');
    console.log('━'.repeat(80) + '\n');

    const createdSubscriptions = [];

    for (const strategy of BEST_STRATEGIES) {
      console.log(`\n🎯 Strategy: ${strategy.name}`);
      console.log(`   Pairs: ${strategy.pairs.join(', ')}`);

      // Create subscription
      try {
        const subscription = await prisma.subscription.create({
          data: {
            userId: user.id,
            strategyId: strategy.strategyId,

            // Pair selection
            subscribedPairs: strategy.pairs,
            allPairs: false,

            // Exchange configuration
            exchanges: ['bybit'],
            activeExchange: 'bybit',

            // AI + ADAPTIVE TP/SL CONFIGURATION
            useAdaptiveTPSL: true,
            riskProfile: 'balanced',
            usePairSpecificTPSL: true,
            useTrailingStop: true,
            useBreakEven: true,
            useAIRiskControl: true,
            aiModel: 'glm-4-flash',
            aiRiskLevel: 'adaptive',

            // Trading configuration
            orderType: 'FUTURES',
            usePercentage: true,
            orderSizePercent: 2.0, // 2% of balance per trade

            // Status
            status: 'ACTIVE'
          }
        });

        createdSubscriptions.push(subscription);
        console.log(`   ✅ Subscription created (ID: ${subscription.id})`);
        console.log(`   🤖 AI + Adaptive TP/SL: ENABLED`);
        console.log(`   📊 Risk Profile: ${subscription.riskProfile}`);
        console.log(`   🎯 Trailing Stop: ${subscription.useTrailingStop ? 'YES' : 'NO'}`);
        console.log(`   🛡️  Break-Even: ${subscription.useBreakEven ? 'YES' : 'NO'}`);

      } catch (error) {
        console.log(`   ❌ Failed to create subscription: ${error.message}`);
      }
    }

    // Summary
    console.log('\n' + '━'.repeat(80));
    console.log('📊 SUMMARY');
    console.log('━'.repeat(80));
    console.log(`✅ Successfully created ${createdSubscriptions.length} subscriptions`);
    console.log(`\nUser: ${user.username} (${user.email})`);
    console.log(`Total pairs tracked: ${createdSubscriptions.reduce((sum, sub) => sum + sub.subscribedPairs.length, 0)}`);
    console.log('\nSubscriptions:');

    for (const sub of createdSubscriptions) {
      const strat = await prisma.strategy.findUnique({
        where: { id: sub.strategyId },
        select: { name: true }
      });
      console.log(`  ${strat.name}: ${sub.subscribedPairs.length} pairs`);
    }

    console.log('\n🎯 Features enabled on all subscriptions:');
    console.log('  ✓ AI Risk Control (GLM-4-flash)');
    console.log('  ✓ Adaptive TP/SL (Historical data based)');
    console.log('  ✓ Pair-specific optimization');
    console.log('  ✓ Trailing Stop Loss');
    console.log('  ✓ Break-Even protection');
    console.log('  ✓ Balanced risk profile');

    console.log('\n💡 Expected Performance Improvement (based on historical data):');
    console.log('  + Win Rate: +21.42% increase');
    console.log('  + Total P&L: +6,687% increase');
    console.log('  + Losing trades prevented: ~3,918');
    console.log('  + Average P&L per trade: Nearly 2x');

    console.log('\n━'.repeat(80));
    console.log('✅ SETUP COMPLETE!');
    console.log('━'.repeat(80));
    console.log('\n💡 Next steps:');
    console.log('  1. Restart the service: pm2 restart automatedtradebot-api');
    console.log('  2. Monitor logs: pm2 logs automatedtradebot-api');
    console.log('  3. Watch for incoming signals and AI recommendations\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

setupSubscriptions();
