// MCP (Model Context Protocol) Client Implementation

export interface MCPAuthentication {
  type: "bearer" | "api-key";
  token: string;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface MCPConnection {
  serverUrl: string;
  authentication?: MCPAuthentication;
  tools: MCPTool[];
  status: "connected" | "disconnected" | "error";
  connectedAt: number;
  lastError?: string;
}

export class MCPClient {
  private connections: Map<string, MCPConnection> = new Map();

  /**
   * Connect to an MCP server and discover available tools
   */
  async connect(
    serverUrl: string,
    authentication?: MCPAuthentication
  ): Promise<MCPConnection> {
    try {
      // Discover tools from MCP server
      const response = await fetch(`${serverUrl}/tools`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(authentication
            ? { Authorization: `Bearer ${authentication.token}` }
            : {}),
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to connect to MCP server: ${response.statusText}`
        );
      }

      const data = await response.json();
      const tools: MCPTool[] = data.tools || [];

      const connection: MCPConnection = {
        serverUrl,
        authentication,
        tools,
        status: "connected",
        connectedAt: Date.now(),
      };

      this.connections.set(serverUrl, connection);

      return connection;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";

      const connection: MCPConnection = {
        serverUrl,
        authentication,
        tools: [],
        status: "error",
        connectedAt: Date.now(),
        lastError: errorMessage,
      };

      this.connections.set(serverUrl, connection);

      throw error;
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverUrl: string): Promise<void> {
    const connection = this.connections.get(serverUrl);
    if (connection) {
      connection.status = "disconnected";
      this.connections.delete(serverUrl);
    }
  }

  /**
   * Execute a tool on an MCP server
   */
  async executeTool(
    serverUrl: string,
    toolName: string,
    args: any
  ): Promise<any> {
    const connection = this.connections.get(serverUrl);
    if (!connection) {
      throw new Error(`Not connected to MCP server: ${serverUrl}`);
    }

    if (connection.status !== "connected") {
      throw new Error(
        `MCP server connection is not active: ${connection.status}`
      );
    }

    // Verify tool exists
    const tool = connection.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(
        `Tool '${toolName}' not found on server ${serverUrl}. Available tools: ${connection.tools.map((t) => t.name).join(", ")}`
      );
    }

    try {
      const response = await fetch(`${serverUrl}/execute/${toolName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(connection.authentication
            ? { Authorization: `Bearer ${connection.authentication.token}` }
            : {}),
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        throw new Error(`Tool execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Execution failed";
      connection.lastError = errorMessage;
      throw error;
    }
  }

  /**
   * Get all active connections
   */
  getConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get a specific connection
   */
  getConnection(serverUrl: string): MCPConnection | undefined {
    return this.connections.get(serverUrl);
  }

  /**
   * Get all available tools across all connections
   */
  getAllTools(): (MCPTool & { serverUrl: string })[] {
    const allTools: (MCPTool & { serverUrl: string })[] = [];

    for (const connection of this.connections.values()) {
      if (connection.status === "connected") {
        for (const tool of connection.tools) {
          allTools.push({
            ...tool,
            serverUrl: connection.serverUrl,
          });
        }
      }
    }

    return allTools;
  }

  /**
   * Refresh tools from an MCP server
   */
  async refreshTools(serverUrl: string): Promise<void> {
    const connection = this.connections.get(serverUrl);
    if (!connection) {
      throw new Error(`Not connected to MCP server: ${serverUrl}`);
    }

    try {
      const response = await fetch(`${serverUrl}/tools`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(connection.authentication
            ? { Authorization: `Bearer ${connection.authentication.token}` }
            : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh tools: ${response.statusText}`);
      }

      const data = await response.json();
      connection.tools = data.tools || [];
      connection.status = "connected";
      delete connection.lastError;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Refresh failed";
      connection.status = "error";
      connection.lastError = errorMessage;
      throw error;
    }
  }

  /**
   * Check connection health
   */
  async checkHealth(serverUrl: string): Promise<boolean> {
    const connection = this.connections.get(serverUrl);
    if (!connection) {
      return false;
    }

    try {
      const response = await fetch(`${serverUrl}/health`, {
        method: "GET",
        headers: {
          ...(connection.authentication
            ? { Authorization: `Bearer ${connection.authentication.token}` }
            : {}),
        },
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
