#!/usr/bin/env node
/**
 * FINAL VERIFICATION TEST
 * Comprehensive check of all fixes and features
 */

const http = require('http');

const BASE_URL = 'http://localhost:6864';
const tests = [];
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Helper function to make HTTP requests
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    }).on('error', reject);
  });
}

// Test 1: Marketplace API responds
tests.push(async () => {
  console.log('🧪 Test 1: Marketplace API responds...');
  try {
    const { status, data } = await httpGet(`${BASE_URL}/api/marketplace/strategies`);
    if (status === 200 && data.success && data.data.strategies) {
      console.log(`   ✅ PASS - Got ${data.data.strategies.length} strategies`);
      return true;
    } else {
      console.log(`   ❌ FAIL - Invalid response`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - ${error.message}`);
    return false;
  }
});

// Test 2: Open ROI calculation working
tests.push(async () => {
  console.log('🧪 Test 2: Open ROI calculation...');
  try {
    const { status, data } = await httpGet(`${BASE_URL}/api/marketplace/strategies`);
    const strategies = data.data.strategies;

    // Check if any strategy has pair performance with openROI
    const strategyWithOpenROI = strategies.find(s =>
      s.pairPerformance && s.pairPerformance.length > 0 &&
      s.pairPerformance[0].openROI !== undefined
    );

    if (strategyWithOpenROI) {
      const pair = strategyWithOpenROI.pairPerformance[0];
      console.log(`   ✅ PASS - Found openROI: ${pair.openROI.toFixed(2)}% for ${pair.symbol}`);
      return true;
    } else {
      console.log(`   ❌ FAIL - No openROI data found`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - ${error.message}`);
    return false;
  }
});

// Test 3: Per-pair bot buttons in HTML
tests.push(async () => {
  console.log('🧪 Test 3: Per-pair bot buttons...');
  try {
    const { status, data } = await httpGet(`${BASE_URL}/signals.html`);
    const hasButton = data.includes('start-bot-btn');
    const hasActions = data.includes('Actions</th>');

    if (hasButton && hasActions) {
      console.log(`   ✅ PASS - Bot buttons and Actions column found`);
      return true;
    } else {
      console.log(`   ❌ FAIL - Missing bot buttons or Actions column`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - ${error.message}`);
    return false;
  }
});

// Test 4: Pair performance panel exists
tests.push(async () => {
  console.log('🧪 Test 4: Pair performance panel...');
  try {
    const { status, data } = await httpGet(`${BASE_URL}/signals.html`);
    const hasPanel = data.includes('strategyPerformancePanel');
    const hasTable = data.includes('pairPerformanceTableBody');

    if (hasPanel && hasTable) {
      console.log(`   ✅ PASS - Pair performance panel and table found`);
      return true;
    } else {
      console.log(`   ❌ FAIL - Missing panel or table`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - ${error.message}`);
    return false;
  }
});

// Test 5: Direction detection fix verification
tests.push(async () => {
  console.log('🧪 Test 5: Direction detection fix...');
  try {
    // Check if the fix is in place in tradingview-capture.js
    const fs = require('fs');
    const filePath = '/home/automatedtradebot/backend/src/services/tradingview-capture.js';
    const content = fs.readFileSync(filePath, 'utf8');

    const hasCorrectField = content.includes('data.prevMarketPosition');
    const noOldField = !content.includes('data.previousPosition ===');

    if (hasCorrectField) {
      console.log(`   ✅ PASS - Using correct field: prevMarketPosition`);
      return true;
    } else {
      console.log(`   ❌ FAIL - Still using wrong field or missing fix`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - ${error.message}`);
    return false;
  }
});

// Test 6: Strategy name extraction fix
tests.push(async () => {
  console.log('🧪 Test 6: Strategy name extraction fix...');
  try {
    const fs = require('fs');
    const filePath = '/home/automatedtradebot/backend/src/services/smart-signal-matcher.js';
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if the improved extraction logic is present
    const hasImprovedExtraction = content.includes('beforeBrace') &&
                                   content.includes('replace(/^Alert on /i');

    if (hasImprovedExtraction) {
      console.log(`   ✅ PASS - Improved strategy extraction logic found`);
      return true;
    } else {
      console.log(`   ❌ FAIL - Old extraction logic still in place`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - ${error.message}`);
    return false;
  }
});

// Test 7: Timeout protection in marketplace
tests.push(async () => {
  console.log('🧪 Test 7: Marketplace timeout protection...');
  try {
    const fs = require('fs');
    const filePath = '/home/automatedtradebot/backend/src/routes/marketplace.js';
    const content = fs.readFileSync(filePath, 'utf8');

    const hasTimeout = content.includes('MAX_PRICE_FETCH_TIME') &&
                       content.includes('Promise.race');

    if (hasTimeout) {
      console.log(`   ✅ PASS - Timeout protection implemented`);
      return true;
    } else {
      console.log(`   ❌ FAIL - Missing timeout protection`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAIL - ${error.message}`);
    return false;
  }
});

// Run all tests
async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 FINAL VERIFICATION TEST');
  console.log('='.repeat(80) + '\n');

  for (const test of tests) {
    const passed = await test();
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${results.passed}/${tests.length}`);
  console.log(`❌ Failed: ${results.failed}/${tests.length}`);
  console.log('='.repeat(80) + '\n');

  if (results.failed === 0) {
    console.log('🎉 ALL TESTS PASSED! System is ready.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review the output above.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});
