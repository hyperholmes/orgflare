# Dispatch Namespace Patterns for FlareCog

**Version:** 1.0.0  
**Date:** November 23, 2025  
**Source:** worker-publisher-template repository

## Overview

This document describes the dispatch namespace patterns and best practices for CloudFlare Workers for Platforms, as applied to the FlareCog cognitive computing platform.

## Dispatch Namespace Binding

### Configuration (wrangler.jsonc)

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "flarecog-dispatch",
  "main": "./src/index.ts",
  "compatibility_date": "2025-04-01",
  "upload_source_maps": true,
  "dispatch_namespaces": [
    {
      "binding": "FLARECOG_NAMESPACE",
      "namespace": "flarecog",
      "experimental_remote": true
    }
  ],
  "observability": {
    "enabled": true
  }
}
```

### Key Properties

| Property | Description | Required |
|----------|-------------|----------|
| `binding` | Variable name in Worker code to access namespace | Yes |
| `namespace` | Dispatch namespace name (must exist in account) | Yes |
| `experimental_remote` | **Critical:** Enables production namespace access | Yes |

**Note:** Without `experimental_remote: true`, the binding will only work in local development mode.

## Dynamic Worker Dispatch

### Basic Pattern

```typescript
export default {
  async fetch(request: Request, env: { FLARECOG_NAMESPACE: any }) {
    const url = new URL(request.url);
    const tenantId = url.pathname.split("/")[1];
    
    try {
      // Get worker from dispatch namespace
      const tenantWorker = env.FLARECOG_NAMESPACE.get(tenantId);
      
      // Forward request to tenant worker
      return await tenantWorker.fetch(request);
    } catch (error) {
      if (error.message.startsWith("Worker not found")) {
        return new Response("Tenant not found", { status: 404 });
      }
      return new Response("Internal error", { status: 500 });
    }
  }
};
```

### Advanced Pattern with Context Headers

```typescript
export default {
  async fetch(request: Request, env: Env) {
    const tenantId = resolveTenantId(request);
    
    // Get worker from namespace
    const tenantWorker = env.FLARECOG_NAMESPACE.get(tenantId);
    
    // Add context headers
    const modifiedRequest = new Request(request.url, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
    });
    
    modifiedRequest.headers.set("X-Tenant-ID", tenantId);
    modifiedRequest.headers.set("X-User-ID", userId);
    modifiedRequest.headers.set("X-Request-ID", requestId);
    
    // Forward with context
    return await tenantWorker.fetch(modifiedRequest);
  }
};
```

## Programmatic Worker Deployment

### Using CloudFlare SDK

```typescript
import Cloudflare from "cloudflare";
import { toFile } from "cloudflare/index";

const cf = new Cloudflare({ apiToken: env.CLOUDFLARE_API_TOKEN });

// 1. Ensure namespace exists
try {
  await cf.workersForPlatforms.dispatch.namespaces.get(namespaceName, {
    account_id: env.CLOUDFLARE_ACCOUNT_ID,
  });
} catch {
  await cf.workersForPlatforms.dispatch.namespaces.create({
    account_id: env.CLOUDFLARE_ACCOUNT_ID,
    name: namespaceName,
  });
}

// 2. Deploy worker to namespace
await cf.workersForPlatforms.dispatch.namespaces.scripts.update(
  namespaceName,
  scriptName,
  {
    account_id: env.CLOUDFLARE_ACCOUNT_ID,
    metadata: {
      main_module: `${scriptName}.mjs`,
      bindings: [
        { type: "plain_text", name: "TENANT_ID", text: tenantId },
        { type: "kv_namespace", name: "CACHE", namespace_id: kvId },
        { type: "d1_database", name: "DB", database_id: dbId },
      ],
    },
    files: {
      [`${scriptName}.mjs`]: await toFile(
        Buffer.from(workerCode),
        `${scriptName}.mjs`,
        { type: "application/javascript+module" }
      ),
    },
  }
);
```

### Key Points

1. **Use `toFile()` helper** from CloudFlare SDK for proper file encoding
2. **Module format required:** Workers must be ES modules (`.mjs`)
3. **Content-Type:** Must be `application/javascript+module`
4. **Automatic creation:** Namespace is created if it doesn't exist

## Binding Types

### Supported Binding Types

```typescript
type Binding =
  // Environment Variables
  | { type: "plain_text"; name: string; text: string }
  
  // KV Storage
  | { type: "kv_namespace"; name: string; namespace_id: string }
  
  // R2 Object Storage
  | { type: "r2_bucket"; name: string; bucket_name: string }
  
  // D1 SQL Database
  | { type: "d1_database"; name: string; database_id: string }
  
  // Durable Objects
  | { 
      type: "durable_object_namespace";
      name: string;
      class_name: string;
      script_name: string;
    }
  
  // Service Bindings
  | { 
      type: "service";
      name: string;
      service: string;
      environment?: string;
    }
  
  // CloudFlare AI
  | { type: "ai"; name: string }
  
  // Analytics Engine
  | { type: "analytics_engine"; name: string; dataset: string };
