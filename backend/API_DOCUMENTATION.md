# AutomatedTradeBot API Documentation

**Version:** 1.0.0
**Base URL:** `https://automatedtradebot.com/api`
**Environment:** Production

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Providers](#provider-endpoints)
  - [Signals](#signal-endpoints)
  - [Subscriptions](#subscription-endpoints)
  - [Trading](#trading-endpoints)
  - [Real-Time Data](#real-time-data-endpoints)
  - [Risk Management](#risk-management-endpoints)
  - [Copy Trading](#copy-trading-endpoints)
  - [Monitoring](#monitoring-endpoints)
- [WebSocket API](#websocket-api)
- [Webhooks](#webhooks)
- [Examples](#examples)

---

## Overview

The AutomatedTradeBot API provides a complete cryptocurrency trading signal marketplace platform with real-time data, automated copy trading, and comprehensive risk management. All data is sourced from real exchanges (Bybit, MEXC, Bitget, Binance) via CCXT - **NO FAKE OR DEMO DATA**.

### Key Features

- **Real Exchange Data**: Live prices, order books, and trades from major exchanges
- **Signal Marketplace**: Provider/subscriber model with $3/month pricing
- **Copy Trading**: Automated trade execution with risk management
- **Real-Time Streaming**: WebSocket support for live updates
- **TradingView Integration**: Webhook support for Pine Script strategies
- **Advanced Analytics**: Performance tracking, backtesting, paper trading
- **Security**: JWT authentication, 2FA support, rate limiting

---

## Authentication

All protected endpoints require a valid JWT token in the Authorization header.

### Header Format

```
Authorization: Bearer <your-jwt-token>
```

### Token Lifecycle

- **Access Token**: 15 minutes expiration
- **Refresh Token**: 7 days expiration
- **Session Management**: Automatic token refresh via `/api/auth/refresh`

### Authentication Levels

- **Public**: No authentication required
- **Private**: Requires valid JWT token
- **Provider**: Requires provider role
- **Admin**: Requires admin role

---

## Rate Limiting

Rate limits protect the API from abuse and ensure fair usage.

### Global Limits

- **Default**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **Signal Creation**: 10 requests per hour per user

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

### Rate Limit Response (429)

```json
{
  "success": false,
  "error": "Too many requests, please try again later",
  "retryAfter": 900
}
```

---

## Response Format

All API responses follow a consistent JSON structure.

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "details": {
    // Additional error information
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

---

## API Endpoints

### Authentication Endpoints

#### Register User

```http
POST /api/auth/register
```

**Access**: Public
**Rate Limit**: 5 requests per 15 minutes

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "username": "traderpro",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "traderpro"
    },
    "token": "jwt-access-token",
    "refreshToken": "jwt-refresh-token"
  }
}
```

---

#### Login

```http
POST /api/auth/login
```

**Access**: Public
**Rate Limit**: 5 requests per 15 minutes

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "USER"
    },
    "token": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "expiresIn": 900
  }
}
```

---

#### Logout

```http
POST /api/auth/logout
```

**Access**: Private

**Response** (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### Refresh Token

```http
POST /api/auth/refresh
```

**Access**: Public

**Request Body**:
```json
{
  "refreshToken": "your-refresh-token"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "token": "new-jwt-token",
    "expiresIn": 900
  }
}
```

---

#### Get Current User

```http
GET /api/auth/me
```

**Access**: Private

**Response** (200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "traderpro",
      "role": "USER",
      "isProvider": false,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  }
}
```

---

#### Forgot Password

```http
POST /api/auth/forgot-password
```

**Access**: Public
**Rate Limit**: 5 requests per 15 minutes

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

#### Reset Password

```http
POST /api/auth/reset-password
```

**Access**: Public

**Request Body**:
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePassword123!"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

---

#### Verify Email

```http
POST /api/auth/verify-email
```

**Access**: Public

**Request Body**:
```json
{
  "token": "verification-token-from-email"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

---

### Provider Endpoints

#### Get All Providers

```http
GET /api/providers
```

**Access**: Public (optional authentication for personalized results)

**Query Parameters**:
- `sort` (string): Sort by "roi", "winRate", "subscribers", "newest"
- `limit` (number): Number of results (default: 20, max: 100)
- `offset` (number): Pagination offset (default: 0)

**Response** (200):
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "id": "uuid",
        "username": "cryptomaster",
        "displayName": "Crypto Master Pro",
        "description": "Professional trader with 5 years experience",
        "statistics": {
          "roi": 145.5,
          "winRate": 68.5,
          "totalSignals": 234,
          "totalSubscribers": 1250,
          "avgHoldTime": "4.5 hours"
        },
        "pricing": {
          "monthlyFee": 3.00,
          "currency": "USD"
        },
        "verified": true,
        "rating": 4.8,
        "createdAt": "2024-06-01T00:00:00Z"
      }
    ],
    "total": 150,
    "limit": 20,
    "offset": 0
  }
}
```

---

#### Get Provider Details

```http
GET /api/providers/:id
```

**Access**: Public

**Response** (200):
```json
{
  "success": true,
  "data": {
    "provider": {
      "id": "uuid",
      "username": "cryptomaster",
      "displayName": "Crypto Master Pro",
      "description": "Professional trader specializing in XRP and SOL",
      "statistics": {
        "roi": 145.5,
        "winRate": 68.5,
        "totalSignals": 234,
        "totalSubscribers": 1250,
        "avgHoldTime": "4.5 hours",
        "maxDrawdown": 12.3,
        "sharpeRatio": 2.1
      },
      "pricing": {
        "monthlyFee": 3.00,
        "currency": "USD",
        "revShare": {
          "provider": 70,
          "platform": 30
        }
      },
      "strategies": [
        {
          "id": "uuid",
          "name": "7RSI Momentum",
          "description": "Multi-timeframe RSI strategy",
          "performance": {
            "roi": 156.2,
            "winRate": 71.0
          }
        }
      ],
      "recentSignals": [],
      "verified": true,
      "rating": 4.8,
      "reviews": 45,
      "joinedAt": "2024-06-01T00:00:00Z"
    }
  }
}
```

---

#### Become a Provider

```http
POST /api/providers
```

**Access**: Private

**Request Body**:
```json
{
  "displayName": "My Trading Signals",
  "description": "Expert in momentum trading strategies",
  "tradingExperience": 5,
  "specialties": ["XRP", "SOL", "BTC"],
  "strategies": [
    {
      "name": "RSI Momentum",
      "description": "7-period RSI strategy"
    }
  ]
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Provider profile created successfully",
  "data": {
    "provider": {
      "id": "uuid",
      "userId": "uuid",
      "displayName": "My Trading Signals",
      "status": "pending_verification"
    }
  }
}
```

---

#### Update Provider Profile

```http
PUT /api/providers/:id
```

**Access**: Private (Provider only)

**Request Body**:
```json
{
  "displayName": "Updated Name",
  "description": "Updated description",
  "monthlyFee": 3.00
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Provider profile updated"
}
```

---

#### Get Provider's Signals

```http
GET /api/providers/:id/signals
```

**Access**: Public/Private (subscription required for full access)

**Query Parameters**:
- `status` (string): "ACTIVE", "CLOSED", "ALL"
- `limit` (number): Results per page (default: 20)
- `offset` (number): Pagination offset

**Response** (200):
```json
{
  "success": true,
  "data": {
    "signals": [
      {
        "id": "uuid",
        "pair": "XRP/USDT",
        "side": "BUY",
        "entryPrice": 0.5234,
        "currentPrice": 0.5456,
        "stopLoss": 0.5000,
        "takeProfit": 0.5800,
        "status": "ACTIVE",
        "pnl": 4.24,
        "pnlPercent": 4.24,
        "confidence": 85,
        "createdAt": "2025-01-15T10:00:00Z"
      }
    ]
  }
}
```

---

#### Get Provider Statistics

```http
GET /api/providers/:id/stats
```

**Access**: Public

**Query Parameters**:
- `period` (string): "7d", "30d", "90d", "1y", "all"

**Response** (200):
```json
{
  "success": true,
  "data": {
    "stats": {
      "overview": {
        "roi": 145.5,
        "winRate": 68.5,
        "totalSignals": 234,
        "profitableSignals": 160,
        "totalSubscribers": 1250,
        "revenue": 2625.00
      },
      "performance": {
        "avgWin": 5.2,
        "avgLoss": -2.1,
        "profitFactor": 2.48,
        "sharpeRatio": 2.1,
        "maxDrawdown": 12.3,
        "avgHoldTime": "4.5 hours"
      },
      "byPair": [
        {
          "pair": "XRP/USDT",
          "signals": 120,
          "winRate": 72.0,
          "roi": 156.2
        }
      ]
    }
  }
}
```

---

### Signal Endpoints

#### Get All Signals

```http
GET /api/signals
```

**Access**: Public (limited) / Private (full access with subscription)

**Query Parameters**:
- `status` (string): "ACTIVE", "CLOSED", "ALL"
- `pair` (string): Filter by trading pair (e.g., "XRP/USDT")
- `side` (string): "BUY" or "SELL"
- `providerId` (string): Filter by provider
- `sort` (string): "newest", "roi", "confidence"
- `limit` (number): Results per page
- `offset` (number): Pagination offset

**Response** (200):
```json
{
  "success": true,
  "data": {
    "signals": [
      {
        "id": "uuid",
        "providerId": "uuid",
        "providerName": "Crypto Master Pro",
        "strategyId": "uuid",
        "strategyName": "7RSI Momentum",
        "pair": "XRP/USDT",
        "exchange": "Bybit",
        "side": "BUY",
        "entryPrice": 0.5234,
        "currentPrice": 0.5456,
        "stopLoss": 0.5000,
        "takeProfit": 0.5800,
        "status": "ACTIVE",
        "pnl": 22.20,
        "pnlPercent": 4.24,
        "confidence": 85,
        "risk": "MEDIUM",
        "analysis": "Strong momentum on 1H and 4H timeframes",
        "createdAt": "2025-01-15T10:00:00Z",
        "updatedAt": "2025-01-15T12:30:00Z"
      }
    ],
    "total": 450,
    "limit": 20,
    "offset": 0
  }
}
```

---

#### Get Signal Details

```http
GET /api/signals/:id
```

**Access**: Public/Private (subscription may be required)

**Response** (200):
```json
{
  "success": true,
  "data": {
    "signal": {
      "id": "uuid",
      "providerId": "uuid",
      "providerName": "Crypto Master Pro",
      "strategyId": "uuid",
      "strategyName": "7RSI Momentum",
      "pair": "XRP/USDT",
      "exchange": "Bybit",
      "side": "BUY",
      "entryPrice": 0.5234,
      "currentPrice": 0.5456,
      "stopLoss": 0.5000,
      "takeProfit": 0.5800,
      "status": "ACTIVE",
      "pnl": 22.20,
      "pnlPercent": 4.24,
      "confidence": 85,
      "risk": "MEDIUM",
      "analysis": "Strong momentum on 1H and 4H timeframes. RSI crossed above 70 on multiple timeframes.",
      "targets": [
        { "price": 0.5500, "reached": true, "reachedAt": "2025-01-15T11:00:00Z" },
        { "price": 0.5650, "reached": false },
        { "price": 0.5800, "reached": false }
      ],
      "updates": [
        {
          "timestamp": "2025-01-15T12:00:00Z",
          "message": "Target 1 reached. Consider taking partial profits."
        }
      ],
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T12:30:00Z"
    }
  }
}
```

---

#### Create Signal

```http
POST /api/signals
```

**Access**: Private (Provider only)
**Rate Limit**: 10 requests per hour

**Request Body**:
```json
{
  "strategyId": "uuid",
  "pair": "XRP/USDT",
  "exchange": "Bybit",
  "side": "BUY",
  "entryPrice": 0.5234,
  "stopLoss": 0.5000,
  "takeProfit": 0.5800,
  "confidence": 85,
  "risk": "MEDIUM",
  "analysis": "Strong momentum on multiple timeframes",
  "targets": [0.5500, 0.5650, 0.5800]
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Signal created successfully",
  "data": {
    "signal": {
      "id": "uuid",
      "pair": "XRP/USDT",
      "side": "BUY",
      "entryPrice": 0.5234,
      "status": "ACTIVE",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  }
}
```

---

#### Update Signal

```http
PUT /api/signals/:id
```

**Access**: Private (Provider only)

**Request Body**:
```json
{
  "stopLoss": 0.5100,
  "takeProfit": 0.5900,
  "analysis": "Updated analysis with new targets",
  "status": "ACTIVE"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Signal updated successfully"
}
```

---

#### Close Signal

```http
DELETE /api/signals/:id
```

**Access**: Private (Provider only)

**Request Body**:
```json
{
  "closePrice": 0.5456,
  "reason": "Take profit target reached"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Signal closed successfully",
  "data": {
    "signal": {
      "id": "uuid",
      "status": "CLOSED",
      "closePrice": 0.5456,
      "pnl": 22.20,
      "pnlPercent": 4.24,
      "closedAt": "2025-01-15T14:00:00Z"
    }
  }
}
```

---

### Subscription Endpoints

#### Get User Subscriptions

```http
GET /api/subscriptions
```

**Access**: Private

**Response** (200):
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "id": "uuid",
        "providerId": "uuid",
        "providerName": "Crypto Master Pro",
        "status": "ACTIVE",
        "monthlyFee": 3.00,
        "startDate": "2025-01-01T00:00:00Z",
        "nextBillingDate": "2025-02-01T00:00:00Z",
        "copyTrading": {
          "enabled": true,
          "riskSettings": {
            "maxPositionSize": 100,
            "scaleFactor": 1.0
          }
        }
      }
    ]
  }
}
```

---

#### Subscribe to Provider

```http
POST /api/subscriptions
```

**Access**: Private

**Request Body**:
```json
{
  "providerId": "uuid",
  "paymentMethodId": "stripe-payment-method-id",
  "copyTrading": {
    "enabled": true,
    "riskSettings": {
      "maxPositionSize": 100,
      "maxPositions": 5,
      "scaleFactor": 1.0,
      "useStopLoss": true,
      "useTakeProfit": true,
      "maxDailyLoss": 50
    }
  }
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "subscription": {
      "id": "uuid",
      "providerId": "uuid",
      "status": "ACTIVE",
      "nextBillingDate": "2025-02-15T00:00:00Z"
    }
  }
}
```

---

#### Cancel Subscription

```http
DELETE /api/subscriptions/:id
```

**Access**: Private

**Response** (200):
```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "data": {
    "subscription": {
      "id": "uuid",
      "status": "CANCELLED",
      "endDate": "2025-02-01T00:00:00Z"
    }
  }
}
```

---

#### Get Provider Revenue

```http
GET /api/subscriptions/revenue
```

**Access**: Private (Provider only)

**Query Parameters**:
- `period` (string): "7d", "30d", "90d", "1y", "all"

**Response** (200):
```json
{
  "success": true,
  "data": {
    "revenue": {
      "current": {
        "totalSubscribers": 1250,
        "monthlyRevenue": 2625.00,
        "providerShare": 1837.50,
        "platformFee": 787.50
      },
      "historical": [
        {
          "month": "2025-01",
          "subscribers": 1250,
          "revenue": 2625.00,
          "payout": 1837.50
        }
      ],
      "projections": {
        "nextMonth": 2700.00
      }
    }
  }
}
```

---

### Trading Endpoints

#### Run Backtest

```http
POST /api/trading/backtest
```

**Access**: Private

**Request Body**:
```json
{
  "strategyId": "uuid",
  "pair": "XRP/USDT",
  "timeframe": "1h",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "initialCapital": 1000,
  "parameters": {
    "rsiPeriod": 7,
    "rsiOverbought": 70,
    "rsiOversold": 30
  }
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "backtest": {
      "strategyName": "7RSI Momentum",
      "pair": "XRP/USDT",
      "period": {
        "start": "2024-01-01T00:00:00Z",
        "end": "2024-12-31T23:59:59Z"
      },
      "performance": {
        "initialCapital": 1000,
        "finalCapital": 1455.20,
        "roi": 45.52,
        "totalTrades": 234,
        "winningTrades": 160,
        "losingTrades": 74,
        "winRate": 68.38,
        "profitFactor": 2.45,
        "sharpeRatio": 1.85,
        "maxDrawdown": 12.5,
        "avgWin": 5.2,
        "avgLoss": -2.1
      },
      "trades": [],
      "equityCurve": []
    }
  }
}
```

---

#### Run Batch Backtest

```http
POST /api/trading/backtest/batch
```

**Access**: Private

**Request Body**:
```json
{
  "strategyId": "uuid",
  "pairs": ["XRP/USDT", "SOL/USDT", "BTC/USDT"],
  "timeframes": ["15m", "1h", "4h"],
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "initialCapital": 1000
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "pair": "XRP/USDT",
        "timeframe": "1h",
        "roi": 45.52,
        "winRate": 68.38,
        "totalTrades": 234
      }
    ],
    "summary": {
      "bestPerforming": {
        "pair": "SOL/USDT",
        "timeframe": "4h",
        "roi": 78.3
      },
      "avgRoi": 56.2,
      "avgWinRate": 65.5
    }
  }
}
```

---

#### Optimize Strategy

```http
POST /api/trading/optimize
```

**Access**: Private

**Request Body**:
```json
{
  "strategyId": "uuid",
  "pair": "XRP/USDT",
  "timeframe": "1h",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "parameterRanges": {
    "rsiPeriod": { "min": 5, "max": 14, "step": 1 },
    "rsiOverbought": { "min": 65, "max": 80, "step": 5 },
    "rsiOversold": { "min": 20, "max": 35, "step": 5 }
  },
  "optimizationMetric": "sharpeRatio"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "optimization": {
      "totalCombinations": 180,
      "testedCombinations": 180,
      "bestParameters": {
        "rsiPeriod": 7,
        "rsiOverbought": 70,
        "rsiOversold": 30
      },
      "performance": {
        "roi": 52.3,
        "winRate": 71.2,
        "sharpeRatio": 2.15,
        "maxDrawdown": 10.5
      },
      "allResults": []
    }
  }
}
```

---

#### Start Paper Trading

```http
POST /api/trading/paper/start
```

**Access**: Private

**Request Body**:
```json
{
  "strategyId": "uuid",
  "pair": "XRP/USDT",
  "timeframe": "1h",
  "initialCapital": 1000,
  "parameters": {
    "rsiPeriod": 7,
    "rsiOverbought": 70,
    "rsiOversold": 30
  }
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "type": "paper",
      "strategyId": "uuid",
      "pair": "XRP/USDT",
      "status": "active",
      "initialCapital": 1000,
      "currentCapital": 1000,
      "startedAt": "2025-01-15T10:00:00Z"
    }
  }
}
```

---

#### Stop Paper Trading

```http
POST /api/trading/paper/stop/:sessionId
```

**Access**: Private

**Response** (200):
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "status": "stopped",
      "finalCapital": 1125.50,
      "roi": 12.55,
      "totalTrades": 45,
      "winRate": 66.7,
      "stoppedAt": "2025-01-20T10:00:00Z"
    }
  }
}
```

---

#### Get Paper Trading Sessions

```http
GET /api/trading/paper/sessions
```

**Access**: Private

**Response** (200):
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "strategyName": "7RSI Momentum",
        "pair": "XRP/USDT",
        "status": "active",
        "roi": 12.55,
        "winRate": 66.7,
        "totalTrades": 45,
        "startedAt": "2025-01-15T10:00:00Z"
      }
    ]
  }
}
```

---

#### Start Real Trading

```http
POST /api/trading/real/start
```

**Access**: Private (Provider/Admin only)

**Request Body**:
```json
{
  "strategyId": "uuid",
  "pair": "XRP/USDT",
  "timeframe": "1h",
  "exchange": "Bybit",
  "apiKeyId": "uuid",
  "initialCapital": 1000,
  "riskManagement": {
    "maxPositionSize": 100,
    "maxDailyLoss": 50,
    "useStopLoss": true
  }
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "type": "real",
      "status": "active",
      "exchange": "Bybit",
      "startedAt": "2025-01-15T10:00:00Z"
    }
  }
}
```

---

#### Emergency Stop All Positions

```http
POST /api/trading/real/emergency-stop
```

**Access**: Private (Provider/Admin only)

**Response** (200):
```json
{
  "success": true,
  "message": "All positions closed successfully",
  "data": {
    "closedPositions": 3,
    "totalPnl": -15.20
  }
}
```

---

#### TradingView Webhook

```http
POST /api/trading/tradingview/webhook
```

**Access**: Public (IP-restricted in production)

**IP Whitelist**: 52.89.214.238, 34.212.75.30, 54.218.53.128, 52.32.178.7

**Request Body**:
```json
{
  "strategy": "7RSI Momentum",
  "pair": "XRP/USDT",
  "action": "BUY",
  "price": 0.5234,
  "stopLoss": 0.5000,
  "takeProfit": 0.5800,
  "message": "RSI signal triggered"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "received": true,
    "signalId": "uuid",
    "processed": true
  }
}
```

---

#### Configure TradingView Webhook

```http
POST /api/trading/tradingview/configure
```

**Access**: Private

**Request Body**:
```json
{
  "enabled": true,
  "strategyId": "uuid",
  "autoPublish": true,
  "autoTrade": false
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "config": {
      "enabled": true,
      "webhookUrl": "https://automatedtradebot.com/api/trading/tradingview/webhook"
    }
  }
}
```

---

#### Get All Strategies

```http
GET /api/trading/strategies
```

**Access**: Private

**Response** (200):
```json
{
  "success": true,
  "data": {
    "strategies": [
      {
        "id": "uuid",
        "name": "7RSI Momentum",
        "description": "Multi-timeframe RSI strategy",
        "type": "TECHNICAL",
        "parameters": {
          "rsiPeriod": 7,
          "rsiOverbought": 70,
          "rsiOversold": 30
        },
        "performance": {
          "roi": 45.5,
          "winRate": 68.3
        }
      }
    ]
  }
}
```

---

### Real-Time Data Endpoints

**IMPORTANT**: All data from REAL exchanges - NO FAKE/DEMO DATA

#### Get Real Prices

```http
GET /api/realtime/prices
```

**Access**: Public

**Query Parameters**:
- `symbols` (string): Comma-separated pairs (e.g., "XRP/USDT,SOL/USDT")
- `exchange` (string): Exchange name (default: "bybit")

**Response** (200):
```json
{
  "success": true,
  "source": "REAL_EXCHANGE_DATA",
  "exchange": "bybit",
  "timestamp": 1705315200000,
  "data": [
    {
      "symbol": "XRP/USDT",
      "price": 0.5234,
      "bid": 0.5233,
      "ask": 0.5235,
      "volume24h": 12345678.90,
      "change24h": 2.45,
      "high24h": 0.5456,
      "low24h": 0.5100,
      "timestamp": 1705315200000
    }
  ]
}
```

---

#### Get Real Historical Data

```http
GET /api/realtime/historical
```

**Access**: Public

**Query Parameters**:
- `symbol` (string): Trading pair (default: "XRP/USDT")
- `timeframe` (string): Candlestick interval (5m, 15m, 1h, 4h, 1d)
- `startDate` (string): ISO date string
- `endDate` (string): ISO date string
- `exchange` (string): Exchange name (default: "bybit")

**Response** (200):
```json
{
  "success": true,
  "source": "REAL_HISTORICAL_DATA",
  "symbol": "XRP/USDT",
  "timeframe": "1h",
  "dataPoints": 720,
  "data": [
    {
      "timestamp": 1705315200000,
      "open": 0.5200,
      "high": 0.5250,
      "low": 0.5180,
      "close": 0.5234,
      "volume": 1234567.89
    }
  ]
}
```

---

#### Get Real Order Book

```http
GET /api/realtime/orderbook/:symbol
```

**Access**: Public

**Query Parameters**:
- `exchange` (string): Exchange name (default: "bybit")
- `limit` (number): Depth limit (default: 20, max: 100)

**Response** (200):
```json
{
  "success": true,
  "source": "REAL_EXCHANGE_ORDERBOOK",
  "exchange": "bybit",
  "data": {
    "symbol": "XRP/USDT",
    "timestamp": 1705315200000,
    "bids": [
      [0.5234, 10000],
      [0.5233, 5000]
    ],
    "asks": [
      [0.5235, 8000],
      [0.5236, 12000]
    ]
  }
}
```

---

#### Get Real Trades

```http
GET /api/realtime/trades/:symbol
```

**Access**: Public

**Query Parameters**:
- `exchange` (string): Exchange name
- `limit` (number): Number of trades (default: 50, max: 100)

**Response** (200):
```json
{
  "success": true,
  "source": "REAL_EXCHANGE_TRADES",
  "exchange": "bybit",
  "count": 50,
  "data": [
    {
      "id": "trade-id",
      "timestamp": 1705315200000,
      "price": 0.5234,
      "amount": 1000,
      "side": "buy"
    }
  ]
}
```

---

#### Get Real Trading Signals

```http
GET /api/realtime/signals
```

**Access**: Public

**Response** (200):
```json
{
  "success": true,
  "source": "REAL_MARKET_ANALYSIS",
  "timestamp": 1705315200000,
  "count": 5,
  "data": [
    {
      "pair": "XRP/USDT",
      "signal": "BUY",
      "strength": 85,
      "price": 0.5234,
      "indicators": {
        "rsi": 35,
        "macd": "bullish",
        "trend": "up"
      }
    }
  ]
}
```

---

#### Verify Real Connections

```http
GET /api/realtime/verify
```

**Access**: Public

**Response** (200):
```json
{
  "success": true,
  "message": "All data sources are REAL exchanges",
  "timestamp": 1705315200000,
  "exchanges": {
    "bybit": { "status": "connected", "latency": 45 },
    "mexc": { "status": "connected", "latency": 52 },
    "bitget": { "status": "connected", "latency": 38 },
    "binance": { "status": "connected", "latency": 41 }
  }
}
```

---

#### Latency Test

```http
GET /api/realtime/latency
```

**Access**: Public

**Response** (200):
```json
{
  "success": true,
  "source": "REAL_LATENCY_TEST",
  "timestamp": 1705315200000,
  "averageLatency": 44,
  "tests": [
    {
      "exchange": "bybit",
      "latency": 45,
      "status": "connected"
    }
  ]
}
```

---

### Risk Management Endpoints

#### Get Risk Configurations

```http
GET /api/risk-management
```

**Access**: Private

**Response** (200):
```json
{
  "success": true,
  "data": {
    "configs": [
      {
        "id": "uuid",
        "name": "Conservative",
        "type": "ADAPTIVE",
        "settings": {
          "maxPositionSize": 50,
          "maxDailyLoss": 25,
          "maxPositions": 3,
          "useStopLoss": true,
          "useTakeProfit": true,
          "newsBasedAdjustment": true
        }
      }
    ]
  }
}
```

---

#### Create Risk Configuration

```http
POST /api/risk-management
```

**Access**: Private

**Request Body**:
```json
{
  "name": "Aggressive",
  "type": "NON_ADAPTIVE",
  "settings": {
    "maxPositionSize": 200,
    "maxDailyLoss": 100,
    "maxPositions": 10,
    "useStopLoss": true,
    "useTakeProfit": true
  }
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Risk configuration created",
  "data": {
    "config": {
      "id": "uuid",
      "name": "Aggressive"
    }
  }
}
```

---

### Copy Trading Endpoints

#### Enable Copy Trading

```http
POST /api/copy-trading/enable
```

**Access**: Private

**Request Body**:
```json
{
  "providerId": "uuid",
  "strategyId": "uuid",
  "riskSettings": {
    "maxPositionSize": 100,
    "scaleFactor": 1.0,
    "maxPositions": 5,
    "useStopLoss": true,
    "useTakeProfit": true,
    "maxDailyLoss": 50
  }
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Copy trading enabled",
  "data": {
    "copyTradingId": "uuid",
    "status": "active"
  }
}
```

---

#### Disable Copy Trading

```http
POST /api/copy-trading/disable/:id
```

**Access**: Private

**Response** (200):
```json
{
  "success": true,
  "message": "Copy trading disabled"
}
```

---

#### Get Copy Trading Status

```http
GET /api/copy-trading/status
```

**Access**: Private

**Response** (200):
```json
{
  "success": true,
  "data": {
    "activeCopyTrades": [
      {
        "id": "uuid",
        "providerId": "uuid",
        "providerName": "Crypto Master Pro",
        "strategyName": "7RSI Momentum",
        "status": "active",
        "totalCopiedTrades": 45,
        "roi": 8.5,
        "riskSettings": {
          "maxPositionSize": 100,
          "scaleFactor": 1.0
        }
      }
    ]
  }
}
```

---

### Monitoring Endpoints

#### Get System Health

```http
GET /api/monitoring/health
```

**Access**: Private (Admin only)

**Response** (200):
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "checks": {
      "system": {
        "status": "healthy",
        "cpu": 45.2,
        "memory": 62.8,
        "uptime": 86400
      },
      "database": {
        "status": "healthy",
        "latency": 12,
        "connections": 25
      },
      "exchanges": {
        "status": "healthy",
        "connected": 4,
        "avgLatency": 44
      },
      "websocket": {
        "status": "healthy",
        "connections": 1250
      }
    },
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

---

#### Get System Metrics

```http
GET /api/monitoring/metrics
```

**Access**: Private (Admin only)

**Response** (200):
```json
{
  "success": true,
  "data": {
    "system": {
      "cpu": 45.2,
      "memory": 62.8,
      "disk": 48.5,
      "uptime": 86400
    },
    "database": {
      "latency": 12,
      "connections": 25,
      "queryRate": 150
    },
    "trading": {
      "activeUsers": 1250,
      "activeSignals": 450,
      "activeSubscriptions": 3200,
      "todayTrades": 789
    },
    "api": {
      "requestsPerMinute": 450,
      "avgLatency": 125,
      "errorRate": 0.02
    }
  }
}
```

---

#### Get Active Alerts

```http
GET /api/monitoring/alerts
```

**Access**: Private (Admin only)

**Response** (200):
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "uuid",
        "severity": "WARNING",
        "title": "High CPU Usage",
        "message": "CPU usage at 75%",
        "timestamp": "2025-01-15T09:45:00Z",
        "acknowledged": false
      }
    ]
  }
}
```

---

## WebSocket API

The WebSocket API provides real-time streaming of prices, signals, and updates.

### Connection

```javascript
const ws = new WebSocket('wss://automatedtradebot.com/realtime');

