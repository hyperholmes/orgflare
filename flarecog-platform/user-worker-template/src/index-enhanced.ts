/**
 * Enhanced FlareCog User Worker with MCP and WebSocket Support
 * 
 * This Worker provides:
 * - Full AtomSpace and MindAgent operations
 * - MCP (Model Context Protocol) server connectivity
 * - WebSocket Hibernation for real-time communication
 * - CloudFlare AI integration for cognitive operations
 */

import { MCPClient, type MCPAuthentication } from "./mcp-client";

export interface Env {
  // Durable Objects
  ATOMSPACE: DurableObjectNamespace;
  MIND_AGENT: DurableObjectNamespace;
  
  // CloudFlare AI
  AI: any;
  
  // Storage
  DB: D1Database;
  ATOM_CACHE: KVNamespace;
  
  // Configuration
  TENANT_ID: string;
  TENANT_NAME: string;
  TIER: string;
  RATE_LIMIT_RPM: string;
  RATE_LIMIT_BURST: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle OPTIONS for CORS
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === "/api/health") {
        return new Response(
          JSON.stringify({
            status: "healthy",
            tenant: env.TENANT_ID,
            tier: env.TIER,
            aiEnabled: !!env.AI,
            timestamp: Date.now(),
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // MCP endpoints
      if (path.startsWith("/mcp/")) {
        return await handleMCPRequest(request, env, path, method);
      }

      // WebSocket upgrade
      if (request.headers.get("Upgrade") === "websocket") {
        return await handleWebSocketUpgrade(request, env);
      }

      // AtomSpace operations
      if (path.startsWith("/atomspace/")) {
        return await handleAtomSpaceRequest(request, env, path, method);
      }

      // MindAgent operations
      if (path.startsWith("/mindagent/")) {
        return await handleMindAgentRequest(request, env, path, method);
      }

      // Cognitive operations
      if (path.startsWith("/cognitive/")) {
        return await handleCognitiveRequest(request, env, path, method);
      }

      // 404
      return new Response(
        JSON.stringify({ error: "Not Found", path }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Request error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  },
};

/**
 * Handle MCP-related requests
 */
async function handleMCPRequest(
  request: Request,
  env: Env,
  path: string,
  method: string
): Promise<Response> {
  const mcpClient = new MCPClient();

  // Connect to MCP server
  if (path === "/mcp/connect" && method === "POST") {
    const { serverUrl, authentication } = await request.json<{
      serverUrl: string;
      authentication?: MCPAuthentication;
    }>();

    try {
      const connection = await mcpClient.connect(serverUrl, authentication);

      return new Response(
        JSON.stringify({
          success: true,
          connection,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Connection failed",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Disconnect from MCP server
  if (path === "/mcp/disconnect" && method === "POST") {
    const { serverUrl } = await request.json<{ serverUrl: string }>();

    await mcpClient.disconnect(serverUrl);

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Get all tools
  if (path === "/mcp/tools" && method === "GET") {
    const tools = mcpClient.getAllTools();

    return new Response(
      JSON.stringify({
        success: true,
        tools,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Execute tool
  if (path === "/mcp/execute" && method === "POST") {
    const { serverUrl, toolName, args } = await request.json<{
      serverUrl: string;
      toolName: string;
      args: any;
    }>();

    try {
      const result = await mcpClient.executeTool(serverUrl, toolName, args);

      return new Response(
        JSON.stringify({
          success: true,
          result,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Execution failed",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "MCP endpoint not found" }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Handle WebSocket upgrade for real-time communication
 */
async function handleWebSocketUpgrade(
  request: Request,
  env: Env
): Promise<Response> {
  // Create WebSocket pair
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  // Get or create Durable Object for WebSocket handling
  const id = env.ATOMSPACE.idFromName(env.TENANT_ID);
  const stub = env.ATOMSPACE.get(id);

  // Forward WebSocket to Durable Object
  await stub.fetch(request, { webSocket: server });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

/**
 * Handle AtomSpace operations
 */
async function handleAtomSpaceRequest(
  request: Request,
  env: Env,
  path: string,
  method: string
): Promise<Response> {
  const id = env.ATOMSPACE.idFromName(env.TENANT_ID);
  const stub = env.ATOMSPACE.get(id);

  // Forward request to AtomSpace Durable Object
  const response = await stub.fetch(request);

  return response;
}

/**
 * Handle MindAgent operations
 */
async function handleMindAgentRequest(
  request: Request,
  env: Env,
  path: string,
  method: string
): Promise<Response> {
  const id = env.MIND_AGENT.idFromName(env.TENANT_ID);
  const stub = env.MIND_AGENT.get(id);

  // Forward request to MindAgent Durable Object
  const response = await stub.fetch(request);

  return response;
}

/**
 * Handle cognitive operations (AI-enhanced)
 */
async function handleCognitiveRequest(
  request: Request,
  env: Env,
  path: string,
  method: string
): Promise<Response> {
  // Perceive operation
  if (path === "/cognitive/perceive" && method === "POST") {
    const { text } = await request.json<{ text: string }>();

    if (!env.AI) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "AI binding not available",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        prompt: `Extract key concepts from the following text. Return a JSON array of concepts with their relationships.\n\nText: ${text}`,
      });

      return new Response(
        JSON.stringify({
          success: true,
          concepts: response.response,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "AI processing failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Cognitive endpoint not found" }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }
  );
}
