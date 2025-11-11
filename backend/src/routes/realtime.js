/**
 * REAL-TIME DATA ROUTES
 * ONLY REAL DATA FROM EXCHANGES - NO DEMO/FAKE DATA
 * GERÇEK VERİ - SAHTE YOK
 */

const express = require('express');
const router = express.Router();
const realDataService = require('../services/realDataService');
const { authenticate } = require('../middleware/auth');

/**
 * GET REAL PRICES
 * Fetches current prices from real exchanges
 */
router.get('/prices', async (req, res) => {
    try {
        const { symbols, exchange = 'bybit' } = req.query;
        const symbolList = symbols ? symbols.split(',') : [
            'XRP/USDT',
            'SOL/USDT',
            'BTC/USDT',
            'ETH/USDT'
        ];

        const prices = [];
        for (const symbol of symbolList) {
            try {
                const price = await realDataService.getRealPrice(symbol, exchange);
                prices.push(price);
            } catch (error) {
                prices.push({
                    symbol,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            source: 'REAL_EXCHANGE_DATA',
            exchange: exchange,
            timestamp: Date.now(),
            data: prices
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET REAL HISTORICAL DATA
 * Fetches real OHLCV data from exchanges or saved files
 */
router.get('/historical', async (req, res) => {
    try {
        const {
            symbol = 'XRP/USDT',
            timeframe = '1h',
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            endDate = new Date().toISOString(),
            exchange = 'bybit'
        } = req.query;

        const data = await realDataService.getRealHistoricalData(
            symbol,
            timeframe,
            startDate,
            endDate,
            exchange
        );

        res.json({
            success: true,
            source: 'REAL_HISTORICAL_DATA',
            symbol: symbol,
            timeframe: timeframe,
            dataPoints: data.length,
            startDate: startDate,
            endDate: endDate,
            data: data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET REAL ORDER BOOK
 * Fetches live order book from exchange
 */
router.get('/orderbook/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { exchange = 'bybit', limit = 20 } = req.query;

        const orderBook = await realDataService.getRealOrderBook(
            symbol.replace('-', '/'),
            exchange,
            parseInt(limit)
        );

        res.json({
            success: true,
            source: 'REAL_EXCHANGE_ORDERBOOK',
            exchange: exchange,
            data: orderBook
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET REAL TRADES
 * Fetches recent trades from exchange
 */
router.get('/trades/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { exchange = 'bybit', limit = 50 } = req.query;

        const trades = await realDataService.getRealTrades(
            symbol.replace('-', '/'),
            exchange,
            parseInt(limit)
        );

        res.json({
            success: true,
            source: 'REAL_EXCHANGE_TRADES',
            exchange: exchange,
            count: trades.length,
            data: trades
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET REAL TRADING SIGNALS
 * Generates signals based on real market conditions
 */
router.get('/signals', async (req, res) => {
    try {
        const signals = await realDataService.getRealTradingSignals();

        res.json({
            success: true,
            source: 'REAL_MARKET_ANALYSIS',
            timestamp: Date.now(),
            count: signals.length,
            data: signals
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET PERFORMANCE METRICS
 * Calculates real performance from actual trades
 */
router.get('/performance/:strategyId', authenticate, async (req, res) => {
    try {
        const { strategyId } = req.params;
        const { startDate, endDate } = req.query;

        // Get real trades from database
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        const trades = await prisma.position.findMany({
            where: {
                session: {
                    strategyId: strategyId,
                    userId: req.user.id
                },
                status: 'closed',
                closedAt: {
                    gte: startDate ? new Date(startDate) : undefined,
                    lte: endDate ? new Date(endDate) : undefined
                }
            },
            orderBy: {
                closedAt: 'desc'
            }
        });

        const performance = await realDataService.calculateRealPerformance(trades);

        res.json({
            success: true,
            source: 'REAL_TRADE_HISTORY',
            strategyId: strategyId,
            period: {
                start: startDate || 'all',
                end: endDate || 'now'
            },
            data: performance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * VERIFY REAL CONNECTIONS
 * Checks all exchange connections are real and working
 */
router.get('/verify', async (req, res) => {
    try {
        const status = await realDataService.verifyRealConnections();

        res.json({
            success: true,
            message: 'All data sources are REAL exchanges',
            timestamp: Date.now(),
            exchanges: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET LATENCY TEST
 * Tests real latency to exchanges
 */
router.get('/latency', async (req, res) => {
    try {
        const tests = [];

        const exchanges = ['bybit', 'mexc', 'bitget', 'binance'];
        for (const exchange of exchanges) {
            const start = Date.now();
            try {
                await realDataService.getRealPrice('BTC/USDT', exchange);
                const latency = Date.now() - start;
                tests.push({
                    exchange: exchange,
                    latency: latency,
                    status: 'connected'
                });
            } catch (error) {
                tests.push({
                    exchange: exchange,
                    latency: -1,
                    status: 'error',
                    error: error.message
                });
            }
        }

        const avgLatency = tests
            .filter(t => t.latency > 0)
            .reduce((sum, t) => sum + t.latency, 0) / tests.filter(t => t.latency > 0).length;

        res.json({
            success: true,
            source: 'REAL_LATENCY_TEST',
            timestamp: Date.now(),
            averageLatency: Math.round(avgLatency),
            tests: tests
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * WebSocket endpoint for real-time updates
 * This would be used with socket.io for live price streaming
 */
router.get('/stream/info', (req, res) => {
    res.json({
        success: true,
        message: 'WebSocket streaming available at ws://automatedtradebot.com/realtime',
        channels: [
            'prices:XRP/USDT',
            'prices:SOL/USDT',
            'prices:BTC/USDT',
            'trades:*',
            'signals:live'
        ],
        info: 'All data is REAL from exchanges - NO DEMO/FAKE DATA'
    });
});

module.exports = router;

/**
 * API ENDPOINTS:
 *
 * GET /api/realtime/prices
 * GET /api/realtime/historical?symbol=XRP/USDT&timeframe=1h
 * GET /api/realtime/orderbook/BTC-USDT
 * GET /api/realtime/trades/ETH-USDT
 * GET /api/realtime/signals
 * GET /api/realtime/performance/{strategyId}
 * GET /api/realtime/verify
 * GET /api/realtime/latency
 * GET /api/realtime/stream/info
 *
 * TÜM VERİLER GERÇEK - NO FAKE DATA!
 */