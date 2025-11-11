'use client';

import React from 'react';
import { Strategy, STRATEGY_STATUS_COLORS } from '@/types/strategy';

interface StrategyCardProps {
  strategy: Strategy;
  isSubscribed?: boolean;
  onSubscribe?: (strategy: Strategy) => void;
  onUnsubscribe?: (strategy: Strategy) => void;
  onViewDetails?: (strategy: Strategy) => void;
  onEdit?: (strategy: Strategy) => void;
  onDelete?: (strategy: Strategy) => void;
  onStartTrial?: (strategy: Strategy) => void;
  showActions?: boolean;
  isProvider?: boolean;
  trialDays?: number;
}

export function StrategyCard({
  strategy,
  isSubscribed = false,
  onSubscribe,
  onUnsubscribe,
  onViewDetails,
  onEdit,
  onDelete,
  onStartTrial,
  showActions = true,
  isProvider = false,
  trialDays = 14,
}: StrategyCardProps) {
  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(2);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 70) return 'text-green-600';
    if (winRate >= 50) return 'text-blue-600';
    if (winRate >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getReturnColor = (totalReturn: number) => {
    if (totalReturn >= 0) return 'text-green-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900">
                {strategy.name}
              </h3>
              {!isSubscribed && trialDays > 0 && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-xs font-bold">
                  🎁 {trialDays}d FREE
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              by {strategy.providerUsername}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STRATEGY_STATUS_COLORS[strategy.status]}`}>
            {strategy.status}
          </span>
        </div>

        <p className="text-sm text-gray-700 line-clamp-2 mb-4">
          {strategy.description}
        </p>

        {/* Trading Info */}
        <div className="flex flex-wrap gap-2 mb-4">
          {strategy.tradingPairs.slice(0, 3).map((pair, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium"
            >
              {pair}
            </span>
          ))}
          {strategy.tradingPairs.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
              +{strategy.tradingPairs.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="px-6 pb-4">
        {/* Real Performance Badge */}
        {strategy.performanceStats && strategy.performanceStats.totalTrades > 0 && (
          <div className="mb-3">
            <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
              ✓ Real Performance Data
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-600 mb-1">
              Win Rate
              {strategy.performanceStats && strategy.performanceStats.totalTrades > 0 && (
                <span className="ml-1 text-green-600">●</span>
              )}
            </p>
            <p className={`text-lg font-bold ${getWinRateColor(
              strategy.performanceStats && strategy.performanceStats.totalTrades > 0
                ? strategy.performanceStats.winRate
                : strategy.winRate
            )}`}>
              {strategy.performanceStats && strategy.performanceStats.totalTrades > 0 ? (
                <>
                  {formatPercent(strategy.performanceStats.winRate)}
                  <span className="text-xs text-gray-500 ml-1">
                    ({strategy.performanceStats.winningTrades}/{strategy.performanceStats.totalTrades})
                  </span>
                </>
              ) : (
                formatPercent(strategy.winRate)
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">
              Avg P/L
              {strategy.performanceStats && strategy.performanceStats.totalTrades > 0 && (
                <span className="ml-1 text-green-600">●</span>
              )}
            </p>
            <p className={`text-lg font-bold ${
              strategy.performanceStats && strategy.performanceStats.totalTrades > 0
                ? getReturnColor(parseFloat(strategy.performanceStats.avgPnl))
                : getReturnColor(strategy.averageReturn || 0)
            }`}>
              {strategy.performanceStats && strategy.performanceStats.totalTrades > 0 ? (
                `$${strategy.performanceStats.avgPnl}`
              ) : (
                formatPercent(strategy.averageReturn)
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">
              Total Trades
              {strategy.performanceStats && (
                <span className="ml-1 text-green-600">●</span>
              )}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {strategy.performanceStats ? strategy.performanceStats.totalTrades : strategy.successfulSignals}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">
              Total P/L
              {strategy.performanceStats && strategy.performanceStats.totalTrades > 0 && (
                <span className="ml-1 text-green-600">●</span>
              )}
            </p>
            <p className={`text-sm font-semibold ${
              strategy.performanceStats && strategy.performanceStats.totalTrades > 0
                ? getReturnColor(parseFloat(strategy.performanceStats.totalPnl))
                : 'text-gray-900'
            }`}>
              {strategy.performanceStats && strategy.performanceStats.totalTrades > 0 ? (
                `$${strategy.performanceStats.totalPnl}`
              ) : (
                formatPercent(strategy.maxDrawdown)
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 pb-4 grid grid-cols-3 gap-2 text-center border-t border-gray-100 pt-4">
        <div>
          <p className="text-xs text-gray-600 mb-1">
            Signals
            {strategy.performanceStats && (
              <span className="ml-1 text-green-600">●</span>
            )}
          </p>
          <p className="text-sm font-semibold text-gray-900">
            {strategy.performanceStats ? strategy.performanceStats.totalSignals : strategy.totalSignals}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">
            Subscribers
            {strategy.performanceStats && (
              <span className="ml-1 text-green-600">●</span>
            )}
          </p>
          <p className="text-sm font-semibold text-gray-900">
            {strategy.performanceStats ? strategy.performanceStats.totalSubscribers : strategy.subscriberCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Price</p>
          <div className="flex flex-col">
            <p className="text-sm font-semibold text-blue-600">{formatPrice(strategy.subscriptionPrice)}/mo</p>
            {!isSubscribed && trialDays > 0 && (
              <p className="text-xs text-green-600 font-semibold">{trialDays}d free trial</p>
            )}
          </div>
        </div>
      </div>

      {/* Start Date */}
      <div className="px-6 pb-4 border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">
            Started: <span className="font-semibold text-gray-900">{new Date(strategy.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </span>
          {strategy.lastSignalAt && (
            <span className="text-gray-600">
              Last Signal: <span className="font-semibold text-gray-900">{new Date(strategy.lastSignalAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="p-6 pt-0 flex flex-col gap-2">
          {!isProvider && (
            <>
              {isSubscribed ? (
                <button
                  onClick={() => onUnsubscribe?.(strategy)}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-semibold text-sm"
                >
                  Unsubscribe
                </button>
              ) : (
                <>
                  {trialDays > 0 && onStartTrial && (
                    <button
                      onClick={() => onStartTrial(strategy)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-md hover:from-green-700 hover:to-blue-700 transition-all transform hover:scale-[1.02] font-bold text-sm shadow-lg"
                      disabled={strategy.status !== 'ACTIVE'}
                    >
                      🎁 Start {trialDays}-Day Free Trial
                    </button>
                  )}
                  <button
                    onClick={() => onSubscribe?.(strategy)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold text-sm"
                    disabled={strategy.status !== 'ACTIVE'}
                  >
                    {trialDays > 0 ? 'Skip Trial & Subscribe Now' : 'Subscribe Now'}
                  </button>
                </>
              )}
            </>
          )}

          {isProvider && (
            <div className="flex gap-2">
              <button
                onClick={() => onEdit?.(strategy)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete?.(strategy)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-semibold text-sm"
              >
                Delete
              </button>
            </div>
          )}

          <button
            onClick={() => onViewDetails?.(strategy)}
            className="w-full px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-semibold text-sm"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
}
