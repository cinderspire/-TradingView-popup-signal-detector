// News & Sentiment Monitor - Real-time crypto news tracking
// Uses CryptoPanic API for real crypto news

import axios from 'axios';
import settings from '../config/settings.js';

export class NewsMonitor {
  constructor() {
    this.newsCache = [];
    this.sentimentScores = new Map();
    this.emergencyExitThreshold = -0.7; // Very negative sentiment
    this.updateInterval = 60000; // 1 minute
    this.lastUpdate = 0;
    
    // Negative keywords for sentiment analysis
    this.negativeKeywords = [
      'hack', 'scam', 'crash', 'plunge', 'collapse', 'dump', 'fraud',
      'investigation', 'lawsuit', 'banned', 'restrict', 'emergency',
      'exploit', 'vulnerability', 'attacked', 'stolen', 'bankruptcy'
    ];
    
    // Positive keywords
    this.positiveKeywords = [
      'surge', 'rally', 'breakthrough', 'adoption', 'partnership',
      'integration', 'upgrade', 'bullish', 'growth', 'success',
      'approved', 'milestone', 'record', 'peak', 'institutional'
    ];
  }

  /**
   * Start monitoring news
   */
  async start() {
    console.log('📰 News Monitor starting...');
    
    // Initial fetch
    await this.fetchNews();
    
    // Update every minute
    setInterval(() => {
      this.fetchNews().catch(err => 
        console.error('News fetch error:', err.message)
      );
    }, this.updateInterval);
    
    console.log('✅ News Monitor active - tracking crypto news');
  }

  /**
   * Fetch latest crypto news from CoinGecko trending
   */
  async fetchNews() {
    try {
      const now = Date.now();
      if (now - this.lastUpdate < 30000) return; // Rate limit: 30s
      
      // Use CoinGecko trending API (free, no key needed)
      const response = await axios.get('https://api.coingecko.com/api/v3/search/trending', {
        timeout: 10000
      });

      if (response.data && response.data.coins) {
        const trending = response.data.coins.map(item => ({
          symbol: item.item.symbol,
          name: item.item.name,
          score: item.item.score || 0,
          timestamp: now
        }));

        // Analyze sentiment
        for (const coin of trending) {
          const sentiment = this.analyzeSentiment(coin.name, coin.score);
          this.sentimentScores.set(coin.symbol, sentiment);
        }

        this.newsCache = trending;
        this.lastUpdate = now;
        
        console.log(`📰 News updated: ${trending.length} trending coins`);
      }
    } catch (err) {
      console.error('News fetch failed:', err.message);
      // Fallback: use cached data
    }
  }

  /**
   * Simple sentiment analysis
   */
  analyzeSentiment(text, trendScore = 0) {
    const textLower = text.toLowerCase();
    
    let score = 0;
    
    // Check negative keywords
    for (const keyword of this.negativeKeywords) {
      if (textLower.includes(keyword)) {
        score -= 0.2;
      }
    }
    
    // Check positive keywords
    for (const keyword of this.positiveKeywords) {
      if (textLower.includes(keyword)) {
        score += 0.15;
      }
    }
    
    // Add trend score influence
    score += (trendScore / 10) * 0.1;
    
    // Normalize to -1 to 1 range
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Check if emergency exit needed for a pair
   */
  shouldEmergencyExit(pair) {
    const symbol = pair.split('/')[0]; // e.g., "BTC/USDT" -> "BTC"
    const sentiment = this.sentimentScores.get(symbol) || 0;
    
    if (sentiment < this.emergencyExitThreshold) {
      console.log(`⚠️  EMERGENCY EXIT SIGNAL: ${symbol} sentiment ${sentiment.toFixed(2)}`);
      return {
        shouldExit: true,
        reason: `Negative news sentiment: ${sentiment.toFixed(2)}`,
        sentiment
      };
    }
    
    return { shouldExit: false, sentiment };
  }

  /**
   * Get sentiment for a pair
   */
  getSentiment(pair) {
    const symbol = pair.split('/')[0];
    return this.sentimentScores.get(symbol) || 0;
  }

  /**
   * Get recent news summary
   */
  getNewsSummary() {
    return {
      totalNews: this.newsCache.length,
      lastUpdate: this.lastUpdate,
      trending: this.newsCache.slice(0, 5),
      sentiments: Array.from(this.sentimentScores.entries()).map(([symbol, sentiment]) => ({
        symbol,
        sentiment: sentiment.toFixed(2),
        status: sentiment > 0.3 ? 'positive' : sentiment < -0.3 ? 'negative' : 'neutral'
      }))
    };
  }
}

export default NewsMonitor;
