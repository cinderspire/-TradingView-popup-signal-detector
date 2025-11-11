const http = require('http');

const apiUrl = 'http://localhost:6864';

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, apiUrl);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
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

function makeAuthRequest(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, apiUrl);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
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
  console.log('🧪 Testing Authentication Endpoints\n');

  try {
    // 1. Test registration with new user
    console.log('1️⃣  Testing user registration...');
    const registerResponse = await makeRequest('POST', '/api/auth/register', {
      email: 'testuser@example.com',
      username: 'testuser',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User'
    });

    if (registerResponse.status === 201 && registerResponse.data.success) {
      console.log('✅ Registration successful');
      console.log('   User ID:', registerResponse.data.data.user.id);
      console.log('   Username:', registerResponse.data.data.user.username);
      console.log('   Token received:', registerResponse.data.data.token.substring(0, 20) + '...');
      console.log('');
    } else if (registerResponse.status === 400 && registerResponse.data.message.includes('already')) {
      console.log('⚠️  User already exists (expected if ran before)');
      console.log('   Message:', registerResponse.data.message);
      console.log('');
    } else {
      console.log('❌ Registration failed');
      console.log('   Status:', registerResponse.status);
      console.log('   Response:', JSON.stringify(registerResponse.data, null, 2));
      console.log('');
    }

    // 2. Test login with demo user
    console.log('2️⃣  Testing login with demo user...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: 'demo@test.com',
      password: 'Demo123!'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login failed');
      console.log('   Response:', JSON.stringify(loginResponse.data, null, 2));
      return;
    }

    console.log('✅ Login successful');
    console.log('   User:', loginResponse.data.data.user.username);
    console.log('   Role:', loginResponse.data.data.user.role);
    console.log('   Token:', loginResponse.data.data.token.substring(0, 20) + '...');
    console.log('');

    const token = loginResponse.data.data.token;

    // 3. Test GET /me
    console.log('3️⃣  Testing GET /me...');
    const meResponse = await makeAuthRequest('GET', '/api/auth/me', null, token);

    if (meResponse.data.success) {
      console.log('✅ User details retrieved');
      console.log('   Username:', meResponse.data.data.user.username);
      console.log('   Email:', meResponse.data.data.user.email);
      console.log('   Strategies:', meResponse.data.data.user._count?.strategies || 0);
      console.log('   Subscriptions:', meResponse.data.data.user._count?.subscriptions || 0);
      console.log('');
    } else {
      console.log('❌ Failed to get user details');
      console.log('   Response:', JSON.stringify(meResponse.data, null, 2));
      console.log('');
    }

    // 4. Test login with provider
    console.log('4️⃣  Testing login with provider account...');
    const providerLogin = await makeRequest('POST', '/api/auth/login', {
      email: 'provider@test.com',
      password: 'Provider123!'
    });

    if (providerLogin.data.success) {
      console.log('✅ Provider login successful');
      console.log('   Username:', providerLogin.data.data.user.username);
      console.log('   Role:', providerLogin.data.data.user.role);
      console.log('');
    } else {
      console.log('❌ Provider login failed');
      console.log('   Response:', JSON.stringify(providerLogin.data, null, 2));
      console.log('');
    }

    // 5. Test token refresh
    console.log('5️⃣  Testing token refresh...');
    const refreshResponse = await makeRequest('POST', '/api/auth/refresh', {
      refreshToken: loginResponse.data.data.refreshToken
    });

    if (refreshResponse.data.success) {
      console.log('✅ Token refresh successful');
      console.log('   New token:', refreshResponse.data.data.token.substring(0, 20) + '...');
      console.log('');
    } else {
      console.log('❌ Token refresh failed');
      console.log('   Response:', JSON.stringify(refreshResponse.data, null, 2));
      console.log('');
    }

    // 6. Test logout
    console.log('6️⃣  Testing logout...');
    const logoutResponse = await makeAuthRequest('POST', '/api/auth/logout', null, token);

    if (logoutResponse.data.success) {
      console.log('✅ Logout successful');
      console.log('');
    } else {
      console.log('❌ Logout failed');
      console.log('   Response:', JSON.stringify(logoutResponse.data, null, 2));
      console.log('');
    }

    // 7. Test invalid credentials
    console.log('7️⃣  Testing login with invalid credentials...');
    const invalidLogin = await makeRequest('POST', '/api/auth/login', {
      email: 'demo@test.com',
      password: 'WrongPassword123!'
    });

    if (invalidLogin.status === 401) {
      console.log('✅ Correctly rejected invalid credentials');
      console.log('   Message:', invalidLogin.data.message);
      console.log('');
    } else {
      console.log('❌ Should have rejected invalid credentials');
      console.log('   Response:', JSON.stringify(invalidLogin.data, null, 2));
      console.log('');
    }

    console.log('\n✅ All auth endpoint tests completed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

test();
