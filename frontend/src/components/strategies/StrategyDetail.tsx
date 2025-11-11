'use client';

import React from 'react';
import { Strategy, STRATEGY_STATUS_COLORS } from '@/types/strategy';

interface StrategyDetailProps {
  strategy: Strategy;
  isSubscribed?: boolean;
  onClose: () => void;
  onSubscribe?: (strategy: Strategy) => void;
  onUnsubscribe?: (strategy: Strategy) => void;
  isProvider?: boolean;
}

export function StrategyDetail({
  strategy,
  isSubscribed = false,
  onClose,
  onSubscribe,
  onUnsubscribe,
  isProvider = false,
}: StrategyDetailProps) {
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between z-10">
              <div className="flex-1 pr-4">
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {strategy.name}
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STRATEGY_STATUS_COLORS[strategy.status]}`}>
                    {strategy.status}
                  </span>
                </div>
                <p className="text-gray-600">by {strategy.providerUsername}</p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Description
                </h3>
                <p className="text-gray-700">{strategy.description}</p>
              </div>

              {/* Trading Information */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Trading Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">
                      Trading Pairs
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {strategy.tradingPairs.map((pair, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                        >
                          {pair}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">
                      Timeframes
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {strategy.timeframes.map((timeframe, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-medium"
                        >
                          {timeframe}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Performance Metrics
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
                    <p className="text-sm font-medium text-green-900 mb-1">
                      Win Rate
                    </p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatPercent(strategy.winRate)}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {strategy.successfulSignals} / {strategy.totalSignals} signals
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      Total Return
                    </p>
                    <p className="text-2xl font-bold text-blue-700">
                      {formatPercent(strategy.totalReturn)}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Avg: {formatPercent(strategy.averageReturn)} per trade
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg">
                    <p className="text-sm font-medium text-red-900 mb-1">
                      Max Drawdown
                    </p>
                    <p className="text-2xl font-bold text-red-700">
                      {formatPercent(strategy.maxDrawdown)}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      Risk metric
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      Sharpe Ratio
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      {formatNumber(strategy.sharpeRatio)}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      Profit Factor
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      {formatNumber(strategy.profitFactor)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subscription Info */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Subscription Information
                </h3>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Price
                      </p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatPrice(strategy.subscriptionPrice)}
                        <span className="text-sm font-normal text-gray-600">/month</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Subscribers
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {strategy.subscriberCount}
                        {strategy.maxSubscribers && (
                          <span className="text-sm font-normal text-gray-600">
                            / {strategy.maxSubscribers}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Total Signals
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {strategy.totalSignals}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Additional Details
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Created</p>
                    <p className="font-semibold text-gray-900">
                      {formatDate(strategy.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Last Signal</p>
                    <p className="font-semibold text-gray-900">
                      {formatDate(strategy.lastSignalAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Visibility</p>
                    <p className="font-semibold text-gray-900">
                      {strategy.isPublic ? 'Public' : 'Private'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Status</p>
                    <p className="font-semibold text-gray-900">
                      {strategy.status}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            {!isProvider && (
              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
                >
                  Close
                </button>
                {isSubscribed ? (
                  <button
                    onClick={() => {
                      onUnsubscribe?.(strategy);
                      onClose();
                    }}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                  >
                    Unsubscribe
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onSubscribe?.(strategy);
                      onClose();
                    }}
                    disabled={strategy.status !== 'ACTIVE'}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Subscribe for {formatPrice(strategy.subscriptionPrice)}/mo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
