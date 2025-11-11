'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Signal, SignalWebSocketEvent } from '@/types/signal';
import { io, Socket } from 'socket.io-client';

interface UseSignalWebSocketOptions {
  autoConnect?: boolean;
  onNewSignal?: (signal: Signal) => void;
  onSignalUpdate?: (signal: Signal) => void;
  onSignalClosed?: (signal: Signal) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

interface UseSignalWebSocketReturn {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  subscribeToStrategy: (strategyId: string) => void;
  unsubscribeFromStrategy: (strategyId: string) => void;
  error: Error | null;
}

/**
 * Custom hook for WebSocket connection to receive real-time trading signals
 *
 * Usage:
 * ```
 * const { isConnected, subscribeToStrategy } = useSignalWebSocket({
 *   onNewSignal: (signal) => {
 *     console.log('New signal:', signal);
 *   }
 * });
 * ```
 */
export function useSignalWebSocket(
  options: UseSignalWebSocketOptions = {}
): UseSignalWebSocketReturn {
  const {
    autoConnect = true,
    onNewSignal,
    onSignalUpdate,
    onSignalClosed,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Get WebSocket URL from environment
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:6864';

  // Initialize WebSocket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      // Get auth token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      // Create socket connection
      const socket = io(wsUrl, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      // Connection events
      socket.on('connect', () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
        onConnect?.();
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
        onDisconnect?.();
      });

      socket.on('connect_error', (err) => {
        console.error('WebSocket connection error:', err);
        const error = new Error(`Connection failed: ${err.message}`);
        setError(error);
        onError?.(error);
      });

      // Signal events
      socket.on('signal:new', (event: SignalWebSocketEvent) => {
        console.log('New signal received:', event.signal);
        onNewSignal?.(event.signal);
      });

      socket.on('signal:update', (event: SignalWebSocketEvent) => {
        console.log('Signal update received:', event.signal);
        onSignalUpdate?.(event.signal);
      });

      socket.on('signal:closed', (event: SignalWebSocketEvent) => {
        console.log('Signal closed:', event.signal);
        onSignalClosed?.(event.signal);
      });

      // Error events
      socket.on('error', (err: any) => {
        console.error('WebSocket error:', err);
        const error = new Error(err.message || 'WebSocket error');
        setError(error);
        onError?.(error);
      });

      socketRef.current = socket;
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      const error = err instanceof Error ? err : new Error('Connection failed');
      setError(error);
      onError?.(error);
    }
  }, [wsUrl, onNewSignal, onSignalUpdate, onSignalClosed, onConnect, onDisconnect, onError]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Subscribe to signals from a specific strategy
  const subscribeToStrategy = useCallback((strategyId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:strategy', { strategyId });
      console.log('Subscribed to strategy signals:', strategyId);
    } else {
      console.warn('Cannot subscribe: WebSocket not connected');
    }
  }, []);

  // Unsubscribe from a strategy
  const unsubscribeFromStrategy = useCallback((strategyId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe:strategy', { strategyId });
      console.log('Unsubscribed from strategy signals:', strategyId);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
    subscribeToStrategy,
    unsubscribeFromStrategy,
    error,
  };
}
