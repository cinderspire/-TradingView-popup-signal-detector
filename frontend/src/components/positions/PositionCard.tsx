'use client';

import React from 'react';
import {
  Position,
  POSITION_SIDE_COLORS,
  POSITION_STATUS_COLORS,
  CLOSE_REASON_COLORS,
  CLOSE_REASON_LABELS,
  calculatePnLPercentage,
  isPositionProfitable,
  getPositionDuration,
  formatPnL,
  formatPnLPercentage,
  getPnLColorClass,
} from '@/types/position';

interface PositionCardProps {
  position: Position;
  onClose?: (position: Position) => void;
  onUpdate?: (position: Position) => void;
  onViewDetails?: (position: Position) => void;
  showActions?: boolean;
}

export function PositionCard({
  position,
  onClose,
  onUpdate,
  onViewDetails,
  showActions = true,
}: PositionCardProps) {
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  };

  const isOpen = position.status === 'OPEN';
  const isClosed = position.status === 'CLOSED';
  const profitable = position.realizedPnL
    ? position.realizedPnL > 0
    : position.unrealizedPnL
    ? position.unrealizedPnL > 0
    : false;

  // Calculate current P&L percentage for open positions
  const currentPnLPercentage =
    isOpen && position.currentPrice
      ? calculatePnLPercentage(position.entryPrice, position.currentPrice, position.side)
      : position.pnlPercentage;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900">{position.symbol}</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  POSITION_SIDE_COLORS[position.side]
                }`}
              >
                {position.side}
              </span>
              {position.leverage && position.leverage > 1 && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                  {position.leverage}x
                </span>
              )}
            </div>
            {position.strategyName && (
              <p className="text-sm text-gray-600">{position.strategyName}</p>
            )}
          </div>
          <div className="flex flex-col items-end space-y-1">
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                POSITION_STATUS_COLORS[position.status]
              }`}
            >
              {position.status}
            </span>
            {isClosed && position.closeReason && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  CLOSE_REASON_COLORS[position.closeReason]
                }`}
              >
                {CLOSE_REASON_LABELS[position.closeReason]}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{getPositionDuration(position)}</span>
          <span>Size: {position.size.toFixed(4)}</span>
        </div>
      </div>

      {/* Price Levels */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Entry Price:</span>
          <span className="text-sm font-bold text-gray-900">{formatPrice(position.entryPrice)}</span>
        </div>

        {isOpen && position.currentPrice && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Current Price:</span>
            <span className="text-sm font-bold text-blue-600">
              {formatPrice(position.currentPrice)}
            </span>
          </div>
        )}

        {isClosed && position.exitPrice && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Exit Price:</span>
            <span className="text-sm font-bold text-gray-900">{formatPrice(position.exitPrice)}</span>
          </div>
        )}

        {position.stopLoss && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Stop Loss:</span>
            <span className="text-sm font-bold text-red-600">{formatPrice(position.stopLoss)}</span>
          </div>
        )}

        {position.takeProfit && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Take Profit:</span>
            <span className="text-sm font-bold text-green-600">
              {formatPrice(position.takeProfit)}
            </span>
          </div>
        )}

        {/* P&L Display */}
        <div className="pt-3 border-t-2 border-gray-200">
          {isOpen && position.unrealizedPnL !== null && position.unrealizedPnL !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Unrealized P&L:</span>
                <div className="text-right">
                  <span className={`text-lg font-bold ${getPnLColorClass(position.unrealizedPnL)}`}>
                    ${formatPnL(position.unrealizedPnL)}
                  </span>
                  {currentPnLPercentage !== null && currentPnLPercentage !== undefined && (
                    <span
                      className={`text-sm ml-2 ${getPnLColorClass(position.unrealizedPnL)}`}
                    >
                      ({formatPnLPercentage(currentPnLPercentage)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {isClosed && position.realizedPnL !== null && position.realizedPnL !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Realized P&L:</span>
                <div className="text-right">
                  <span className={`text-lg font-bold ${getPnLColorClass(position.realizedPnL)}`}>
                    ${formatPnL(position.realizedPnL)}
                  </span>
                  {position.pnlPercentage !== null && position.pnlPercentage !== undefined && (
                    <span
                      className={`text-sm ml-2 ${getPnLColorClass(position.realizedPnL)}`}
                    >
                      ({formatPnLPercentage(position.pnlPercentage)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fees */}
        {position.totalFees !== null && position.totalFees !== undefined && position.totalFees > 0 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Total Fees:</span>
            <span>${position.totalFees.toFixed(2)}</span>
          </div>
        )}

        {/* Note */}
        {position.note && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-600 italic">"{position.note}"</p>
          </div>
        )}

        {/* Tags */}
        {position.tags && position.tags.length > 0 && (
          <div className="pt-2 flex flex-wrap gap-1">
            {position.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="p-4 pt-0">
          {isOpen && (
            <div className="flex gap-2">
              {onUpdate && (
                <button
                  onClick={() => onUpdate(position)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-semibold text-sm"
                >
                  Update SL/TP
                </button>
              )}
              {onClose && (
                <button
                  onClick={() => onClose(position)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-semibold text-sm"
                >
                  Close Position
                </button>
              )}
            </div>
          )}

          {isClosed && onViewDetails && (
            <button
              onClick={() => onViewDetails(position)}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-semibold text-sm"
            >
              View Details
            </button>
          )}
        </div>
      )}
    </div>
  );
}
