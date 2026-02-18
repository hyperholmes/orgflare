# FlareCog Admin Dashboard: Architecture

**Date:** November 23, 2025

**Author:** Manus AI

## Overview

The FlareCog Admin Dashboard is a production-ready SaaS admin interface built on CloudFlare's edge infrastructure. It provides comprehensive platform management capabilities for the FlareCog multi-tenant cognitive computing platform.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CloudFlare Edge Network                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Admin Dashboard Worker                     │  │
│  │                  (Astro SSR + React)                          │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  Pages:                    Components:                        │  │
│  │  - /admin                  - TenantsTable                     │  │
│  │  - /admin/tenants          - MetricsChart                     │  │
│  │  - /admin/metrics          - BillingTable                     │  │
│  │  - /admin/billing          - Dashboard Cards                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Platform API Layer                       │  │
│  │                    (REST Endpoints)                           │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  /api/tenants              /api/metrics                       │  │
│  │  /api/tenants/:id          /api/billing                       │  │
│  │  /api/tenants/:id/stats    /api/workflows                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Service Layer                            │  │
│  │                   (Business Logic)                            │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  TenantService             MetricsService                     │  │
│  │  BillingService            WorkflowService                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    D1 Database Layer                          │  │
│  │                  (Serverless SQL)                             │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  Tables:                                                      │  │
│  │  - tenants                 - cognitive_metrics                │  │
│  │  - subscription_tiers      - billing_events                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  CloudFlare Workflows                         │  │
│  │              (Background Cognitive Tasks)                     │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  - Reasoning Workflow      - Consolidation Workflow           │  │
│  │  - Learning Workflow       - Metrics Collection               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  Dispatch Namespace                           │  │
│  │                 (User Workers)                                │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  Tenant A Worker           Tenant B Worker                    │  │
│  │  - AtomSpace DO            - AtomSpace DO                     │  │
│  │  - MindAgent DO            - MindAgent DO                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Frontend Layer (Astro + React)

**Technology Stack:**

- **Astro**: Server-side rendering framework
- **React**: UI components and interactivity
- **Tailwind CSS**: Utility-first styling
- **TanStack Table**: Data table management

**Key Features:**

- Server-side rendering for fast initial page loads
- Client-side hydration for interactive components
- Responsive design for mobile and desktop
- Real-time data updates via API polling

**Pages:**

```typescript
/admin                  → Dashboard home
/admin/tenants          → Tenant management
/admin/tenants/:id      → Tenant details
/admin/metrics          → Metrics analytics
/admin/billing          → Billing and revenue
```

**Components:**

```typescript
TenantsTable            → Data table for tenants
MetricsChart            → Visualization for metrics
BillingTable            → Billing events table
DashboardCard           → Stat card component
```

### 2. API Layer (REST Endpoints)

**Authentication:**

All endpoints require Bearer token authentication:

```typescript
Authorization: Bearer <API_TOKEN>
```

**Endpoints:**

| Endpoint                        | Method | Purpose                     |
| ------------------------------- | ------ | --------------------------- |
| `/api/tenants`                  | GET    | List all tenants            |
| `/api/tenants`                  | POST   | Create new tenant           |
| `/api/tenants/:id`              | GET    | Get tenant details          |
| `/api/tenants/:id`              | PUT    | Update tenant               |
| `/api/tenants/:id`              | DELETE | Delete tenant               |
| `/api/tenants/:id/stats`        | GET    | Get tenant statistics       |
| `/api/metrics`                  | GET    | Query metrics               |
| `/api/metrics`                  | POST   | Record metric               |
| `/api/billing`                  | GET    | Query billing events        |
| `/api/billing`                  | POST   | Record billing event        |
| `/api/workflows/:tenant/trigger`| POST   | Trigger cognitive workflow  |

**Response Format:**

```json
{
	"success": true,
	"data": {...},
	"error": null
}
```

### 3. Service Layer (Business Logic)

**TenantService:**

