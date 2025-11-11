'use client';

import React, { useEffect, useState } from 'react';
import { RiskConfig, RiskConfigStats, RiskConfigType } from '@/types/risk-management';
import { riskManagementApi } from '@/lib/risk-management-api';
import { RiskConfigCard } from './RiskConfigCard';

interface RiskConfigListProps {
  onEdit?: (config: RiskConfig) => void;
  onCreateNew?: () => void;
  onSimulate?: (config: RiskConfig) => void;
}

export function RiskConfigList({ onEdit, onCreateNew, onSimulate }: RiskConfigListProps) {
  const [configs, setConfigs] = useState<RiskConfig[]>([]);
  const [stats, setStats] = useState<RiskConfigStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<RiskConfigType | 'ALL'>('ALL');
  const [filterActive, setFilterActive] = useState<boolean | 'ALL'>('ALL');

  const loadConfigs = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (filterType !== 'ALL') filters.type = filterType;
      if (filterActive !== 'ALL') filters.isActive = filterActive;

      const response = await riskManagementApi.listConfigs(filters);

      if (response.success) {
        setConfigs(response.data.configs);
        setStats(response.data.stats);
      } else {
        setError('Failed to load configurations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, [filterType, filterActive]);

  const handleDelete = async (id: string) => {
    try {
      const response = await riskManagementApi.deleteConfig(id);
      if (response.success) {
        await loadConfigs(); // Reload list
      } else {
        alert('Failed to delete configuration: ' + response.message);
      }
    } catch (err) {
      alert('Error deleting configuration: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await riskManagementApi.setAsDefault(id);
      if (response.success) {
        await loadConfigs(); // Reload list
      } else {
        alert('Failed to set as default: ' + response.message);
      }
    } catch (err) {
      alert('Error setting as default: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await riskManagementApi.toggleActive(id, isActive);
      if (response.success) {
        await loadConfigs(); // Reload list
      } else {
        alert('Failed to toggle active status: ' + response.message);
      }
    } catch (err) {
      alert('Error toggling active status: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading configurations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800 font-semibold">❌ Error</p>
        <p className="text-red-600 mt-2">{error}</p>
        <button
          onClick={loadConfigs}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-4">Risk Management Configurations</h2>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90">Total Configs</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90">Fixed</p>
              <p className="text-3xl font-bold">{stats.byType.FIXED}</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90">Adaptive</p>
              <p className="text-3xl font-bold">{stats.byType.ADAPTIVE}</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90">News-Based</p>
              <p className="text-3xl font-bold">{stats.byType.NEWS_BASED}</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90">Active</p>
              <p className="text-3xl font-bold">{stats.active}</p>
            </div>
          </div>
        )}

        {stats?.default && (
          <div className="mt-4 bg-white bg-opacity-20 rounded-lg p-4">
            <p className="text-sm opacity-90">Default Configuration</p>
            <p className="text-lg font-semibold">
              ⭐ {stats.default.name} ({stats.default.type})
            </p>
          </div>
        )}
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-lg shadow p-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as RiskConfigType | 'ALL')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Types</option>
              <option value="FIXED">Fixed</option>
              <option value="ADAPTIVE">Adaptive</option>
              <option value="NEWS_BASED">News-Based</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={String(filterActive)}
              onChange={(e) =>
                setFilterActive(
                  e.target.value === 'ALL' ? 'ALL' : e.target.value === 'true'
                )
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={loadConfigs}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            🔄 Refresh
          </button>
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-semibold"
            >
              ➕ Create New Config
            </button>
          )}
        </div>
      </div>

      {/* Configuration List */}
      {configs.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg mb-4">
            {filterType !== 'ALL' || filterActive !== 'ALL'
              ? 'No configurations match your filters'
              : 'No risk configurations yet'}
          </p>
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold"
            >
              Create Your First Configuration
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {configs.map((config) => (
            <RiskConfigCard
              key={config.id}
              config={config}
              onEdit={onEdit}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
