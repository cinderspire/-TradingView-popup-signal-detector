const { EventEmitter } = require('events');

/**
 * TradingViewPriceScraper
 *
 * Scrapes prices from TradingView's watchlist (right side panel)
 * Updates prices every 1 minute for Open PnL calculation
 * Works alongside alert capture - does not interfere with signal detection
 */
class TradingViewPriceScraper extends EventEmitter {
  constructor(tradingViewCapture) {
    super();
    this.tvCapture = tradingViewCapture;
    this.prices = new Map(); // symbol -> { price, timestamp }
    this.scrapeInterval = null;
    this.scrapeFrequency = 60000; // 1 minute (60,000ms)
    this.isActive = false;
  }

  /**
   * Start price scraping from TradingView watchlist
   */
  async startScraping() {
    if (!this.tvCapture || !this.tvCapture.page) {
      console.error('❌ TradingView page not available for price scraping');
      return;
    }

    console.log('🔍 Starting TradingView price scraping...');
    this.isActive = true;

    // Initial scrape
    await this.scrapePrices();

    // Set up interval for continuous scraping
    this.scrapeInterval = setInterval(async () => {
      if (this.isActive) {
        await this.scrapePrices();
      }
    }, this.scrapeFrequency);

    console.log(`✅ Price scraping active (every ${this.scrapeFrequency / 1000}s)`);
  }

  /**
   * Scrape prices from TradingView watchlist
   */
  async scrapePrices() {
    try {
      if (!this.tvCapture || !this.tvCapture.page) {
        return;
      }

      const page = this.tvCapture.page;

      // Execute scraping in browser context
      const scrapedData = await page.evaluate(() => {
        const prices = [];

        // Method 1: Try to find watchlist items
        // TradingView uses various class names, so we'll try multiple selectors
        const selectors = [
          '[class*="watchlist"]',
          '[class*="symbol-item"]',
          '[data-symbol-full]',
          '[class*="chart-symbol"]',
          'div[data-name*="symbol"]'
        ];

        let elements = [];
        for (const selector of selectors) {
          elements = document.querySelectorAll(selector);
          if (elements.length > 0) break;
        }

        // If we found watchlist elements
        for (const element of elements) {
          try {
            // Extract symbol
            let symbol = null;
            if (element.dataset.symbolFull) {
              symbol = element.dataset.symbolFull;
            } else if (element.dataset.symbol) {
              symbol = element.dataset.symbol;
            } else {
              // Try to find symbol in text content
              const symbolMatch = element.textContent.match(/([A-Z]+)(USDT|USD|BTC)/);
              if (symbolMatch) {
                symbol = symbolMatch[0];
              }
            }

            if (!symbol) continue;

            // Extract price - look for numbers with decimals
            const priceMatches = element.textContent.match(/[\d,]+\.\d+/g);
            if (priceMatches && priceMatches.length > 0) {
              const price = parseFloat(priceMatches[0].replace(/,/g, ''));
              if (price > 0) {
                prices.push({ symbol, price });
              }
            }
          } catch (e) {
            // Skip elements we can't parse
          }
        }

        // Method 2: If Method 1 fails, try to get current chart symbol and price
        if (prices.length === 0) {
          try {
            // Look for the main chart symbol at the top
            const chartTitleSelectors = [
              '[class*="chart-symbol-name"]',
              '[data-name="legend-source-title"]',
              '[class*="symbol-title"]'
            ];

            let chartSymbol = null;
            for (const selector of chartTitleSelectors) {
              const elem = document.querySelector(selector);
              if (elem) {
                chartSymbol = elem.textContent.trim();
                break;
              }
            }

            // Look for price in chart
            const priceSelectors = [
              '[class*="price-axis"]',
              '[data-name="legend-source-item"]',
              '[class*="values-wrapper"]'
            ];

            let chartPrice = null;
            for (const selector of priceSelectors) {
              const elem = document.querySelector(selector);
              if (elem) {
                const priceMatch = elem.textContent.match(/[\d,]+\.\d+/);
                if (priceMatch) {
                  chartPrice = parseFloat(priceMatch[0].replace(/,/g, ''));
                  break;
                }
              }
            }

            if (chartSymbol && chartPrice) {
              prices.push({ symbol: chartSymbol, price: chartPrice });
            }
          } catch (e) {
            // Fallback failed
          }
        }

        return prices;
      });

      if (scrapedData && scrapedData.length > 0) {
        const timestamp = Date.now();
        let newPrices = 0;

        for (const data of scrapedData) {
          // Normalize symbol format
          let symbol = data.symbol;
          if (!symbol.includes('/')) {
            if (symbol.endsWith('USDT')) {
              symbol = symbol.replace('USDT', '') + '/USDT';
            } else if (symbol.endsWith('USD')) {
              symbol = symbol.replace('USD', '') + '/USD';
            }
          }

          // Store price
          this.prices.set(symbol, {
            price: data.price,
            timestamp,
            source: 'tradingview-watchlist'
          });

          newPrices++;
        }

        console.log(`📊 Scraped ${newPrices} prices from TradingView`);

        // Emit event with updated prices
        this.emit('prices-updated', Array.from(this.prices.entries()).map(([symbol, data]) => ({
          symbol,
          ...data
        })));

      } else {
        console.log('⚠️  No prices found in TradingView watchlist');
      }

    } catch (error) {
      console.error('❌ Price scraping error:', error.message);
    }
  }

  /**
   * Get current price for a symbol
   */
  getPrice(symbol) {
    const data = this.prices.get(symbol);
    if (data) {
      return data.price;
    }
    return null;
  }

  /**
   * Get all current prices
   */
  getAllPrices() {
    return Array.from(this.prices.entries()).map(([symbol, data]) => ({
      symbol,
      ...data
    }));
  }

  /**
   * Check if prices are fresh (updated within last 2 minutes)
   */
  arePricesFresh() {
    const now = Date.now();
    const twoMinutes = 2 * 60 * 1000;

    for (const [symbol, data] of this.prices.entries()) {
      if (now - data.timestamp < twoMinutes) {
        return true;
      }
    }

    return false;
  }

  /**
   * Stop price scraping
   */
  stop() {
    console.log('⏹️  Stopping price scraping...');
    this.isActive = false;

    if (this.scrapeInterval) {
      clearInterval(this.scrapeInterval);
      this.scrapeInterval = null;
    }

    console.log('✅ Price scraping stopped');
  }

  /**
   * Get stats
   */
  getStats() {
    const freshCount = Array.from(this.prices.values()).filter(data => {
      return (Date.now() - data.timestamp) < 120000; // Fresh if < 2min old
    }).length;

    return {
      totalSymbols: this.prices.size,
      freshSymbols: freshCount,
      isActive: this.isActive,
      scrapeFrequency: `${this.scrapeFrequency / 1000}s`
    };
  }
}

module.exports = TradingViewPriceScraper;
