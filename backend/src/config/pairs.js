// Top 100 crypto pairs distributed across 3 exchanges to avoid rate limits

export const priorityPairs = [
  'XRP/USDT',
  'SOL/USDT',
  'BTC/USDT',
  'ETH/USDT',
  'DOGE/USDT',
  'ADA/USDT',
  'AVAX/USDT',
  'MATIC/USDT'
];

export const pairDistribution = {
  bybit: [
    // Priority pairs
    'XRP/USDT', 'SOL/USDT', 'BTC/USDT', 'ETH/USDT',
    'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'MATIC/USDT',
    // Additional pairs for Bybit (total ~35)
    'DOT/USDT', 'LINK/USDT', 'UNI/USDT', 'LTC/USDT',
    'BCH/USDT', 'ATOM/USDT', 'ETC/USDT', 'XLM/USDT',
    'TRX/USDT', 'ALGO/USDT', 'VET/USDT', 'ICP/USDT',
    'FIL/USDT', 'SAND/USDT', 'MANA/USDT', 'AXS/USDT',
    'THETA/USDT', 'XTZ/USDT', 'EOS/USDT', 'AAVE/USDT',
    'GRT/USDT', 'FTM/USDT', 'KSM/USDT', 'NEO/USDT',
    'WAVES/USDT'
  ],

  bitget: [
    // Pairs 36-70
    'CAKE/USDT', 'MKR/USDT', 'COMP/USDT', 'SNX/USDT',
    'YFI/USDT', 'UMA/USDT', 'BAL/USDT', 'CRV/USDT',
    'SUSHI/USDT', '1INCH/USDT', 'ENJ/USDT', 'CHZ/USDT',
    'ZIL/USDT', 'HOT/USDT', 'IOTA/USDT', 'OMG/USDT',
    'ZRX/USDT', 'BAT/USDT', 'QTUM/USDT', 'ICX/USDT',
    'ONT/USDT', 'ZEC/USDT', 'DASH/USDT', 'EGLD/USDT',
    'NEAR/USDT', 'RUNE/USDT', 'KAVA/USDT', 'CELO/USDT',
    'AR/USDT', 'LRC/USDT', 'ROSE/USDT', 'SKL/USDT',
    'ANKR/USDT', 'AUDIO/USDT', 'COTI/USDT', 'HBAR/USDT'
  ],

  mexc: [
    // Pairs 71-100
    'SRM/USDT', 'REEF/USDT', 'OGN/USDT', 'NKN/USDT',
    'OCEAN/USDT', 'REN/USDT', 'KNC/USDT', 'BNT/USDT',
    'STORJ/USDT', 'CTK/USDT', 'ALPHA/USDT', 'DENT/USDT',
    'CELR/USDT', 'DYDX/USDT', 'IOTX/USDT', 'RLC/USDT',
    'C98/USDT', 'IMX/USDT', 'APE/USDT', 'GMT/USDT',
    'GALA/USDT', 'GAL/USDT', 'OP/USDT', 'ARB/USDT',
    'LDO/USDT', 'APT/USDT', 'BLUR/USDT', 'PEPE/USDT',
    'SUI/USDT', 'SEI/USDT'
  ]
};

// Get all pairs
export const getAllPairs = () => {
  return [...pairDistribution.bybit, ...pairDistribution.bitget, ...pairDistribution.mexc];
};

// Get exchange for a specific pair
export const getExchangeForPair = (pair) => {
  if (pairDistribution.bybit.includes(pair)) return 'bybit';
  if (pairDistribution.bitget.includes(pair)) return 'bitget';
  if (pairDistribution.mexc.includes(pair)) return 'mexc';
  return null;
};

// Get exchange for REAL TRADING - prefers MEXC first, then others
export const getExchangeForRealTrade = (pair) => {
  // First check if pair is available on MEXC
  if (pairDistribution.mexc.includes(pair)) return 'mexc';

  // If not on MEXC, try other exchanges
  if (pairDistribution.bybit.includes(pair)) return 'bybit';
  if (pairDistribution.bitget.includes(pair)) return 'bitget';

  // Default: prefer MEXC even if not in our list (user can test any pair)
  return 'mexc';
};

// Timeframes to support
export const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default {
  priorityPairs,
  pairDistribution,
  getAllPairs,
  getExchangeForPair,
  getExchangeForRealTrade,
  timeframes
};
