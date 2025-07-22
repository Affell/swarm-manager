import { API_SOCKET_URL } from '@/services/api';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export interface SwarmLogsOptions {
  stack?: string;
  service?: string;
  search?: string;
}

export const useSwarmLogs = (options: SwarmLogsOptions = {}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<string[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stabiliser les options pour éviter les re-créations inutiles
  const stableOptions = useMemo(() => ({
    stack: options.stack,
    service: options.service,
  }), [options.stack, options.service]);

  const cleanupConnection = useCallback(() => {
    // Nettoyer le timeout de reconnexion
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setConnecting(false);
  }, []);

  const connectWebSocket = useCallback(() => {
    // Clean up any existing connection first
    cleanupConnection();
    
    setConnecting(true);
    setError(null);
    
    // Build query parameters (only stack and service, not search)
    const params = new URLSearchParams();
    if (stableOptions.stack) params.append('stack', stableOptions.stack);
    if (stableOptions.service) params.append('service', stableOptions.service);
    // Note: search is handled client-side, not in WebSocket URL
    
    const queryString = params.toString();
    const wsUrl = `${API_SOCKET_URL}/swarm/logs${queryString ? `?${queryString}` : ''}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
      };

      ws.onmessage = (event) => {
        if (isPaused) {
          // Store in buffer when paused
          bufferRef.current.push(event.data);
          return;
        }

        if (event.data instanceof Blob) {
          // Handle binary data
          const reader = new FileReader();
          reader.onload = () => {
            const text = reader.result as string;
            if (text.trim()) {
              setLogs(prev => [...prev.slice(-1000), text]); // Keep only last 1000 logs
            }
          };
          reader.readAsText(event.data);
        } else if (typeof event.data === 'string') {
          // Handle text data
          if (event.data.trim()) {
            setLogs(prev => [...prev.slice(-1000), event.data]); // Keep only last 1000 logs
          }
        }
      };

      ws.onerror = (err) => {
        setError('Erreur de connexion WebSocket');
        setConnected(false);
        setConnecting(false);
      };

      ws.onclose = (event) => {
        setConnected(false);
        setConnecting(false);
        // Only try to reconnect if it wasn't intentionally closed (code 1000)
        if (!isPaused && event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            // Vérifier que nous ne sommes toujours pas en pause et qu'il n'y a pas déjà une connexion
            if (!isPaused && !wsRef.current) {
              connectWebSocket();
            }
          }, 5000);
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
      setConnecting(false);
    }
  }, [stableOptions, cleanupConnection, isPaused]);

  useEffect(() => {
    if (!isPaused) {
      // Clear logs when filters change to avoid confusion
      setLogs([]);
      bufferRef.current = [];
      connectWebSocket();
    }

    // Cleanup function to close connection when component unmounts or dependencies change
    return () => {
      cleanupConnection();
    };
  }, [stableOptions, isPaused]); // Enlevé connectWebSocket et cleanupConnection des dépendances

  const clearLogs = () => {
    setLogs([]);
    bufferRef.current = [];
  };

  const pause = () => {
    setIsPaused(true);
    cleanupConnection();
  };

  const resume = () => {
    setIsPaused(false);
    // Add buffered logs
    if (bufferRef.current.length > 0) {
      setLogs(prev => [...prev, ...bufferRef.current].slice(-1000));
      bufferRef.current = [];
    }
    // Connection will be re-established by useEffect
  };

  const downloadLogs = () => {
    const logsText = logs.join('\n');
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swarm-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    logs,
    connected,
    connecting,
    error,
    isPaused,
    clearLogs,
    pause,
    resume,
    downloadLogs,
  };
};
