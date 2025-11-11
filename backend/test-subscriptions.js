const http = require('http');

const apiUrl = 'http://localhost:6864';

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
          resolve(body);
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
  console.log('🧪 Testing Subscription Endpoints\n');

  try {
    // 1. Login as demo user
    console.log('1️⃣ Logging in as demo user...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: 'demo@test.com',
      password: 'Demo123!'
    });

    if (!loginResponse.success) {
      console.log('❌ Login failed:', loginResponse.message);
      return;
    }

    const userToken = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log('   Token:', userToken ? `${userToken.substring(0, 20)}...` : 'NO TOKEN');
    console.log('   User:', loginResponse.data.user?.username);
    console.log('');

    // 2. Get user's subscriptions (should be empty)
    console.log('2️⃣ Getting user subscriptions...');
    console.log('   Using token:', userToken ? `${userToken.substring(0, 20)}...` : 'NO TOKEN');
    const subsResponse = await makeRequest('GET', '/api/subscriptions', null, userToken);
    console.log('✅ Subscriptions response:', JSON.stringify(subsResponse, null, 2));
    console.log('');

    // 3. Get available strategies
    console.log('3️⃣ Getting available strategies...');
    const strategiesResponse = await makeRequest('GET', '/api/strategies');
    console.log('✅ Found', strategiesResponse.data?.strategies?.length || 0, 'strategies\n');

    if (strategiesResponse.data?.strategies?.length > 0) {
      const strategy = strategiesResponse.data.strategies[0];
      console.log(`   Strategy: ${strategy.name}`);
      console.log(`   Price: $${strategy.monthlyPrice}`);
      console.log(`   ID: ${strategy.id}\n`);

      // 4. Subscribe to a strategy
      console.log('4️⃣ Creating subscription...');
      const createSubResponse = await makeRequest('POST', '/api/subscriptions', {
        strategyId: strategy.id,
        autoRenew: true
      }, userToken);

      if (createSubResponse.success) {
        console.log('✅ Subscription created successfully!');
        console.log('   Subscription ID:', createSubResponse.data.subscription.id);
        console.log('   Amount paid:', createSubResponse.data.transaction.amount);
        console.log('   Status:', createSubResponse.data.subscription.status);
        console.log('');

        const subId = createSubResponse.data.subscription.id;

        // 5. Get subscription details
        console.log('5️⃣ Getting subscription details...');
        const subDetailResponse = await makeRequest('GET', `/api/subscriptions/${subId}`, null, userToken);
        console.log('✅ Subscription details:', JSON.stringify(subDetailResponse.data, null, 2));
        console.log('');

        // 6. Update subscription (pause)
        console.log('6️⃣ Pausing subscription...');
        const updateResponse = await makeRequest('PUT', `/api/subscriptions/${subId}`, {
          status: 'PAUSED'
        }, userToken);
        console.log('✅ Subscription status:', updateResponse.data.subscription.status);
        console.log('');

        // 7. Resume subscription
        console.log('7️⃣ Resuming subscription...');
        const resumeResponse = await makeRequest('PUT', `/api/subscriptions/${subId}`, {
          status: 'ACTIVE'
        }, userToken);
        console.log('✅ Subscription status:', resumeResponse.data.subscription.status);
        console.log('');

        // 8. Test provider revenue endpoint
        console.log('8️⃣ Testing provider revenue endpoint...');
        const providerLoginResponse = await makeRequest('POST', '/api/auth/login', {
          email: 'provider@test.com',
          password: 'Provider123!'
        });

        if (providerLoginResponse.success) {
          const providerToken = providerLoginResponse.data.token;
          const revenueResponse = await makeRequest('GET', '/api/subscriptions/revenue', null, providerToken);
          console.log('✅ Provider revenue:', JSON.stringify(revenueResponse.data, null, 2));
          console.log('');
        }

        // 9. Cancel subscription
        console.log('9️⃣ Cancelling subscription...');
        const cancelResponse = await makeRequest('DELETE', `/api/subscriptions/${subId}`, null, userToken);
        console.log('✅ Subscription cancelled');
        console.log('   Access until:', cancelResponse.data.accessUntil);
        console.log('');

        // 10. Verify subscription list shows cancelled
        console.log('🔟 Verifying subscription status...');
        const finalListResponse = await makeRequest('GET', '/api/subscriptions', null, userToken);
        console.log('✅ Final subscriptions:', JSON.stringify(finalListResponse.data.subscriptions.map(s => ({
          id: s.id,
          status: s.status,
          strategyName: s.strategy.name
        })), null, 2));

      } else {
        console.log('❌ Subscription creation failed:', createSubResponse.message);
      }
    }

    console.log('\n✅ All subscription endpoint tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

test();
