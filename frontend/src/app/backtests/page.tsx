'use client';

import React, { useState, useEffect } from 'react';

interface Backtest {
  id: string;
  status: string;
  pair: string;
  exchange: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  winRate?: number;
  totalTrades?: number;
  netProfit?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  createdAt: string;
  strategy: {
    name: string;
  };
}

export default function BacktestsPage() {
  const [backtests, setBacktests] = useState<Backtest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBacktests();
  }, []);

  const fetchBacktests = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:6864/api/backtests', {
        credentials: 'include',
      });
      const data = await response.json();
      setBacktests(data.backtests || []);
    } catch (err) {
      console.error('Error fetching backtests:', err);
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">📉 Strategy Backtests</h1>
            <p className="text-gray-600">Test strategies against historical data</p>
          </div>
          <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md">
            ➕ New Backtest
          </button>
        </div>

        {backtests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <span className="text-6xl mb-4 block">📉</span>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Backtests Yet</h3>
            <p className="text-gray-600 mb-6">Start testing your strategies with historical data</p>
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold">
              Run Your First Backtest
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {backtests.map((backtest) => (
              <div key={backtest.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{backtest.strategy.name}</h3>
                    <p className="text-sm text-gray-500">
                      {backtest.pair} • {backtest.timeframe} • {backtest.exchange}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      backtest.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : backtest.status === 'RUNNING'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {backtest.status}
                  </span>
                </div>

                {backtest.status === 'COMPLETED' && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Win Rate</p>
                      <p className="text-lg font-semibold text-green-600">{backtest.winRate?.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Trades</p>
                      <p className="text-lg font-semibold text-gray-900">{backtest.totalTrades}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Net Profit</p>
                      <p className={`text-lg font-semibold ${(backtest.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${backtest.netProfit?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Max DD</p>
                      <p className="text-lg font-semibold text-red-600">{backtest.maxDrawdown?.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Sharpe</p>
                      <p className="text-lg font-semibold text-blue-600">{backtest.sharpeRatio?.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
