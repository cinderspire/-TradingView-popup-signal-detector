const ccxt = require('ccxt');
require('dotenv').config();

(async () => {
  try {
    const exchange = new ccxt.mexc({
      apiKey: process.env.MEXC_API_KEY,
      secret: process.env.MEXC_SECRET,
      enableRateLimit: true,
      options: { defaultType: 'spot' }
    });

    await exchange.loadMarkets();

    // Get all balances
    const balance = await exchange.fetchBalance();

    console.log('\n💰 MEXC SPOT BAKİYELER:');
    console.log('USDT:', balance.total.USDT || 0);

    // Show all non-zero balances
    console.log('\n📊 AÇIK POZİSYONLAR (Sıfır Olmayan Bakiyeler):');
    const positions = [];

    for (const [coin, amount] of Object.entries(balance.total)) {
      if (amount > 0 && coin !== 'USDT') {
        const free = balance.free[coin] || 0;
        const used = balance.used[coin] || 0;
        const pair = coin + '/USDT';

        // Get current price
        let currentPrice = 0;
        try {
          const ticker = await exchange.fetchTicker(pair);
          currentPrice = ticker.last;
        } catch (e) {
          console.log(`⚠️ ${pair} fiyatı alınamadı`);
        }

        positions.push({
          coin,
          total: amount,
          free: free,
          used: used,
          pair: pair,
          currentPrice: currentPrice,
          valueUSDT: amount * currentPrice
        });
      }
    }

    positions.forEach(p => {
      console.log(`\n${p.coin}:`);
      console.log(`  Miktar: ${p.total}`);
      console.log(`  Fiyat: ${p.currentPrice} USDT`);
      console.log(`  Değer: ${p.valueUSDT.toFixed(2)} USDT`);
      console.log(`  Pair: ${p.pair}`);
    });

    console.log('\n\n🎯 TOPLAM AÇIK POZİSYON:', positions.length);
    console.log('💵 TOPLAM DEĞER:', positions.reduce((sum, p) => sum + p.valueUSDT, 0).toFixed(2), 'USDT');

  } catch (error) {
    console.error('Hata:', error.message);
  }
})();
