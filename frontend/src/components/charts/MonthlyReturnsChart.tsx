'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell
} from 'recharts';

interface MonthlyReturnData {
  month: string;
  trades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  avgPnl: number;
  winRate: number;
}

interface MonthlyReturnsChartProps {
  data: MonthlyReturnData[];
  loading?: boolean;
}

export function MonthlyReturnsChart({ data, loading = false }: MonthlyReturnsChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading monthly returns...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col items-center justify-center h-80">
          <span className="text-6xl mb-4">📊</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Monthly Data</h3>
          <p className="text-gray-600">No completed trades yet. Monthly returns will appear once trades are executed.</p>
        </div>
      </div>
    );
  }

  const profitableMonths = data.filter(d => d.totalPnl > 0).length;
  const bestMonth = data.reduce((best, current) => current.totalPnl > best.totalPnl ? current : best);
  const worstMonth = data.reduce((worst, current) => current.totalPnl < worst.totalPnl ? current : worst);

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">📊 Monthly Returns</h3>
        <p className="text-sm text-gray-600">Profit/loss breakdown by month</p>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Profitable Months</p>
          <p className="text-2xl font-bold text-green-600">{profitableMonths}/{data.length}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Best Month</p>
          <p className="text-sm font-semibold text-gray-900 mb-0.5">{formatMonth(bestMonth.month)}</p>
          <p className="text-lg font-bold text-green-600">${bestMonth.totalPnl.toFixed(2)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Worst Month</p>
          <p className="text-sm font-semibold text-gray-900 mb-0.5">{formatMonth(worstMonth.month)}</p>
          <p className="text-lg font-bold text-red-600">${worstMonth.totalPnl.toFixed(2)}</p>
        </div>
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 12 }} />
            <YAxis label={{ value: 'P/L ($)', angle: -90, position: 'insideLeft' }} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <Bar dataKey="totalPnl" name="Monthly P/L" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.totalPnl >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
