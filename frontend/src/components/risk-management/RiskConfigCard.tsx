'use client';

import React from 'react';
import { RiskConfig } from '@/types/risk-management';

interface RiskConfigCardProps {
  config: RiskConfig;
  onEdit?: (config: RiskConfig) => void;
  onDelete?: (id: string) => void;
  onSetDefault?: (id: string) => void;
  onToggleActive?: (id: string, isActive: boolean) => void;
}

export function RiskConfigCard({
  config,
  onEdit,
  onDelete,
  onSetDefault,
  onToggleActive,
}: RiskConfigCardProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'FIXED':
        return 'bg-blue-100 text-blue-800';
      case 'ADAPTIVE':
        return 'bg-purple-100 text-purple-800';
      case 'NEWS_BASED':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'FIXED':
        return '📊';
      case 'ADAPTIVE':
        return '🎯';
      case 'NEWS_BASED':
        return '📰';
      default:
        return '⚙️';
    }
  };

  const formatPercent = (value?: number) => {
    return value !== undefined ? `${value}%` : 'N/A';
  };

  const renderFixedDetails = () => (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <span className="text-gray-600">Risk Per Trade:</span>
        <span className="ml-2 font-semibold">{formatPercent(config.riskPerTrade)}</span>
      </div>
      <div>
        <span className="text-gray-600">Max Position:</span>
        <span className="ml-2 font-semibold">{formatPercent(config.maxPositionSize)}</span>
      </div>
      <div>
        <span className="text-gray-600">Max Daily Loss:</span>
        <span className="ml-2 font-semibold">{formatPercent(config.maxDailyLoss)}</span>
      </div>
      <div>
        <span className="text-gray-600">Max Drawdown:</span>
        <span className="ml-2 font-semibold">{formatPercent(config.maxDrawdown)}</span>
      </div>
    </div>
  );

  const renderAdaptiveDetails = () => (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <span className="text-gray-600">Base Risk:</span>
        <span className="ml-2 font-semibold">{formatPercent(config.baseRiskPercent)}</span>
      </div>
      <div>
        <span className="text-gray-600">Win Multiplier:</span>
        <span className="ml-2 font-semibold">{config.winStreakMultiplier}x</span>
      </div>
      <div>
        <span className="text-gray-600">Loss Divisor:</span>
        <span className="ml-2 font-semibold">{config.lossStreakDivisor}x</span>
      </div>
      <div>
        <span className="text-gray-600">Risk Range:</span>
        <span className="ml-2 font-semibold">
          {formatPercent(config.minAdaptiveRisk)} - {formatPercent(config.maxAdaptiveRisk)}
        </span>
      </div>
    </div>
  );

  const renderNewsBasedDetails = () => (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <span className="text-gray-600">Risk Reduction:</span>
        <span className="ml-2 font-semibold">{formatPercent(config.newsRiskReduction)}</span>
      </div>
      <div>
        <span className="text-gray-600">Safety Window:</span>
        <span className="ml-2 font-semibold">{config.newsSafetyWindow} min</span>
      </div>
      <div>
        <span className="text-gray-600">Enabled:</span>
        <span className="ml-2 font-semibold">
          {config.newsBasedEnabled ? '✅ Yes' : '❌ No'}
        </span>
      </div>
      <div>
        <span className="text-gray-600">Reduce Before News:</span>
        <span className="ml-2 font-semibold">
          {config.reduceRiskBeforeNews ? '✅ Yes' : '❌ No'}
        </span>
      </div>
    </div>
  );

  const renderCommonDetails = () => (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-600">Stop Loss:</span>
          <span className="ml-2 font-semibold">
            {config.useStopLoss ? formatPercent(config.stopLossPercent) : 'Disabled'}
          </span>
        </div>
        <div>
          <span className="text-gray-600">Take Profit:</span>
          <span className="ml-2 font-semibold">
            {config.useTakeProfit ? formatPercent(config.takeProfitPercent) : 'Disabled'}
          </span>
        </div>
        <div>
          <span className="text-gray-600">Risk/Reward:</span>
          <span className="ml-2 font-semibold">{config.riskRewardRatio}:1</span>
        </div>
        <div>
          <span className="text-gray-600">Max Positions:</span>
          <span className="ml-2 font-semibold">{config.maxOpenPositions || 'Unlimited'}</span>
        </div>
      </div>
    </div>
  );

  const renderStats = () => {
    if (!config.totalTradesWithConfig) return null;

    const winRate =
      config.totalTradesWithConfig > 0
        ? ((config.successfulTrades || 0) / config.totalTradesWithConfig) * 100
        : 0;

    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Performance Statistics</h4>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-gray-600">Total Trades:</span>
            <span className="ml-2 font-semibold">{config.totalTradesWithConfig}</span>
          </div>
          <div>
            <span className="text-gray-600">Win Rate:</span>
            <span className="ml-2 font-semibold">{winRate.toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-gray-600">Avg Return:</span>
            <span className="ml-2 font-semibold">
              {config.avgReturn ? `${config.avgReturn.toFixed(2)}%` : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{getTypeIcon(config.type)}</span>
            <h3 className="text-lg font-bold text-gray-900">{config.name}</h3>
          </div>
          {config.description && (
            <p className="text-sm text-gray-600">{config.description}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(
              config.type
            )}`}
          >
            {config.type}
          </span>
          {config.isDefault && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              ⭐ DEFAULT
            </span>
          )}
          {!config.isActive && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
              ⏸️ INACTIVE
            </span>
          )}
        </div>
      </div>

      {/* Type-Specific Details */}
      <div className="mb-4">
        {config.type === 'FIXED' && renderFixedDetails()}
        {config.type === 'ADAPTIVE' && renderAdaptiveDetails()}
        {config.type === 'NEWS_BASED' && renderNewsBasedDetails()}
      </div>

      {/* Common Details */}
      {renderCommonDetails()}

      {/* Statistics */}
      {renderStats()}

      {/* Actions */}
      <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
        {onEdit && (
          <button
            onClick={() => onEdit(config)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            ✏️ Edit
          </button>
        )}

        {onSetDefault && !config.isDefault && (
          <button
            onClick={() => onSetDefault(config.id)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
          >
            ⭐ Set as Default
          </button>
        )}

        {onToggleActive && (
          <button
            onClick={() => onToggleActive(config.id, !config.isActive)}
            className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
              config.isActive
                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            {config.isActive ? '⏸️ Deactivate' : '▶️ Activate'}
          </button>
        )}

        {onDelete && (
          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete "${config.name}"?`)) {
                onDelete(config.id);
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium ml-auto"
          >
            🗑️ Delete
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
        Created: {new Date(config.createdAt).toLocaleDateString()} • Updated:{' '}
        {new Date(config.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}