// Authenticate after connection
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-jwt-token'
}));
```

### Subscribe to Channels

```javascript
// Subscribe to price updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'prices:XRP/USDT'
}));

// Subscribe to signals
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'signals:live'
}));

// Subscribe to provider signals
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'provider:uuid:signals'
}));
```

### Message Format

**Price Update**:
```json
{
  "type": "price_update",
  "channel": "prices:XRP/USDT",
  "data": {
    "symbol": "XRP/USDT",
    "price": 0.5234,
    "change24h": 2.45,
    "volume24h": 12345678.90,
    "timestamp": 1705315200000
  }
}
```

**New Signal**:
```json
{
  "type": "new_signal",
  "channel": "signals:live",
  "data": {
    "id": "uuid",
    "pair": "XRP/USDT",
    "side": "BUY",
    "entryPrice": 0.5234,
    "provider": "Crypto Master Pro",
    "confidence": 85
  }
}
```

**Signal Update**:
```json
{
  "type": "signal_update",
  "channel": "signals:live",
  "data": {
    "id": "uuid",
    "status": "CLOSED",
    "closePrice": 0.5456,
    "pnl": 4.24
  }
}
```

### Available Channels

- `prices:{SYMBOL}` - Real-time price updates for specific pair
- `signals:live` - All new signals
- `signals:active` - Updates to active signals
- `provider:{PROVIDER_ID}:signals` - Specific provider signals
- `user:notifications` - Personal notifications
- `admin:alerts` - System alerts (admin only)

---

## Webhooks

### TradingView Webhook

Configure TradingView to send alerts to:
```
https://automatedtradebot.com/api/trading/tradingview/webhook
```

**Alert Message Format**:
```json
{
  "strategy": "{{strategy.order.alert_message}}",
  "pair": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "price": {{close}},
  "message": "{{strategy.order.comment}}"
}
```

---

## Examples

### Complete Authentication Flow

```javascript
// 1. Register
const registerResponse = await fetch('https://automatedtradebot.com/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'trader@example.com',
    password: 'SecurePass123!',
    username: 'cryptotrader'
  })
});
const { data } = await registerResponse.json();
const { token, refreshToken } = data;

