# FlareCog Admin Dashboard

Production-ready admin dashboard for the FlareCog multi-tenant cognitive platform. Built with Astro, React, Tailwind CSS, and CloudFlare's developer stack.

## Features

- 🎨 **Modern UI** - Built with Astro, React, and Tailwind CSS
- 👥 **Tenant Management** - Create, view, update, and delete tenants
- 📊 **Metrics Dashboard** - Real-time cognitive operations metrics
- 💳 **Billing & Subscriptions** - Track revenue and subscription tiers
- 🔐 **API Authentication** - Token-based API security
- 🚀 **CloudFlare Workflows** - Background cognitive tasks
- 📦 **D1 Database** - Serverless SQL database
- ✨ **Observability** - Built-in metrics and source maps

## Tech Stack

- **Frontend**: [Astro](https://astro.build) + [React](https://react.dev)
- **UI Components**: [Tailwind CSS](https://tailwindcss.com) + [TanStack Table](https://tanstack.com/table)
- **Database**: [CloudFlare D1](https://developers.cloudflare.com/d1)
- **Workflows**: [CloudFlare Workflows](https://developers.cloudflare.com/workflows)
- **Deployment**: [CloudFlare Workers](https://workers.cloudflare.com)

## Setup Steps

### 1. Install Dependencies

```bash
cd flarecog-admin
npm install
```

### 2. Create D1 Database

```bash
npx wrangler d1 create flarecog-platform
```

Update the `database_id` in `wrangler.jsonc` with the new database ID.

### 3. Run Database Migrations

**Local:**

```bash
npm run db:migrate
```

**Remote (after deployment):**

```bash
npm run db:migrate:remote
```

### 4. Set Environment Variables

Create a `.dev.vars` file for local development:

```bash
API_TOKEN=your_secure_token_here
```

For production, set the secret:

```bash
npx wrangler secret put API_TOKEN
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:4321/admin` to see the dashboard.

### 6. Deploy to CloudFlare

```bash
npm run deploy
```

## Database Schema

### Tenants Table

Stores tenant information and configuration.

```sql
CREATE TABLE tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT NOT NULL CHECK(tier IN ('free', 'pro', 'enterprise')),
    status TEXT NOT NULL CHECK(status IN ('active', 'suspended', 'deleted')),
    email TEXT,
    api_key TEXT UNIQUE,
    rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
    rate_limit_burst INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Cognitive Metrics Table

Records cognitive operations for analytics and billing.

```sql
CREATE TABLE cognitive_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    atoms_created INTEGER NOT NULL DEFAULT 0,
    atoms_queried INTEGER NOT NULL DEFAULT 0,
    inferences_performed INTEGER NOT NULL DEFAULT 0,
    agents_executed INTEGER NOT NULL DEFAULT 0,
    ai_calls_made INTEGER NOT NULL DEFAULT 0,
    response_time_ms INTEGER NOT NULL DEFAULT 0,
    success INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

### Billing Events Table

Tracks subscription and payment events.

```sql
CREATE TABLE billing_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    timestamp INTEGER NOT NULL,
    metadata TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

### Subscription Tiers Table

Defines subscription plans and resource limits.

```sql
CREATE TABLE subscription_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER NOT NULL,
    atoms_limit INTEGER NOT NULL DEFAULT -1,
    inferences_limit INTEGER NOT NULL DEFAULT -1,
    ai_calls_limit INTEGER NOT NULL DEFAULT -1,
    rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
    rate_limit_burst INTEGER NOT NULL DEFAULT 100,
    features TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Tenants

- `GET /api/tenants` - List all tenants
- `GET /api/tenants?tier=pro` - Filter by tier
- `GET /api/tenants?status=active` - Filter by status
- `POST /api/tenants` - Create new tenant
- `GET /api/tenants/:id` - Get tenant details
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Delete tenant (soft delete)
- `GET /api/tenants/:id/stats` - Get tenant statistics

### Metrics

- `GET /api/metrics?tenant_id=xxx` - Get tenant metrics
- `GET /api/metrics?tenant_id=xxx&summary=true` - Get tenant summary
- `GET /api/metrics?platform=true` - Get platform-wide metrics
- `POST /api/metrics` - Record new metric

### Billing

- `GET /api/billing?tenant_id=xxx` - Get tenant billing events
- `GET /api/billing?tenant_id=xxx&summary=true` - Get billing summary
- `GET /api/billing?revenue=true` - Get platform revenue
- `GET /api/billing?tiers=true` - Get subscription tiers
- `POST /api/billing` - Record billing event

## CloudFlare Workflows

### Cognitive Workflow

Background workflow for long-running cognitive tasks.

**Operations:**

- `reasoning` - Perform forward/backward chaining
- `consolidation` - Consolidate knowledge
- `learning` - Hebbian learning
- `attention_update` - Update attention values
- `metrics_collection` - Collect metrics

**Trigger:**

```typescript
await env.COGNITIVE_WORKFLOW.create({
	params: {
		tenantId: "tenant-123",
		operation: "reasoning",
		config: { maxSteps: 100 },
	},
});
```

## Service Layer

### TenantService

```typescript
const tenantService = new TenantService(DB);

// CRUD operations
await tenantService.create({ id, name, tier, api_key });
await tenantService.getById(id);
await tenantService.getAll();
await tenantService.update(id, { name, email });
await tenantService.updateTier(id, "pro");
await tenantService.suspend(id);
await tenantService.delete(id);

// Stats
await tenantService.getStats(id);
```

### MetricsService

```typescript
const metricsService = new MetricsService(DB);

// Record metrics
await metricsService.record({
	tenant_id,
	timestamp: Date.now(),
	atoms_created: 10,
	inferences_performed: 5,
});

// Query metrics
await metricsService.getByTenant(tenantId, { startTime, endTime });
await metricsService.getTenantSummary(tenantId, 30);
await metricsService.getPlatformSummary(30);

// Check limits
await metricsService.checkResourceLimits(tenantId);
```

### BillingService

```typescript
const billingService = new BillingService(DB);

// Record events
await billingService.recordEvent({
	tenant_id,
	event_type: "payment_succeeded",
	amount: 4900,
});

// Query billing
await billingService.getByTenant(tenantId);
await billingService.getTenantSummary(tenantId, 30);
await billingService.getPlatformRevenue(30);

// Calculate usage cost
await billingService.calculateUsageCost(tenantId);
```

## Subscription Tiers

### Free Tier

- **Price**: $0/month
- **Atoms**: 1,000
- **Inferences**: 100
- **AI Calls**: 100
- **Rate Limit**: 60 RPM
- **Features**: Basic AtomSpace, Basic Reasoning, Community Support

### Pro Tier

- **Price**: $49/month or $490/year
- **Atoms**: 100,000
- **Inferences**: 10,000
- **AI Calls**: 10,000
- **Rate Limit**: 600 RPM
- **Features**: Advanced AtomSpace, Advanced Reasoning, AI-Enhanced Perception, Priority Support, Analytics Dashboard

### Enterprise Tier

- **Price**: $299/month or $2,990/year
- **Atoms**: Unlimited
- **Inferences**: Unlimited
- **AI Calls**: Unlimited
- **Rate Limit**: 6,000 RPM
- **Features**: All Pro features + Custom Workflows, Dedicated Support, SLA Guarantee, Custom Integrations

## Development

### Project Structure

```
flarecog-admin/
├── migrations/              # Database migrations
│   ├── 0001_create_tenants.sql
│   ├── 0002_create_cognitive_metrics.sql
│   └── 0003_create_billing_events.sql
├── src/
│   ├── components/
│   │   └── admin/          # Admin UI components
│   │       └── tenants-table.tsx
│   ├── layouts/
│   │   └── Layout.astro    # Main layout
│   ├── lib/
│   │   ├── api.ts          # API utilities
│   │   └── services/       # Service layer
│   │       ├── tenant.ts
│   │       ├── metrics.ts
│   │       └── billing.ts
│   ├── pages/
│   │   ├── admin.astro     # Dashboard home
│   │   ├── admin/
│   │   │   ├── tenants.astro
│   │   │   ├── metrics.astro
│   │   │   └── billing.astro
│   │   └── api/            # API endpoints
│   │       ├── tenants.ts
│   │       ├── metrics.ts
│   │       └── billing.ts
│   └── workflows/
│       └── cognitive_workflow.ts
├── astro.config.mjs
├── wrangler.jsonc
├── package.json
└── README.md
```

### Adding New Features

1. **Database Changes**: Add migration in `migrations/`
2. **Service Layer**: Add/update service in `src/lib/services/`
3. **API Endpoint**: Add route in `src/pages/api/`
4. **UI Component**: Add component in `src/components/admin/`
5. **Page**: Add page in `src/pages/admin/`

## Deployment

### Prerequisites

- CloudFlare account
- Wrangler CLI installed
- D1 database created
- API token set as secret

### Deploy Command

```bash
npm run deploy
```

### Post-Deployment

1. Run remote migrations: `npm run db:migrate:remote`
2. Set production API token: `npx wrangler secret put API_TOKEN`
3. Verify deployment: Visit your Workers URL + `/admin`

## Security

- **API Authentication**: All endpoints require Bearer token
- **CORS**: Configure in `wrangler.jsonc` if needed
- **Rate Limiting**: Implemented per tenant tier
- **SQL Injection**: Prevented via prepared statements
- **Secrets**: Stored in CloudFlare Workers secrets

## Monitoring

- **Observability**: Enabled in `wrangler.jsonc`
- **Source Maps**: Uploaded for debugging
- **Metrics**: Tracked in `cognitive_metrics` table
- **Billing Events**: Tracked in `billing_events` table

## Support

For issues or questions:

- GitHub Issues: https://github.com/cogpy/cogflare-temp/issues
- Documentation: https://flarecog.ai/docs

## License

MIT License - see LICENSE file for details
