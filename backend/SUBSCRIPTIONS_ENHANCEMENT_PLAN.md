# 🎯 SUBSCRIPTIONS SAYFASI - GELİŞTİRME PLANI

**URL**: https://automatedtradebot.com/subscriptions
**Durum**: Temel özellikler mevcut, detaylı kontroller eksik
**Tarih**: October 30, 2025

---

## 📊 MEVCUT DURUM

### ✅ Var Olan Özellikler:
1. **Exchange Seçimi**: Binance, Bybit vb.
2. **Trading Pair Seçimi**: Hangi pairler için signal alınacak
3. **Subscribe/Unsubscribe**: Stratejiye abone ol/çık
4. **Status**: ACTIVE/PAUSED/CANCELLED

### ❌ Eksik Özellikler (User İstekleri):
1. **Fixed Order Size**: Kullanıcı sabit USDT miktarı belirleyebilmeli
2. **Spot/Futures Seçimi**: Order tipini seçebilmeli
3. **Auto Stop by Profit %**: Belirli profit'te otomatik dur
4. **Auto Stop by Loss %**: Belirli loss'ta otomatik dur
5. **Account Balance Gösterimi**: Exchange'den canlı bakiye

---

## 🔧 IMPLEMENTATION PLANI

### PHASE 1: Database Schema Update ⏱️ 15 dakika

**Dosya**: `/home/automatedtradebot/backend/prisma/schema.prisma`

**Yeni Alanlar**:
```prisma
model Subscription {
  // ... existing fields ...

  // Trading Configuration
  orderType           OrderType         @default(FUTURES)  // SPOT or FUTURES
  fixedOrderSize      Float?            // Fixed USDT amount per trade (e.g., 100)
  usePercentage       Boolean           @default(false)    // Use % of balance instead
  orderSizePercent    Float?            // % of balance (e.g., 10%)

  // Auto Stop Configuration
  autoStopEnabled     Boolean           @default(false)
  autoStopProfitPercent Float?          // Stop when profit reaches X% (e.g., 50%)
  autoStopLossPercent   Float?          // Stop when loss reaches X% (e.g., -20%)
  currentProfitLoss     Float           @default(0)  // Track cumulative P&L

  // Exchange API Keys (encrypted)
  exchangeApiKey      String?           // Encrypted
  exchangeApiSecret   String?           // Encrypted
  exchangeSubAccount  String?           // For subaccount support
}

enum OrderType {
  SPOT
  FUTURES
}
```

**Migration**:
```bash
cd /home/automatedtradebot/backend
npx prisma migrate dev --name add_subscription_controls
```

---

### PHASE 2: Backend API Updates ⏱️ 30 dakika

**Dosya**: `/home/automatedtradebot/backend/src/routes/subscriptions.js`

#### 2.1 Update Subscription Endpoint
```javascript
// PUT /api/subscriptions/:id
router.put('/:id', authenticate, async (req, res) => {
  const {
    subscribedPairs,
    allPairs,
    activeExchange,
    // NEW FIELDS:
    orderType,          // 'SPOT' or 'FUTURES'
    fixedOrderSize,     // 100 (USDT)
    usePercentage,      // true/false
    orderSizePercent,   // 10 (%)
    autoStopEnabled,    // true/false
    autoStopProfitPercent,  // 50 (%)
    autoStopLossPercent     // -20 (%)
  } = req.body;

  // Update subscription with new fields...
});
```

#### 2.2 New Endpoint: Get Account Balance
```javascript
// GET /api/subscriptions/:id/balance
router.get('/:id/balance', authenticate, async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: req.params.id }
  });

  // Connect to exchange API
  const exchange = new ccxt[subscription.activeExchange]({
    apiKey: decrypt(subscription.exchangeApiKey),
    secret: decrypt(subscription.exchangeApiSecret)
  });

  // Fetch balance
  const balance = await exchange.fetchBalance();

  res.json({
    success: true,
    balance: {
      total: balance.total.USDT,
      free: balance.free.USDT,
      used: balance.used.USDT
    }
  });
});
```

#### 2.3 New Endpoint: Add Exchange API Keys
```javascript
// POST /api/subscriptions/:id/api-keys
router.post('/:id/api-keys', authenticate, async (req, res) => {
  const { apiKey, apiSecret, subAccount } = req.body;

  // Encrypt and save
  await prisma.subscription.update({
    where: { id: req.params.id },
    data: {
      exchangeApiKey: encrypt(apiKey),
      exchangeApiSecret: encrypt(apiSecret),
      exchangeSubAccount: subAccount
    }
  });

  res.json({ success: true });
});
```

