// Exchange API Configuration
// DO NOT COMMIT TO PUBLIC REPO

export const exchangeConfigs = {
  bybit: {
    apiKey: 'a7Opcy8gDkBvBhP2Pg',
    secret: 'mMeUjrrRpFkfEfU9mKovhhfgMdIvNUTBB04k',
    enableRateLimit: true,
    options: {
      defaultType: 'future',
      adjustForTimeDifference: true
    }
  },
  bitget: {
    apiKey: 'bg_08acd10c4fb4ed325a00ddb3a1e5846c',
    secret: 'fda21998d91137353398f1586479e64ed4a6306b0017f69a69aea7920f78a3b1',
    password: '1453Fatih',
    enableRateLimit: true,
    options: {
      defaultType: 'swap'
    }
  },
  mexc: {
    apiKey: 'mx0vglgSV2G4e8Mj9i',
    secret: '00c257e1404e4cc58bec41bc7ec5f8b7',
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
