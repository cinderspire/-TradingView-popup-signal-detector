const axios = require('axios');
const logger = require('../utils/logger');

/**
 * AI RISK CONTROL SERVICE
 *
 * Uses GLM-4.6 AI model to make intelligent risk management decisions
 * based on market conditions, historical performance, and current portfolio state.
 *
 * Features:
 * - Dynamic TP/SL adjustment based on volatility
 * - Position sizing recommendations
 * - Market sentiment analysis
 * - Risk level adaptation
 * - Decision logging for transparency
 *
 * API: GLM-4.6 (ZhipuAI)
 */
class AIRiskControl {
  constructor() {
    this.apiKey = process.env.GLM_API_KEY || '72f96cb01ecd4b71aa8f9dd293f11cab.K1iMaTgEJPtkIkb2';
    this.apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    this.model = process.env.GLM_MODEL || 'glm-4-plus'; // Use glm-4-plus (GLM-4.6 latest model)

    // Decision cache (60 seconds)
    this.decisionCache = new Map();
    this.CACHE_TTL_MS = 60000;

    logger.info('✅ AI Risk Control Service initialized (GLM-4.6)');
  }

  /**
   * Get AI recommendation for TP/SL based on market analysis
   */
  async getTPSLRecommendation(context) {
    const {
      symbol,
      direction,
      entryPrice,
      currentPrice,
      balance,
      openPositionsCount,
      recentPnL,
      marketData,
      historicalPerformance
    } = context;

    try {
      logger.info(`🤖 AI analyzing TP/SL for ${symbol}...`);

      // Build AI prompt
      const prompt = this.buildTPSLPrompt(context);

      // Call GLM API
      const response = await this.callGLMAPI(prompt);

      // Parse response
      const recommendation = this.parseAIResponse(response);

      // Add metadata
      recommendation.timestamp = new Date().toISOString();
      recommendation.symbol = symbol;
      recommendation.model = this.model;

      // Cache decision
      this.cacheDecision(symbol, recommendation);

      logger.info(`✅ AI recommendation for ${symbol}: TP ${recommendation.takeProfit}%, SL ${recommendation.stopLoss}%`);

      return recommendation;

    } catch (error) {
      logger.error(`❌ AI Risk Control error:`, error.message);
      return this.getFallbackRecommendation(context);
    }
  }

  /**
   * Get AI recommendation for position size
   */
  async getPositionSizeRecommendation(context) {
    const {
      symbol,
      direction,
      balance,
      riskPercent,
      volatility,
      confidence
    } = context;

    try {
      const prompt = `You are a professional trading risk manager. Analyze this trading scenario and recommend optimal position size.

Context:
- Symbol: ${symbol}
- Direction: ${direction}
- Account Balance: $${balance}
- Base Risk: ${riskPercent}%
- Market Volatility: ${volatility || 'normal'}
- Signal Confidence: ${confidence || 'medium'}

Provide a position size recommendation in JSON format:
{
  "positionSizePercent": <percentage of balance>,
  "reasoning": "<brief explanation>",
  "adjustedRisk": <adjusted risk percentage>,
  "maxLoss": <maximum acceptable loss in USD>
}`;

      const response = await this.callGLMAPI(prompt);
      return this.parseAIResponse(response);

    } catch (error) {
      logger.error('❌ AI Position Size error:', error.message);
      return {
        positionSizePercent: riskPercent,
        reasoning: 'Using default risk percentage (AI unavailable)',
        adjustedRisk: riskPercent,
        maxLoss: balance * (riskPercent / 100)
      };
    }
  }

  /**
   * Analyze market sentiment for risk adjustment
   */
  async analyzeMarketSentiment(context) {
    const {
      symbol,
      recentTrades,
      priceAction,
      volume,
      news
    } = context;

    try {
      const prompt = `Analyze market sentiment for ${symbol} and provide risk adjustment recommendation.

Recent Performance:
- Last 10 trades: ${recentTrades?.map(t => `${t.profitLoss}%`).join(', ') || 'N/A'}
- Price Action: ${priceAction || 'stable'}
- Volume: ${volume || 'normal'}
- News/Events: ${news || 'none'}

Provide sentiment analysis in JSON:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": "low|medium|high",
  "riskAdjustment": "increase|decrease|maintain",
  "reasoning": "<brief explanation>",
  "recommendedAction": "<suggested trading action>"
}`;

      const response = await this.callGLMAPI(prompt);
      return this.parseAIResponse(response);

    } catch (error) {
      logger.error('❌ AI Sentiment Analysis error:', error.message);
      return {
        sentiment: 'neutral',
        confidence: 'low',
        riskAdjustment: 'maintain',
        reasoning: 'AI analysis unavailable, using neutral stance'
      };
    }
  }

