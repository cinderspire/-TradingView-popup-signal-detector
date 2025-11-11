'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { positionApi } from '@/lib/position-api';
import { signalApi } from '@/lib/signal-api';
import { strategyApi } from '@/lib/strategy-api';
import type { Position, PositionStats } from '@/types/position';
import type { Signal } from '@/types/signal';
import { formatPnL, formatPnLPercentage, getPnLColorClass, POSITION_SIDE_COLORS } from '@/types/position';
import { SIGNAL_DIRECTION_COLORS, SIGNAL_STATUS_COLORS, getSignalAge } from '@/types/signal';

export default function DashboardPage() {
  const { user } = useAuth();

  // State
  const [stats, setStats] = useState<PositionStats | null>(null);
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [recentSignals, setRecentSignals] = useState<Signal[]>([]);
  const [activeStrategiesCount, setActiveStrategiesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // Load in parallel
        const [positionsRes, signalsRes, strategiesRes] = await Promise.all([
          positionApi.getMyPositions().catch(() => null),
          signalApi.getMySignals({ limit: 5 }).catch(() => null),
          user?.role === 'PROVIDER'
            ? strategyApi.getMyStrategies().catch(() => null)
            : strategyApi.getMySubscriptions().catch(() => null),
        ]);

        // Set positions and stats
        if (positionsRes?.success) {
          const openPos = positionsRes.data.positions.filter((p) => p.status === 'OPEN');
          setOpenPositions(openPos.slice(0, 5)); // Top 5
          setStats(positionsRes.data.stats);
        }

        // Set signals
        if (signalsRes?.success) {
          setRecentSignals(signalsRes.data.signals.slice(0, 5)); // Top 5
        }

        // Set strategies count
        if (strategiesRes?.success) {
          if (user?.role === 'PROVIDER' && 'strategies' in strategiesRes.data) {
            const activeStrats = strategiesRes.data.strategies.filter(
              (s: any) => s.status === 'ACTIVE'
            );
            setActiveStrategiesCount(activeStrats.length);
          } else {
            setActiveStrategiesCount(strategiesRes.data.total || 0);
          }
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user?.role]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Welcome back, {user?.firstName || user?.username}! 👋
            </h1>
            <p className="text-lg text-gray-600">
              Here's your trading overview and quick access to key features.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Active Strategies"
              value={loading ? '...' : activeStrategiesCount.toString()}
              subtitle={user?.role === 'PROVIDER' ? 'Strategies published' : 'Subscriptions'}
              color="blue"
              icon="📊"
            />
            <StatCard
              title="Open Positions"
              value={loading ? '...' : (stats?.openPositions || 0).toString()}
              subtitle="Positions open"
              color="purple"
              icon="💼"
            />
            <StatCard
              title="Active Signals"
              value={loading ? '...' : recentSignals.filter((s) => s.status === 'ACTIVE').length.toString()}
              subtitle="Signals active"
              color="green"
              icon="📡"
            />
            <StatCard
              title="Total P&L"
              value={loading ? '...' : stats ? `$${Math.abs(stats.totalPnL).toFixed(0)}` : '$0'}
              subtitle={stats && stats.totalPnL >= 0 ? 'Profit' : 'Loss'}
              color={stats && stats.totalPnL >= 0 ? 'green' : 'orange'}
              icon="💰"
            />
          </div>

          {/* Performance Overview */}
          {stats && (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Performance Overview</h2>
              <div className="grid md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total P&L</p>
                  <p className={`text-2xl font-bold ${getPnLColorClass(stats.totalPnL)}`}>
                    {formatPnL(stats.totalPnL)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Win Rate</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.winRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Profit Factor</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Trades</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPositions}</p>
                </div>
              </div>
            </div>
          )}

          {/* Open Positions Widget */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Open Positions</h2>
              <Link
                href="/positions"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View All →
              </Link>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : openPositions.length > 0 ? (
              <div className="space-y-3">
                {openPositions.map((position) => (
                  <div
                    key={position.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          POSITION_SIDE_COLORS[position.side]
                        }`}
                      >
                        {position.side}
                      </span>
                      <div>
                        <p className="font-bold text-gray-900">{position.symbol}</p>
                        <p className="text-xs text-gray-600">
                          Entry: {position.entryPrice.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {position.unrealizedPnL !== null && position.unrealizedPnL !== undefined && (
                        <>
                          <p className={`font-bold ${getPnLColorClass(position.unrealizedPnL)}`}>
                            {formatPnL(position.unrealizedPnL)}
                          </p>
                          <p className={`text-xs ${getPnLColorClass(position.unrealizedPnL)}`}>
                            {position.pnlPercentage !== null &&
                              position.pnlPercentage !== undefined &&
                              formatPnLPercentage(position.pnlPercentage)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">No open positions</p>
                <p className="text-sm">Execute signals to open positions</p>
              </div>
            )}
          </div>

          {/* Recent Signals Widget */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Recent Signals</h2>
              <Link
                href="/signals"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View All →
              </Link>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : recentSignals.length > 0 ? (
              <div className="space-y-3">
                {recentSignals.map((signal) => (
                  <div
                    key={signal.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          SIGNAL_DIRECTION_COLORS[signal.direction]
                        }`}
                      >
                        {signal.direction}
                      </span>
                      <div>
                        <p className="font-bold text-gray-900">{signal.symbol}</p>
                        <p className="text-xs text-gray-600">{signal.strategyName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          SIGNAL_STATUS_COLORS[signal.status]
                        }`}
                      >
                        {signal.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{getSignalAge(signal.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">No recent signals</p>
                <p className="text-sm">Subscribe to strategies to receive signals</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ActionCard
                href="/strategies"
                icon="📊"
                title="Strategies"
                description="Browse trading strategies"
              />
              <ActionCard
                href="/signals"
                icon="📡"
                title="Signals"
                description="View trading signals"
              />
              <ActionCard
                href="/positions"
                icon="💼"
                title="Positions"
                description="Manage positions"
              />
              {user?.role === 'PROVIDER' && (
                <ActionCard
                  href="/provider/signals/create"
                  icon="📢"
                  title="Create Signal"
                  description="Broadcast to subscribers"
                />
              )}
              {user?.role !== 'PROVIDER' && (
                <ActionCard
                  href="/risk-management"
                  icon="⚙️"
                  title="Risk Management"
                  description="Configure trading risk"
                />
              )}
            </div>
          </div>

          {/* User Role Info */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Account: {user?.role}
                </h3>
                {user?.role === 'USER' && (
                  <div>
                    <p className="text-gray-700 mb-3">
                      As a trader, you can subscribe to strategies, receive signals, and automate your trading with advanced risk management.
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span>Subscribe to unlimited strategies</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span>Receive real-time trading signals</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span>Advanced risk management tools</span>
                      </div>
                    </div>
                  </div>
                )}
                {user?.role === 'PROVIDER' && (
                  <div>
                    <p className="text-gray-700 mb-3">
                      As a provider, you can create strategies, share signals with subscribers, and earn from your trading expertise.
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span>Create and publish strategies</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span>Broadcast signals to subscribers</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span>Earn from subscription fees</span>
                      </div>
                    </div>
                  </div>
                )}
                {user?.role === 'ADMIN' && (
                  <div>
                    <p className="text-gray-700 mb-3">
                      As an administrator, you have full access to manage the platform, users, and system settings.
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span>Full platform access</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span>User management</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600">✓</span>
                        <span>System configuration</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: 'blue' | 'purple' | 'green' | 'orange';
  icon: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
  };

  return (
    <div className={`${colorClasses[color]} rounded-xl p-6 border-2`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium opacity-80">{title}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold mb-1">{value}</p>
      <p className="text-xs opacity-70">{subtitle}</p>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </Link>
  );
}
