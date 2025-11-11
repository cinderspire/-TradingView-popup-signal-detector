#!/usr/bin/env node
/**
 * Match Orphaned Signals
 *
 * Manually process EXIT signals that are PENDING and match them with
 * open ENTRY signals to close the positions.
 *
 * This fixes the 12,000+ orphaned ENTRY signals that were never matched.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function matchOrphanedSignals() {
  try {
    console.log('🔍 Finding orphaned EXIT signals...\n');

    // Find all PENDING EXIT signals
    const pendingExits = await prisma.signal.findMany({
      where: {
        type: 'EXIT',
        status: 'PENDING'
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`📊 Found ${pendingExits.length} PENDING EXIT signals\n`);

    if (pendingExits.length === 0) {
      console.log('✅ No pending EXIT signals to process');
      await prisma.$disconnect();
      return;
    }

    let matchedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each EXIT signal
    for (const exitSignal of pendingExits) {
      try {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Processing: ${exitSignal.symbol} ${exitSignal.direction}`);
        console.log(`EXIT ID: ${exitSignal.id}`);
        console.log(`Created: ${exitSignal.createdAt.toISOString()}`);

        // Extract strategy name from rawText
        let strategyName = null;
        if (exitSignal.rawText) {
          const beforeBrace = exitSignal.rawText.split('{')[0];
          const cleaned = beforeBrace
            .replace(/^Alert on /i, '')
            .replace(new RegExp(exitSignal.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
            .replace(/[^A-Za-z0-9 ]/g, '')
            .trim();
          strategyName = cleaned || null;
        }

        console.log(`Strategy: ${strategyName || 'N/A'}`);

        // Find matching open ENTRY signal
        const where = {
          symbol: exitSignal.symbol,
          type: 'ENTRY',
          direction: exitSignal.direction,
          closedAt: null,
          status: { in: ['PENDING', 'ACTIVE', 'EXECUTED'] }
        };

        if (strategyName) {
          where.rawText = { contains: strategyName };
        }

        const openEntry = await prisma.signal.findFirst({
          where,
          orderBy: { createdAt: 'asc' }
        });

        if (!openEntry) {
          console.log(`⚠️  No matching open ENTRY found`);
          skippedCount++;
          continue;
        }

        console.log(`✅ Found matching ENTRY: ${openEntry.id}`);
        console.log(`   Entry Price: ${openEntry.entryPrice}`);
        console.log(`   Exit Price: ${exitSignal.entry || exitSignal.entryPrice}`);

        // Calculate P&L
        const entryPrice = openEntry.entryPrice;
        const exitPrice = exitSignal.entry || exitSignal.entryPrice;
        const fee = 0.1; // 0.1% total fees
        let pnl;

        if (exitSignal.direction === 'LONG') {
          pnl = ((exitPrice - entryPrice) / entryPrice * 100) - fee;
        } else {
          pnl = ((entryPrice - exitPrice) / entryPrice * 100) - fee;
        }

        console.log(`   P&L: ${pnl.toFixed(4)}%`);

        // Close the ENTRY signal
        await prisma.signal.update({
          where: { id: openEntry.id },
          data: {
            status: 'CLOSED',
            closedAt: new Date(exitSignal.createdAt || Date.now()),
            exitPrice: exitPrice,
            profitLoss: pnl
          }
        });

        // Mark the EXIT signal as EXECUTED
        await prisma.signal.update({
          where: { id: exitSignal.id },
          data: {
            status: 'EXECUTED'
          }
        });

        const emoji = pnl > 0 ? '✅' : '❌';
        console.log(`${emoji} Matched and closed!`);
        matchedCount++;

        // Rate limit to avoid overwhelming database
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        console.error(`❌ Error processing EXIT ${exitSignal.id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log('📊 SUMMARY');
    console.log(`   ✅ Matched: ${matchedCount}`);
    console.log(`   ⚠️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${pendingExits.length}\n`);

    // Show remaining orphaned ENTRY signals
    const remainingOrphans = await prisma.signal.count({
      where: {
        type: 'ENTRY',
        status: { in: ['PENDING', 'ACTIVE'] },
        closedAt: null
      }
    });

    console.log(`⚠️  Remaining orphaned ENTRY signals: ${remainingOrphans}`);

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run
matchOrphanedSignals();
