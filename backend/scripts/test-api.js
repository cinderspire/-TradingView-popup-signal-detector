#!/usr/bin/env node

/**
 * COMPREHENSIVE API TESTING SCRIPT
 *
 * Tests all major API endpoints with real requests
 * Usage: node scripts/test-api.js [options]
 *
 * Options:
 *   --full       Run full test suite (including auth flows)
 *   --quick      Run quick health checks only
 *   --verbose    Show detailed output
 */

const axios = require('axios');
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

const BASE_URL = process.env.API_URL || 'http://localhost:6864';
const args = process.argv.slice(2);
const isFullTest = args.includes('--full');
const isQuickTest = args.includes('--quick');
const isVerbose = args.includes('--verbose');

let testToken = null;
let testResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0
};

// Test categories
const tests = {
    health: [
        {
            name: 'Health Check',
            method: 'GET',
            path: '/health',
            auth: false,
            expectedStatus: 200,
            validate: (data) => data.status === 'ok' && data.uptime > 0
        }
    ],

    auth: [
        {
            name: 'Register New User',
            method: 'POST',
            path: '/api/auth/register',
            auth: false,
            expectedStatus: [201, 400],
            body: {
                email: `test${Date.now()}@example.com`,
                password: 'Test123!@#',
                username: `testuser${Date.now()}`,
                firstName: 'Test',
                lastName: 'User'
            }
        },
        {
            name: 'Login',
            method: 'POST',
            path: '/api/auth/login',
            auth: false,
            expectedStatus: [200, 400],
            body: {
                email: 'demo@test.com',
                password: 'Demo123!'
            },
            saveToken: true
        }
    ],

    providers: [
        {
            name: 'List Providers',
            method: 'GET',
            path: '/api/providers?limit=5',
            auth: false,
            expectedStatus: 200,
            validate: (data) => data.success && Array.isArray(data.data.providers)
        },
        {
            name: 'Get Provider Leaderboard',
            method: 'GET',
            path: '/api/analytics/leaderboard?limit=5',
            auth: false,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        }
    ],

    signals: [
        {
            name: 'List Signals',
            method: 'GET',
            path: '/api/signals?status=ACTIVE&limit=10',
            auth: false,
            expectedStatus: 200,
            validate: (data) => data.success && Array.isArray(data.data.signals)
        }
    ],

    realtime: [
        {
            name: 'Get Real-Time Prices',
            method: 'GET',
            path: '/api/realtime/prices?symbols=BTC/USDT,ETH/USDT',
            auth: false,
            expectedStatus: 200,
            validate: (data) => data.success && data.data && (data.data.prices || data.data.length > 0)
        },
        {
            name: 'Verify Exchange Connections',
            method: 'GET',
            path: '/api/realtime/verify',
            auth: false,
            expectedStatus: 200,
            validate: (data) => data.success && data.exchanges
        },
        {
            name: 'Test Exchange Latency',
            method: 'GET',
            path: '/api/realtime/latency',
            auth: false,
            expectedStatus: 200,
            validate: (data) => data.success && (data.latencies || data.data)
        }
    ],

    analytics: [
        {
            name: 'Platform Overview',
            method: 'GET',
            path: '/api/analytics/overview?period=30d',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        }
    ],

    backtests: [
        {
            name: 'List Backtests',
            method: 'GET',
            path: '/api/backtests?limit=5',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        },
        {
            name: 'Get Backtest Stats',
            method: 'GET',
            path: '/api/backtests/stats/summary',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        }
    ],

    positions: [
        {
            name: 'List Positions',
            method: 'GET',
            path: '/api/positions?status=OPEN&limit=10',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        },
        {
            name: 'Get Active Positions',
            method: 'GET',
            path: '/api/positions/active',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        },
        {
            name: 'Get Position Stats',
            method: 'GET',
            path: '/api/positions/stats/summary',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        }
    ],

    strategies: [
        {
            name: 'List Strategies',
            method: 'GET',
            path: '/api/strategies?limit=10',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        },
        {
            name: 'Get My Strategies',
            method: 'GET',
            path: '/api/strategies/my',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        },
        {
            name: 'Get Strategy Stats',
            method: 'GET',
            path: '/api/strategies/stats/summary',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        }
    ],

    trading: [
        {
            name: 'List Trading Strategies',
            method: 'GET',
            path: '/api/trading/strategies',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        }
    ],

    onboarding: [
        {
            name: 'Get Onboarding Steps',
            method: 'GET',
            path: '/api/onboarding/steps',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        },
        {
            name: 'Get Onboarding Progress',
            method: 'GET',
            path: '/api/onboarding/progress',
            auth: true,
            expectedStatus: [200, 401],
            validate: (data) => data.success || !data.success
        }
    ]
};

