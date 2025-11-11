# AutomatedTradeBot - Admin Guide & Testing

**Date:** 2025-11-03
**Version:** 2.0 - Subscription Executor Added

---

## 🎯 What Changed

### New Feature: Automatic Subscription-Based Order Execution

**Previously:**
- Users had to keep browser open 24/7
- WebSocket connection required
- Manual `autoExecute` toggle needed

**Now:**
- ✅ Backend automatically executes orders for subscriptions with API keys
- ✅ Works even when user is offline
- ✅ No WebSocket connection required
- ✅ True "set and forget" functionality

---

## 🚀 Quick Start - Testing with suyttru Account

### Step 1: Add Test API Keys (IMPORTANT: Use test account only!)

```bash
# Option A: Via API (Recommended)
curl -X POST http://localhost:6864/api/subscriptions/SUBSCRIPTION_ID/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "apiKey": "YOUR_EXCHANGE_TEST_API_KEY",
    "apiSecret": "YOUR_EXCHANGE_TEST_API_SECRET",
    "subAccount": "optional-subaccount-name"
  }'

# Option B: Via Database (For testing only)
sudo -u postgres psql -d automatedtradebot -c "
  SELECT id, \"strategyId\", activeExchange
  FROM \"Subscription\"
  WHERE \"userId\" = (SELECT id FROM \"User\" WHERE email = 'suyttru@gmail.com')
  LIMIT 1;
"

# Then update one subscription (replace SUBSCRIPTION_ID):
# Note: You need to encrypt the keys first using the encryption utility
```

### Step 2: Verify Subscription Configuration

```bash
sudo -u postgres psql -d automatedtradebot << 'EOF'
SELECT
  u.email,
  s.id as subscription_id,
  st.name as strategy_name,
  s.activeExchange,
  s.orderType,
  s.status,
  s.exchangeApiKey IS NOT NULL as has_api_key,
  s.exchangeApiSecret IS NOT NULL as has_api_secret
FROM "Subscription" s
JOIN "User" u ON s."userId" = u.id
JOIN "Strategy" st ON s."strategyId" = st.id
WHERE u.email = 'suyttru@gmail.com';
EOF
```

### Step 3: Restart PM2 to Load New Service

```bash
# Restart the automatedtradebot-api service
pm2 restart automatedtradebot-api

# Watch logs in real-time
pm2 logs automatedtradebot-api --lines 100
```

### Step 4: Verify Service Started

Look for these log messages:
```
✅ Subscription Executor initialized
✅ Subscription Executor listening for signals
✅ SIGNAL CAPTURE SYSTEM INITIALIZED
   - Subscription Executor: Active (Auto-trading)
```

### Step 5: Test Signal Processing

Wait for a TradingView signal or manually create one:

```bash
# Watch the logs for:
# 1. Signal received
# 2. Subscription Executor processing
# 3. Order execution

pm2 logs automatedtradebot-api | grep -E "(SUBSCRIPTION EXECUTOR|Found.*matching|Order executed)"
```

---

## 📊 Monitoring Active Executions

### Check Recent Signals

```bash
sudo -u postgres psql -d automatedtradebot -c "
  SELECT
    symbol,
    direction,
    \"entryPrice\",
    source,
    \"createdAt\"
  FROM \"Signal\"
  ORDER BY \"createdAt\" DESC
  LIMIT 10;
"
```

### Check Active Subscriptions with API Keys

```bash
sudo -u postgres psql -d automatedtradebot -c "
  SELECT
    COUNT(*) as total_active,
    COUNT(CASE WHEN \"exchangeApiKey\" IS NOT NULL THEN 1 END) as with_api_keys
  FROM \"Subscription\"
  WHERE status = 'ACTIVE';
"
```

### Check Service Stats

```bash
# Via API endpoint (add this to routes if needed)
curl http://localhost:6864/api/admin/subscription-executor/stats
```

---

## 🔧 Troubleshooting

### Issue: No Orders Being Executed

**Check List:**
1. ✅ Is subscription status = 'ACTIVE'?
2. ✅ Are API keys configured (both key and secret)?
3. ✅ Is SubscriptionExecutor service running?
4. ✅ Are signals coming from TradingView?
5. ✅ Does signal strategy match subscription strategy?
6. ✅ Does signal pair match subscription pairs (or allPairs = true)?

**Debug Commands:**
```bash
# Check subscription details
sudo -u postgres psql -d automatedtradebot -c "
  SELECT * FROM \"Subscription\" WHERE id = 'SUBSCRIPTION_ID';
"

# Check recent logs for errors
pm2 logs automatedtradebot-api --err --lines 50

# Check if signals are being processed
tail -f /home/automatedtradebot/logs/api-out-0.log | grep "SUBSCRIPTION EXECUTOR"
```

### Issue: Service Won't Start

**Check:**
```bash
# Syntax check
cd /home/automatedtradebot/backend
node -c src/services/subscription-executor.js
node -c src/server.js

# Check PM2 error logs
pm2 logs automatedtradebot-api --err

# Check file permissions
ls -la /home/automatedtradebot/backend/src/services/subscription-executor.js
```

### Issue: Wrong Exchange or Order Type

**Fix:**
```bash
# Update subscription settings
sudo -u postgres psql -d automatedtradebot -c "
  UPDATE \"Subscription\"
  SET activeExchange = 'binance',
      orderType = 'FUTURES'
  WHERE id = 'SUBSCRIPTION_ID';
"
```

---

## 🔒 Security Best Practices

### 1. API Key Management

