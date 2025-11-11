#!/usr/bin/env node
/**
 * Performance Analysis Script
 *
 * Analyzes closed trades to calculate:
 * - Average ROI per pair
 * - Win rate per pair
 * - Best/worst performers
 * - Recommended TP/SL levels based on historical data
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzePerformance() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PERFORMANCE ANALYSIS - CLOSED TRADES');
    console.log('='.repeat(80) + '\n');

    // Get all closed trades with P&L data
    const closedTrades = await prisma.signal.findMany({
      where: {
        type: 'ENTRY',
        status: 'CLOSED',
        profitLoss: { not: null },
        closedAt: { not: null }
      },
      select: {
        id: true,
        symbol: true,
        direction: true,
        entryPrice: true,
        exitPrice: true,
        profitLoss: true,
        createdAt: true,
        closedAt: true,
        rawText: true
      },
      orderBy: { closedAt: 'desc' }
    });

    console.log(`Total closed trades: ${closedTrades.length}\n`);

    if (closedTrades.length === 0) {
      console.log('⚠️  No closed trades found');
      await prisma.$disconnect();
      return;
    }

    // Extract strategy from rawText
    const tradesWithStrategy = closedTrades.map(trade => {
      let strategy = 'UNKNOWN';
      if (trade.rawText) {
        const beforeBrace = trade.rawText.split('{')[0];
        const cleaned = beforeBrace
          .replace(/^Alert on /i, '')
          .replace(new RegExp(trade.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
          .replace(/[^A-Za-z0-9]/g, '')
          .trim();
        strategy = cleaned || 'UNKNOWN';
      }
      return { ...trade, strategy };
    });

    // Group by symbol
    const bySymbol = {};
    tradesWithStrategy.forEach(trade => {
      if (!bySymbol[trade.symbol]) {
        bySymbol[trade.symbol] = [];
      }
      bySymbol[trade.symbol].push(trade);
    });

    // Calculate statistics per symbol
    const symbolStats = [];

    for (const [symbol, trades] of Object.entries(bySymbol)) {
      const profitableTrades = trades.filter(t => t.profitLoss > 0);
      const losingTrades = trades.filter(t => t.profitLoss <= 0);

      const totalPnL = trades.reduce((sum, t) => sum + t.profitLoss, 0);
      const avgPnL = totalPnL / trades.length;
      const winRate = (profitableTrades.length / trades.length) * 100;

      const avgWin = profitableTrades.length > 0
        ? profitableTrades.reduce((sum, t) => sum + t.profitLoss, 0) / profitableTrades.length
        : 0;

      const avgLoss = losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + t.profitLoss, 0) / losingTrades.length
        : 0;

      // Calculate max profit and max loss for TP/SL recommendations
      const maxProfit = Math.max(...trades.map(t => t.profitLoss));
      const maxLoss = Math.min(...trades.map(t => t.profitLoss));

      // Recommended TP: 75th percentile of winning trades
      const profitableReturns = profitableTrades.map(t => t.profitLoss).sort((a, b) => a - b);
      const p75Index = Math.floor(profitableReturns.length * 0.75);
      const recommendedTP = profitableReturns.length > 0 ? profitableReturns[p75Index] || avgWin : avgWin;

      // Recommended SL: 75th percentile of losing trades (in absolute terms)
      const losingReturns = losingTrades.map(t => Math.abs(t.profitLoss)).sort((a, b) => a - b);
      const p75LossIndex = Math.floor(losingReturns.length * 0.75);
      const recommendedSL = losingReturns.length > 0 ? -Math.abs(losingReturns[p75LossIndex] || avgLoss) : avgLoss;

      // Calculate holding time (hours)
      const avgHoldingTime = trades.reduce((sum, t) => {
        const holdTime = (new Date(t.closedAt) - new Date(t.createdAt)) / (1000 * 60 * 60);
        return sum + holdTime;
      }, 0) / trades.length;

      symbolStats.push({
        symbol,
        totalTrades: trades.length,
        profitableTrades: profitableTrades.length,
        losingTrades: losingTrades.length,
        winRate,
        totalPnL,
        avgPnL,
        avgWin,
        avgLoss,
        maxProfit,
        maxLoss,
        recommendedTP,
        recommendedSL,
        avgHoldingTime
      });
    }

    // Sort by total P&L (best performers first)
    symbolStats.sort((a, b) => b.totalPnL - a.totalPnL);

    // Display results
    console.log('━'.repeat(80));
    console.log('TOP PERFORMERS (by Total P&L)');
    console.log('━'.repeat(80) + '\n');

    symbolStats.slice(0, 20).forEach((stats, index) => {
      const emoji = stats.totalPnL > 0 ? '✅' : '❌';
      console.log(`${index + 1}. ${emoji} ${stats.symbol}`);
      console.log(`   Trades: ${stats.totalTrades} (${stats.profitableTrades}W / ${stats.losingTrades}L)`);
      console.log(`   Win Rate: ${stats.winRate.toFixed(1)}%`);
      console.log(`   Total P&L: ${stats.totalPnL.toFixed(2)}%`);
      console.log(`   Avg P&L: ${stats.avgPnL.toFixed(2)}% (Win: ${stats.avgWin.toFixed(2)}% / Loss: ${stats.avgLoss.toFixed(2)}%)`);
      console.log(`   Max Profit: ${stats.maxProfit.toFixed(2)}% | Max Loss: ${stats.maxLoss.toFixed(2)}%`);
      console.log(`   💡 Recommended TP: ${stats.recommendedTP.toFixed(2)}% | SL: ${stats.recommendedSL.toFixed(2)}%`);
      console.log(`   ⏱️  Avg Holding: ${stats.avgHoldingTime.toFixed(1)} hours\n`);
    });

    // Overall statistics
    console.log('━'.repeat(80));
    console.log('OVERALL STATISTICS');
    console.log('━'.repeat(80) + '\n');

    const totalProfitable = symbolStats.reduce((sum, s) => sum + s.profitableTrades, 0);
    const totalLosing = symbolStats.reduce((sum, s) => sum + s.losingTrades, 0);
    const totalTrades = totalProfitable + totalLosing;
    const overallWinRate = (totalProfitable / totalTrades) * 100;
    const overallPnL = symbolStats.reduce((sum, s) => sum + s.totalPnL, 0);
    const overallAvgPnL = symbolStats.reduce((sum, s) => sum + s.avgPnL, 0) / symbolStats.length;
    const overallAvgWin = symbolStats.reduce((sum, s) => sum + (s.avgWin * s.profitableTrades), 0) / totalProfitable;
    const overallAvgLoss = symbolStats.reduce((sum, s) => sum + (s.avgLoss * s.losingTrades), 0) / totalLosing;

    console.log(`Total Trades: ${totalTrades}`);
    console.log(`Profitable: ${totalProfitable} (${overallWinRate.toFixed(1)}%)`);
    console.log(`Losing: ${totalLosing} (${(100 - overallWinRate).toFixed(1)}%)`);
    console.log(`\nTotal P&L: ${overallPnL.toFixed(2)}%`);
    console.log(`Average P&L per trade: ${overallAvgPnL.toFixed(2)}%`);
    console.log(`Average Win: ${overallAvgWin.toFixed(2)}%`);
    console.log(`Average Loss: ${overallAvgLoss.toFixed(2)}%`);
    console.log(`Profit Factor: ${(Math.abs(overallAvgWin / overallAvgLoss)).toFixed(2)}x\n`);

    // Group by strategy
    console.log('━'.repeat(80));
    console.log('STRATEGY PERFORMANCE');
    console.log('━'.repeat(80) + '\n');

    const byStrategy = {};
    tradesWithStrategy.forEach(trade => {
      if (!byStrategy[trade.strategy]) {
        byStrategy[trade.strategy] = [];
      }
      byStrategy[trade.strategy].push(trade);
    });

    const strategyStats = [];
    for (const [strategy, trades] of Object.entries(byStrategy)) {
      const profitableTrades = trades.filter(t => t.profitLoss > 0);
      const totalPnL = trades.reduce((sum, t) => sum + t.profitLoss, 0);
      const avgPnL = totalPnL / trades.length;
      const winRate = (profitableTrades.length / trades.length) * 100;

      strategyStats.push({
        strategy,
        totalTrades: trades.length,
        profitableTrades: profitableTrades.length,
        winRate,
        totalPnL,
        avgPnL
      });
    }

    strategyStats.sort((a, b) => b.totalPnL - a.totalPnL);

    strategyStats.forEach((stats, index) => {
      const emoji = stats.totalPnL > 0 ? '✅' : '❌';
      console.log(`${index + 1}. ${emoji} ${stats.strategy}`);
      console.log(`   Trades: ${stats.totalTrades} | Win Rate: ${stats.winRate.toFixed(1)}%`);
      console.log(`   Total P&L: ${stats.totalPnL.toFixed(2)}% | Avg: ${stats.avgPnL.toFixed(2)}%\n`);
    });

    // Recommendations
    console.log('━'.repeat(80));
    console.log('💡 ADAPTIVE TP/SL RECOMMENDATIONS');
    console.log('━'.repeat(80) + '\n');

    console.log('Based on historical data, recommended settings:\n');

    // Conservative (high win rate)
    const conservativeTP = overallAvgWin * 0.75;
    const conservativeSL = overallAvgLoss * 1.5;
    console.log('📘 CONSERVATIVE (High Win Rate ~70-75%):');
    console.log(`   Take Profit: ${conservativeTP.toFixed(2)}%`);
    console.log(`   Stop Loss: ${conservativeSL.toFixed(2)}%`);
    console.log(`   Risk:Reward = 1:${(conservativeTP / Math.abs(conservativeSL)).toFixed(2)}\n`);

    // Balanced (optimal risk:reward)
    const balancedTP = overallAvgWin;
    const balancedSL = overallAvgLoss;
    console.log('📗 BALANCED (Optimal Risk:Reward):');
    console.log(`   Take Profit: ${balancedTP.toFixed(2)}%`);
    console.log(`   Stop Loss: ${balancedSL.toFixed(2)}%`);
    console.log(`   Risk:Reward = 1:${(balancedTP / Math.abs(balancedSL)).toFixed(2)}\n`);

    // Aggressive (maximize profits)
    const aggressiveTP = overallAvgWin * 1.5;
    const aggressiveSL = overallAvgLoss * 0.75;
    console.log('📕 AGGRESSIVE (Maximize Profits):');
    console.log(`   Take Profit: ${aggressiveTP.toFixed(2)}%`);
    console.log(`   Stop Loss: ${aggressiveSL.toFixed(2)}%`);
    console.log(`   Risk:Reward = 1:${(aggressiveTP / Math.abs(aggressiveSL)).toFixed(2)}\n`);

    console.log('━'.repeat(80) + '\n');

    // Save to JSON for later use
    const report = {
      generatedAt: new Date().toISOString(),
      overall: {
        totalTrades,
        profitableTrades: totalProfitable,
        losingTrades: totalLosing,
        winRate: overallWinRate,
        totalPnL: overallPnL,
        avgPnL: overallAvgPnL,
        avgWin: overallAvgWin,
        avgLoss: overallAvgLoss,
        profitFactor: Math.abs(overallAvgWin / overallAvgLoss)
      },
      bySymbol: symbolStats,
      byStrategy: strategyStats,
      recommendations: {
        conservative: { tp: conservativeTP, sl: conservativeSL },
        balanced: { tp: balancedTP, sl: balancedSL },
        aggressive: { tp: aggressiveTP, sl: aggressiveSL }
      }
    };

    const fs = require('fs');
    fs.writeFileSync(
      '/tmp/performance-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('✅ Report saved to /tmp/performance-report.json\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

analyzePerformance();
