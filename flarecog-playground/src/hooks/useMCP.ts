import { useState, useCallback } from "react";
import type { MCPConnection, MCPTool } from "../lib/types";

interface UseMCPOptions {
  agentUrl: string;
}

export function useMCP(options: UseMCPOptions) {
  const { agentUrl } = options;
  
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const connect = useCallback(async (serverUrl: string, apiKey?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${agentUrl}/mcp/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serverUrl,
          authentication: apiKey ? {
            type: "bearer",
            token: apiKey,
          } : undefined,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to connect to MCP server");
      }
      
      setConnections((prev) => [...prev, result.connection]);
      
      // Fetch updated tools
      await fetchTools();
      
      return result.connection;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      setError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [agentUrl]);
  
  const disconnect = useCallback(async (serverUrl: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${agentUrl}/mcp/disconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serverUrl }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to disconnect from MCP server");
      }
      
      setConnections((prev) => prev.filter((conn) => conn.serverUrl !== serverUrl));
      
      // Fetch updated tools
      await fetchTools();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Disconnection failed";
      setError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [agentUrl]);
  
  const fetchTools = useCallback(async () => {
    try {
      const response = await fetch(`${agentUrl}/mcp/tools`);
      const result = await response.json();
      
      if (result.success) {
        setTools(result.tools);
      }
    } catch (error) {
      console.error("Failed to fetch tools:", error);
    }
  }, [agentUrl]);
  
  const executeTool = useCallback(async (
    serverUrl: string,
    toolName: string,
    args: any
  ): Promise<any> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${agentUrl}/mcp/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serverUrl,
          toolName,
          args,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Tool execution failed");
      }
      
      return result.result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed";
      setError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [agentUrl]);
  
  return {
    connections,
    tools,
    isLoading,
    error,
    connect,
    disconnect,
    executeTool,
    fetchTools,
  };
}
