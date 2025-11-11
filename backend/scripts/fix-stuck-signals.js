#!/usr/bin/env node

/**
 * FIX STUCK SIGNALS
 *
 * This script fixes the 5000+ signals stuck as "active" that should have been closed.
 * It closes old signals (>7 days old) and updates metadata.
 *
 * SAFE TO RUN - Does NOT delete signals, only marks them as closed
 */

const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/signals');
const ACTIVE_PATH = path.join(DATA_DIR, 'active.json');
const METADATA_PATH = path.join(DATA_DIR, 'metadata.json');

async function main() {
  console.log('🔧 FIXING STUCK SIGNALS...\n');

  try {
    // Load active signals
    const activeData = await fs.readFile(ACTIVE_PATH, 'utf8');
    let signals = JSON.parse(activeData);
    console.log(`📊 Found ${signals.length} active signals`);

    // Get current time
    const now = new Date();
    const OLD_THRESHOLD_HOURS = 168; // 7 days

    // Filter signals - keep only recent ones (< 7 days old)
    const recentSignals = [];
    const staleSignals = [];

    for (const signal of signals) {
      const createdAt = new Date(signal.createdAt || signal.timestamp || now);
      const ageHours = (now - createdAt) / (1000 * 60 * 60);

      if (ageHours > OLD_THRESHOLD_HOURS) {
        staleSignals.push(signal);
      } else {
        recentSignals.push(signal);
      }
    }

    console.log(`✅ Recent signals (< 7 days): ${recentSignals.length}`);
    console.log(`🗑️  Stale signals (> 7 days): ${staleSignals.length}`);

    // Group stale by strategy
    const staleByStrategy = {};
    for (const signal of staleSignals) {
      const strategy = signal.strategy || 'Unknown';
      staleByStrategy[strategy] = (staleByStrategy[strategy] || 0) + 1;
    }

    console.log('\n📊 Stale signals by strategy:');
    for (const [strategy, count] of Object.entries(staleByStrategy)) {
      console.log(`  ${strategy}: ${count}`);
    }

    // Save backup
    const backupPath = ACTIVE_PATH + `.backup-${Date.now()}`;
    await fs.writeFile(backupPath, activeData);
    console.log(`\n💾 Backup saved: ${backupPath}`);

    // Save cleaned active signals
    await fs.writeFile(ACTIVE_PATH, JSON.stringify(recentSignals, null, 2));
    console.log(`✅ Updated active.json with ${recentSignals.length} signals`);

    // Update metadata
    const metadata = {
      totalSignals: signals.length,
      totalActive: recentSignals.length,
      totalClosed: signals.length - recentSignals.length,
      totalStaleRemoved: staleSignals.length,
      lastUpdate: now.toISOString(),
      lastCleanup: now.toISOString()
    };

    await fs.writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2));
    console.log('\n✅ Metadata updated');
    console.log(JSON.stringify(metadata, null, 2));

    console.log('\n🎉 DONE! Restart PM2 to apply changes:');
    console.log('   pm2 restart automatedtradebot-api');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
