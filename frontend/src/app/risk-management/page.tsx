'use client';

import React, { useState } from 'react';
import { RiskConfig } from '@/types/risk-management';
import { RiskConfigList } from '@/components/risk-management/RiskConfigList';
import { RiskSimulator } from '@/components/risk-management/RiskSimulator';
import { RiskConfigForm } from '@/components/risk-management/RiskConfigForm';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function RiskManagementPage() {
  const [selectedConfig, setSelectedConfig] = useState<RiskConfig | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEdit = (config: RiskConfig) => {
    setSelectedConfig(config);
    setShowForm(true);
    setShowSimulator(false);
  };

  const handleSimulate = (config: RiskConfig) => {
    setSelectedConfig(config);
    setShowSimulator(true);
    setShowForm(false);
  };

  const handleCreateNew = () => {
    setSelectedConfig(null);
    setShowForm(true);
    setShowSimulator(false);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedConfig(null);
  };

  const handleCloseSimulator = () => {
    setShowSimulator(false);
    setSelectedConfig(null);
  };

  const handleFormSuccess = (config: RiskConfig) => {
    setShowForm(false);
    setSelectedConfig(null);
    // Refresh the list by changing the key
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            ⚙️ Risk Management
          </h1>
          <p className="text-lg text-gray-600">
            Configure and manage your trading risk parameters for safe and controlled trading.
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Simulator Panel (if open) */}
          {showSimulator && selectedConfig && (
            <div className="relative">
              <button
                onClick={handleCloseSimulator}
                className="absolute top-4 right-4 z-10 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                ✖️ Close Simulator
              </button>
              <RiskSimulator config={selectedConfig} />
            </div>
          )}

          {/* Form Panel (if open) */}
          {showForm && (
            <RiskConfigForm
              config={selectedConfig}
              onSuccess={handleFormSuccess}
              onCancel={handleCloseForm}
            />
          )}

          {/* Configuration List */}
          <RiskConfigList
            key={refreshKey}
            onEdit={handleEdit}
            onCreateNew={handleCreateNew}
            onSimulate={handleSimulate}
          />
        </div>

        {/* Quick Tips */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">💡 Quick Tips</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-semibold text-blue-900">📊 FIXED Risk</p>
              <p className="text-gray-700 mt-1">
                Best for beginners. Consistent risk percentage per trade. Recommended: 0.5-2% per trade.
              </p>
            </div>
            <div>
              <p className="font-semibold text-purple-900">🎯 ADAPTIVE Risk</p>
              <p className="text-gray-700 mt-1">
                For experienced traders. Automatically adjusts based on win/loss streaks. Requires careful tuning.
              </p>
            </div>
            <div>
              <p className="font-semibold text-orange-900">📰 NEWS_BASED Risk</p>
              <p className="text-gray-700 mt-1">
                Reduces position sizes before high-impact news events. Integrates with economic calendar.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Info */}
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🎯 Risk Management Features</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Position Sizing</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Automatic position size calculation</li>
                <li>• Risk percentage based sizing</li>
                <li>• Max position size enforcement</li>
                <li>• Capital preservation focus</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Stop Loss & Take Profit</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Automated SL/TP levels</li>
                <li>• Risk-reward ratio enforcement</li>
                <li>• Configurable percentages</li>
                <li>• Outcome projections</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Portfolio Protection</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Max daily loss limits</li>
                <li>• Drawdown protection</li>
                <li>• Multiple position limits</li>
                <li>• Leverage controls</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Advanced Features</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Performance-based adaptation</li>
                <li>• News event integration</li>
                <li>• Configuration simulation</li>
                <li>• Statistics tracking</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      </div>
    </ProtectedRoute>
  );
}
