#!/usr/bin/env node

/**
 * DATABASE SEEDING SCRIPT
 *
 * Populates the database with demo data for testing and development
 * Usage: node scripts/seed-database.js [options]
 *
 * Options:
 *   --clear      Clear existing data before seeding
 *   --minimal    Seed minimal data only
 *   --full       Seed full dataset
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');
const isMinimal = args.includes('--minimal');
const isFull = args.includes('--full');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

// Demo users
const demoUsers = [
    {
        email: 'demo@test.com',
        password: 'Demo123!',
        username: 'demouser',
        firstName: 'Demo',
        lastName: 'User',
        role: 'USER'
    },
    {
        email: 'provider@test.com',
        password: 'Provider123!',
        username: 'demoprovider',
        firstName: 'Demo',
        lastName: 'Provider',
        role: 'PROVIDER'
    },
    {
        email: 'admin@test.com',
        password: 'Admin123!',
        username: 'demoadmin',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN'
    }
];

// Demo strategies
const demoStrategies = [
    {
        name: '7RSI Momentum Strategy',
        description: 'Uses 7-period RSI to identify overbought and oversold conditions across multiple timeframes',
        category: 'Technical',
        type: 'TECHNICAL',
        monthlyPrice: 29.99,
        parameters: {
            rsiPeriod: 7,
            rsiOverbought: 70,
            rsiOversold: 30,
            timeframes: ['15m', '1h', '4h']
        },
        targetPairs: ['XRP/USDT', 'SOL/USDT', 'BTC/USDT'],
        timeframes: ['15m', '1h', '4h'],
        isPublic: true,
        isActive: true
    },
    {
        name: '3RSI Scalping Strategy',
        description: 'Fast-paced RSI scalping strategy for quick profits',
        category: 'Technical',
        type: 'TECHNICAL',
        monthlyPrice: 19.99,
        parameters: {
            rsiPeriod: 3,
            rsiOverbought: 80,
            rsiOversold: 20
        },
        targetPairs: ['XRP/USDT', 'SOL/USDT'],
        timeframes: ['5m', '15m'],
        isPublic: true,
        isActive: true
    },
    {
        name: 'MACD Crossover Strategy',
        description: 'Classic MACD strategy with histogram confirmation',
        category: 'Technical',
        type: 'TECHNICAL',
        monthlyPrice: 24.99,
        parameters: {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9
        },
        targetPairs: ['BTC/USDT', 'ETH/USDT'],
        timeframes: ['1h', '4h'],
        isPublic: true,
        isActive: true
    }
];

// Demo providers
const demoProviders = [
    {
        displayName: 'Crypto Master Pro',
        description: 'Professional crypto trader with 5+ years experience. Specializing in RSI and momentum strategies.',
        tradingExperience: 5,
        specialties: ['XRP', 'SOL', 'BTC'],
        verified: true,
        monthlyFee: 3.00
    },
    {
        displayName: 'Whale Watcher',
        description: 'Expert in identifying whale movements and market manipulation patterns.',
        tradingExperience: 3,
        specialties: ['BTC', 'ETH'],
        verified: true,
        monthlyFee: 3.00
    }
];

// Demo signals
const demoSignals = (strategyId) => [
    {
        strategyId,
        type: 'ENTRY',
        pair: 'XRP/USDT',
        exchange: 'bybit',
        side: 'LONG',
        entryPrice: 0.5234,
        stopLoss: 0.5000,
        takeProfit: 0.5800,
        status: 'PENDING',
        timeframe: '1h'
    },
    {
        strategyId,
        type: 'ENTRY',
        pair: 'SOL/USDT',
        exchange: 'bybit',
        side: 'LONG',
        entryPrice: 145.67,
        stopLoss: 140.00,
        takeProfit: 155.00,
        status: 'PENDING',
        timeframe: '4h'
    },
    {
        strategyId,
        type: 'EXIT',
        pair: 'BTC/USDT',
        exchange: 'bybit',
        side: 'SHORT',
        entryPrice: 43520.50,
        stopLoss: 44000.00,
        takeProfit: 42000.00,
        status: 'FILLED',
        timeframe: '1h'
    }
];

async function clearData() {
    console.log(`\n${colors.yellow}Clearing existing data...${colors.reset}`);

    try {
        await prisma.notification.deleteMany({});
        await prisma.review.deleteMany({});
        await prisma.position.deleteMany({});
        await prisma.signal.deleteMany({});
        await prisma.backtest.deleteMany({});
        await prisma.strategy.deleteMany({});
        await prisma.subscription.deleteMany({});
        await prisma.transaction.deleteMany({});
        await prisma.apiKey.deleteMany({});
        await prisma.user.deleteMany({});

        console.log(`${colors.green}✓ Data cleared${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}✗ Error clearing data:${colors.reset}`, error.message);
        throw error;
    }
}

async function seedUsers() {
    console.log(`\n${colors.blue}Seeding users...${colors.reset}`);

    const createdUsers = [];

    for (const userData of demoUsers) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            const user = await prisma.user.upsert({
                where: { email: userData.email },
                update: {},
                create: {
                    email: userData.email,
                    password: hashedPassword,
                    username: userData.username,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    role: userData.role,
                    isActive: true,
                    emailVerified: true
                }
            });

            createdUsers.push(user);
            console.log(`  ${colors.green}✓${colors.reset} Created user: ${user.email} (${user.role})`);
        } catch (error) {
            console.log(`  ${colors.red}✗${colors.reset} Failed to create ${userData.email}: ${error.message}`);
        }
    }

    return createdUsers;
}

async function seedProviders(users) {
    console.log(`\n${colors.blue}Seeding providers...${colors.reset}`);
    console.log(`  ${colors.yellow}⚠ Provider model not in schema, skipping${colors.reset}`);
    return [];
}

async function seedStrategies(users) {
    console.log(`\n${colors.blue}Seeding strategies...${colors.reset}`);

    const providerUser = users.find(u => u.role === 'PROVIDER');
    if (!providerUser) {
        console.log(`  ${colors.yellow}⚠ No provider user found, skipping${colors.reset}`);
        return [];
    }

    const createdStrategies = [];

    for (const strategyData of demoStrategies) {
        try {
            // Extract and remove fields that don't match schema
            const { targetPairs, timeframes, ...cleanStrategyData } = strategyData;

            const strategy = await prisma.strategy.create({
                data: {
                    providerId: providerUser.id,
                    ...cleanStrategyData,
                    supportedPairs: targetPairs || [],
                    supportedTimeframes: timeframes || []
                }
            });

            createdStrategies.push(strategy);
            console.log(`  ${colors.green}✓${colors.reset} Created strategy: ${strategy.name}`);
        } catch (error) {
            console.log(`  ${colors.red}✗${colors.reset} Failed to create strategy: ${error.message}`);
        }
    }

    return createdStrategies;
}

async function seedSignals(strategies, providers) {
    if (strategies.length === 0) {
        console.log(`\n${colors.yellow}⚠ No strategies found, skipping signals${colors.reset}`);
        return [];
    }

    console.log(`\n${colors.blue}Seeding signals...${colors.reset}`);

    const createdSignals = [];

    const signalsData = demoSignals(strategies[0].id);

    for (const signalData of signalsData) {
        try {
            const signal = await prisma.signal.create({
                data: signalData
            });

            createdSignals.push(signal);
            console.log(`  ${colors.green}✓${colors.reset} Created signal: ${signal.pair} ${signal.side} (${signal.status})`);
        } catch (error) {
            console.log(`  ${colors.red}✗${colors.reset} Failed to create signal: ${error.message}`);
        }
    }

    return createdSignals;
}

async function seedBacktests(strategies, users) {
    if (strategies.length === 0 || users.length === 0) {
        console.log(`\n${colors.yellow}⚠ No strategies or users found, skipping backtests${colors.reset}`);
        return [];
    }

    console.log(`\n${colors.blue}Seeding backtests...${colors.reset}`);

    const providerUser = users.find(u => u.role === 'PROVIDER');
    if (!providerUser) return [];

    const createdBacktests = [];

    for (const strategy of strategies.slice(0, isMinimal ? 1 : 3)) {
        try {
            const backtest = await prisma.backtest.create({
                data: {
                    userId: providerUser.id,
                    strategyId: strategy.id,
                    pair: 'XRP/USDT',
                    timeframe: '1h',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-12-31'),
                    initialCapital: 10000,
                    status: 'COMPLETED',
                    totalTrades: 125,
                    winningTrades: 78,
                    losingTrades: 47,
                    winRate: 62.4,
                    totalReturn: 2450.00,
                    roi: 24.5,
                    profitFactor: 1.85,
                    sharpeRatio: 1.42,
                    maxDrawdown: 8.5,
                    avgWin: 42.50,
                    avgLoss: 23.00
                }
            });

            createdBacktests.push(backtest);
            console.log(`  ${colors.green}✓${colors.reset} Created backtest for ${strategy.name}`);
        } catch (error) {
            console.log(`  ${colors.red}✗${colors.reset} Failed to create backtest: ${error.message}`);
        }
    }

    return createdBacktests;
}

async function main() {
    console.log(`\n${colors.bold}${colors.cyan}╔═══════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║   AutomatedTradeBot - Database Seeding           ║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}╚═══════════════════════════════════════════════════╝${colors.reset}\n`);

    console.log(`${colors.cyan}Mode:${colors.reset} ${isMinimal ? 'Minimal' : isFull ? 'Full' : 'Standard'}`);
    console.log(`${colors.cyan}Clear existing:${colors.reset} ${shouldClear ? 'Yes' : 'No'}\n`);

    try {
        if (shouldClear) {
            await clearData();
        }

        const users = await seedUsers();
        const providers = await seedProviders(users);
        const strategies = await seedStrategies(users);
        const signals = await seedSignals(strategies, providers);

        if (!isMinimal) {
            const backtests = await seedBacktests(strategies, users);
        }

        console.log(`\n${colors.bold}${colors.green}╔═══════════════════════════════════════════════════╗${colors.reset}`);
        console.log(`${colors.bold}${colors.green}║   Seeding Complete!                               ║${colors.reset}`);
        console.log(`${colors.bold}${colors.green}╚═══════════════════════════════════════════════════╝${colors.reset}\n`);

        console.log(`${colors.green}✓ Created ${users.length} users${colors.reset}`);
        console.log(`${colors.green}✓ Created ${providers.length} providers${colors.reset}`);
        console.log(`${colors.green}✓ Created ${strategies.length} strategies${colors.reset}`);
        console.log(`${colors.green}✓ Created ${signals.length} signals${colors.reset}`);

        console.log(`\n${colors.cyan}Demo Credentials:${colors.reset}`);
        console.log(`  ${colors.bold}Trader:${colors.reset}   demo@test.com / Demo123!`);
        console.log(`  ${colors.bold}Provider:${colors.reset} provider@test.com / Provider123!`);
        console.log(`  ${colors.bold}Admin:${colors.reset}    admin@test.com / Admin123!\n`);

    } catch (error) {
        console.error(`\n${colors.red}${colors.bold}✗ Seeding failed:${colors.reset}`, error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
});
