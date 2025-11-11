const ccxt = require('ccxt');
const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./src/utils/encryption');

const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🚨 EMERGENCY: SYNCING ALL EXCHANGE POSITIONS TO DATABASE\n');
    console.log('='.repeat(70));

    // Find user who has API keys
    const apiKeyWithUser = await prisma.apiKey.findFirst({
      where: { isActive: true },
      include: { user: true }
    });

    if (!apiKeyWithUser) {
      console.log('❌ No active API keys found in system');
      await prisma.$disconnect();
      return;
    }

    const user = apiKeyWithUser.user;
    console.log(`Using user: ${user.email}`);

    // Get all active API keys for this user
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: user.id, isActive: true }
    });

    console.log(`Found ${apiKeys.length} active exchanges\n`);

    for (const apiKeyRecord of apiKeys) {
      const exchangeName = apiKeyRecord.exchange.toLowerCase();
      const displayName = exchangeName.toUpperCase();
      console.log(`\n📊 Checking ${displayName}...`);
      console.log('-'.repeat(70));

      try {
        const ExchangeClass = ccxt[exchangeName];
        if (!ExchangeClass) {
          console.log(`⚠️  Exchange ${exchangeName} not supported by CCXT`);
          continue;
        }

        const exchange = new ExchangeClass({
          apiKey: decrypt(apiKeyRecord.apiKey),
          secret: decrypt(apiKeyRecord.apiSecret),
          enableRateLimit: true,
          options: { defaultType: 'spot' }
        });

        await exchange.loadMarkets();
        const balance = await exchange.fetchBalance();

        // Find all non-zero, non-USDT balances
        const positions = [];
        for (const [coin, amount] of Object.entries(balance.total)) {
          if (coin === 'USDT' || amount === 0 || amount < 0.000001) continue;

          const pair = coin + '/USDT';
          if (!exchange.markets[pair]) continue;

          try {
            const ticker = await exchange.fetchTicker(pair);
            const currentPrice = ticker.last;
            const valueUSDT = amount * currentPrice;

            if (valueUSDT < 1) continue; // Skip dust

            positions.push({
              coin,
              pair,
              amount,
              currentPrice,
              valueUSDT
            });
          } catch (e) {
            console.log(`  ⚠️  ${pair} ticker error: ${e.message}`);
          }
        }

        console.log(`Found ${positions.length} positions on ${exchangeName}\n`);

        if (positions.length === 0) {
          console.log('  No positions to sync');
          continue;
        }

        // Check each position against database
        for (const pos of positions) {
          console.log(`\n${pos.coin}: ${pos.amount.toFixed(6)} @ $${pos.currentPrice.toFixed(4)} = $${pos.valueUSDT.toFixed(2)}`);

          // Check if already in database
          const existingPosition = await prisma.position.findFirst({
            where: {
              userId: user.id,
              symbol: pos.pair,
              status: 'OPEN'
            }
          });

          if (existingPosition) {
            console.log(`  ✅ Already in database (ID: ${existingPosition.id})`);

            // Update current price
            await prisma.position.update({
              where: { id: existingPosition.id },
              data: { currentPrice: pos.currentPrice }
            });
            console.log(`  🔄 Updated current price to $${pos.currentPrice.toFixed(4)}`);

          } else {
            console.log(`  ❌ NOT in database - CREATING NOW`);

            // Estimate entry price (assume -2% from current for safe TP/SL)
            const estimatedEntry = pos.currentPrice * 0.98;
            const takeProfit = pos.currentPrice * 1.05; // +5% TP
            const stopLoss = pos.currentPrice * 0.97;   // -3% SL

            const newPosition = await prisma.position.create({
              data: {
                userId: user.id,
                symbol: pos.pair,
                side: 'LONG',
                size: pos.amount,
                entryPrice: estimatedEntry,
                currentPrice: pos.currentPrice,
                stopLoss: stopLoss,
                takeProfit: takeProfit,
                status: 'OPEN',
                notes: `Emergency sync from ${exchangeName} - Estimated entry`
              }
            });

            console.log(`  ✅ Created in database (ID: ${newPosition.id})`);
            console.log(`     Entry (est): $${estimatedEntry.toFixed(4)}`);
            console.log(`     TP: $${takeProfit.toFixed(4)} (+5%)`);
            console.log(`     SL: $${stopLoss.toFixed(4)} (-3%)`);
          }
        }

      } catch (error) {
        console.log(`❌ Error with ${exchangeName}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('SYNC COMPLETE');
    console.log('='.repeat(70));

    // Final check
    const allOpenPositions = await prisma.position.findMany({
      where: { userId: user.id, status: 'OPEN' },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\nTotal OPEN positions in database: ${allOpenPositions.length}\n`);

    for (const pos of allOpenPositions) {
      const entry = parseFloat(pos.entryPrice);
      const current = parseFloat(pos.currentPrice) || entry;
      const pnl = ((current - entry) / entry) * 100;

      console.log(`${pos.symbol.padEnd(15)} Entry: $${entry.toFixed(4)}  Current: $${current.toFixed(4)}  PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%`);
    }

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
