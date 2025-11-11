/**
 * Strategy Type Definitions
 *
 * TypeScript interfaces for trading strategies, subscriptions, and marketplace
 */

// Strategy status types
export type StrategyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

// Trading pair type
export type TradingPair = string; // e.g., "BTC/USDT", "ETH/USDT"

// Timeframe type
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

/**
 * Main Strategy Interface
 */
export interface Strategy {
  id: string;
  providerId: string;
  providerUsername: string;
  providerEmail?: string;
  name: string;
  description: string;
  tradingPairs: TradingPair[];
  timeframes: Timeframe[];
  status: StrategyStatus;
  isPublic: boolean;
  subscriptionPrice: number; // Monthly price in USD

  // Performance metrics
  totalSignals: number;
  successfulSignals: number;
  winRate: number; // Percentage (0-100)
  averageReturn: number; // Percentage per trade
  totalReturn: number; // Cumulative return percentage
  maxDrawdown: number; // Maximum drawdown percentage
  sharpeRatio: number | null;
  profitFactor: number | null;

  // Subscriber info
  subscriberCount: number;
  maxSubscribers: number | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastSignalAt: string | null;

  // Real performance stats from executed trades (optional, fetched separately)
  performanceStats?: {
    totalSubscribers: number;
    activeSignals: number;
    totalSignals: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnl: string;
    avgPnl: string;
  };
}

/**
 * Strategy List Response
 */
export interface StrategyListResponse {
  success: boolean;
  message: string;
  data: {
    strategies: Strategy[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats?: StrategyStats;
  };
}

/**
 * Single Strategy Response
 */
export interface StrategyResponse {
  success: boolean;
  message: string;
  data: {
    strategy: Strategy;
  };
}

/**
 * Create Strategy Request
 */
export interface CreateStrategyRequest {
  name: string;
  description: string;
  tradingPairs: TradingPair[];
  timeframes: Timeframe[];
  isPublic: boolean;
  subscriptionPrice: number;
  maxSubscribers?: number;
}

/**
 * Update Strategy Request
 */
export interface UpdateStrategyRequest {
  name?: string;
  description?: string;
  tradingPairs?: TradingPair[];
  timeframes?: Timeframe[];
  status?: StrategyStatus;
  isPublic?: boolean;
  subscriptionPrice?: number;
  maxSubscribers?: number;
}

/**
 * Strategy Statistics
 */
export interface StrategyStats {
  totalStrategies: number;
  activeStrategies: number;
  totalSubscriptions: number;
  averageWinRate: number;
  topPerformingStrategy: Strategy | null;
}

/**
 * Strategy Subscription
 */
export interface Subscription {
  id: string;
  userId: string;
  strategyId: string;
  strategyName: string;
  providerUsername: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  startDate: string;
  endDate: string | null;
  price: number;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Subscribe Request
 */
export interface SubscribeRequest {
  strategyId: string;
  autoRenew?: boolean;
}

/**
 * Subscribe Response
 */
export interface SubscribeResponse {
  success: boolean;
  message: string;
  data: {
    subscription: Subscription;
  };
}

/**
 * Unsubscribe Response
 */
export interface UnsubscribeResponse {
  success: boolean;
  message: string;
}

/**
 * User's Subscriptions Response
 */
export interface UserSubscriptionsResponse {
  success: boolean;
  message: string;
  data: {
    subscriptions: Subscription[];
    total: number;
  };
}

/**
 * Strategy Filter Options
 */
export interface StrategyFilters {
  status?: StrategyStatus;
  isPublic?: boolean;
  tradingPair?: TradingPair;
  minWinRate?: number;
  maxPrice?: number;
  providerId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'winRate' | 'totalReturn' | 'subscriberCount' | 'createdAt' | 'price';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Strategy Performance Data (for charts)
 */
export interface StrategyPerformance {
  date: string;
  equity: number;
  return: number;
  drawdown: number;
}

/**
 * Strategy Performance History Response
 */
export interface StrategyPerformanceResponse {
  success: boolean;
  message: string;
  data: {
    performance: StrategyPerformance[];
  };
}

/**
 * Common Trading Pairs (for dropdowns/filters)
 */
export const COMMON_TRADING_PAIRS: TradingPair[] = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'XRP/USDT',
  'ADA/USDT',
  'SOL/USDT',
  'DOGE/USDT',
  'MATIC/USDT',
  'DOT/USDT',
  'AVAX/USDT',
];

/**
 * Common Timeframes (for dropdowns/filters)
 */
export const COMMON_TIMEFRAMES: Timeframe[] = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1d',
  '1w',
];

/**
 * Strategy Status Labels
 */
export const STRATEGY_STATUS_LABELS: Record<StrategyStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
};

/**
 * Strategy Status Colors (for badges)
 */
export const STRATEGY_STATUS_COLORS: Record<StrategyStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
  ARCHIVED: 'bg-red-100 text-red-800',
};
