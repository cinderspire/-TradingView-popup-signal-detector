// Risk Management TypeScript Types
// Based on backend RiskConfig schema and API responses

export type RiskConfigType = 'FIXED' | 'ADAPTIVE' | 'NEWS_BASED';

export interface RiskConfig {
  id: string;
  userId: string;

  // Configuration Details
  name: string;
  description?: string;
  type: RiskConfigType;

  // Fixed Risk Settings
  riskPerTrade?: number;
  maxPositionSize?: number;
  maxDailyLoss?: number;
  maxDrawdown?: number;

  // Adaptive Risk Settings
  adaptiveEnabled?: boolean;
  baseRiskPercent?: number;
  winStreakMultiplier?: number;
  lossStreakDivisor?: number;
  maxAdaptiveRisk?: number;
  minAdaptiveRisk?: number;

  // News-Based Risk Settings
  newsBasedEnabled?: boolean;
  reduceRiskBeforeNews?: boolean;
  newsRiskReduction?: number;
  newsSafetyWindow?: number;

  // Stop Loss & Take Profit
  useStopLoss?: boolean;
  stopLossPercent?: number;
  useTakeProfit?: boolean;
  takeProfitPercent?: number;
  riskRewardRatio?: number;

  // Position Management
  maxOpenPositions?: number;
  correlationLimit?: number;
  allowHedging?: boolean;

  // Leverage & Margin
  maxLeverage?: number;
  useMargin?: boolean;
  marginSafetyPercent?: number;

  // Status
  isActive: boolean;
  isDefault: boolean;

  // Statistics
  totalTradesWithConfig?: number;
  successfulTrades?: number;
  avgRiskTaken?: number;
  avgReturn?: number;
  largestLoss?: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface RiskConfigStats {
  total: number;
  byType: {
    FIXED: number;
    ADAPTIVE: number;
    NEWS_BASED: number;
  };
  active: number;
  default: RiskConfig | null;
}

export interface RiskConfigListResponse {
  success: boolean;
  message: string;
  data: {
    configs: RiskConfig[];
    stats: RiskConfigStats;
  };
}

export interface RiskConfigResponse {
  success: boolean;
  message: string;
  data: {
    config: RiskConfig;
  };
}

export interface CreateRiskConfigRequest {
  name: string;
  description?: string;
  type: RiskConfigType;

  // Fixed Risk
  riskPerTrade?: number;
  maxPositionSize?: number;
  maxDailyLoss?: number;
  maxDrawdown?: number;

  // Adaptive Risk
  baseRiskPercent?: number;
  winStreakMultiplier?: number;
  lossStreakDivisor?: number;
  maxAdaptiveRisk?: number;
  minAdaptiveRisk?: number;

  // News-Based Risk
  newsBasedEnabled?: boolean;
  reduceRiskBeforeNews?: boolean;
  newsRiskReduction?: number;
  newsSafetyWindow?: number;

  // Stop Loss & Take Profit
  useStopLoss?: boolean;
  stopLossPercent?: number;
  useTakeProfit?: boolean;
  takeProfitPercent?: number;
  riskRewardRatio?: number;

  // Position Management
  maxOpenPositions?: number;
  correlationLimit?: number;
  allowHedging?: boolean;

  // Leverage & Margin
  maxLeverage?: number;
  useMargin?: boolean;
  marginSafetyPercent?: number;

  // Status
  isDefault?: boolean;
}

export interface UpdateRiskConfigRequest {
  name?: string;
  description?: string;
  riskPerTrade?: number;
  maxPositionSize?: number;
  maxDailyLoss?: number;
  maxDrawdown?: number;
  baseRiskPercent?: number;
  winStreakMultiplier?: number;
  lossStreakDivisor?: number;
  maxAdaptiveRisk?: number;
  minAdaptiveRisk?: number;
  newsBasedEnabled?: boolean;
  reduceRiskBeforeNews?: boolean;
  newsRiskReduction?: number;
  newsSafetyWindow?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  riskRewardRatio?: number;
  maxOpenPositions?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface SimulationRequest {
  configId: string;
  capitalAmount: number;
  currentPrice: number;
  winStreak?: number;
  lossStreak?: number;
  checkNewsImpact?: boolean;
}

export interface FixedSimulation {
  type: 'FIXED';
  description: string;
  capitalAmount: number;
  riskPerTrade: number;
  riskAmount: string;
  stopLossPercent: number;
  stopLossDistance: string;
  positionSize: string;
  positionValue: string;
  positionPercent: string;
  stopLossPrice: string;
  takeProfitPrice: string | null;
  maxPositionSize: number;
  isWithinLimits: boolean;
  potentialOutcomes: PotentialOutcomes;
}

export interface AdaptiveSimulation {
  type: 'ADAPTIVE';
  description: string;
  capitalAmount: number;
  baseRiskPercent: number;
  adjustedRiskPercent: string;
  winStreak: number;
  lossStreak: number;
  riskAmount: string;
  positionSize: string;
  positionValue: string;
  stopLossPrice: string;
  takeProfitPrice?: string;
  adaptiveRange: string;
  streakImpact: string;
  potentialOutcomes: PotentialOutcomes;
}

export interface NewsBasedSimulation {
  type: 'NEWS_BASED';
  description: string;
  capitalAmount: number;
  baseRiskPercent: number;
  adjustedRiskPercent: string;
  riskAmount: string;
  positionSize: string;
  positionValue: string;
  stopLossPrice: string;
  takeProfitPrice?: string;
  newsImpact: NewsImpact | null;
  newsBasedSettings: NewsBasedSettings;
  potentialOutcomes: PotentialOutcomes;
}

export interface NewsImpact {
  detected: boolean;
  reduction: number;
  safetyWindow: number;
  message: string;
}

export interface NewsBasedSettings {
  enabled: boolean;
  reduceRiskBeforeNews: boolean;
  riskReduction: number;
  safetyWindow: number;
}

export interface PotentialOutcomes {
  stopLossHit: {
    loss: string;
    newCapital: string;
    percentLoss: string;
  };
  takeProfitHit: {
    profit: string;
    newCapital: string;
    percentGain: string;
  } | null;
}

export type Simulation = FixedSimulation | AdaptiveSimulation | NewsBasedSimulation;

export interface SimulationResponse {
  success: boolean;
  message: string;
  data: {
    config: {
      id: string;
      name: string;
      type: RiskConfigType;
    };
    simulation: Simulation;
  };
}

export interface RiskConfigFormData {
  name: string;
  description: string;
  type: RiskConfigType;

  // Fixed
  riskPerTrade: number;
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;

  // Adaptive
  baseRiskPercent: number;
  winStreakMultiplier: number;
  lossStreakDivisor: number;
  maxAdaptiveRisk: number;
  minAdaptiveRisk: number;

  // News-Based
  newsBasedEnabled: boolean;
  reduceRiskBeforeNews: boolean;
  newsRiskReduction: number;
  newsSafetyWindow: number;

  // Common
  useStopLoss: boolean;
  stopLossPercent: number;
  useTakeProfit: boolean;
  takeProfitPercent: number;
  riskRewardRatio: number;
  maxOpenPositions: number;
  maxLeverage: number;
  isDefault: boolean;
}
