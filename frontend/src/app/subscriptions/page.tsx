'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Position {
  id: string;
  pair: string;
  side: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  size: number;
  status: string;
  openedAt: string;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface Subscription {
  id: string;
  status: string;
  monthlyPrice: number;
  startDate: string;
  endDate: string;
  renewalDate?: string;
  autoRenew: boolean;
  totalPnl?: number;
  totalTrades: number;
  isTrial?: boolean;
  trialEndsAt?: string;
  trialDays?: number;
  convertedFromTrial?: boolean;
  strategy: {
    id: string;
    name: string;
    description: string;
    category: string;
    winRate?: number;
    provider: {
      username: string;
    };
  };
  stats?: {
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: string;
    avgPnl: number;
  };
  positions?: Position[];
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:6864/api/subscriptions', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }

      const data = await response.json();
      const subs = data.subscriptions || [];

      // Fetch stats and positions for each subscription in parallel
      const subscriptionsWithStatsAndPositions = await Promise.all(
        subs.map(async (sub: Subscription) => {
          const promises = [];

          // Fetch stats
          promises.push(
            fetch(`http://localhost:6864/api/stats/subscription/${sub.id}`, {
              credentials: 'include',
            })
              .then(res => res.ok ? res.json() : null)
              .catch(() => null)
          );

          // Fetch positions
          promises.push(
            fetch(`http://localhost:6864/api/positions?subscriptionId=${sub.id}&status=OPEN`, {
              credentials: 'include',
            })
              .then(res => res.ok ? res.json() : null)
              .catch(() => null)
          );

          const [statsData, positionsData] = await Promise.all(promises);

          return {
            ...sub,
            stats: statsData?.stats || undefined,
            positions: positionsData?.positions || []
          };
        })
      );

      setSubscriptions(subscriptionsWithStatsAndPositions);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching subscriptions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:6864/api/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      fetchSubscriptions();
    } catch (err: any) {
      alert('Error canceling subscription: ' + err.message);
    }
  };

  const handleToggleAutoRenew = async (subscriptionId: string, currentValue: boolean) => {
    try {
      const response = await fetch(`http://localhost:6864/api/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ autoRenew: !currentValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update auto-renew');
      }

      fetchSubscriptions();
    } catch (err: any) {
      alert('Error updating auto-renew: ' + err.message);
    }
  };

  const handleClosePosition = async (positionId: string, pair: string) => {
    if (!confirm(`Are you sure you want to close position ${pair}?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:6864/api/positions/${positionId}/close`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to close position');
      }

      // Refresh subscriptions to update positions
      fetchSubscriptions();
    } catch (err: any) {
      alert('Error closing position: ' + err.message);
    }
  };

  const handleCloseAllPositions = async (subscription: Subscription) => {
    const openPositions = subscription.positions?.filter(p => p.status === 'OPEN') || [];

    if (openPositions.length === 0) {
      alert('No open positions to close');
      return;
    }

    if (!confirm(`Are you sure you want to close all ${openPositions.length} open positions for ${subscription.strategy.name}?`)) {
      return;
    }

    try {
      // Close all positions in parallel
      const closePromises = openPositions.map(position =>
        fetch(`http://localhost:6864/api/positions/${position.id}/close`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const results = await Promise.all(closePromises);
      const failed = results.filter(r => !r.ok);

      if (failed.length > 0) {
        alert(`Closed ${results.length - failed.length} positions successfully, ${failed.length} failed`);
      }

      // Refresh subscriptions to update positions
      fetchSubscriptions();
    } catch (err: any) {
      alert('Error closing positions: ' + err.message);
    }
  };

  const handleConvertTrial = async (subscriptionId: string) => {
    if (!confirm('Convert your free trial to a paid subscription?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:6864/api/trials/convert/${subscriptionId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to convert trial');
      }

      alert('Trial converted successfully! Your subscription is now active.');
      fetchSubscriptions();
    } catch (err: any) {
      alert('Error converting trial: ' + err.message);
    }
  };

  const calculateDaysRemaining = (trialEndsAt?: string): number => {
    if (!trialEndsAt) return 0;
    const now = new Date();
    const endDate = new Date(trialEndsAt);
    const diffTime = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (filter === 'all') return true;
    return sub.status.toLowerCase() === filter.toLowerCase();
  });

  const activeSubscriptions = subscriptions.filter((s) => s.status === 'ACTIVE');
  const totalMonthlySpend = activeSubscriptions.reduce((sum, s) => sum + s.monthlyPrice, 0);
  const totalPnl = subscriptions.reduce((sum, s) => sum + (s.stats ? parseFloat(s.stats.totalPnl) : 0), 0);
  const totalTrades = subscriptions.reduce((sum, s) => sum + (s.stats ? s.stats.totalTrades : 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading subscriptions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">⭐ My Subscriptions</h1>
          <p className="text-gray-600">Manage your active signal subscriptions and track performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Subscriptions</p>
                <p className="text-2xl font-bold text-gray-900">{activeSubscriptions.length}</p>
              </div>
              <span className="text-3xl">⭐</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Spend</p>
                <p className="text-2xl font-bold text-gray-900">${totalMonthlySpend.toFixed(2)}</p>
              </div>
              <span className="text-3xl">💳</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total P&L</p>
                <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totalPnl.toFixed(2)}
                </p>
              </div>
              <span className="text-3xl">{totalPnl >= 0 ? '📈' : '📉'}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Trades</p>
                <p className="text-2xl font-bold text-gray-900">
                  {totalTrades}
                </p>
              </div>
              <span className="text-3xl">📊</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            <div className="flex space-x-2">
              {['all', 'active', 'paused', 'cancelled', 'expired'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-red-600">⚠️</span>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Subscriptions List */}
        {filteredSubscriptions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <span className="text-6xl mb-4 block">📭</span>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Subscriptions Found</h3>
            <p className="text-gray-600 mb-6">
              {filter !== 'all'
                ? `You don't have any ${filter} subscriptions`
                : "You haven't subscribed to any strategies yet"}
            </p>
            <Link
              href="/strategies"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Browse Strategies
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSubscriptions.map((subscription) => (
              <div key={subscription.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                    {/* Strategy Info */}
                    <div className="flex-1 mb-4 lg:mb-0">
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                          {subscription.strategy.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-1">
                            <Link
                              href={`/strategies/${subscription.strategy.id}`}
                              className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                            >
                              {subscription.strategy.name}
                            </Link>
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                subscription.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800'
                                  : subscription.status === 'PAUSED'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {subscription.status}
                            </span>
                            {subscription.isTrial && (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                                🎁 Free Trial - {calculateDaysRemaining(subscription.trialEndsAt)} days left
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{subscription.strategy.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>👤 {subscription.strategy.provider.username}</span>
                            <span>📊 {subscription.strategy.category}</span>
                            {subscription.stats && subscription.stats.totalTrades > 0 ? (
                              <span className={`font-medium ${
                                subscription.stats.winRate >= 60 ? 'text-green-600' :
                                subscription.stats.winRate >= 50 ? 'text-blue-600' :
                                'text-orange-600'
                              }`}>
                                {subscription.stats.winRate.toFixed(1)}% Win Rate ({subscription.stats.winningTrades}/{subscription.stats.totalTrades})
                              </span>
                            ) : (
                              <span className="text-gray-500 font-medium">
                                No trades yet
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="lg:ml-6 lg:text-right space-y-2">
                      <div className="flex lg:flex-col lg:items-end space-x-4 lg:space-x-0 lg:space-y-1">
                        <div>
                          <p className="text-xs text-gray-500">Monthly Price</p>
                          <p className="text-xl font-bold text-gray-900">${subscription.monthlyPrice}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total P&L</p>
                          <p
                            className={`text-lg font-semibold ${
                              subscription.stats && parseFloat(subscription.stats.totalPnl) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            ${subscription.stats ? subscription.stats.totalPnl : '0.00'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subscription Details */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Started</p>
                        <p className="font-medium text-gray-900">
                          {new Date(subscription.startDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Expires</p>
                        <p className="font-medium text-gray-900">
                          {new Date(subscription.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Trades</p>
                        <p className="font-medium text-gray-900">{subscription.stats ? subscription.stats.totalTrades : 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Auto-Renew</p>
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={subscription.autoRenew}
                            onChange={() =>
                              handleToggleAutoRenew(subscription.id, subscription.autoRenew)
                            }
                            className="sr-only peer"
                          />
                          <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Open Positions */}
                  {subscription.positions && subscription.positions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">
                          Open Positions ({subscription.positions.filter(p => p.status === 'OPEN').length})
                        </h4>
                        {subscription.positions.filter(p => p.status === 'OPEN').length > 0 && (
                          <button
                            onClick={() => handleCloseAllPositions(subscription)}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 transition-colors font-medium"
                          >
                            Close All Positions
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {subscription.positions.filter(p => p.status === 'OPEN').map((position) => (
                          <div key={position.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-gray-500">Pair</p>
                                <p className="font-semibold text-gray-900">{position.pair}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Side</p>
                                <p className={`font-medium ${position.side === 'LONG' ? 'text-green-600' : 'text-red-600'}`}>
                                  {position.side}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Entry Price</p>
                                <p className="font-medium text-gray-900">${position.entryPrice.toFixed(4)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Current Price</p>
                                <p className="font-medium text-gray-900">${position.currentPrice.toFixed(4)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Unrealized P&L</p>
                                <p className={`font-bold ${(position.unrealizedPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ${(position.unrealizedPnL || 0).toFixed(2)}
                                  {position.unrealizedPnLPercent && (
                                    <span className="text-xs ml-1">
                                      ({position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%)
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleClosePosition(position.id, position.pair)}
                              className="ml-3 px-3 py-1.5 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 transition-colors font-medium"
                            >
                              Close
                            </button>
                          </div>
                        ))}
                      </div>
                      {subscription.positions.filter(p => p.status === 'OPEN').length === 0 && (
                        <p className="text-sm text-gray-500 italic">No open positions</p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {subscription.status === 'ACTIVE' && (
                    <div className="mt-4 space-y-2">
                      {/* Trial Conversion Button - Prominent */}
                      {subscription.isTrial && (
                        <button
                          onClick={() => handleConvertTrial(subscription.id)}
                          className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all transform hover:scale-[1.02] shadow-lg"
                        >
                          🎁 Convert to Paid Subscription - {calculateDaysRemaining(subscription.trialEndsAt)} days remaining
                        </button>
                      )}

                      {/* Regular Actions */}
                      <div className="flex space-x-2">
                        <Link
                          href={`/strategies/${subscription.strategy.id}`}
                          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-center font-medium hover:bg-blue-700 transition-colors"
                        >
                          View Strategy
                        </Link>
                        <button
                          onClick={() => handleCancelSubscription(subscription.id)}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                        >
                          Cancel Subscription
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
