import React, { createContext, useContext } from 'react';
import { useGlobalWebSocket } from '../hooks/useGlobalWebSocket';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext({ connected: false, subscribe: () => () => {} });

export function WebSocketProvider({ children }) {
  const { token } = useAuth();
  const ws = useGlobalWebSocket(token);

  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWS() {
  return useContext(WebSocketContext);
}
