# Automated Backup System Guide

Complete guide for the AutomatedTradeBot backup and restore system.

---

## Overview

The automated backup system provides:
- **Scheduled Backups**: Daily, weekly, and monthly automated backups
- **Comprehensive Coverage**: Database, files, logs, and configuration
- **Retention Management**: Automatic cleanup of old backups
- **Compression**: Gzip compression to save disk space
- **Remote Storage**: Optional S3-compatible cloud storage
- **Verification**: Automatic integrity checking
- **Easy Restore**: Simple CLI commands for disaster recovery

---

## What Gets Backed Up

### 1. PostgreSQL Database
- Complete database dump with all tables and data
- Includes schema and data
- Compressed with gzip (typically 5-10x compression)
- File: `database_<backup-id>.sql.gz`

### 2. Uploaded Files
- User uploaded files (avatars, documents, etc.)
- Located in `/public/uploads/`
- Compressed tar archive
- File: `files_<backup-id>.tar.gz`

### 3. System Logs
- Application logs from `/logs/`
- Error logs, access logs, system logs
- Compressed tar archive
- File: `logs_<backup-id>.tar.gz`

### 4. Configuration Files
- package.json
- package-lock.json
- ecosystem.config.js (PM2 configuration)
- prisma/schema.prisma
- File: `config_<backup-id>.tar.gz`

**Note**: `.env` file is NOT backed up for security reasons. Manually backup your environment variables separately.

---

## Backup Types

### Daily Backups
- **Schedule**: 2:00 AM every day
- **Retention**: 7 days (configurable)
- **Purpose**: Regular daily snapshots

### Weekly Backups
- **Schedule**: 3:00 AM every Sunday
- **Retention**: 30 days (configurable)
- **Purpose**: Weekly milestone backups

### Monthly Backups
- **Schedule**: 4:00 AM on the 1st of each month
- **Retention**: 365 days (configurable)
- **Purpose**: Long-term archival backups

### Manual Backups
- **Trigger**: On-demand via CLI
- **Retention**: Same as daily backups
- **Purpose**: Before major updates or changes

---

## Configuration

### Environment Variables

```bash
# Backup directory (default: /home/automatedtradebot/backups)
BACKUP_DIR=/home/automatedtradebot/backups

# Retention policy (in days)
BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=30
BACKUP_RETENTION_MONTHLY=365

# Backup schedules (cron format)
BACKUP_SCHEDULE_DAILY="0 2 * * *"      # 2 AM daily
BACKUP_SCHEDULE_WEEKLY="0 3 * * 0"     # 3 AM Sunday
BACKUP_SCHEDULE_MONTHLY="0 4 1 * *"    # 4 AM 1st of month

# S3-compatible remote storage (optional)
BACKUP_S3_ENABLED=false
BACKUP_S3_ENDPOINT=https://s3.amazonaws.com
BACKUP_S3_BUCKET=automatedtradebot-backups
BACKUP_S3_ACCESS_KEY=your-access-key
BACKUP_S3_SECRET_KEY=your-secret-key

# Database connection (required)
DATABASE_URL=postgresql://user:password@localhost:5432/automatedtradebot
```

### Cron Schedule Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, 0 and 7 = Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

Examples:
- `0 2 * * *` - Every day at 2:00 AM
- `0 3 * * 0` - Every Sunday at 3:00 AM
- `0 4 1 * *` - 1st of every month at 4:00 AM
- `*/15 * * * *` - Every 15 minutes

---

## CLI Usage

### Create Backup

```bash
# Manual backup
node scripts/backup.js create

# Specific type
node scripts/backup.js create daily
node scripts/backup.js create weekly
node scripts/backup.js create monthly
```

### List Backups

```bash
node scripts/backup.js list
```

Output:
```
📚 Backup History

Total backups: 15
Successful: 15
Failed: 0
Total size: 2.45 GB

1. daily_2025-01-15T02-00-00-000Z
   Type: daily
   Date: 1/15/2025, 2:00:00 AM
   Age: 0.5 days
   Size: 156.78 MB
   Status: completed
   Verified: Yes

2. weekly_2025-01-12T03-00-00-000Z
   Type: weekly
   Date: 1/12/2025, 3:00:00 AM
   Age: 3.2 days
   Size: 154.32 MB
   Status: completed
   Verified: Yes
```

### Restore Backup

```bash
# Interactive restore (prompts for confirmation)
node scripts/backup.js restore daily_2025-01-15T02-00-00-000Z
```

**Warning**: Restore will replace current data. Always create a backup before restoring.

### Cleanup Old Backups

```bash
# Remove backups exceeding retention policy
node scripts/backup.js cleanup
```

