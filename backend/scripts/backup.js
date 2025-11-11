#!/usr/bin/env node

/**
 * BACKUP CLI TOOL
 *
 * Command-line interface for backup operations
 *
 * Usage:
 *   node scripts/backup.js create [daily|weekly|monthly|manual]
 *   node scripts/backup.js list
 *   node scripts/backup.js restore <backup-id>
 *   node scripts/backup.js cleanup
 *   node scripts/backup.js stats
 */

require('dotenv').config();
const backupService = require('../src/services/backupService');

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
    try {
        // Initialize backup service
        await backupService.initialize();

        switch (command) {
            case 'create': {
                const type = args[0] || 'manual';
                console.log(`\n🚀 Creating ${type} backup...\n`);

                const backup = await backupService.createBackup(type);

                console.log('\n✅ Backup created successfully!\n');
                console.log('Backup ID:', backup.id);
                console.log('Type:', backup.type);
                console.log('Size:', backupService.formatBytes(backup.size));
                console.log('Duration:', (backup.duration / 1000).toFixed(2), 'seconds');
                console.log('Verified:', backup.verified ? 'Yes' : 'No');
                console.log('\nFiles backed up:');
                console.log('  - Database:', backup.files.database ? '✅' : '❌');
                console.log('  - Files:', backup.files.uploads ? '✅' : '❌');
                console.log('  - Logs:', backup.files.logs ? '✅' : '❌');
                console.log('  - Config:', backup.files.config ? '✅' : '❌');
                break;
            }

            case 'list': {
                console.log('\n📚 Backup History\n');

                const stats = backupService.getBackupStats();

                if (stats.total === 0) {
                    console.log('No backups found.');
                    break;
                }

                console.log(`Total backups: ${stats.total}`);
                console.log(`Successful: ${stats.successful}`);
                console.log(`Failed: ${stats.failed}`);
                console.log(`Total size: ${stats.totalSizeFormatted}`);
                console.log('');

                backupService.backupHistory.forEach((backup, index) => {
                    const age = ((Date.now() - new Date(backup.timestamp)) / (1000 * 60 * 60 * 24)).toFixed(1);
                    console.log(`${index + 1}. ${backup.id}`);
                    console.log(`   Type: ${backup.type}`);
                    console.log(`   Date: ${new Date(backup.timestamp).toLocaleString()}`);
                    console.log(`   Age: ${age} days`);
                    console.log(`   Size: ${backupService.formatBytes(backup.size)}`);
                    console.log(`   Status: ${backup.status}`);
                    console.log(`   Verified: ${backup.verified ? 'Yes' : 'No'}`);
                    console.log('');
                });
                break;
            }

            case 'restore': {
                const backupId = args[0];

                if (!backupId) {
                    console.error('❌ Error: Please provide a backup ID');
                    console.log('Usage: node scripts/backup.js restore <backup-id>');
                    process.exit(1);
                }

                console.log(`\n🔄 Restoring from backup: ${backupId}\n`);

                // Confirm with user
                const readline = require('readline').createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                const answer = await new Promise(resolve => {
                    readline.question('⚠️  WARNING: This will replace current data. Continue? (yes/no): ', resolve);
                });

                readline.close();

                if (answer.toLowerCase() !== 'yes') {
                    console.log('Restore cancelled.');
                    break;
                }

                const options = {
                    restoreDatabase: true,
                    restoreFiles: true,
                    restoreLogs: false,
                    restoreConfig: false
                };

                await backupService.restoreBackup(backupId, options);

                console.log('\n✅ Restore completed successfully!\n');
                console.log('⚠️  Please restart the application for changes to take effect.');
                break;
            }

            case 'cleanup': {
                console.log('\n🧹 Cleaning up old backups...\n');

                const result = await backupService.cleanupOldBackups();

                console.log('\n✅ Cleanup completed!\n');
                console.log('Deleted backups:', result.deletedCount);
                console.log('Space freed:', backupService.formatBytes(result.freedSpace));
                break;
            }

            case 'stats': {
                console.log('\n📊 Backup Statistics\n');

                const stats = backupService.getBackupStats();

                console.log('Total backups:', stats.total);
                console.log('Successful:', stats.successful);
                console.log('Failed:', stats.failed);
                console.log('Total size:', stats.totalSizeFormatted);
                console.log('');
                console.log('Last backup:');
                if (stats.lastBackup) {
                    console.log('  ID:', stats.lastBackup.id);
                    console.log('  Date:', new Date(stats.lastBackup.timestamp).toLocaleString());
                    console.log('  Type:', stats.lastBackup.type);
                    console.log('  Size:', backupService.formatBytes(stats.lastBackup.size));
                } else {
                    console.log('  None');
                }
                console.log('');
                console.log('Retention policy:');
                console.log('  Daily:', stats.retentionPolicy.daily, 'days');
                console.log('  Weekly:', stats.retentionPolicy.weekly, 'days');
                console.log('  Monthly:', stats.retentionPolicy.monthly, 'days');
                console.log('');
                console.log('Schedule:');
                console.log('  Daily:', stats.schedule.daily);
                console.log('  Weekly:', stats.schedule.weekly);
                console.log('  Monthly:', stats.schedule.monthly);
                console.log('');
                console.log('Remote storage:', stats.remoteStorageEnabled ? 'Enabled' : 'Disabled');
                break;
            }

            case 'verify': {
                const backupId = args[0];

                if (!backupId) {
                    console.error('❌ Error: Please provide a backup ID');
                    process.exit(1);
                }

                const backup = backupService.backupHistory.find(b => b.id === backupId);
                if (!backup) {
                    console.error(`❌ Error: Backup ${backupId} not found`);
                    process.exit(1);
                }

                console.log(`\n🔍 Verifying backup: ${backupId}\n`);

                const verified = await backupService.verifyBackup(backup);

                if (verified) {
                    console.log('✅ Backup verification passed!');
                } else {
                    console.log('❌ Backup verification failed!');
                    process.exit(1);
                }
                break;
            }

            default: {
                console.log(`
AutomatedTradeBot Backup Tool

Usage:
  node scripts/backup.js <command> [options]

Commands:
  create [type]       Create a new backup
                      Types: daily, weekly, monthly, manual (default: manual)

  list                List all available backups

  restore <id>        Restore from a specific backup
                      Requires backup ID from 'list' command

  cleanup             Remove old backups based on retention policy

  stats               Show backup statistics and configuration

  verify <id>         Verify integrity of a specific backup

Examples:
  node scripts/backup.js create daily
  node scripts/backup.js list
  node scripts/backup.js restore daily_2025-01-15T02-00-00
  node scripts/backup.js cleanup
  node scripts/backup.js stats
  node scripts/backup.js verify daily_2025-01-15T02-00-00

Environment Variables:
  BACKUP_DIR                      Backup directory path (default: /home/automatedtradebot/backups)
  BACKUP_RETENTION_DAILY          Daily backup retention in days (default: 7)
  BACKUP_RETENTION_WEEKLY         Weekly backup retention in days (default: 30)
  BACKUP_RETENTION_MONTHLY        Monthly backup retention in days (default: 365)
  BACKUP_SCHEDULE_DAILY           Daily backup cron schedule (default: 0 2 * * *)
  BACKUP_SCHEDULE_WEEKLY          Weekly backup cron schedule (default: 0 3 * * 0)
  BACKUP_SCHEDULE_MONTHLY         Monthly backup cron schedule (default: 0 4 1 * *)
  BACKUP_S3_ENABLED               Enable S3 uploads (default: false)
  BACKUP_S3_BUCKET                S3 bucket name
  BACKUP_S3_ACCESS_KEY            S3 access key
  BACKUP_S3_SECRET_KEY            S3 secret key
                `);
                break;
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

main();
