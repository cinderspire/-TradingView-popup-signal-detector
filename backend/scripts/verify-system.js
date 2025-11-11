#!/usr/bin/env node

/**
 * SYSTEM VERIFICATION SCRIPT
 *
 * Verifies all services and endpoints are working correctly
 */

const axios = require('axios');
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

const BASE_URL = process.env.API_URL || 'http://localhost:6864';

const tests = [
    {
        name: 'Health Check',
        endpoint: '/health',
        method: 'GET',
        auth: false,
        expectedStatus: 200,
        expectedFields: ['status', 'timestamp', 'uptime']
    },
    {
        name: 'API Root',
        endpoint: '/',
        method: 'GET',
        auth: false,
        expectedStatus: 200
    },
    {
        name: 'Auth - Login Endpoint',
        endpoint: '/api/auth/login',
        method: 'POST',
        auth: false,
        expectedStatus: 400,
        expectedFields: ['success']
    },
    {
        name: 'Auth - Register Endpoint',
        endpoint: '/api/auth/register',
        method: 'POST',
        auth: false,
        expectedStatus: 400,
        expectedFields: ['success']
    },
    {
        name: 'Providers - List',
        endpoint: '/api/providers',
        method: 'GET',
        auth: false,
        expectedStatus: 200,
        expectedFields: ['success']
    },
    {
        name: 'Signals - List',
        endpoint: '/api/signals',
        method: 'GET',
        auth: false,
        expectedStatus: 200,
        expectedFields: ['success']
    },
    {
        name: 'Real-Time - Prices',
        endpoint: '/api/realtime/prices',
        method: 'GET',
        auth: false,
        expectedStatus: 200,
        expectedFields: ['success']
    },
    {
        name: 'Real-Time - Verify Exchanges',
        endpoint: '/api/realtime/verify',
        method: 'GET',
        auth: false,
        expectedStatus: 200,
        expectedFields: ['success']
    },
    {
        name: 'Real-Time - Latency Test',
        endpoint: '/api/realtime/latency',
        method: 'GET',
        auth: false,
        expectedStatus: 200,
        expectedFields: ['success']
    },
    {
        name: 'Analytics - Overview (Auth Required)',
        endpoint: '/api/analytics/overview',
        method: 'GET',
        auth: true,
        expectedStatus: 401,
        expectedFields: ['success']
    },
    {
        name: 'Onboarding - Steps (Auth Required)',
        endpoint: '/api/onboarding/steps',
        method: 'GET',
        auth: true,
        expectedStatus: 401,
        expectedFields: ['success']
    },
    {
        name: 'Admin - Health (Auth Required)',
        endpoint: '/api/admin/monitoring/health',
        method: 'GET',
        auth: true,
        expectedStatus: 401,
        expectedFields: ['success']
    },
    {
        name: 'Trading - Strategies (Auth Required)',
        endpoint: '/api/trading/strategies',
        method: 'GET',
        auth: true,
        expectedStatus: 401,
        expectedFields: ['success']
    }
];

async function runTest(test) {
    try {
        const config = {
            method: test.method,
            url: `${BASE_URL}${test.endpoint}`,
            validateStatus: () => true // Don't throw on any status
        };

        const response = await axios(config);

        // Check status code
        const statusMatch = response.status === test.expectedStatus;

        // Check expected fields
        let fieldsMatch = true;
        if (test.expectedFields && response.data) {
            fieldsMatch = test.expectedFields.every(field =>
                response.data.hasOwnProperty(field)
            );
        }

        const success = statusMatch && fieldsMatch;

        return {
            name: test.name,
            success,
            status: response.status,
            expectedStatus: test.expectedStatus,
            statusMatch,
            fieldsMatch,
            responseTime: response.headers['x-response-time'] || 'N/A'
        };
    } catch (error) {
        return {
            name: test.name,
            success: false,
            error: error.message
        };
    }
}

