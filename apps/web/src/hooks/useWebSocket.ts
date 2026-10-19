import { useEffect, useRef, useState, useCallback } from 'react';
import { getWebSocketUrl } from '../lib/api';
import type { NetworkMessage } from '@nofus/shared';

interface UseWebSocketOptions {
  roomCode: string;
  // Read on every (re)connect so reconnects use the latest stored identity
  getConnectionParams: () => Record<string, string> | null;
  onMessage: (message: NetworkMessage) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  // Consecutive connection attempts that closed without ever opening
  failedAttempts: number;
  sendMessage: (message: Omit<NetworkMessage, "senderId">) => void;
  connect: () => void;
  disconnect: () => void;
}

const RECONNECT_DELAY_MS = 2000;

export function useWebSocket({
  roomCode,
  getConnectionParams,
  onMessage,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const onMessageRef = useRef(onMessage);
  const getParamsRef = useRef(getConnectionParams);

  // Keep callback refs updated
  useEffect(() => {
    onMessageRef.current = onMessage;
    getParamsRef.current = getConnectionParams;
  }, [onMessage, getConnectionParams]);

  const connect = useCallback(() => {
    const state = wsRef.current?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const params = getParamsRef.current();
    if (!params) return;

    const url = getWebSocketUrl(roomCode, params);
    console.log("Connecting to WebSocket", url);
    const ws = new WebSocket(url);
    let opened = false;

    ws.onopen = () => {
      opened = true;
      setIsConnected(true);
      setFailedAttempts(0);
      console.log("WebSocket connected");
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setIsConnected(false);
      if (!opened) setFailedAttempts((n) => n + 1);
      console.log("WebSocket disconnected");

      // Attempt reconnection after a short delay
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (wsRef.current === ws) {
          connect();
        }
      }, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      console.error("WebSocket error");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as NetworkMessage;
        console.log("Received message:", message);
        onMessageRef.current(message);
      } catch (err) {
        console.error("Failed to parse message:", err);
      }
    };

    wsRef.current = ws;
  }, [roomCode]);

  const disconnect = useCallback(() => {
    console.log("Disconnecting WebSocket");
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      ws.close();
    }
  }, []);

  const sendMessage = useCallback(
    (message: Omit<NetworkMessage, "senderId">) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn("WebSocket not connected, cannot send message");
      }
    },
    []
  );

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return disconnect;
  }, []);

  // Mobile browsers often kill sockets in background tabs; reconnect as soon
  // as the user comes back instead of waiting for the retry timer
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === "visible" && wsRef.current) {
        connect();
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("pageshow", handleVisible);
    window.addEventListener("online", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("pageshow", handleVisible);
      window.removeEventListener("online", handleVisible);
    };
  }, [connect]);

  return {
    isConnected,
    failedAttempts,
    sendMessage,
    connect,
    disconnect,
  };
}
