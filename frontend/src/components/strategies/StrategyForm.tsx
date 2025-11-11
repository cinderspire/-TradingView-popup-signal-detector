'use client';

import React, { useState, useEffect } from 'react';
import { Strategy, CreateStrategyRequest, UpdateStrategyRequest, COMMON_TRADING_PAIRS, COMMON_TIMEFRAMES, TradingPair, Timeframe, StrategyStatus } from '@/types/strategy';
import { strategyApi } from '@/lib/strategy-api';

interface StrategyFormProps {
  strategy?: Strategy; // If provided, edit mode; otherwise, create mode
  onSuccess?: (strategy: Strategy) => void;
  onCancel?: () => void;
}

export function StrategyForm({ strategy, onSuccess, onCancel }: StrategyFormProps) {
  const isEditMode = !!strategy;

  // Form state
  const [name, setName] = useState(strategy?.name || '');
  const [description, setDescription] = useState(strategy?.description || '');
  const [tradingPairs, setTradingPairs] = useState<TradingPair[]>(strategy?.tradingPairs || []);
  const [timeframes, setTimeframes] = useState<Timeframe[]>(strategy?.timeframes || []);
  const [isPublic, setIsPublic] = useState(strategy?.isPublic ?? true);
  const [subscriptionPrice, setSubscriptionPrice] = useState(strategy?.subscriptionPrice || 0);
  const [maxSubscribers, setMaxSubscribers] = useState<number | null>(strategy?.maxSubscribers || null);
  const [status, setStatus] = useState<StrategyStatus>(strategy?.status || 'DRAFT');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Custom trading pair input
  const [customPair, setCustomPair] = useState('');
  const [customTimeframe, setCustomTimeframe] = useState('');

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Strategy name is required';
    } else if (name.length < 3) {
      newErrors.name = 'Strategy name must be at least 3 characters';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    } else if (description.length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }

    if (tradingPairs.length === 0) {
      newErrors.tradingPairs = 'Select at least one trading pair';
    }

    if (timeframes.length === 0) {
      newErrors.timeframes = 'Select at least one timeframe';
    }

    if (subscriptionPrice < 0) {
      newErrors.subscriptionPrice = 'Price cannot be negative';
    } else if (subscriptionPrice > 10000) {
      newErrors.subscriptionPrice = 'Price cannot exceed $10,000/month';
    }

    if (maxSubscribers !== null && maxSubscribers < 0) {
      newErrors.maxSubscribers = 'Max subscribers cannot be negative';
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
      const data: CreateStrategyRequest | UpdateStrategyRequest = {
        name,
        description,
        tradingPairs,
        timeframes,
        isPublic,
        subscriptionPrice,
        maxSubscribers: maxSubscribers || undefined,
      };

      let response;
      if (isEditMode && strategy) {
        response = await strategyApi.updateStrategy(strategy.id, { ...data, status });
      } else {
        response = await strategyApi.createStrategy(data as CreateStrategyRequest);
      }

      if (response.success) {
        onSuccess?.(response.data.strategy);
      } else {
        setError(response.message || 'Failed to save strategy');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleTradingPair = (pair: TradingPair) => {
    if (tradingPairs.includes(pair)) {
      setTradingPairs(tradingPairs.filter((p) => p !== pair));
    } else {
      setTradingPairs([...tradingPairs, pair]);
    }
  };

  const toggleTimeframe = (timeframe: Timeframe) => {
    if (timeframes.includes(timeframe)) {
      setTimeframes(timeframes.filter((t) => t !== timeframe));
    } else {
      setTimeframes([...timeframes, timeframe]);
    }
  };

  const addCustomPair = () => {
    if (customPair && !tradingPairs.includes(customPair as TradingPair)) {
      setTradingPairs([...tradingPairs, customPair as TradingPair]);
      setCustomPair('');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isEditMode ? 'Edit Strategy' : 'Create New Strategy'}
        </h2>
        <p className="text-gray-600">
          {isEditMode
            ? 'Update your strategy details and settings'
            : 'Create a new trading strategy to share with subscribers'}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-semibold">❌ Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Strategy Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Strategy Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., Bitcoin Swing Trading Strategy"
          />
          {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.description ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Describe your trading strategy, methodology, and expected outcomes..."
          />
          {errors.description && (
            <p className="text-red-600 text-sm mt-1">{errors.description}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            {description.length} characters (minimum 20)
          </p>
        </div>

        {/* Trading Pairs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Trading Pairs * ({tradingPairs.length} selected)
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {COMMON_TRADING_PAIRS.map((pair) => (
              <button
                key={pair}
                type="button"
                onClick={() => toggleTradingPair(pair)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tradingPairs.includes(pair)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {pair}
              </button>
            ))}
          </div>

          {/* Custom Pair Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customPair}
              onChange={(e) => setCustomPair(e.target.value.toUpperCase())}
              placeholder="Add custom pair (e.g., LINK/USDT)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addCustomPair}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
            >
              Add
            </button>
          </div>

          {errors.tradingPairs && (
            <p className="text-red-600 text-sm mt-2">{errors.tradingPairs}</p>
          )}

          {tradingPairs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <p className="text-sm text-gray-600 w-full">Selected:</p>
              {tradingPairs.map((pair) => (
                <span
                  key={pair}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  <span>{pair}</span>
                  <button
                    type="button"
                    onClick={() => toggleTradingPair(pair)}
                    className="text-blue-600 hover:text-blue-800 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Timeframes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timeframes * ({timeframes.length} selected)
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => toggleTimeframe(tf)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeframes.includes(tf)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          {errors.timeframes && (
            <p className="text-red-600 text-sm mt-2">{errors.timeframes}</p>
          )}
        </div>

        {/* Pricing */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Subscription Price ($) *
            </label>
            <input
              type="number"
              value={subscriptionPrice}
              onChange={(e) => setSubscriptionPrice(Number(e.target.value))}
              min="0"
              max="10000"
              step="1"
              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.subscriptionPrice ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="49"
            />
            {errors.subscriptionPrice && (
              <p className="text-red-600 text-sm mt-1">{errors.subscriptionPrice}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Subscribers (optional)
            </label>
            <input
              type="number"
              value={maxSubscribers || ''}
              onChange={(e) =>
                setMaxSubscribers(e.target.value ? Number(e.target.value) : null)
              }
              min="0"
              className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.maxSubscribers ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Unlimited"
            />
            {errors.maxSubscribers && (
              <p className="text-red-600 text-sm mt-1">{errors.maxSubscribers}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              Leave empty for unlimited subscribers
            </p>
          </div>
        </div>

        {/* Visibility & Status */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visibility
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  checked={isPublic}
                  onChange={() => setIsPublic(true)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Public (visible in marketplace)
                </span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!isPublic}
                  onChange={() => setIsPublic(false)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Private (invite-only)
                </span>
              </label>
            </div>
          </div>

          {isEditMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StrategyStatus)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Saving...' : isEditMode ? 'Update Strategy' : 'Create Strategy'}
          </button>
        </div>
      </form>
    </div>
  );
}
