# FlareCog Deployment Guide

## Multi-Tenant OpenCog-CloudFlare Platform

This guide walks you through deploying the complete FlareCog multi-tenant cognitive architecture on CloudFlare's edge network.

---

## Prerequisites

1. **CloudFlare Account** with Workers Paid plan ($5/month minimum)
2. **Wrangler CLI** installed (`npm install -g wrangler`)
3. **Domain** configured in CloudFlare (for custom routing)
4. **Admin Portal** deployed (flarecog-admin project)

---

## Step 1: Create CloudFlare Resources

### 1.1 Create D1 Database

```bash
wrangler d1 create flarecog-coordination
```

Copy the `database_id` from the output and update `wrangler.toml`.

### 1.2 Create R2 Bucket

```bash
wrangler r2 bucket create flarecog-cold-storage
```

### 1.3 Create KV Namespace

```bash
wrangler kv:namespace create CACHE
wrangler kv:namespace create CACHE --preview
```

Copy the namespace IDs and update `wrangler.toml`.

### 1.4 Create Queue

```bash
wrangler queues create flarecog-agent-queue
```

### 1.5 Create Hyperdrive Configuration

```bash
wrangler hyperdrive create flarecog-hyperdrive --connection-string="YOUR_POSTGRES_CONNECTION_STRING"
```

Copy the Hyperdrive ID and update `wrangler.toml`.

---

## Step 2: Initialize Database Schema

Create the coordination database schema:

```sql
-- Tenant Registry
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  max_atomspaces INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- AtomSpace Registry
CREATE TABLE atomspaces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  atom_count INTEGER DEFAULT 0,
  link_count INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  last_activity INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Usage Tracking
CREATE TABLE usage_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  request_count INTEGER DEFAULT 0,
  storage_used_mb INTEGER DEFAULT 0,
  compute_time_ms INTEGER DEFAULT 0,
  agent_executions INTEGER DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_usage_tenant_time ON usage_metrics(tenant_id, timestamp);
CREATE INDEX idx_atomspaces_tenant ON atomspaces(tenant_id);
```

Apply the schema:

```bash
wrangler d1 execute flarecog-coordination --file=schema.sql
```

---

## Step 3: Deploy FlareCog Workers

### 3.1 Install Dependencies

```bash
cd flarecog
npm install
```

### 3.2 Deploy to Production

```bash
wrangler deploy
```

### 3.3 Verify Deployment

```bash
curl https://flarecog.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "production"
}
```

---

## Step 4: Configure Multi-Tenant Routing

### 4.1 DNS Configuration

In CloudFlare DNS, add:

- **A Record**: `flarecog.com` → Your Worker
- **CNAME Record**: `*.flarecog.com` → `flarecog.com`

### 4.2 Test Tenant Routing

```bash
# Create a test tenant via admin portal
curl -X POST https://admin.flarecog.com/api/tenants \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Test Tenant",
    "subdomain": "test",
    "plan": "basic"
  }'

# Test tenant access
curl https://test.flarecog.com/atomspace/create \
  -H "Authorization: Bearer TENANT_API_KEY" \
  -d '{"name": "TestAtomSpace"}'
```

---

## Step 5: Deploy Admin Portal

### 5.1 Configure Environment

Update the admin portal's environment variables:

```bash
VITE_FLARECOG_API_URL=https://flarecog.com
DATABASE_URL=YOUR_MYSQL_CONNECTION_STRING
```

### 5.2 Deploy via Manus

The admin portal (flarecog-admin) is already deployed via Manus. Access it at your Manus-provided URL.

---

## Step 6: Monitor and Scale

### 6.1 Enable Analytics

```bash
wrangler tail flarecog
```

### 6.2 Monitor Metrics

- **Dashboard**: https://dash.cloudflare.com
- **Admin Portal**: Your deployed flarecog-admin URL
- **Logs**: `wrangler tail flarecog`

### 6.3 Scaling Considerations

**Horizontal Scaling** (recommended):
- Add more AtomSpaces per tenant
- Distribute tenants across multiple Workers
- Use Hyperdrive for database connection pooling

**Vertical Scaling** (when needed):
- Upgrade to Workers for Platforms ($25/month)
- Increase CPU time limits
- Add more R2 storage capacity

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CloudFlare Edge Network                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Dispatch   │────────▶│  AtomSpace   │                  │
│  │    Worker    │         │ (Durable Obj)│                  │
│  └──────────────┘         └──────────────┘                  │
│         │                         │                          │
│         │                         ▼                          │
│         │                  ┌──────────────┐                  │
│         │                  │  MindAgent   │                  │
│         │                  │ (Durable Obj)│                  │
│         │                  └──────────────┘                  │
│         │                         │                          │
│         ▼                         ▼                          │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │      D1      │         │   Workers    │                  │
│  │  (Metadata)  │         │      AI      │                  │
│  └──────────────┘         └──────────────┘                  │
│         │                         │                          │
│         ▼                         ▼                          │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │  Hyperdrive  │         │      R2      │                  │
│  │   (Pooling)  │         │ (Cold Store) │                  │
│  └──────────────┘         └──────────────┘                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │  Admin Portal    │
                  │  (Manus-hosted)  │
                  └──────────────────┘
```

---

## Cost Estimation

Based on the constraints analysis:

### Small Deployment (10 AtomSpaces)
- **Monthly Cost**: $30-50
- **Capacity**: 100M atoms, 10K requests/day
- **Best For**: Prototypes, small teams

### Medium Deployment (50 AtomSpaces)
- **Monthly Cost**: $200-250
- **Capacity**: 1.5B atoms, 50K requests/day
- **Best For**: Production SaaS, enterprise pilots

### Large Deployment (100 AtomSpaces)
- **Monthly Cost**: $500-600
- **Capacity**: 3B atoms, 100K requests/day
- **Best For**: Large-scale cognitive platforms

---

## Troubleshooting

### Issue: Durable Object Not Found

**Solution**: Ensure Durable Objects are properly bound in `wrangler.toml` and deployed.

```bash
wrangler deploy --compatibility-date=2024-11-01
```

### Issue: R2 Access Denied

**Solution**: Verify R2 bucket permissions and binding name matches `wrangler.toml`.

### Issue: High Latency

**Solution**: 
1. Enable R2 cold storage for inactive atoms
2. Use KV caching for frequently accessed data
3. Optimize pattern matching with inverted indices

### Issue: Rate Limiting

**Solution**: Implement tenant-level rate limiting in the dispatch worker (already included).

---

## Security Best Practices

1. **API Key Rotation**: Rotate tenant API keys regularly via admin portal
2. **HTTPS Only**: Enforce HTTPS for all tenant subdomains
3. **Input Validation**: Validate all atom/link data before storage
4. **Rate Limiting**: Configure per-tenant request limits
5. **Audit Logging**: Enable CloudFlare Logpush for compliance

---

## Next Steps

1. **Create Your First Tenant** via the admin portal
2. **Test AtomSpace Operations** using the tenant API key
3. **Monitor Usage** in the analytics dashboard
4. **Scale Gradually** based on actual usage patterns
5. **Optimize Costs** by archiving inactive atoms to R2

---

## Support

- **Documentation**: https://github.com/cogpy/cogflare-temp
- **Issues**: https://github.com/cogpy/cogflare-temp/issues
- **Admin Portal**: Your Manus-provided URL

---

**Congratulations!** You now have a fully operational multi-tenant OpenCog cognitive architecture running on CloudFlare's edge network.
