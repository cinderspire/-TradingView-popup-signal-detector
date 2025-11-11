const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * AI Strategy Consultant Service
 * Expert system that analyzes user risk profiles and recommends optimal strategy baskets
 */
class AIStrategyConsultant {
  constructor() {
    // Risk profile categories
    this.riskProfiles = {
      ULTRA_CONSERVATIVE: 1,
      CONSERVATIVE: 2,
      MODERATE_CONSERVATIVE: 3,
      MODERATE: 4,
      MODERATE_AGGRESSIVE: 5,
      AGGRESSIVE: 6,
      ULTRA_AGGRESSIVE: 7
    };

    // Market conditions
    this.marketConditions = {
      BULL: 'bull',
      BEAR: 'bear',
      SIDEWAYS: 'sideways',
      VOLATILE: 'volatile',
      STABLE: 'stable'
    };

    // Strategy characteristics database
    this.strategyCharacteristics = {
      '3RSI_DCA': {
        riskLevel: 2,
        expectedReturn: { min: 8, max: 15 },
        maxDrawdown: 8,
        bestMarket: ['sideways', 'stable'],
        timeframe: '15m-1h',
        complexity: 'medium',
        capitalRequirement: 'low'
      },
      '7RSI_Strategy': {
        riskLevel: 3,
        expectedReturn: { min: 12, max: 20 },
        maxDrawdown: 12,
        bestMarket: ['bull', 'sideways'],
        timeframe: '5m-30m',
        complexity: 'medium',
        capitalRequirement: 'medium'
      },
      'Momentum_Scalping': {
        riskLevel: 5,
        expectedReturn: { min: 20, max: 40 },
        maxDrawdown: 20,
        bestMarket: ['volatile', 'bull'],
        timeframe: '1m-5m',
        complexity: 'high',
        capitalRequirement: 'high'
      },
      'Mean_Reversion': {
        riskLevel: 3,
        expectedReturn: { min: 10, max: 18 },
        maxDrawdown: 10,
        bestMarket: ['sideways', 'stable'],
        timeframe: '1h-4h',
        complexity: 'low',
        capitalRequirement: 'low'
      },
      'MACD_Cross': {
        riskLevel: 2,
        expectedReturn: { min: 8, max: 14 },
        maxDrawdown: 9,
        bestMarket: ['bull', 'bear'],
        timeframe: '30m-1h',
        complexity: 'low',
        capitalRequirement: 'low'
      },
      'Bollinger_Breakout': {
        riskLevel: 4,
        expectedReturn: { min: 15, max: 25 },
        maxDrawdown: 15,
        bestMarket: ['volatile', 'bull'],
        timeframe: '15m-1h',
        complexity: 'medium',
        capitalRequirement: 'medium'
      },
      'Volume_Spike': {
        riskLevel: 5,
        expectedReturn: { min: 18, max: 35 },
        maxDrawdown: 18,
        bestMarket: ['volatile', 'bull'],
        timeframe: '5m-15m',
        complexity: 'high',
        capitalRequirement: 'high'
      },
      'Support_Resistance': {
        riskLevel: 2,
        expectedReturn: { min: 7, max: 12 },
        maxDrawdown: 7,
        bestMarket: ['sideways', 'stable'],
        timeframe: '1h-4h',
        complexity: 'low',
        capitalRequirement: 'low'
      },
      'News_Based': {
        riskLevel: 6,
        expectedReturn: { min: 25, max: 50 },
        maxDrawdown: 25,
        bestMarket: ['volatile'],
        timeframe: 'event-based',
        complexity: 'high',
        capitalRequirement: 'high'
      },
      'AI_Adaptive': {
        riskLevel: 4,
        expectedReturn: { min: 15, max: 30 },
        maxDrawdown: 12,
        bestMarket: ['all'],
        timeframe: 'adaptive',
        complexity: 'low',
        capitalRequirement: 'medium'
      }
    };
  }