```typescript
class TenantService {
	async getById(id: string): Promise<Tenant>
	async getAll(): Promise<Tenant[]>
	async getAllByTier(tier: string): Promise<Tenant[]>
	async getAllByStatus(status: string): Promise<Tenant[]>
	async create(data: TenantData): Promise<Result>
	async update(id: string, updates: Partial<TenantData>): Promise<Result>
	async updateTier(id: string, tier: string): Promise<Result>
	async updateStatus(id: string, status: string): Promise<Result>
	async suspend(id: string): Promise<Result>
	async activate(id: string): Promise<Result>
	async delete(id: string): Promise<Result>
	async regenerateApiKey(id: string): Promise<Result>
	async getStats(id: string): Promise<TenantStats>
}
```

**MetricsService:**

```typescript
class MetricsService {
	async record(data: MetricData): Promise<Result>
	async getByTenant(tenantId: string, options?: QueryOptions): Promise<Metric[]>
	async getAggregatedByTenant(tenantId: string, options?: AggregateOptions): Promise<AggregatedMetric[]>
	async getTenantSummary(tenantId: string, days: number): Promise<Summary>
	async getPlatformSummary(days: number): Promise<Summary>
	async getTopTenants(limit: number, days: number): Promise<TenantMetric[]>
	async checkResourceLimits(tenantId: string): Promise<ResourceLimits>
}
```

**BillingService:**

```typescript
class BillingService {
	async recordEvent(data: BillingEventData): Promise<Result>
	async getByTenant(tenantId: string, options?: QueryOptions): Promise<BillingEvent[]>
	async getTenantSummary(tenantId: string, days: number): Promise<BillingSummary>
	async getPlatformRevenue(days: number): Promise<RevenueSummary>
	async getSubscriptionTiers(): Promise<SubscriptionTier[]>
	async getSubscriptionTier(name: string): Promise<SubscriptionTier>
	async calculateUsageCost(tenantId: string, options?: CostOptions): Promise<UsageCost>
}
```

### 4. Database Layer (D1)

**Schema:**

```sql
-- Tenants
CREATE TABLE tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT NOT NULL,
    status TEXT NOT NULL,
    email TEXT,
    api_key TEXT UNIQUE,
    rate_limit_rpm INTEGER,
    rate_limit_burst INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Cognitive Metrics
CREATE TABLE cognitive_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    atoms_created INTEGER,
    atoms_queried INTEGER,
    inferences_performed INTEGER,
    agents_executed INTEGER,
    ai_calls_made INTEGER,
    response_time_ms INTEGER,
    success INTEGER,
    created_at TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Billing Events
CREATE TABLE billing_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    amount INTEGER,
    currency TEXT,
    timestamp INTEGER NOT NULL,
    metadata TEXT,
    created_at TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Subscription Tiers
CREATE TABLE subscription_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    price_monthly INTEGER,
    price_yearly INTEGER,
    atoms_limit INTEGER,
    inferences_limit INTEGER,
    ai_calls_limit INTEGER,
    rate_limit_rpm INTEGER,
    rate_limit_burst INTEGER,
    features TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**Indexes:**

```sql
-- Performance indexes
CREATE INDEX idx_tenants_tier ON tenants(tier);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_cognitive_metrics_tenant_timestamp ON cognitive_metrics(tenant_id, timestamp);
CREATE INDEX idx_billing_events_tenant_timestamp ON billing_events(tenant_id, timestamp);
```

### 5. Workflow Layer (CloudFlare Workflows)

**CognitiveWorkflow:**

```typescript
class CognitiveWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		// Step 1: Fetch tenant
		const tenant = await step.do("fetch tenant", async () => {
			// ...
		});

		// Step 2: Get AtomSpace stats
		const stats = await step.do("fetch atomspace stats", async () => {
			// ...
		});

		// Step 3: Perform operation
		if (operation === "reasoning") {
			await step.do("perform reasoning", async () => {
				// ...
			});
		}

		// Step 4: Update metrics
		await step.do("update metrics", async () => {
			// ...
		});

		// Step 5: Record billing
		await step.do("record billing", async () => {
			// ...
		});
	}
}
```

**Operations:**

- `reasoning`: Forward/backward chaining inference
- `consolidation`: Knowledge consolidation
- `learning`: Hebbian learning
- `attention_update`: Attention value decay
- `metrics_collection`: Periodic metrics collection

## Data Flow

### Tenant Creation Flow

```
User (Admin Dashboard)
    │
    ▼
