#!/usr/bin/env node

/**
 * Check MEXC Available Symbols
 */

const ccxt = require('ccxt');

async function checkMexcSymbols() {
  try {
    console.log('🔍 Checking MEXC available symbols...\n');

    const exchange = new ccxt.mexc({
      enableRateLimit: true,
      options: {
        defaultType: 'spot'
      }
    });

    await exchange.loadMarkets();

    // Find BTC related pairs
    const btcPairs = Object.keys(exchange.markets).filter(symbol =>
      symbol.includes('BTC') && symbol.includes('USDT')
    );

    console.log('📊 BTC/USDT pairs on MEXC:');
    btcPairs.forEach(symbol => {
      const market = exchange.markets[symbol];
      console.log(`   ${symbol} - ${market.active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    });

    // Check if BTC/USDT exists
    if (exchange.markets['BTC/USDT']) {
      console.log('\n✅ BTC/USDT is available');
      console.log(JSON.stringify(exchange.markets['BTC/USDT'], null, 2));
    } else {
      console.log('\n❌ BTC/USDT is NOT available');
    }

    // Show some common spot pairs
    console.log('\n📊 Common SPOT pairs on MEXC:');
    const commonPairs = ['ETH/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'SOL/USDT'];
    commonPairs.forEach(symbol => {
      if (exchange.markets[symbol]) {
        console.log(`   ${symbol} - ✅ Available`);
      } else {
        console.log(`   ${symbol} - ❌ Not available`);
      }
    });

    await exchange.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkMexcSymbols();
