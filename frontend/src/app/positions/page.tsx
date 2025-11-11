'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PositionList } from '@/components/positions/PositionList';
import { positionApi } from '@/lib/position-api';
import type {
  Position,
  ClosePositionRequest,
  UpdatePositionRequest,
  PositionStats,
} from '@/types/position';

type TabType = 'OPEN' | 'CLOSED';

export default function PositionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('OPEN');
  const [positions, setPositions] = useState<Position[]>([]);
  const [stats, setStats] = useState<PositionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Close position modal state
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [positionToClose, setPositionToClose] = useState<Position | null>(null);
  const [closePrice, setClosePrice] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [closing, setClosing] = useState(false);

  // Update position modal state
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [positionToUpdate, setPositionToUpdate] = useState<Position | null>(null);
  const [newStopLoss, setNewStopLoss] = useState('');
  const [newTakeProfit, setNewTakeProfit] = useState('');
  const [updateNote, setUpdateNote] = useState('');
  const [updating, setUpdating] = useState(false);

  // Load positions
  const loadPositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await positionApi.getMyPositions({
        status: activeTab,
      });

      if (response.success) {
        setPositions(response.data.positions);
        setStats(response.data.stats);
      } else {
        setError('Failed to load positions');
      }
    } catch (err) {
      console.error('Error loading positions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load positions');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Load positions on mount and when tab changes
  useEffect(() => {
    loadPositions();
  }, [loadPositions, refreshKey]);

  // Handle close position
  const handleClosePosition = (position: Position) => {
    setPositionToClose(position);
    setClosePrice(position.currentPrice?.toString() || position.entryPrice.toString());
    setCloseNote('');
    setShowCloseModal(true);
  };

  // Submit close position
  const handleSubmitClose = async () => {
    if (!positionToClose || !closePrice) return;

    try {
      setClosing(true);
      setMessage(null);

      const data: ClosePositionRequest = {
        positionId: positionToClose.id,
        exitPrice: parseFloat(closePrice),
        closeReason: 'MANUAL',
        note: closeNote.trim() || undefined,
      };

      const response = await positionApi.closePosition(data);

      if (response.success) {
        setMessage({
          type: 'success',
          text: `Position closed successfully! P&L: $${response.data.realizedPnL.toFixed(2)} (${response.data.pnlPercentage.toFixed(2)}%)`,
        });
        setShowCloseModal(false);
        setPositionToClose(null);
        setClosePrice('');
        setCloseNote('');
        setRefreshKey((prev) => prev + 1);
      } else {
        setMessage({
          type: 'error',
          text: 'Failed to close position. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error closing position:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to close position',
      });
    } finally {
      setClosing(false);
    }
  };

  // Handle update position
  const handleUpdatePosition = (position: Position) => {
    setPositionToUpdate(position);
    setNewStopLoss(position.stopLoss?.toString() || '');
    setNewTakeProfit(position.takeProfit?.toString() || '');
    setUpdateNote('');
    setShowUpdateModal(true);
  };

  // Submit update position
  const handleSubmitUpdate = async () => {
    if (!positionToUpdate) return;

    try {
      setUpdating(true);
      setMessage(null);

      const data: UpdatePositionRequest = {
        stopLoss: newStopLoss ? parseFloat(newStopLoss) : undefined,
        takeProfit: newTakeProfit ? parseFloat(newTakeProfit) : undefined,
        note: updateNote.trim() || undefined,
      };

      const response = await positionApi.updatePosition(positionToUpdate.id, data);

      if (response.success) {
        setMessage({
          type: 'success',
          text: 'Position updated successfully!',
        });
        setShowUpdateModal(false);
        setPositionToUpdate(null);
        setNewStopLoss('');
        setNewTakeProfit('');
        setUpdateNote('');
        setRefreshKey((prev) => prev + 1);
      } else {
        setMessage({
          type: 'error',
          text: 'Failed to update position. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error updating position:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update position',
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">💼 Positions</h1>
              <button
                onClick={loadPositions}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Refresh
              </button>
            </div>
            <p className="text-lg text-gray-600">
              Monitor and manage your active trading positions and performance
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

          {/* Stats */}
          {stats && (
            <div className="mb-8 grid md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">💰</span>
                  <span
                    className={`text-xs font-semibold ${
                      stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Total P&L</h3>
                <p className="text-2xl font-bold text-gray-900">
                  ${Math.abs(stats.totalPnL).toFixed(2)}
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Open Positions</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.openPositions}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.closedPositions} closed
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">✅</span>
                  <span className="text-xs font-semibold text-blue-600">
                    {stats.winRate.toFixed(1)}%
                  </span>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Win Rate</h3>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.winRate.toFixed(1)}%
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">📈</span>
                  <span className="text-xs font-semibold text-purple-600">
                    {stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : 'N/A'}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Profit Factor</h3>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : 'N/A'}
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('OPEN')}
                className={`pb-4 px-1 font-semibold text-sm border-b-2 transition-colors ${
                  activeTab === 'OPEN'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Open Positions {stats && `(${stats.openPositions})`}
              </button>
              <button
                onClick={() => setActiveTab('CLOSED')}
                className={`pb-4 px-1 font-semibold text-sm border-b-2 transition-colors ${
                  activeTab === 'CLOSED'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Closed Positions {stats && `(${stats.closedPositions})`}
              </button>
            </div>
          </div>

          {/* Position List */}
          <PositionList
            positions={positions}
            loading={loading}
            error={error}
            emptyMessage={
              activeTab === 'OPEN'
                ? 'No open positions'
                : 'No closed positions'
            }
            onClose={handleClosePosition}
            onUpdate={handleUpdatePosition}
            showActions={true}
          />
        </div>
      </div>

      {/* Close Position Modal */}
      {showCloseModal && positionToClose && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowCloseModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Close Position</h3>

              {/* Position Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Symbol:</span>
                  <span className="font-bold text-gray-900">{positionToClose.symbol}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Side:</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      positionToClose.side === 'LONG'
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {positionToClose.side}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Entry Price:</span>
                  <span className="font-bold text-gray-900">{positionToClose.entryPrice}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Size:</span>
                  <span className="font-bold text-gray-900">{positionToClose.size}</span>
                </div>
              </div>

              {/* Close Form */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exit Price *
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={closePrice}
                    onChange={(e) => setClosePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter exit price"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (optional)
                  </label>
                  <textarea
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add a note about why you closed this position..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-semibold"
                  disabled={closing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitClose}
                  disabled={closing || !closePrice}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {closing ? 'Closing...' : 'Close Position'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Update Position Modal */}
      {showUpdateModal && positionToUpdate && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowUpdateModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Update Position</h3>

              {/* Position Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Symbol:</span>
                  <span className="font-bold text-gray-900">{positionToUpdate.symbol}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Entry Price:</span>
                  <span className="font-bold text-gray-900">{positionToUpdate.entryPrice}</span>
                </div>
              </div>

              {/* Update Form */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stop Loss
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={newStopLoss}
                    onChange={(e) => setNewStopLoss(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new stop loss"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Take Profit
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={newTakeProfit}
                    onChange={(e) => setNewTakeProfit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new take profit"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (optional)
                  </label>
                  <textarea
                    value={updateNote}
                    onChange={(e) => setUpdateNote(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add a note..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-semibold"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitUpdate}
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? 'Updating...' : 'Update Position'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </ProtectedRoute>
  );
}
