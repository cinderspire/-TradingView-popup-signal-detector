/**
 * Position API Service
 *
 * Handles all API calls related to trading positions
 */

import { apiClient } from './api-client';
import type {
  Position,
  PositionListResponse,
  PositionResponse,
  CreatePositionRequest,
  UpdatePositionRequest,
  ClosePositionRequest,
  ClosePositionResponse,
  PositionFilters,
  UserPositionsResponse,
} from '@/types/position';

export class PositionApi {
  /**
   * List all positions (with optional filters)
   */
  async listPositions(filters?: PositionFilters): Promise<PositionListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.status) params.append('status', filters.status);
      if (filters.side) params.append('side', filters.side);
      if (filters.symbol) params.append('symbol', filters.symbol);
      if (filters.strategyId) params.append('strategyId', filters.strategyId);
      if (filters.closeReason) params.append('closeReason', filters.closeReason);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.minPnL !== undefined) params.append('minPnL', String(filters.minPnL));
      if (filters.maxPnL !== undefined) params.append('maxPnL', String(filters.maxPnL));
      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    }

    const query = params.toString();
    return apiClient.get<PositionListResponse>(
      `/api/positions${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get user's positions (current user)
   */
  async getMyPositions(filters?: PositionFilters): Promise<UserPositionsResponse> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.status) params.append('status', filters.status);
      if (filters.side) params.append('side', filters.side);
      if (filters.symbol) params.append('symbol', filters.symbol);
      if (filters.strategyId) params.append('strategyId', filters.strategyId);
    }

    const query = params.toString();
    return apiClient.get<UserPositionsResponse>(
      `/api/positions/my${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get a single position by ID
   */
  async getPosition(positionId: string): Promise<PositionResponse> {
    return apiClient.get<PositionResponse>(`/api/positions/${positionId}`);
  }

  /**
   * Create a new position
   */
  async createPosition(data: CreatePositionRequest): Promise<PositionResponse> {
    return apiClient.post<PositionResponse>('/api/positions', data);
  }

  /**
   * Update an existing position (modify SL/TP)
   */
  async updatePosition(
    positionId: string,
    data: UpdatePositionRequest
  ): Promise<PositionResponse> {
    return apiClient.put<PositionResponse>(`/api/positions/${positionId}`, data);
  }

  /**
   * Close a position
   */
  async closePosition(data: ClosePositionRequest): Promise<ClosePositionResponse> {
    return apiClient.post<ClosePositionResponse>(
      `/api/positions/${data.positionId}/close`,
      data
    );
  }

  /**
   * Delete a position (admin only, or user can delete their own closed positions)
   */
  async deletePosition(positionId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete(`/api/positions/${positionId}`);
  }

  /**
   * Get open positions only
   */
  async getOpenPositions(filters?: PositionFilters): Promise<PositionListResponse> {
    return this.listPositions({ ...filters, status: 'OPEN' });
  }

  /**
   * Get closed positions only
   */
  async getClosedPositions(filters?: PositionFilters): Promise<PositionListResponse> {
    return this.listPositions({ ...filters, status: 'CLOSED' });
  }

  /**
   * Get positions for a specific strategy
   */
  async getStrategyPositions(
    strategyId: string,
    filters?: PositionFilters
  ): Promise<PositionListResponse> {
    return this.listPositions({ ...filters, strategyId });
  }

  /**
   * Get profitable positions only
   */
  async getProfitablePositions(filters?: PositionFilters): Promise<PositionListResponse> {
    return this.listPositions({ ...filters, minPnL: 0.01 });
  }

  /**
   * Get losing positions only
   */
  async getLosingPositions(filters?: PositionFilters): Promise<PositionListResponse> {
    return this.listPositions({ ...filters, maxPnL: -0.01 });
  }

  /**
   * Get position history (closed positions sorted by close date)
   */
  async getPositionHistory(filters?: PositionFilters): Promise<PositionListResponse> {
    return this.listPositions({
      ...filters,
      status: 'CLOSED',
      sortBy: 'closedAt',
      sortOrder: 'desc',
    });
  }
}

// Export singleton instance
export const positionApi = new PositionApi();