  /**
   * Analyze user's complete trading profile
   */
  async analyzeUserProfile(userId) {
    try {
      // Get user data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          trades: {
            orderBy: { executedAt: 'desc' },
            take: 100
          },
          sessions: {
            where: { status: 'completed' }
          },
          riskConfigs: true
        }
      });

      // Calculate risk metrics from trading history
      const riskMetrics = this.calculateRiskMetrics(user.trades);

      // Assess psychological profile
      const psychProfile = this.assessPsychologicalProfile(user);

      // Determine experience level
      const experience = this.determineExperienceLevel(user);

      // Get current market conditions
      const marketCondition = await this.getCurrentMarketCondition();

      return {
        userId,
        riskScore: riskMetrics.overallScore,
        riskCategory: this.getRiskCategory(riskMetrics.overallScore),
        psychologicalProfile: psychProfile,
        experienceLevel: experience,
        tradingStyle: this.determineTradingStyle(user.trades),
        marketCondition,
        recommendations: await this.generateRecommendations({
          riskMetrics,
          psychProfile,
          experience,
          marketCondition
        })
      };
    } catch (error) {
      console.error('Error analyzing user profile:', error);
      throw error;
    }
  }

  /**
   * Calculate risk metrics from trading history
   */
  calculateRiskMetrics(trades) {
    if (!trades || trades.length === 0) {
      return {
        overallScore: 4, // Default moderate
        avgLossPerTrade: 0,
        avgGainPerTrade: 0,
        maxDrawdown: 0,
        volatility: 0,
        riskRewardRatio: 0
      };
    }

    // Calculate metrics
    const profits = trades.map(t => parseFloat(t.pnl || 0));
    const avgLoss = this.average(profits.filter(p => p < 0));
    const avgGain = this.average(profits.filter(p => p > 0));
    const maxDrawdown = this.calculateMaxDrawdown(profits);
    const volatility = this.calculateVolatility(profits);

    // Risk scoring algorithm
    let riskScore = 4; // Start with moderate

    // Adjust based on max loss tolerance
    if (Math.abs(avgLoss) > avgGain * 2) riskScore += 2;
    if (Math.abs(avgLoss) < avgGain * 0.5) riskScore -= 1;

    // Adjust based on drawdown
    if (maxDrawdown > 20) riskScore += 1;
    if (maxDrawdown < 10) riskScore -= 1;

    // Adjust based on volatility preference
    if (volatility > 30) riskScore += 1;
    if (volatility < 10) riskScore -= 1;

    // Clamp between 1-7
    riskScore = Math.max(1, Math.min(7, riskScore));

    return {
      overallScore: riskScore,
      avgLossPerTrade: avgLoss,
      avgGainPerTrade: avgGain,
      maxDrawdown,
      volatility,
      riskRewardRatio: avgGain / Math.abs(avgLoss) || 0
    };
  }

  /**
   * Assess psychological trading profile
   */
  assessPsychologicalProfile(user) {
    const profile = {
      type: 'BALANCED',
      traits: [],
      strengths: [],
      weaknesses: []
    };

    // Analyze trading patterns
    if (user.trades?.length > 0) {
      const avgHoldTime = this.calculateAvgHoldTime(user.trades);
      const tradeFrequency = user.trades.length / 30; // trades per day

      // Determine trader type
      if (avgHoldTime < 3600) { // Less than 1 hour
        profile.type = 'SCALPER';
        profile.traits.push('Quick decision maker', 'High stress tolerance');
        profile.strengths.push('Fast execution', 'Adaptability');
        profile.weaknesses.push('Overtrading risk', 'Impulsiveness');
      } else if (avgHoldTime < 86400) { // Less than 1 day
        profile.type = 'DAY_TRADER';
        profile.traits.push('Disciplined', 'Analytical');
        profile.strengths.push('Risk management', 'Pattern recognition');
        profile.weaknesses.push('Emotional decisions', 'FOMO');
      } else if (avgHoldTime < 604800) { // Less than 1 week
        profile.type = 'SWING_TRADER';
        profile.traits.push('Patient', 'Strategic');
        profile.strengths.push('Trend following', 'Position sizing');
        profile.weaknesses.push('Holding losers', 'Missing opportunities');
      } else {
        profile.type = 'POSITION_TRADER';
        profile.traits.push('Long-term focused', 'Fundamental');
        profile.strengths.push('Big picture view', 'Patience');
        profile.weaknesses.push('Slow to adapt', 'Opportunity cost');
      }

      // High frequency indicates active trader
      if (tradeFrequency > 10) {
        profile.traits.push('Very active', 'Market engaged');
      }
    }

    return profile;
  }

  /**
   * Determine experience level
   */
  determineExperienceLevel(user) {
    const totalTrades = user.trades?.length || 0;
    const accountAge = (Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24);
    const profitableSessions = user.sessions?.filter(s => parseFloat(s.roi) > 0).length || 0;

    let level = 'BEGINNER';
    let score = 0;

    // Score based on trades
    if (totalTrades > 1000) score += 3;
    else if (totalTrades > 500) score += 2;
    else if (totalTrades > 100) score += 1;

    // Score based on account age
    if (accountAge > 365) score += 2;
    else if (accountAge > 90) score += 1;

    // Score based on success rate
    if (profitableSessions > 10) score += 2;
    else if (profitableSessions > 5) score += 1;

    // Determine level
    if (score >= 7) level = 'EXPERT';
    else if (score >= 5) level = 'ADVANCED';
    else if (score >= 3) level = 'INTERMEDIATE';
    else if (score >= 1) level = 'NOVICE';

    return {
      level,
      score,
      totalTrades,
      accountAgeDays: Math.floor(accountAge),
      profitableSessions
    };
  }

  /**
   * Determine trading style from history
   */
  determineTradingStyle(trades) {
    if (!trades || trades.length === 0) {
      return 'UNDEFINED';
    }

    const styles = {
      trend: 0,
      reversal: 0,
      breakout: 0,
      range: 0
    };

    // Analyze trade patterns (simplified)
    trades.forEach(trade => {
      if (trade.notes?.includes('trend')) styles.trend++;
      if (trade.notes?.includes('reversal')) styles.reversal++;
      if (trade.notes?.includes('breakout')) styles.breakout++;
      if (trade.notes?.includes('range')) styles.range++;
    });

    // Return dominant style
    const maxStyle = Object.keys(styles).reduce((a, b) =>
      styles[a] > styles[b] ? a : b
    );

    return maxStyle.toUpperCase();
  }

  /**
   * Get current market condition
   */
  async getCurrentMarketCondition() {
    // This would connect to real market data
    // For now, return a simulated condition
    const conditions = ['bull', 'bear', 'sideways', 'volatile', 'stable'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];

    return {
      primary: randomCondition,
      strength: Math.floor(Math.random() * 100),
      trend: randomCondition === 'bull' ? 'up' : randomCondition === 'bear' ? 'down' : 'neutral',
      volatility: randomCondition === 'volatile' ? 'high' : 'normal'
    };
  }

  /**
   * Generate personalized strategy recommendations
   */
  async generateRecommendations(profile) {
    const { riskMetrics, psychProfile, experience, marketCondition } = profile;

    // Filter strategies based on risk score
    const suitableStrategies = this.filterStrategiesByRisk(riskMetrics.overallScore);

    // Score strategies based on multiple factors
    const scoredStrategies = suitableStrategies.map(strategy => {
      let score = 100;

      // Market condition match
      if (strategy.bestMarket.includes(marketCondition.primary)) {
        score += 20;
      }

      // Experience level match
      if (experience.level === 'BEGINNER' && strategy.complexity === 'low') {
        score += 15;
      } else if (experience.level === 'EXPERT' && strategy.complexity === 'high') {
        score += 15;
      }

      // Psychological profile match
      if (psychProfile.type === 'SCALPER' && strategy.timeframe.includes('1m')) {
        score += 10;
      } else if (psychProfile.type === 'SWING_TRADER' && strategy.timeframe.includes('1h')) {
        score += 10;
      }

      return {
        ...strategy,
        matchScore: score
      };
    });

    // Sort by match score
    scoredStrategies.sort((a, b) => b.matchScore - a.matchScore);

    // Generate basket portfolios
    const baskets = this.generateStrategyBaskets(scoredStrategies, riskMetrics.overallScore);

    return {
      topStrategies: scoredStrategies.slice(0, 5),
      recommendedBaskets: baskets,
      insights: this.generateInsights(profile),
      warnings: this.generateWarnings(profile)
    };
  }

  /**
   * Filter strategies by risk level
   */
  filterStrategiesByRisk(riskScore) {
    const strategies = [];
    const tolerance = 2; // Allow strategies within ±2 risk levels

    for (const [name, characteristics] of Object.entries(this.strategyCharacteristics)) {
      if (Math.abs(characteristics.riskLevel - riskScore) <= tolerance) {
        strategies.push({
          name,
          ...characteristics
        });
      }
    }

    return strategies;
  }

  /**
   * Generate optimal strategy baskets
   */
  generateStrategyBaskets(strategies, riskScore) {
    const baskets = [];

    // Conservative basket
    if (riskScore <= 3) {
      baskets.push({
        name: 'Ultra Safe Portfolio',
        description: 'Maximum capital preservation with steady growth',
        allocation: [
          { strategy: 'Support_Resistance', percentage: 35 },
          { strategy: 'MACD_Cross', percentage: 30 },
          { strategy: 'Mean_Reversion', percentage: 20 },
          { strategy: '3RSI_DCA', percentage: 15 }
        ],
        expectedMonthlyReturn: '8-12%',
        maxDrawdown: '8%',
        sharpeRatio: 1.8,
        confidence: 85
      });
    }

    // Balanced basket
    if (riskScore >= 3 && riskScore <= 5) {
      baskets.push({
        name: 'Balanced Growth Portfolio',
        description: 'Optimal risk-reward balance for consistent returns',
        allocation: [
          { strategy: '7RSI_Strategy', percentage: 25 },
          { strategy: 'Bollinger_Breakout', percentage: 25 },
          { strategy: 'AI_Adaptive', percentage: 25 },
          { strategy: 'Mean_Reversion', percentage: 25 }
        ],
        expectedMonthlyReturn: '15-25%',
        maxDrawdown: '15%',
        sharpeRatio: 2.2,
        confidence: 82
      });
    }

    // Aggressive basket
    if (riskScore >= 5) {
      baskets.push({
        name: 'High Performance Portfolio',
        description: 'Maximum returns for risk-tolerant traders',
        allocation: [
          { strategy: 'Momentum_Scalping', percentage: 30 },
          { strategy: 'Volume_Spike', percentage: 25 },
          { strategy: 'News_Based', percentage: 25 },
          { strategy: 'AI_Adaptive', percentage: 20 }
        ],
        expectedMonthlyReturn: '30-50%',
        maxDrawdown: '25%',
        sharpeRatio: 1.9,
        confidence: 78
      });
    }

    // Dynamic market-adaptive basket (for all)
    baskets.push({
      name: 'Smart Adaptive Portfolio',
      description: 'AI-optimized allocation that adapts to market conditions',
      allocation: this.calculateDynamicAllocation(strategies, riskScore),
      expectedMonthlyReturn: '18-35%',
      maxDrawdown: '18%',
      sharpeRatio: 2.5,
      confidence: 90,
      features: ['Auto-rebalancing', 'Market condition adaptive', 'Risk auto-adjustment']
    });

    return baskets;
  }

  /**
   * Calculate dynamic allocation based on current conditions
   */
  calculateDynamicAllocation(strategies, riskScore) {
    // Complex allocation algorithm
    const allocation = [];
    let remainingPercentage = 100;

    strategies.slice(0, 5).forEach((strategy, index) => {
      const baseAllocation = remainingPercentage / (5 - index);
      const adjustedAllocation = baseAllocation * (strategy.matchScore / 100);
      const finalAllocation = Math.floor(adjustedAllocation);

      allocation.push({
        strategy: strategy.name,
        percentage: finalAllocation
      });

      remainingPercentage -= finalAllocation;
    });

    // Distribute remaining percentage
    if (remainingPercentage > 0 && allocation.length > 0) {
      allocation[0].percentage += remainingPercentage;
    }

    return allocation;
  }

  /**
   * Generate trading insights
   */
  generateInsights(profile) {
    const insights = [];

    // Risk-based insights
    if (profile.riskMetrics.overallScore <= 3) {
      insights.push({
        type: 'RISK',
        message: 'Your conservative approach is ideal for capital preservation',
        recommendation: 'Consider DCA strategies for steady growth'
      });
    } else if (profile.riskMetrics.overallScore >= 6) {
      insights.push({
        type: 'RISK',
        message: 'Your high risk tolerance allows for aggressive strategies',
        recommendation: 'Ensure proper position sizing to manage drawdowns'
      });
    }

    // Experience-based insights
    if (profile.experience.level === 'BEGINNER') {
      insights.push({
        type: 'EDUCATION',
        message: 'Focus on learning risk management fundamentals',
        recommendation: 'Start with paper trading to build confidence'
      });
    }

    // Market condition insights
    if (profile.marketCondition.primary === 'volatile') {
      insights.push({
        type: 'MARKET',
        message: 'High volatility detected - great for momentum strategies',
        recommendation: 'Tighten stop losses and reduce position sizes'
      });
    }

    // Psychological insights
    if (profile.psychProfile.type === 'SCALPER') {
      insights.push({
        type: 'PSYCHOLOGY',
        message: 'Your quick trading style suits high-frequency strategies',
        recommendation: 'Watch for overtrading and maintain discipline'
      });
    }

    return insights;
  }

  /**
   * Generate risk warnings
   */
  generateWarnings(profile) {
    const warnings = [];

    if (profile.riskMetrics.maxDrawdown > 20) {
      warnings.push({
        severity: 'HIGH',
        message: 'Historical drawdown exceeds safe levels',
        action: 'Reduce position sizes and implement stricter stop losses'
      });
    }

    if (profile.experience.level === 'BEGINNER' && profile.riskMetrics.overallScore > 5) {
      warnings.push({
        severity: 'MEDIUM',
        message: 'Risk level may be too high for experience level',
        action: 'Consider starting with more conservative strategies'
      });
    }

    if (profile.marketCondition.volatility === 'high') {
      warnings.push({
        severity: 'LOW',
        message: 'Market volatility is elevated',
        action: 'Monitor positions closely and be ready to exit'
      });
    }

    return warnings;
  }

  /**
   * Get risk category name
   */
  getRiskCategory(score) {
    const categories = {
      1: 'ULTRA_CONSERVATIVE',
      2: 'CONSERVATIVE',
      3: 'MODERATE_CONSERVATIVE',
      4: 'MODERATE',
      5: 'MODERATE_AGGRESSIVE',
      6: 'AGGRESSIVE',
      7: 'ULTRA_AGGRESSIVE'
    };
    return categories[Math.round(score)] || 'MODERATE';
  }

  /**
   * Helper functions
   */
  average(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  calculateVolatility(returns) {
    const avg = this.average(returns);
    const squaredDiffs = returns.map(r => Math.pow(r - avg, 2));
    return Math.sqrt(this.average(squaredDiffs));
  }

  calculateMaxDrawdown(returns) {
    let peak = 0;
    let maxDrawdown = 0;
    let runningTotal = 0;

    for (const ret of returns) {
      runningTotal += ret;
      if (runningTotal > peak) {
        peak = runningTotal;
      }
      const drawdown = (peak - runningTotal) / peak * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  calculateAvgHoldTime(trades) {
    if (!trades || trades.length === 0) return 0;

    const holdTimes = trades
      .filter(t => t.closedAt)
      .map(t => new Date(t.closedAt) - new Date(t.executedAt));

    return this.average(holdTimes) / 1000; // Return in seconds
  }

  /**
   * Real-time strategy performance update
   */
  async updateStrategyPerformance(strategyName, performance) {
    // Update strategy characteristics based on real performance
    if (this.strategyCharacteristics[strategyName]) {
      const current = this.strategyCharacteristics[strategyName];

      // Adaptive learning - adjust expected returns based on actual
      const actualReturn = performance.monthlyReturn;
      current.expectedReturn.min = current.expectedReturn.min * 0.9 + actualReturn * 0.1;
      current.expectedReturn.max = current.expectedReturn.max * 0.9 + actualReturn * 1.1;

      // Update max drawdown if worse than expected
      if (performance.maxDrawdown > current.maxDrawdown) {
        current.maxDrawdown = performance.maxDrawdown;
      }
    }
  }
}

module.exports = new AIStrategyConsultant();