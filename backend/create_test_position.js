const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Get a user
    const user = await prisma.user.findFirst();

    if (!user) {
      console.error('❌ No user found');
      process.exit(1);
    }

    console.log('✅ User:', user.email);

    // Create test position with TP/SL
    const testPosition = await prisma.position.create({
      data: {
        userId: user.id,
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.001,
        entryPrice: 30000,
        currentPrice: 30300, // +1% profit
        stopLoss: 29700, // -1% SL
        takeProfit: 30600, // +2% TP
        status: 'OPEN',
        notes: 'TEST POSITION - Position Monitor Test'
      }
    });

    console.log('\n✅ TEST POZİSYONU OLUŞTURULDU:');
    console.log('ID:', testPosition.id);
    console.log('Symbol:', testPosition.symbol);
    console.log('Entry:', testPosition.entryPrice);
    console.log('Current:', testPosition.currentPrice);
    console.log('TP:', testPosition.takeProfit);
    console.log('SL:', testPosition.stopLoss);
    console.log('Profit:', ((testPosition.currentPrice - testPosition.entryPrice) / testPosition.entryPrice * 100).toFixed(2) + '%');

    console.log('\n🎯 Position Monitor her 5 saniyede kontrol edecek...');
    console.log('💡 Eğer current price TP veya SL seviyesine ulaşırsa otomatik kapatacak!');

    console.log('\n📊 Şimdi current price\'ı TP seviyesine çıkaralım (30600):');

    const updated = await prisma.position.update({
      where: { id: testPosition.id },
      data: { currentPrice: 30600 }
    });

    console.log('✅ Current price güncellendi:', updated.currentPrice);
    console.log('⏳ 10 saniye bekleyin, Position Monitor otomatik kapatmalı...');

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Hata:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
