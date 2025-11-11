'use client';

import React from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              👤 My Profile
            </h1>
            <p className="text-lg text-gray-600">
              View and manage your account information
            </p>
          </div>

          {/* Current User Info (Read-Only Display) */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 mb-8">
            <div className="flex items-start space-x-6 mb-8">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              </div>

              {/* User Details */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.username}
                </h2>
                <p className="text-gray-600 mb-3">@{user?.username}</p>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    user?.role === 'ADMIN'
                      ? 'bg-red-100 text-red-800'
                      : user?.role === 'PROVIDER'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {user?.role}
                  </span>
                  {user?.isActive && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                      ✓ Active
                    </span>
                  )}
                  {user?.emailVerified && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                      ✓ Email Verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Email Address
                </label>
                <p className="text-gray-900 font-medium">{user?.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Username
                </label>
                <p className="text-gray-900 font-medium">{user?.username}</p>
              </div>

              {user?.firstName && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    First Name
                  </label>
                  <p className="text-gray-900 font-medium">{user.firstName}</p>
                </div>
              )}

              {user?.lastName && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Last Name
                  </label>
                  <p className="text-gray-900 font-medium">{user.lastName}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Member Since
                </label>
                <p className="text-gray-900 font-medium">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Last Updated
                </label>
                <p className="text-gray-900 font-medium">
                  {user?.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Editing Coming Soon */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center mb-8">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Profile Editing Coming Soon
            </h3>
            <p className="text-gray-600 mb-6">
              Soon you'll be able to edit your profile information, upload a custom avatar, and more.
            </p>

            <div className="grid md:grid-cols-2 gap-4 max-w-xl mx-auto mb-6 text-left">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">✏️ Edit Profile</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Update personal information</li>
                  <li>• Change email address</li>
                  <li>• Modify username</li>
                </ul>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">🔐 Security</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Change password</li>
                  <li>• Enable 2FA</li>
                  <li>• Manage sessions</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">🖼️ Avatar</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Upload custom avatar</li>
                  <li>• Choose from library</li>
                  <li>• Auto-generated options</li>
                </ul>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">📊 Stats</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Trading performance</li>
                  <li>• Account activity</li>
                  <li>• Subscription history</li>
                </ul>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              ← Back to Dashboard
            </Link>
          </div>

          {/* Account Type Info */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              {user?.role === 'PROVIDER' ? '💼 Provider Account Benefits' : '👤 Account Benefits'}
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              {user?.role === 'PROVIDER' ? (
                <>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">Create and publish trading strategies</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">Broadcast signals to subscribers</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">Earn revenue from subscriptions</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">Access to provider analytics</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">Build your trading reputation</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">Manage subscriber base</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">Subscribe to unlimited strategies</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">Receive real-time trading signals</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">Advanced risk management tools</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">Copy trading automation</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">Performance analytics dashboard</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span className="text-gray-700">24/7 customer support</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
