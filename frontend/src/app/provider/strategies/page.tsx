'use client';

import React from 'react';
import Link from 'next/link';

export default function ProviderStrategiesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">📈 My Strategies</h1>
            <p className="text-gray-600">Manage and optimize your trading strategies</p>
          </div>
          <Link
            href="/strategies/create"
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
          >
            ➕ Create Strategy
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <span className="text-6xl mb-4 block">📊</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Strategies Yet</h3>
          <p className="text-gray-600 mb-6">Create your first strategy to start earning</p>
          <Link
            href="/strategies/create"
            className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Create Your First Strategy
          </Link>
        </div>
      </div>
    </div>
  );
}
