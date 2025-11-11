'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProviderDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProviderStats();
  }, []);

  const fetchProviderStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:6864/api/providers/dashboard', {
        credentials: 'include',
      });
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching provider stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">👨‍💼 Provider Dashboard</h1>
            <p className="text-gray-600">Manage your strategies and track your earnings</p>
          </div>
          <Link
            href="/provider/signals/create"
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all shadow-md"
          >
            ➕ Create Signal
          </Link>
        </div>

        {/* Revenue Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg shadow-md p-6 text-white">
            <p className="text-purple-100 text-sm mb-1">Total Revenue</p>
            <p className="text-3xl font-bold">${stats?.totalRevenue?.toFixed(2) || '0.00'}</p>
            <p className="text-purple-100 text-sm mt-2">↑ +15% this month</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Active Subscribers</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.totalSubscribers || 0}</p>
            <p className="text-sm text-green-600 mt-2">↑ +5 new this week</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Active Strategies</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.totalStrategies || 0}</p>
            <p className="text-sm text-gray-500 mt-2">Published strategies</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Avg Win Rate</p>
            <p className="text-3xl font-bold text-green-600">{stats?.avgWinRate?.toFixed(1) || 0}%</p>
            <p className="text-sm text-gray-500 mt-2">Across all strategies</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            href="/provider/signals/create"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                ➕
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Create Signal</h3>
                <p className="text-sm text-gray-600">Publish a new trading signal</p>
              </div>
            </div>
          </Link>

          <Link
            href="/provider/strategies"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                📊
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Manage Strategies</h3>
                <p className="text-sm text-gray-600">Edit and optimize strategies</p>
              </div>
            </div>
          </Link>

          <Link
            href="/provider/subscribers"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                👥
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">View Subscribers</h3>
                <p className="text-sm text-gray-600">Manage your subscribers</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Performance */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Recent Performance</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">Performance chart coming soon</p>
          </div>
        </div>

        {/* Recent Subscribers */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">👥 Recent Subscribers</h3>
          <div className="text-center py-8 text-gray-500">
            <p>No recent subscribers data available</p>
          </div>
        </div>
      </div>
    </div>
  );
}
