'use client';

import React, { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { StrategyList } from '@/components/strategies/StrategyList';
import { StrategyDetail } from '@/components/strategies/StrategyDetail';
import { StrategyForm } from '@/components/strategies/StrategyForm';
import { Strategy } from '@/types/strategy';
import { strategyApi } from '@/lib/strategy-api';

export default function StrategiesPage() {
  const { user } = useAuth();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editStrategy, setEditStrategy] = useState<Strategy | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [strategyToDelete, setStrategyToDelete] = useState<Strategy | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [subscribing, setSubscribing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isProvider = user?.role === 'PROVIDER';

  const handleViewDetails = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setShowDetail(true);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedStrategy(null);
  };

  const handleCreateNew = () => {
    setEditStrategy(null);
    setShowForm(true);
  };

  const handleEdit = (strategy: Strategy) => {
    setEditStrategy(strategy);
    setShowForm(true);
  };

  const handleDelete = (strategy: Strategy) => {
    setStrategyToDelete(strategy);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!strategyToDelete) return;

    try {
      const response = await strategyApi.deleteStrategy(strategyToDelete.id);
      if (response.success) {
        setMessage({
          type: 'success',
          text: `Successfully deleted ${strategyToDelete.name}`,
        });
        setRefreshKey((prev) => prev + 1);
      } else {
        setMessage({
          type: 'error',
          text: response.message || 'Failed to delete strategy',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setShowDeleteConfirm(false);
      setStrategyToDelete(null);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleFormSuccess = (strategy: Strategy) => {
    setMessage({
      type: 'success',
      text: `Successfully ${editStrategy ? 'updated' : 'created'} ${strategy.name}`,
    });
    setShowForm(false);
    setEditStrategy(null);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setMessage(null), 5000);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditStrategy(null);
  };

  const handleSubscribe = async (strategy: Strategy) => {
    if (subscribing) return;

    setSubscribing(true);
    setMessage(null);

    try {
      const response = await strategyApi.subscribe({ strategyId: strategy.id });

      if (response.success) {
        setMessage({
          type: 'success',
          text: `Successfully subscribed to ${strategy.name}! You'll now receive trading signals.`,
        });
        setRefreshKey((prev) => prev + 1); // Refresh the list to update subscription status
      } else {
        setMessage({
          type: 'error',
          text: response.message || 'Failed to subscribe to strategy',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred while subscribing',
      });
    } finally {
      setSubscribing(false);

      // Auto-dismiss message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleUnsubscribe = async (strategy: Strategy) => {
    if (subscribing) return;

    // Find the subscription ID first
    setSubscribing(true);
    setMessage(null);

    try {
      const subsResponse = await strategyApi.getMySubscriptions();

      if (subsResponse.success) {
        const subscription = subsResponse.data.subscriptions.find(
          (sub) => sub.strategyId === strategy.id && sub.status === 'ACTIVE'
        );

        if (subscription) {
          const response = await strategyApi.unsubscribe(subscription.id);

          if (response.success) {
            setMessage({
              type: 'success',
              text: `Successfully unsubscribed from ${strategy.name}`,
            });
            setRefreshKey((prev) => prev + 1);
          } else {
            setMessage({
              type: 'error',
              text: response.message || 'Failed to unsubscribe',
            });
          }
        } else {
          setMessage({
            type: 'error',
            text: 'Subscription not found',
          });
        }
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setSubscribing(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleStartTrial = async (strategy: Strategy) => {
    if (subscribing) return;

    setSubscribing(true);
    setMessage(null);

    try {
      const response = await fetch('http://localhost:6864/api/trials/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          strategyId: strategy.id,
          trialDays: 14,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start trial');
      }

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: `🎁 ${data.message} You can now use ${strategy.name} for free!`,
        });
        setRefreshKey((prev) => prev + 1);
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'Failed to start trial',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred while starting trial',
      });
    } finally {
      setSubscribing(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              📊 Trading Strategies
            </h1>
            <p className="text-lg text-gray-600">
              {isProvider
                ? 'Manage your trading strategies and track subscribers'
                : 'Browse and subscribe to profitable trading strategies from verified providers'}
            </p>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{message.text}</p>
                <button
                  onClick={() => setMessage(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Provider Info Banner */}
          {isProvider && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-blue-900 mb-2">
                    💼 Provider Account
                  </h3>
                  <p className="text-blue-800 mb-4">
                    As a provider, you can create and manage your own trading strategies. Share your expertise and earn from subscriptions.
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Create New Strategy
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Info Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
              <div className="text-3xl mb-2">📊</div>
              <h3 className="font-bold text-gray-900 mb-2">Verified Strategies</h3>
              <p className="text-sm text-gray-700">
                All strategies are verified and tracked with transparent performance metrics
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-bold text-gray-900 mb-2">Real-Time Signals</h3>
              <p className="text-sm text-gray-700">
                Receive instant trading signals via WebSocket when providers broadcast
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
              <div className="text-3xl mb-2">🔒</div>
              <h3 className="font-bold text-gray-900 mb-2">Risk-Controlled</h3>
              <p className="text-sm text-gray-700">
                All signals integrate with your risk management settings for safe trading
              </p>
            </div>
          </div>

          {/* Strategy Form */}
          {showForm && (
            <div className="mb-8">
              <StrategyForm
                strategy={editStrategy || undefined}
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
              />
            </div>
          )}

          {/* Strategy Marketplace */}
          <StrategyList
            key={refreshKey}
            onViewDetails={handleViewDetails}
            onSubscribe={handleSubscribe}
            onUnsubscribe={handleUnsubscribe}
            onStartTrial={handleStartTrial}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isProvider={isProvider}
            showMyStrategies={false}
            trialDays={14}
          />

          {/* Strategy Detail Modal */}
          {showDetail && selectedStrategy && (
            <StrategyDetail
              strategy={selectedStrategy}
              onClose={handleCloseDetail}
              onSubscribe={handleSubscribe}
              onUnsubscribe={handleUnsubscribe}
              isProvider={isProvider}
            />
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && strategyToDelete && (
            <>
              {/* Overlay */}
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={() => setShowDeleteConfirm(false)}
              />

              {/* Modal */}
              <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                    <div className="text-center">
                      <div className="text-6xl mb-4">⚠️</div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        Delete Strategy?
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Are you sure you want to delete <strong>{strategyToDelete.name}</strong>?
                        This action cannot be undone.
                      </p>

                      {strategyToDelete.subscriberCount > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
                          <p className="text-yellow-800 text-sm font-semibold mb-1">
                            ⚠️ Warning
                          </p>
                          <p className="text-yellow-700 text-sm">
                            This strategy has{' '}
                            <strong>{strategyToDelete.subscriberCount} active subscriber(s)</strong>.
                            Deleting will cancel all subscriptions.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleConfirmDelete}
                          className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                        >
                          Delete Strategy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
