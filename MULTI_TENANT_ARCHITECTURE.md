# FlareCog Multi-Tenant Architecture Design

## Overview

This document outlines the complete multi-tenant architecture for FlareCog using CloudFlare Workers for Platforms, enabling FlareCog-as-a-Service with strong tenant isolation, comprehensive resource management, and production-grade features.

## Architecture Components

### 1. Dispatch Layer (Workers for Platforms)

**Purpose:** Route requests to tenant-specific AtomSpace instances with strong isolation.

```
┌─────────────────────────────────────────────────────────────┐
│                     Dispatch Worker                          │
│  - Tenant identification (API key, subdomain, JWT)          │
│  - Request routing to tenant namespaces                      │
│  - Rate limiting per tenant                                  │
│  - Usage tracking and billing metrics                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │         Dispatch Namespaces              │
        ├──────────────┬──────────────┬───────────┤
        │   Tenant A   │   Tenant B   │  Tenant C │
        │  Namespace   │  Namespace   │ Namespace │
        └──────────────┴──────────────┴───────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │      Tenant-Specific AtomSpaces         │
        │  (Durable Objects with isolation)       │
        └─────────────────────────────────────────┘
```

### 2. Storage Tiers with R2 Integration

**Tier 1 (Hot):** Durable Object memory - High STI atoms
**Tier 2 (Warm):** KV Cache - Medium STI atoms  
**Tier 3 (Cold):** Durable Object SQLite - Low STI atoms
**Tier 4 (Frozen):** **R2 Object Storage** - Very low STI atoms (93% cheaper)

```typescript
interface StorageTier {
  hot: DurableObjectMemory;    // <1ms, expensive
  warm: KVCache;                // 5-20ms, cheap
  cold: SQLiteStorage;          // 10-50ms, moderate
  frozen: R2Bucket;             // 50-200ms, very cheap ($0.015/GB vs $0.20/GB)
}
```

### 3. Hyperdrive Integration

**Purpose:** Optimize database connections for external data sources and cross-tenant queries.

- Connection pooling for D1 global coordination database
- Reduced latency for distributed queries
- Support for external PostgreSQL/MySQL data sources

### 4. Agents, Workflows & Pipelines

**CloudFlare Workflows:** Durable execution for long-running cognitive processes
**CloudFlare Queues:** Message passing between MindAgents
**Pipelines:** Multi-step cognitive processing chains

```
┌──────────────────────────────────────────────────────────┐
│                   Cognitive Workflow                      │
│                                                           │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────┐ │
│  │ Perceive│ -> │ Reason  │ -> │  Learn  │ -> │ Act  │ │
│  │ Agent   │    │ Agent   │    │  Agent  │    │Agent │ │
│  └─────────┘    └─────────┘    └─────────┘    └──────┘ │
│       │              │              │              │     │
│       └──────────────┴──────────────┴──────────────┘     │
│                       Queue                              │
└──────────────────────────────────────────────────────────┘
```

## Multi-Tenant Namespace Structure

### Dispatch Namespaces

```javascript
// wrangler.toml configuration
[[dispatch_namespaces]]
name = "flarecog-tenants"
script = "tenant-worker"

[[dispatch_namespaces.outbound]]
service = "flarecog-core"
```

### Tenant Isolation

Each tenant gets:
1. **Isolated Durable Object namespace** - Separate AtomSpace instances
2. **Dedicated R2 bucket prefix** - `tenants/{tenant_id}/frozen/`
3. **Separate KV namespace** - `TENANT_{tenant_id}_CACHE`
4. **Usage quotas** - Request limits, storage limits, compute limits
5. **Billing metrics** - Tracked per tenant for accurate cost allocation

## SaaS Admin Portal Features

### Dashboard
- Tenant overview and statistics
- Real-time usage metrics
- Cost breakdown per tenant
- Active AtomSpace instances

### Tenant Management
- Create/delete tenants
- Configure quotas and limits
- API key management
- Billing and invoicing

### Monitoring
- Request rate per tenant
- Storage usage per tier
- Cognitive agent activity
- Error rates and alerts

### Analytics
- Atom creation/deletion trends
- Query patterns and performance
- Attention value distributions
- MindAgent execution statistics

## Resource Allocation Strategy

### Per-Tenant Quotas

```typescript
interface TenantQuota {
  maxAtomSpaces: number;           // e.g., 10 for basic, 100 for pro
  maxAtomsPerAtomSpace: number;    // e.g., 10M for basic, 30M for pro
  maxRequestsPerDay: number;       // e.g., 100K for basic, 10M for pro
  maxStorageGB: number;            // e.g., 10GB for basic, 1TB for pro
  maxConcurrentAgents: number;     // e.g., 5 for basic, 50 for pro
  enabledFeatures: string[];       // e.g., ["PLN", "AI_REASONING"]
}
```

