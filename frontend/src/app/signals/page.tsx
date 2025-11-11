'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { SignalFeed } from '@/components/signals/SignalFeed';
import { signalApi } from '@/lib/signal-api';
import type { Signal, ExecuteSignalRequest } from '@/types/signal';

export default function SignalsPage() {
  const { user } = useAuth();
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [executionPrice, setExecutionPrice] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [executing, setExecuting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle execute signal
  const handleExecuteSignal = (signal: Signal) => {
    setSelectedSignal(signal);
    setExecutionPrice(signal.currentPrice?.toString() || signal.entryPrice.toString());
    setPositionSize('');
    setShowExecuteModal(true);
  };

  // Handle view signal details
  const handleViewDetails = (signal: Signal) => {
    setSelectedSignal(signal);
    setShowDetailModal(true);
  };

  // Submit execution
  const handleSubmitExecution = async () => {
    if (!selectedSignal || !executionPrice) return;

    try {
      setExecuting(true);
      setMessage(null);

      const data: ExecuteSignalRequest = {
        signalId: selectedSignal.id,
        executedPrice: parseFloat(executionPrice),
        positionSize: positionSize ? parseFloat(positionSize) : undefined,
      };

      const response = await signalApi.executeSignal(data);

      if (response.success) {
        setMessage({
          type: 'success',
          text: `Successfully executed ${selectedSignal.symbol} ${selectedSignal.direction} signal!`,
        });
        setShowExecuteModal(false);
        setSelectedSignal(null);
        setExecutionPrice('');
        setPositionSize('');
      } else {
        setMessage({
          type: 'error',
          text: 'Failed to execute signal. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error executing signal:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to execute signal',
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              📡 Trading Signals
            </h1>
            <p className="text-lg text-gray-600">
              View and manage real-time trading signals from your subscribed strategies
            </p>
          </div>

          {/* Role-based content */}
          {user?.role === 'PROVIDER' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-bold text-purple-900 mb-2">
                📢 Provider Account
              </h3>
              <p className="text-purple-800 mb-4">
                As a provider, you can broadcast trading signals to all your strategy subscribers in real-time.
              </p>
              <Link
                href="/provider/signals/create"
                className="inline-block px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-semibold text-sm"
              >
                Create New Signal
              </Link>
            </div>
          )}

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

          {/* Signal Feed */}
          <SignalFeed
            onExecuteSignal={handleExecuteSignal}
            onViewSignalDetails={handleViewDetails}
            showFilters={true}
          />

          {/* How Signals Work Section */}
          <div className="mt-12 bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              How Signals Work
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl mb-3">
                  1️⃣
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Subscribe</h4>
                <p className="text-sm text-gray-600">
                  Subscribe to trading strategies from verified providers
                </p>
              </div>
              <div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl mb-3">
                  2️⃣
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Receive</h4>
                <p className="text-sm text-gray-600">
                  Get instant notifications when providers send trading signals
                </p>
              </div>
              <div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl mb-3">
                  3️⃣
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Execute</h4>
                <p className="text-sm text-gray-600">
                  Execute trades manually or enable automated copy trading
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Execute Signal Modal */}
      {showExecuteModal && selectedSignal && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowExecuteModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Execute Signal
              </h3>

              {/* Signal Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Symbol:</span>
                  <span className="font-bold text-gray-900">{selectedSignal.symbol}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Direction:</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      selectedSignal.direction === 'LONG'
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {selectedSignal.direction}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Entry Price:</span>
                  <span className="font-bold text-gray-900">{selectedSignal.entryPrice}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Stop Loss:</span>
                  <span className="font-bold text-red-600">{selectedSignal.stopLoss}</span>
                </div>
              </div>

              {/* Execution Form */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Execution Price *
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={executionPrice}
                    onChange={(e) => setExecutionPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter execution price"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position Size (optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={positionSize}
                    onChange={(e) => setPositionSize(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter position size"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExecuteModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-semibold"
                  disabled={executing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitExecution}
                  disabled={executing || !executionPrice}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {executing ? 'Executing...' : 'Execute Trade'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Signal Detail Modal */}
      {showDetailModal && selectedSignal && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowDetailModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Signal Details
              </h3>

              <div className="space-y-4">
                {/* Basic Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-sm text-gray-600">Symbol:</span>
                      <p className="font-bold text-gray-900">{selectedSignal.symbol}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Direction:</span>
                      <p className="font-bold text-gray-900">{selectedSignal.direction}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Type:</span>
                      <p className="font-bold text-gray-900">{selectedSignal.type}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Status:</span>
                      <p className="font-bold text-gray-900">{selectedSignal.status}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Strategy:</span>
                      <p className="font-bold text-gray-900">{selectedSignal.strategyName}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Provider:</span>
                      <p className="font-bold text-gray-900">{selectedSignal.providerUsername}</p>
                    </div>
                  </div>
                </div>

                {/* Price Levels */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Price Levels</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Entry Price:</span>
                      <span className="font-bold text-gray-900">{selectedSignal.entryPrice}</span>
                    </div>
                    {selectedSignal.currentPrice && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Current Price:</span>
                        <span className="font-bold text-blue-600">{selectedSignal.currentPrice}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Stop Loss:</span>
                      <span className="font-bold text-red-600">{selectedSignal.stopLoss}</span>
                    </div>
                    {selectedSignal.takeProfit && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Take Profit:</span>
                        <span className="font-bold text-green-600">{selectedSignal.takeProfit}</span>
                      </div>
                    )}
                    {selectedSignal.riskRewardRatio && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Risk/Reward:</span>
                        <span className="font-bold text-blue-600">
                          1:{selectedSignal.riskRewardRatio.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Note */}
                {selectedSignal.note && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Provider Note</h4>
                    <p className="text-sm text-gray-700 italic">"{selectedSignal.note}"</p>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowDetailModal(false)}
                className="mt-6 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </ProtectedRoute>
  );
}