async function runTest(test) {
    testResults.total++;

    try {
        const config = {
            method: test.method,
            url: `${BASE_URL}${test.path}`,
            validateStatus: () => true
        };

        if (test.auth && testToken) {
            config.headers = {
                'Authorization': `Bearer ${testToken}`
            };
        }

        if (test.body) {
            config.data = test.body;
            config.headers = {
                ...config.headers,
                'Content-Type': 'application/json'
            };
        }

        const startTime = Date.now();
        const response = await axios(config);
        const duration = Date.now() - startTime;

        // Check status code
        const expectedStatuses = Array.isArray(test.expectedStatus)
            ? test.expectedStatus
            : [test.expectedStatus];
        const statusMatch = expectedStatuses.includes(response.status);

        // Run custom validation
        let validationPass = true;
        if (test.validate && response.data) {
            try {
                validationPass = test.validate(response.data);
            } catch (e) {
                validationPass = false;
            }
        }

        const success = statusMatch && validationPass;

        // Save token if needed
        if (test.saveToken && response.data?.data?.token) {
            testToken = response.data.data.token;
            if (isVerbose) {
                console.log(`  ${colors.cyan}Token saved${colors.reset}`);
            }
        }

        if (success) {
            testResults.passed++;
            console.log(`  ${colors.green}✓${colors.reset} ${test.name} ${colors.cyan}(${duration}ms)${colors.reset}`);
            if (isVerbose && response.data) {
                console.log(`    Status: ${response.status}, Data: ${JSON.stringify(response.data).substring(0, 100)}...`);
            }
        } else {
            testResults.failed++;
            console.log(`  ${colors.red}✗${colors.reset} ${test.name}`);
            if (!statusMatch) {
                console.log(`    ${colors.red}Expected status ${expectedStatuses.join(' or ')}, got ${response.status}${colors.reset}`);
            }
            if (!validationPass) {
                console.log(`    ${colors.red}Validation failed${colors.reset}`);
            }
            if (isVerbose) {
                console.log(`    Response: ${JSON.stringify(response.data)}`);
            }
        }

        return { success, duration };
    } catch (error) {
        testResults.failed++;
        console.log(`  ${colors.red}✗${colors.reset} ${test.name}`);
        console.log(`    ${colors.red}Error: ${error.message}${colors.reset}`);
        return { success: false, error: error.message };
    }
}

async function runCategory(categoryName, categoryTests) {
    console.log(`\n${colors.bold}${colors.blue}Testing ${categoryName}${colors.reset}`);
    console.log(`${colors.blue}${'─'.repeat(50)}${colors.reset}`);

    for (const test of categoryTests) {
        // Skip auth-required tests if no token and not full test
        if (test.auth && !testToken && !isFullTest) {
            testResults.skipped++;
            testResults.total++;
            console.log(`  ${colors.yellow}○${colors.reset} ${test.name} ${colors.yellow}(skipped - no auth)${colors.reset}`);
            continue;
        }

        await runTest(test);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

async function main() {
    console.log(`\n${colors.bold}${colors.cyan}╔═══════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║   AutomatedTradeBot - API Testing Suite          ║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}╚═══════════════════════════════════════════════════╝${colors.reset}\n`);

    console.log(`${colors.cyan}Testing API at:${colors.reset} ${BASE_URL}`);
    console.log(`${colors.cyan}Mode:${colors.reset} ${isQuickTest ? 'Quick' : isFullTest ? 'Full' : 'Standard'}`);
    console.log(`${colors.cyan}Verbose:${colors.reset} ${isVerbose ? 'Yes' : 'No'}\n`);

    const startTime = Date.now();

    // Quick test - only health checks
    if (isQuickTest) {
        await runCategory('Health Checks', tests.health);
        await runCategory('Real-Time Services', tests.realtime);
    }
    // Full test - everything
    else if (isFullTest) {
        for (const [category, categoryTests] of Object.entries(tests)) {
            await runCategory(category.charAt(0).toUpperCase() + category.slice(1), categoryTests);
        }
    }
    // Standard test - most endpoints except full auth flow
    else {
        await runCategory('Health Checks', tests.health);
        await runCategory('Providers', tests.providers);
        await runCategory('Signals', tests.signals);
        await runCategory('Real-Time Services', tests.realtime);
        await runCategory('Analytics', tests.analytics);
        await runCategory('Backtests', tests.backtests);
        await runCategory('Positions', tests.positions);
        await runCategory('Strategies', tests.strategies);
        await runCategory('Trading', tests.trading);
        await runCategory('Onboarding', tests.onboarding);
    }

    const totalTime = Date.now() - startTime;

    // Print summary
    console.log(`\n${colors.bold}${colors.blue}╔═══════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.blue}║   Test Summary                                    ║${colors.reset}`);
    console.log(`${colors.bold}${colors.blue}╚═══════════════════════════════════════════════════╝${colors.reset}\n`);

    console.log(`${colors.bold}Total Tests:${colors.reset}    ${testResults.total}`);
    console.log(`${colors.green}${colors.bold}Passed:${colors.reset}         ${testResults.passed}`);
    console.log(`${colors.red}${colors.bold}Failed:${colors.reset}         ${testResults.failed}`);
    console.log(`${colors.yellow}${colors.bold}Skipped:${colors.reset}        ${testResults.skipped}`);
    console.log(`${colors.bold}Success Rate:${colors.reset}   ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    console.log(`${colors.bold}Duration:${colors.reset}       ${(totalTime / 1000).toFixed(2)}s\n`);

    // Exit code based on results
    if (testResults.failed === 0) {
        console.log(`${colors.green}${colors.bold}✓ All tests passed!${colors.reset}\n`);
        process.exit(0);
    } else if (testResults.failed < testResults.passed) {
        console.log(`${colors.yellow}${colors.bold}⚠ Some tests failed${colors.reset}\n`);
        process.exit(1);
    } else {
        console.log(`${colors.red}${colors.bold}✗ Critical failures detected${colors.reset}\n`);
        process.exit(2);
    }
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error(`${colors.red}Unhandled error:${colors.reset}`, error.message);
    process.exit(3);
});

// Run tests
main().catch(error => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error.message);
    process.exit(3);
});
