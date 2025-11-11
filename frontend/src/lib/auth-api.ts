// Authentication API Service
// Handles all authentication API calls

import { apiClient } from './api-client';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutResponse,
} from '@/types/auth';

export class AuthApi {
  /**
   * Login with email and password
   * @param credentials Email and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/auth/login', credentials);

    // Store tokens if login successful
    if (response.success && response.data.tokens) {
      apiClient.setToken(response.data.tokens.accessToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('refresh_token', response.data.tokens.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }

    return response;
  }

  /**
   * Register a new user
   * @param data Registration data
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>('/api/auth/register', data);

    // Store tokens if registration successful
    if (response.success && response.data.tokens) {
      apiClient.setToken(response.data.tokens.accessToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('refresh_token', response.data.tokens.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }

    return response;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<RefreshTokenResponse> {
    if (typeof window === 'undefined') {
      throw new Error('Cannot refresh token on server side');
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiClient.post<RefreshTokenResponse>('/api/auth/refresh', {
      refreshToken,
    });

    // Store new access token
    if (response.success && response.data.tokens) {
      apiClient.setToken(response.data.tokens.accessToken);
      localStorage.setItem('refresh_token', response.data.tokens.refreshToken);
    }

    return response;
  }

  /**
   * Logout current user
   */
  async logout(): Promise<LogoutResponse> {
    try {
      const response = await apiClient.post<LogoutResponse>('/api/auth/logout');
      return response;
    } finally {
      // Clear tokens and user data regardless of API response
      this.clearAuthData();
    }
  }

  /**
   * Clear all authentication data
   */
  clearAuthData(): void {
    apiClient.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  }

  /**
   * Get stored user data
   */
  getStoredUser(): any | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return null;
    }

    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * Get stored access token
   */
  getStoredAccessToken(): string | null {
    return apiClient.getToken();
  }

  /**
   * Get stored refresh token
   */
  getStoredRefreshToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem('refresh_token');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getStoredAccessToken() && !!this.getStoredUser();
  }
}

// Singleton instance
export const authApi = new AuthApi();
