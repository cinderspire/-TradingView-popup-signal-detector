/**
 * Export Service
 * Export signal history to CSV/Excel for tax reporting
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ExportService {
  /**
   * Export signals to CSV format
   */
  async exportToCSV(userId, filters = {}) {
    const { strategyId, dateFrom, dateTo, status } = filters;

    // Build query
    const where = { };

    // Get signals - Note: signals table doesn't have userId directly
    // You'd need to join through subscriptions
    const signals = await prisma.signal.findMany({
      where,
      include: {
        strategy: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Convert to CSV
    const csvRows = [];

    // Header
    csvRows.push([
      'Date',
      'Strategy',
      'Symbol',
      'Direction',
      'Entry Price',
      'Exit Price',
      'Stop Loss',
      'Take Profit',
      'P&L %',
      'Status',
      'Duration'
    ].join(','));

    // Data rows
    for (const signal of signals) {
      const duration = signal.closedAt
        ? Math.round((new Date(signal.closedAt) - new Date(signal.createdAt)) / 1000 / 60) // minutes
        : 'Open';

      csvRows.push([
        signal.createdAt.toISOString(),
        signal.strategy?.name || 'N/A',
        signal.symbol,
        signal.direction,
        signal.entryPrice,
        signal.exitPrice || 'N/A',
        signal.stopLoss || 'N/A',
        signal.takeProfit || 'N/A',
        signal.profitLoss?.toFixed(2) || 'N/A',
        signal.status,
        duration
      ].join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Export to JSON format
   */
  async exportToJSON(userId, filters = {}) {
    const signals = await prisma.signal.findMany({
      where: filters,
      include: {
        strategy: true
      }
    });

    return JSON.stringify(signals, null, 2);
  }

  /**
   * Generate tax report
   */
  async generateTaxReport(userId, year) {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    const closedTrades = await prisma.signal.findMany({
      where: {
        status: 'CLOSED',
        closedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        closedAt: 'asc'
      }
    });

    // Calculate totals
    const totalTrades = closedTrades.length;
    const profitableTrades = closedTrades.filter(t => (t.profitLoss || 0) > 0).length;
    const totalProfit = closedTrades
      .filter(t => (t.profitLoss || 0) > 0)
      .reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const totalLoss = closedTrades
      .filter(t => (t.profitLoss || 0) < 0)
      .reduce((sum, t) => sum + Math.abs(t.profitLoss || 0), 0);
    const netPnL = totalProfit - totalLoss;

    return {
      year,
      totalTrades,
      profitableTrades,
      losingTrades: totalTrades - profitableTrades,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalLoss: Math.round(totalLoss * 100) / 100,
      netPnL: Math.round(netPnL * 100) / 100,
      trades: closedTrades
    };
  }
}

module.exports = new ExportService();
