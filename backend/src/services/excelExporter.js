// Excel Exporter - Export batch backtest results to XLSX

import ExcelJS from 'exceljs';
import path from 'path';
import settings from '../config/settings.js';
import { Helpers } from '../utils/helpers.js';

export class ExcelExporter {
  /**
   * Export batch backtest results to Excel
   */
  static async exportBatchResults(results, filename = null) {
    const workbook = new ExcelJS.Workbook();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    this.createSummarySheet(summarySheet, results);

    // Detailed results sheet
    const detailsSheet = workbook.addWorksheet('Detailed Results');
    this.createDetailsSheet(detailsSheet, results);

    // Trades sheet (all trades from all pairs)
    const tradesSheet = workbook.addWorksheet('All Trades');
    this.createTradesSheet(tradesSheet, results);

    // Save file
    const fileName = filename || `backtest_${Date.now()}.xlsx`;
    const filePath = path.join(settings.dataPath, 'exports', fileName);

    await Helpers.ensureDir(path.dirname(filePath));
    await workbook.xlsx.writeFile(filePath);

    console.log(`📊 Excel exported: ${filePath}`);

    return filePath;
  }

  /**
   * Create summary sheet with sorted results
   */
  static createSummarySheet(sheet, results) {
    // Headers
    sheet.columns = [
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'Pair', key: 'pair', width: 15 },
      { header: 'Strategy', key: 'strategy', width: 20 },
      { header: 'Timeframe', key: 'timeframe', width: 12 },
      { header: 'Total Trades', key: 'totalTrades', width: 15 },
      { header: 'Win Rate %', key: 'winRate', width: 12 },
      { header: 'ROI %', key: 'roi', width: 12 },
      { header: 'Net Profit', key: 'netProfit', width: 15 },
      { header: 'Profit Factor', key: 'profitFactor', width: 15 },
      { header: 'Sharpe Ratio', key: 'sharpe', width: 15 },
      { header: 'Sortino Ratio', key: 'sortino', width: 15 },
      { header: 'Max DD %', key: 'maxDrawdown', width: 12 },
      { header: 'Avg Holding', key: 'avgHolding', width: 15 },
      { header: 'Score', key: 'score', width: 10 }
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Sort by ROI
    const sorted = results
      .filter(r => r.metrics)
      .sort((a, b) => (b.metrics.roi || 0) - (a.metrics.roi || 0));

    // Add data rows
    sorted.forEach((result, index) => {
      const m = result.metrics;

      const row = sheet.addRow({
        rank: index + 1,
        pair: result.pair,
        strategy: result.strategy,
        timeframe: result.timeframe,
        totalTrades: m.totalTrades,
        winRate: m.winRate,
        roi: m.roi,
        netProfit: m.netProfit,
        profitFactor: m.profitFactor,
        sharpe: m.sharpeRatio,
        sortino: m.sortinoRatio,
        maxDrawdown: m.maxDrawdown,
        avgHolding: m.avgHoldingTime,
        score: m.strategyScore
      });

      // Color code ROI
      if (m.roi > 0) {
        row.getCell('roi').font = { color: { argb: 'FF00B050' } };
      } else {
        row.getCell('roi').font = { color: { argb: 'FFFF0000' } };
      }

      // Color code score
      const scoreCell = row.getCell('score');
      if (m.strategyScore >= 70) {
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B050' } };
      } else if (m.strategyScore >= 50) {
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      } else {
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      }
    });
  }

  /**
   * Create detailed results sheet
   */
  static createDetailsSheet(sheet, results) {
    sheet.columns = [
      { header: 'Pair', key: 'pair', width: 15 },
      { header: 'Strategy', key: 'strategy', width: 20 },
      { header: 'Total Trades', key: 'totalTrades', width: 15 },
      { header: 'Winning Trades', key: 'winningTrades', width: 15 },
      { header: 'Losing Trades', key: 'losingTrades', width: 15 },
      { header: 'Win Rate %', key: 'winRate', width: 12 },
      { header: 'Total Profit', key: 'totalProfit', width: 15 },
      { header: 'Total Loss', key: 'totalLoss', width: 15 },
      { header: 'Net Profit', key: 'netProfit', width: 15 },
      { header: 'ROI %', key: 'roi', width: 12 },
      { header: 'Avg Win', key: 'avgWin', width: 12 },
      { header: 'Avg Loss', key: 'avgLoss', width: 12 },
      { header: 'Profit Factor', key: 'profitFactor', width: 15 },
      { header: 'Sharpe', key: 'sharpe', width: 12 },
      { header: 'Sortino', key: 'sortino', width: 12 },
      { header: 'Max DD %', key: 'maxDrawdown', width: 12 }
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' }
    };
    sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data
    results.filter(r => r.metrics).forEach(result => {
      const m = result.metrics;
      sheet.addRow({
        pair: result.pair,
        strategy: result.strategy,
        totalTrades: m.totalTrades,
        winningTrades: m.winningTrades,
        losingTrades: m.losingTrades,
        winRate: m.winRate,
        totalProfit: m.totalProfit,
        totalLoss: m.totalLoss,
        netProfit: m.netProfit,
        roi: m.roi,
        avgWin: m.avgWin,
        avgLoss: m.avgLoss,
        profitFactor: m.profitFactor,
        sharpe: m.sharpeRatio,
        sortino: m.sortinoRatio,
        maxDrawdown: m.maxDrawdown
      });
    });
  }

  /**
   * Create all trades sheet
   */
  static createTradesSheet(sheet, results) {
    sheet.columns = [
      { header: 'Pair', key: 'pair', width: 15 },
      { header: 'Strategy', key: 'strategy', width: 20 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Entry Time', key: 'entryTime', width: 20 },
      { header: 'Exit Time', key: 'exitTime', width: 20 },
      { header: 'Entry Price', key: 'entryPrice', width: 15 },
      { header: 'Exit Price', key: 'exitPrice', width: 15 },
      { header: 'Size', key: 'size', width: 15 },
      { header: 'PnL', key: 'pnl', width: 15 },
      { header: 'PnL %', key: 'pnlPercent', width: 12 },
      { header: 'Holding Time', key: 'holdingTime', width: 15 },
      { header: 'Entry Reason', key: 'entryReason', width: 30 },
      { header: 'Exit Reason', key: 'exitReason', width: 30 }
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC000' }
    };
    sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add all trades
    results.forEach(result => {
      if (!result.trades) return;

      result.trades.forEach(trade => {
        const row = sheet.addRow({
          pair: result.pair,
          strategy: result.strategy,
          type: trade.type,
          entryTime: new Date(trade.entryTime).toISOString(),
          exitTime: new Date(trade.exitTime).toISOString(),
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          size: trade.size,
          pnl: trade.pnl,
          pnlPercent: trade.pnlPercent,
          holdingTime: this.formatHoldingTime(trade.holdingTime),
          entryReason: trade.entryReason,
          exitReason: trade.exitReason
        });

        // Color code PnL
        if (trade.pnl > 0) {
          row.getCell('pnl').font = { color: { argb: 'FF00B050' } };
          row.getCell('pnlPercent').font = { color: { argb: 'FF00B050' } };
        } else {
          row.getCell('pnl').font = { color: { argb: 'FFFF0000' } };
          row.getCell('pnlPercent').font = { color: { argb: 'FFFF0000' } };
        }
      });
    });
  }

  /**
   * Format holding time
   */
  static formatHoldingTime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
}

export default ExcelExporter;