### Pricing Tiers

**Basic Tier:** $29/month
- 5 AtomSpaces
- 50M atoms total
- 100K requests/day
- 10 GB storage
- 5 concurrent agents

**Pro Tier:** $99/month
- 20 AtomSpaces
- 300M atoms total
- 1M requests/day
- 100 GB storage
- 20 concurrent agents
- AI-enhanced reasoning

**Enterprise Tier:** Custom pricing
- Unlimited AtomSpaces
- Unlimited atoms
- Unlimited requests
- Unlimited storage
- Unlimited agents
- Dedicated support

## R2 Cold Storage Implementation

### Archival Strategy

Atoms with STI < 5 are automatically archived to R2 after 30 days of inactivity.

```typescript
interface R2AtomArchive {
  bucket: R2Bucket;
  prefix: string;  // "tenants/{tenant_id}/frozen/{atomspace_id}/"
  
  async archiveAtom(atom: Atom): Promise<void>;
  async retrieveAtom(id: string): Promise<Atom | null>;
  async listArchived(atomspaceId: string): Promise<string[]>;
  async deleteArchived(id: string): Promise<void>;
}
```

### Cost Savings

- R2 storage: **$0.015/GB-month** (vs $0.20/GB for SQLite)
- **93% cost reduction** for frozen atoms
- Automatic lifecycle management
- Transparent retrieval when accessed

## Hyperdrive Configuration

### D1 Global Coordination

```typescript
interface HyperdriveConfig {
  database: "flarecog-global-coordination";
  connectionString: string;
  maxConnections: 100;
  idleTimeout: 60000;
}
```

### Use Cases

1. **Global atom index** - Fast lookup across all tenant AtomSpaces
2. **Cross-tenant queries** - Federated search (with permission)
3. **Analytics database** - Aggregate statistics and reporting
4. **Billing database** - Usage tracking and invoicing

## Agents, Workflows & Pipelines

### CloudFlare Workflows Integration

```typescript
import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";

export class CognitiveWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent, step: WorkflowStep) {
    // Step 1: Perception
    const percepts = await step.do("perceive", async () => {
      return await this.env.PERCEPTION_AGENT.process(event.input);
    });
    
    // Step 2: Reasoning
    const inferences = await step.do("reason", async () => {
      return await this.env.REASONING_AGENT.infer(percepts);
    });
    
    // Step 3: Learning
    const patterns = await step.do("learn", async () => {
      return await this.env.LEARNING_AGENT.learn(inferences);
    });
    
    // Step 4: Action
    const actions = await step.do("act", async () => {
      return await this.env.PLANNING_AGENT.plan(patterns);
    });
    
    return actions;
  }
}
```

### Queue-Based Agent Communication

```typescript
interface AgentMessage {
  from: string;           // Source agent ID
  to: string;             // Target agent ID
  type: string;           // Message type
  payload: any;           // Message data
  priority: number;       // Queue priority
  tenantId: string;       // Tenant isolation
}

// Producer
await env.AGENT_QUEUE.send({
  from: "ReasoningAgent",
  to: "LearningAgent",
  type: "NEW_INFERENCE",
  payload: { atoms: [...], confidence: 0.85 },
  priority: 1,
  tenantId: ctx.tenantId
});

// Consumer
export default {
  async queue(batch: MessageBatch, env: Env) {
    for (const message of batch.messages) {
      const msg = message.body as AgentMessage;
      await routeToAgent(msg, env);
    }
  }
}
```

### Pipeline Architecture

```typescript
interface CognitivePipeline {
  name: string;
  stages: PipelineStage[];
  
  async execute(input: any): Promise<any>;
}

interface PipelineStage {
  name: string;
  agent: string;
  timeout: number;
  retries: number;
  
  async process(input: any): Promise<any>;
}

// Example: Knowledge Extraction Pipeline
const extractionPipeline: CognitivePipeline = {
  name: "knowledge-extraction",
  stages: [
    {
      name: "parse",
      agent: "PerceptionAgent",
      timeout: 5000,
      retries: 3,
      process: async (text) => await parseText(text)
    },
    {
      name: "extract",
      agent: "ReasoningAgent",
      timeout: 10000,
      retries: 2,
      process: async (parsed) => await extractEntities(parsed)
    },
    {
      name: "link",
      agent: "LearningAgent",
      timeout: 15000,
      retries: 1,
      process: async (entities) => await createLinks(entities)
    },
    {
      name: "store",
      agent: "AtomSpace",
      timeout: 5000,
      retries: 3,
      process: async (atoms) => await storeAtoms(atoms)
    }
  ]
};
```

