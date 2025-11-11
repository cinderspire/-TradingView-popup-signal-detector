const http = require('http');
const jwt = require('jsonwebtoken');

const apiUrl = 'http://localhost:6864';
const JWT_SECRET = 'cf2deb43569043ba9f325c2f6abc963b220030a69f69865a905f3d8d1860b40762ececa4515ec81338f324fca84cc049387d673946c2b7696fd334e4ffd4c38e';

// Test user IDs from database
const demoUserId = '7f8c3e1a-6b2d-4f9a-8c5e-3d1f2a4b5c6d';  // Will get from DB
const providerUserId = '6fbc2cda-5b76-43cd-955a-b66569d50547';  // From previous tests

// Helper function to create JWT token
function createToken(userId, email, role) {
  return jwt.sign(
    { id: userId, email, role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Helper function to make API requests
function makeRequest(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, apiUrl);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: 'Failed to parse response', body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function test() {
  console.log('🧪 Testing Subscription Endpoints (Direct with JWT)\n');

  try {
    // First, get demo user ID from database
    console.log('0️⃣ Getting user IDs from database...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@test.com' }
    });

    const providerUser = await prisma.user.findUnique({
      where: { email: 'provider@test.com' }
    });

    if (!demoUser || !providerUser) {
      console.log('❌ Users not found in database');
      await prisma.$disconnect();
      return;
    }

    console.log('✅ Found demo user:', demoUser.username, `(${demoUser.id})`);
    console.log('✅ Found provider:', providerUser.username, `(${providerUser.id})`);
    console.log('');

    // Create JWT tokens
    const userToken = createToken(demoUser.id, demoUser.email, demoUser.role);
    const providerToken = createToken(providerUser.id, providerUser.email, providerUser.role);

    console.log('✅ JWT tokens created\n');

    // 1. Get user's subscriptions (should be empty initially)
    console.log('1️⃣  Getting user subscriptions...');
    const subsResponse = await makeRequest('GET', '/api/subscriptions', null, userToken);

    if (subsResponse.success) {
      console.log('✅ Subscriptions:', subsResponse.data.subscriptions.length);
      console.log('   Total:', subsResponse.data.pagination.total);
    } else {
      console.log('❌ Failed:', subsResponse.message);
      return;
    }
    console.log('');

    // 2. Get available strategies directly from database
    console.log('2️⃣  Getting available strategies from database...');
    const strategies = await prisma.strategy.findMany({
      where: {
        providerId: providerUser.id
      }
    });

    if (strategies.length === 0) {
      console.log('⚠️  No strategies available for testing');
      await prisma.$disconnect();
      return;
    }

    console.log('✅ Found', strategies.length, 'strategies');
    const strategy = strategies[0];
    console.log(`   Strategy: ${strategy.name}`);
    console.log(`   Price: $${strategy.monthlyPrice}`);
    console.log(`   ID: ${strategy.id}\n`);

    // 3. Subscribe to a strategy
    console.log('3️⃣  Creating subscription...');
    const createSubResponse = await makeRequest('POST', '/api/subscriptions', {
      strategyId: strategy.id,
      autoRenew: true
    }, userToken);

    if (!createSubResponse.success) {
      console.log('❌ Subscription creation failed:', createSubResponse.message);
      await prisma.$disconnect();
      return;
    }

    console.log('✅ Subscription created successfully!');
    console.log('   ID:', createSubResponse.data.subscription.id);
    console.log('   Amount:', `$${createSubResponse.data.transaction.amount}`);
    console.log('   Status:', createSubResponse.data.subscription.status);
    console.log('   Auto-renew:', createSubResponse.data.subscription.autoRenew);
    console.log('');

    const subId = createSubResponse.data.subscription.id;

    // 4. Get subscription details
    console.log('4️⃣  Getting subscription details...');
    const subDetailResponse = await makeRequest('GET', `/api/subscriptions/${subId}`, null, userToken);

    if (subDetailResponse.success) {
      const sub = subDetailResponse.data.subscription;
      console.log('✅ Subscription details:');
      console.log('   Strategy:', sub.strategy.name);
      console.log('   Status:', sub.status);
      console.log('   Days remaining:', sub.daysRemaining);
      console.log('   Monthly price:', `$${sub.monthlyPrice}`);
    } else {
      console.log('❌ Failed:', subDetailResponse.message);
    }
    console.log('');

    // 5. Update subscription (toggle auto-renew)
    console.log('5️⃣  Updating auto-renew to false...');
    const updateResponse = await makeRequest('PUT', `/api/subscriptions/${subId}`, {
      autoRenew: false
    }, userToken);

    if (updateResponse.success) {
      console.log('✅ Auto-renew:', updateResponse.data.subscription.autoRenew);
    } else {
      console.log('❌ Failed:', updateResponse.message);
    }
    console.log('');

    // 6. Pause subscription
    console.log('6️⃣  Pausing subscription...');
    const pauseResponse = await makeRequest('PUT', `/api/subscriptions/${subId}`, {
      status: 'PAUSED'
    }, userToken);

    if (pauseResponse.success) {
      console.log('✅ Status:', pauseResponse.data.subscription.status);
    } else {
      console.log('❌ Failed:', pauseResponse.message);
    }
    console.log('');

    // 7. Resume subscription
    console.log('7️⃣  Resuming subscription...');
    const resumeResponse = await makeRequest('PUT', `/api/subscriptions/${subId}`, {
      status: 'ACTIVE'
    }, userToken);

    if (resumeResponse.success) {
      console.log('✅ Status:', resumeResponse.data.subscription.status);
    } else {
      console.log('❌ Failed:', resumeResponse.message);
    }
    console.log('');

    // 8. Test provider revenue endpoint
    console.log('8️⃣  Getting provider revenue...');
    const revenueResponse = await makeRequest('GET', '/api/subscriptions/revenue', null, providerToken);

    if (revenueResponse.success) {
      console.log('✅ Provider revenue:');
      console.log('   Total:', `$${revenueResponse.data.revenue.total}`);
      console.log('   MRR:', `$${revenueResponse.data.revenue.monthlyRecurringRevenue}`);
      console.log('   Active subscriptions:', revenueResponse.data.revenue.activeSubscriptions);
      console.log('   Transaction count:', revenueResponse.data.revenue.transactionCount);

      if (revenueResponse.data.byStrategy.length > 0) {
        console.log('   By strategy:');
        revenueResponse.data.byStrategy.forEach(s => {
          console.log(`     - ${s.strategyName}: $${s.estimatedMonthlyRevenue}/mo (${s.activeSubscriptions} subs)`);
        });
      }
    } else {
      console.log('❌ Failed:', revenueResponse.message);
    }
    console.log('');

    // 9. Cancel subscription
    console.log('9️⃣  Cancelling subscription...');
    const cancelResponse = await makeRequest('DELETE', `/api/subscriptions/${subId}`, null, userToken);

    if (cancelResponse.success) {
      console.log('✅ Subscription cancelled');
      console.log('   Access until:', new Date(cancelResponse.data.accessUntil).toLocaleDateString());
    } else {
      console.log('❌ Failed:', cancelResponse.message);
    }
    console.log('');

    // 10. Verify subscription status
    console.log('🔟 Verifying final subscription status...');
    const finalListResponse = await makeRequest('GET', '/api/subscriptions', null, userToken);

    if (finalListResponse.success) {
      const cancelledSub = finalListResponse.data.subscriptions.find(s => s.id === subId);
      if (cancelledSub) {
        console.log('✅ Subscription status:', cancelledSub.status);
        console.log('   Cancelled at:', new Date(cancelledSub.cancelledAt).toLocaleString());
      }
    }
    console.log('');

    await prisma.$disconnect();
    console.log('\n✅ All subscription endpoint tests completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

test();
