'use client';

import React from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              ⚙️ Settings
            </h1>
            <p className="text-lg text-gray-600">
              Manage your account preferences, notifications, and platform settings
            </p>
          </div>

          {/* Coming Soon Banner */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🚧</span>
              <div>
                <p className="font-semibold text-yellow-900">Settings Page Under Development</p>
                <p className="text-sm text-yellow-800">
                  Advanced settings configuration will be available soon. Basic account info is displayed below.
                </p>
              </div>
            </div>
          </div>

          {/* Settings Categories */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Account Settings */}
            <SettingsCard
              icon="👤"
              title="Account Settings"
              description="Manage your personal information and account details"
              items={[
                'Update email address',
                'Change username',
                'Edit profile information',
                'Delete account',
              ]}
              comingSoon={true}
            />

            {/* Security Settings */}
            <SettingsCard
              icon="🔐"
              title="Security & Privacy"
              description="Protect your account with advanced security features"
              items={[
                'Change password',
                'Enable two-factor authentication (2FA)',
                'Manage active sessions',
                'View login history',
              ]}
              comingSoon={true}
            />

            {/* Notification Settings */}
            <SettingsCard
              icon="🔔"
              title="Notifications"
              description="Control how and when you receive notifications"
              items={[
                'Email notifications',
                'Browser push notifications',
                'Trading signal alerts',
                'Account activity alerts',
              ]}
              comingSoon={true}
            />

            {/* Trading Preferences */}
            <SettingsCard
              icon="📊"
              title="Trading Preferences"
              description="Configure your default trading settings"
              items={[
                'Default risk management config',
                'Auto-trading settings',
                'Preferred trading pairs',
                'Order execution preferences',
              ]}
              comingSoon={true}
            />

            {/* API & Integration */}
            <SettingsCard
              icon="🔌"
              title="API & Integrations"
              description="Connect external services and manage API keys"
              items={[
                'Exchange API keys',
                'Webhook configurations',
                'Third-party integrations',
                'API usage statistics',
              ]}
              comingSoon={true}
            />

            {/* Subscription & Billing */}
            <SettingsCard
              icon="💳"
              title="Subscription & Billing"
              description="Manage your subscriptions and payment methods"
              items={[
                'Active strategy subscriptions',
                'Payment methods',
                'Billing history',
                'Invoice downloads',
              ]}
              comingSoon={true}
            />
          </div>

          {/* Provider-Only Settings */}
          {user?.role === 'PROVIDER' && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                💼 Provider Settings
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <SettingsCard
                  icon="📢"
                  title="Signal Broadcasting"
                  description="Configure how you send signals to subscribers"
                  items={[
                    'Default signal templates',
                    'Auto-send settings',
                    'Subscriber notification preferences',
                    'Signal delivery tracking',
                  ]}
                  comingSoon={true}
                />

                <SettingsCard
                  icon="💰"
                  title="Revenue & Payouts"
                  description="Manage your earnings and payout preferences"
                  items={[
                    'Payout methods',
                    'Subscription pricing',
                    'Commission structure',
                    'Tax information',
                  ]}
                  comingSoon={true}
                />
              </div>
            </div>
          )}

          {/* Admin-Only Settings */}
          {user?.role === 'ADMIN' && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                🛡️ Admin Settings
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <SettingsCard
                  icon="👥"
                  title="User Management"
                  description="Manage users and permissions"
                  items={[
                    'View all users',
                    'Manage user roles',
                    'Suspend/activate accounts',
                    'User activity logs',
                  ]}
                  comingSoon={true}
                />

                <SettingsCard
                  icon="⚙️"
                  title="Platform Configuration"
                  description="Configure platform-wide settings"
                  items={[
                    'System parameters',
                    'Feature flags',
                    'Maintenance mode',
                    'Performance monitoring',
                  ]}
                  comingSoon={true}
                />
              </div>
            </div>
          )}

          {/* Current Account Info */}
          <div className="mt-8 bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Current Account Information
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600 mb-1">Email</p>
                <p className="font-semibold text-gray-900">{user?.email}</p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Username</p>
                <p className="font-semibold text-gray-900">{user?.username}</p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Account Type</p>
                <p className="font-semibold text-gray-900">{user?.role}</p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Status</p>
                <p className="font-semibold text-green-600">
                  {user?.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Email Verified</p>
                <p className="font-semibold text-gray-900">
                  {user?.emailVerified ? 'Yes ✓' : 'No ✗'}
                </p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Member Since</p>
                <p className="font-semibold text-gray-900">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              ← Back to Dashboard
            </Link>
            <Link
              href="/profile"
              className="px-6 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold"
            >
              View Profile
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function SettingsCard({ icon, title, description, items, comingSoon }: {
  icon: string;
  title: string;
  description: string;
  items: string[];
  comingSoon?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-4 mb-4">
        <div className="text-4xl flex-shrink-0">{icon}</div>
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-bold text-gray-900">{title}</h3>
            {comingSoon && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                Soon
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="text-sm text-gray-700 flex items-start space-x-2">
            <span className="text-gray-400 flex-shrink-0">•</span>
            <span className={comingSoon ? 'text-gray-500' : ''}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
