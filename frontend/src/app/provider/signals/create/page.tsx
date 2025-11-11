'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { signalApi } from '@/lib/signal-api';
import { strategyApi } from '@/lib/strategy-api';
import type {
  CreateSignalRequest,
  SignalType,
  SignalDirection
} from '@/types/signal';
import type { Strategy } from '@/types/strategy';

const COMMON_SYMBOLS = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'XRP/USDT',
  'SOL/USDT',
  'ADA/USDT',
  'DOGE/USDT',
  'MATIC/USDT',
  'DOT/USDT',
  'AVAX/USDT',
];

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

export default function CreateSignalPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Form state
  const [strategyId, setStrategyId] = useState('');
  const [type, setType] = useState<SignalType>('ENTRY');
  const [direction, setDirection] = useState<SignalDirection>('LONG');
  const [symbol, setSymbol] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('1h');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [takeProfit2, setTakeProfit2] = useState('');
  const [takeProfit3, setTakeProfit3] = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState('75');
  const [note, setNote] = useState('');
  const [expiresIn, setExpiresIn] = useState('24');

  // UI state
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load provider's strategies
  useEffect(() => {
    const loadStrategies = async () => {
      try {
        setLoadingStrategies(true);
        const response = await strategyApi.getMyStrategies();
        if (response.success) {
          // Only show ACTIVE strategies
          const activeStrategies = response.data.strategies.filter(
            (s) => s.status === 'ACTIVE'
          );
          setStrategies(activeStrategies);

          // Auto-select first strategy
          if (activeStrategies.length > 0) {
            setStrategyId(activeStrategies[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load strategies:', error);
        setMessage({
          type: 'error',
          text: 'Failed to load your strategies',
        });
      } finally {
        setLoadingStrategies(false);
      }
    };

    loadStrategies();
  }, []);

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!strategyId) {
      newErrors.strategyId = 'Please select a strategy';
    }

    const finalSymbol = symbol || customSymbol;
    if (!finalSymbol.trim()) {
      newErrors.symbol = 'Symbol is required';
    }

    if (!entryPrice || parseFloat(entryPrice) <= 0) {
      newErrors.entryPrice = 'Valid entry price is required';
    }

    if (!stopLoss || parseFloat(stopLoss) <= 0) {
      newErrors.stopLoss = 'Valid stop loss is required';
    }

    // Validate SL vs Entry based on direction
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);

    if (entry && sl) {
      if (direction === 'LONG' && sl >= entry) {
        newErrors.stopLoss = 'Stop loss must be below entry price for LONG';
      } else if (direction === 'SHORT' && sl <= entry) {
        newErrors.stopLoss = 'Stop loss must be above entry price for SHORT';
      }
    }

    // Validate TP vs Entry based on direction
    if (takeProfit) {
      const tp = parseFloat(takeProfit);
      if (tp && entry) {
        if (direction === 'LONG' && tp <= entry) {
          newErrors.takeProfit = 'Take profit must be above entry price for LONG';
        } else if (direction === 'SHORT' && tp >= entry) {
          newErrors.takeProfit = 'Take profit must be below entry price for SHORT';
        }
      }
    }

    // Validate confidence level
    const conf = parseInt(confidenceLevel);
    if (confidenceLevel && (conf < 0 || conf > 100)) {
      newErrors.confidenceLevel = 'Confidence must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      setMessage({
        type: 'error',
        text: 'Please fix the errors before submitting',
      });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);

      const finalSymbol = symbol || customSymbol;

      // Calculate expiration date
      let expiresAt: string | undefined;
      if (expiresIn && parseInt(expiresIn) > 0) {
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + parseInt(expiresIn));
        expiresAt = expirationDate.toISOString();
      }

      const data: CreateSignalRequest = {
        strategyId,
        type,
        direction,
        symbol: finalSymbol,
        timeframe,
        entryPrice: parseFloat(entryPrice),
        stopLoss: parseFloat(stopLoss),
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        takeProfit2: takeProfit2 ? parseFloat(takeProfit2) : undefined,
        takeProfit3: takeProfit3 ? parseFloat(takeProfit3) : undefined,
        note: note.trim() || undefined,
        confidenceLevel: confidenceLevel ? parseInt(confidenceLevel) : undefined,
        expiresAt,
      };

      const response = await signalApi.createSignal(data);

      if (response.success) {
        setMessage({
          type: 'success',
          text: `Signal created successfully and broadcasted to ${
            strategies.find((s) => s.id === strategyId)?.subscriberCount || 0
          } subscribers!`,
        });

        // Reset form after short delay
        setTimeout(() => {
          router.push('/signals');
        }, 2000);
      } else {
        setMessage({
          type: 'error',
          text: 'Failed to create signal. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error creating signal:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to create signal',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate risk/reward ratio
  const calculateRiskReward = (): string | null => {
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);

    if (!entry || !sl || !tp) return null;

    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);

    if (risk === 0) return null;

    const ratio = reward / risk;
    return `1:${ratio.toFixed(2)}`;
  };

  // Redirect if not provider
  if (user && user.role !== 'PROVIDER') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold text-red-900 mb-2">Access Denied</h2>
            <p className="text-red-700 mb-4">
              Only signal providers can create signals.
            </p>
            <Link
              href="/signals"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Go to Signals
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-4xl font-bold text-gray-900">
                📢 Create Trading Signal
              </h1>
              <Link
                href="/signals"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                ← Back to Signals
              </Link>
            </div>
            <p className="text-lg text-gray-600">
              Broadcast a trading signal to all your strategy subscribers
            </p>
          </div>

          {/* Success/Error Messages */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg border ${
                message.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <p>{message.text}</p>
            </div>
          )}

          {/* No Active Strategies Warning */}
          {!loadingStrategies && strategies.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-yellow-900 mb-2">
                No Active Strategies
              </h3>
              <p className="text-yellow-800 mb-4">
                You need at least one active strategy to create signals.
              </p>
              <Link
                href="/strategies"
                className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
              >
                Create a Strategy
              </Link>
            </div>
          )}

          {/* Form */}
          {strategies.length > 0 && (
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              {/* Strategy Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Strategy *
                </label>
                <select
                  value={strategyId}
                  onChange={(e) => setStrategyId(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.strategyId ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loadingStrategies}
                >
                  <option value="">Select a strategy...</option>
                  {strategies.map((strategy) => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.name} ({strategy.subscriberCount} subscribers)
                    </option>
                  ))}
                </select>
                {errors.strategyId && (
                  <p className="text-red-600 text-sm mt-1">{errors.strategyId}</p>
                )}
              </div>

              {/* Signal Type and Direction */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Signal Type *
                  </label>
                  <div className="flex gap-2">
                    {(['ENTRY', 'EXIT', 'UPDATE'] as SignalType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`flex-1 px-4 py-2 rounded-md font-semibold text-sm transition-colors ${
                          type === t
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Direction *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDirection('LONG')}
                      className={`flex-1 px-4 py-2 rounded-md font-semibold text-sm transition-colors ${
                        direction === 'LONG'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      LONG
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('SHORT')}
                      className={`flex-1 px-4 py-2 rounded-md font-semibold text-sm transition-colors ${
                        direction === 'SHORT'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      SHORT
                    </button>
                  </div>
                </div>
              </div>

              {/* Symbol Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trading Pair *
                </label>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {COMMON_SYMBOLS.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        setSymbol(sym);
                        setCustomSymbol('');
                      }}
                      className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                        symbol === sym
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={customSymbol}
                  onChange={(e) => {
                    setCustomSymbol(e.target.value);
                    setSymbol('');
                  }}
                  placeholder="Or enter custom pair (e.g., LINK/USDT)"
                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.symbol ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.symbol && (
                  <p className="text-red-600 text-sm mt-1">{errors.symbol}</p>
                )}
              </div>

              {/* Timeframe */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeframe *
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                        timeframe === tf
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Levels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entry Price *
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.entryPrice ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                  {errors.entryPrice && (
                    <p className="text-red-600 text-sm mt-1">{errors.entryPrice}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stop Loss *
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.stopLoss ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                  {errors.stopLoss && (
                    <p className="text-red-600 text-sm mt-1">{errors.stopLoss}</p>
                  )}
                </div>
              </div>

              {/* Take Profit Levels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Take Profit 1
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.takeProfit ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                  {errors.takeProfit && (
                    <p className="text-red-600 text-sm mt-1">{errors.takeProfit}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Take Profit 2 (optional)
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={takeProfit2}
                    onChange={(e) => setTakeProfit2(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Take Profit 3 (optional)
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={takeProfit3}
                    onChange={(e) => setTakeProfit3(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Risk/Reward Display */}
              {calculateRiskReward() && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">
                      Risk/Reward Ratio:
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {calculateRiskReward()}
                    </span>
                  </div>
                </div>
              )}

              {/* Confidence Level */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confidence Level (0-100)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={confidenceLevel}
                    onChange={(e) => setConfidenceLevel(e.target.value)}
                    className="flex-1"
                  />
                  <div className="w-20 text-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={confidenceLevel}
                      onChange={(e) => setConfidenceLevel(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.confidenceLevel ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <span className="font-bold text-gray-900">{confidenceLevel}%</span>
                </div>
                {errors.confidenceLevel && (
                  <p className="text-red-600 text-sm mt-1">{errors.confidenceLevel}</p>
                )}
              </div>

              {/* Note */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note / Commentary (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any additional context, analysis, or notes for subscribers..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {note.length} characters
                </p>
              </div>

              {/* Expiration */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Signal Expires In (hours)
                </label>
                <input
                  type="number"
                  min="0"
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="24"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave at 0 for no expiration
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.push('/signals')}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-semibold"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || strategies.length === 0}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Broadcasting Signal...' : '📢 Broadcast Signal'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
