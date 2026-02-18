# Workers for Platforms Integration for FlareCog

**Date:** November 23, 2025

**Author:** Manus AI

## 1. Executive Summary

This document outlines the integration of CloudFlare Workers for Platforms into the FlareCog cognitive architecture. Workers for Platforms enables FlareCog to become a true **multi-tenant cognitive SaaS platform**, where each customer can have their own isolated cognitive instance with dedicated AtomSpace and MindAgent resources. This architecture allows FlareCog to scale from a single cognitive system to a platform hosting thousands or millions of independent cognitive agents.

## 2. Workers for Platforms Overview

Workers for Platforms is CloudFlare's solution for building SaaS applications that allow customers to deploy their own serverless functions. The key components are:

### 2.1 Core Components

**Dispatch Namespace**: A collection of user Workers that share a common namespace. Think of it as a container for all customer Workers.

**User Workers**: Individual Workers deployed by end users (customers) into a dispatch namespace. Each user Worker is isolated and can have its own configuration.

**Dynamic Dispatch Worker**: A specialized routing Worker that programmatically routes incoming requests to the appropriate user Worker based on custom logic (hostname, subdomain, headers, authentication, etc.).

### 2.2 Benefits for FlareCog

The integration of Workers for Platforms into FlareCog provides several critical advantages:

**Scalability**: FlareCog can host thousands of independent cognitive instances without manual route configuration. Each customer gets their own AtomSpace and MindAgent system.

**Isolation**: Each customer's cognitive data is completely isolated. There is no risk of cross-tenant data leakage or interference.

**Customization**: Customers can have different cognitive configurations, agent parameters, and reasoning strategies while sharing the same underlying platform infrastructure.

**Platform Features**: The dispatch Worker can provide platform-level functionality such as authentication, rate limiting, request sanitization, usage tracking, and cognitive analytics.

**Cost Efficiency**: Resources are allocated dynamically per customer, with shared infrastructure for common services.

## 3. FlareCog Multi-Tenant Architecture

### 3.1 Current Single-Tenant Architecture

The current FlareCog implementation is a single-tenant system where all cognitive operations share the same AtomSpace and MindAgent instances. The architecture consists of:

- **Main Worker** (`flarecog/src/worker/index.ts`): Routes requests to Durable Objects
- **AtomSpace Durable Object**: Single shared knowledge base
- **MindAgent Durable Object**: Single shared agent system
- **Reasoning Infrastructure**: Shared PLN, URE, and pattern matching

This architecture works well for a single user or organization but does not scale to multiple independent customers.

### 3.2 Proposed Multi-Tenant Architecture

The Workers for Platforms integration transforms FlareCog into a multi-tenant platform with the following architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Internet / Users                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              FlareCog Dispatch Worker                        │
│  (Dynamic Routing + Platform Features)                       │
│                                                              │
│  • Tenant identification (subdomain/hostname/auth)           │
│  • Authentication & authorization                            │
│  • Rate limiting & usage tracking                            │
│  • Request sanitization                                      │
│  • Cognitive analytics aggregation                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Dispatch Namespace: "flarecog"                  │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  User Worker 1   │  │  User Worker 2   │  ...           │
│  │  (Tenant: acme)  │  │  (Tenant: corp)  │                │
│  │                  │  │                  │                │
│  │  • AtomSpace DO  │  │  • AtomSpace DO  │                │
│  │  • MindAgent DO  │  │  • MindAgent DO  │                │
│  │  • Reasoning     │  │  • Reasoning     │                │
│  │  • Custom Config │  │  • Custom Config │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Tenant Identification Strategies

The dispatch Worker needs to identify which tenant a request belongs to. Several strategies are possible:

**Subdomain-based**: `acme.flarecog.ai` → tenant "acme", `corp.flarecog.ai` → tenant "corp"

**Path-based**: `/tenants/acme/...` → tenant "acme", `/tenants/corp/...` → tenant "corp"

**Header-based**: `X-Tenant-ID: acme` → tenant "acme"

**Authentication-based**: JWT token contains tenant ID, extracted after authentication

**Hybrid**: Combination of the above (e.g., subdomain + authentication verification)

For FlareCog, the recommended approach is **subdomain-based with authentication verification**, as it provides clean URLs, easy routing, and security.

## 4. Implementation Design

### 4.1 Directory Structure

The Workers for Platforms integration will organize the FlareCog codebase as follows:

```
cogflare-temp/
├── flarecog/                          # Original single-tenant implementation
│   ├── src/
│   │   ├── worker/index.ts            # Main worker (becomes user Worker template)
│   │   ├── durable-objects/           # AtomSpace, MindAgent
│   │   ├── reasoning/                 # PLN, URE, PatternMatcher
│   │   └── core/                      # Distributed, RelevanceRealization
│   └── wrangler.toml
│
├── flarecog-platform/                 # NEW: Multi-tenant platform
│   ├── dispatch-worker/               # Dynamic dispatch Worker
│   │   ├── src/
│   │   │   ├── index.ts               # Dispatch routing logic
│   │   │   ├── tenant-resolver.ts     # Tenant identification
│   │   │   ├── auth.ts                # Authentication & authorization
│   │   │   ├── rate-limiter.ts        # Rate limiting
│   │   │   └── analytics.ts           # Usage tracking
│   │   └── wrangler.toml              # Dispatch Worker config
│   │
│   ├── user-worker-template/          # Template for tenant Workers
│   │   ├── src/
│   │   │   └── index.ts               # Tenant-specific Worker
│   │   └── wrangler.template.toml     # Template config
│   │
│   └── platform-api/                  # Platform management API
│       ├── src/
│       │   ├── index.ts               # Tenant provisioning API
│       │   ├── tenant-manager.ts      # Tenant CRUD operations
│       │   └── deployment.ts          # User Worker deployment
│       └── wrangler.toml
│
└── docs/
    └── workers-for-platforms/         # Documentation
        ├── architecture.md
        ├── deployment-guide.md
        └── tenant-management.md
```

### 4.2 Dispatch Worker Design

The dispatch Worker is the entry point for all requests and handles routing to tenant-specific user Workers.

**Key Responsibilities**:

1. **Tenant Resolution**: Determine which tenant the request belongs to
2. **Authentication**: Verify the request is authorized for the tenant
3. **Rate Limiting**: Enforce tenant-specific rate limits
4. **Request Routing**: Forward the request to the appropriate user Worker
5. **Analytics**: Track usage metrics for billing and monitoring
6. **Error Handling**: Provide consistent error responses

**Routing Logic**:

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. Extract tenant ID from subdomain
    const url = new URL(request.url);
    const tenantId = extractTenantFromHostname(url.hostname);
    
    if (!tenantId) {
      return new Response("Tenant not found", { status: 404 });
    }
    
    // 2. Authenticate request
    const authResult = await authenticateRequest(request, tenantId, env);
    if (!authResult.success) {
      return new Response("Unauthorized", { status: 401 });
    }
    
    // 3. Check rate limits
    const rateLimitOk = await checkRateLimit(tenantId, env);
    if (!rateLimitOk) {
      return new Response("Rate limit exceeded", { status: 429 });
    }
    
    // 4. Get user Worker for tenant
    const userWorker = env.FLARECOG_NAMESPACE.get(tenantId);
    
    // 5. Add tenant context to request
    const modifiedRequest = new Request(request.url, {
      ...request,
      headers: new Headers(request.headers),
    });
    modifiedRequest.headers.set("X-Tenant-ID", tenantId);
    modifiedRequest.headers.set("X-User-ID", authResult.userId);
    
    // 6. Forward to user Worker
    const response = await userWorker.fetch(modifiedRequest);
    
    // 7. Track analytics
    await trackRequest(tenantId, request, response, env);
    
    return response;
  }
};
```

### 4.3 User Worker Template Design

Each tenant gets their own user Worker instance, which is a modified version of the current FlareCog Worker. The user Worker template includes:

**Tenant-Specific Configuration**:
- Isolated AtomSpace Durable Object (named by tenant ID)
- Isolated MindAgent Durable Object (named by tenant ID)
- Tenant-specific reasoning parameters
- Custom cognitive agent configurations

**Shared Infrastructure**:
- Common reasoning modules (PLN, URE, PatternMatcher)
- Common core modules (Distributed, RelevanceRealization)
- CloudFlare AI binding (shared across tenants)

**User Worker Structure**:

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Extract tenant ID from header (set by dispatch Worker)
    const tenantId = request.headers.get("X-Tenant-ID");
    
    // Get tenant-specific Durable Objects
    const atomSpaceId = env.ATOMSPACE.idFromName(`${tenantId}:primary`);
    const atomSpace = env.ATOMSPACE.get(atomSpaceId);
    
    const mindAgentId = env.MIND_AGENT.idFromName(`${tenantId}:primary`);
    const mindAgent = env.MIND_AGENT.get(mindAgentId);
    
    // Route to appropriate handler
    const url = new URL(request.url);
    
    if (url.pathname.startsWith("/atomspace")) {
      return atomSpace.fetch(request);
    } else if (url.pathname.startsWith("/mindagent")) {
      return mindAgent.fetch(request);
    } else if (url.pathname.startsWith("/reasoning")) {
      return handleReasoning(request, atomSpace, env);
    } else if (url.pathname.startsWith("/cognitive")) {
      return handleCognitive(request, atomSpace, mindAgent, env);
    }
    
    return new Response("Not found", { status: 404 });
  }
};
```

