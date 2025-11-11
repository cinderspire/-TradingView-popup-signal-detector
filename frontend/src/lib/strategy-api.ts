/**
 * Strategy API Service
 *
 * Handles all API calls related to trading strategies and subscriptions
 */

import { apiClient } from './api-client';
import type {
  Strategy,
  StrategyListResponse,
  StrategyResponse,
  CreateStrategyRequest,
  UpdateStrategyRequest,
  StrategyFilters,
  SubscribeRequest,
  SubscribeResponse,
  UnsubscribeResponse,
  UserSubscriptionsResponse,
  StrategyPerformanceResponse,
} from '@/types/strategy';

export class StrategyApi {
  /**
   * List all public strategies (marketplace)
   */
  async listStrategies(filters?: StrategyFilters): Promise<StrategyListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.status) params.append('status', filters.status);
      if (filters.isPublic !== undefined) params.append('isPublic', String(filters.isPublic));
      if (filters.tradingPair) params.append('tradingPair', filters.tradingPair);
      if (filters.minWinRate !== undefined) params.append('minWinRate', String(filters.minWinRate));
      if (filters.maxPrice !== undefined) params.append('maxPrice', String(filters.maxPrice));
      if (filters.providerId) params.append('providerId', filters.providerId);
      if (filters.search) params.append('search', filters.search);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    }

    const query = params.toString();
    return apiClient.get<StrategyListResponse>(
      `/api/strategies${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get a single strategy by ID
   */
  async getStrategy(strategyId: string): Promise<StrategyResponse> {
    return apiClient.get<StrategyResponse>(`/api/strategies/${strategyId}`);
  }

  /**
   * Create a new strategy (providers only)
   */
  async createStrategy(data: CreateStrategyRequest): Promise<StrategyResponse> {
    return apiClient.post<StrategyResponse>('/api/strategies', data);
  }

  /**
   * Update an existing strategy (providers only)
   */
  async updateStrategy(strategyId: string, data: UpdateStrategyRequest): Promise<StrategyResponse> {
    return apiClient.put<StrategyResponse>(`/api/strategies/${strategyId}`, data);
  }

  /**
   * Delete a strategy (providers only)
   */
  async deleteStrategy(strategyId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete(`/api/strategies/${strategyId}`);
  }

  /**
   * Get strategies created by the current provider
   */
  async getMyStrategies(filters?: StrategyFilters): Promise<StrategyListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.status) params.append('status', filters.status);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    }

    const query = params.toString();
    return apiClient.get<StrategyListResponse>(
      `/api/strategies/my${query ? `?${query}` : ''}`
    );
  }

  /**
   * Subscribe to a strategy
   */
  async subscribe(data: SubscribeRequest): Promise<SubscribeResponse> {
    return apiClient.post<SubscribeResponse>('/api/subscriptions', data);
  }

  /**
   * Unsubscribe from a strategy
   */
  async unsubscribe(subscriptionId: string): Promise<UnsubscribeResponse> {
    return apiClient.delete<UnsubscribeResponse>(`/api/subscriptions/${subscriptionId}`);
  }

  /**
   * Get user's active subscriptions
   */
  async getMySubscriptions(): Promise<UserSubscriptionsResponse> {
    return apiClient.get<UserSubscriptionsResponse>('/api/subscriptions/my');
  }

  /**
   * Check if user is subscribed to a strategy
   */
  async isSubscribed(strategyId: string): Promise<boolean> {
    try {
      const response = await this.getMySubscriptions();
      if (response.success && response.data.subscriptions) {
        return response.data.subscriptions.some(
          (sub) => sub.strategyId === strategyId && sub.status === 'ACTIVE'
        );
      }
      return false;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Get strategy performance history (for charts)
   */
  async getStrategyPerformance(strategyId: string): Promise<StrategyPerformanceResponse> {
    return apiClient.get<StrategyPerformanceResponse>(`/api/strategies/${strategyId}/performance`);
  }

  /**
   * Toggle strategy status (ACTIVE <-> PAUSED)
   */
  async toggleStrategyStatus(strategyId: string): Promise<StrategyResponse> {
    return apiClient.post<StrategyResponse>(`/api/strategies/${strategyId}/toggle-status`);
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(subscriptionId: string): Promise<SubscribeResponse> {
    return apiClient.post<SubscribeResponse>(`/api/subscriptions/${subscriptionId}/pause`);
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<SubscribeResponse> {
    return apiClient.post<SubscribeResponse>(`/api/subscriptions/${subscriptionId}/resume`);
  }

  /**
   * Toggle auto-renewal for a subscription
   */
  async toggleAutoRenew(subscriptionId: string): Promise<SubscribeResponse> {
    return apiClient.post<SubscribeResponse>(`/api/subscriptions/${subscriptionId}/toggle-auto-renew`);
  }
}

// Export singleton instance
export const strategyApi = new StrategyApi();
