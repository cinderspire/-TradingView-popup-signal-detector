// Strategy Loader - Auto-detect and load strategies from /strategies directory

import fs from 'fs/promises';
import path from 'path';
import settings from '../config/settings.js';

export class StrategyLoader {
  constructor() {
    this.strategies = new Map();
    this.strategiesPath = settings.strategiesPath;
  }

  /**
   * Load all strategies from strategies directory
   */
  async loadAllStrategies() {
    try {
      const files = await fs.readdir(this.strategiesPath);
      const jsFiles = files.filter(f => f.endsWith('.js'));

      console.log(`\n📂 Loading strategies from ${this.strategiesPath}...`);

      for (const file of jsFiles) {
        await this.loadStrategy(file);
      }

      console.log(`✅ Loaded ${this.strategies.size} strategies\n`);

      return Array.from(this.strategies.values());
    } catch (err) {
      console.error('Error loading strategies:', err.message);
      return [];
    }
  }

  /**
   * Load a single strategy file
   */
  async loadStrategy(filename) {
    try {
      const filePath = path.join(this.strategiesPath, filename);
      const strategyModule = await import(`file://${filePath}`);
      const strategy = strategyModule.default || strategyModule;

      // Validate strategy structure
      if (!this.validateStrategy(strategy)) {
        console.warn(`⚠️  Invalid strategy: ${filename}`);
        return null;
      }

      this.strategies.set(strategy.name, strategy);
      console.log(`  ✓ ${strategy.name} (${strategy.type})`);

      return strategy;
    } catch (err) {
      console.error(`  ✗ Failed to load ${filename}:`, err.message);
      return null;
    }
  }

  /**
   * Validate strategy structure
   */
  validateStrategy(strategy) {
    return (
      strategy.name &&
      strategy.type &&
      strategy.description &&
      typeof strategy.init === 'function' &&
      typeof strategy.next === 'function' &&
      strategy.params
    );
  }

  /**
   * Get strategy by name
   */
  getStrategy(name) {
    return this.strategies.get(name);
  }

  /**
   * Get all strategies
   */
  getAllStrategies() {
    return Array.from(this.strategies.values());
  }

  /**
   * Get strategies by type
   */
  getStrategiesByType(type) {
    return Array.from(this.strategies.values()).filter(s => s.type === type);
  }

  /**
   * Reload strategies (hot reload)
   */
  async reloadStrategies() {
    this.strategies.clear();
    return await this.loadAllStrategies();
  }

  /**
   * Watch for new strategy files (auto-detect)
   */
  async watchStrategies(callback) {
    const watcher = fs.watch(this.strategiesPath);

    for await (const event of watcher) {
      if (event.eventType === 'change' || event.eventType === 'rename') {
        console.log(`\n🔄 Strategy files changed, reloading...`);
        await this.reloadStrategies();
        if (callback) callback(this.getAllStrategies());
      }
    }
  }
}

export default StrategyLoader;
