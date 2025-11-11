// Risk Management API Service
// Handles all risk management API calls

import { apiClient } from './api-client';
import {
  RiskConfigListResponse,
  RiskConfigResponse,
  CreateRiskConfigRequest,
  UpdateRiskConfigRequest,
  SimulationRequest,
  SimulationResponse,
} from '@/types/risk-management';

export class RiskManagementApi {
  /**
   * List all risk configurations for the authenticated user
   * @param filters Optional filters (type, isActive)
   */
  async listConfigs(filters?: {
    type?: string;
    isActive?: boolean;
  }): Promise<RiskConfigListResponse> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));

    const query = params.toString();
    const endpoint = `/api/risk-management${query ? `?${query}` : ''}`;

    return apiClient.get<RiskConfigListResponse>(endpoint);
  }

  /**
   * Create a new risk configuration
   * @param data Configuration data
   */
  async createConfig(data: CreateRiskConfigRequest): Promise<RiskConfigResponse> {
    return apiClient.post<RiskConfigResponse>('/api/risk-management', data);
  }

  /**
   * Update an existing risk configuration
   * @param id Configuration ID
   * @param data Updated fields
   */
  async updateConfig(
    id: string,
    data: UpdateRiskConfigRequest
  ): Promise<RiskConfigResponse> {
    return apiClient.put<RiskConfigResponse>(`/api/risk-management/${id}`, data);
  }

  /**
   * Delete a risk configuration
   * @param id Configuration ID
   */
  async deleteConfig(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(
      `/api/risk-management/${id}`
    );
  }

  /**
   * Simulate risk configuration with market conditions
   * @param data Simulation parameters
   */
  async simulateConfig(data: SimulationRequest): Promise<SimulationResponse> {
    return apiClient.post<SimulationResponse>('/api/risk-management/test', data);
  }

  /**
   * Set a configuration as default
   * @param id Configuration ID
   */
  async setAsDefault(id: string): Promise<RiskConfigResponse> {
    return this.updateConfig(id, { isDefault: true });
  }

  /**
   * Toggle configuration active status
   * @param id Configuration ID
   * @param isActive New active status
   */
  async toggleActive(id: string, isActive: boolean): Promise<RiskConfigResponse> {
    return this.updateConfig(id, { isActive });
  }
}

// Singleton instance
export const riskManagementApi = new RiskManagementApi();
