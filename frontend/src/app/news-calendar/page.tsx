'use client';

import React, { useState, useEffect } from 'react';

interface NewsEvent {
  id: string;
  datetime: string;
  currency: string;
  event_name: string;
  impact: string;
  actual?: string;
  forecast?: string;
  previous?: string;
}

export default function NewsCalendarPage() {
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterImpact, setFilterImpact] = useState('all');

  useEffect(() => {
    fetchNewsEvents();
  }, []);

  const fetchNewsEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:6864/api/news-calendar', {
        credentials: 'include',
      });
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Error fetching news events:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(
    (event) => filterImpact === 'all' || event.impact.toLowerCase() === filterImpact.toLowerCase()
  );

  const getImpactColor = (impact: string) => {
    switch (impact.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">📅 Economic Calendar</h1>
        <p className="text-gray-600 mb-8">Stay updated with important economic events and market news</p>

        {/* Impact Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Filter by Impact:</span>
            <div className="flex space-x-2">
              {['all', 'high', 'medium', 'low'].map((impact) => (
                <button
                  key={impact}
                  onClick={() => setFilterImpact(impact)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterImpact === impact
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {impact.charAt(0).toUpperCase() + impact.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🔴</span>
              <div>
                <p className="text-sm text-red-600 font-medium">High Impact</p>
                <p className="text-xs text-red-500">Major market movers</p>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🟡</span>
              <div>
                <p className="text-sm text-yellow-600 font-medium">Medium Impact</p>
                <p className="text-xs text-yellow-500">Moderate volatility expected</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🟢</span>
              <div>
                <p className="text-sm text-green-600 font-medium">Low Impact</p>
                <p className="text-xs text-green-500">Minor market effect</p>
              </div>
            </div>
          </div>
        </div>

        {/* Events List */}
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <span className="text-6xl mb-4 block">📅</span>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Events Found</h3>
            <p className="text-gray-600">No economic events scheduled at the moment</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actual</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Forecast</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Previous</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(event.datetime).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                          {event.currency}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{event.event_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getImpactColor(event.impact)}`}>
                          {event.impact}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {event.actual || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{event.forecast || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{event.previous || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
