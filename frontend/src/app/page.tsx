'use client'

import Link from 'next/link'
import { TrendingUp, Shield, Zap, Users, BarChart3, Lock, Radio, TrendingDown, LineChart, ArrowRight, CheckCircle, Star } from 'lucide-react'
import { useState, useEffect } from 'react'

interface PlatformStats {
  totalStrategies: number;
  totalProviders: number;
  totalSignals: number;
  avgWinRate: number;
  totalSubscribers: number;
}

interface TopProvider {
  providerId: string;
  providerUsername: string;
  totalStrategies: number;
  subscriberCount: number;
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  score: number;
}

export default function Home() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [topProviders, setTopProviders] = useState<TopProvider[]>([]);

  useEffect(() => {
    fetchPlatformStats();
    fetchTopProviders();
  }, []);

  const fetchPlatformStats = async () => {
    try {
      const response = await fetch('http://localhost:6864/api/leaderboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch platform stats:', err);
    }
  };

  const fetchTopProviders = async () => {
    try {
      const response = await fetch('http://localhost:6864/api/leaderboard/top-providers?period=all&limit=3');
      if (response.ok) {
        const data = await response.json();
        setTopProviders(data.providers || []);
      }
    } catch (err) {
      console.error('Failed to fetch top providers:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section - Enhanced */}
      <section id="home" className="container mx-auto px-4 py-20 text-center">
        {/* Trust Badge */}
        <div className="inline-flex items-center space-x-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-4 py-2 rounded-full mb-6 border border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-semibold">Trusted by 10,000+ Traders Worldwide</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
          Copy Trading Signals from
          <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Verified Experts
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-4 max-w-3xl mx-auto">
          Subscribe to profitable trading strategies and automatically copy trades from top-performing signal providers.
        </p>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
          No experience needed. Real performance. Transparent results.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Link
            href="/strategies"
            className="group bg-gradient-to-r from-blue-600 to-purple-600 text-white px-10 py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all text-lg font-semibold shadow-lg hover:shadow-xl flex items-center justify-center"
          >
            Browse Strategies
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/leaderboard"
            className="bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 px-10 py-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-lg font-semibold border-2 border-blue-600 flex items-center justify-center"
          >
            <Star className="mr-2 h-5 w-5" />
            View Top Performers
          </Link>
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap justify-center gap-6 mb-12 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Real Performance Data</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Verified Providers</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>No Hidden Fees</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>24/7 Support</span>
          </div>
        </div>

        {/* Platform Stats - Real Data */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="text-4xl font-bold text-blue-600">{stats?.totalStrategies || '...'}</div>
            <div className="text-gray-600 dark:text-gray-400 mt-2 font-medium">Active Strategies</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="text-4xl font-bold text-purple-600">{stats?.totalProviders || '...'}</div>
            <div className="text-gray-600 dark:text-gray-400 mt-2 font-medium">Verified Providers</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="text-4xl font-bold text-green-600">
              {stats?.avgWinRate ? `${stats.avgWinRate.toFixed(1)}%` : '...'}
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-2 font-medium">Avg Win Rate</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="text-4xl font-bold text-orange-600">{stats?.totalSignals || '...'}</div>
            <div className="text-gray-600 dark:text-gray-400 mt-2 font-medium">Signals Sent</div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Start copying profitable trades in 3 simple steps
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Step 1 */}
          <div className="relative">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="absolute -top-6 left-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-lg">
                1
              </div>
              <div className="mt-6 mb-4">
                <Users className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Choose a Provider
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Browse verified signal providers with real performance data. Compare win rates, profitability, and trading history.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="absolute -top-6 left-8 bg-gradient-to-r from-purple-600 to-pink-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-lg">
                2
              </div>
              <div className="mt-6 mb-4">
                <CheckCircle className="h-12 w-12 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Subscribe & Configure
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Subscribe to your chosen strategy and set your risk parameters. Connect your exchange API for auto-trading.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="absolute -top-6 left-8 bg-gradient-to-r from-pink-600 to-red-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-lg">
                3
              </div>
              <div className="mt-6 mb-4">
                <TrendingUp className="h-12 w-12 text-pink-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Auto-Copy Trades
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Trades are automatically executed on your account. Track performance in real-time and adjust as needed.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/register"
            className="inline-flex items-center bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all text-lg font-semibold shadow-lg"
          >
            Get Started Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Signals Section */}
      <section id="signals" className="container mx-auto px-4 py-20 bg-white dark:bg-gray-800 rounded-2xl my-12">
        <h2 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
          📡 Real-Time Trading Signals
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
          Get instant notifications for every trading opportunity. Our real-time signal distribution ensures you never miss a trade.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Signal Card Example 1 */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border-2 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-green-600 text-white text-sm font-semibold rounded-full">LONG</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">2 hours ago</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">BTC/USDT</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Entry:</span>
                <span className="font-semibold text-gray-900 dark:text-white">$67,500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">TP:</span>
                <span className="font-semibold text-green-600">$69,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">SL:</span>
                <span className="font-semibold text-red-600">$66,000</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-green-200 dark:border-green-800">
                <span className="text-gray-600 dark:text-gray-400">Win Rate:</span>
                <span className="font-semibold text-green-600">78.5%</span>
              </div>
            </div>
          </div>

          {/* Signal Card Example 2 */}
          <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 p-6 rounded-xl border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded-full">SHORT</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">5 hours ago</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">ETH/USDT</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Entry:</span>
                <span className="font-semibold text-gray-900 dark:text-white">$3,200</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">TP:</span>
                <span className="font-semibold text-green-600">$3,050</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">SL:</span>
                <span className="font-semibold text-red-600">$3,280</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-red-200 dark:border-red-800">
                <span className="text-gray-600 dark:text-gray-400">Win Rate:</span>
                <span className="font-semibold text-green-600">81.2%</span>
              </div>
            </div>
          </div>

          {/* Call to Action Card */}
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-6 rounded-xl text-white flex flex-col justify-center items-center text-center">
            <Radio className="h-12 w-12 mb-4" />
            <h3 className="text-xl font-bold mb-2">View All Live Signals</h3>
            <p className="text-blue-100 mb-4 text-sm">Get access to 1000+ real-time signals</p>
            <Link
              href="/signals"
              className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Browse Signals →
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h2 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
          Why Choose AutomatedTradeBot?
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
          Everything you need for successful signal trading in one platform
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Zap className="h-12 w-12" />}
            title="Real-Time Signals"
            description="Get instant signal notifications via WebSocket. Never miss a trading opportunity with our real-time distribution system."
          />
          <FeatureCard
            icon={<Shield className="h-12 w-12" />}
            title="Advanced Risk Management"
            description="Adaptive & non-adaptive risk control, news sentiment-based stop loss, and intelligent position sizing."
          />
          <FeatureCard
            icon={<BarChart3 className="h-12 w-12" />}
            title="Rich Analytics"
            description="Track open PnL, maximum drawdown, Sharpe ratio, and detailed performance metrics with animated charts."
          />
          <FeatureCard
            icon={<Users className="h-12 w-12" />}
            title="Verified Providers"
            description="All signal providers are verified based on their trading history and performance metrics."
          />
          <FeatureCard
            icon={<Lock className="h-12 w-12" />}
            title="Secure & Transparent"
            description="Bank-level security with transparent performance tracking and no hidden fees."
          />
          <FeatureCard
            icon={<TrendingUp className="h-12 w-12" />}
            title="Copy Trading"
            description="Automatically copy trades from top performers with customizable position sizing and risk parameters."
          />
        </div>
      </section>

      {/* Top Performers Section */}
      <section id="providers" className="container mx-auto px-4 py-20 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Top Performing Providers
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Join thousands of traders following these verified experts
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-8 max-w-5xl mx-auto">
          {topProviders.length > 0 ? (
            topProviders.map((provider, index) => (
              <div key={provider.providerId} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                {/* Rank Badge */}
                {index === 0 && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-bl-lg font-bold text-sm">
                    #1 Ranked
                  </div>
                )}

                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    {provider.providerUsername.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{provider.providerUsername}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                      <Star className="h-3 w-3 text-yellow-500 mr-1 fill-current" />
                      {provider.totalStrategies} {provider.totalStrategies === 1 ? 'Strategy' : 'Strategies'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Win Rate</p>
                    <p className="font-bold text-lg text-green-600">{provider.winRate.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">{provider.winningTrades}/{provider.totalTrades} wins</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total P&L</p>
                    <p className={`font-bold text-lg ${provider.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${provider.totalPnl.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">Avg: ${provider.avgPnl.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{provider.subscriberCount} subscribers</span>
                  </div>
                  <Link
                    href="/leaderboard"
                    className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center"
                  >
                    View Profile
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </div>
              </div>
            ))
          ) : (
            // Loading placeholders
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 animate-pulse">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-16 h-16 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 h-20"></div>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 h-20"></div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="text-center">
          <Link
            href="/leaderboard"
            className="inline-flex items-center bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold shadow-lg"
          >
            View Full Leaderboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            What Our Traders Say
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Join thousands of satisfied traders earning consistent profits
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Testimonial 1 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 text-yellow-500 fill-current" />
              ))}
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6 italic">
              "I went from losing money on bad trades to copying verified providers and making consistent profits. The automated execution is a game-changer!"
            </p>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                M
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Michael Chen</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Subscriber since 2024</p>
              </div>
            </div>
          </div>

          {/* Testimonial 2 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 text-yellow-500 fill-current" />
              ))}
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6 italic">
              "Being a signal provider on this platform has grown my subscriber base to over 200 traders. The analytics and performance tracking are excellent!"
            </p>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                S
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Sarah Rodriguez</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Signal Provider</p>
              </div>
            </div>
          </div>

          {/* Testimonial 3 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 text-yellow-500 fill-current" />
              ))}
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6 italic">
              "The transparency is incredible. You can see real performance data before subscribing. I'm following 3 providers and my portfolio is up 40% this quarter!"
            </p>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                D
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">David Kim</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Trader</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-center text-white shadow-2xl">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Start Trading Smarter?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of traders who trust AutomatedTradeBot for their signal needs
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors text-lg font-semibold inline-block"
            >
              Create Free Account
            </Link>
            <Link
              href="/signals"
              className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-blue-600 transition-colors text-lg font-semibold inline-block"
            >
              View Live Signals
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center text-gray-600 dark:text-gray-400">
          <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
          <div className="flex justify-center space-x-6 mt-4">
            <Link href="/about" className="hover:text-blue-600 transition-colors">About</Link>
            <Link href="/terms" className="hover:text-blue-600 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy</Link>
            <Link href="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
          </div>
          <p className="mt-4 text-sm">
            Trading signals involve risk. Past performance is not indicative of future results.
          </p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700">
      <div className="text-blue-600 dark:text-blue-400 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  )
}
