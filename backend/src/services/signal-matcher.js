const { PrismaClient } = require('@prisma/client');
const PriceService = require('./price-service');

/**
 * SignalMatcher
 *
 * FIFO-based signal matching service
 * Matches EXIT signals with ENTRY signals to calculate P&L
 * Similar to the Python script logic provided by the user
 */
class SignalMatcher {
  constructor() {
    this.prisma = new PrismaClient();
    this.feePerTrade = 0.05; // 0.05% fee per trade
  }

  /**
   * Match an EXIT signal with open ENTRY signals using FIFO
   */
  async matchExitSignal(exitSignal) {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔄 MATCHING EXIT SIGNAL`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Symbol:    ${exitSignal.pair}`);
      console.log(`Direction: ${exitSignal.direction}`);
      console.log(`Price:     ${exitSignal.entry}`);
      console.log(`${'='.repeat(80)}\n`);

      // Find all open ENTRY signals for this symbol and direction
      // ORDER BY createdAt ASC for FIFO
      const openEntries = await this.prisma.signal.findMany({
        where: {
          symbol: exitSignal.pair,
          direction: exitSignal.direction,
          type: 'ENTRY',
          status: {
            in: ['PENDING', 'ACTIVE']
          }
        },
        orderBy: {
          createdAt: 'asc' // FIFO: oldest first
        }
      });

      if (openEntries.length === 0) {
        console.log(`⚠️  No open ENTRY signals found for ${exitSignal.pair} ${exitSignal.direction}`);
        return;
      }

      console.log(`📊 Found ${openEntries.length} open ENTRY signals`);

      // Calculate contracts/amount to close
      const exitAmount = exitSignal.contracts || 1.0;
      let remainingToClose = exitAmount;

      const matches = [];

      // FIFO matching
      for (const entrySignal of openEntries) {
        if (remainingToClose <= 0) break;

        const entryAmount = entrySignal.contracts || 1.0;
        const matchedAmount = Math.min(entryAmount, remainingToClose);

        // Calculate P&L
        const profitPercent = this.calculateProfitPercent(
          entrySignal.entryPrice,
          exitSignal.entry,
          exitSignal.direction
        );

        matches.push({
          entrySignal,
          exitSignal,
          matchedAmount,
          profitPercent
        });

        console.log(`  ✅ Matched: ${matchedAmount} contracts @ entry ${entrySignal.entryPrice} -> exit ${exitSignal.entry} | P&L: ${profitPercent.toFixed(2)}%`);

        // Update entry signal status
        if (matchedAmount >= entryAmount) {
          // Fully closed
          await this.prisma.signal.update({
            where: { id: entrySignal.id },
            data: {
              status: 'CLOSED',
              exitPrice: exitSignal.entry,
              profitLoss: profitPercent,
              closedAt: new Date()
            }
          });
        } else {
          // Partially closed - mark as CLOSED since we don't track partial amounts
          await this.prisma.signal.update({
            where: { id: entrySignal.id },
            data: {
              // Note: We don't have a contracts field in Signal model
              // So we'll mark it as CLOSED when ANY amount is closed
              status: 'CLOSED',
              exitPrice: exitSignal.entry,
              profitLoss: profitPercent,
              closedAt: new Date()
            }
          });
        }

        remainingToClose -= matchedAmount;
      }

      // Update EXIT signal
      await this.prisma.signal.update({
        where: { id: exitSignal.id },
        data: {
          status: 'EXECUTED'
        }
      });

      const totalProfitPercent = matches.reduce((sum, m) => sum + m.profitPercent, 0) / matches.length;

      console.log(`\n✅ EXIT signal matched with ${matches.length} ENTRY signals`);
      console.log(`📊 Average P&L: ${totalProfitPercent.toFixed(2)}%\n`);

