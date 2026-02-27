import { useEffect, useRef, useState, useCallback } from 'react';

const WS_PING_INTERVAL = 25000;

/**
 * Hook for real-time draft collaboration via WebSocket.
 * Provides presence tracking, cursor/typing indicators, and live edit broadcasting.
 */
export function useDraftCollaboration(draftId, token) {
  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [cursors, setCursors] = useState({});      // { user_id: { field, user_name } }
  const [typingUsers, setTypingUsers] = useState({}); // { user_id: { field, user_name } }
  const [remoteEdits, setRemoteEdits] = useState(null); // latest remote edit event
  const listenersRef = useRef(new Map());

  const subscribe = useCallback((eventType, callback) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType).add(callback);
    return () => listenersRef.current.get(eventType)?.delete(callback);
  }, []);

  const sendMessage = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendCursor = useCallback((field) => {
    sendMessage({ type: 'cursor', field });
  }, [sendMessage]);

  const sendTyping = useCallback((field, isTyping) => {
    sendMessage({ type: 'typing', field, is_typing: isTyping });
  }, [sendMessage]);

  const sendFieldUpdate = useCallback((field, value) => {
    sendMessage({ type: 'field_update', field, value });
  }, [sendMessage]);

  useEffect(() => {
    if (!token || !draftId) return;

    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const wsUrl = backendUrl.replace(/^http/, 'ws') + `/api/ws/draft/${draftId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);

        if (msg.type === 'connected') {
          setConnected(true);
          setUsers(msg.users || []);
          pingRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, WS_PING_INTERVAL);
          return;
        }

        if (msg.type === 'pong' || msg.type === 'error') return;

        if (msg.type === 'presence') {
          setUsers(msg.users || []);
        }

        if (msg.type === 'cursor_update') {
          setCursors(prev => ({
            ...prev,
            [msg.user_id]: { field: msg.field, user_name: msg.user_name },
          }));
        }

        if (msg.type === 'typing_indicator') {
          if (msg.is_typing) {
            setTypingUsers(prev => ({
              ...prev,
              [msg.user_id]: { field: msg.field, user_name: msg.user_name },
            }));
          } else {
            setTypingUsers(prev => {
              const next = { ...prev };
              delete next[msg.user_id];
              return next;
            });
          }
        }

        if (msg.type === 'remote_edit') {
          setRemoteEdits(msg);
        }

        // Dispatch to listeners
        const listeners = listenersRef.current.get(msg.type);
        if (listeners) {
          listeners.forEach(cb => { try { cb(msg); } catch {} });
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval(pingRef.current);
    };

    ws.onerror = () => ws.close();

    return () => {
      clearInterval(pingRef.current);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [token, draftId]);

  return {
    connected,
    users,
    cursors,
    typingUsers,
    remoteEdits,
    sendCursor,
    sendTyping,
    sendFieldUpdate,
    subscribe,
  };
}
