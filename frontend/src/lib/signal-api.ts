/**
 * Signal API Service
 *
 * Handles all API calls related to trading signals
 */

import { apiClient } from './api-client';
import type {
  Signal,
  SignalListResponse,
  SignalResponse,
  CreateSignalRequest,
  UpdateSignalRequest,
  ExecuteSignalRequest,
  ExecuteSignalResponse,
  SignalFilters,
  UserSignalsResponse,
} from '@/types/signal';

export class SignalApi {
  /**
   * List all signals (with optional filters)
   */
  async listSignals(filters?: SignalFilters): Promise<SignalListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.strategyId) params.append('strategyId', filters.strategyId);
      if (filters.providerId) params.append('providerId', filters.providerId);
      if (filters.type) params.append('type', filters.type);
      if (filters.direction) params.append('direction', filters.direction);
      if (filters.status) params.append('status', filters.status);
      if (filters.symbol) params.append('symbol', filters.symbol);
      if (filters.timeframe) params.append('timeframe', filters.timeframe);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    }

    const query = params.toString();
    return apiClient.get<SignalListResponse>(
      `/api/signals${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get user's signals (from subscribed strategies)
   */
  async getMySignals(filters?: SignalFilters): Promise<UserSignalsResponse> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.status) params.append('status', filters.status);
      if (filters.symbol) params.append('symbol', filters.symbol);
      if (filters.type) params.append('type', filters.type);
      if (filters.direction) params.append('direction', filters.direction);
    }

    const query = params.toString();
    return apiClient.get<UserSignalsResponse>(
      `/api/signals/my${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get a single signal by ID
   */
  async getSignal(signalId: string): Promise<SignalResponse> {
    return apiClient.get<SignalResponse>(`/api/signals/${signalId}`);
  }

  /**
   * Create a new signal (providers only)
   */
  async createSignal(data: CreateSignalRequest): Promise<SignalResponse> {
    return apiClient.post<SignalResponse>('/api/signals', data);
  }

  /**
   * Update an existing signal (providers only)
   */
  async updateSignal(
    signalId: string,
    data: UpdateSignalRequest
  ): Promise<SignalResponse> {
    return apiClient.put<SignalResponse>(`/api/signals/${signalId}`, data);
  }

  /**
   * Delete a signal (providers only)
   */
  async deleteSignal(signalId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete(`/api/signals/${signalId}`);
  }

  /**
   * Execute a signal (user action - create position from signal)
   */
  async executeSignal(data: ExecuteSignalRequest): Promise<ExecuteSignalResponse> {
    return apiClient.post<ExecuteSignalResponse>(
      `/api/signals/${data.signalId}/execute`,
      data
    );
  }

  /**
   * Cancel a signal (providers only)
   */
  async cancelSignal(signalId: string): Promise<SignalResponse> {
    return apiClient.post<SignalResponse>(`/api/signals/${signalId}/cancel`);
  }

  /**
   * Get signals for a specific strategy
   */
  async getStrategySignals(
    strategyId: string,
    filters?: SignalFilters
  ): Promise<SignalListResponse> {
    return this.listSignals({ ...filters, strategyId });
  }

  /**
   * Get active signals only
   */
  async getActiveSignals(filters?: SignalFilters): Promise<SignalListResponse> {
    return this.listSignals({ ...filters, status: 'ACTIVE' });
  }

  /**
   * Get signal history (closed signals)
   */
  async getSignalHistory(filters?: SignalFilters): Promise<SignalListResponse> {
    const closedStatuses = ['EXECUTED', 'CANCELLED', 'EXPIRED'];
    // Note: Backend should support multiple status filters, or we call individually
    return this.listSignals({
      ...filters,
      sortBy: 'closedAt',
      sortOrder: 'desc',
    });
  }

  /**
   * Get signals created by current provider
   */
  async getMyCreatedSignals(filters?: SignalFilters): Promise<SignalListResponse> {
    return apiClient.get<SignalListResponse>(
      '/api/signals/provider/my' + (filters ? `?${new URLSearchParams(filters as any)}` : '')
    );
  }
}

// Export singleton instance
export const signalApi = new SignalApi();