// 2. Store tokens securely
localStorage.setItem('accessToken', token);
localStorage.setItem('refreshToken', refreshToken);

// 3. Make authenticated requests
const profileResponse = await fetch('https://automatedtradebot.com/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const profile = await profileResponse.json();

// 4. Refresh token when expired
const refreshResponse = await fetch('https://automatedtradebot.com/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken })
});
const { data: newData } = await refreshResponse.json();
localStorage.setItem('accessToken', newData.token);
```

### Subscribe to Provider with Copy Trading

```javascript
const token = localStorage.getItem('accessToken');

const subscribeResponse = await fetch('https://automatedtradebot.com/api/subscriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    providerId: 'provider-uuid',
    paymentMethodId: 'stripe-pm-123',
    copyTrading: {
      enabled: true,
      riskSettings: {
        maxPositionSize: 100,
        maxPositions: 5,
        scaleFactor: 1.0,
        useStopLoss: true,
        useTakeProfit: true,
        maxDailyLoss: 50
      }
    }
  })
});

const { data } = await subscribeResponse.json();
console.log('Subscribed with copy trading:', data.subscription);
```

### Run Backtest and Optimize

```javascript
const token = localStorage.getItem('accessToken');

// 1. Run initial backtest
const backtestResponse = await fetch('https://automatedtradebot.com/api/trading/backtest', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    strategyId: 'strategy-uuid',
    pair: 'XRP/USDT',
    timeframe: '1h',
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-12-31T23:59:59Z',
    initialCapital: 1000
  })
});
const backtest = await backtestResponse.json();
console.log('Initial ROI:', backtest.data.performance.roi);

