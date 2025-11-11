'use client';

import React from 'react';

export default function ProviderSubscribersPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">👥 My Subscribers</h1>
        <p className="text-gray-600 mb-8">View and manage your strategy subscribers</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Total Subscribers</p>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">New This Month</p>
            <p className="text-3xl font-bold text-green-600">0</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600">Churn Rate</p>
            <p className="text-3xl font-bold text-gray-900">0%</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <span className="text-6xl mb-4 block">👥</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Subscribers Yet</h3>
          <p className="text-gray-600">Start attracting subscribers by publishing great strategies</p>
        </div>
      </div>
    </div>
  );
}