POST /api/tenants
    │
    ▼
TenantService.create()
    │
    ├─► Insert into tenants table
    │
    ├─► Generate API key
    │
    ├─► Deploy user Worker (via Platform API)
    │
    ├─► Record billing event
    │
    └─► Return tenant ID
```

### Metrics Recording Flow

```
User Worker (Cognitive Operation)
    │
    ▼
POST /api/metrics
    │
    ▼
MetricsService.record()
    │
    ├─► Insert into cognitive_metrics table
    │
    ├─► Check resource limits
    │
    ├─► Trigger billing if over limit
    │
    └─► Return success
```

### Workflow Trigger Flow

```
Admin Dashboard or Scheduled Task
    │
    ▼
COGNITIVE_WORKFLOW.create()
    │
    ▼
CognitiveWorkflow.run()
    │
    ├─► Step 1: Fetch tenant
    │
    ├─► Step 2: Get AtomSpace stats
    │
    ├─► Step 3: Perform operation
    │
    ├─► Step 4: Update metrics
    │
    └─► Step 5: Record billing
```

## Security Architecture

### Authentication

**API Token:**

- Stored as CloudFlare Workers secret
- Required for all API endpoints
- Bearer token format
- 32+ character random string

**Validation:**

```typescript
async function validateApiTokenResponse(
	request: Request,
	API_TOKEN: string,
) {
	const authHeader = request.headers.get("Authorization");

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return new Response(JSON.stringify({ error: "Missing token" }), {
			status: 401,
		});
	}

	const token = authHeader.substring(7);

	if (token !== API_TOKEN) {
		return new Response(JSON.stringify({ error: "Invalid token" }), {
			status: 401,
		});
	}

	return null; // Valid
}
```

### SQL Injection Prevention

**Prepared Statements:**

```typescript
// ✅ Safe: Prepared statement with parameter binding
await DB.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(tenantId).first();

// ❌ Unsafe: String concatenation
await DB.prepare(`SELECT * FROM tenants WHERE id = '${tenantId}'`).first();
```

### Rate Limiting

**Per-Tenant Limits:**

```typescript
const tierLimits = {
	free: { rpm: 60, burst: 100 },
	pro: { rpm: 600, burst: 1000 },
	enterprise: { rpm: 6000, burst: 10000 },
};
```

**Implementation:**

- Token bucket algorithm
- Tracked in tenant record
- Enforced at dispatch Worker level

## Performance Optimization

### Database Optimization

**Indexes:**

- Primary keys on all tables
- Foreign key indexes
- Composite indexes for common queries
- Timestamp indexes for time-based queries

**Query Optimization:**

```typescript
// ✅ Efficient: Single query with JOIN
const query = `
  SELECT tenants.*, COUNT(metrics.id) as operation_count
  FROM tenants
  LEFT JOIN cognitive_metrics metrics ON tenants.id = metrics.tenant_id
  GROUP BY tenants.id
`;

// ❌ Inefficient: N+1 queries
const tenants = await getAllTenants();
for (const tenant of tenants) {
	const count = await getMetricsCount(tenant.id);
}
```

### Caching Strategy

**KV Cache (Future Enhancement):**

```typescript
// Cache tenant data for 5 minutes
const cached = await env.CACHE.get(`tenant:${tenantId}`);
if (cached) return JSON.parse(cached);

