/**
 * Symbol Normalization Utility
 * Converts between different exchange symbol formats
 *
 * Formats:
 * - Binance Futures: BTCUSDT.P, ETHUSDT.P (Perpetual)
 * - CCXT Standard: BTC/USDT, ETH/USDT
 * - Binance Spot: BTCUSDT (no separator)
 */

/**
 * Normalize symbol to CCXT format (BASE/QUOTE)
 * @param {string} symbol - Symbol in any format
 * @returns {string} - Normalized symbol in BASE/QUOTE format
 */
function normalizeSymbol(symbol) {
  if (!symbol) return null;

  // Already in CCXT format (BTC/USDT)
  if (symbol.includes('/')) {
    return symbol;
  }

  // Remove perpetual suffix (.P)
  let clean = symbol.replace('.P', '');

  // Common quote currencies
  const quoteCurrencies = ['USDT', 'USDC', 'BUSD', 'USD', 'BTC', 'ETH', 'BNB'];

  // Find which quote currency is used
  for (const quote of quoteCurrencies) {
    if (clean.endsWith(quote)) {
      const base = clean.slice(0, -quote.length);
      if (base.length > 0) {
        return `${base}/${quote}`;
      }
    }
  }

  // If no match found, return original
  console.warn(`⚠️  Could not normalize symbol: ${symbol}`);
  return symbol;
}

/**
 * Convert CCXT format to Binance format
 * @param {string} symbol - Symbol in CCXT format (BTC/USDT)
 * @param {boolean} futures - Whether this is for futures
 * @returns {string} - Binance format symbol
 */
function toBinanceFormat(symbol, futures = false) {
  if (!symbol) return null;

  let result = symbol.replace('/', '');

  if (futures) {
    result += '.P';
  }

  return result;
}

/**
 * Extract base and quote currencies from symbol
 * @param {string} symbol - Symbol in any format
 * @returns {{base: string, quote: string}} - Base and quote currencies
 */
function extractCurrencies(symbol) {
  const normalized = normalizeSymbol(symbol);

  if (!normalized) {
    return { base: null, quote: null };
  }

  const [base, quote] = normalized.split('/');
  return { base, quote };
}

/**
 * Check if symbol is a perpetual futures contract
 * @param {string} symbol - Symbol to check
 * @returns {boolean}
 */
function isPerpetual(symbol) {
  return symbol && symbol.endsWith('.P');
}

/**
 * Get quote currency from symbol
 * @param {string} symbol - Symbol in any format
 * @returns {string} - Quote currency (e.g., 'USDT')
 */
function getQuoteCurrency(symbol) {
  const { quote } = extractCurrencies(symbol);
  return quote || 'USDT'; // Default to USDT
}

/**
 * Get base currency from symbol
 * @param {string} symbol - Symbol in any format
 * @returns {string} - Base currency (e.g., 'BTC')
 */
function getBaseCurrency(symbol) {
  const { base } = extractCurrencies(symbol);
  return base;
}

module.exports = {
  normalizeSymbol,
  toBinanceFormat,
  extractCurrencies,
  isPerpetual,
  getQuoteCurrency,
  getBaseCurrency
};
