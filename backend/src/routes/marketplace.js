const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateOptional } = require('../middleware/auth');
const logger = require('../utils/logger');
const marketplaceCache = require('../cache/marketplace-cache');
const PriceService = require('../services/price-service');

const prisma = new PrismaClient();

/**
 * @route   GET /api/marketplace/strategies
 * @desc    Get ALL strategies with optimized metrics (NO PAGINATION LIMIT for marketplace)
 * @access  Public
 */
router.get('/strategies', authenticateOptional, async (req, res, next) => {
  try {
    // Check cache first
    const cachedData = marketplaceCache.get();
    if (cachedData && !req.query.refresh) {
      console.log('⚡ Serving from cache');
      return res.json({
        success: true,
        message: 'Marketplace strategies retrieved from cache',
        data: cachedData.data,
        performance: {
          ...cachedData.performance,
          cached: true,
          cacheAge: Math.floor((Date.now() - marketplaceCache.lastUpdate) / 1000) + 's'
        }
      });
    }

    console.log('📊 Fetching ALL marketplace strategies (optimized)...');
    const startTime = Date.now();

    const {
      search,
      tradingPair,
      minWinRate,
      maxPrice,
      sortBy = 'totalROI', // Default: sort by performance (ROI)
      sortOrder = 'desc',  // Default: best performers first
      limit = 1000, // Very high limit for marketplace - show all
      offset = 0
    } = req.query;

    // Build filter - SHOW ALL STRATEGIES (no restrictions)
    const where = {};

    // Optional: Only filter if explicitly requested
    // if (req.query.onlyPublic === 'true') {
    //   where.isPublic = true;
    // }
    // if (req.query.onlyActive === 'true') {
    //   where.isActive = true;
    // }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (tradingPair) {
      where.supportedPairs = { has: tradingPair };
    }

    // Get all ACTIVE and PUBLIC strategies from database
    const dbStrategies = await prisma.strategy.findMany({
      where: {
        ...where,
        isActive: true,
        isPublic: true
      },
      include: {
        provider: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        _count: {
          select: {
            subscriptions: true,
            signals: true
          }
        }
      }
    });

    console.log(`📊 Found ${dbStrategies.length} strategies in database`);

    // Get ALL TradingView signals to extract unique strategy names
    // NO TIME LIMIT - scan all historical signals
    console.log('📊 Extracting unique strategy names from ALL TradingView signals (no time limit)...');

    // Use aggregation with DISTINCT to get unique strategy names efficiently
    const uniqueStrategyNames = new Set();

    // Batch process signals to avoid memory issues
    const batchSize = 10000;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await prisma.signal.findMany({
        where: {
          source: 'tradingview',
          rawText: {
            not: null
          }
        },
        select: {
          rawText: true
        },
        skip,
        take: batchSize,
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      // Extract strategy names from this batch
      for (const signal of batch) {
        if (signal.rawText) {
          let strategyName = null;

          // Pattern 1: "Alert on SYMBOL.PSTRATEGY" format
          let match = signal.rawText.match(/Alert on [A-Z0-9]+\.P([A-Za-z0-9 ]+)/);
          if (match) {
            strategyName = match[1].trim();
          } else {
            // Pattern 2: Regular "STRATEGY{" format (with spaces and mixed case)
            match = signal.rawText.match(/^([A-Za-z0-9 ]+?)[\{:]/);
            if (match) {
              strategyName = match[1].trim();
            }
          }

          if (strategyName && strategyName.length > 0 && strategyName.length < 50) {
            uniqueStrategyNames.add(strategyName);
          }
        }
      }

      skip += batchSize;
      console.log(`  Processed ${skip} signals, found ${uniqueStrategyNames.size} unique strategies...`);

      // Stop if we've found a lot of strategies (to prevent infinite loop)
      if (uniqueStrategyNames.size > 500 || skip > 100000) {
        console.log(`  Stopping at ${skip} signals to prevent memory issues`);
        break;
      }
    }

    console.log(`✅ Found ${uniqueStrategyNames.size} unique TradingView strategy names from ${skip} signals`);

    // Create virtual strategies for TradingView signals that don't have a database strategy
    const virtualStrategies = [];
    for (const strategyName of uniqueStrategyNames) {
      // Check if this strategy already exists in database
      const existsInDb = dbStrategies.some(s => s.name === strategyName);

      if (!existsInDb) {
        // Create virtual strategy
        virtualStrategies.push({
          id: `virtual-${strategyName}`,
          name: strategyName,
          description: `Auto-detected TradingView strategy: ${strategyName}`,
          category: 'TECHNICAL',
          type: 'CUSTOM',
          providerId: 'tradingview-provider',
          provider: {
            id: 'tradingview-provider',
            username: 'TradingView Signals',
            avatar: null
          },
          isPublic: true,
          isActive: true,
          supportedPairs: [],
          supportedTimeframes: [],
          monthlyPrice: 0,
          rating: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            subscriptions: 0,
            signals: 0
          }
        });
      }
    }

    console.log(`✅ Created ${virtualStrategies.length} virtual strategies`);

    // Combine database strategies + virtual strategies
    const strategies = [...dbStrategies, ...virtualStrategies];
    console.log(`✅ Total strategies: ${strategies.length} (${dbStrategies.length} DB + ${virtualStrategies.length} virtual)`);

    // Get ALL signals for metrics calculation (NO TIME FILTER)
    // This ensures we show complete historical performance
    console.log('📊 Fetching ALL signals for metrics (no time filter)...');

    const allSignals = await prisma.signal.findMany({
      where: {
        source: 'tradingview' // Only filter by source
      },
      select: {
        id: true,
        strategyId: true,
        source: true,
        rawText: true,
        type: true,
        status: true,
        profitLoss: true,
        direction: true,
        symbol: true,
        entryPrice: true,
        exitPrice: true,
        createdAt: true,
        closedAt: true
      },
      take: 50000 // Maximum 50k signals to prevent memory issues
    });

    console.log(`✅ Fetched ${allSignals.length} total signals`);

    // Group signals by strategy (by name extracted from rawText or strategyId)
    const signalsByStrategy = {};

    for (const signal of allSignals) {
      let strategyKey = null;

      if (signal.strategyId) {
        // Has strategyId - direct mapping
        strategyKey = signal.strategyId;
      } else if (signal.rawText) {
        // Extract strategy name from rawText (supports multiple formats)
        let strategyName = null;

        // Pattern 1: "Alert on SYMBOL.PSTRATEGY" format
        let match = signal.rawText.match(/Alert on [A-Z0-9]+\.P([A-Za-z0-9 ]+)/);
        if (match) {
          strategyName = match[1].trim();
        } else {
          // Pattern 2: Regular "STRATEGY{" format (with spaces and mixed case)
          match = signal.rawText.match(/^([A-Za-z0-9 ]+?)[\{:]/);
          if (match) {
            strategyName = match[1].trim();
          }
        }

        if (strategyName) {
          // Find strategy by name
          const matchingStrategy = strategies.find(s => s.name === strategyName);
          if (matchingStrategy) {
            strategyKey = matchingStrategy.id;
          }
        }
      }

      if (strategyKey) {
        if (!signalsByStrategy[strategyKey]) {
          signalsByStrategy[strategyKey] = [];
        }
        signalsByStrategy[strategyKey].push(signal);
      }
    }

    console.log(`📊 Grouped signals into ${Object.keys(signalsByStrategy).length} strategies`);

    // Calculate metrics for each strategy
    console.log('📊 Calculating metrics for each strategy...');
    const strategiesWithMetrics = await Promise.all(strategies.map(async (strategy) => {
      const signals = signalsByStrategy[strategy.id] || [];

      // Separate ENTRY and EXIT signals
      const entrySignals = signals.filter(s => s.type === 'ENTRY');
      const exitSignals = signals.filter(s => s.type === 'EXIT');

      // Active signals (open positions)
      const activeSignals = entrySignals.filter(s =>
        s.status === 'ACTIVE' || s.status === 'PENDING'
      ).length;

      // Closed trades (with profitLoss)
      // NOTE: Now using CLOSED status (added to enum) and closedAt timestamp
      const closedTrades = entrySignals.filter(s =>
        (s.status === 'CLOSED' || (s.closedAt !== null && s.profitLoss !== null))
      );

      const closedTradesCount = closedTrades.length;

      // Calculate Win Rate (will be recalculated after filtering negative pairs)
      const winningTrades = closedTrades.filter(t => t.profitLoss > 0).length;
      let winRate = closedTradesCount > 0
        ? (winningTrades / closedTradesCount) * 100
        : 0;

      // Calculate Closed ROI (sum of all closed trades) (will be recalculated after filtering)
      let closedROI = closedTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);

      // Calculate Open PnL for active positions
      // DISABLED for performance - with 5000+ open positions this takes too long
      // Open PnL will be calculated separately on-demand or via background job
      let openPnL = 0;

      // NOTE: Previously fetched prices for each active position
      // This caused marketplace API to timeout (5000+ requests)
      // TODO: Implement batch price fetching or separate endpoint

      // Calculate Total ROI (closed + open) (will be recalculated after filtering)
      let totalROI = closedROI + openPnL;

      // Calculate Avg ROI (average per closed trade - open PnL separate) (will be recalculated)
      let avgROI = closedTradesCount > 0
        ? closedROI / closedTradesCount
        : 0;

      // Calculate Avg DD and Max DD (negative trades)
      const losingTrades = closedTrades.filter(t => t.profitLoss < 0);
      const avgDD = losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + t.profitLoss, 0) / losingTrades.length
        : 0;

      const maxDD = losingTrades.length > 0
        ? Math.min(...losingTrades.map(t => t.profitLoss))
        : 0;

      // Calculate Sharpe Ratio (simplified)
      const returns = closedTrades.map(t => t.profitLoss || 0);
      let sharpeRatio = 0;
      if (returns.length >= 2) {
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        sharpeRatio = stdDev !== 0 ? avgReturn / stdDev : 0;
      }

      // Calculate Sortino Ratio (like Sharpe but only downside volatility)
      let sortinoRatio = 0;
      if (returns.length >= 2) {
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const negativeReturns = returns.filter(r => r < 0);
        if (negativeReturns.length > 0) {
          const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
          const downsideStdDev = Math.sqrt(downsideVariance);
          sortinoRatio = downsideStdDev !== 0 ? avgReturn / downsideStdDev : 0;
        } else {
          // No losing trades = infinite Sortino, cap at 100
          sortinoRatio = avgReturn > 0 ? 100 : 0;
        }
      }

      // Calculate Profit Factor (gross profit / gross loss)
      const grossProfit = closedTrades.filter(t => t.profitLoss > 0).reduce((sum, t) => sum + t.profitLoss, 0);
      const grossLoss = Math.abs(closedTrades.filter(t => t.profitLoss < 0).reduce((sum, t) => sum + t.profitLoss, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);

      // Calculate pair-based performance (CLOSED + OPEN)
      const pairPerformance = {};

      // Add closed trades
      for (const trade of closedTrades) {
        if (!trade.symbol) continue;

        if (!pairPerformance[trade.symbol]) {
          pairPerformance[trade.symbol] = {
            symbol: trade.symbol,
            closedTrades: 0,
            openTrades: 0,
            wins: 0,
            closedPnL: 0,
            openPnL: 0,
            maxDD: 0
          };
        }

        const pair = pairPerformance[trade.symbol];
        pair.closedTrades++;
        if (trade.profitLoss > 0) pair.wins++;
        pair.closedPnL += trade.profitLoss || 0;
        if (trade.profitLoss < pair.maxDD) pair.maxDD = trade.profitLoss;
      }

      // Add open positions with OPTIMIZED price fetching
      const activeEntries = entrySignals.filter(s =>
        s.status === 'ACTIVE' || s.status === 'PENDING'
      );

      // Step 1: Collect unique symbols and batch fetch prices
      const uniqueSymbols = [...new Set(activeEntries.map(s => s.symbol).filter(Boolean))];
      const priceCache = {};

      // Batch fetch prices for all unique symbols in PARALLEL (uses TradingView cache when available)
      // This is 50-100x faster than sequential fetching
      console.log(`📊 Fetching prices for ${uniqueSymbols.length} unique symbols in parallel...`);
      const priceStart = Date.now();
      const MAX_PRICE_FETCH_TIME = 30000; // 30 seconds max for all fetches
      const PER_SYMBOL_TIMEOUT = 2000; // 2 seconds per symbol

      // Create timeout promise for overall operation
      const overallTimeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve('timeout'), MAX_PRICE_FETCH_TIME);
      });

      // Fetch all prices in parallel
      const priceFetchPromise = Promise.allSettled(
        uniqueSymbols.map(async (symbol) => {
          try {
            // PriceService.getPrice() uses cached prices from TradingView scraper (2s cache)
            const pricePromise = PriceService.getPrice(symbol);
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(0), PER_SYMBOL_TIMEOUT));
            const price = await Promise.race([pricePromise, timeoutPromise]);

            if (price > 0) {
              return { symbol, price };
            }
            return null;
          } catch (error) {
            return null;
          }
        })
      );

      // Race between price fetching and overall timeout
      const result = await Promise.race([priceFetchPromise, overallTimeoutPromise]);

      if (result === 'timeout') {
        console.log(`⚠️  Overall price fetching timeout reached after ${MAX_PRICE_FETCH_TIME}ms`);
      } else {
        // Process results
        for (const settledResult of result) {
          if (settledResult.status === 'fulfilled' && settledResult.value) {
            const { symbol, price } = settledResult.value;
            if (symbol && price > 0) {
              priceCache[symbol] = price;
            }
          }
        }
      }

      console.log(`✅ Fetched ${Object.keys(priceCache).length}/${uniqueSymbols.length} prices in ${Date.now() - priceStart}ms`);

      // Step 2: Calculate Open PnL for each active position
      for (const activeEntry of activeEntries) {
        if (!activeEntry.symbol || !activeEntry.entryPrice) continue;

        if (!pairPerformance[activeEntry.symbol]) {
          pairPerformance[activeEntry.symbol] = {
            symbol: activeEntry.symbol,
            closedTrades: 0,
            openTrades: 0,
            wins: 0,
            closedPnL: 0,
            openPnL: 0,
            maxDD: 0
          };
        }

        const pair = pairPerformance[activeEntry.symbol];
        pair.openTrades++;

        // Calculate Open PnL using cached price
        const currentPrice = priceCache[activeEntry.symbol];
        if (currentPrice && currentPrice > 0) {
          let pnl = 0;
          if (activeEntry.direction === 'LONG') {
            pnl = ((currentPrice - activeEntry.entryPrice) / activeEntry.entryPrice * 100) - 0.1;
          } else if (activeEntry.direction === 'SHORT') {
            pnl = ((activeEntry.entryPrice - currentPrice) / activeEntry.entryPrice * 100) - 0.1;
          }
          pair.openPnL += pnl;
          openPnL += pnl; // Update strategy total
        }
      }

      // Convert to array and calculate metrics (OPEN + REALIZED)
      const pairBreakdown = Object.values(pairPerformance).map(pair => ({
        symbol: pair.symbol,
        closedTrades: pair.closedTrades,
        openTrades: pair.openTrades,
        totalTrades: pair.closedTrades + pair.openTrades,
        winRate: pair.closedTrades > 0 ? (pair.wins / pair.closedTrades * 100) : 0,
        closedROI: pair.closedPnL,
        openROI: pair.openPnL,
        totalROI: pair.closedPnL + pair.openPnL, // OPEN + REALIZED
        avgPerTrade: pair.closedTrades > 0 ? pair.closedPnL / pair.closedTrades : 0,
        maxDD: pair.maxDD,
        wins: pair.wins
      })).sort((a, b) => b.totalROI - a.totalROI); // Sort by best performance (open+realized)

      // ⚠️ CRITICAL: Filter out ALL negative ROI pairs
      // This removes losing pairs from the strategy entirely
      const negativePairsCount = pairBreakdown.filter(pair => pair.totalROI < 0).length;
      const positivePairs = pairBreakdown.filter(pair => pair.totalROI >= 0);

      if (negativePairsCount > 0) {
        console.log(`🗑️  ${strategy.name}: Filtered out ${negativePairsCount} negative pairs, keeping ${positivePairs.length} profitable pairs`);
      }

      // Recalculate ALL strategy metrics based ONLY on profitable pairs
      const recalculatedClosedTrades = positivePairs.filter(p => p.closedTrades > 0);
      const recalculatedWins = positivePairs.reduce((sum, p) => sum + p.wins, 0);
      const recalculatedTotalClosedTrades = positivePairs.reduce((sum, p) => sum + p.closedTrades, 0);
      const recalculatedClosedROI = positivePairs.reduce((sum, p) => sum + p.closedROI, 0);
      const recalculatedOpenPnL = positivePairs.reduce((sum, p) => sum + p.openROI, 0);
      const recalculatedTotalROI = recalculatedClosedROI + recalculatedOpenPnL;
      const recalculatedWinRate = recalculatedTotalClosedTrades > 0 ? (recalculatedWins / recalculatedTotalClosedTrades * 100) : 0;
      const recalculatedAvgROI = recalculatedTotalClosedTrades > 0 ? recalculatedClosedROI / recalculatedTotalClosedTrades : 0;

      // Override original metrics with recalculated values (based on positive pairs only)
      winRate = recalculatedWinRate;
      totalROI = recalculatedTotalROI;
      closedROI = recalculatedClosedROI;
      openPnL = recalculatedOpenPnL;
      avgROI = recalculatedAvgROI;

      // Calculate average signal age (for active signals)
      const now = Date.now();
      const activeSignalsList = entrySignals.filter(s =>
        s.status === 'ACTIVE' || s.status === 'PENDING'
      );

      let avgSignalAge = 0;
      let oldestSignalAge = 0;

      if (activeSignalsList.length > 0) {
        const ages = activeSignalsList.map(s => now - new Date(s.createdAt).getTime());
        avgSignalAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
        oldestSignalAge = Math.max(...ages);
      }

      // Format ages to "Xd Yh" format
      const formatAge = (ms) => {
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days}d ${hours}h`;
      };

      return {
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        category: strategy.category,
        type: strategy.type,
        providerId: strategy.providerId,
        providerUsername: strategy.provider.username,
        providerAvatar: strategy.provider.avatar,

        // Trading Info
        tradingPairs: strategy.supportedPairs || [],
        timeframes: strategy.supportedTimeframes || [],

        // Performance Metrics (CALCULATED FROM REAL DATA)
        winRate: parseFloat(winRate.toFixed(2)),
        totalROI: parseFloat(totalROI.toFixed(2)), // Closed + Open PnL (for sorting)
        totalReturn: parseFloat(totalROI.toFixed(2)), // Alias for compatibility
        closedReturn: parseFloat(closedROI.toFixed(2)), // Only closed trades
        openPnL: parseFloat(openPnL.toFixed(2)), // Only open positions
        avgProfit: parseFloat(avgROI.toFixed(2)),
        avgPerTrade: parseFloat(avgROI.toFixed(2)), // Same as avgProfit
        avgDD: parseFloat(avgDD.toFixed(2)),
        maxDrawdown: parseFloat(maxDD.toFixed(2)),
        sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
        sortinoRatio: parseFloat(sortinoRatio.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),

        // Pair-based performance breakdown (ONLY PROFITABLE PAIRS)
        pairPerformance: positivePairs,

        // Trade Stats
        totalSignals: signals.length,
        closedTrades: closedTradesCount,
        activeTrades: activeSignals,
        avgSignalAge: formatAge(avgSignalAge),
        oldestSignalAge: formatAge(oldestSignalAge),

        // Subscription
        subscriberCount: strategy._count.subscriptions || 0,
        subscriptionPrice: strategy.monthlyPrice || 0,

        // Status
        status: strategy.isActive ? 'ACTIVE' : 'INACTIVE',
        isPublic: strategy.isPublic,
        rating: strategy.rating || 0,

        createdAt: strategy.createdAt,
        updatedAt: strategy.updatedAt
      };
    }));

    // Apply post-query filters (for calculated fields)
    let filteredStrategies = strategiesWithMetrics;

    if (minWinRate && minWinRate > 0) {
      filteredStrategies = filteredStrategies.filter(s => s.winRate >= parseFloat(minWinRate));
    }

    if (maxPrice && maxPrice > 0) {
      filteredStrategies = filteredStrategies.filter(s => s.subscriptionPrice <= parseFloat(maxPrice));
    }

    // Apply sorting (default: sort by totalROI descending - best first!)
    const validSortFields = [
      'totalROI',
      'winRate',
      'closedTrades',
      'activeSignals',
      'avgSignalAge',
      'sharpeRatio',
      'sortinoRatio',
      'profitFactor',
      'avgPerTrade',
      'maxDrawdown',
      'createdAt'
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'totalROI';
    const isAscending = sortOrder === 'asc';

    console.log(`🔍 Sorting DEBUG: sortBy="${sortBy}", sortOrder="${sortOrder}", field="${sortField}", isAsc=${isAscending}`);

    filteredStrategies.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;

      // DESCENDING (default): highest values first (b - a gives desc)
      // ASCENDING: lowest values first (a - b gives asc)
      const result = isAscending ? (aVal - bVal) : (bVal - aVal);
      return result;
    });

    // Log first 3 after sort for verification
    const top3 = filteredStrategies.slice(0, 3).map(s => `${s.name}(${(s[sortField] || 0).toFixed(1)})`).join(', ');
    console.log(`📊 Sorted ${filteredStrategies.length} strategies by ${sortField} ${isAscending ? 'ASC' : 'DESC'} | Top 3: ${top3}`);

    const total = filteredStrategies.length;
    const totalPages = Math.ceil(total / parseInt(limit));

    const elapsedTime = Date.now() - startTime;
    console.log(`✅ Marketplace API completed in ${elapsedTime}ms`);
    console.log(`📊 Returning ${filteredStrategies.length} strategies (${total} total after filters)`);

    const responseData = {
      data: {
        strategies: filteredStrategies,
        total,
        totalPages,
        page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
        limit: parseInt(limit)
      },
      performance: {
        queryTime: `${elapsedTime}ms`,
        signalsProcessed: allSignals.length,
        strategiesProcessed: strategies.length,
        cached: false
      }
    };

    // Cache the response
    marketplaceCache.set(responseData);

    res.json({
      success: true,
      message: 'Marketplace strategies retrieved successfully',
      ...responseData
    });

  } catch (error) {
    logger.error('Marketplace strategies error:', error);
    console.error('❌ Marketplace API error:', error);
    next(error);
  }
});

/**
 * @route   GET /api/marketplace/stats
 * @desc    Get marketplace statistics
 * @access  Public
 */
router.get('/stats', async (req, res, next) => {
  try {
    const [totalStrategies, totalProviders, totalSubscribers, totalSignals] = await Promise.all([
      prisma.strategy.count({ where: { isPublic: true, isActive: true } }),
      prisma.user.count({ where: { role: 'PROVIDER', isActive: true } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.signal.count()
    ]);

    // Get average win rate across all strategies
    const strategies = await prisma.strategy.findMany({
      where: { isPublic: true, isActive: true },
      select: { winRate: true }
    });

    const avgWinRate = strategies.length > 0
      ? strategies.reduce((sum, s) => sum + (s.winRate || 0), 0) / strategies.length
      : 0;

    res.json({
      success: true,
      data: {
        totalStrategies,
        totalProviders,
        totalSubscribers,
        totalSignals,
        avgWinRate: avgWinRate.toFixed(2)
      }
    });
  } catch (error) {
    logger.error('Marketplace stats error:', error);
    next(error);
  }
});

module.exports = router;
