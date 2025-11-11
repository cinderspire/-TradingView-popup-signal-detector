'use client';

import React from 'react';
import {
  Signal,
  SIGNAL_TYPE_COLORS,
  SIGNAL_DIRECTION_COLORS,
  SIGNAL_STATUS_COLORS,
  calculatePotentialPnL,
  getSignalAge,
  isSignalProfitable,
} from '@/types/signal';

interface SignalCardProps {
  signal: Signal;
  onExecute?: (signal: Signal) => void;
  onViewDetails?: (signal: Signal) => void;
  showActions?: boolean;
  isProvider?: boolean;
}

export function SignalCard({
  signal,
  onExecute,
  onViewDetails,
  showActions = true,
  isProvider = false,
}: SignalCardProps) {
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getPotentialProfit = () => {
    if (!signal.takeProfit) return null;
    return calculatePotentialPnL(signal.entryPrice, signal.takeProfit, signal.direction);
  };

  const getPotentialLoss = () => {
    return calculatePotentialPnL(signal.entryPrice, signal.stopLoss, signal.direction);
  };

  const isActive = signal.status === 'ACTIVE' || signal.status === 'PENDING';
  const isExecuted = signal.status === 'EXECUTED';
  const profitable = signal.profitLoss ? isSignalProfitable(signal) : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900">{signal.symbol}</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SIGNAL_DIRECTION_COLORS[signal.direction]}`}
              >
                {signal.direction}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {signal.strategyName} • {signal.providerUsername}
            </p>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${SIGNAL_TYPE_COLORS[signal.type]}`}>
              {signal.type}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${SIGNAL_STATUS_COLORS[signal.status]}`}>
              {signal.status}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500">{getSignalAge(signal.createdAt)}</p>
      </div>

      {/* Price Levels */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Entry Price:</span>
          <span className="text-sm font-bold text-gray-900">{formatPrice(signal.entryPrice)}</span>
        </div>

        {signal.currentPrice && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Current Price:</span>
            <span className="text-sm font-bold text-blue-600">{formatPrice(signal.currentPrice)}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Stop Loss:</span>
          <div className="text-right">
            <span className="text-sm font-bold text-red-600">{formatPrice(signal.stopLoss)}</span>
            <span className="text-xs text-red-500 ml-2">
              ({formatPercent(getPotentialLoss())})
            </span>
          </div>
        </div>

        {signal.takeProfit && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Take Profit:</span>
            <div className="text-right">
              <span className="text-sm font-bold text-green-600">{formatPrice(signal.takeProfit)}</span>
              {getPotentialProfit() && (
                <span className="text-xs text-green-500 ml-2">
                  ({formatPercent(getPotentialProfit()!)})
                </span>
              )}
            </div>
          </div>
        )}

        {signal.riskRewardRatio && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-600">Risk/Reward:</span>
            <span className="text-sm font-bold text-blue-600">1:{signal.riskRewardRatio.toFixed(2)}</span>
          </div>
        )}

        {signal.confidenceLevel && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Confidence:</span>
            <div className="flex items-center space-x-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    signal.confidenceLevel >= 70
                      ? 'bg-green-500'
                      : signal.confidenceLevel >= 50
                      ? 'bg-yellow-500'
                      : 'bg-orange-500'
                  }`}
                  style={{ width: `${signal.confidenceLevel}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-700">{signal.confidenceLevel}%</span>
            </div>
          </div>
        )}

        {isExecuted && signal.profitLoss !== null && signal.profitLoss !== undefined && (
          <div className="pt-3 border-t-2 border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Result:</span>
              <span
                className={`text-lg font-bold ${
                  profitable ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatPercent(signal.profitLoss)}
              </span>
            </div>
          </div>
        )}

        {signal.note && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-600 italic">"{signal.note}"</p>
          </div>
        )}
      </div>

      {showActions && isActive && !isProvider && (
        <div className="p-4 pt-0 flex gap-2">
          <button
            onClick={() => onExecute?.(signal)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold text-sm"
          >
            Execute Trade
          </button>
          <button
            onClick={() => onViewDetails?.(signal)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-semibold text-sm"
          >
            Details
          </button>
        </div>
      )}

      {showActions && (!isActive || isProvider) && (
        <div className="p-4 pt-0">
          <button
            onClick={() => onViewDetails?.(signal)}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-semibold text-sm"
          >
            View Details
          </button>
        </div>
      )}

      <div className="px-4 pb-3">
        <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
          {signal.timeframe}
        </span>
      </div>
    </div>
  );
}