### 4.4 Platform Management API

A separate Worker provides APIs for platform administrators to manage tenants:

**Tenant Provisioning**:
- `POST /api/tenants` - Create a new tenant
- `GET /api/tenants/:id` - Get tenant details
- `PUT /api/tenants/:id` - Update tenant configuration
- `DELETE /api/tenants/:id` - Delete tenant and cleanup resources

**User Worker Deployment**:
- `POST /api/tenants/:id/deploy` - Deploy user Worker for tenant
- `GET /api/tenants/:id/status` - Get deployment status
- `POST /api/tenants/:id/config` - Update tenant configuration

**Analytics & Monitoring**:
- `GET /api/tenants/:id/usage` - Get usage statistics
- `GET /api/tenants/:id/health` - Get cognitive system health
- `GET /api/analytics/aggregate` - Platform-wide analytics

## 5. Configuration

### 5.1 Dispatch Namespace Creation

Create the dispatch namespace for FlareCog:

```bash
npx wrangler dispatch-namespace create flarecog
```

### 5.2 Dispatch Worker Configuration

`flarecog-platform/dispatch-worker/wrangler.toml`:

```toml
name = "flarecog-dispatch"
main = "src/index.ts"
compatibility_date = "2024-11-23"

[[dispatch_namespaces]]
binding = "FLARECOG_NAMESPACE"
namespace = "flarecog"

[[kv_namespaces]]
binding = "TENANT_CONFIG"
id = "<KV_NAMESPACE_ID>"

[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "<KV_NAMESPACE_ID>"

[[d1_databases]]
binding = "ANALYTICS_DB"
database_name = "flarecog_analytics"
database_id = "<D1_DATABASE_ID>"

[vars]
PLATFORM_NAME = "FlareCog"
DEFAULT_RATE_LIMIT = "1000"  # requests per minute
```

### 5.3 User Worker Template Configuration

`flarecog-platform/user-worker-template/wrangler.template.toml`:

```toml
name = "flarecog-user-{TENANT_ID}"
main = "src/index.ts"
compatibility_date = "2024-11-23"

[durable_objects]
bindings = [
  { name = "ATOMSPACE", class_name = "AtomSpace" },
  { name = "MIND_AGENT", class_name = "MindAgent" }
]

[[migrations]]
tag = "v1"
new_classes = ["AtomSpace", "MindAgent"]

[[d1_databases]]
binding = "COGNITIVE_DB"
database_name = "flarecog_{TENANT_ID}"
database_id = "<D1_DATABASE_ID>"

[[kv_namespaces]]
binding = "ATOM_CACHE"
id = "<KV_NAMESPACE_ID>"

[ai]
binding = "AI"

[vars]
TENANT_ID = "{TENANT_ID}"
TENANT_NAME = "{TENANT_NAME}"
```

## 6. Deployment Workflow

### 6.1 Initial Platform Setup

1. **Create dispatch namespace**:
   ```bash
   npx wrangler dispatch-namespace create flarecog
   ```

2. **Deploy dispatch Worker**:
   ```bash
   cd flarecog-platform/dispatch-worker
   npx wrangler deploy
   ```

3. **Deploy platform management API**:
   ```bash
   cd flarecog-platform/platform-api
   npx wrangler deploy
   ```

### 6.2 Tenant Provisioning Workflow

When a new customer signs up:

1. **Create tenant record**: Store tenant metadata in D1 or KV
2. **Generate user Worker**: Use template to create tenant-specific Worker
3. **Deploy to dispatch namespace**:
   ```bash
   cd flarecog-platform/user-worker-template
   npx wrangler deploy --dispatch-namespace flarecog --name flarecog-user-{TENANT_ID}
   ```
4. **Configure DNS**: Point `{tenant}.flarecog.ai` to dispatch Worker
5. **Initialize cognitive system**: Create initial AtomSpace and MindAgent instances

### 6.3 Automated Provisioning

The platform API can automate this workflow:

```typescript
async function provisionTenant(tenantId: string, config: TenantConfig, env: Env) {
  // 1. Store tenant metadata
  await env.TENANT_CONFIG.put(tenantId, JSON.stringify(config));
  
  // 2. Deploy user Worker via Wrangler API
  const workerScript = generateUserWorkerScript(tenantId, config);
  await deployToDispatchNamespace(tenantId, workerScript, env);
  
  // 3. Initialize cognitive system
  const atomSpaceId = env.ATOMSPACE.idFromName(`${tenantId}:primary`);
  const atomSpace = env.ATOMSPACE.get(atomSpaceId);
  await atomSpace.fetch(new Request("http://dummy/initialize"));
  
  return { success: true, tenantId };
}
```

