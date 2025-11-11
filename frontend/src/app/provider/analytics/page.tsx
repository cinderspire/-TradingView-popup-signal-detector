'use client';

import React from 'react';

export default function ProviderAnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">💹 Provider Analytics</h1>
        <p className="text-gray-600 mb-8">Detailed performance and revenue analytics</p>

        {/* Revenue Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">This Month Revenue</p>
            <p className="text-2xl font-bold text-gray-900">$0.00</p>
            <p className="text-sm text-gray-500 mt-1">0% from last month</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Total Lifetime Revenue</p>
            <p className="text-2xl font-bold text-gray-900">$0.00</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Avg Revenue Per User</p>
            <p className="text-2xl font-bold text-gray-900">$0.00</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Projected Annual</p>
            <p className="text-2xl font-bold text-green-600">$0.00</p>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 Revenue Trend</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">Revenue chart coming soon</p>
          </div>
        </div>

        {/* Strategy Performance */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Strategy Performance</h3>
          <div className="text-center py-12 text-gray-500">
            <p>No strategy data available</p>
          </div>
        </div>
      </div>
    </div>
  );
}
