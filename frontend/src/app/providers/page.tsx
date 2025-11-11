'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Provider {
  id: string;
  username: string;
  bio?: string;
  avatar?: string;
  strategies: {
    id: string;
    name: string;
    winRate?: number;
    totalTrades: number;
    monthlyPrice: number;
    totalSubscribers: number;
    category: string;
  }[];
  totalStrategies: number;
  totalSubscribers: number;
  avgWinRate?: number;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'Technical', 'AI', 'Hybrid', 'Scalping', 'Swing Trading'];

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:6864/api/providers', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch providers');
      }

      const data = await response.json();
      setProviders(data.providers || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching providers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProviders = providers.filter((provider) => {
    const matchesSearch = provider.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.bio?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'all' ||
      provider.strategies.some(s => s.category === selectedCategory);

    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading providers...</p>
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">👥 Signal Providers</h1>
          <p className="text-gray-600">
            Browse verified trading signal providers and subscribe to proven strategies
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Providers
              </label>
              <input
                type="text"
                placeholder="Search by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Providers</p>
                <p className="text-2xl font-bold text-gray-900">{providers.length}</p>
              </div>
              <span className="text-3xl">👥</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Strategies</p>
                <p className="text-2xl font-bold text-gray-900">
                  {providers.reduce((sum, p) => sum + p.totalStrategies, 0)}
                </p>
              </div>
              <span className="text-3xl">📊</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Subscribers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {providers.reduce((sum, p) => sum + p.totalSubscribers, 0)}
                </p>
              </div>
              <span className="text-3xl">⭐</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Win Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {providers.length > 0
                    ? (providers.reduce((sum, p) => sum + (p.avgWinRate || 0), 0) / providers.length).toFixed(1)
                    : 0}%
                </p>
              </div>
              <span className="text-3xl">📈</span>
            </div>
          </div>
        </div>

        {/* Providers Grid */}
        {filteredProviders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <span className="text-6xl mb-4 block">🔍</span>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Providers Found</h3>
            <p className="text-gray-600">
              {searchTerm || selectedCategory !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No providers available at the moment'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProviders.map((provider) => (
              <div
                key={provider.id}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden"
              >
                {/* Provider Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
                      {provider.avatar ? (
                        <img src={provider.avatar} alt={provider.username} className="w-full h-full rounded-full" />
                      ) : (
                        provider.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold truncate">{provider.username}</h3>
                      <p className="text-blue-100 text-sm">
                        {provider.totalStrategies} {provider.totalStrategies === 1 ? 'Strategy' : 'Strategies'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Provider Info */}
                <div className="p-6">
                  {provider.bio && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{provider.bio}</p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Subscribers</p>
                      <p className="text-lg font-semibold text-gray-900">{provider.totalSubscribers}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Avg Win Rate</p>
                      <p className="text-lg font-semibold text-green-600">
                        {provider.avgWinRate?.toFixed(1) || 0}%
                      </p>
                    </div>
                  </div>

                  {/* Top Strategies */}
                  {provider.strategies.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">Top Strategies:</p>
                      <div className="space-y-2">
                        {provider.strategies.slice(0, 2).map((strategy) => (
                          <div
                            key={strategy.id}
                            className="flex items-center justify-between bg-gray-50 rounded-lg p-2"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{strategy.name}</p>
                              <p className="text-xs text-gray-500">
                                {strategy.winRate?.toFixed(1)}% win • {strategy.totalTrades} trades
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-blue-600 ml-2">
                              ${strategy.monthlyPrice}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <Link
                    href={`/providers/${provider.id}`}
                    className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                  >
                    View Profile →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Want to Become a Provider?</h2>
          <p className="text-blue-100 mb-6 text-lg">
            Share your trading strategies and earn passive income from subscribers
          </p>
          <Link
            href="/provider/dashboard"
            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Get Started as Provider
          </Link>
        </div>
      </div>
    </div>
  );
}