      return matches;

    } catch (error) {
      console.error('❌ Signal matching error:', error);
      throw error;
    }
  }

  /**
   * Calculate profit percentage for a trade
   * Includes trading fees (0.05% * 2 = 0.1% total)
   */
  calculateProfitPercent(entryPrice, exitPrice, direction) {
    let profitPercent = 0;

    if (direction === 'LONG') {
      // LONG: profit when price goes up
      profitPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
    } else {
      // SHORT: profit when price goes down
      profitPercent = ((entryPrice - exitPrice) / entryPrice) * 100;
    }

    // Subtract fees (entry + exit = 2 * 0.05%)
    profitPercent -= (2 * this.feePerTrade);

    return profitPercent;
  }

  /**
   * Get all open positions with current PnL
   * This implements the Python script's logic for Open PnL calculation
   */
  async getOpenPositionsWithPnL() {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 CALCULATING OPEN PnL FOR ALL POSITIONS`);
      console.log(`${'='.repeat(80)}\n`);

      // Get all open ENTRY signals grouped by symbol and direction
      const openSignals = await this.prisma.signal.findMany({
        where: {
          type: 'ENTRY',
          status: {
            in: ['PENDING', 'ACTIVE']
          }
        },
        orderBy: [
          { symbol: 'asc' },
          { direction: 'asc' },
          { createdAt: 'asc' }
        ]
      });

      if (openSignals.length === 0) {
        console.log('✅ No open positions found');
        return [];
      }

      // Group by symbol + direction
      const groupedSignals = {};
      for (const signal of openSignals) {
        const key = `${signal.symbol}_${signal.direction}`;
        if (!groupedSignals[key]) {
          groupedSignals[key] = [];
        }
        groupedSignals[key].push(signal);
      }

      const results = [];

      // Calculate Open PnL for each group
      for (const [key, signals] of Object.entries(groupedSignals)) {
        const [symbol, direction] = key.split('_');

        console.log(`\n🔍 Processing: ${symbol} ${direction} (${signals.length} open positions)`);

        // Get current price
        const cleanSymbol = symbol.replace('.P', '');
        const currentPrice = await PriceService.getPrice(cleanSymbol);

        if (!currentPrice) {
          console.log(`  ❌ Could not get current price for ${symbol}`);
          continue;
        }

        // Calculate weighted average entry price and total PnL
        let totalAmount = 0;
        let totalCost = 0;

        for (const signal of signals) {
          const amount = signal.contracts || 1.0;
          totalAmount += amount;
          totalCost += signal.entryPrice * amount;

          console.log(`  📈 Entry: ${amount} @ $${signal.entryPrice}`);
        }

        const avgEntryPrice = totalCost / totalAmount;
        const openPnLPercent = this.calculateProfitPercent(avgEntryPrice, currentPrice, direction);

        console.log(`  💰 Weighted Avg Entry: $${avgEntryPrice.toFixed(4)}`);
        console.log(`  📊 Current Price: $${currentPrice}`);
        console.log(`  💸 Open PnL: ${openPnLPercent.toFixed(2)}%`);

        results.push({
          symbol,
          direction,
          openPositionCount: signals.length,
          totalAmount,
          avgEntryPrice,
          currentPrice,
          openPnLPercent,
          signals
        });
      }

      const totalOpenPnL = results.reduce((sum, r) => sum + r.openPnLPercent, 0);
      console.log(`\n💰 TOTAL OPEN PnL: ${totalOpenPnL.toFixed(2)}%\n`);

      return results;

    } catch (error) {
      console.error('❌ Open PnL calculation error:', error);
      throw error;
    }
  }

  /**
   * Get trading performance summary (closed + open positions)
   */
  async getPerformanceSummary() {
    try {
      // Closed positions (CLOSED status)
      const closedSignals = await this.prisma.signal.findMany({
        where: {
          type: 'ENTRY',
          status: 'CLOSED',
          profitLoss: { not: null }
        }
      });

      const closedPnL = closedSignals.reduce((sum, s) => sum + (s.profitLoss || 0), 0);
      const avgClosedPnL = closedSignals.length > 0 ? closedPnL / closedSignals.length : 0;

      // Open positions
      const openPositions = await this.getOpenPositionsWithPnL();
      const openPnL = openPositions.reduce((sum, p) => sum + p.openPnLPercent, 0);

      return {
        closedTrades: closedSignals.length,
        closedPnL: closedPnL.toFixed(2),
        avgClosedPnL: avgClosedPnL.toFixed(2),
        openPositions: openPositions.length,
        openPnL: openPnL.toFixed(2),
        totalPnL: (closedPnL + openPnL).toFixed(2)
      };

    } catch (error) {
      console.error('❌ Performance summary error:', error);
      throw error;
    }
  }

  /**
   * Close Prisma connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

// Singleton instance
const matcher = new SignalMatcher();

module.exports = matcher;