Output:
```
🧹 Cleaning up old backups...

✅ Cleanup completed!

Deleted backups: 3
Space freed: 450.23 MB
```

### View Statistics

```bash
node scripts/backup.js stats
```

Output:
```
📊 Backup Statistics

Total backups: 15
Successful: 15
Failed: 0
Total size: 2.45 GB

Last backup:
  ID: daily_2025-01-15T02-00-00-000Z
  Date: 1/15/2025, 2:00:00 AM
  Type: daily
  Size: 156.78 MB

Retention policy:
  Daily: 7 days
  Weekly: 30 days
  Monthly: 365 days

Schedule:
  Daily: 0 2 * * *
  Weekly: 0 3 * * 0
  Monthly: 0 4 1 * *

Remote storage: Disabled
```

### Verify Backup

```bash
# Verify backup integrity
node scripts/backup.js verify daily_2025-01-15T02-00-00-000Z
```

---

## Automated Backups

Backups run automatically based on the configured schedules. To enable:

### 1. Start Backup Service

The backup service starts automatically when the server starts:

```javascript
// In server.js
const backupService = require('./services/backupService');

// Initialize during server startup
await backupService.initialize();
```

### 2. Monitor Backup Logs

Check logs for backup activity:

```bash
# View real-time logs
tail -f logs/combined.log | grep backup

# View backup-specific logs
grep "backup" logs/combined.log
```

### 3. Set Up Monitoring

Create monitoring alerts for:
- Failed backups
- Missing scheduled backups
- Backup size anomalies
- Disk space issues

---

## Restore Procedures

### Complete System Restore

```bash
# 1. Stop the application
pm2 stop automatedtradebot-api

# 2. List available backups
node scripts/backup.js list

# 3. Restore from backup
node scripts/backup.js restore daily_2025-01-15T02-00-00-000Z

# 4. Restart the application
pm2 restart automatedtradebot-api
```

### Partial Restore (Manual)

```bash
# 1. Locate backup directory
cd /home/automatedtradebot/backups

# 2. Extract database only
gunzip -c database/database_daily_2025-01-15T02-00-00-000Z.sql.gz | \
  PGPASSWORD="password" psql -U user -d automatedtradebot

# 3. Extract files only
tar -xzf files/files_daily_2025-01-15T02-00-00-000Z.tar.gz \
  -C /home/automatedtradebot/backend/public/uploads/

# 4. Extract logs only
tar -xzf logs/logs_daily_2025-01-15T02-00-00-000Z.tar.gz \
  -C /home/automatedtradebot/backend/logs/
```

---

## Remote Storage (S3)

### Setup AWS S3

```bash
# 1. Install AWS SDK
npm install aws-sdk

# 2. Configure environment variables
BACKUP_S3_ENABLED=true
BACKUP_S3_ENDPOINT=https://s3.amazonaws.com
BACKUP_S3_BUCKET=my-backups
BACKUP_S3_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
BACKUP_S3_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# 3. Create S3 bucket
aws s3 mb s3://my-backups

# 4. Restart backup service
pm2 restart automatedtradebot-api
```

### S3-Compatible Services

Works with:
- **AWS S3**: Standard Amazon S3
- **DigitalOcean Spaces**: Compatible with S3 API
- **Backblaze B2**: S3-compatible API
- **MinIO**: Self-hosted S3-compatible storage
- **Wasabi**: S3-compatible cloud storage

### Configuration Examples

#### DigitalOcean Spaces
```bash
BACKUP_S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
BACKUP_S3_BUCKET=my-backups
```

#### Backblaze B2
```bash
BACKUP_S3_ENDPOINT=https://s3.us-west-000.backblazeb2.com
BACKUP_S3_BUCKET=my-backups
```

#### MinIO (Self-hosted)
```bash
BACKUP_S3_ENDPOINT=https://minio.example.com
BACKUP_S3_BUCKET=backups
```

---

## Backup Directory Structure

```
/home/automatedtradebot/backups/
│
├── database/
│   ├── database_daily_2025-01-15T02-00-00-000Z.sql.gz
│   ├── database_daily_2025-01-14T02-00-00-000Z.sql.gz
│   └── database_weekly_2025-01-12T03-00-00-000Z.sql.gz
│
├── files/
│   ├── files_daily_2025-01-15T02-00-00-000Z.tar.gz
│   └── files_weekly_2025-01-12T03-00-00-000Z.tar.gz
│
├── logs/
│   ├── logs_daily_2025-01-15T02-00-00-000Z.tar.gz
│   └── logs_weekly_2025-01-12T03-00-00-000Z.tar.gz
│
├── config/
│   ├── config_daily_2025-01-15T02-00-00-000Z.tar.gz
│   └── config_weekly_2025-01-12T03-00-00-000Z.tar.gz
│
├── daily_2025-01-15T02-00-00-000Z_metadata.json
├── daily_2025-01-14T02-00-00-000Z_metadata.json
└── weekly_2025-01-12T03-00-00-000Z_metadata.json
```

