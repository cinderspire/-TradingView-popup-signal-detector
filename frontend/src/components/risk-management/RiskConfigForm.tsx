'use client';

import React, { useState, useEffect } from 'react';
import { RiskConfig, RiskConfigType, CreateRiskConfigRequest } from '@/types/risk-management';
import { riskManagementApi } from '@/lib/risk-management-api';

interface RiskConfigFormProps {
  config?: RiskConfig | null; // If provided, edit mode; otherwise create mode
  onSuccess?: (config: RiskConfig) => void;
  onCancel?: () => void;
}

export function RiskConfigForm({ config, onSuccess, onCancel }: RiskConfigFormProps) {
  const isEditMode = !!config;

  // Form state
  const [type, setType] = useState<RiskConfigType>(config?.type || 'FIXED');
  const [name, setName] = useState(config?.name || '');
  const [description, setDescription] = useState(config?.description || '');

  // Fixed risk fields
  const [riskPerTrade, setRiskPerTrade] = useState(config?.riskPerTrade || 1.0);
  const [maxPositionSize, setMaxPositionSize] = useState(config?.maxPositionSize || 10.0);
  const [maxDailyLoss, setMaxDailyLoss] = useState(config?.maxDailyLoss || 3.0);
  const [maxDrawdown, setMaxDrawdown] = useState(config?.maxDrawdown || 10.0);

  // Adaptive risk fields
  const [baseRiskPercent, setBaseRiskPercent] = useState(config?.baseRiskPercent || 2.0);
  const [winStreakMultiplier, setWinStreakMultiplier] = useState(config?.winStreakMultiplier || 1.25);
  const [lossStreakDivisor, setLossStreakDivisor] = useState(config?.lossStreakDivisor || 2.0);
  const [maxAdaptiveRisk, setMaxAdaptiveRisk] = useState(config?.maxAdaptiveRisk || 4.0);
  const [minAdaptiveRisk, setMinAdaptiveRisk] = useState(config?.minAdaptiveRisk || 0.5);

  // News-based fields
  const [newsBasedEnabled, setNewsBasedEnabled] = useState<boolean>(config?.newsBasedEnabled ?? true);
  const [reduceRiskBeforeNews, setReduceRiskBeforeNews] = useState<boolean>(config?.reduceRiskBeforeNews ?? true);
  const [newsRiskReduction, setNewsRiskReduction] = useState(config?.newsRiskReduction || 50.0);
  const [newsSafetyWindow, setNewsSafetyWindow] = useState(config?.newsSafetyWindow || 60);

  // Common fields
  const [useStopLoss, setUseStopLoss] = useState(config?.useStopLoss ?? true);
  const [stopLossPercent, setStopLossPercent] = useState(config?.stopLossPercent || 2.0);
  const [useTakeProfit, setUseTakeProfit] = useState(config?.useTakeProfit ?? true);
  const [takeProfitPercent, setTakeProfitPercent] = useState(config?.takeProfitPercent || 3.0);
  const [riskRewardRatio, setRiskRewardRatio] = useState(config?.riskRewardRatio || 1.5);
  const [maxOpenPositions, setMaxOpenPositions] = useState(config?.maxOpenPositions || 5);
  const [maxLeverage, setMaxLeverage] = useState(config?.maxLeverage || 10.0);
  const [isDefault, setIsDefault] = useState(config?.isDefault || false);

  // Form state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Configuration name is required';
    }

    if (type === 'FIXED') {
      if (riskPerTrade <= 0 || riskPerTrade > 100) {
        newErrors.riskPerTrade = 'Risk per trade must be between 0 and 100%';
      }
    }

    if (type === 'ADAPTIVE') {
      if (baseRiskPercent <= 0 || baseRiskPercent > 100) {
        newErrors.baseRiskPercent = 'Base risk must be between 0 and 100%';
      }
      if (winStreakMultiplier <= 1) {
        newErrors.winStreakMultiplier = 'Win streak multiplier must be greater than 1';
      }
      if (lossStreakDivisor <= 1) {
        newErrors.lossStreakDivisor = 'Loss streak divisor must be greater than 1';
      }
      if (minAdaptiveRisk >= maxAdaptiveRisk) {
        newErrors.maxAdaptiveRisk = 'Max adaptive risk must be greater than min';
      }
    }

    if (type === 'NEWS_BASED') {
      if (newsRiskReduction < 0 || newsRiskReduction > 100) {
        newErrors.newsRiskReduction = 'News risk reduction must be between 0 and 100%';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data: CreateRiskConfigRequest = {
        name,
        description,
        type,
        isDefault,
      };

      // Add type-specific fields
      if (type === 'FIXED') {
        data.riskPerTrade = riskPerTrade;
        data.maxPositionSize = maxPositionSize;
        data.maxDailyLoss = maxDailyLoss;
        data.maxDrawdown = maxDrawdown;
      } else if (type === 'ADAPTIVE') {
        data.baseRiskPercent = baseRiskPercent;
        data.winStreakMultiplier = winStreakMultiplier;
        data.lossStreakDivisor = lossStreakDivisor;
        data.maxAdaptiveRisk = maxAdaptiveRisk;
        data.minAdaptiveRisk = minAdaptiveRisk;
      } else if (type === 'NEWS_BASED') {
        data.riskPerTrade = riskPerTrade;
        data.newsBasedEnabled = newsBasedEnabled;
        data.reduceRiskBeforeNews = reduceRiskBeforeNews;
        data.newsRiskReduction = newsRiskReduction;
        data.newsSafetyWindow = newsSafetyWindow;
      }

      // Add common fields
      data.useStopLoss = useStopLoss;
      data.stopLossPercent = stopLossPercent;
      data.useTakeProfit = useTakeProfit;
      data.takeProfitPercent = takeProfitPercent;
      data.riskRewardRatio = riskRewardRatio;
      data.maxOpenPositions = maxOpenPositions;
      data.maxLeverage = maxLeverage;

      let response;
      if (isEditMode && config) {
        response = await riskManagementApi.updateConfig(config.id, data);
      } else {
        response = await riskManagementApi.createConfig(data);
      }

      if (response.success) {
        onSuccess?.(response.data.config);
      } else {
        setError('Failed to save configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {isEditMode ? '✏️ Edit Configuration' : '➕ Create New Configuration'}
      </h2>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-semibold">❌ Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
            Basic Information
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Configuration Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Conservative Fixed Risk"
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Brief description of this configuration..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as RiskConfigType)}
              disabled={isEditMode} // Can't change type in edit mode
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="FIXED">📊 FIXED - Static percentage risk</option>
              <option value="ADAPTIVE">🎯 ADAPTIVE - Performance-based adjustment</option>
              <option value="NEWS_BASED">📰 NEWS_BASED - Event-driven reduction</option>
            </select>
            {isEditMode && (
              <p className="text-sm text-gray-500 mt-1">
                ℹ️ Risk type cannot be changed after creation
              </p>
            )}
          </div>
        </div>

        {/* Type-Specific Fields */}
        {type === 'FIXED' && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900">
              📊 Fixed Risk Settings
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Risk Per Trade (%) *
                </label>
                <input
                  type="number"
                  value={riskPerTrade}
                  onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.riskPerTrade ? 'border-red-500' : 'border-gray-300'
                  }`}
                  step="0.1"
                  min="0.1"
                  max="100"
                />
                {errors.riskPerTrade && (
                  <p className="text-red-600 text-sm mt-1">{errors.riskPerTrade}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Position Size (%)
                </label>
                <input
                  type="number"
                  value={maxPositionSize}
                  onChange={(e) => setMaxPositionSize(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                  min="0.1"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Daily Loss (%)
                </label>
                <input
                  type="number"
                  value={maxDailyLoss}
                  onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                  min="0.1"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Drawdown (%)
                </label>
                <input
                  type="number"
                  value={maxDrawdown}
                  onChange={(e) => setMaxDrawdown(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                  min="0.1"
                  max="100"
                />
              </div>
            </div>
          </div>
        )}

        {type === 'ADAPTIVE' && (
          <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="text-lg font-semibold text-purple-900">
              🎯 Adaptive Risk Settings
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Risk (%) *
                </label>
                <input
                  type="number"
                  value={baseRiskPercent}
                  onChange={(e) => setBaseRiskPercent(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.baseRiskPercent ? 'border-red-500' : 'border-gray-300'
                  }`}
                  step="0.1"
                  min="0.1"
                  max="100"
                />
                {errors.baseRiskPercent && (
                  <p className="text-red-600 text-sm mt-1">{errors.baseRiskPercent}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Win Streak Multiplier *
                </label>
                <input
                  type="number"
                  value={winStreakMultiplier}
                  onChange={(e) => setWinStreakMultiplier(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.winStreakMultiplier ? 'border-red-500' : 'border-gray-300'
                  }`}
                  step="0.05"
                  min="1.01"
                  max="3.0"
                />
                {errors.winStreakMultiplier && (
                  <p className="text-red-600 text-sm mt-1">{errors.winStreakMultiplier}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Risk increases by this factor per win</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loss Streak Divisor *
                </label>
                <input
                  type="number"
                  value={lossStreakDivisor}
                  onChange={(e) => setLossStreakDivisor(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.lossStreakDivisor ? 'border-red-500' : 'border-gray-300'
                  }`}
                  step="0.1"
                  min="1.01"
                  max="5.0"
                />
                {errors.lossStreakDivisor && (
                  <p className="text-red-600 text-sm mt-1">{errors.lossStreakDivisor}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Risk decreases by this factor per loss</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Adaptive Risk (%)
                </label>
                <input
                  type="number"
                  value={maxAdaptiveRisk}
                  onChange={(e) => setMaxAdaptiveRisk(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.maxAdaptiveRisk ? 'border-red-500' : 'border-gray-300'
                  }`}
                  step="0.1"
                  min="0.1"
                  max="100"
                />
                {errors.maxAdaptiveRisk && (
                  <p className="text-red-600 text-sm mt-1">{errors.maxAdaptiveRisk}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Adaptive Risk (%)
                </label>
                <input
                  type="number"
                  value={minAdaptiveRisk}
                  onChange={(e) => setMinAdaptiveRisk(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  step="0.1"
                  min="0.1"
                  max="100"
                />
              </div>
            </div>
          </div>
        )}

        {type === 'NEWS_BASED' && (
          <div className="space-y-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h3 className="text-lg font-semibold text-orange-900">
              📰 News-Based Risk Settings
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Risk Per Trade (%) *
                </label>
                <input
                  type="number"
                  value={riskPerTrade}
                  onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  step="0.1"
                  min="0.1"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  News Risk Reduction (%) *
                </label>
                <input
                  type="number"
                  value={newsRiskReduction}
                  onChange={(e) => setNewsRiskReduction(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    errors.newsRiskReduction ? 'border-red-500' : 'border-gray-300'
                  }`}
                  step="5"
                  min="0"
                  max="100"
                />
                {errors.newsRiskReduction && (
                  <p className="text-red-600 text-sm mt-1">{errors.newsRiskReduction}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">% to reduce position size before news</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Safety Window (minutes)
                </label>
                <input
                  type="number"
                  value={newsSafetyWindow}
                  onChange={(e) => setNewsSafetyWindow(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  step="15"
                  min="15"
                  max="240"
                />
                <p className="text-xs text-gray-500 mt-1">Avoid trading X minutes before/after news</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newsBasedEnabled}
                  onChange={(e) => setNewsBasedEnabled(e.target.checked)}
                  className="rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Enable news-based risk adjustment
                </span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={reduceRiskBeforeNews}
                  onChange={(e) => setReduceRiskBeforeNews(e.target.checked)}
                  className="rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Reduce risk before high-impact news events
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Common Settings */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            ⚙️ Stop Loss & Take Profit
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  checked={useStopLoss}
                  onChange={(e) => setUseStopLoss(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Use Stop Loss</span>
              </label>
              {useStopLoss && (
                <input
                  type="number"
                  value={stopLossPercent}
                  onChange={(e) => setStopLossPercent(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                  min="0.1"
                  max="100"
                  placeholder="Stop Loss %"
                />
              )}
            </div>

            <div>
              <label className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  checked={useTakeProfit}
                  onChange={(e) => setUseTakeProfit(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Use Take Profit</span>
              </label>
              {useTakeProfit && (
                <input
                  type="number"
                  value={takeProfitPercent}
                  onChange={(e) => setTakeProfitPercent(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                  min="0.1"
                  max="1000"
                  placeholder="Take Profit %"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Risk/Reward Ratio
              </label>
              <input
                type="number"
                value={riskRewardRatio}
                onChange={(e) => setRiskRewardRatio(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                step="0.1"
                min="1.0"
                max="10.0"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum acceptable R:R (e.g., 1.5:1)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Open Positions
              </label>
              <input
                type="number"
                value={maxOpenPositions}
                onChange={(e) => setMaxOpenPositions(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                step="1"
                min="1"
                max="50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Leverage
              </label>
              <input
                type="number"
                value={maxLeverage}
                onChange={(e) => setMaxLeverage(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                step="1"
                min="1"
                max="125"
              />
            </div>
          </div>
        </div>

        {/* Default Setting */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm font-medium text-gray-700">
            ⭐ Set as default configuration
          </span>
          <span className="text-xs text-gray-500">
            (Will unset other defaults)
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4 border-t">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Saving...' : isEditMode ? '💾 Update Configuration' : '➕ Create Configuration'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              ✖️ Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
