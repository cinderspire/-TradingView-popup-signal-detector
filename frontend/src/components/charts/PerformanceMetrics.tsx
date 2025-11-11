'use client'

import { TrendingUp, Target, AlertTriangle, Activity, DollarSign, Percent } from 'lucide-react'

interface PerformanceMetricsProps {
  winRate: number
  profitFactor: number
  maxDrawdown: number
  sharpeRatio: number
  totalTrades: number
  totalPnL: number
  openPnL?: number
}

export default function PerformanceMetrics({
  winRate,
  profitFactor,
  maxDrawdown,
  sharpeRatio,
  totalTrades,
  totalPnL,
  openPnL = 0
}: PerformanceMetricsProps) {
  const isProfitable = totalPnL >= 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
        Performance Metrics
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Win Rate */}
        <MetricCard
          icon={<Target className="h-6 w-6" />}
          label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          color={winRate >= 50 ? 'green' : 'red'}
          description="Percentage of winning trades"
        />

        {/* Profit Factor */}
        <MetricCard
          icon={<TrendingUp className="h-6 w-6" />}
          label="Profit Factor"
          value={profitFactor.toFixed(2)}
          color={profitFactor >= 1.5 ? 'green' : profitFactor >= 1 ? 'yellow' : 'red'}
          description="Gross profit / Gross loss"
        />

        {/* Max Drawdown */}
        <MetricCard
          icon={<AlertTriangle className="h-6 w-6" />}
          label="Max Drawdown"
          value={`${maxDrawdown.toFixed(2)}%`}
          color={maxDrawdown <= 20 ? 'green' : maxDrawdown <= 40 ? 'yellow' : 'red'}
          description="Maximum equity decline"
          negative
        />

        {/* Sharpe Ratio */}
        <MetricCard
          icon={<Activity className="h-6 w-6" />}
          label="Sharpe Ratio"
          value={sharpeRatio.toFixed(2)}
          color={sharpeRatio >= 1.5 ? 'green' : sharpeRatio >= 1 ? 'yellow' : 'gray'}
          description="Risk-adjusted returns"
        />

        {/* Total Trades */}
        <MetricCard
          icon={<Activity className="h-6 w-6" />}
          label="Total Trades"
          value={totalTrades.toString()}
          color="blue"
          description="Number of closed trades"
        />

        {/* Total P&L */}
        <MetricCard
          icon={<DollarSign className="h-6 w-6" />}
          label="Total P&L"
          value={`$${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          color={isProfitable ? 'green' : 'red'}
          description="Cumulative profit/loss"
        />
      </div>

      {/* Open P&L Section */}
      {openPnL !== 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-lg ${openPnL >= 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                <Percent className={`h-6 w-6 ${openPnL >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Open P&L</p>
                <p className={`text-2xl font-bold ${openPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {openPnL >= 0 ? '+' : ''}${openPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400">Unrealized P&L</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">From open positions</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  color: 'green' | 'red' | 'yellow' | 'blue' | 'gray'
  description: string
  negative?: boolean
}

function MetricCard({ icon, label, value, color, description, negative = false }: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-100 dark:bg-green-900/20 text-green-600',
    red: 'bg-red-100 dark:bg-red-900/20 text-red-600',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600',
    blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600',
    gray: 'bg-gray-100 dark:bg-gray-900/20 text-gray-600'
  }

  const textColorClasses = {
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    blue: 'text-blue-600',
    gray: 'text-gray-600'
  }

  return (
    <div className="flex items-start space-x-3">
      <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${textColorClasses[color]}`}>
          {value}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      </div>
    </div>
  )
}
