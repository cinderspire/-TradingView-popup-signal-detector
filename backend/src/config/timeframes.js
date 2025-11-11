// Supported Timeframes Configuration
// Used across the entire trading system

export const TIMEFRAMES = {
  // Minutes
  '1m': { label: '1 Minute', ms: 60000 },
  '2m': { label: '2 Minutes', ms: 120000 },
  '3m': { label: '3 Minutes', ms: 180000 },
  '5m': { label: '5 Minutes', ms: 300000 },
  '15m': { label: '15 Minutes', ms: 900000 },
  '30m': { label: '30 Minutes', ms: 1800000 },

  // Hours
  '1h': { label: '1 Hour', ms: 3600000 },
  '2h': { label: '2 Hours', ms: 7200000 },
  '4h': { label: '4 Hours', ms: 14400000 },
  '6h': { label: '6 Hours', ms: 21600000 },
  '8h': { label: '8 Hours', ms: 28800000 },
  '12h': { label: '12 Hours', ms: 43200000 },

  // Days+
  '1d': { label: '1 Day', ms: 86400000 },
  '3d': { label: '3 Days', ms: 259200000 },
  '1w': { label: '1 Week', ms: 604800000 },
  '1M': { label: '1 Month', ms: 2592000000 }
};

export const getAllTimeframes = () => Object.keys(TIMEFRAMES);

export const getTimeframeMs = (timeframe) => {
  return TIMEFRAMES[timeframe]?.ms || null;
};

export const getTimeframeLabel = (timeframe) => {
  return TIMEFRAMES[timeframe]?.label || timeframe;
};

export default TIMEFRAMES;
