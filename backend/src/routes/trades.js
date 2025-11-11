/**
 * COMPLETED TRADES ROUTES
 * API endpoints for trade history and analytics
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Path to completed trades data
const TRADES_FILE = path.join(__dirname, '../../data/signals/completed_trades.json');

/**
 * GET /api/trades/completed
 * Returns all completed trades with optional filters
 */
router.get('/completed', async (req, res) => {
    try {
        const { strategy, pair, minPnl, maxPnl, startDate, endDate, limit, offset } = req.query;

        // Load completed trades
        let trades = [];
        try {
            const data = await fs.readFile(TRADES_FILE, 'utf-8');
            trades = JSON.parse(data);
        } catch (err) {
            return res.json({
                success: true,
                trades: [],
                total: 0,
                message: 'No completed trades yet'
            });
        }

        // Apply filters
        let filtered = trades;

        if (strategy) {
            filtered = filtered.filter(t => t.strategy === strategy);
        }

        if (pair) {
            filtered = filtered.filter(t => t.pair === pair);
        }

        if (minPnl !== undefined) {
            filtered = filtered.filter(t => t.pnlPercent >= parseFloat(minPnl));
        }

        if (maxPnl !== undefined) {
            filtered = filtered.filter(t => t.pnlPercent <= parseFloat(maxPnl));
        }

        if (startDate) {
            const start = new Date(startDate).getTime();
            filtered = filtered.filter(t => new Date(t.exitTime).getTime() >= start);
        }

        if (endDate) {
            const end = new Date(endDate).getTime();
            filtered = filtered.filter(t => new Date(t.exitTime).getTime() <= end);
        }

        // Sort by exit time (newest first)
        filtered.sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime));

        // Pagination
        const totalFiltered = filtered.length;
        const offsetNum = parseInt(offset) || 0;
        const limitNum = parseInt(limit) || 100;
        const paginated = filtered.slice(offsetNum, offsetNum + limitNum);

        res.json({
            success: true,
            trades: paginated,
            total: totalFiltered,
            offset: offsetNum,
            limit: limitNum
        });
    } catch (error) {
        console.error('❌ Error fetching completed trades:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/trades/statistics
 * Returns aggregate statistics for completed trades
 */
router.get('/statistics', async (req, res) => {
    try {
        const { strategy, pair, startDate, endDate } = req.query;

        // Load completed trades
        let trades = [];
        try {
            const data = await fs.readFile(TRADES_FILE, 'utf-8');
            trades = JSON.parse(data);
        } catch (err) {
            return res.json({
                success: true,
                stats: null,
                message: 'No completed trades yet'
            });
        }

        // Apply filters
        let filtered = trades;

        if (strategy) {
            filtered = filtered.filter(t => t.strategy === strategy);
        }

        if (pair) {
            filtered = filtered.filter(t => t.pair === pair);
        }

        if (startDate) {
            const start = new Date(startDate).getTime();
            filtered = filtered.filter(t => new Date(t.exitTime).getTime() >= start);
        }

        if (endDate) {
            const end = new Date(endDate).getTime();
            filtered = filtered.filter(t => new Date(t.exitTime).getTime() <= end);
        }

        // Calculate statistics
        const totalTrades = filtered.length;
        const winningTrades = filtered.filter(t => t.pnlPercent > 0);
        const losingTrades = filtered.filter(t => t.pnlPercent <= 0);

        const totalPnL = filtered.reduce((sum, t) => sum + t.pnlPercent, 0);
        const avgPnL = totalTrades > 0 ? totalPnL / totalTrades : 0;

        const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

        const avgWin = winningTrades.length > 0
            ? winningTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / winningTrades.length
            : 0;

        const avgLoss = losingTrades.length > 0
            ? losingTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / losingTrades.length
            : 0;

        const bestTrade = totalTrades > 0
            ? Math.max(...filtered.map(t => t.pnlPercent))
            : 0;

        const worstTrade = totalTrades > 0
            ? Math.min(...filtered.map(t => t.pnlPercent))
            : 0;

        // Profit factor
        const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnlPercent, 0);
        const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnlPercent, 0));
        const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;

        // Build equity curve
        const sortedTrades = [...filtered].sort((a, b) =>
            new Date(a.exitTime) - new Date(b.exitTime)
        );

        const equityCurve = [];
        let cumulative = 0;
        sortedTrades.forEach(trade => {
            cumulative += trade.pnlPercent;
            equityCurve.push({
                timestamp: trade.exitTime,
                equity: cumulative,
                trade: trade.id
            });
        });

        // Monthly breakdown
        const monthlyStats = {};
        filtered.forEach(trade => {
            const date = new Date(trade.exitTime);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = {
                    trades: 0,
                    wins: 0,
                    losses: 0,
                    totalPnL: 0
                };
            }

            monthlyStats[monthKey].trades++;
            monthlyStats[monthKey].totalPnL += trade.pnlPercent;
            if (trade.pnlPercent > 0) {
                monthlyStats[monthKey].wins++;
            } else {
                monthlyStats[monthKey].losses++;
            }
        });

        res.json({
            success: true,
            stats: {
                totalTrades,
                winningTrades: winningTrades.length,
                losingTrades: losingTrades.length,
                winRate: winRate.toFixed(2),
                totalPnL: totalPnL.toFixed(2),
                avgPnL: avgPnL.toFixed(2),
                avgWin: avgWin.toFixed(2),
                avgLoss: avgLoss.toFixed(2),
                bestTrade: bestTrade.toFixed(2),
                worstTrade: worstTrade.toFixed(2),
                profitFactor: profitFactor.toFixed(2),
                equityCurve,
                monthlyStats
            }
        });
    } catch (error) {
        console.error('❌ Error calculating statistics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/trades/strategies
 * Returns list of unique strategies with trade counts
 */
router.get('/strategies', async (req, res) => {
    try {
        let trades = [];
        try {
            const data = await fs.readFile(TRADES_FILE, 'utf-8');
            trades = JSON.parse(data);
        } catch (err) {
            return res.json({
                success: true,
                strategies: []
            });
        }

        const strategiesMap = {};
        trades.forEach(trade => {
            if (!strategiesMap[trade.strategy]) {
                strategiesMap[trade.strategy] = {
                    name: trade.strategy,
                    totalTrades: 0,
                    wins: 0,
                    losses: 0,
                    totalPnL: 0
                };
            }

            const stats = strategiesMap[trade.strategy];
            stats.totalTrades++;
            stats.totalPnL += trade.pnlPercent;
            if (trade.pnlPercent > 0) {
                stats.wins++;
            } else {
                stats.losses++;
            }
        });

        const strategies = Object.values(strategiesMap).map(s => ({
            ...s,
            winRate: ((s.wins / s.totalTrades) * 100).toFixed(2),
            avgPnL: (s.totalPnL / s.totalTrades).toFixed(2)
        }));

        strategies.sort((a, b) => b.totalPnL - a.totalPnL);

        res.json({
            success: true,
            strategies
        });
    } catch (error) {
        console.error('❌ Error fetching strategies:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