## 7. Advanced Features

### 7.1 Tenant-Specific Cognitive Configurations

Each tenant can have custom cognitive parameters:

```typescript
interface TenantCognitiveConfig {
  tenantId: string;
  reasoning: {
    plnEnabled: boolean;
    ureEnabled: boolean;
    maxInferenceDepth: number;
    confidenceThreshold: number;
  };
  agents: {
    forgetAgentFrequency: number;
    importanceSpreadingEnabled: boolean;
    hebbianLearningRate: number;
  };
  relevanceRealization: {
    salienceWeight: number;
    coherenceWeight: number;
    affordanceWeight: number;
    noveltyWeight: number;
    goalAlignmentWeight: number;
  };
}
```

### 7.2 Cross-Tenant Cognitive Collaboration

For advanced use cases, tenants can opt-in to share knowledge:

- **Federated Learning**: Aggregate insights across tenants while preserving privacy
- **Shared Ontologies**: Common concept hierarchies across tenants
- **Collaborative Reasoning**: Multi-tenant inference for complex problems

### 7.3 Cognitive Analytics Dashboard

Platform-level analytics provide insights into cognitive performance:

- **Inference Metrics**: Deductions, inductions, abductions per tenant
- **AtomSpace Growth**: Knowledge base size over time
- **Agent Performance**: Goal achievement rates, learning curves
- **Relevance Realization**: Optimal grip achievement frequency
- **Resource Usage**: Compute, storage, AI API calls

## 8. Security Considerations

### 8.1 Tenant Isolation

**Durable Object Naming**: Use tenant ID in Durable Object names to ensure complete isolation.

**Data Encryption**: Encrypt sensitive cognitive data at rest and in transit.

**Access Control**: Implement strict authentication and authorization at the dispatch Worker level.

### 8.2 Rate Limiting

Prevent abuse and ensure fair resource allocation:

- **Per-Tenant Limits**: Configure limits based on subscription tier
- **Endpoint-Specific Limits**: Different limits for read vs. write operations
- **Burst Protection**: Allow short bursts but enforce average rate

### 8.3 Input Validation

Sanitize all inputs at the dispatch Worker level:

- **Query Validation**: Prevent injection attacks in pattern matching
- **Atom Validation**: Ensure atoms conform to schema
- **Request Size Limits**: Prevent memory exhaustion

## 9. Cost Optimization

### 9.1 Shared Resources

Maximize resource sharing while maintaining isolation:

- **Shared Code**: All tenants use the same reasoning modules
- **Shared AI Binding**: CloudFlare AI calls are pooled
- **Shared Infrastructure**: Common dispatch Worker and platform API

### 9.2 Tiered Pricing

Different subscription tiers with different resource allocations:

- **Free Tier**: Limited AtomSpace size, basic agents, low rate limits
- **Pro Tier**: Larger AtomSpace, all agents, higher rate limits
- **Enterprise Tier**: Unlimited resources, dedicated support, custom configurations

### 9.3 Usage-Based Billing

Track and bill based on actual usage:

- **Cognitive Operations**: Charge per inference, query, or agent execution
- **Storage**: Charge per atom stored
- **AI Calls**: Pass through CloudFlare AI costs with markup

## 10. Migration Path

### 10.1 From Single-Tenant to Multi-Tenant

Existing single-tenant FlareCog deployments can migrate:

1. **Deploy platform infrastructure**: Set up dispatch namespace and dispatch Worker
2. **Create tenant for existing deployment**: Provision a tenant with existing data
3. **Migrate data**: Export AtomSpace and import into tenant-specific instance
4. **Update DNS**: Point to dispatch Worker instead of single-tenant Worker
5. **Decommission old Worker**: Remove single-tenant deployment

### 10.2 Backward Compatibility

Maintain backward compatibility during migration:

- **Legacy Endpoints**: Dispatch Worker can route legacy URLs to default tenant
- **Gradual Migration**: Support both single-tenant and multi-tenant modes
- **Data Export**: Provide tools to export cognitive data for migration

## 11. Conclusion

The integration of Workers for Platforms into FlareCog transforms it from a single cognitive system into a scalable, multi-tenant cognitive SaaS platform. This architecture enables:

✅ **Scalability**: Host thousands of independent cognitive agents  
✅ **Isolation**: Complete tenant data separation  
✅ **Customization**: Tenant-specific cognitive configurations  
✅ **Platform Features**: Authentication, rate limiting, analytics  
✅ **Cost Efficiency**: Shared infrastructure with isolated resources  

The proposed architecture leverages CloudFlare's Workers for Platforms to provide a robust foundation for building a commercial cognitive computing platform. The next steps are to implement the dispatch Worker, user Worker template, and platform management API as outlined in this document.