```

### FlareCog Tenant Bindings

```typescript
const bindings = [
  // Tenant Configuration
  { type: "plain_text", name: "TENANT_ID", text: "acme-corp" },
  { type: "plain_text", name: "TENANT_NAME", text: "Acme Corporation" },
  { type: "plain_text", name: "TIER", text: "pro" },
  
  // Rate Limiting
  { type: "plain_text", name: "RATE_LIMIT_RPM", text: "600" },
  { type: "plain_text", name: "RATE_LIMIT_BURST", text: "1000" },
  
  // Storage
  { type: "d1_database", name: "DB", database_id: dbId },
  { type: "kv_namespace", name: "ATOM_CACHE", namespace_id: kvId },
  
  // AI
  { type: "ai", name: "AI" },
  
  // Durable Objects (future)
  {
    type: "durable_object_namespace",
    name: "ATOMSPACE",
    class_name: "AtomSpace",
    script_name: "flarecog-user-worker",
  },
  {
    type: "durable_object_namespace",
    name: "MIND_AGENT",
    class_name: "MindAgent",
    script_name: "flarecog-user-worker",
  },
];
```

## Error Handling

### Worker Not Found

```typescript
try {
  const worker = env.FLARECOG_NAMESPACE.get(tenantId);
  return await worker.fetch(request);
} catch (error) {
  if (error instanceof Error && error.message.startsWith("Worker not found")) {
    return new Response(
      JSON.stringify({
        error: "Tenant Not Found",
        message: `No cognitive instance found for tenant '${tenantId}'`,
        tenantId: tenantId,
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  
  // Other errors
  return new Response(
    JSON.stringify({
      error: "Service Unavailable",
      message: "Tenant cognitive system is temporarily unavailable",
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

### Deployment Errors

```typescript
try {
  await cf.workersForPlatforms.dispatch.namespaces.scripts.update(...);
} catch (error) {
  if (error.status === 400) {
    console.error("Invalid worker code or bindings");
  } else if (error.status === 403) {
    console.error("Insufficient permissions");
  } else if (error.status === 404) {
    console.error("Namespace not found");
  } else {
    console.error("Deployment failed:", error);
  }
  throw error;
}
```

## Observability

### Enable Metrics

```jsonc
{
  "observability": {
    "enabled": true
  }
}
```

### Track Analytics

```typescript
// In dispatch worker
ctx.waitUntil(
  (async () => {
    await analytics.trackRequest(
      tenantId,
      request,
      response,
      startTime,
      userId
    );
  })()
);
```

### Metrics Available

- Request count
- Response time
- Error rate
- Status code distribution
- Tenant-specific metrics

## Read-Only Mode

### Configuration

```jsonc
{
  "vars": {
    "READONLY": "true"
  }
}
```

### Implementation

```typescript
const isReadOnly = env.READONLY === "true" || env.READONLY === true;

if (isReadOnly && request.method === "POST") {
  return new Response(
    JSON.stringify({ error: "Read-only mode enabled" }),
    { status: 403 }
  );
}
```

### Use Cases

- Demo deployments
- Public examples
- Testing without side effects
- Maintenance mode

## Self-Service Deployment UI

### HTML Form Pattern

```typescript
const HTML_UI = `
<!DOCTYPE html>
<html>
<head>
  <title>Tenant Provisioning</title>
</head>
<body>
  <form id="provisionForm">
    <input type="text" id="tenantId" placeholder="tenant-id" required>
    <select id="tier">
      <option value="free">Free</option>
      <option value="pro">Pro</option>
      <option value="enterprise">Enterprise</option>
    </select>
    <button type="submit">Provision Tenant</button>
  </form>
  
  <script>
    document.getElementById('provisionForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const tenantId = document.getElementById('tenantId').value;
      const tier = document.getElementById('tier').value;
      
      const response = await fetch('/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, tier })
      });
      
      const result = await response.json();
      alert(result.success ? 'Provisioned!' : 'Error: ' + result.error);
    });
  </script>
</body>
</html>
`;
```

### API Endpoint

```typescript
if (path === "/provision" && method === "POST") {
  const { tenantId, tier } = await request.json();
  
  const result = await provisionTenant({ tenantId, tier }, env);
  
  return new Response(JSON.stringify(result), {
    status: result.success ? 201 : 400,
    headers: { "Content-Type": "application/json" },
  });
}
```

## Best Practices

### 1. Namespace Naming

- Use lowercase letters, numbers, and hyphens
- Keep it short and descriptive
- Example: `flarecog`, `my-platform`, `saas-app`

### 2. Tenant ID Validation

```typescript
function validateTenantId(tenantId: string): boolean {
  return /^[a-z0-9-]{3,63}$/.test(tenantId);
}
```

### 3. Worker Code Template

- Store template in version control
- Use placeholders for tenant-specific values
- Build and minify before deployment

### 4. Binding Management

- Document all binding types
- Use consistent naming conventions
- Validate binding IDs before deployment

### 5. Error Recovery

- Implement retry logic for transient errors
- Log all deployment attempts
- Provide clear error messages

### 6. Security

- Never expose API tokens in client code
- Validate all tenant IDs
- Implement rate limiting
- Use authentication for provisioning endpoints

### 7. Monitoring

- Track deployment success/failure rates
- Monitor worker performance per tenant
- Set up alerts for errors

## Common Pitfalls

### 1. Missing `experimental_remote: true`

**Problem:** Dispatch namespace binding doesn't work in production

**Solution:** Add `experimental_remote: true` to binding configuration

### 2. Wrong Content-Type

**Problem:** Worker deployment fails with "Invalid script format"

**Solution:** Use `application/javascript+module` content type

### 3. Invalid Binding IDs

**Problem:** Worker fails to start with "Binding not found"

**Solution:** Verify all resource IDs (D1, KV, etc.) exist and are correct

### 4. Namespace Not Found

**Problem:** Deployment fails with "Namespace does not exist"

**Solution:** Create namespace first using SDK or wrangler CLI

### 5. Missing Permissions

**Problem:** API calls fail with 403 Forbidden

**Solution:** Ensure API token has `Workers for Platforms:Edit` permission

## Performance Optimization

### 1. Cold Start Optimization

- Minimize dependencies
- Use tree-shaking
- Lazy-load heavy modules

### 2. Request Routing

- Use efficient tenant resolution
- Cache tenant configurations
- Minimize header manipulation

### 3. Resource Pooling

- Reuse CloudFlare SDK clients
- Cache namespace references
- Batch analytics writes

## Cost Optimization

### 1. Resource Allocation

- Start with free tier for testing
- Upgrade tenants based on usage
- Delete unused tenant resources

### 2. Monitoring

- Track per-tenant costs
- Set usage alerts
- Implement billing events

### 3. Caching

- Use KV for frequently accessed data
- Implement cache-first strategies
- Set appropriate TTLs

## Next Steps

1. **Implement Dispatch Worker:** Use patterns from this guide
2. **Create Deployment Scripts:** Automate tenant provisioning
3. **Add Monitoring:** Track metrics and errors
4. **Test Thoroughly:** Verify all binding types work
5. **Document Custom Patterns:** Add project-specific patterns

## References

- [CloudFlare Workers for Platforms Documentation](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/)
- [CloudFlare SDK Documentation](https://github.com/cloudflare/cloudflare-typescript)
- [worker-publisher-template Repository](https://github.com/EchoCog/worker-publisher-template)
- [FlareCog Deployment Automation Guide](./automation-guide.md)
