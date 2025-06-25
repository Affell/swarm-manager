import { useState, useEffect, useRef } from 'react';

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

  const connectWebSocket = () => {
    setConnecting(true);
    setError(null);

    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendPort = '5000';
    const hostname = window.location.hostname;
    
    // Build query parameters (only stack and service, not search)
    const params = new URLSearchParams();
    if (options.stack) params.append('stack', options.stack);
    if (options.service) params.append('service', options.service);
    // Note: search is handled client-side, not in WebSocket URL
    
    const queryString = params.toString();
    const wsUrl = `${protocol}//${hostname}:${backendPort}/api/swarm/logs${queryString ? `?${queryString}` : ''}`;

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
        console.error('WebSocket error:', err);
        setError('Erreur de connexion WebSocket');
        setConnected(false);
        setConnecting(false);
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        // Try to reconnect after 5 seconds if not intentionally closed
        setTimeout(() => {
          if (!isPaused) {
            connectWebSocket();
          }
        }, 5000);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (!isPaused) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [options.stack, options.service, isPaused]); // Removed options.search from dependencies

  const clearLogs = () => {
    setLogs([]);
    bufferRef.current = [];
  };

  const pause = () => {
    setIsPaused(true);
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const resume = () => {
    setIsPaused(false);
    // Add buffered logs
    if (bufferRef.current.length > 0) {
      setLogs(prev => [...prev, ...bufferRef.current].slice(-1000));
      bufferRef.current = [];
    }
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