async function main() {
    console.log('\n' + colors.blue + '========================================' + colors.reset);
    console.log(colors.blue + '   AutomatedTradeBot System Verification' + colors.reset);
    console.log(colors.blue + '========================================' + colors.reset + '\n');

    console.log(`Testing API at: ${colors.yellow}${BASE_URL}${colors.reset}\n`);

    const results = [];
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        process.stdout.write(`Testing ${test.name}... `);

        const result = await runTest(test);
        results.push(result);

        if (result.success) {
            console.log(colors.green + '✓ PASS' + colors.reset);
            passed++;
        } else {
            console.log(colors.red + '✗ FAIL' + colors.reset);
            if (result.error) {
                console.log(colors.red + `  Error: ${result.error}` + colors.reset);
            } else {
                if (!result.statusMatch) {
                    console.log(colors.red + `  Expected status ${result.expectedStatus}, got ${result.status}` + colors.reset);
                }
                if (!result.fieldsMatch) {
                    console.log(colors.red + `  Missing expected fields in response` + colors.reset);
                }
            }
            failed++;
        }
    }

    console.log('\n' + colors.blue + '========================================' + colors.reset);
    console.log(colors.blue + '   Summary' + colors.reset);
    console.log(colors.blue + '========================================' + colors.reset + '\n');

    console.log(`Total Tests: ${tests.length}`);
    console.log(colors.green + `Passed: ${passed}` + colors.reset);
    console.log(colors.red + `Failed: ${failed}` + colors.reset);
    console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%\n`);

    // Service Status
    console.log(colors.blue + '========================================' + colors.reset);
    console.log(colors.blue + '   Service Status' + colors.reset);
    console.log(colors.blue + '========================================' + colors.reset + '\n');

    try {
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        const health = healthResponse.data;

        console.log(colors.green + '✓ API Server: Online' + colors.reset);
        console.log(`  Uptime: ${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`);
        console.log(`  Environment: ${health.environment}`);
        console.log(`  Timestamp: ${new Date(health.timestamp).toLocaleString()}\n`);
    } catch (error) {
        console.log(colors.red + '✗ API Server: Offline or Unreachable' + colors.reset);
        console.log(colors.red + `  Error: ${error.message}\n` + colors.reset);
    }

    // Check real data services
    console.log(colors.blue + 'Exchange Connectivity:' + colors.reset);
    try {
        const verifyResponse = await axios.get(`${BASE_URL}/api/realtime/verify`);
        if (verifyResponse.data.success) {
            const exchanges = verifyResponse.data.exchanges;
            Object.entries(exchanges).forEach(([name, data]) => {
                if (data.status === 'connected') {
                    console.log(colors.green + `  ✓ ${name}: Connected (${data.latency}ms)` + colors.reset);
                } else {
                    console.log(colors.red + `  ✗ ${name}: ${data.status}` + colors.reset);
                }
            });
        }
    } catch (error) {
        console.log(colors.yellow + '  Unable to verify exchange connections' + colors.reset);
    }

    console.log('\n' + colors.blue + '========================================' + colors.reset);
    console.log(colors.blue + '   Recommendations' + colors.reset);
    console.log(colors.blue + '========================================' + colors.reset + '\n');

    if (failed === 0) {
        console.log(colors.green + '✓ All systems operational!' + colors.reset);
        console.log('  System is ready for production use.\n');
    } else {
        console.log(colors.yellow + '⚠ Some tests failed.' + colors.reset);
        console.log('  Please review failed tests above.\n');

        if (failed > 5) {
            console.log(colors.red + '⚠ Critical: Multiple failures detected.' + colors.reset);
            console.log('  Consider restarting the server with: pm2 restart automatedtradebot-api\n');
        }
    }

    console.log('Next Steps:');
    console.log('  1. Configure environment variables (.env)');
    console.log('  2. Add exchange API keys');
    console.log('  3. Configure Stripe payment keys');
    console.log('  4. Set up email service');
    console.log('  5. Run database migrations');
    console.log('  6. Test with real user accounts\n');

    console.log('Documentation:');
    console.log(`  - API Docs: ${colors.blue}./API_DOCUMENTATION.md${colors.reset}`);
    console.log(`  - Deployment: ${colors.blue}./PRODUCTION_DEPLOYMENT.md${colors.reset}`);
    console.log(`  - Status: ${colors.blue}./SYSTEM_STATUS.md${colors.reset}\n`);

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
    console.error(colors.red + '\nFatal Error:' + colors.reset, error.message);
    process.exit(1);
});
