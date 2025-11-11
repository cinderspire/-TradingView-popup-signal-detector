'use client';

import React, { useState, useEffect } from 'react';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:6864/api/analytics', {
        credentials: 'include',
      });
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">📊 Performance Analytics</h1>
        <p className="text-lg text-gray-600 mb-8">Deep dive into your trading performance and metrics</p>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Total Trades</p>
            <p className="text-3xl font-bold text-gray-900">{analytics?.totalTrades || 0}</p>
            <p className="text-sm text-green-600 mt-1">↑ +12% this month</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Win Rate</p>
            <p className="text-3xl font-bold text-green-600">{analytics?.winRate?.toFixed(1) || 0}%</p>
            <p className="text-sm text-green-600 mt-1">↑ +3.2% vs last month</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Total P&L</p>
            <p className={`text-3xl font-bold ${(analytics?.totalPnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${analytics?.totalPnl?.toFixed(2) || '0.00'}
            </p>
            <p className="text-sm text-green-600 mt-1">↑ +8.5% ROI</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Sharpe Ratio</p>
            <p className="text-3xl font-bold text-blue-600">{analytics?.sharpeRatio?.toFixed(2) || '0.00'}</p>
            <p className="text-sm text-gray-600 mt-1">Risk-adjusted return</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Equity Curve */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Equity Curve</h3>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Chart visualization coming soon</p>
            </div>
          </div>

          {/* Win/Loss Distribution */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Win/Loss Distribution</h3>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Chart visualization coming soon</p>
            </div>
          </div>
        </div>

        {/* Performance by Strategy */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Performance by Strategy</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strategy</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trades</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">P&L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-500" colSpan={5}>
                    No strategy data available
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🛡️ Risk Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Max Drawdown</p>
              <p className="text-2xl font-bold text-red-600">{analytics?.maxDrawdown?.toFixed(2) || '0.00'}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Win</p>
              <p className="text-2xl font-bold text-green-600">${analytics?.avgWin?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Loss</p>
              <p className="text-2xl font-bold text-red-600">${analytics?.avgLoss?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
