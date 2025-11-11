'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '@/lib/auth-api';
import { User, AuthContextType, RegisterRequest } from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      const storedUser = authApi.getStoredUser();
      const storedAccessToken = authApi.getStoredAccessToken();
      const storedRefreshToken = authApi.getStoredRefreshToken();

      if (storedUser && storedAccessToken) {
        setUser(storedUser);
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });

      if (response.success) {
        setUser(response.data.user);
        setAccessToken(response.data.tokens.accessToken);
        setRefreshToken(response.data.tokens.refreshToken);
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      throw error;
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      const response = await authApi.register(data);

      if (response.success) {
        setUser(response.data.user);
        setAccessToken(response.data.tokens.accessToken);
        setRefreshToken(response.data.tokens.refreshToken);
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    authApi.logout().catch(console.error);
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  };

  const refreshAuth = async () => {
    try {
      const response = await authApi.refreshToken();

      if (response.success) {
        setAccessToken(response.data.tokens.accessToken);
        setRefreshToken(response.data.tokens.refreshToken);
      }
    } catch (error) {
      // If refresh fails, logout
      logout();
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    accessToken,
    refreshToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    login,
    register,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
