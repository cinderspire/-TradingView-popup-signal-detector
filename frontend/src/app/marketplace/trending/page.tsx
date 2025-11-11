'use client';

import React from 'react';
import Link from 'next/link';

export default function TrendingStrategiesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">🔥 Trending Strategies</h1>
        <p className="text-gray-600 mb-8">Hot strategies and top performers this week</p>

        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <span className="text-6xl mb-4 block">🔥</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Coming Soon</h3>
          <p className="text-gray-600 mb-6">Trending strategies feature is under development</p>
          <Link
            href="/strategies"
            className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Browse All Strategies
          </Link>
        </div>
      </div>
    </div>
  );
}
