# FlareCog Comprehensive Integration Guide

**Version:** 2.0  
**Date:** November 23, 2025  
**Author:** Manus AI

## 1. Introduction

This guide provides a comprehensive overview of the new features integrated into the FlareCog cognitive computing platform, including the Workers AI Playground, MCP server connectivity, CloudFlare Agents framework, WebSocket Hibernation, and the Python API client. These integrations transform FlareCog into a production-ready, enterprise-grade platform for cognitive computing on the CloudFlare edge network.

## 2. Workers AI Playground

The Workers AI Playground is an interactive React-based UI for testing and visualizing FlareCog's cognitive operations. It provides a user-friendly interface for:

- **Cognitive Operations**: Perception, reasoning, planning, learning, and querying
- **MCP Integration**: Connecting to external AI tool servers
- **Real-Time Communication**: Live feedback via WebSockets
- **Result Visualization**: Viewing operation results with timing and success metrics

### 2.1 Accessing the Playground

The playground is deployed as a CloudFlare Pages application. You can access it at:

[https://flarecog-playground.pages.dev](https://flarecog-playground.pages.dev)

### 2.2 Connecting to a Cognitive Agent

1.  Enter your FlareCog tenant URL (e.g., `https://your-tenant.flarecog.ai`).
2.  The playground automatically establishes a WebSocket connection.
3.  Once connected, you can perform cognitive operations and manage MCP connections.

### 2.3 Key Components

| Component | Description |
| :--- | :--- |
| **Connection Manager** | Manages MCP server connections, including authentication and tool discovery. |
| **Cognitive Operations** | Provides an interface for executing cognitive operations with real-time results. |
| **State Viewer** | Displays the current state of the cognitive agent, including AtomSpace and goals. |
| **Tool Browser** | Lists available tools from connected MCP servers. |

## 3. MCP Server Integration

FlareCog now supports connecting to Model Context Protocol (MCP) servers, enabling integration with external AI tools and services.

### 3.1 Connecting to an MCP Server

You can connect to an MCP server through the Workers AI Playground or programmatically via the API.

**Using the Playground:**

1.  In the "MCP Server Connection" panel, enter the server URL.
2.  Provide an API key if required for authentication.
3.  Click "Connect" to establish the connection and discover available tools.

**Using the Python API:**

```python
from flarecog_api import FlareCogAPI

client = FlareCogAPI()

connection = client.connect_mcp_server(
    tenant_id="your-tenant",
    server_url="https://mcp-server.example.com",
    api_key="optional-api-key"
)

print(f"Connected to {connection['serverUrl']} with {len(connection['tools'])} tools.")
```

### 3.2 Executing MCP Tools

Once connected, you can execute tools from the MCP server.

**Using the Playground:**

1.  Available tools are listed in the "Tool Browser".
2.  Select a tool, provide the required arguments, and click "Execute".
3.  The result will be displayed in the results panel.

**Using the Python API:**

```python
result = client.execute_mcp_tool(
    tenant_id="your-tenant",
    server_url="https://mcp-server.example.com",
    tool_name="example_tool",
    args={"param1": "value1"}
)

print(f"Tool result: {result}")
```

## 4. CloudFlare Agents Framework

FlareCog has been migrated from Durable Objects to the CloudFlare Agents framework, providing automatic state persistence, embedded SQLite databases, and improved memory management.

### 4.1 Agent-Based Architecture

-   **AtomSpace Agent**: Manages the knowledge base with automatic state persistence and SQL query capabilities.
-   **MindAgent Agent**: Manages cognitive goals and agents with a persistent state and execution history.

### 4.2 Benefits of Agents Framework

| Feature | Benefit |
| :--- | :--- |
| **Automatic State Persistence** | No more manual `storage.get()` or `storage.put()`. State is automatically managed. |
| **Embedded SQLite** | Perform complex queries directly on agent state using SQL. |
| **Hibernation Support** | Agents can be evicted from memory during inactivity, reducing costs. |
| **Simplified Code** | Cleaner, more readable code with less boilerplate. |
| **Improved Performance** | Faster state access and better memory management. |

## 5. WebSocket Hibernation

FlareCog now uses the WebSocket Hibernation API for real-time communication, providing live cognitive streaming with reduced memory usage.

### 5.1 Real-Time Cognitive Streaming

-   **Live Feedback**: Get real-time updates on cognitive operations.
-   **Reduced Latency**: Lower latency compared to HTTP polling.
-   **Efficient Resource Usage**: Automatic hibernation reduces memory footprint.

### 5.2 Connecting via WebSocket

The Workers AI Playground automatically uses WebSockets. For custom clients, connect to the WebSocket endpoint of your tenant URL:

```javascript
const ws = new WebSocket("wss://your-tenant.flarecog.ai");

ws.onopen = () => {
  console.log("Connected to FlareCog agent");
  ws.send(JSON.stringify({
    type: "operation",
    data: { operation: "query", input: { type: "ConceptNode" } }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log("Received:", message);
};
```

## 6. Python API Client

A comprehensive Python API client is now available for programmatic access to the FlareCog platform.

### 6.1 Installation

```bash
pip install flarecog-api
```

### 6.2 Quick Start

```python
from flarecog_api import FlareCogAPI

# Initialize client
client = FlareCogAPI(
    api_token="your_cloudflare_api_token",
    account_id="your_cloudflare_account_id"
)

# Create a tenant
tenant = client.create_tenant("my-tenant", "My Tenant", "pro")

# Perform cognitive operations
result = client.perceive(tenant.tenant_id, "AI is transforming technology")

print(f"Perception result: {result}")
```

### 6.3 API Reference

| Method | Description |
| :--- | :--- |
| `create_tenant()` | Create a new FlareCog tenant. |
| `get_tenant()` | Get information about a tenant. |
| `list_tenants()` | List all tenants. |
| `update_tenant()` | Update a tenant's configuration. |
| `delete_tenant()` | Delete a tenant. |
| `perceive()` | Extract concepts from text. |
| `reason()` | Perform logical reasoning. |
| `query_atomspace()` | Query the AtomSpace. |
| `create_goal()` | Create a cognitive goal. |
| `connect_mcp_server()` | Connect to an MCP server. |
| `list_mcp_tools()` | List available MCP tools. |
| `execute_mcp_tool()` | Execute an MCP tool. |
| `get_tenant_metrics()` | Get cognitive metrics for a tenant. |
| `get_platform_stats()` | Get platform-wide statistics. |

For detailed API documentation, please refer to the `flarecog-api` README.

## 7. Conclusion

These comprehensive integrations elevate FlareCog to a new level of functionality, scalability, and usability. The platform is now ready for a wide range of cognitive computing applications, from interactive AI experiments to enterprise-grade cognitive services.

## References

1.  [CloudFlare Workers for Platforms](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/)
2.  [CloudFlare Agents Framework](https://developers.cloudflare.com/workers/runtime-apis/agents/)
3.  [WebSocket Hibernation API](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/web-sockets/)
4.  [Model Context Protocol (MCP)](https://www.modelcontext.com/)