## Deployment Architecture

### Production Setup

```
┌──────────────────────────────────────────────────────────────┐
│                    CloudFlare Global Network                  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Dispatch Worker (Entry Point)             │  │
│  │  - Authentication & Authorization                      │  │
│  │  - Tenant routing                                      │  │
│  │  - Rate limiting                                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         ▼                  ▼                  ▼              │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐           │
│  │ Tenant A │      │ Tenant B │      │ Tenant C │           │
│  │ Namespace│      │ Namespace│      │ Namespace│           │
│  └──────────┘      └──────────┘      └──────────┘           │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  Resource Layer                        │  │
│  │                                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐  │  │
│  │  │ Durable  │  │    KV    │  │    D1    │  │  R2  │  │  │
│  │  │ Objects  │  │  Cache   │  │  Global  │  │ Cold │  │  │
│  │  │(AtomSpace│  │          │  │   Index  │  │Storage│ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────┘  │  │
│  │                                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │
│  │  │ Workflows│  │  Queues  │  │Hyperdrive│            │  │
│  │  │          │  │          │  │          │            │  │
│  │  └──────────┘  └──────────┘  └──────────┘            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              SaaS Admin Portal (Pages)                 │  │
│  │  - Tenant management                                   │  │
│  │  - Usage analytics                                     │  │
│  │  - Billing dashboard                                   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Checklist

### Phase 1: Multi-Tenant Foundation
- [ ] Create dispatch worker with tenant routing
- [ ] Implement tenant authentication (API keys)
- [ ] Set up dispatch namespaces for 3 test tenants
- [ ] Configure tenant-specific Durable Object bindings

### Phase 2: Storage Optimization
- [ ] Implement R2 cold storage integration
- [ ] Create automatic archival for low-STI atoms
- [ ] Build transparent retrieval mechanism
- [ ] Add lifecycle management policies

### Phase 3: Database & Connectivity
- [ ] Set up D1 global coordination database
- [ ] Configure Hyperdrive for connection pooling
- [ ] Implement cross-tenant query capabilities
- [ ] Build global atom index

### Phase 4: Cognitive Orchestration
- [ ] Implement CloudFlare Workflows for cognitive processes
- [ ] Set up Queues for agent communication
- [ ] Build pipeline framework for multi-step processing
- [ ] Create example workflows (perception → reasoning → learning)

### Phase 5: SaaS Admin Portal
- [ ] Build tenant management interface
- [ ] Create usage analytics dashboard
- [ ] Implement billing and quota management
- [ ] Add monitoring and alerting

### Phase 6: Testing & Documentation
- [ ] Test multi-tenant isolation
- [ ] Verify R2 archival and retrieval
- [ ] Test workflow execution
- [ ] Document deployment procedures

## Security Considerations

### Tenant Isolation
- Separate Durable Object namespaces per tenant
- API key-based authentication
- Rate limiting per tenant
- Resource quotas enforcement

### Data Privacy
- Encrypted storage (CloudFlare default)
- Tenant data never mixed
- Audit logging for all operations
- GDPR compliance support

### Access Control
- Role-based access control (RBAC)
- API key scoping (read/write/admin)
- IP whitelisting (enterprise tier)
- Multi-factor authentication (admin portal)

## Monitoring & Observability

### Metrics
- Request rate per tenant
- Storage usage per tier
- Agent execution time
- Error rates and types
- Cost per tenant

### Logging
- Structured logging with tenant context
- CloudFlare Analytics integration
- Custom dashboards in admin portal
- Alert rules for anomalies

### Tracing
- Distributed tracing across agents
- Request flow visualization
- Performance bottleneck identification
- Cognitive process debugging

## Cost Optimization

### Strategies
1. **Aggressive hibernation** - Minimize active duration
2. **R2 archival** - Move cold data to cheap storage
3. **KV caching** - Reduce Durable Object requests
4. **Query optimization** - Minimize atoms examined
5. **Batch operations** - Reduce request count

### Expected Savings
- R2 archival: **60-80% storage cost reduction**
- KV caching: **30-50% request cost reduction**
- Hibernation: **50-70% duration cost reduction**
- Overall: **40-60% total cost reduction**

## Next Steps

1. Implement dispatch worker and tenant routing
2. Create R2 cold storage integration
3. Set up Hyperdrive and D1 global database
4. Build Workflows and Queues for agents
5. Develop SaaS admin portal
6. Deploy and test with 3 sample tenants
7. Document and deliver complete solution