#### 2.4 Auto Stop Logic (Background Job)
```javascript
// services/auto-stop-monitor.js
async function checkAutoStop(subscription) {
  if (!subscription.autoStopEnabled) return;

  const currentPnL = subscription.currentProfitLoss;

  // Check profit target
  if (subscription.autoStopProfitPercent &&
      currentPnL >= subscription.autoStopProfitPercent) {
    await pauseSubscription(subscription.id);
    sendNotification(subscription.userId,
      `Subscription paused: Profit target ${subscription.autoStopProfitPercent}% reached!`
    );
  }

  // Check loss limit
  if (subscription.autoStopLossPercent &&
      currentPnL <= subscription.autoStopLossPercent) {
    await pauseSubscription(subscription.id);
    sendNotification(subscription.userId,
      `Subscription paused: Loss limit ${subscription.autoStopLossPercent}% reached!`
    );
  }
}
```

---

### PHASE 3: Frontend Updates ⏱️ 45 dakika

**Dosya**: `/home/automatedtradebot/backend/public/subscriptions.html`

#### 3.1 Edit Modal Updates

**Yeni UI Elements**:
```html
<!-- Order Configuration -->
<div class="config-section">
  <h3>📦 Order Configuration</h3>

  <label>Order Type</label>
  <select id="orderType">
    <option value="FUTURES">Futures</option>
    <option value="SPOT">Spot</option>
  </select>

  <label>Order Size Method</label>
  <div class="radio-group">
    <label>
      <input type="radio" name="sizeMethod" value="fixed" checked>
      Fixed Amount (USDT)
    </label>
    <label>
      <input type="radio" name="sizeMethod" value="percentage">
      Percentage of Balance (%)
    </label>
  </div>

  <div id="fixedSizeInput">
    <label>Fixed Order Size (USDT)</label>
    <input type="number" id="fixedOrderSize" placeholder="100" min="1">
  </div>

  <div id="percentageInput" style="display: none;">
    <label>Order Size (%)</label>
    <input type="number" id="orderSizePercent" placeholder="10" min="1" max="100">
  </div>
</div>

<!-- Auto Stop Configuration -->
<div class="config-section">
  <h3>🛑 Auto Stop Configuration</h3>

  <label class="checkbox-label">
    <input type="checkbox" id="autoStopEnabled">
    Enable Auto Stop
  </label>

  <div id="autoStopOptions" style="display: none;">
    <label>Stop at Profit (%)</label>
    <input type="number" id="autoStopProfit" placeholder="50" min="1">
    <small>Bot will pause when cumulative profit reaches this %</small>

    <label>Stop at Loss (%)</label>
    <input type="number" id="autoStopLoss" placeholder="-20" max="-1">
    <small>Bot will pause when cumulative loss reaches this %</small>
  </div>
</div>

<!-- Account Balance -->
<div class="config-section">
  <h3>💰 Account Balance</h3>

  <div class="balance-display" id="balanceDisplay">
    <p>Connect your exchange API to view balance</p>
    <button onclick="showApiKeyModal()">Connect Exchange</button>
  </div>
</div>
```

#### 3.2 Account Balance Display
```javascript
async function loadBalance(subscriptionId) {
  try {
    const response = await fetch(`/api/subscriptions/${subscriptionId}/balance`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.success) {
      document.getElementById('balanceDisplay').innerHTML = `
        <div class="balance-info">
          <div class="balance-item">
            <label>Total Balance:</label>
            <value>${data.balance.total} USDT</value>
          </div>
          <div class="balance-item">
            <label>Available:</label>
            <value>${data.balance.free} USDT</value>
          </div>
          <div class="balance-item">
            <label>In Use:</label>
            <value>${data.balance.used} USDT</value>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load balance:', error);
  }
}
```

#### 3.3 API Key Management Modal
```html
<div id="apiKeyModal" class="modal">
  <div class="modal-content">
    <h2>Connect Exchange API</h2>

    <div class="warning-box">
      ⚠️ Your API keys are encrypted and stored securely.
      We recommend using read-only + trading permission without withdrawal.
    </div>

    <label>API Key</label>
    <input type="text" id="apiKey" placeholder="Your API Key">

    <label>API Secret</label>
    <input type="password" id="apiSecret" placeholder="Your API Secret">

    <label>Sub Account (Optional)</label>
    <input type="text" id="subAccount" placeholder="Sub account name">

    <div class="modal-actions">
      <button onclick="saveApiKeys()">Save Keys</button>
      <button onclick="closeApiKeyModal()">Cancel</button>
    </div>
  </div>
