'use client';

import React, { useState } from 'react';
import { RiskConfig, Simulation, SimulationRequest } from '@/types/risk-management';
import { riskManagementApi } from '@/lib/risk-management-api';

interface RiskSimulatorProps {
  config: RiskConfig;
}

export function RiskSimulator({ config }: RiskSimulatorProps) {
  const [capitalAmount, setCapitalAmount] = useState<number>(10000);
  const [currentPrice, setCurrentPrice] = useState<number>(50000);
  const [winStreak, setWinStreak] = useState<number>(0);
  const [lossStreak, setLossStreak] = useState<number>(0);
  const [checkNewsImpact, setCheckNewsImpact] = useState<boolean>(false);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async () => {
    try {
      setLoading(true);
      setError(null);

      const request: SimulationRequest = {
        configId: config.id,
        capitalAmount,
        currentPrice,
      };

      if (config.type === 'ADAPTIVE') {
        request.winStreak = winStreak;
        request.lossStreak = lossStreak;
      }

      if (config.type === 'NEWS_BASED') {
        request.checkNewsImpact = checkNewsImpact;
      }

      const response = await riskManagementApi.simulateConfig(request);

      if (response.success) {
        setSimulation(response.data.simulation);
      } else {
        setError('Simulation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const renderSimulationResults = () => {
    if (!simulation) return null;

    return (
      <div className="mt-6 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-3">
            {simulation.type} Simulation Results
          </h4>
          <p className="text-sm text-blue-800 mb-4">{simulation.description}</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded p-3">
              <p className="text-xs text-gray-600">Position Size</p>
              <p className="text-lg font-bold text-gray-900">{simulation.positionSize}</p>
            </div>
            <div className="bg-white rounded p-3">
              <p className="text-xs text-gray-600">Position Value</p>
              <p className="text-lg font-bold text-gray-900">${simulation.positionValue}</p>
            </div>
            <div className="bg-white rounded p-3">
              <p className="text-xs text-gray-600">Risk Amount</p>
              <p className="text-lg font-bold text-gray-900">${simulation.riskAmount}</p>
            </div>
            <div className="bg-white rounded p-3">
              <p className="text-xs text-gray-600">Stop Loss Price</p>
              <p className="text-lg font-bold text-gray-900">${simulation.stopLossPrice}</p>
            </div>
          </div>

          {/* Type-specific details */}
          {simulation.type === 'FIXED' && 'positionPercent' in simulation && (
            <div className="mt-4 bg-white rounded p-3">
              <p className="text-xs text-gray-600">Position as % of Capital</p>
              <p className="text-lg font-bold text-gray-900">{simulation.positionPercent}%</p>
              {!simulation.isWithinLimits && (
                <p className="text-sm text-red-600 mt-1">
                  ⚠️ Exceeds max position size limit!
                </p>
              )}
            </div>
          )}

          {simulation.type === 'ADAPTIVE' && 'adjustedRiskPercent' in simulation && (
            <div className="mt-4 space-y-2">
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-600">Base Risk</p>
                <p className="text-lg font-bold text-gray-900">
                  {simulation.baseRiskPercent}%
                </p>
              </div>
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-600">Adjusted Risk</p>
                <p className="text-lg font-bold text-purple-600">
                  {simulation.adjustedRiskPercent}%
                </p>
              </div>
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-600">Streak Impact</p>
                <p className="text-sm font-semibold text-gray-900">
                  {simulation.streakImpact}
                </p>
              </div>
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-600">Risk Range</p>
                <p className="text-sm font-semibold text-gray-900">
                  {simulation.adaptiveRange}
                </p>
              </div>
            </div>
          )}

          {simulation.type === 'NEWS_BASED' && 'newsImpact' in simulation && (
            <div className="mt-4 space-y-2">
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-600">Base Risk</p>
                <p className="text-lg font-bold text-gray-900">
                  {simulation.baseRiskPercent}%
                </p>
              </div>
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-600">Adjusted Risk</p>
                <p className="text-lg font-bold text-orange-600">
                  {simulation.adjustedRiskPercent}%
                </p>
              </div>
              {simulation.newsImpact && (
                <div className="bg-orange-50 border border-orange-200 rounded p-3">
                  <p className="text-sm font-semibold text-orange-900">
                    ⚠️ News Impact Detected
                  </p>
                  <p className="text-xs text-orange-800 mt-1">
                    {simulation.newsImpact.message}
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    Reduction: {simulation.newsImpact.reduction}% | Safety Window:{' '}
                    {simulation.newsImpact.safetyWindow} min
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Potential Outcomes */}
        <div className="bg-gradient-to-r from-red-50 to-green-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Potential Outcomes</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-100 border border-red-200 rounded p-4">
              <p className="text-sm font-semibold text-red-900 mb-2">
                ❌ If Stop Loss Hit
              </p>
              <p className="text-2xl font-bold text-red-700">
                {simulation.potentialOutcomes.stopLossHit.loss}
              </p>
              <p className="text-xs text-red-600 mt-1">
                {simulation.potentialOutcomes.stopLossHit.percentLoss}%
              </p>
              <p className="text-xs text-red-700 mt-2">
                New Capital: ${simulation.potentialOutcomes.stopLossHit.newCapital}
              </p>
            </div>

            {simulation.potentialOutcomes.takeProfitHit && (
              <div className="bg-green-100 border border-green-200 rounded p-4">
                <p className="text-sm font-semibold text-green-900 mb-2">
                  ✅ If Take Profit Hit
                </p>
                <p className="text-2xl font-bold text-green-700">
                  +{simulation.potentialOutcomes.takeProfitHit.profit}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  +{simulation.potentialOutcomes.takeProfitHit.percentGain}%
                </p>
                <p className="text-xs text-green-700 mt-2">
                  New Capital: ${simulation.potentialOutcomes.takeProfitHit.newCapital}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">
        🧪 Risk Configuration Simulator
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Test this configuration with different market conditions before using it in live trading.
      </p>

      {/* Input Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capital Amount ($)
            </label>
            <input
              type="number"
              value={capitalAmount}
              onChange={(e) => setCapitalAmount(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="100"
              step="100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Price ($)
            </label>
            <input
              type="number"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              step="0.01"
            />
          </div>
        </div>

        {/* Adaptive-specific inputs */}
        {config.type === 'ADAPTIVE' && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-1">
                Win Streak
              </label>
              <input
                type="number"
                value={winStreak}
                onChange={(e) => {
                  setWinStreak(Number(e.target.value));
                  setLossStreak(0);
                }}
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                min="0"
                max="10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-700 mb-1">
                Loss Streak
              </label>
              <input
                type="number"
                value={lossStreak}
                onChange={(e) => {
                  setLossStreak(Number(e.target.value));
                  setWinStreak(0);
                }}
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                min="0"
                max="10"
              />
            </div>
          </div>
        )}

        {/* News-based specific inputs */}
        {config.type === 'NEWS_BASED' && (
          <div className="p-4 bg-orange-50 rounded-lg">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={checkNewsImpact}
                onChange={(e) => setCheckNewsImpact(e.target.checked)}
                className="rounded border-orange-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-orange-700">
                Simulate High-Impact News Event
              </span>
            </label>
            <p className="text-xs text-orange-600 mt-1 ml-6">
              When checked, simulates a high-impact news event within the safety window
            </p>
          </div>
        )}

        {/* Simulate Button */}
        <button
          onClick={handleSimulate}
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? '⏳ Simulating...' : '🚀 Run Simulation'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-semibold">❌ Simulation Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Results */}
      {renderSimulationResults()}
    </div>
  );
}
