'use client';

import React, { useState, useEffect } from 'react';
import { Strategy, StrategyFilters, COMMON_TRADING_PAIRS } from '@/types/strategy';
import { strategyApi } from '@/lib/strategy-api';
import { StrategyCard } from './StrategyCard';

interface StrategyListProps {
  onViewDetails?: (strategy: Strategy) => void;
  onSubscribe?: (strategy: Strategy) => void;
  onUnsubscribe?: (strategy: Strategy) => void;
  onStartTrial?: (strategy: Strategy) => void;
  isProvider?: boolean;
  onEdit?: (strategy: Strategy) => void;
  onDelete?: (strategy: Strategy) => void;
  showMyStrategies?: boolean; // For providers to show their own strategies
  trialDays?: number;
}

export function StrategyList({
  onViewDetails,
  onSubscribe,
  onUnsubscribe,
  onStartTrial,
  isProvider = false,
  onEdit,
  onDelete,
  showMyStrategies = false,
  trialDays = 14,
}: StrategyListProps) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [subscribedStrategyIds, setSubscribedStrategyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPair, setSelectedPair] = useState<string>('');
  const [minWinRate, setMinWinRate] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'winRate' | 'totalReturn' | 'subscriberCount' | 'price'>('winRate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Load strategies
  const loadStrategies = async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: StrategyFilters = {
        page: currentPage,
        limit: 12,
        sortBy,
        sortOrder,
      };

      if (searchQuery) filters.search = searchQuery;
      if (selectedPair) filters.tradingPair = selectedPair;
      if (minWinRate > 0) filters.minWinRate = minWinRate;
      if (maxPrice > 0) filters.maxPrice = maxPrice;

      // Load strategies (either marketplace or provider's own)
      const response = showMyStrategies
        ? await strategyApi.getMyStrategies(filters)
        : await strategyApi.listStrategies({ ...filters, isPublic: true, status: 'ACTIVE' });

      if (response.success) {
        const strategiesData = response.data.strategies;

        // Fetch real performance stats for each strategy in parallel
        const strategiesWithStats = await Promise.all(
          strategiesData.map(async (strategy: Strategy) => {
            try {
              const statsResponse = await fetch(`http://localhost:6864/api/stats/strategy/${strategy.id}`);
              if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                return { ...strategy, performanceStats: statsData.performance };
              }
            } catch (err) {
              console.error(`Failed to fetch stats for strategy ${strategy.id}:`, err);
            }
            return strategy;
          })
        );

        setStrategies(strategiesWithStats);
        setTotal(response.data.total);
        setTotalPages(response.data.totalPages);
      } else {
        setError(response.message || 'Failed to load strategies');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Load user's subscriptions
  const loadSubscriptions = async () => {
    if (isProvider || showMyStrategies) return; // Providers don't need to check subscriptions

    try {
      const response = await strategyApi.getMySubscriptions();
      if (response.success) {
        const subscribedIds = new Set(
          response.data.subscriptions
            .filter((sub) => sub.status === 'ACTIVE')
            .map((sub) => sub.strategyId)
        );
        setSubscribedStrategyIds(subscribedIds);
      }
    } catch (err) {
      console.error('Error loading subscriptions:', err);
    }
  };

  // Initial load
  useEffect(() => {
    loadStrategies();
    loadSubscriptions();
  }, [currentPage, sortBy, sortOrder]);

  // Apply filters (with debounce effect)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        loadStrategies();
      } else {
        setCurrentPage(1); // Reset to page 1 when filters change
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedPair, minWinRate, maxPrice]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedPair('');
    setMinWinRate(0);
    setMaxPrice(0);
    setSortBy('winRate');
    setSortOrder('desc');
  };

  if (loading && strategies.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading strategies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800 font-semibold">❌ Error</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={loadStrategies}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search strategies..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Trading Pair */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trading Pair
            </label>
            <select
              value={selectedPair}
              onChange={(e) => setSelectedPair(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Pairs</option>
              {COMMON_TRADING_PAIRS.map((pair) => (
                <option key={pair} value={pair}>
                  {pair}
                </option>
              ))}
            </select>
          </div>

          {/* Min Win Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Win Rate (%)
            </label>
            <input
              type="number"
              value={minWinRate || ''}
              onChange={(e) => setMinWinRate(Number(e.target.value))}
              placeholder="0"
              min="0"
              max="100"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Price ($)
            </label>
            <input
              type="number"
              value={maxPrice || ''}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              placeholder="0"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Sort and Clear */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="winRate">Win Rate</option>
                <option value="totalReturn">Total Return</option>
                <option value="subscriberCount">Subscribers</option>
                <option value="price">Price</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="desc">High to Low</option>
                <option value="asc">Low to High</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleClearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {strategies.length} of {total} strategies
        </p>
      </div>

      {/* Strategy Grid */}
      {strategies.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">
            No strategies found
          </p>
          <p className="text-gray-600 mb-4">
            Try adjusting your filters or check back later for new strategies
          </p>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {strategies.map((strategy) => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              isSubscribed={subscribedStrategyIds.has(strategy.id)}
              onSubscribe={onSubscribe}
              onUnsubscribe={onUnsubscribe}
              onStartTrial={onStartTrial}
              onViewDetails={onViewDetails}
              onEdit={onEdit}
              onDelete={onDelete}
              isProvider={isProvider}
              trialDays={trialDays}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = i + 1;
            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-4 py-2 border rounded-md ${
                  currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            );
          })}

          {totalPages > 5 && <span className="px-2">...</span>}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
