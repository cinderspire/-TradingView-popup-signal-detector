const http = require('http');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const apiUrl = 'http://localhost:6864';

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
  console.log('🧪 Testing Risk Management Endpoints\n');

  try {
    // Get demo user from database
    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@test.com' }
    });

    if (!demoUser) {
      console.log('❌ Demo user not found');
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: demoUser.id,
        email: demoUser.email,
        role: demoUser.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 1. List risk configs (should be empty initially)
    console.log('1️⃣  Testing GET /api/risk-management (list configs)...');
    const listResponse1 = await makeAuthRequest('GET', '/api/risk-management', null, token);

    if (listResponse1.data.success) {
      console.log('✅ List configs successful');
      console.log('   Configs found:', listResponse1.data.data.configs.length);
      console.log('   Stats:', JSON.stringify(listResponse1.data.data.stats.byType));
      console.log('');
    } else {
      console.log('❌ List configs failed');
      console.log('   Response:', JSON.stringify(listResponse1.data, null, 2));
      console.log('');
    }

    // 2. Create FIXED risk configuration
    console.log('2️⃣  Testing POST /api/risk-management (create FIXED config)...');
    const fixedConfig = await makeAuthRequest('POST', '/api/risk-management', {
      name: 'Conservative Fixed Risk',
      description: 'Safe fixed risk configuration for beginners',
      type: 'FIXED',
      riskPerTrade: 1.0,
      maxPositionSize: 10.0,
      maxDailyLoss: 3.0,
      maxDrawdown: 10.0,
      useStopLoss: true,
      stopLossPercent: 2.0,
      useTakeProfit: true,
      takeProfitPercent: 3.0,
      riskRewardRatio: 1.5,
      maxOpenPositions: 3,
      maxLeverage: 5.0,
      isDefault: true
    }, token);

    let fixedConfigId;
    if (fixedConfig.data.success) {
      console.log('✅ Fixed risk config created');
      console.log('   Config ID:', fixedConfig.data.data.config.id);
      console.log('   Type:', fixedConfig.data.data.config.type);
      console.log('   Risk per trade:', fixedConfig.data.data.config.riskPerTrade + '%');
      console.log('   Default:', fixedConfig.data.data.config.isDefault);
      fixedConfigId = fixedConfig.data.data.config.id;
      console.log('');
    } else {
      console.log('❌ Create fixed config failed');
      console.log('   Response:', JSON.stringify(fixedConfig.data, null, 2));
      console.log('');
    }

    // 3. Create ADAPTIVE risk configuration
    console.log('3️⃣  Testing POST /api/risk-management (create ADAPTIVE config)...');
    const adaptiveConfig = await makeAuthRequest('POST', '/api/risk-management', {
      name: 'Adaptive Risk - Performance Based',
      description: 'Adjusts risk based on win/loss streaks',
      type: 'ADAPTIVE',
      baseRiskPercent: 2.0,
      winStreakMultiplier: 1.25,
      lossStreakDivisor: 2.0,
      maxAdaptiveRisk: 4.0,
      minAdaptiveRisk: 0.5,
      stopLossPercent: 2.5,
      takeProfitPercent: 4.0,
      riskRewardRatio: 1.6,
      maxOpenPositions: 5,
      isDefault: false
    }, token);

    let adaptiveConfigId;
    if (adaptiveConfig.data.success) {
      console.log('✅ Adaptive risk config created');
      console.log('   Config ID:', adaptiveConfig.data.data.config.id);
      console.log('   Type:', adaptiveConfig.data.data.config.type);
      console.log('   Base risk:', adaptiveConfig.data.data.config.baseRiskPercent + '%');
      console.log('   Adaptive range:', adaptiveConfig.data.data.config.minAdaptiveRisk + '% - ' + adaptiveConfig.data.data.config.maxAdaptiveRisk + '%');
      adaptiveConfigId = adaptiveConfig.data.data.config.id;
      console.log('');
    } else {
      console.log('❌ Create adaptive config failed');
      console.log('   Response:', JSON.stringify(adaptiveConfig.data, null, 2));
      console.log('');
    }

    // 4. Create NEWS_BASED risk configuration
    console.log('4️⃣  Testing POST /api/risk-management (create NEWS_BASED config)...');
    const newsConfig = await makeAuthRequest('POST', '/api/risk-management', {
      name: 'News-Based Risk Control',
      description: 'Reduces risk around high-impact economic events',
      type: 'NEWS_BASED',
      riskPerTrade: 1.5,
      newsBasedEnabled: true,
      reduceRiskBeforeNews: true,
      newsRiskReduction: 50.0,
      newsSafetyWindow: 60,
      stopLossPercent: 2.0,
      takeProfitPercent: 3.5,
      riskRewardRatio: 1.75,
      maxOpenPositions: 2,
      isDefault: false
    }, token);

    let newsConfigId;
    if (newsConfig.data.success) {
      console.log('✅ News-based risk config created');
      console.log('   Config ID:', newsConfig.data.data.config.id);
      console.log('   Type:', newsConfig.data.data.config.type);
      console.log('   Risk reduction:', newsConfig.data.data.config.newsRiskReduction + '%');
      console.log('   Safety window:', newsConfig.data.data.config.newsSafetyWindow + ' minutes');
      newsConfigId = newsConfig.data.data.config.id;
      console.log('');
    } else {
      console.log('❌ Create news-based config failed');
      console.log('   Response:', JSON.stringify(newsConfig.data, null, 2));
      console.log('');
    }

    // 5. List all configs
    console.log('5️⃣  Testing GET /api/risk-management (list all configs)...');
    const listResponse2 = await makeAuthRequest('GET', '/api/risk-management', null, token);

    if (listResponse2.data.success) {
      console.log('✅ List all configs successful');
      console.log('   Total configs:', listResponse2.data.data.stats.total);
      console.log('   By type:', JSON.stringify(listResponse2.data.data.stats.byType));
      console.log('   Active configs:', listResponse2.data.data.stats.active);
      console.log('   Default config:', listResponse2.data.data.stats.default?.name || 'None');
      console.log('');
    } else {
      console.log('❌ List all configs failed');
      console.log('   Response:', JSON.stringify(listResponse2.data, null, 2));
      console.log('');
    }

    // 6. Test FIXED risk simulation
    console.log('6️⃣  Testing POST /api/risk-management/test (FIXED simulation)...');
    const testFixed = await makeAuthRequest('POST', '/api/risk-management/test', {
      configId: fixedConfigId,
      capitalAmount: 10000,
      currentPrice: 50000
    }, token);

    if (testFixed.data.success) {
      console.log('✅ Fixed risk simulation successful');
      console.log('   Risk amount: $' + testFixed.data.data.simulation.riskAmount);
      console.log('   Position size:', testFixed.data.data.simulation.positionSize);
      console.log('   Position value: $' + testFixed.data.data.simulation.positionValue);
      console.log('   Stop loss price: $' + testFixed.data.data.simulation.stopLossPrice);
      console.log('   Take profit price: $' + testFixed.data.data.simulation.takeProfitPrice);
      console.log('   Potential loss: $' + testFixed.data.data.simulation.potentialOutcomes.stopLossHit.loss);
      console.log('   Potential profit: $' + testFixed.data.data.simulation.potentialOutcomes.takeProfitHit.profit);
      console.log('');
    } else {
      console.log('❌ Fixed risk simulation failed');
      console.log('   Response:', JSON.stringify(testFixed.data, null, 2));
      console.log('');
    }

    // 7. Test ADAPTIVE risk simulation with win streak
    console.log('7️⃣  Testing POST /api/risk-management/test (ADAPTIVE with win streak)...');
    const testAdaptiveWin = await makeAuthRequest('POST', '/api/risk-management/test', {
      configId: adaptiveConfigId,
      capitalAmount: 10000,
      currentPrice: 50000,
      winStreak: 3,
      lossStreak: 0
    }, token);

    if (testAdaptiveWin.data.success) {
      console.log('✅ Adaptive risk simulation successful');
      console.log('   Base risk:', testAdaptiveWin.data.data.simulation.baseRiskPercent + '%');
      console.log('   Adjusted risk:', testAdaptiveWin.data.data.simulation.adjustedRiskPercent + '%');
      console.log('   Win streak:', testAdaptiveWin.data.data.simulation.winStreak);
      console.log('   Streak impact:', testAdaptiveWin.data.data.simulation.streakImpact);
      console.log('   Risk amount: $' + testAdaptiveWin.data.data.simulation.riskAmount);
      console.log('');
    } else {
      console.log('❌ Adaptive risk simulation failed');
      console.log('   Response:', JSON.stringify(testAdaptiveWin.data, null, 2));
      console.log('');
    }

    // 8. Test NEWS_BASED risk simulation
    console.log('8️⃣  Testing POST /api/risk-management/test (NEWS_BASED)...');
    const testNews = await makeAuthRequest('POST', '/api/risk-management/test', {
      configId: newsConfigId,
      capitalAmount: 10000,
      currentPrice: 50000,
      checkNewsImpact: true
    }, token);

    if (testNews.data.success) {
      console.log('✅ News-based risk simulation successful');
      console.log('   Base risk:', testNews.data.data.simulation.baseRiskPercent + '%');
      console.log('   Adjusted risk:', testNews.data.data.simulation.adjustedRiskPercent + '%');
      console.log('   News impact detected:', testNews.data.data.simulation.newsImpact?.detected || false);
      if (testNews.data.data.simulation.newsImpact) {
        console.log('   Risk reduction:', testNews.data.data.simulation.newsImpact.reduction + '%');
        console.log('   Message:', testNews.data.data.simulation.newsImpact.message);
      }
      console.log('');
    } else {
      console.log('❌ News-based risk simulation failed');
      console.log('   Response:', JSON.stringify(testNews.data, null, 2));
      console.log('');
    }

    // 9. Update a configuration
    console.log('9️⃣  Testing PUT /api/risk-management/:id (update config)...');
    const updateConfig = await makeAuthRequest('PUT', `/api/risk-management/${fixedConfigId}`, {
      riskPerTrade: 1.5,  // Increase from 1.0 to 1.5
      maxPositionSize: 15.0  // Increase from 10.0 to 15.0
    }, token);

    if (updateConfig.data.success) {
      console.log('✅ Config updated successfully');
      console.log('   Updated risk per trade:', updateConfig.data.data.config.riskPerTrade + '%');
      console.log('   Updated max position size:', updateConfig.data.data.config.maxPositionSize + '%');
      console.log('');
    } else {
      console.log('❌ Update config failed');
      console.log('   Response:', JSON.stringify(updateConfig.data, null, 2));
      console.log('');
    }

    // 10. Delete a configuration
    console.log('🔟 Testing DELETE /api/risk-management/:id (delete config)...');
    const deleteConfig = await makeAuthRequest('DELETE', `/api/risk-management/${newsConfigId}`, null, token);

    if (deleteConfig.data.success) {
      console.log('✅ Config deleted successfully');
      console.log('');
    } else {
      console.log('❌ Delete config failed');
      console.log('   Response:', JSON.stringify(deleteConfig.data, null, 2));
      console.log('');
    }

    // 11. Final list to verify
    console.log('1️⃣ 1️⃣  Testing GET /api/risk-management (verify final state)...');
    const listResponse3 = await makeAuthRequest('GET', '/api/risk-management', null, token);

    if (listResponse3.data.success) {
      console.log('✅ Final config list successful');
      console.log('   Total configs:', listResponse3.data.data.stats.total);
      console.log('   By type:', JSON.stringify(listResponse3.data.data.stats.byType));
      console.log('');
    } else {
      console.log('❌ Final list failed');
      console.log('   Response:', JSON.stringify(listResponse3.data, null, 2));
      console.log('');
    }

    console.log('\n✅ All risk management endpoint tests completed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

test();
