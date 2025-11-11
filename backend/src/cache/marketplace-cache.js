/**
 * Marketplace Cache
 *
 * Caches marketplace data to avoid re-querying 33k signals on every request
 * Cache refreshes every 1 minute
 */

class MarketplaceCache {
  constructor() {
    this.cache = null;
    this.lastUpdate = 0;
    this.cacheLifetime = 60000; // 1 minute
    this.isUpdating = false;
  }

  /**
   * Check if cache is still valid
   */
  isValid() {
    if (!this.cache) return false;
    const age = Date.now() - this.lastUpdate;
    return age < this.cacheLifetime;
  }

  /**
   * Get cached data
   */
  get() {
    if (this.isValid()) {
      console.log(`✅ Serving from cache (age: ${Math.floor((Date.now() - this.lastUpdate) / 1000)}s)`);
      return this.cache;
    }
    return null;
  }

  /**
   * Set cache data
   */
  set(data) {
    this.cache = data;
    this.lastUpdate = Date.now();
    console.log(`💾 Cache updated with ${data?.strategies?.length || 0} strategies`);
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache = null;
    this.lastUpdate = 0;
    console.log('🗑️  Cache cleared');
  }

  /**
   * Get cache stats
   */
  getStats() {
    const age = this.cache ? Math.floor((Date.now() - this.lastUpdate) / 1000) : null;
    return {
      hasCache: !!this.cache,
      cacheAge: age ? `${age}s` : 'none',
      isValid: this.isValid(),
      strategiesCount: this.cache?.strategies?.length || 0,
      lastUpdate: this.lastUpdate ? new Date(this.lastUpdate).toISOString() : null
    };
  }
}

// Singleton instance
const cache = new MarketplaceCache();

module.exports = cache;