  /**
   * Build TP/SL recommendation prompt
   */
  buildTPSLPrompt(context) {
    const {
      symbol,
      direction,
      entryPrice,
      currentPrice,
      balance,
      openPositionsCount,
      recentPnL,
      historicalPerformance
    } = context;

    return `You are a professional cryptocurrency trading risk manager. Analyze this trading scenario and provide optimal Take Profit (TP) and Stop Loss (SL) recommendations.

Context:
- Symbol: ${symbol}
- Direction: ${direction}
- Entry Price: $${entryPrice}
- Current Price: $${currentPrice || entryPrice}
- Account Balance: $${balance}
- Open Positions: ${openPositionsCount || 0}
- Recent P&L: ${recentPnL ? recentPnL.toFixed(2) + '%' : 'N/A'}

Historical Performance for ${symbol}:
${historicalPerformance ? `
- Win Rate: ${historicalPerformance.winRate?.toFixed(1)}%
- Avg Win: ${historicalPerformance.avgWin?.toFixed(2)}%
- Avg Loss: ${historicalPerformance.avgLoss?.toFixed(2)}%
- Max Profit: ${historicalPerformance.maxProfit?.toFixed(2)}%
- Max Loss: ${historicalPerformance.maxLoss?.toFixed(2)}%
` : 'No historical data available'}

Provide your recommendation in JSON format:
{
  "takeProfit": <percentage as number>,
  "stopLoss": <percentage as negative number>,
  "confidence": "low|medium|high",
  "reasoning": "<brief explanation of your decision>",
  "riskReward": <calculated risk:reward ratio>,
  "useTrailingStop": <boolean>,
  "useBreakEven": <boolean>
}`;
  }

  /**
   * Call GLM API
   */
  async callGLMAPI(prompt, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 1000,
      topP = 0.9
    } = options;

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a professional cryptocurrency trading risk manager with deep expertise in risk management, technical analysis, and market psychology. Always provide data-driven, conservative recommendations that prioritize capital preservation.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature,
          max_tokens: maxTokens,
          top_p: topP
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (!response.data || !response.data.choices || !response.data.choices[0]) {
        throw new Error('Invalid API response format');
      }

      const content = response.data.choices[0].message.content;
      logger.debug(`🤖 GLM Response: ${content.substring(0, 200)}...`);

      return content;

    } catch (error) {
      if (error.response) {
        logger.error(`❌ GLM API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        logger.error(`❌ GLM API Error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Parse AI response (extract JSON)
   */
  parseAIResponse(response) {
    try {
      // Try to extract JSON from markdown code blocks
      let jsonStr = response;

      // Remove markdown code blocks if present
      const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      }

      // Find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);
      return parsed;

    } catch (error) {
      logger.error('❌ Failed to parse AI response:', error.message);
      logger.error('Response:', response);

      // Try to extract values manually
      return this.extractValuesManually(response);
    }
  }

  /**
   * Manually extract values if JSON parsing fails
   */
  extractValuesManually(response) {
    const tpMatch = response.match(/takeProfit["\s:]+(\d+\.?\d*)/i);
    const slMatch = response.match(/stopLoss["\s:]+(-?\d+\.?\d*)/i);

    return {
      takeProfit: tpMatch ? parseFloat(tpMatch[1]) : 3.0,
      stopLoss: slMatch ? parseFloat(slMatch[1]) : -2.5,
      confidence: 'low',
      reasoning: 'Extracted from unstructured response',
      riskReward: 1.2,
      useTrailingStop: false,
      useBreakEven: true
    };
  }

  /**
   * Fallback recommendation when AI is unavailable
   */
  getFallbackRecommendation(context) {
    const { historicalPerformance } = context;

    if (historicalPerformance) {
      return {
        takeProfit: historicalPerformance.recommendedTP || 3.13,
        stopLoss: historicalPerformance.recommendedSL || -2.75,
        confidence: 'medium',
        reasoning: 'Using historical performance data (AI unavailable)',
        riskReward: 1.14,
        useTrailingStop: false,
        useBreakEven: true,
        fallback: true
      };
    }

    return {
      takeProfit: 3.13,
      stopLoss: -2.75,
      confidence: 'low',
      reasoning: 'Using global defaults (AI and historical data unavailable)',
      riskReward: 1.14,
      useTrailingStop: false,
      useBreakEven: true,
      fallback: true
    };
  }

  /**
   * Cache AI decision
   */
  cacheDecision(symbol, decision) {
    this.decisionCache.set(symbol, {
      decision,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached decision if still valid
   */
  getCachedDecision(symbol) {
    const cached = this.decisionCache.get(symbol);

    if (!cached) return null;

    const age = Date.now() - cached.timestamp;

    if (age > this.CACHE_TTL_MS) {
      this.decisionCache.delete(symbol);
      return null;
    }

    logger.debug(`💾 Using cached AI decision for ${symbol}`);
    return cached.decision;
  }

  /**
   * Clear decision cache
   */
  clearCache() {
    this.decisionCache.clear();
    logger.info('🗑️  AI decision cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.decisionCache.size,
      entries: Array.from(this.decisionCache.entries()).map(([symbol, data]) => ({
        symbol,
        age: Date.now() - data.timestamp,
        takeProfit: data.decision.takeProfit,
        stopLoss: data.decision.stopLoss
      }))
    };
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new AIRiskControl();
    }
    return instance;
  },
  AIRiskControl
};
