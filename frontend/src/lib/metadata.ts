import { Metadata } from 'next';

export interface PageMetadata {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  noIndex?: boolean;
}

const siteConfig = {
  name: 'AutomatedTradeBot',
  description: 'Professional trading signal marketplace with real-time analytics, copy trading, and advanced risk management',
  url: 'https://automatedtradebot.com',
  ogImage: '/og-image.png',
  twitterHandle: '@automatedtradebot',
};

export function generateMetadata(pageData: PageMetadata): Metadata {
  const title = `${pageData.title} | ${siteConfig.name}`;
  const keywords = pageData.keywords?.join(', ') ||
    'trading signals, forex signals, crypto signals, copy trading, automated trading, signal marketplace';

  const metadata: Metadata = {
    title,
    description: pageData.description,
    keywords,
    authors: [{ name: siteConfig.name }],
    robots: pageData.noIndex ? 'noindex,nofollow' : 'index,follow',
    openGraph: {
      title,
      description: pageData.description,
      url: siteConfig.url,
      siteName: siteConfig.name,
      type: 'website',
      images: [
        {
          url: pageData.ogImage || siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: pageData.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: pageData.description,
      creator: siteConfig.twitterHandle,
      images: [pageData.ogImage || siteConfig.ogImage],
    },
    alternates: {
      canonical: siteConfig.url,
    },
  };

  return metadata;
}

// Page-specific metadata configurations
export const pageMetadata = {
  home: {
    title: 'Trading Signal Marketplace',
    description: 'Discover profitable trading strategies from verified providers. Start with 14-day free trials, track real-time performance, and copy trade with confidence.',
    keywords: ['trading signals', 'forex signals', 'crypto trading', 'copy trading', 'automated trading', 'signal marketplace', 'trading strategies'],
  },
  strategies: {
    title: 'Trading Strategies',
    description: 'Browse verified trading strategies with transparent performance metrics. Start free trials and subscribe to profitable strategies from expert providers.',
    keywords: ['trading strategies', 'forex strategies', 'crypto strategies', 'profitable trading', 'strategy marketplace', 'verified signals'],
  },
  leaderboard: {
    title: 'Provider Leaderboard',
    description: 'Compare top signal providers ranked by performance, win rate, and subscriber satisfaction. Find the best traders to follow.',
    keywords: ['provider leaderboard', 'top traders', 'best signal providers', 'trading rankings', 'provider performance'],
  },
  dashboard: {
    title: 'Dashboard',
    description: 'Your trading dashboard with real-time portfolio tracking, active positions, and performance analytics.',
    keywords: ['trading dashboard', 'portfolio tracking', 'trading analytics'],
    noIndex: true,
  },
  subscriptions: {
    title: 'My Subscriptions',
    description: 'Manage your strategy subscriptions, track performance, and view active positions for all your followed traders.',
    keywords: ['trading subscriptions', 'manage subscriptions', 'subscription analytics'],
    noIndex: true,
  },
  positions: {
    title: 'Positions',
    description: 'View and manage all your open and closed trading positions with detailed P&L analytics.',
    keywords: ['trading positions', 'open positions', 'position management', 'PnL tracking'],
    noIndex: true,
  },
  signals: {
    title: 'Trading Signals',
    description: 'Real-time trading signals from your subscribed strategies with instant notifications.',
    keywords: ['real-time signals', 'trading alerts', 'signal notifications'],
    noIndex: true,
  },
  providers: {
    title: 'Signal Providers',
    description: 'Explore verified signal providers and their trading strategies. Compare performance metrics and subscriber reviews.',
    keywords: ['signal providers', 'trading providers', 'expert traders', 'verified providers'],
  },
  marketplace: {
    title: 'Marketplace',
    description: 'Explore trending strategies and top-performing signal providers in our marketplace.',
    keywords: ['trading marketplace', 'trending strategies', 'popular signals'],
  },
  register: {
    title: 'Sign Up',
    description: 'Create your free AutomatedTradeBot account and start following profitable trading strategies today.',
    keywords: ['sign up', 'create account', 'register trading', 'free account'],
    noIndex: true,
  },
  login: {
    title: 'Login',
    description: 'Sign in to your AutomatedTradeBot account to access your dashboard and subscriptions.',
    keywords: ['login', 'sign in', 'account access'],
    noIndex: true,
  },
  profile: {
    title: 'Profile',
    description: 'Manage your trading profile and account settings.',
    keywords: ['user profile', 'account settings'],
    noIndex: true,
  },
  riskManagement: {
    title: 'Risk Management',
    description: 'Configure your risk management settings including position sizing, stop loss, and take profit rules.',
    keywords: ['risk management', 'position sizing', 'stop loss', 'take profit'],
    noIndex: true,
  },
  analytics: {
    title: 'Analytics',
    description: 'Advanced trading analytics and performance insights for your portfolio.',
    keywords: ['trading analytics', 'performance metrics', 'portfolio analytics'],
    noIndex: true,
  },
  backtests: {
    title: 'Backtests',
    description: 'View historical backtesting results for strategies and analyze past performance.',
    keywords: ['backtesting', 'historical performance', 'strategy testing'],
    noIndex: true,
  },
  newsCalendar: {
    title: 'Economic Calendar',
    description: 'Stay updated with important economic events and news that impact the markets.',
    keywords: ['economic calendar', 'market news', 'trading events'],
  },
  notifications: {
    title: 'Notifications',
    description: 'Manage your trading notifications and alerts.',
    keywords: ['notifications', 'trading alerts', 'signal alerts'],
    noIndex: true,
  },
  transactions: {
    title: 'Transactions',
    description: 'View your transaction history and subscription payments.',
    keywords: ['transactions', 'payment history', 'subscription billing'],
    noIndex: true,
  },
  settings: {
    title: 'Settings',
    description: 'Configure your account settings and preferences.',
    keywords: ['account settings', 'preferences', 'configuration'],
    noIndex: true,
  },
  providerDashboard: {
    title: 'Provider Dashboard',
    description: 'Manage your strategies, track subscribers, and monitor your performance as a signal provider.',
    keywords: ['provider dashboard', 'strategy management', 'subscriber tracking'],
    noIndex: true,
  },
  providerSignals: {
    title: 'Create Signal',
    description: 'Broadcast new trading signals to your subscribers.',
    keywords: ['create signal', 'broadcast signal', 'signal provider'],
    noIndex: true,
  },
  providerStrategies: {
    title: 'My Strategies',
    description: 'Manage your published trading strategies and performance.',
    keywords: ['manage strategies', 'provider strategies', 'strategy management'],
    noIndex: true,
  },
  providerSubscribers: {
    title: 'Subscribers',
    description: 'View and manage your strategy subscribers.',
    keywords: ['subscribers', 'subscriber management', 'provider subscribers'],
    noIndex: true,
  },
  providerAnalytics: {
    title: 'Provider Analytics',
    description: 'Advanced analytics for your strategies and subscriber engagement.',
    keywords: ['provider analytics', 'strategy analytics', 'subscriber metrics'],
    noIndex: true,
  },
};
