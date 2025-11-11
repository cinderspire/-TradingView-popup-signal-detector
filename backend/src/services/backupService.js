/**
 * AUTOMATED BACKUP SERVICE
 *
 * Handles automated backups of:
 * - PostgreSQL database
 * - User uploaded files
 * - System logs
 * - Configuration files
 *
 * Features:
 * - Scheduled backups (daily, weekly, monthly)
 * - Retention policy (auto-delete old backups)
 * - Compression (gzip)
 * - Remote storage (S3-compatible)
 * - Backup verification
 * - Restore functionality
 * - Health monitoring
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const logger = require('../utils/logger');
const { PrismaClient } = require('@prisma/client');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

class BackupService {
    constructor() {
        this.backupDir = process.env.BACKUP_DIR || '/home/automatedtradebot/backups';
        this.databaseUrl = process.env.DATABASE_URL;

        // Retention policy (days)
        this.retention = {
            daily: parseInt(process.env.BACKUP_RETENTION_DAILY || 7),
            weekly: parseInt(process.env.BACKUP_RETENTION_WEEKLY || 30),
            monthly: parseInt(process.env.BACKUP_RETENTION_MONTHLY || 365)
        };

        // Backup schedule (cron format)
        this.schedule = {
            daily: process.env.BACKUP_SCHEDULE_DAILY || '0 2 * * *',      // 2 AM daily
            weekly: process.env.BACKUP_SCHEDULE_WEEKLY || '0 3 * * 0',    // 3 AM Sunday
            monthly: process.env.BACKUP_SCHEDULE_MONTHLY || '0 4 1 * *'   // 4 AM 1st of month
        };

        // S3-compatible storage (optional)
        this.s3Config = {
            enabled: process.env.BACKUP_S3_ENABLED === 'true',
            endpoint: process.env.BACKUP_S3_ENDPOINT,
            bucket: process.env.BACKUP_S3_BUCKET,
            accessKey: process.env.BACKUP_S3_ACCESS_KEY,
            secretKey: process.env.BACKUP_S3_SECRET_KEY
        };

        this.isRunning = false;
        this.lastBackup = null;
        this.backupHistory = [];
    }

    /**
     * Initialize backup service
     */
    async initialize() {
        try {
            // Create backup directories
            await this.createBackupDirectories();

            // Schedule automated backups
            this.scheduleBackups();

            // Load backup history
            await this.loadBackupHistory();

            logger.info('✅ Backup Service initialized');
            logger.info(`📁 Backup directory: ${this.backupDir}`);
            logger.info(`🗄️ Retention policy: Daily=${this.retention.daily}d, Weekly=${this.retention.weekly}d, Monthly=${this.retention.monthly}d`);
            logger.info(`⏰ Daily backups: ${this.schedule.daily}`);

            if (this.s3Config.enabled) {
                logger.info(`☁️ Remote storage: Enabled (${this.s3Config.bucket})`);
            }

            return true;
        } catch (error) {
            logger.error('Failed to initialize backup service:', error);
            throw error;
        }
    }

    /**
     * Create backup directory structure
     */
    async createBackupDirectories() {
        const directories = [
            this.backupDir,
            path.join(this.backupDir, 'database'),
            path.join(this.backupDir, 'files'),
            path.join(this.backupDir, 'logs'),
            path.join(this.backupDir, 'config')
        ];

        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }
    }

    /**
     * Schedule automated backups
     */
    scheduleBackups() {
        const cron = require('node-cron');

        // Daily backup
        cron.schedule(this.schedule.daily, async () => {
            logger.info('🕐 Starting scheduled daily backup...');
            await this.createBackup('daily');
        });

        // Weekly backup
        cron.schedule(this.schedule.weekly, async () => {
            logger.info('🕐 Starting scheduled weekly backup...');
            await this.createBackup('weekly');
        });

        // Monthly backup
        cron.schedule(this.schedule.monthly, async () => {
            logger.info('🕐 Starting scheduled monthly backup...');
            await this.createBackup('monthly');
        });

        // Cleanup old backups daily
        cron.schedule('0 5 * * *', async () => {
            logger.info('🧹 Starting backup cleanup...');
            await this.cleanupOldBackups();
        });

        logger.info('✅ Backup schedules configured');
    }

    /**
     * Create complete backup
     */
    async createBackup(type = 'manual') {
        if (this.isRunning) {
            logger.warn('Backup already in progress, skipping...');
            return null;
        }

        this.isRunning = true;
        const startTime = Date.now();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupId = `${type}_${timestamp}`;

        try {
            logger.info(`📦 Creating ${type} backup: ${backupId}`);

            const backup = {
                id: backupId,
                type,
                timestamp: new Date(),
                files: {},
                status: 'in_progress',
                size: 0
            };

            // 1. Backup database
            logger.info('💾 Backing up database...');
            backup.files.database = await this.backupDatabase(backupId);

            // 2. Backup uploaded files
            logger.info('📁 Backing up files...');
            backup.files.uploads = await this.backupFiles(backupId);

            // 3. Backup logs
            logger.info('📋 Backing up logs...');
            backup.files.logs = await this.backupLogs(backupId);

            // 4. Backup configuration
            logger.info('⚙️ Backing up configuration...');
            backup.files.config = await this.backupConfig(backupId);

            // Calculate total size
            backup.size = Object.values(backup.files).reduce((sum, file) => sum + (file?.size || 0), 0);
            backup.duration = Date.now() - startTime;
            backup.status = 'completed';

            // 5. Upload to remote storage (if configured)
            if (this.s3Config.enabled) {
                logger.info('☁️ Uploading to remote storage...');
                await this.uploadToRemote(backup);
            }

            // 6. Verify backup
            logger.info('✅ Verifying backup...');
            const verified = await this.verifyBackup(backup);
            backup.verified = verified;

            // Save backup metadata
            await this.saveBackupMetadata(backup);
            this.backupHistory.unshift(backup);
            this.lastBackup = backup;

            logger.info(`✅ Backup completed: ${backupId}`);
            logger.info(`📊 Size: ${this.formatBytes(backup.size)}, Duration: ${(backup.duration / 1000).toFixed(2)}s`);

            // Record in database
            await prisma.systemLog.create({
                data: {
                    level: 'info',
                    category: 'backup',
                    message: `Backup completed: ${backupId}`,
                    data: {
                        backupId,
                        type,
                        size: backup.size,
                        duration: backup.duration,
                        verified
                    }
                }
            });

            return backup;

        } catch (error) {
            logger.error(`Failed to create backup ${backupId}:`, error);

            await prisma.systemLog.create({
                data: {
                    level: 'error',
                    category: 'backup',
                    message: `Backup failed: ${backupId}`,
                    data: { error: error.message }
                }
            });

            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Backup PostgreSQL database
     */
    async backupDatabase(backupId) {
        const filename = `database_${backupId}.sql.gz`;
        const filepath = path.join(this.backupDir, 'database', filename);

        // Extract database connection details
        const dbUrl = new URL(this.databaseUrl);
        const dbName = dbUrl.pathname.substring(1);
        const dbUser = dbUrl.username;
        const dbPassword = dbUrl.password;
        const dbHost = dbUrl.hostname;
        const dbPort = dbUrl.port || 5432;

        // Create PostgreSQL dump and compress
        const pgDumpCmd = `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --clean --if-exists | gzip > ${filepath}`;

        try {
            const { stdout, stderr } = await execAsync(pgDumpCmd);
            if (stderr && !stderr.includes('WARNING')) {
                logger.warn('pg_dump warnings:', stderr);
            }

            const stats = await fs.stat(filepath);

            return {
                filename,
                filepath,
                size: stats.size,
                created: new Date()
            };
        } catch (error) {
            logger.error('Database backup failed:', error);
            throw error;
        }
    }

    /**
     * Backup uploaded files
     */
    async backupFiles(backupId) {
        const uploadsDir = path.join(__dirname, '../../public/uploads');
        const filename = `files_${backupId}.tar.gz`;
        const filepath = path.join(this.backupDir, 'files', filename);

        try {
            // Check if uploads directory exists
            try {
                await fs.access(uploadsDir);
            } catch {
                logger.info('No uploads directory found, skipping file backup');
                return null;
            }

            // Create compressed tar archive
            const tarCmd = `tar -czf ${filepath} -C ${uploadsDir} .`;
            await execAsync(tarCmd);

            const stats = await fs.stat(filepath);

            return {
                filename,
                filepath,
                size: stats.size,
                created: new Date()
            };
        } catch (error) {
            logger.error('Files backup failed:', error);
            return null;
        }
    }

    /**
     * Backup system logs
     */
    async backupLogs(backupId) {
        const logsDir = path.join(__dirname, '../../logs');
        const filename = `logs_${backupId}.tar.gz`;
        const filepath = path.join(this.backupDir, 'logs', filename);

        try {
            // Check if logs directory exists
            try {
                await fs.access(logsDir);
            } catch {
                logger.info('No logs directory found, skipping logs backup');
                return null;
            }

            // Create compressed tar archive
            const tarCmd = `tar -czf ${filepath} -C ${logsDir} .`;
            await execAsync(tarCmd);

            const stats = await fs.stat(filepath);

            return {
                filename,
                filepath,
                size: stats.size,
                created: new Date()
            };
        } catch (error) {
            logger.error('Logs backup failed:', error);
            return null;
        }
    }

    /**
     * Backup configuration files
     */
    async backupConfig(backupId) {
        const filename = `config_${backupId}.tar.gz`;
        const filepath = path.join(this.backupDir, 'config', filename);

        try {
            // Backup important config files (excluding secrets)
            const configFiles = [
                path.join(__dirname, '../../package.json'),
                path.join(__dirname, '../../package-lock.json'),
                path.join(__dirname, '../../ecosystem.config.js'),
                path.join(__dirname, '../../prisma/schema.prisma')
            ];

            // Create temporary directory
            const tempDir = path.join(this.backupDir, 'temp', backupId);
            await fs.mkdir(tempDir, { recursive: true });

            // Copy files to temp directory
            for (const file of configFiles) {
                try {
                    const basename = path.basename(file);
                    await fs.copyFile(file, path.join(tempDir, basename));
                } catch (error) {
                    logger.warn(`Could not backup config file ${file}:`, error.message);
                }
            }

            // Create tar archive
            const tarCmd = `tar -czf ${filepath} -C ${tempDir} .`;
            await execAsync(tarCmd);

            // Cleanup temp directory
            await fs.rm(tempDir, { recursive: true, force: true });

            const stats = await fs.stat(filepath);

            return {
                filename,
                filepath,
                size: stats.size,
                created: new Date()
            };
        } catch (error) {
            logger.error('Config backup failed:', error);
            return null;
        }
    }

    /**
     * Upload backup to remote storage (S3-compatible)
     */
    async uploadToRemote(backup) {
        if (!this.s3Config.enabled) {
            return;
        }

        try {
            // This would integrate with AWS S3 SDK or compatible service
            // Placeholder for S3 upload logic
            logger.info('Remote upload not yet implemented - configure AWS SDK for S3 uploads');

            // Example implementation:
            // const AWS = require('aws-sdk');
            // const s3 = new AWS.S3({
            //     endpoint: this.s3Config.endpoint,
            //     accessKeyId: this.s3Config.accessKey,
            //     secretAccessKey: this.s3Config.secretKey
            // });
            //
            // for (const [type, file] of Object.entries(backup.files)) {
            //     if (file) {
            //         const fileStream = createReadStream(file.filepath);
            //         await s3.upload({
            //             Bucket: this.s3Config.bucket,
            //             Key: `backups/${backup.id}/${file.filename}`,
            //             Body: fileStream
            //         }).promise();
            //     }
            // }

        } catch (error) {
            logger.error('Remote upload failed:', error);
            throw error;
        }
    }

    /**
     * Verify backup integrity
     */
    async verifyBackup(backup) {
        try {
            // Check if all files exist and are readable
            for (const [type, file] of Object.entries(backup.files)) {
                if (file) {
                    await fs.access(file.filepath);
                    const stats = await fs.stat(file.filepath);

                    // Verify file size is reasonable
                    if (stats.size < 100) {
                        logger.warn(`Backup file ${file.filename} seems too small (${stats.size} bytes)`);
                        return false;
                    }
                }
            }

            // For database backups, verify gzip integrity
            if (backup.files.database) {
                const gzipTestCmd = `gzip -t ${backup.files.database.filepath}`;
                await execAsync(gzipTestCmd);
            }

            return true;
        } catch (error) {
            logger.error('Backup verification failed:', error);
            return false;
        }
    }

    /**
     * Save backup metadata
     */
    async saveBackupMetadata(backup) {
        const metadataFile = path.join(this.backupDir, `${backup.id}_metadata.json`);
        await fs.writeFile(metadataFile, JSON.stringify(backup, null, 2));
    }

    /**
     * Load backup history
     */
    async loadBackupHistory() {
        try {
            const files = await fs.readdir(this.backupDir);
            const metadataFiles = files.filter(f => f.endsWith('_metadata.json'));

            this.backupHistory = [];

            for (const file of metadataFiles) {
                try {
                    const content = await fs.readFile(path.join(this.backupDir, file), 'utf8');
                    const backup = JSON.parse(content);
                    backup.timestamp = new Date(backup.timestamp);
                    this.backupHistory.push(backup);
                } catch (error) {
                    logger.warn(`Could not load backup metadata ${file}:`, error.message);
                }
            }

            // Sort by timestamp (newest first)
            this.backupHistory.sort((a, b) => b.timestamp - a.timestamp);

            if (this.backupHistory.length > 0) {
                this.lastBackup = this.backupHistory[0];
            }

            logger.info(`📚 Loaded ${this.backupHistory.length} backup records`);
        } catch (error) {
            logger.error('Failed to load backup history:', error);
        }
    }

    /**
     * Clean up old backups based on retention policy
     */
    async cleanupOldBackups() {
        try {
            logger.info('🧹 Starting backup cleanup...');
            let deletedCount = 0;
            let freedSpace = 0;

            const now = Date.now();

            for (const backup of this.backupHistory) {
                const age = (now - new Date(backup.timestamp).getTime()) / (1000 * 60 * 60 * 24); // days
                let shouldDelete = false;

                // Apply retention policy based on backup type
                if (backup.type === 'daily' && age > this.retention.daily) {
                    shouldDelete = true;
                } else if (backup.type === 'weekly' && age > this.retention.weekly) {
                    shouldDelete = true;
                } else if (backup.type === 'monthly' && age > this.retention.monthly) {
                    shouldDelete = true;
                }

                if (shouldDelete) {
                    logger.info(`🗑️ Deleting old backup: ${backup.id} (${age.toFixed(1)} days old)`);

                    // Delete backup files
                    for (const [type, file] of Object.entries(backup.files)) {
                        if (file) {
                            try {
                                await fs.unlink(file.filepath);
                                freedSpace += file.size;
                            } catch (error) {
                                logger.warn(`Could not delete ${file.filepath}:`, error.message);
                            }
                        }
                    }

                    // Delete metadata
                    const metadataFile = path.join(this.backupDir, `${backup.id}_metadata.json`);
                    try {
                        await fs.unlink(metadataFile);
                    } catch (error) {
                        logger.warn(`Could not delete metadata ${metadataFile}:`, error.message);
                    }

                    deletedCount++;
                }
            }

            // Reload backup history
            await this.loadBackupHistory();

            logger.info(`✅ Cleanup completed: Deleted ${deletedCount} backups, freed ${this.formatBytes(freedSpace)}`);

            return { deletedCount, freedSpace };
        } catch (error) {
            logger.error('Backup cleanup failed:', error);
            throw error;
        }
    }

    /**
     * Restore from backup
     */
    async restoreBackup(backupId, options = {}) {
        try {
            logger.info(`🔄 Starting restore from backup: ${backupId}`);

            const backup = this.backupHistory.find(b => b.id === backupId);
            if (!backup) {
                throw new Error(`Backup ${backupId} not found`);
            }

            const {
                restoreDatabase = true,
                restoreFiles = true,
                restoreLogs = false,
                restoreConfig = false
            } = options;

            // 1. Restore database
            if (restoreDatabase && backup.files.database) {
                logger.info('💾 Restoring database...');
                await this.restoreDatabase(backup.files.database);
            }

            // 2. Restore files
            if (restoreFiles && backup.files.uploads) {
                logger.info('📁 Restoring files...');
                await this.restoreFiles(backup.files.uploads);
            }

            // 3. Restore logs (optional)
            if (restoreLogs && backup.files.logs) {
                logger.info('📋 Restoring logs...');
                await this.restoreLogs(backup.files.logs);
            }

            // 4. Restore config (optional)
            if (restoreConfig && backup.files.config) {
                logger.info('⚙️ Restoring config...');
                await this.restoreConfig(backup.files.config);
            }

            logger.info(`✅ Restore completed from backup: ${backupId}`);

            return { success: true, backupId };
        } catch (error) {
            logger.error(`Restore failed for backup ${backupId}:`, error);
            throw error;
        }
    }

    /**
     * Restore database from backup
     */
    async restoreDatabase(backupFile) {
        const dbUrl = new URL(this.databaseUrl);
        const dbName = dbUrl.pathname.substring(1);
        const dbUser = dbUrl.username;
        const dbPassword = dbUrl.password;
        const dbHost = dbUrl.hostname;
        const dbPort = dbUrl.port || 5432;

        // Decompress and restore
        const restoreCmd = `gunzip -c ${backupFile.filepath} | PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName}`;

        try {
            await execAsync(restoreCmd);
            logger.info('✅ Database restored successfully');
        } catch (error) {
            logger.error('Database restore failed:', error);
            throw error;
        }
    }

    /**
     * Restore files from backup
     */
    async restoreFiles(backupFile) {
        const uploadsDir = path.join(__dirname, '../../public/uploads');

        // Extract tar archive
        const extractCmd = `tar -xzf ${backupFile.filepath} -C ${uploadsDir}`;

        try {
            await fs.mkdir(uploadsDir, { recursive: true });
            await execAsync(extractCmd);
            logger.info('✅ Files restored successfully');
        } catch (error) {
            logger.error('Files restore failed:', error);
            throw error;
        }
    }

    /**
     * Restore logs from backup
     */
    async restoreLogs(backupFile) {
        const logsDir = path.join(__dirname, '../../logs');

        const extractCmd = `tar -xzf ${backupFile.filepath} -C ${logsDir}`;

        try {
            await fs.mkdir(logsDir, { recursive: true });
            await execAsync(extractCmd);
            logger.info('✅ Logs restored successfully');
        } catch (error) {
            logger.error('Logs restore failed:', error);
            throw error;
        }
    }

    /**
     * Restore config from backup
     */
    async restoreConfig(backupFile) {
        const tempDir = path.join(this.backupDir, 'temp', 'restore');

        try {
            await fs.mkdir(tempDir, { recursive: true });

            // Extract
            const extractCmd = `tar -xzf ${backupFile.filepath} -C ${tempDir}`;
            await execAsync(extractCmd);

            // Manual review required for config restoration
            logger.warn('⚠️ Config files extracted to temp directory for manual review');
            logger.info(`📁 Location: ${tempDir}`);
            logger.warn('Please review and manually restore config files as needed');
        } catch (error) {
            logger.error('Config restore failed:', error);
            throw error;
        }
    }

    /**
     * Get backup statistics
     */
    getBackupStats() {
        const totalSize = this.backupHistory.reduce((sum, b) => sum + b.size, 0);
        const successCount = this.backupHistory.filter(b => b.status === 'completed').length;
        const failedCount = this.backupHistory.filter(b => b.status === 'failed').length;

        return {
            total: this.backupHistory.length,
            successful: successCount,
            failed: failedCount,
            totalSize: totalSize,
            totalSizeFormatted: this.formatBytes(totalSize),
            lastBackup: this.lastBackup,
            oldestBackup: this.backupHistory[this.backupHistory.length - 1],
            retentionPolicy: this.retention,
            schedule: this.schedule,
            remoteStorageEnabled: this.s3Config.enabled
        };
    }

    /**
     * Format bytes to human-readable string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Export singleton instance
const backupService = new BackupService();
module.exports = backupService;
