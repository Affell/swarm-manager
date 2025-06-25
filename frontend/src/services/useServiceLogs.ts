import { useState, useEffect, useRef } from 'react';

export const useServiceLogs = (serviceId: string) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<string[]>([]);

  useEffect(() => {
    if (!serviceId) return;

    const connectWebSocket = () => {
      setConnecting(true);
      setError(null);

      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Use backend port for WebSocket connection
      const backendPort = '5000';
      const hostname = window.location.hostname;
      const wsUrl = `${protocol}//${hostname}:${backendPort}/api/services/${serviceId}/logs`;

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
                setLogs(prev => [...prev.slice(-500), text]); // Keep only last 500 logs
              }
            };
            reader.readAsText(event.data);
          } else if (typeof event.data === 'string') {
            // Handle text data
            if (event.data.trim()) {
              setLogs(prev => [...prev.slice(-500), event.data]); // Keep only last 500 logs
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
          // Try to reconnect after 5 seconds if not paused
          setTimeout(() => {
            if (serviceId && !isPaused) {
              connectWebSocket();
            }
          }, 5000);
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de connexion');
        setConnecting(false);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [serviceId, isPaused]);

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
      setLogs(prev => [...prev, ...bufferRef.current].slice(-500));
      bufferRef.current = [];
    }
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
  };
};