</div>
```

---

### PHASE 4: Signal Execution Logic ⏱️ 30 dakika

**Dosya**: `/home/automatedtradebot/backend/src/services/signalExecutor.js`

**Updates**:
```javascript
async function executeSignal(signal, subscription) {
  // Get user preferences
  const {
    orderType,
    fixedOrderSize,
    usePercentage,
    orderSizePercent,
    autoStopEnabled,
    currentProfitLoss,
    autoStopProfitPercent,
    autoStopLossPercent
  } = subscription;

  // Check if auto-stop triggered
  if (autoStopEnabled) {
    if (autoStopProfitPercent && currentProfitLoss >= autoStopProfitPercent) {
      logger.info(`Subscription ${subscription.id} paused: profit target reached`);
      return { success: false, reason: 'Profit target reached' };
    }

    if (autoStopLossPercent && currentProfitLoss <= autoStopLossPercent) {
      logger.info(`Subscription ${subscription.id} paused: loss limit reached`);
      return { success: false, reason: 'Loss limit reached' };
    }
  }

  // Calculate order size
  let orderSize;
  if (usePercentage) {
    const balance = await getAccountBalance(subscription);
    orderSize = (balance.free * orderSizePercent) / 100;
  } else {
    orderSize = fixedOrderSize || 100; // Default 100 USDT
  }

  // Determine market type
  const symbol = orderType === 'SPOT'
    ? signal.symbol.replace('.P', '')  // Remove perpetual suffix
    : signal.symbol;

  // Execute order
  const exchange = initializeExchange(subscription);
  const order = await exchange.createOrder(
    symbol,
    orderType === 'SPOT' ? 'market' : 'market',
    signal.direction === 'LONG' ? 'buy' : 'sell',
    orderSize / signal.entryPrice // Calculate quantity
  );

  return { success: true, order };
}
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Database & Schema
- [ ] Update `schema.prisma` with new fields
- [ ] Run `npx prisma migrate dev`
- [ ] Verify migration success
- [ ] Test new fields in Prisma Studio

### Backend API
- [ ] Update PUT `/api/subscriptions/:id` endpoint
- [ ] Create GET `/api/subscriptions/:id/balance` endpoint
- [ ] Create POST `/api/subscriptions/:id/api-keys` endpoint
- [ ] Add encryption utility for API keys
- [ ] Implement auto-stop monitoring service
- [ ] Update signal executor logic

### Frontend
- [ ] Add Order Configuration section to edit modal
- [ ] Add Auto Stop Configuration section
- [ ] Add Account Balance display
- [ ] Create API Key management modal
- [ ] Add real-time balance refresh button
- [ ] Update CSS for new UI elements
- [ ] Add validation for input fields

### Testing
- [ ] Test fixed order size execution
- [ ] Test percentage-based order size
- [ ] Test Spot vs Futures order routing
- [ ] Test auto-stop profit trigger
- [ ] Test auto-stop loss trigger
- [ ] Test balance API integration
- [ ] Test API key encryption/decryption

### Security
- [ ] Implement API key encryption (AES-256)
- [ ] Add rate limiting for balance API
- [ ] Validate API key permissions
- [ ] Add audit logging for sensitive operations

---

## ⏱️ TIME ESTIMATE

| Phase | Task | Time |
|-------|------|------|
| 1 | Database Schema | 15 min |
| 2 | Backend API | 30 min |
| 3 | Frontend UI | 45 min |
| 4 | Signal Execution | 30 min |
| 5 | Testing & Debug | 30 min |
| **TOTAL** | | **~2.5 hours** |

---

## 🚀 PRIORITY ORDER

1. **HIGH PRIORITY**:
   - Fixed Order Size (most requested)
   - Spot/Futures Selection
   - Auto Stop by Profit %

2. **MEDIUM PRIORITY**:
   - Auto Stop by Loss %
   - Account Balance Display

3. **NICE TO HAVE**:
   - Percentage-based order sizing
   - Sub-account support
   - Multiple exchange support

---

## 📝 NOTES

### Security Considerations:
- API keys must be encrypted at rest
- Use environment variable for encryption key
- Never log API keys or secrets
- Implement IP whitelisting when possible

### Exchange API Requirements:
- Read balance permission
- Trade permission (Spot or Futures)
- **NO withdrawal permission** (safety)

### Auto-Stop Behavior:
- When triggered, subscription status → PAUSED
- User receives notification (email/push)
- User can manually resume
- P&L is cumulative (all trades combined)

---

**Status**: Ready for implementation
**Estimated Completion**: ~2.5 hours
**Dependencies**: ccxt library (already installed), crypto module for encryption
