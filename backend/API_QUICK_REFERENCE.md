# AutomatedTradeBot API Quick Reference

**Base URL**: `https://automatedtradebot.com/api`

## Quick Links

- [Full API Documentation](./API_DOCUMENTATION.md)
- [WebSocket Guide](#websocket-quick-start)
- [Authentication Guide](#authentication-quick-start)

---

## Authentication Quick Start

### 1. Register
```bash
curl -X POST https://automatedtradebot.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "username": "trader"
  }'
```

### 2. Login
```bash
curl -X POST https://automatedtradebot.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

### 3. Use Token
```bash
export TOKEN="your-jwt-token"

curl https://automatedtradebot.com/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Common Endpoints

### Get Real-Time Prices
```bash
curl "https://automatedtradebot.com/api/realtime/prices?symbols=XRP/USDT,SOL/USDT"
```

### Get All Providers
```bash
curl "https://automatedtradebot.com/api/providers?sort=roi&limit=10"
```

### Get Active Signals
```bash
curl "https://automatedtradebot.com/api/signals?status=ACTIVE&limit=20"
```

### Subscribe to Provider
```bash
curl -X POST https://automatedtradebot.com/api/subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "provider-uuid",
    "paymentMethodId": "stripe-pm-id"
  }'
```

### Create Signal (Provider)
```bash
curl -X POST https://automatedtradebot.com/api/signals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "strategyId": "uuid",
    "pair": "XRP/USDT",
    "side": "BUY",
    "entryPrice": 0.5234,
    "stopLoss": 0.5000,
    "takeProfit": 0.5800,
    "confidence": 85
  }'
```

### Run Backtest
```bash
curl -X POST https://automatedtradebot.com/api/trading/backtest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "strategyId": "uuid",
    "pair": "XRP/USDT",
    "timeframe": "1h",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z",
    "initialCapital": 1000
  }'
```

---

## WebSocket Quick Start

### JavaScript
```javascript
const ws = new WebSocket('wss://automatedtradebot.com/realtime');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));

  // Subscribe to prices
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'prices:XRP/USDT'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Python
```python
import websocket
import json

def on_message(ws, message):
    data = json.loads(message)
    print('Received:', data)

def on_open(ws):
    # Authenticate
    ws.send(json.dumps({
        'type': 'auth',
        'token': 'your-jwt-token'
    }))

    # Subscribe
    ws.send(json.dumps({
        'type': 'subscribe',
        'channel': 'prices:XRP/USDT'
    }))

ws = websocket.WebSocketApp(
    'wss://automatedtradebot.com/realtime',
    on_message=on_message,
    on_open=on_open
)
ws.run_forever()
```

---

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |

---

## Rate Limits

- **Default**: 100 req/15min
- **Auth**: 5 req/15min
- **Signals**: 10 req/hour

---

## Available Exchanges

- Bybit
- MEXC
- Bitget
- Binance

**All data is REAL - NO FAKE/DEMO DATA**

---

## WebSocket Channels

- `prices:{SYMBOL}` - Price updates
- `signals:live` - New signals
- `signals:active` - Signal updates
- `provider:{ID}:signals` - Provider signals
- `user:notifications` - Personal notifications
- `admin:alerts` - System alerts (admin)

---

## TradingView Webhook

**URL**: `https://automatedtradebot.com/api/trading/tradingview/webhook`

**Alert Message**:
```
{
  "strategy": "{{strategy.order.alert_message}}",
  "pair": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "price": {{close}}
}
```

---

## Environment Variables

```bash
# API Configuration
export API_URL="https://automatedtradebot.com/api"
export WS_URL="wss://automatedtradebot.com/realtime"

# Authentication
export AUTH_TOKEN="your-jwt-token"
export REFRESH_TOKEN="your-refresh-token"

# TradingView
export TRADINGVIEW_WEBHOOK="$API_URL/trading/tradingview/webhook"
```

---

## Python SDK Example

```python
import requests

class AutomatedTradeBotAPI:
    def __init__(self, base_url='https://automatedtradebot.com/api'):
        self.base_url = base_url
        self.token = None

    def login(self, email, password):
        response = requests.post(
            f'{self.base_url}/auth/login',
            json={'email': email, 'password': password}
        )
        data = response.json()
        self.token = data['data']['token']
        return data

    def get_headers(self):
        return {'Authorization': f'Bearer {self.token}'}

    def get_providers(self, sort='roi', limit=10):
        response = requests.get(
            f'{self.base_url}/providers',
            params={'sort': sort, 'limit': limit}
        )
        return response.json()

    def get_signals(self, status='ACTIVE'):
        response = requests.get(
            f'{self.base_url}/signals',
            params={'status': status},
            headers=self.get_headers()
        )
        return response.json()

    def create_signal(self, signal_data):
        response = requests.post(
            f'{self.base_url}/signals',
            json=signal_data,
            headers=self.get_headers()
        )
        return response.json()

    def run_backtest(self, backtest_params):
        response = requests.post(
            f'{self.base_url}/trading/backtest',
            json=backtest_params,
            headers=self.get_headers()
        )
        return response.json()

# Usage
api = AutomatedTradeBotAPI()
api.login('user@example.com', 'password')
providers = api.get_providers(sort='roi', limit=5)
print(providers)
```

---

## JavaScript SDK Example

```javascript
class AutomatedTradeBotAPI {
  constructor(baseURL = 'https://automatedtradebot.com/api') {
    this.baseURL = baseURL;
    this.token = null;
  }

  async login(email, password) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    this.token = data.data.token;
    return data;
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  async getProviders(params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${this.baseURL}/providers?${query}`);
    return response.json();
  }

  async getSignals(params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(
      `${this.baseURL}/signals?${query}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }

  async createSignal(signalData) {
    const response = await fetch(`${this.baseURL}/signals`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(signalData)
    });
    return response.json();
  }

  async runBacktest(backtestParams) {
    const response = await fetch(`${this.baseURL}/trading/backtest`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(backtestParams)
    });
    return response.json();
  }
}

// Usage
const api = new AutomatedTradeBotAPI();
await api.login('user@example.com', 'password');
const providers = await api.getProviders({ sort: 'roi', limit: 5 });
console.log(providers);
```

---

## Testing Endpoints

### Health Check
```bash
curl https://automatedtradebot.com/health
```

### Verify Real Exchange Connections
```bash
curl https://automatedtradebot.com/api/realtime/verify
```

### Test Latency
```bash
curl https://automatedtradebot.com/api/realtime/latency
```

---

## Error Handling

```javascript
async function makeAPICall() {
  try {
    const response = await fetch('https://automatedtradebot.com/api/signals');
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    return data.data;
  } catch (error) {
    if (error.status === 401) {
      // Refresh token
      await refreshAuthToken();
      return makeAPICall(); // Retry
    }

    if (error.status === 429) {
      // Rate limited - wait and retry
      await new Promise(r => setTimeout(r, 60000));
      return makeAPICall();
    }

    throw error;
  }
}
```

---

## Support

- **Email**: support@automatedtradebot.com
- **Docs**: https://docs.automatedtradebot.com
- **Full API Docs**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

**Remember: All data is from REAL exchanges - NO FAKE/DEMO DATA!**
