#!/bin/bash

##############################################################################
# Database Backup Script
# Automated PostgreSQL backup with S3/local storage
# Run daily via cron: 0 2 * * * /path/to/db-backup.sh
##############################################################################

# Configuration
DB_NAME="automatedtradebot"
DB_USER="postgres"
BACKUP_DIR="/home/automatedtradebot/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

# S3 Configuration (optional)
S3_BUCKET="s3://your-backup-bucket"
USE_S3=false

# Create backup directory if doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting database backup..."
echo "Database: $DB_NAME"
echo "Timestamp: $TIMESTAMP"

# Perform backup
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully: $BACKUP_FILE"

    # Get file size
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "📦 Backup size: $FILE_SIZE"

    # Upload to S3 if configured
    if [ "$USE_S3" = true ]; then
        echo "☁️  Uploading to S3..."
        aws s3 cp "$BACKUP_FILE" "$S3_BUCKET/" --storage-class STANDARD_IA

        if [ $? -eq 0 ]; then
            echo "✅ Uploaded to S3 successfully"
        else
            echo "❌ S3 upload failed"
        fi
    fi

    # Clean up old backups (keep last N days)
    echo "🗑️  Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
    find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete

    echo "✅ Backup completed successfully"

else
    echo "❌ Backup failed!"
    exit 1
fi

# List recent backups
echo ""
echo "📋 Recent backups:"
ls -lh "$BACKUP_DIR" | tail -5

exit 0
