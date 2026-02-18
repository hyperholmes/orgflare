# FlareCog Quick Start Deployment Guide

**Version:** 1.0  
**Date:** November 23, 2025  
**Author:** Manus AI

## 1. Introduction

This guide provides a quick start for deploying the FlareCog cognitive computing platform using the automated deployment script. This script leverages your CloudFlare API and MCP connectivity to deploy the entire platform in a single command.

## 2. Prerequisites

Before you begin, ensure you have the following:

-   **CloudFlare Account**: A CloudFlare account with an active subscription.
-   **CloudFlare API Token**: An API token with permissions to manage Workers, D1, KV, and Pages.
-   **CloudFlare Account ID**: Your CloudFlare account ID.
-   **Node.js and npm**: Node.js version 18+ and npm.
-   **Git**: Git for cloning the repository.
-   **MCP CLI**: The `manus-mcp-cli` installed and configured.

## 3. Configuration

### 3.1 Clone the Repository

```bash
git clone https://github.com/cogpy/cogflare-temp.git
cd cogflare-temp
```

### 3.2 Set Environment Variables

Create a `.env` file in the root of the repository with your CloudFlare credentials:

```env
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
```

### 3.3 Install Dependencies

Install the required dependencies for the deployment script:

```bash
cd scripts
npm install
```

## 4. Automated Deployment

Run the automated deployment script to deploy the entire FlareCog platform:

```bash
cd scripts
npx tsx deploy-flarecog-platform.ts
```

This script will perform the following steps:

1.  **Create Dispatch Namespace**: Creates the `flarecog` dispatch namespace.
2.  **Create D1 Database**: Creates the `flarecog_platform` D1 database.
3.  **Create KV Namespace**: Creates the `flarecog_platform_cache` KV namespace.
4.  **Deploy Dispatch Worker**: Deploys the `flarecog-dispatch` Worker.
5.  **Deploy Platform API**: Deploys the `flarecog-platform-api` Worker.
6.  **Run Database Migrations**: Sets up the database schema.
7.  **Deploy Admin Dashboard**: Deploys the admin dashboard to CloudFlare Pages.
8.  **Deploy Playground**: Deploys the playground to CloudFlare Pages.
9.  **Create Demo Tenant**: Provisions a demo tenant for testing.

## 5. Accessing the Platform

Once the deployment is complete, you can access the platform at the following URLs:

-   **Platform API**: `https://platform.flarecog.ai`
-   **Admin Dashboard**: `https://admin.flarecog.ai`
-   **Playground**: `https://playground.flarecog.ai`
-   **Demo Tenant**: `https://demo.flarecog.ai`

## 6. End-to-End Testing

After deployment, you can run the end-to-end testing workflow to validate the entire platform.

### 6.1 Install Test Dependencies

```bash
cd tests
npm install
```

### 6.2 Run Tests

```bash
cd tests
npx tsx e2e-test-workflow.ts
```

This will run a comprehensive suite of 12 tests covering:

-   Platform deployment
-   Tenant provisioning
-   Cognitive operations
-   MCP integration
-   WebSocket streaming
-   Admin dashboard and playground access
-   Python API client
-   Metrics and analytics
-   Tenant cleanup

## 7. MCP Integration

To integrate with your MCP servers, you can use the Workers AI Playground or the Python API.

### 7.1 Using the Playground

1.  Open the playground at `https://playground.flarecog.ai`.
2.  In the "MCP Server Connection" panel, enter your MCP server URL (e.g., `https://notion-mcp.example.com`).
3.  Provide an API key if required.
4.  Click "Connect" to discover and use the available tools.

### 7.2 Using the Python API

```python
from flarecog_api import FlareCogAPI

client = FlareCogAPI()

# Connect to MCP server
client.connect_mcp_server(
    tenant_id="demo",
    server_url="https://sentry-mcp.example.com"
)

# Execute a tool
result = client.execute_mcp_tool(
    tenant_id="demo",
    server_url="https://sentry-mcp.example.com",
    tool_name="sentry-get-issues",
    args={"limit": 10}
)

print(f"Found {len(result)} issues in Sentry.")
```

## 8. Troubleshooting

### Deployment Failed

-   **Check API Token**: Ensure your `CLOUDFLARE_API_TOKEN` has the required permissions.
-   **Check Account ID**: Verify your `CLOUDFLARE_ACCOUNT_ID` is correct.
-   **Review Logs**: Check the console output for specific error messages.
-   **Clean Slate**: If issues persist, you can delete the created resources in your CloudFlare dashboard and run the deployment script again.

### Tests Failed

-   **Check Deployment**: Ensure the platform was deployed successfully.
-   **Check DNS**: Verify that the DNS records for your domains are correctly configured.
-   **Review Test Logs**: Examine the output of the test script for details on which tests failed and why.

## 9. Conclusion

This quick start guide provides a streamlined path to deploying and testing the FlareCog platform. With your CloudFlare API and MCP connectivity, you can now leverage the full power of FlareCog for your cognitive computing needs.

For more detailed information, please refer to the comprehensive documentation in the `docs` directory.

## References

1.  [FlareCog Repository](https://github.com/cogpy/cogflare-temp)
2.  [CloudFlare API Documentation](https://developers.cloudflare.com/api/)
3.  [Model Context Protocol (MCP)](https://www.modelcontext.com/)