---

## Disk Space Management

### Calculate Required Space

Formula: `(Database Size + Files Size) × Retention Days × 1.2`

Example:
- Database: 500 MB
- Files: 100 MB
- Daily retention: 7 days
- Weekly retention: 30 days
- Monthly retention: 365 days

```
Daily: (600 MB × 7 × 1.2) = 5.04 GB
Weekly: (600 MB × 4.3 × 1.2) = 3.1 GB  (4.3 weeks in 30 days)
Monthly: (600 MB × 12 × 1.2) = 8.64 GB (12 months)
Total: ~17 GB
```

### Monitor Disk Space

```bash
# Check backup directory size
du -sh /home/automatedtradebot/backups

# Check individual backup sizes
du -h /home/automatedtradebot/backups/*/*.gz

# Check available disk space
df -h /home/automatedtradebot/backups
```

### Clean Up Space

```bash
# Manual cleanup
node scripts/backup.js cleanup

# Adjust retention policy in .env
BACKUP_RETENTION_DAILY=5
BACKUP_RETENTION_WEEKLY=21
BACKUP_RETENTION_MONTHLY=180

# Restart to apply new policy
pm2 restart automatedtradebot-api
```

---

## Troubleshooting

### Backup Fails

**Check PostgreSQL access**:
```bash
# Test database connection
PGPASSWORD="password" psql -h localhost -U user -d automatedtradebot -c "SELECT 1;"
```

**Check disk space**:
```bash
df -h /home/automatedtradebot/backups
```

**Check permissions**:
```bash
ls -la /home/automatedtradebot/backups
```

### Restore Fails

**Verify backup integrity**:
```bash
node scripts/backup.js verify backup-id
```

**Check gzip file**:
```bash
gzip -t /path/to/backup.sql.gz
```

**Manual database restore**:
```bash
gunzip -c backup.sql.gz | psql -U user -d automatedtradebot
```

### Remote Upload Fails

**Test S3 connection**:
```bash
aws s3 ls s3://your-bucket/ --endpoint-url=https://your-endpoint
```

**Check credentials**:
```bash
echo $BACKUP_S3_ACCESS_KEY
echo $BACKUP_S3_BUCKET
```

---

## Best Practices

### 1. Test Restores Regularly

```bash
# Create test restore environment
createdb automatedtradebot_test

# Test restore
gunzip -c backup.sql.gz | psql -U user -d automatedtradebot_test

# Verify data
psql -U user -d automatedtradebot_test -c "SELECT COUNT(*) FROM users;"

# Cleanup
dropdb automatedtradebot_test
```

### 2. Monitor Backup Health

- Check backup logs daily
- Verify last backup timestamp
- Monitor disk space usage
- Test restore monthly
- Alert on failed backups

### 3. Secure Backups

- Encrypt backups for sensitive data
- Restrict backup directory permissions
- Use separate S3 credentials
- Enable S3 versioning
- Enable S3 encryption at rest

### 4. Document Recovery Procedures

- Maintain recovery runbook
- Document required credentials
- Test disaster recovery plan
- Train team on restore procedures

### 5. Off-Site Backups

- Always enable S3 remote storage
- Use geographically distributed storage
- Verify off-site backups monthly
- Test cross-region restore

---

## Monitoring Integration

### Add to Monitoring Service

```javascript
// In monitoringService.js
async checkBackupHealth() {
    const stats = backupService.getBackupStats();
    const now = Date.now();
    const lastBackupAge = now - new Date(stats.lastBackup?.timestamp).getTime();
    const maxAge = 25 * 60 * 60 * 1000; // 25 hours

    if (lastBackupAge > maxAge) {
        await this.createAlert(
            'CRITICAL',
            'Backup System Alert',
            `Last backup was ${(lastBackupAge / (1000 * 60 * 60)).toFixed(1)} hours ago`
        );
    }
}
```

### API Endpoint

```javascript
// In routes/admin.js
router.get('/backups', authenticate, requireAdmin, async (req, res) => {
    const stats = backupService.getBackupStats();
    res.json({ success: true, data: stats });
});
```

---

## Support

For backup-related issues:
- Check logs: `tail -f logs/combined.log | grep backup`
- Verify configuration: `node scripts/backup.js stats`
- Test backup creation: `node scripts/backup.js create manual`
- Contact support: support@automatedtradebot.com

---

**Remember**: Backups are useless if you can't restore from them. Test your restores regularly!