// 2. Optimize parameters
const optimizeResponse = await fetch('https://automatedtradebot.com/api/trading/optimize', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    strategyId: 'strategy-uuid',
    pair: 'XRP/USDT',
    timeframe: '1h',
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-12-31T23:59:59Z',
    parameterRanges: {
      rsiPeriod: { min: 5, max: 14, step: 1 },
      rsiOverbought: { min: 65, max: 80, step: 5 },
      rsiOversold: { min: 20, max: 35, step: 5 }
    },
    optimizationMetric: 'sharpeRatio'
  })
});
const optimization = await optimizeResponse.json();
console.log('Optimized parameters:', optimization.data.bestParameters);
console.log('Improved ROI:', optimization.data.performance.roi);
```

### Real-Time Price Streaming

```javascript
// Connect to WebSocket
const ws = new WebSocket('wss://automatedtradebot.com/realtime');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: localStorage.getItem('accessToken')
  }));

  // Subscribe to XRP/USDT prices
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'prices:XRP/USDT'
  }));

  // Subscribe to live signals
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'signals:live'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'price_update') {
    console.log('Price:', message.data.symbol, message.data.price);
  }

  if (message.type === 'new_signal') {
    console.log('New signal:', message.data.pair, message.data.side);
    // Show notification to user
  }
};
```

---

## Support

For API support, please contact:
- **Email**: support@automatedtradebot.com
- **Documentation**: https://docs.automatedtradebot.com
- **Status**: https://status.automatedtradebot.com

## Changelog

### Version 1.0.0 (2025-01-15)
- Initial API release
- Complete authentication system
- Provider/subscriber marketplace
- Real-time data from exchanges
- Copy trading functionality
- Backtesting and optimization
- TradingView integration
- WebSocket streaming
- Monitoring and alerting

---

**All data is sourced from REAL exchanges - NO FAKE OR DEMO DATA**
