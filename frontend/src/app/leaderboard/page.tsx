'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface ProviderStats {
  providerId: string;
  providerUsername: string;
  providerEmail: string;
  totalStrategies: number;
  subscriberCount: number;
  totalSignals: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  consistency: number;
  score: number;
  rank?: number;
}

interface LeaderboardData {
  byWinRate: ProviderStats[];
  byPnl: ProviderStats[];
  bySubscribers: ProviderStats[];
  byScore: ProviderStats[];
}

export default function LeaderboardPage() {
  const [leaderboards, setLeaderboards] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'all-time'>('all-time');
  const [activeTab, setActiveTab] = useState<'score' | 'winRate' | 'pnl' | 'subscribers'>('score');

  useEffect(() => {
    fetchLeaderboard();
  }, [period]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:6864/api/leaderboard/top-providers?period=${period}`);

      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }

      const data = await response.json();
      if (data.success) {
        setLeaderboards(data.leaderboards);
        setError(null);
      } else {
        throw new Error(data.message || 'Failed to fetch leaderboard');
      }
    } catch (err: any) {
      console.error('Error fetching leaderboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const formatPnl = (pnl: number) => {
    const formatted = pnl.toFixed(2);
    if (pnl >= 0) {
      return `+$${formatted}`;
    }
    return `-$${Math.abs(pnl).toFixed(2)}`;
  };

  const getPnlColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-600';
    if (pnl < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 70) return 'text-green-600';
    if (winRate >= 50) return 'text-blue-600';
    if (winRate >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getCurrentLeaderboard = () => {
    if (!leaderboards) return [];
    switch (activeTab) {
      case 'winRate':
        return leaderboards.byWinRate;
      case 'pnl':
        return leaderboards.byPnl;
      case 'subscribers':
        return leaderboards.bySubscribers;
      case 'score':
      default:
        return leaderboards.byScore;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading leaderboard...</p>
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🏆 Provider Leaderboard</h1>
          <p className="text-lg text-gray-600">
            Top performing signal providers ranked by performance, win rate, and community trust
          </p>
        </div>

        {/* Period Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Time Period</h3>
              <p className="text-sm text-gray-600">Select the time range for rankings</p>
            </div>
            <div className="flex gap-2">
              {(['week', 'month', 'all-time'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                    period === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p === 'all-time' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="flex items-center space-x-2">
              <span className="text-red-600">⚠️</span>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-8">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {[
                { id: 'score', label: 'Overall Score', icon: '⭐' },
                { id: 'winRate', label: 'Win Rate', icon: '🎯' },
                { id: 'pnl', label: 'Total P/L', icon: '💰' },
                { id: 'subscribers', label: 'Subscribers', icon: '👥' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 min-w-[150px] px-6 py-4 font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Leaderboard Content */}
          <div className="p-6">
            {getCurrentLeaderboard().length === 0 ? (
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">🏆</span>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Rankings Yet</h3>
                <p className="text-gray-600">
                  Providers need at least 3 completed trades to qualify for the leaderboard
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {getCurrentLeaderboard().map((provider) => (
                  <div
                    key={provider.providerId}
                    className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg p-4 transition-colors"
                  >
                    {/* Rank and Provider Info */}
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="text-2xl font-bold text-gray-900 w-12 text-center">
                        {getMedalEmoji(provider.rank || 0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-semibold text-gray-900 truncate">
                          {provider.providerUsername}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {provider.totalStrategies} {provider.totalStrategies === 1 ? 'Strategy' : 'Strategies'} • {provider.totalTrades} Trades
                        </p>
                      </div>
                    </div>

                    {/* Stats based on active tab */}
                    <div className="flex items-center space-x-6">
                      {activeTab === 'score' && (
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Overall Score</p>
                          <p className="text-2xl font-bold text-blue-600">{provider.score.toFixed(2)}</p>
                        </div>
                      )}

                      {activeTab === 'winRate' && (
                        <>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Win Rate</p>
                            <p className={`text-2xl font-bold ${getWinRateColor(provider.winRate)}`}>
                              {provider.winRate.toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">W/L</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {provider.winningTrades}/{provider.losingTrades}
                            </p>
                          </div>
                        </>
                      )}

                      {activeTab === 'pnl' && (
                        <>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Total P/L</p>
                            <p className={`text-2xl font-bold ${getPnlColor(provider.totalPnl)}`}>
                              {formatPnl(provider.totalPnl)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Avg P/L</p>
                            <p className={`text-lg font-semibold ${getPnlColor(provider.avgPnl)}`}>
                              {formatPnl(provider.avgPnl)}
                            </p>
                          </div>
                        </>
                      )}

                      {activeTab === 'subscribers' && (
                        <>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Subscribers</p>
                            <p className="text-2xl font-bold text-purple-600">{provider.subscriberCount}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Win Rate</p>
                            <p className={`text-lg font-semibold ${getWinRateColor(provider.winRate)}`}>
                              {provider.winRate.toFixed(1)}%
                            </p>
                          </div>
                        </>
                      )}

                      {/* View Profile Button */}
                      <Link
                        href={`/providers/${provider.providerId}`}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                      >
                        View Profile →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-4xl">🎯</span>
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold">
                Performance
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2">How Win Rate is Calculated</h3>
            <p className="text-blue-100 text-sm">
              Win rate is the percentage of profitable trades out of total closed positions. Minimum 3 trades required.
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-4xl">💰</span>
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold">
                Profit/Loss
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2">Real Performance Data</h3>
            <p className="text-green-100 text-sm">
              All P/L data is calculated from real executed trades, not simulated or backtested results.
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-4xl">⭐</span>
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold">
                Overall Score
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2">Multi-Factor Ranking</h3>
            <p className="text-purple-100 text-sm">
              Overall score combines win rate (40%), P/L (30%), subscribers (20%), and consistency (10%).
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Want to Join the Leaderboard?</h2>
          <p className="text-blue-100 mb-6 text-lg">
            Become a signal provider and compete with the best traders on our platform
          </p>
          <Link
            href="/provider/dashboard"
            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Start Providing Signals
          </Link>
        </div>
      </div>
    </div>
  );
}
