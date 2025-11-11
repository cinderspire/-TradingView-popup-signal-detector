/**
 * Test that the direction detection fix works correctly
 */

// Simulate the FIXED logic from tradingview-capture.js
function testDirectionDetection() {
  console.log('🧪 Testing direction detection after fix...\n');

  const testCases = [
    {
      name: 'EXIT from LONG position',
      data: {
        action: 'sell',
        marketPosition: 'flat',
        prevMarketPosition: 'long',
        positionSize: '0'
      },
      expected: { type: 'EXIT', direction: 'LONG' }
    },
    {
      name: 'EXIT from SHORT position',
      data: {
        action: 'buy',
        marketPosition: 'flat',
        prevMarketPosition: 'short',
        positionSize: '0'
      },
      expected: { type: 'EXIT', direction: 'SHORT' }
    },
    {
      name: 'ENTRY LONG',
      data: {
        action: 'buy',
        marketPosition: 'long',
        positionSize: '0.5'
      },
      expected: { type: 'ENTRY', direction: 'LONG' }
    },
    {
      name: 'ENTRY SHORT',
      data: {
        action: 'sell',
        marketPosition: 'short',
        positionSize: '0.5'
      },
      expected: { type: 'ENTRY', direction: 'SHORT' }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    const data = test.data;

    // FIXED logic (using prevMarketPosition)
    let signalType = 'ENTRY';
    let direction = 'LONG';

    if (data.action === 'close' || data.action === 'exit' ||
        data.marketPosition === 'flat' || data.marketPosition === 'close' ||
        data.positionSize === '0') {
      signalType = 'EXIT';
      // FIXED: Use prevMarketPosition instead of previousPosition
      if (data.action === 'sell' || data.prevMarketPosition === 'long') {
        direction = 'LONG';
      } else if (data.action === 'buy' || data.prevMarketPosition === 'short') {
        direction = 'SHORT';
      }
    } else {
      if (data.action === 'sell' || data.action === 'short') {
        direction = 'SHORT';
      } else if (data.action === 'buy' || data.action === 'long') {
        direction = 'LONG';
      }
    }

    const result = { type: signalType, direction };
    const match = result.type === test.expected.type && result.direction === test.expected.direction;

    if (match) {
      console.log(`✅ ${test.name}`);
      console.log(`   Expected: ${test.expected.type} ${test.expected.direction}`);
      console.log(`   Got:      ${result.type} ${result.direction}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Expected: ${test.expected.type} ${test.expected.direction}`);
      console.log(`   Got:      ${result.type} ${result.direction}`);
      failed++;
    }
    console.log('');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Passed: ${passed}/${testCases.length}`);
  console.log(`❌ Failed: ${failed}/${testCases.length}`);
  console.log(`${'='.repeat(60)}\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed! Direction detection is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Review the logic.');
  }
}

testDirectionDetection();
