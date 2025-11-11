/**
 * Signal Type Definitions
 *
 * TypeScript interfaces for trading signals and related data
 */

// Signal types
export type SignalType = 'ENTRY' | 'EXIT' | 'UPDATE';

// Signal direction
export type SignalDirection = 'LONG' | 'SHORT';

// Signal status
export type SignalStatus = 'PENDING' | 'ACTIVE' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';

/**
 * Main Signal Interface
 */
export interface Signal {
  id: string;
  strategyId: string;
  strategyName: string;
  providerId: string;
  providerUsername: string;

  // Signal details
  type: SignalType;
  direction: SignalDirection;
  status: SignalStatus;
  symbol: string; // Trading pair (e.g., "BTC/USDT")
  timeframe: string;

  // Price levels
  entryPrice: number;
  currentPrice?: number;
  stopLoss: number;
  takeProfit: number | null;

  // Optional additional take profit levels
  takeProfit2?: number | null;
  takeProfit3?: number | null;

  // Risk/Reward
  riskRewardRatio: number | null;

  // Performance (if executed)
  executedPrice?: number | null;
  exitPrice?: number | null;
  profitLoss?: number | null; // In percentage
  profitLossAmount?: number | null; // In currency

  // Metadata
  note?: string;
  confidenceLevel?: number; // 0-100

  // Timestamps
  createdAt: string;
  executedAt?: string | null;
  closedAt?: string | null;
  expiresAt?: string | null;
}

/**
 * Signal List Response
 */
export interface SignalListResponse {
  success: boolean;
  message: string;
  data: {
    signals: Signal[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats?: SignalStats;
  };
}

/**
 * Single Signal Response
 */
export interface SignalResponse {
  success: boolean;
  message: string;
  data: {
    signal: Signal;
  };
}

/**
 * Create Signal Request (Provider only)
 */
export interface CreateSignalRequest {
  strategyId: string;
  type: SignalType;
  direction: SignalDirection;
  symbol: string;
  timeframe: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number | null;
  takeProfit2?: number | null;
  takeProfit3?: number | null;
  note?: string;
  confidenceLevel?: number;
  expiresAt?: string;
}

/**
 * Update Signal Request (Provider only)
 */
export interface UpdateSignalRequest {
  status?: SignalStatus;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number | null;
  note?: string;
}

/**
 * Execute Signal Request (User action)
 */
export interface ExecuteSignalRequest {
  signalId: string;
  executedPrice: number;
  positionSize?: number;
}

/**
 * Execute Signal Response
 */
export interface ExecuteSignalResponse {
  success: boolean;
  message: string;
  data: {
    signal: Signal;
    position?: any; // Position object if created
  };
}

/**
 * Signal Statistics
 */
export interface SignalStats {
  totalSignals: number;
  activeSignals: number;
  executedSignals: number;
  winRate: number;
  averageProfit: number;
  averageLoss: number;
  profitFactor: number | null;
}

/**
 * Signal Filter Options
 */
export interface SignalFilters {
  strategyId?: string;
  providerId?: string;
  type?: SignalType;
  direction?: SignalDirection;
  status?: SignalStatus;
  symbol?: string;
  timeframe?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'executedAt' | 'profitLoss' | 'closedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * User's Signal Subscriptions (signals from subscribed strategies)
 */
export interface UserSignalsResponse {
  success: boolean;
  message: string;
  data: {
    signals: Signal[];
    total: number;
  };
}

/**
 * WebSocket Signal Event
 */
export interface SignalWebSocketEvent {
  type: 'NEW_SIGNAL' | 'SIGNAL_UPDATE' | 'SIGNAL_CLOSED';
  signal: Signal;
  timestamp: string;
}

/**
 * Signal Type Labels
 */
export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  ENTRY: 'Entry',
  EXIT: 'Exit',
  UPDATE: 'Update',
};

/**
 * Signal Type Colors (for badges)
 */
export const SIGNAL_TYPE_COLORS: Record<SignalType, string> = {
  ENTRY: 'bg-green-100 text-green-800',
  EXIT: 'bg-red-100 text-red-800',
  UPDATE: 'bg-blue-100 text-blue-800',
};

/**
 * Signal Direction Labels
 */
export const SIGNAL_DIRECTION_LABELS: Record<SignalDirection, string> = {
  LONG: 'Long',
  SHORT: 'Short',
};

/**
 * Signal Direction Colors
 */
export const SIGNAL_DIRECTION_COLORS: Record<SignalDirection, string> = {
  LONG: 'bg-green-500 text-white',
  SHORT: 'bg-red-500 text-white',
};

/**
 * Signal Status Labels
 */
export const SIGNAL_STATUS_LABELS: Record<SignalStatus, string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  EXECUTED: 'Executed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

/**
 * Signal Status Colors
 */
export const SIGNAL_STATUS_COLORS: Record<SignalStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  EXECUTED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  EXPIRED: 'bg-red-100 text-red-800',
};

/**
 * Helper function to calculate potential profit/loss
 */
export function calculatePotentialPnL(
  entryPrice: number,
  exitPrice: number,
  direction: SignalDirection
): number {
  if (direction === 'LONG') {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - exitPrice) / entryPrice) * 100;
  }
}

/**
 * Helper function to calculate risk/reward ratio
 */
export function calculateRiskReward(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  direction: SignalDirection
): number {
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);

  if (risk === 0) return 0;
  return reward / risk;
}

/**
 * Helper function to determine if signal is profitable
 */
export function isSignalProfitable(signal: Signal): boolean {
  if (!signal.profitLoss) return false;
  return signal.profitLoss > 0;
}

/**
 * Helper function to format signal age
 */
export function getSignalAge(createdAt: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
