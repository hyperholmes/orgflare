import { useState, useEffect, useCallback, useRef } from "react";
import type { AgentState, CognitiveOperation, CognitiveResult, WebSocketMessage } from "../lib/types";

interface UseAgentOptions {
  agentUrl: string;
  onMessage?: (message: WebSocketMessage) => void;
  onStateChange?: (state: AgentState) => void;
  autoReconnect?: boolean;
}

export function useAgent(options: UseAgentOptions) {
  const { agentUrl, onMessage, onStateChange, autoReconnect = true } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState<AgentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const connect = useCallback(() => {
    try {
      // Convert HTTP URL to WebSocket URL
      const wsUrl = agentUrl.replace(/^http/, "ws");
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        
        // Request current state
        ws.send(JSON.stringify({
          type: "operation",
          data: { operation: "getState" },
          timestamp: Date.now(),
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === "state") {
            setState(message.data);
            onStateChange?.(message.data);
          }
          
          onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };
      
      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError("WebSocket connection error");
      };
      
      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        wsRef.current = null;
        
        // Auto-reconnect with exponential backoff
        if (autoReconnect && reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setError(error instanceof Error ? error.message : "Connection failed");
    }
  }, [agentUrl, onMessage, onStateChange, autoReconnect]);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);
  
  const send = useCallback(async (operation: CognitiveOperation): Promise<CognitiveResult> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || !isConnected) {
        reject(new Error("Not connected to agent"));
        return;
      }
      
      const message: WebSocketMessage = {
        type: "operation",
        data: operation,
        timestamp: Date.now(),
      };
      
      // Set up one-time listener for response
      const handleResponse = (event: MessageEvent) => {
        try {
          const response: WebSocketMessage = JSON.parse(event.data);
          
          if (response.type === "result") {
            resolve({
              success: true,
              data: response.data,
              timestamp: response.timestamp,
            });
            wsRef.current?.removeEventListener("message", handleResponse);
          } else if (response.type === "error") {
            reject(new Error(response.data.error || "Operation failed"));
            wsRef.current?.removeEventListener("message", handleResponse);
          }
        } catch (error) {
          reject(error);
          wsRef.current?.removeEventListener("message", handleResponse);
        }
      };
      
      wsRef.current.addEventListener("message", handleResponse);
      
      // Send operation
      wsRef.current.send(JSON.stringify(message));
      
      // Timeout after 30 seconds
      setTimeout(() => {
        wsRef.current?.removeEventListener("message", handleResponse);
        reject(new Error("Operation timeout"));
      }, 30000);
    });
  }, [isConnected]);
  
  // Connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  return {
    isConnected,
    state,
    error,
    send,
    connect,
    disconnect,
  };
}
