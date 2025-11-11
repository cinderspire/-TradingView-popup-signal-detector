'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';
import { format } from 'date-fns';

interface EquityDataPoint {
  tradeNumber: number;
  date: string;
  pnl: number;
  cumulativePnl: number;
  symbol: string | null;
}

interface EquityCurveChartProps {
  data: EquityDataPoint[];
  loading?: boolean;
}

export function EquityCurveChart({ data, loading = false }: EquityCurveChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading equity curve...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col items-center justify-center h-80">
          <span className="text-6xl mb-4">📈</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Trade Data</h3>
          <p className="text-gray-600">
            No completed trades yet. The equity curve will appear once trades are executed.
          </p>
        </div>
      </div>
    );
  }

  const finalPnl = data[data.length - 1]?.cumulativePnl || 0;
  const maxEquity = Math.max(...data.map(d => d.cumulativePnl));
  const minEquity = Math.min(...data.map(d => d.cumulativePnl));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Trade #{data.tradeNumber}</p>
          {data.symbol && <p className="text-sm font-semibold text-gray-900 mb-1">{data.symbol}</p>}
          <p className="text-sm text-gray-600 mb-1">{format(new Date(data.date), 'MMM dd, yyyy HH:mm')}</p>
          <div className="border-t border-gray-200 mt-2 pt-2">
            <p className={`text-sm font-semibold ${data.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Trade P/L: ${data.pnl.toFixed(2)}
            </p>
            <p className={`text-base font-bold ${data.cumulativePnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Total P/L: ${data.cumulativePnl.toFixed(2)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">📈 Equity Curve</h3>
        <p className="text-sm text-gray-600">Cumulative profit/loss over time from closed positions</p>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Current P/L</p>
          <p className={`text-2xl font-bold ${finalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${finalPnl.toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Peak Equity</p>
          <p className="text-2xl font-bold text-blue-600">${maxEquity.toFixed(2)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Lowest Point</p>
          <p className="text-2xl font-bold text-orange-600">${minEquity.toFixed(2)}</p>
        </div>
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="tradeNumber" label={{ value: 'Trade Number', position: 'insideBottom', offset: -5 }} tick={{ fontSize: 12 }} />
            <YAxis label={{ value: 'Cumulative P/L ($)', angle: -90, position: 'insideLeft' }} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="cumulativePnl" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} name="Cumulative P/L" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          <span className="font-semibold">{data.length - 1} trades</span> plotted. Each point represents a closed position. The line shows cumulative profit/loss over time.
        </p>
      </div>
    </div>
  );
}
