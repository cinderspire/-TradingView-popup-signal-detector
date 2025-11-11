'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { SignalCard } from './SignalCard';
import { useSignalWebSocket } from '@/hooks/useSignalWebSocket';
import { signalApi } from '@/lib/signal-api';
import type {
  Signal,
  SignalFilters,
  SignalType,
  SignalDirection,
  SignalStatus,
} from '@/types/signal';

interface SignalFeedProps {
  initialFilters?: SignalFilters;
  onExecuteSignal?: (signal: Signal) => void;
  onViewSignalDetails?: (signal: Signal) => void;
  showFilters?: boolean;
  autoSubscribeStrategies?: string[]; // Auto-subscribe to these strategy IDs
}

export function SignalFeed({
  initialFilters = {},
  onExecuteSignal,
  onViewSignalDetails,
  showFilters = true,
  autoSubscribeStrategies = [],
}: SignalFeedProps) {
  // State
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SignalFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<SignalStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<SignalType | 'ALL'>('ALL');
  const [directionFilter, setDirectionFilter] = useState<SignalDirection | 'ALL'>('ALL');
  const [symbolFilter, setSymbolFilter] = useState('');

  // WebSocket connection for real-time updates
  const { isConnected, subscribeToStrategy } = useSignalWebSocket({
    onNewSignal: (newSignal) => {
      console.log('New signal received in feed:', newSignal);
      setSignals((prev) => {
        // Check if signal already exists
        const exists = prev.find((s) => s.id === newSignal.id);
        if (exists) return prev;
        // Add new signal to the beginning
        return [newSignal, ...prev];
      });
    },
    onSignalUpdate: (updatedSignal) => {
      console.log('Signal update received in feed:', updatedSignal);
      setSignals((prev) =>
        prev.map((s) => (s.id === updatedSignal.id ? updatedSignal : s))
      );
    },
    onSignalClosed: (closedSignal) => {
      console.log('Signal closed in feed:', closedSignal);
      setSignals((prev) =>
        prev.map((s) => (s.id === closedSignal.id ? closedSignal : s))
      );
    },
    onConnect: () => {
      console.log('WebSocket connected');
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
    },
    onError: (err) => {
      console.error('WebSocket error:', err);
    },
  });

  // Auto-subscribe to strategies on connect
  useEffect(() => {
    if (isConnected && autoSubscribeStrategies.length > 0) {
      autoSubscribeStrategies.forEach((strategyId) => {
        subscribeToStrategy(strategyId);
      });
    }
  }, [isConnected, autoSubscribeStrategies, subscribeToStrategy]);

  // Load signals
  const loadSignals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build filters object
      const apiFilters: SignalFilters = {
        ...filters,
        page,
        limit: 20,
      };

      // Apply local filter states
      if (statusFilter !== 'ALL') {
        apiFilters.status = statusFilter;
      }
      if (typeFilter !== 'ALL') {
        apiFilters.type = typeFilter;
      }
      if (directionFilter !== 'ALL') {
        apiFilters.direction = directionFilter;
      }
      if (symbolFilter) {
        apiFilters.symbol = symbolFilter;
      }

      const response = await signalApi.listSignals(apiFilters);

      if (response.success) {
        setSignals(response.data.signals);
        setTotal(response.data.total);
        setTotalPages(response.data.totalPages);
      } else {
        setError('Failed to load signals');
      }
    } catch (err) {
      console.error('Error loading signals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load signals');
    } finally {
      setLoading(false);
    }
  }, [filters, page, statusFilter, typeFilter, directionFilter, symbolFilter]);

  // Load signals on mount and when filters change
  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, directionFilter, symbolFilter]);

  // Handle execute signal
  const handleExecute = useCallback(
    (signal: Signal) => {
      onExecuteSignal?.(signal);
    },
    [onExecuteSignal]
  );

  // Handle view details
  const handleViewDetails = useCallback(
    (signal: Signal) => {
      onViewSignalDetails?.(signal);
    },
    [onViewSignalDetails]
  );

  // Handle filter changes
  const handleStatusFilterChange = (status: SignalStatus | 'ALL') => {
    setStatusFilter(status);
  };

  const handleTypeFilterChange = (type: SignalType | 'ALL') => {
    setTypeFilter(type);
  };

  const handleDirectionFilterChange = (direction: SignalDirection | 'ALL') => {
    setDirectionFilter(direction);
  };

  const handleSymbolFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSymbolFilter(e.target.value);
  };

  const clearFilters = () => {
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setDirectionFilter('ALL');
    setSymbolFilter('');
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage((prev) => prev + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* WebSocket Connection Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          <span className="text-sm text-gray-600">
            {isConnected ? 'Live Updates Active' : 'Connecting...'}
          </span>
        </div>
        <button
          onClick={loadSignals}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  handleStatusFilterChange(e.target.value as SignalStatus | 'ALL')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ACTIVE">Active</option>
                <option value="EXECUTED">Executed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) =>
                  handleTypeFilterChange(e.target.value as SignalType | 'ALL')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="ENTRY">Entry</option>
                <option value="EXIT">Exit</option>
                <option value="UPDATE">Update</option>
              </select>
            </div>

            {/* Direction Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Direction
              </label>
              <select
                value={directionFilter}
                onChange={(e) =>
                  handleDirectionFilterChange(e.target.value as SignalDirection | 'ALL')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Directions</option>
                <option value="LONG">Long</option>
                <option value="SHORT">Short</option>
              </select>
            </div>

            {/* Symbol Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Symbol
              </label>
              <input
                type="text"
                value={symbolFilter}
                onChange={handleSymbolFilterChange}
                placeholder="e.g., BTC/USDT"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Results Count */}
      {!loading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {signals.length} of {total} signals
          </p>
          {totalPages > 1 && (
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </p>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && signals.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg mb-2">No signals found</p>
          <p className="text-gray-500 text-sm">
            Try adjusting your filters or check back later for new signals
          </p>
        </div>
      )}

      {/* Signals Grid */}
      {!loading && !error && signals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {signals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onExecute={handleExecute}
              onViewDetails={handleViewDetails}
              showActions={true}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={handlePreviousPage}
            disabled={page === 1}
            className={`px-4 py-2 rounded-md font-semibold ${
              page === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={page === totalPages}
            className={`px-4 py-2 rounded-md font-semibold ${
              page === totalPages
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
