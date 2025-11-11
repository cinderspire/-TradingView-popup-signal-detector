const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * NEWS CALENDAR & ECONOMIC EVENTS
 * Provides economic calendar data for risk management and trading decisions
 *
 * Data Sources:
 * 1. Free: Trading Economics API (free tier available)
 * 2. Premium: Forex Factory, Investing.com
 * 3. Fallback: Static economic event data
 */

// In-memory cache for economic events (1 hour TTL)
let economicEventsCache = {
  data: [],
  lastFetch: null,
  ttl: 60 * 60 * 1000 // 1 hour
};

/**
 * Generate mock economic events for demonstration
 * In production, replace with real API integration
 */
function generateMockEconomicEvents() {
  const now = new Date();
  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
  const impacts = ['HIGH', 'MEDIUM', 'LOW'];

  const eventTypes = [
    { name: 'Non-Farm Payrolls', currency: 'USD', impact: 'HIGH', typical: 'First Friday' },
    { name: 'Federal Reserve Interest Rate Decision', currency: 'USD', impact: 'HIGH', typical: 'FOMC Meeting' },
    { name: 'Consumer Price Index (CPI)', currency: 'USD', impact: 'HIGH', typical: 'Monthly' },
    { name: 'Gross Domestic Product (GDP)', currency: 'USD', impact: 'HIGH', typical: 'Quarterly' },
    { name: 'Unemployment Rate', currency: 'USD', impact: 'MEDIUM', typical: 'Monthly' },
    { name: 'Retail Sales', currency: 'USD', impact: 'MEDIUM', typical: 'Monthly' },
    { name: 'Producer Price Index (PPI)', currency: 'USD', impact: 'MEDIUM', typical: 'Monthly' },
    { name: 'ECB Interest Rate Decision', currency: 'EUR', impact: 'HIGH', typical: 'ECB Meeting' },
    { name: 'EUR CPI', currency: 'EUR', impact: 'HIGH', typical: 'Monthly' },
    { name: 'BoE Interest Rate Decision', currency: 'GBP', impact: 'HIGH', typical: 'BoE Meeting' },
    { name: 'GBP GDP', currency: 'GBP', impact: 'HIGH', typical: 'Quarterly' },
    { name: 'BoJ Interest Rate Decision', currency: 'JPY', impact: 'HIGH', typical: 'BoJ Meeting' },
    { name: 'AUD Employment Change', currency: 'AUD', impact: 'MEDIUM', typical: 'Monthly' },
    { name: 'CAD Employment Change', currency: 'CAD', impact: 'MEDIUM', typical: 'Monthly' }
  ];

  const events = [];

  // Generate events for next 7 days
  for (let day = 0; day < 7; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);

    // 2-4 events per day
    const numEvents = Math.floor(Math.random() * 3) + 2;

    for (let i = 0; i < numEvents; i++) {
      const eventTemplate = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      // Random time between 8 AM and 4 PM
      const hour = Math.floor(Math.random() * 9) + 8;
      const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)];

      const eventDate = new Date(date);
      eventDate.setHours(hour, minute, 0, 0);

      events.push({
        id: `event_${Date.now()}_${day}_${i}`,
        title: eventTemplate.name,
        currency: eventTemplate.currency,
        date: eventDate.toISOString(),
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} UTC`,
        impact: eventTemplate.impact,
        forecast: generateForecast(eventTemplate.name),
        previous: generatePrevious(eventTemplate.name),
        actual: day < 0 ? generateActual(eventTemplate.name) : null, // Only past events have actuals
        description: `${eventTemplate.typical} release of ${eventTemplate.name} data for ${eventTemplate.currency}`,
        source: 'Economic Calendar',
        affectedPairs: getAffectedPairs(eventTemplate.currency)
      });
    }
  }

  // Sort by date
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  return events;
}

/**
 * Generate forecast values based on event type
 */
function generateForecast(eventName) {
  if (eventName.includes('Interest Rate')) {
    return `${(Math.random() * 5).toFixed(2)}%`;
  } else if (eventName.includes('CPI') || eventName.includes('PPI')) {
    return `${(Math.random() * 5).toFixed(1)}%`;
  } else if (eventName.includes('GDP')) {
    return `${(Math.random() * 3).toFixed(1)}%`;
  } else if (eventName.includes('Unemployment')) {
    return `${(Math.random() * 6 + 3).toFixed(1)}%`;
  } else if (eventName.includes('Payrolls') || eventName.includes('Employment')) {
    return `${Math.floor(Math.random() * 300 - 50)}K`;
  } else if (eventName.includes('Retail Sales')) {
    return `${(Math.random() * 2).toFixed(1)}%`;
  }
  return 'N/A';
}

function generatePrevious(eventName) {
  if (eventName.includes('Interest Rate')) {
    return `${(Math.random() * 5).toFixed(2)}%`;
  } else if (eventName.includes('CPI') || eventName.includes('PPI')) {
    return `${(Math.random() * 5).toFixed(1)}%`;
  } else if (eventName.includes('GDP')) {
    return `${(Math.random() * 3).toFixed(1)}%`;
  } else if (eventName.includes('Unemployment')) {
    return `${(Math.random() * 6 + 3).toFixed(1)}%`;
  } else if (eventName.includes('Payrolls') || eventName.includes('Employment')) {
    return `${Math.floor(Math.random() * 300 - 50)}K`;
  } else if (eventName.includes('Retail Sales')) {
    return `${(Math.random() * 2).toFixed(1)}%`;
  }
  return 'N/A';
}

function generateActual(eventName) {
  // Similar to forecast but with slight variation
  return generateForecast(eventName);
}

/**
 * Get trading pairs affected by currency events
 */
function getAffectedPairs(currency) {
  const pairs = {
    'USD': ['BTC/USDT', 'ETH/USDT', 'EUR/USD', 'GBP/USD', 'USD/JPY'],
    'EUR': ['EUR/USD', 'EUR/GBP', 'EUR/JPY'],
    'GBP': ['GBP/USD', 'EUR/GBP', 'GBP/JPY'],
    'JPY': ['USD/JPY', 'EUR/JPY', 'GBP/JPY'],
    'AUD': ['AUD/USD', 'AUD/JPY'],
    'CAD': ['USD/CAD', 'CAD/JPY'],
    'CHF': ['USD/CHF', 'EUR/CHF'],
    'NZD': ['NZD/USD', 'NZD/JPY']
  };

  return pairs[currency] || [];
}

/**
 * Fetch economic events from external API
 * In production, integrate with real APIs like:
 * - Trading Economics API
 * - Forex Factory
 * - Investing.com
 */
async function fetchEconomicEvents() {
  try {
    // Check cache first
    const now = Date.now();
    if (economicEventsCache.lastFetch &&
        (now - economicEventsCache.lastFetch) < economicEventsCache.ttl) {
      logger.info('Returning cached economic events');
      return economicEventsCache.data;
    }

    // In production, replace with real API call:
    // const response = await axios.get('https://api.tradingeconomics.com/calendar', {
    //   params: {
    //     c: process.env.TRADING_ECONOMICS_API_KEY,
    //     country: 'united states,euro area,united kingdom,japan',
    //     importance: 2 // Medium and High importance only
    //   }
    // });

    // For now, generate mock data
    const events = generateMockEconomicEvents();

    // Update cache
    economicEventsCache.data = events;
    economicEventsCache.lastFetch = now;

    logger.info(`Fetched ${events.length} economic events`);
    return events;

  } catch (error) {
    logger.error('Error fetching economic events:', error);

    // Return cached data if available, otherwise empty array
    return economicEventsCache.data.length > 0 ? economicEventsCache.data : [];
  }
}

/**
 * Filter events by criteria
 */
function filterEvents(events, filters) {
  let filtered = [...events];

  // Filter by currency
  if (filters.currency) {
    const currencies = filters.currency.toUpperCase().split(',').map(c => c.trim());
    filtered = filtered.filter(event => currencies.includes(event.currency));
  }

  // Filter by impact
  if (filters.impact) {
    const impacts = filters.impact.toUpperCase().split(',').map(i => i.trim());
    filtered = filtered.filter(event => impacts.includes(event.impact));
  }

  // Filter by date range
  if (filters.startDate) {
    const startDate = new Date(filters.startDate);
    filtered = filtered.filter(event => new Date(event.date) >= startDate);
  }

  if (filters.endDate) {
    const endDate = new Date(filters.endDate);
    endDate.setHours(23, 59, 59, 999); // End of day
    filtered = filtered.filter(event => new Date(event.date) <= endDate);
  }

  return filtered;
}

// @route   GET /api/news-calendar
// @desc    Get economic calendar events
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const { currency, impact, startDate, endDate, limit = 50 } = req.query;

    // Fetch all events
    const allEvents = await fetchEconomicEvents();

    // Apply filters
    const filteredEvents = filterEvents(allEvents, {
      currency,
      impact,
      startDate,
      endDate
    });

    // Apply limit
    const limitedEvents = filteredEvents.slice(0, parseInt(limit));

    // Calculate statistics
    const stats = {
      total: filteredEvents.length,
      returned: limitedEvents.length,
      byImpact: {
        HIGH: filteredEvents.filter(e => e.impact === 'HIGH').length,
        MEDIUM: filteredEvents.filter(e => e.impact === 'MEDIUM').length,
        LOW: filteredEvents.filter(e => e.impact === 'LOW').length
      },
      byCurrency: {}
    };

    // Count by currency
    filteredEvents.forEach(event => {
      stats.byCurrency[event.currency] = (stats.byCurrency[event.currency] || 0) + 1;
    });

    logger.info(`Economic calendar request: ${limitedEvents.length} events returned`);

    res.json({
      success: true,
      message: 'Economic calendar events retrieved successfully',
      data: {
        events: limitedEvents,
        stats,
        filters: {
          currency: currency || 'all',
          impact: impact || 'all',
          startDate: startDate || 'none',
          endDate: endDate || 'none',
          limit: parseInt(limit)
        },
        cacheInfo: {
          cached: economicEventsCache.lastFetch !== null,
          lastUpdate: economicEventsCache.lastFetch ? new Date(economicEventsCache.lastFetch).toISOString() : null,
          ttl: economicEventsCache.ttl / 1000 / 60 + ' minutes'
        }
      }
    });
  } catch (error) {
    logger.error('Economic calendar error:', error);
    next(error);
  }
});

// @route   GET /api/news-calendar/upcoming
// @desc    Get upcoming high-impact news (next 24 hours)
// @access  Public
router.get('/upcoming', async (req, res, next) => {
  try {
    const { hours = 24, impact = 'HIGH,MEDIUM' } = req.query;

    // Fetch all events
    const allEvents = await fetchEconomicEvents();

    // Filter for upcoming events within specified hours
    const now = new Date();
    const futureTime = new Date(now.getTime() + (parseInt(hours) * 60 * 60 * 1000));

    const upcomingEvents = allEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= now && eventDate <= futureTime;
    });

    // Filter by impact
    const impacts = impact.toUpperCase().split(',').map(i => i.trim());
    const filteredEvents = upcomingEvents.filter(event =>
      impacts.includes(event.impact)
    );

    // Sort by date (soonest first)
    filteredEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Group by timeframe
    const groupedByTimeframe = {
      'next_1h': [],
      'next_4h': [],
      'next_12h': [],
      'next_24h': []
    };

    filteredEvents.forEach(event => {
      const eventDate = new Date(event.date);
      const hoursUntil = (eventDate - now) / (1000 * 60 * 60);

      if (hoursUntil <= 1) {
        groupedByTimeframe.next_1h.push(event);
      } else if (hoursUntil <= 4) {
        groupedByTimeframe.next_4h.push(event);
      } else if (hoursUntil <= 12) {
        groupedByTimeframe.next_12h.push(event);
      } else if (hoursUntil <= 24) {
        groupedByTimeframe.next_24h.push(event);
      }
    });

    // Calculate risk assessment
    const riskLevel = calculateMarketRisk(filteredEvents);

    // Generate trading recommendations
    const recommendations = generateTradingRecommendations(filteredEvents);

    logger.info(`Upcoming events request: ${filteredEvents.length} events in next ${hours}h`);

    res.json({
      success: true,
      message: 'Upcoming high-impact news retrieved successfully',
      data: {
        upcomingEvents: filteredEvents,
        groupedByTimeframe,
        summary: {
          totalEvents: filteredEvents.length,
          highImpact: filteredEvents.filter(e => e.impact === 'HIGH').length,
          mediumImpact: filteredEvents.filter(e => e.impact === 'MEDIUM').length,
          nextEvent: filteredEvents[0] || null,
          timeWindow: `${hours} hours`,
          currentTime: now.toISOString()
        },
        riskAssessment: riskLevel,
        recommendations,
        filters: {
          hours: parseInt(hours),
          impact: impact.split(',')
        }
      }
    });
  } catch (error) {
    logger.error('Upcoming events error:', error);
    next(error);
  }
});

/**
 * Calculate overall market risk based on upcoming events
 */
function calculateMarketRisk(events) {
  if (events.length === 0) {
    return {
      level: 'LOW',
      score: 0,
      description: 'No significant economic events in the timeframe'
    };
  }

  // Calculate risk score
  let score = 0;
  const now = new Date();

  events.forEach(event => {
    const eventDate = new Date(event.date);
    const hoursUntil = (eventDate - now) / (1000 * 60 * 60);

    // Impact multiplier
    const impactWeight = {
      'HIGH': 3,
      'MEDIUM': 2,
      'LOW': 1
    };

    // Time proximity multiplier (closer = higher risk)
    const timeWeight = hoursUntil <= 1 ? 3 : hoursUntil <= 4 ? 2 : 1;

    score += impactWeight[event.impact] * timeWeight;
  });

  // Determine risk level
  let level, description;
  if (score >= 15) {
    level = 'VERY HIGH';
    description = 'Multiple high-impact events imminent. Consider reducing position sizes or staying out of market.';
  } else if (score >= 10) {
    level = 'HIGH';
    description = 'Significant economic events approaching. Increased volatility expected.';
  } else if (score >= 5) {
    level = 'MEDIUM';
    description = 'Moderate economic activity. Normal trading with caution around event times.';
  } else {
    level = 'LOW';
    description = 'Low economic event risk. Standard trading conditions.';
  }

  return {
    level,
    score,
    description,
    totalEvents: events.length,
    highImpactEvents: events.filter(e => e.impact === 'HIGH').length
  };
}

/**
 * Generate trading recommendations based on upcoming events
 */
function generateTradingRecommendations(events) {
  const recommendations = [];
  const now = new Date();

  // Check for very near-term high-impact events
  const imminentHighImpact = events.filter(event => {
    const hoursUntil = (new Date(event.date) - now) / (1000 * 60 * 60);
    return event.impact === 'HIGH' && hoursUntil <= 1;
  });

  if (imminentHighImpact.length > 0) {
    recommendations.push({
      type: 'CAUTION',
      severity: 'HIGH',
      message: `${imminentHighImpact.length} high-impact event(s) within 1 hour`,
      action: 'Avoid opening new positions. Consider closing existing positions or tightening stop losses.',
      affectedPairs: [...new Set(imminentHighImpact.flatMap(e => e.affectedPairs))]
    });
  }

  // Check for upcoming Fed/ECB/BoE decisions
  const centralBankEvents = events.filter(event =>
    event.title.includes('Interest Rate Decision') ||
    event.title.includes('FOMC') ||
    event.title.includes('ECB') ||
    event.title.includes('BoE') ||
    event.title.includes('BoJ')
  );

  if (centralBankEvents.length > 0) {
    recommendations.push({
      type: 'INFO',
      severity: 'MEDIUM',
      message: `${centralBankEvents.length} central bank event(s) scheduled`,
      action: 'Major volatility expected. Only trade with tight risk management.',
      events: centralBankEvents.map(e => ({
        title: e.title,
        date: e.date,
        currency: e.currency
      }))
    });
  }

  // Check for NFP (Non-Farm Payrolls)
  const nfpEvents = events.filter(event =>
    event.title.includes('Non-Farm Payrolls')
  );

  if (nfpEvents.length > 0) {
    recommendations.push({
      type: 'WARNING',
      severity: 'HIGH',
      message: 'Non-Farm Payrolls (NFP) scheduled',
      action: 'Expect extreme volatility. This is one of the most impactful economic releases.',
      affectedPairs: ['BTC/USDT', 'ETH/USDT', 'EUR/USD', 'GBP/USD', 'USD/JPY']
    });
  }

  // If no specific recommendations, provide general guidance
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'INFO',
      severity: 'LOW',
      message: 'Normal market conditions expected',
      action: 'Standard risk management practices apply. Monitor upcoming events.',
      affectedPairs: []
    });
  }

  return recommendations;
}

// @route   GET /api/news-calendar/risk-times
// @desc    Get high-risk trading times based on economic calendar
// @access  Public
router.get('/risk-times', async (req, res, next) => {
  try {
    const { days = 7 } = req.query;

    // Fetch all events
    const allEvents = await fetchEconomicEvents();

    // Filter high-impact events
    const highImpactEvents = allEvents.filter(e => e.impact === 'HIGH');

    // Create risk time windows (30 min before, 1 hour after each event)
    const riskWindows = highImpactEvents.map(event => {
      const eventDate = new Date(event.date);
      const startTime = new Date(eventDate.getTime() - (30 * 60 * 1000)); // 30 min before
      const endTime = new Date(eventDate.getTime() + (60 * 60 * 1000)); // 1 hour after

      return {
        eventId: event.id,
        eventTitle: event.title,
        currency: event.currency,
        eventTime: event.date,
        riskWindowStart: startTime.toISOString(),
        riskWindowEnd: endTime.toISOString(),
        duration: '90 minutes',
        recommendation: 'Avoid trading or use tight stop losses',
        affectedPairs: event.affectedPairs
      };
    });

    res.json({
      success: true,
      message: 'High-risk trading times retrieved successfully',
      data: {
        riskWindows,
        summary: {
          totalRiskWindows: riskWindows.length,
          totalRiskHours: (riskWindows.length * 1.5).toFixed(1),
          daysAnalyzed: parseInt(days)
        }
      }
    });
  } catch (error) {
    logger.error('Risk times error:', error);
    next(error);
  }
});

module.exports = router;
