/**
 * Position Type Definitions
 *
 * TypeScript interfaces for trading positions and related data
 */

// Position side/direction
export type PositionSide = 'LONG' | 'SHORT';

// Position status
export type PositionStatus = 'OPEN' | 'CLOSED';

// Position close reason
export type CloseReason =
  | 'MANUAL'           // Manually closed by user
  | 'TAKE_PROFIT'      // Hit take profit
  | 'STOP_LOSS'        // Hit stop loss
  | 'LIQUIDATION'      // Liquidated
  | 'EXPIRED'          // Expired
  | 'SYSTEM';          // Closed by system

/**
 * Main Position Interface
 */
export interface Position {
  id: string;
  userId: string;
  username: string;

  // Related entities
  strategyId?: string;
  strategyName?: string;
  signalId?: string;

  // Position details
  symbol: string;           // Trading pair (e.g., "BTC/USDT")
  side: PositionSide;       // LONG or SHORT
  status: PositionStatus;   // OPEN or CLOSED

  // Price levels
  entryPrice: number;
  currentPrice?: number;     // Current market price (for open positions)
  exitPrice?: number;        // Actual exit price (for closed positions)
  stopLoss?: number;
  takeProfit?: number;

  // Position sizing
  size: number;              // Position size (in base currency)
  leverage?: number;         // Leverage used (1x, 2x, etc.)

  // P&L
  unrealizedPnL?: number;    // Current P&L (for open positions)
  realizedPnL?: number;      // Actual P&L (for closed positions)
  pnlPercentage?: number;    // P&L as percentage

  // Fees
  entryFee?: number;
  exitFee?: number;
  totalFees?: number;

  // Close information (for closed positions)
  closeReason?: CloseReason;
  closedAt?: string;

  // Metadata
  note?: string;
  tags?: string[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Position List Response
 */
export interface PositionListResponse {
  success: boolean;
  message: string;
  data: {
    positions: Position[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats?: PositionStats;
  };
}

/**
 * Single Position Response
 */
export interface PositionResponse {
  success: boolean;
  message: string;
  data: {
    position: Position;
  };
}

/**
 * Create Position Request
 */
export interface CreatePositionRequest {
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  size: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  strategyId?: string;
  signalId?: string;
  note?: string;
  tags?: string[];
}

/**
 * Update Position Request
 */
export interface UpdatePositionRequest {
  stopLoss?: number;
  takeProfit?: number;
  note?: string;
  tags?: string[];
}

/**
 * Close Position Request
 */
export interface ClosePositionRequest {
  positionId: string;
  exitPrice: number;
  closeReason?: CloseReason;
  note?: string;
}

/**
 * Close Position Response
 */
export interface ClosePositionResponse {
  success: boolean;
  message: string;
  data: {
    position: Position;
    realizedPnL: number;
    pnlPercentage: number;
  };
}

/**
 * Position Statistics
 */
export interface PositionStats {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalVolume: number;
  totalPnL: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number | null;
  largestWin: number;
  largestLoss: number;
  averageHoldTime: number; // in hours
}

/**
 * Position Filter Options
 */
export interface PositionFilters {
  status?: PositionStatus;
  side?: PositionSide;
  symbol?: string;
  strategyId?: string;
  closeReason?: CloseReason;
  startDate?: string;
  endDate?: string;
  minPnL?: number;
  maxPnL?: number;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'closedAt' | 'pnlPercentage' | 'size';
  sortOrder?: 'asc' | 'desc';
}

/**
 * User's Positions Response
 */
export interface UserPositionsResponse {
  success: boolean;
  message: string;
  data: {
    positions: Position[];
    total: number;
    stats: PositionStats;
  };
}

/**
 * Position Side Labels
 */
export const POSITION_SIDE_LABELS: Record<PositionSide, string> = {
  LONG: 'Long',
  SHORT: 'Short',
};

/**
 * Position Side Colors (for badges)
 */
export const POSITION_SIDE_COLORS: Record<PositionSide, string> = {
  LONG: 'bg-green-500 text-white',
  SHORT: 'bg-red-500 text-white',
};

/**
 * Position Status Labels
 */
export const POSITION_STATUS_LABELS: Record<PositionStatus, string> = {
  OPEN: 'Open',
  CLOSED: 'Closed',
};

/**
 * Position Status Colors
 */
export const POSITION_STATUS_COLORS: Record<PositionStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

/**
 * Close Reason Labels
 */
export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  MANUAL: 'Manual Close',
  TAKE_PROFIT: 'Take Profit',
  STOP_LOSS: 'Stop Loss',
  LIQUIDATION: 'Liquidation',
  EXPIRED: 'Expired',
  SYSTEM: 'System Close',
};

/**
 * Close Reason Colors
 */
export const CLOSE_REASON_COLORS: Record<CloseReason, string> = {
  MANUAL: 'bg-blue-100 text-blue-800',
  TAKE_PROFIT: 'bg-green-100 text-green-800',
  STOP_LOSS: 'bg-red-100 text-red-800',
  LIQUIDATION: 'bg-red-200 text-red-900',
  EXPIRED: 'bg-yellow-100 text-yellow-800',
  SYSTEM: 'bg-gray-100 text-gray-800',
};

/**
 * Helper function to calculate unrealized P&L
 */
export function calculateUnrealizedPnL(
  entryPrice: number,
  currentPrice: number,
  size: number,
  side: PositionSide
): number {
  if (side === 'LONG') {
    return (currentPrice - entryPrice) * size;
  } else {
    return (entryPrice - currentPrice) * size;
  }
}

/**
 * Helper function to calculate P&L percentage
 */
export function calculatePnLPercentage(
  entryPrice: number,
  exitPrice: number,
  side: PositionSide
): number {
  if (side === 'LONG') {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - exitPrice) / entryPrice) * 100;
  }
}

/**
 * Helper function to determine if position is profitable
 */
export function isPositionProfitable(position: Position): boolean {
  const pnl = position.realizedPnL ?? position.unrealizedPnL ?? 0;
  return pnl > 0;
}

/**
 * Helper function to get position duration
 */
export function getPositionDuration(position: Position): string {
  const start = new Date(position.createdAt);
  const end = position.closedAt ? new Date(position.closedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffMins = Math.floor((diffMs % 3600000) / 60000);

  if (diffHours < 1) {
    return `${diffMins}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h ${diffMins}m`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;
    return `${diffDays}d ${remainingHours}h`;
  }
}

/**
 * Helper function to format P&L
 */
export function formatPnL(pnl: number, withSign: boolean = true): string {
  const sign = withSign ? (pnl >= 0 ? '+' : '') : '';
  return `${sign}${pnl.toFixed(2)}`;
}

/**
 * Helper function to format P&L percentage
 */
export function formatPnLPercentage(percentage: number, withSign: boolean = true): string {
  const sign = withSign ? (percentage >= 0 ? '+' : '') : '';
  return `${sign}${percentage.toFixed(2)}%`;
}

/**
 * Helper function to get P&L color class
 */
export function getPnLColorClass(pnl: number): string {
  if (pnl > 0) return 'text-green-600';
  if (pnl < 0) return 'text-red-600';
  return 'text-gray-600';
}
