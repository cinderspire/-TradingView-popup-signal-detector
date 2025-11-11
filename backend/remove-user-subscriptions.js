const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeUserSubscriptions() {
  try {
    const email = 'suyttru@gmail.com';

    console.log('🔍 Checking subscriptions for:', email);
    console.log('='.repeat(80));

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email },
      include: {
        subscriptions: {
          include: {
            strategy: {
              select: {
                name: true,
                description: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      console.log('❌ User not found with email:', email);
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('✅ User found:');
    console.log('   Email:', user.email);
    console.log('   Username:', user.username);
    console.log('   User ID:', user.id);
    console.log('');
    console.log('📊 Total Subscriptions:', user.subscriptions.length);
    console.log('');

    if (user.subscriptions.length === 0) {
      console.log('✅ No subscriptions to remove.');
      await prisma.$disconnect();
      process.exit(0);
    }

    // Show current subscriptions
    console.log('Current Subscriptions:');
    console.log('-'.repeat(80));
    user.subscriptions.forEach((sub, index) => {
      console.log(`${index + 1}. Strategy: ${sub.strategy.name}`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   Pairs: ${sub.subscribedPairs.join(', ') || 'ALL'}`);
      console.log(`   Created: ${sub.createdAt.toISOString().split('T')[0]}`);
      console.log(`   Subscription ID: ${sub.id}`);
      console.log('');
    });

    console.log('');
    console.log('🗑️  Removing all subscriptions...');
    console.log('');

    // Delete all subscriptions for this user
    const deleteResult = await prisma.subscription.deleteMany({
      where: {
        userId: user.id
      }
    });

    console.log('='.repeat(80));
    console.log('✅ COMPLETED');
    console.log('='.repeat(80));
    console.log(`Removed ${deleteResult.count} subscription(s) for ${email}`);
    console.log('');

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

removeUserSubscriptions();