const tenant = await tenantService.getById(tenantId);
await env.CACHE.put(`tenant:${tenantId}`, JSON.stringify(tenant), {
	expirationTtl: 300,
});
```

### Pagination

**Implementation:**

```typescript
async function getMetrics(
	tenantId: string,
	options: { limit?: number; offset?: number },
) {
	const { limit = 100, offset = 0 } = options;

	const query = `
    SELECT * FROM cognitive_metrics
    WHERE tenant_id = ?
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `;

	return await DB.prepare(query).bind(tenantId, limit, offset).all();
}
```

## Scalability

### Horizontal Scaling

**CloudFlare Workers:**

- Automatically scales to millions of requests
- No configuration needed
- Global edge network

**D1 Database:**

- Scales to 10 GB per database
- Read replicas for global distribution
- Automatic backups

### Vertical Scaling

**Resource Limits per Tier:**

| Tier       | Atoms      | Inferences | AI Calls   | RPM   |
| ---------- | ---------- | ---------- | ---------- | ----- |
| Free       | 1,000      | 100        | 100        | 60    |
| Pro        | 100,000    | 10,000     | 10,000     | 600   |
| Enterprise | Unlimited  | Unlimited  | Unlimited  | 6,000 |

### Multi-Region Deployment

**CloudFlare Edge:**

- Deployed to 300+ locations globally
- Automatic routing to nearest edge
- Sub-50ms latency worldwide

## Monitoring and Observability

### Built-in Metrics

**CloudFlare Dashboard:**

- Requests per second
- CPU time
- Errors
- Success rate
- P50/P95/P99 latency

### Custom Metrics

**Cognitive Metrics:**

- Atoms created/queried
- Inferences performed
- Agents executed
- AI calls made
- Response times

**Billing Metrics:**

- Revenue per tenant
- Subscription changes
- Payment success/failure
- Usage-based billing

### Logging

**Wrangler Tail:**

```bash
npx wrangler tail
```

**Log Levels:**

- `console.log()`: Info
- `console.warn()`: Warning
- `console.error()`: Error

## Disaster Recovery

### Database Backups

**D1 Automatic Backups:**

- Point-in-time recovery
- 30-day retention
- Restore via Wrangler CLI

**Manual Backup:**

```bash
npx wrangler d1 export flarecog-platform --output backup.sql
```

### Rollback Strategy

**Worker Rollback:**

```bash
npx wrangler rollback --message "Rollback to previous version"
```

**Database Rollback:**

```bash
npx wrangler d1 time-travel flarecog-platform --timestamp 2025-11-23T12:00:00Z
```

## Cost Analysis

### CloudFlare Workers

- **Free Tier**: 100,000 requests/day
- **Paid Plan**: $5/month for 10M requests
- **Overage**: $0.50 per 1M requests

### D1 Database

- **Free Tier**: 5 GB storage, 5M reads/day, 100K writes/day
- **Paid Plan**: $0.75/GB storage, $0.001/1K reads, $1/1M writes

### Estimated Costs

**Small Platform** (< 100 tenants):

- Requests: ~1M/month → $0-5
- Database: ~1 GB, 1M reads, 10K writes → $0
- **Total**: $0-5/month

**Medium Platform** (100-1000 tenants):

- Requests: ~10M/month → $5-10
- Database: ~5 GB, 10M reads, 100K writes → $5-10
- **Total**: $10-20/month

**Large Platform** (1000+ tenants):

- Requests: ~100M/month → $50-100
- Database: ~20 GB, 100M reads, 1M writes → $20-50
- **Total**: $70-150/month

## Future Enhancements

1. **KV Caching**: Add caching layer for frequently accessed data
2. **Analytics Dashboard**: Advanced metrics visualization
3. **User Authentication**: OAuth or email/password login
4. **Billing Integration**: Stripe or other payment processor
5. **Monitoring Alerts**: Email/Slack notifications for errors
6. **Backup Automation**: Scheduled database backups
7. **Multi-Region Replication**: Active-active database replication
8. **API Rate Limiting**: Per-endpoint rate limits
9. **Audit Logging**: Track all admin actions
10. **Role-Based Access Control**: Multiple admin roles

## Conclusion

The FlareCog Admin Dashboard provides a production-ready, scalable, and cost-effective platform management solution. Built on CloudFlare's edge infrastructure, it delivers global performance with minimal operational overhead.

For deployment instructions, see [Deployment Guide](./deployment-guide.md).
