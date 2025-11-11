'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface DropdownItem {
  href: string;
  label: string;
  icon?: string;
  description?: string;
}

interface NavCategory {
  label: string;
  icon?: string;
  items: DropdownItem[];
}

export function Navigation() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Don't show navigation on login/register pages
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  const isProvider = user?.role === 'PROVIDER' || user?.role === 'ADMIN';

  // Main navigation categories
  const navigationCategories: Record<string, NavCategory> = {
    marketplace: {
      label: 'Marketplace',
      icon: '🏪',
      items: [
        { href: '/providers', label: 'Signal Providers', icon: '👥', description: 'Browse verified signal providers' },
        { href: '/strategies', label: 'Trading Strategies', icon: '📊', description: 'Explore proven strategies' },
        { href: '/signals', label: 'Live Signals', icon: '📡', description: 'View real-time signals' },
        { href: '/leaderboard', label: 'Leaderboard', icon: '🏆', description: 'Top performing providers' },
        { href: '/marketplace/trending', label: 'Trending', icon: '🔥', description: 'Hot strategies this week' },
      ],
    },
    trading: {
      label: 'My Trading',
      icon: '💼',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: '📈', description: 'Overview and stats' },
        { href: '/positions', label: 'Positions', icon: '💰', description: 'Active and closed positions' },
        { href: '/subscriptions', label: 'Subscriptions', icon: '⭐', description: 'Your active subscriptions' },
        { href: '/transactions', label: 'Transactions', icon: '💳', description: 'Payment history' },
      ],
    },
    tools: {
      label: 'Tools',
      icon: '🛠️',
      items: [
        { href: '/risk-management', label: 'Risk Management', icon: '🛡️', description: 'Configure risk settings' },
        { href: '/backtests', label: 'Backtests', icon: '📉', description: 'Strategy backtesting' },
        { href: '/analytics', label: 'Analytics', icon: '📊', description: 'Performance analytics' },
        { href: '/news-calendar', label: 'Economic Calendar', icon: '📅', description: 'Market news and events' },
      ],
    },
  };

  // Provider-specific navigation
  const providerCategory: NavCategory = {
    label: 'Provider',
    icon: '👨‍💼',
    items: [
      { href: '/provider/dashboard', label: 'Provider Dashboard', icon: '📊', description: 'Revenue and subscribers' },
      { href: '/provider/signals/create', label: 'Create Signal', icon: '➕', description: 'Publish new signal' },
      { href: '/provider/strategies', label: 'My Strategies', icon: '📈', description: 'Manage your strategies' },
      { href: '/provider/subscribers', label: 'Subscribers', icon: '👥', description: 'View subscribers' },
      { href: '/provider/analytics', label: 'Provider Analytics', icon: '💹', description: 'Detailed stats' },
    ],
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const handleDropdownToggle = (category: string) => {
    setActiveDropdown(activeDropdown === category ? null : category);
  };

  const closeDropdowns = () => {
    setActiveDropdown(null);
  };

  return (
    <>
      <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Brand */}
            <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
              <span className="text-2xl font-bold text-blue-600">⚡</span>
              <span className="text-xl font-bold text-gray-900 hidden sm:block">AutomatedTradeBot</span>
              <span className="text-xl font-bold text-gray-900 sm:hidden">ATB</span>
            </Link>

            {/* Desktop Navigation - Simple Flat Links */}
            <div className="hidden lg:flex items-center space-x-1 flex-1 justify-center">
              {isAuthenticated && (
                <>
                  {/* Simple Flat Navigation Links */}
                  <Link
                    href="/"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Home
                  </Link>
                  <Link
                    href="/dashboard"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/marketplace"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/marketplace' || pathname.startsWith('/marketplace/')
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Marketplace
                  </Link>
                  <Link
                    href="/subscriptions"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/subscriptions' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    My Subscriptions
                  </Link>
                  <Link
                    href="/signals"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/signals' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Signals
                  </Link>
                  <Link
                    href="/completed-trades"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/completed-trades' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Trades
                  </Link>
                  <Link
                    href="/active-positions"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname === '/active-positions' || pathname === '/positions'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Active
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* User Menu */}
            <div className="hidden lg:flex items-center space-x-4">
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="max-w-24 truncate">{user?.username}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20">
                        {/* User Info */}
                        <div className="px-4 py-3 border-b border-gray-200">
                          <p className="text-sm font-semibold text-gray-900 truncate">{user?.username}</p>
                          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                          <div className="mt-2 flex items-center space-x-2">
                            <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {user?.role}
                            </span>
                            {isProvider && (
                              <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                Provider
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Menu Links */}
                        <div className="py-1">
                          <Link
                            href="/profile"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <span className="mr-3">👤</span> Profile
                          </Link>
                          <Link
                            href="/settings"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <span className="mr-3">⚙️</span> Settings
                          </Link>
                          <Link
                            href="/notifications"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <span className="mr-3">🔔</span> Notifications
                            {/* <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2">3</span> */}
                          </Link>
                          <Link
                            href="/transactions"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <span className="mr-3">💳</span> Billing
                          </Link>
                        </div>

                        <div className="border-t border-gray-200 my-1"></div>

                        <button
                          onClick={() => {
                            logout();
                            setShowUserMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <span className="mr-3">🚪</span> Logout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link
                    href="/login"
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
                  >
                    Sign Up Free
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)}>
          <div className="bg-white w-80 h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xl font-bold text-gray-900">Menu</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-gray-100 rounded-md">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {isAuthenticated ? (
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="pb-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user?.username}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Marketplace */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Marketplace</h3>
                    {navigationCategories.marketplace.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-3 py-2 rounded-md hover:bg-gray-50"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <span className="mr-2">{item.icon}</span>
                        <span className="text-gray-700">{item.label}</span>
                      </Link>
                    ))}
                  </div>

                  {/* My Trading */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">My Trading</h3>
                    {navigationCategories.trading.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-3 py-2 rounded-md hover:bg-gray-50"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <span className="mr-2">{item.icon}</span>
                        <span className="text-gray-700">{item.label}</span>
                      </Link>
                    ))}
                  </div>

                  {/* Tools */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Tools</h3>
                    {navigationCategories.tools.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-3 py-2 rounded-md hover:bg-gray-50"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <span className="mr-2">{item.icon}</span>
                        <span className="text-gray-700">{item.label}</span>
                      </Link>
                    ))}
                  </div>

                  {/* Provider (if applicable) */}
                  {isProvider && (
                    <div>
                      <h3 className="text-sm font-semibold text-purple-600 uppercase mb-2">Provider</h3>
                      {providerCategory.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="block px-3 py-2 rounded-md hover:bg-purple-50"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <span className="mr-2">{item.icon}</span>
                          <span className="text-gray-700">{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Account */}
                  <div className="pt-4 border-t border-gray-200">
                    <Link
                      href="/profile"
                      className="block px-3 py-2 rounded-md hover:bg-gray-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span className="mr-2">👤</span>
                      <span className="text-gray-700">Profile</span>
                    </Link>
                    <Link
                      href="/settings"
                      className="block px-3 py-2 rounded-md hover:bg-gray-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span className="mr-2">⚙️</span>
                      <span className="text-gray-700">Settings</span>
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 rounded-md hover:bg-red-50 text-red-600"
                    >
                      <span className="mr-2">🚪</span>
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Link
                    href="/login"
                    className="block w-full px-4 py-3 text-center bg-white border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="block w-full px-4 py-3 text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign Up Free
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
