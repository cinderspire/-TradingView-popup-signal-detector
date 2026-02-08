// Exchange API Configuration
// Set your API keys via environment variables, NOT here

export const exchangeConfigs = {
  bybit: {
    apiKey: process.env.BYBIT_API_KEY || '',
    secret: process.env.BYBIT_SECRET || '',
    enableRateLimit: true,
    options: {
      defaultType: 'future',
      adjustForTimeDifference: true
    }
  },
  bitget: {
    apiKey: process.env.BITGET_API_KEY || '',
    secret: process.env.BITGET_SECRET || '',
    password: process.env.BITGET_PASSWORD || '',
    enableRateLimit: true,
    options: {
      defaultType: 'swap'
    }
  },
  mexc: {
    apiKey: process.env.MEXC_API_KEY || '',
    secret: process.env.MEXC_SECRET || '',
    enableRateLimit: true,
    options: {
      defaultType: 'swap'
    }
  }
};

// Exchange rate limits (requests per second)
export const rateLimits = {
  bybit: 10,
  bitget: 10,
  mexc: 10
};

export default exchangeConfigs;
