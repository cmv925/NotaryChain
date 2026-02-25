import { useEffect, useRef, useState, useCallback } from 'react';

const WS_RECONNECT_DELAY = 3000;
const WS_PING_INTERVAL = 25000;

/**
 * Global WebSocket hook for real-time notifications and dashboard events.
 * Connects once per session and pushes events via callbacks.
 */
export function useGlobalWebSocket(token) {
  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const reconnectRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef(new Map());

  // Register an event listener: returns unsubscribe function
  const subscribe = useCallback((eventType, callback) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType).add(callback);
    return () => {
      listenersRef.current.get(eventType)?.delete(callback);
    };
  }, []);

  const connectWs = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const wsUrl = backendUrl.replace(/^http/, 'ws') + '/api/ws/global';

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send auth message
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);

        if (msg.type === 'connected') {
          setConnected(true);
          // Start ping interval
          pingRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, WS_PING_INTERVAL);
          return;
        }

        if (msg.type === 'error') {
          console.warn('WS Global error:', msg.message);
          return;
        }

        if (msg.type === 'pong') return;

        // Dispatch to listeners
        // For notifications: type='notification'
        // For events: type='event', event=<event_type>
        const key = msg.type === 'event' ? msg.event : msg.type;
        const listeners = listenersRef.current.get(key);
        if (listeners) {
          listeners.forEach(cb => {
            try { cb(msg); } catch {}
          });
        }

        // Also dispatch a wildcard '*' for catch-all listeners
        const wildcardListeners = listenersRef.current.get('*');
        if (wildcardListeners) {
          wildcardListeners.forEach(cb => {
            try { cb(msg); } catch {}
          });
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval(pingRef.current);
      // Auto-reconnect
      reconnectRef.current = setTimeout(connectWs, WS_RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token]);

  useEffect(() => {
    connectWs();
    return () => {
      clearInterval(pingRef.current);
      clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWs]);

  return { connected, subscribe };
}