**DO:**
- ✅ Use test API keys during testing
- ✅ Use sub-accounts with limited permissions
- ✅ Set IP whitelist on exchange
- ✅ Enable withdrawal restrictions
- ✅ Use encrypted environment variables

**DON'T:**
- ❌ Use main account API keys
- ❌ Grant withdrawal permissions
- ❌ Share API keys in logs
- ❌ Store plain-text keys in database

### 2. Encryption Verification

```bash
# Verify encryption is working
cd /home/automatedtradebot/backend
node -e "
const { encrypt, decrypt } = require('./src/utils/encryption');
const test = 'test-api-key';
const encrypted = encrypt(test);
const decrypted = decrypt(encrypted);
console.log('Original:', test);
console.log('Encrypted:', encrypted);
console.log('Decrypted:', decrypted);
console.log('Match:', test === decrypted);
"
```

### 3. Database Access

**Production:**
```bash
# Restrict PostgreSQL access
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Set to: local   automatedtradebot   tradebot   md5

# Reload PostgreSQL
sudo systemctl reload postgresql
```

---

## 📈 Performance Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Detailed process info
pm2 show automatedtradebot-api

# CPU and memory usage
pm2 list
```

### Database Performance

```bash
# Active connections
sudo -u postgres psql -d automatedtradebot -c "
  SELECT count(*) as active_connections
  FROM pg_stat_activity
  WHERE datname = 'automatedtradebot';
"

# Table sizes
sudo -u postgres psql -d automatedtradebot -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

## 🧪 Testing Scenarios

### Test 1: Single Subscription Execution

1. Configure API keys for one subscription
2. Verify subscription is ACTIVE
3. Wait for matching signal
4. Check logs for execution

**Expected:**
```
🎯 SUBSCRIPTION EXECUTOR: Processing Signal
✅ Found 1 matching subscription(s)
🔄 Executing for user suyttru@gmail.com (mexc)
✅ Order executed for suyttru@gmail.com (250ms)
```

### Test 2: Multiple Subscriptions

1. Configure API keys for 2+ subscriptions
2. Send signal that matches both
3. Verify both execute in parallel

**Expected:**
```
✅ Found 2 matching subscription(s)
   - Subscriptions: 2
   - Successful:    2
   - Failed:        0
```

### Test 3: Auto-Stop Limits

1. Set autoStopLossPercent = -5%
2. Execute trades until loss hits -5%
3. Verify trading stops

**Expected:**
```
🛑 Auto-stop triggered for subscription xxx
   Auto-stop: Loss limit -5% reached (current: -5.2%)
```

### Test 4: Error Handling

1. Use invalid API keys
2. Send signal
3. Verify graceful failure

**Expected:**
```
❌ Execution failed for subscription xxx: Invalid API key
📝 Execution Log: status=FAILED, error=Invalid API key
```

---

## 📝 Adding Test API Keys via Encryption Utility

### Create Encryption Helper Script

```bash
cat > /home/automatedtradebot/backend/scripts/encrypt-api-key.js << 'EOF'
const { encrypt } = require('../src/utils/encryption');

const apiKey = process.argv[2];
const apiSecret = process.argv[3];

if (!apiKey || !apiSecret) {
  console.error('Usage: node encrypt-api-key.js <API_KEY> <API_SECRET>');
  process.exit(1);
}

const encryptedKey = encrypt(apiKey);
const encryptedSecret = encrypt(apiSecret);

console.log('\n=== Encrypted API Credentials ===');
console.log('API Key (encrypted):', encryptedKey);
console.log('API Secret (encrypted):', encryptedSecret);
console.log('\n=== SQL Update Command ===');
console.log(`
UPDATE "Subscription"
SET "exchangeApiKey" = '${encryptedKey}',
    "exchangeApiSecret" = '${encryptedSecret}'
WHERE id = 'YOUR_SUBSCRIPTION_ID';
`);
EOF

# Make executable
chmod +x /home/automatedtradebot/backend/scripts/encrypt-api-key.js
```

### Use the Helper

```bash
cd /home/automatedtradebot/backend
node scripts/encrypt-api-key.js "YOUR_TEST_API_KEY" "YOUR_TEST_API_SECRET"

# Then run the generated SQL command
```

---

## 🎯 Next Steps

### Phase 2: ExecutionLog Table

Add to Prisma schema:
```prisma
model ExecutionLog {
  id              String   @id @default(uuid())
  userId          String
  subscriptionId  String
  signalId        String
  exchange        String
  orderType       String
  side            String
  amount          Float
  price           Float?
  orderId         String?
  status          String
  error           String?
  executedAt      DateTime @default(now())

  user            User         @relation(fields: [userId], references: [id])
  subscription    Subscription @relation(fields: [subscriptionId], references: [id])
  signal          Signal       @relation(fields: [signalId], references: [id])
}
```

Then run:
```bash
npx prisma migrate dev --name add_execution_log
npx prisma generate
```

### Phase 3: Admin Dashboard

Add route to view executions:
```javascript
// GET /api/admin/executions
router.get('/executions', authenticate, isAdmin, async (req, res) => {
  const executions = await prisma.executionLog.findMany({
    include: {
      user: { select: { email: true } },
      subscription: { select: { strategyId: true } },
      signal: { select: { symbol: true, direction: true } }
    },
    orderBy: { executedAt: 'desc' },
    take: 100
  });
  res.json({ success: true, executions });
});
```

---

**Questions or Issues?**
- Check logs: `pm2 logs automatedtradebot-api`
- Review analysis: `/home/automatedtradebot/SYSTEM_ANALYSIS_AND_FIXES.md`
- Database console: `sudo -u postgres psql -d automatedtradebot`

---

**End of Admin Guide**
