#!/usr/bin/env node

/**
 * PRODUCTION DEPLOYMENT CHECKLIST
 *
 * Verifies system is ready for production deployment
 * Usage: node scripts/deployment-check.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

const checks = {
    passed: 0,
    failed: 0,
    warnings: 0
};

function pass(message) {
    checks.passed++;
    console.log(`  ${colors.green}✓${colors.reset} ${message}`);
}

function fail(message) {
    checks.failed++;
    console.log(`  ${colors.red}✗${colors.reset} ${message}`);
}

function warn(message) {
    checks.warnings++;
    console.log(`  ${colors.yellow}⚠${colors.reset} ${message}`);
}

function section(title) {
    console.log(`\n${colors.bold}${colors.blue}${title}${colors.reset}`);
    console.log(`${colors.blue}${'─'.repeat(60)}${colors.reset}`);
}

async function checkEnvironmentVariables() {
    section('Environment Variables');

    const envPath = path.join(__dirname, '..', '.env');

    if (!fs.existsSync(envPath)) {
        fail('.env file not found');
        return;
    }

    pass('.env file exists');

    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredVars = [
        'NODE_ENV',
        'PORT',
        'DATABASE_URL',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET'
    ];

    const optionalVars = [
        'STRIPE_SECRET_KEY',
        'SENDGRID_API_KEY',
        'BYBIT_API_KEY'
    ];

    // Check required variables
    for (const varName of requiredVars) {
        if (envContent.includes(`${varName}=`) && !envContent.includes(`${varName}=your-`) && !envContent.includes(`${varName}=change`)) {
            pass(`${varName} is configured`);
        } else {
            fail(`${varName} is missing or not configured`);
        }
    }

    // Check optional variables
    for (const varName of optionalVars) {
        if (envContent.includes(`${varName}=`) && !envContent.includes(`${varName}=your-`)) {
            pass(`${varName} is configured (optional)`);
        } else {
            warn(`${varName} not configured (optional)`);
        }
    }

    // Check NODE_ENV is production
    if (envContent.includes('NODE_ENV=production')) {
        pass('NODE_ENV set to production');
    } else {
        warn('NODE_ENV not set to production');
    }
}

async function checkDatabaseConnection() {
    section('Database Connection');

    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        await prisma.$connect();
        pass('Database connection successful');

        // Check if tables exist
        const userCount = await prisma.user.count();
        pass(`Database tables exist (${userCount} users)`);

        await prisma.$disconnect();
    } catch (error) {
        fail(`Database connection failed: ${error.message}`);
    }
}

async function checkDependencies() {
    section('Dependencies');

    const packagePath = path.join(__dirname, '..', 'package.json');

    if (!fs.existsSync(packagePath)) {
        fail('package.json not found');
        return;
    }

    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    // Check critical dependencies
    const criticalDeps = [
        'express',
        'prisma',
        '@prisma/client',
        'jsonwebtoken',
        'bcryptjs',
        'socket.io',
        'cors',
        'helmet',
        'dotenv',
        'ccxt'
    ];

    for (const dep of criticalDeps) {
        if (pkg.dependencies && pkg.dependencies[dep]) {
            pass(`${dep} installed`);
        } else {
            fail(`${dep} not found in dependencies`);
        }
    }

    // Check if node_modules exists
    if (fs.existsSync(path.join(__dirname, '..', 'node_modules'))) {
        pass('node_modules directory exists');
    } else {
        fail('node_modules directory not found - run npm install');
    }
}

async function checkFiles() {
    section('Required Files');

    const requiredFiles = [
        'src/server.js',
        'prisma/schema.prisma',
        'ecosystem.config.js',
        'package.json',
        '.env'
    ];

    for (const file of requiredFiles) {
        const filePath = path.join(__dirname, '..', file);
        if (fs.existsSync(filePath)) {
            pass(`${file} exists`);
        } else {
            fail(`${file} not found`);
        }
    }

    // Check public directory
    const publicPath = path.join(__dirname, '..', 'public');
    if (fs.existsSync(publicPath)) {
        const htmlFiles = fs.readdirSync(publicPath).filter(f => f.endsWith('.html'));
        pass(`public directory exists (${htmlFiles.length} HTML files)`);
    } else {
        warn('public directory not found');
    }
}

async function checkPM2() {
    section('PM2 Process Manager');

    try {
        await execAsync('pm2 --version');
        pass('PM2 is installed');

        const { stdout } = await execAsync('pm2 jlist');
        const processes = JSON.parse(stdout);
        const automatedtradebotProcess = processes.find(p => p.name === 'automatedtradebot-api');

        if (automatedtradebotProcess) {
            if (automatedtradebotProcess.pm2_env.status === 'online') {
                pass('automatedtradebot-api process is running');
            } else {
                warn(`automatedtradebot-api status: ${automatedtradebotProcess.pm2_env.status}`);
            }
        } else {
            warn('automatedtradebot-api process not found in PM2');
        }
    } catch (error) {
        fail('PM2 not installed or not working');
    }
}

async function checkNginx() {
    section('Nginx Configuration');

    try {
        await execAsync('nginx -v');
        pass('Nginx is installed');

        try {
            await execAsync('nginx -t');
            pass('Nginx configuration is valid');
        } catch (error) {
            warn('Nginx configuration may have issues');
        }
    } catch (error) {
        warn('Nginx not installed (optional for production)');
    }
}

async function checkSSL() {
    section('SSL/HTTPS Configuration');

    const nginxConfigPaths = [
        '/etc/nginx/sites-available/automatedtradebot',
        '/etc/nginx/sites-enabled/automatedtradebot',
        '/etc/nginx/conf.d/automatedtradebot.conf'
    ];

    let nginxConfigFound = false;
    for (const configPath of nginxConfigPaths) {
        if (fs.existsSync(configPath)) {
            nginxConfigFound = true;
            pass(`Nginx config found: ${configPath}`);

            const config = fs.readFileSync(configPath, 'utf8');
            if (config.includes('ssl_certificate')) {
                pass('SSL certificate configured in Nginx');
            } else {
                warn('SSL certificate not configured');
            }
            break;
        }
    }

    if (!nginxConfigFound) {
        warn('Nginx configuration not found (optional)');
    }
}

async function checkBackups() {
    section('Backup System');

    const backupDir = path.join(__dirname, '..', '..', 'backups');

    if (fs.existsSync(backupDir)) {
        const backups = fs.readdirSync(backupDir);
        if (backups.length > 0) {
            pass(`Backup directory exists (${backups.length} backups)`);
        } else {
            warn('Backup directory is empty');
        }
    } else {
        warn('Backup directory not found');
    }

    // Check backup script
    const backupScript = path.join(__dirname, 'backup.js');
    if (fs.existsSync(backupScript)) {
        pass('Backup script exists');
    } else {
        fail('Backup script not found');
    }
}

async function checkLogs() {
    section('Logging Configuration');

    const logsDir = path.join(__dirname, '..', 'logs');

    if (fs.existsSync(logsDir)) {
        pass('logs directory exists');

        const logFiles = ['combined.log', 'error.log'];
        for (const logFile of logFiles) {
            if (fs.existsSync(path.join(logsDir, logFile))) {
                pass(`${logFile} exists`);
            } else {
                warn(`${logFile} not found`);
            }
        }
    } else {
        warn('logs directory not found');
    }
}

async function checkSecurity() {
    section('Security Checks');

    const envPath = path.join(__dirname, '..', '.env');

    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');

        // Check JWT secrets are not default
        if (envContent.includes('change-this') || envContent.includes('your-secret')) {
            fail('JWT secrets are still default values');
        } else {
            pass('JWT secrets appear to be customized');
        }

        // Check password strength requirements
        if (envContent.includes('PASSWORD_MIN_LENGTH')) {
            pass('Password requirements configured');
        } else {
            warn('Password requirements not explicitly configured');
        }

        // Check CORS configuration
        if (envContent.includes('CORS_ORIGIN')) {
            pass('CORS origin configured');
        } else {
            warn('CORS origin not configured (will allow all origins)');
        }
    }

    // Check file permissions
    try {
        const stats = fs.statSync(envPath);
        const permissions = (stats.mode & parseInt('777', 8)).toString(8);
        if (permissions === '600' || permissions === '644') {
            pass(`.env file permissions are secure (${permissions})`);
        } else {
            warn(`.env file permissions may be too open (${permissions})`);
        }
    } catch (error) {
        warn('Could not check .env file permissions');
    }
}

async function checkAPIHealth() {
    section('API Health Check');

    const axios = require('axios');
    const port = process.env.PORT || 6864;

    try {
        const response = await axios.get(`http://localhost:${port}/health`, {
            timeout: 5000
        });

        if (response.status === 200 && response.data.status === 'ok') {
            pass(`API is responding on port ${port}`);
            pass(`Uptime: ${Math.floor(response.data.uptime / 60)} minutes`);
        } else {
            warn('API health check returned unexpected response');
        }
    } catch (error) {
        fail(`API health check failed: ${error.message}`);
    }
}

async function generateReport() {
    console.log(`\n${colors.bold}${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║   Deployment Readiness Summary                                ║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    const total = checks.passed + checks.failed + checks.warnings;

    console.log(`${colors.bold}Total Checks:${colors.reset}     ${total}`);
    console.log(`${colors.green}${colors.bold}Passed:${colors.reset}           ${checks.passed}`);
    console.log(`${colors.red}${colors.bold}Failed:${colors.reset}           ${checks.failed}`);
    console.log(`${colors.yellow}${colors.bold}Warnings:${colors.reset}         ${checks.warnings}\n`);

    const score = (checks.passed / total * 100).toFixed(1);
    console.log(`${colors.bold}Readiness Score:${colors.reset}  ${score}%\n`);

    if (checks.failed === 0 && checks.warnings === 0) {
        console.log(`${colors.green}${colors.bold}✓ System is ready for production deployment!${colors.reset}\n`);
        return 0;
    } else if (checks.failed === 0) {
        console.log(`${colors.yellow}${colors.bold}⚠ System is mostly ready, but has some warnings${colors.reset}`);
        console.log(`  Review warnings above before deploying to production.\n`);
        return 0;
    } else {
        console.log(`${colors.red}${colors.bold}✗ System is NOT ready for production${colors.reset}`);
        console.log(`  Fix failed checks above before deploying.\n`);
        return 1;
    }
}

async function main() {
    console.log(`\n${colors.bold}${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║   AutomatedTradeBot - Production Deployment Checklist        ║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    try {
        await checkEnvironmentVariables();
        await checkDatabaseConnection();
        await checkDependencies();
        await checkFiles();
        await checkPM2();
        await checkNginx();
        await checkSSL();
        await checkBackups();
        await checkLogs();
        await checkSecurity();
        await checkAPIHealth();

        const exitCode = await generateReport();
        process.exit(exitCode);
    } catch (error) {
        console.error(`\n${colors.red}${colors.bold}Fatal error:${colors.reset}`, error.message);
        process.exit(2);
    }
}

main();
