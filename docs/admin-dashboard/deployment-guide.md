# FlareCog Admin Dashboard: Deployment Guide

**Date:** November 23, 2025

**Author:** Manus AI

## Overview

This guide provides step-by-step instructions for deploying the FlareCog Admin Dashboard to CloudFlare Workers. The dashboard provides comprehensive platform management capabilities including tenant management, metrics analytics, and billing tracking.

## Prerequisites

- CloudFlare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler`)
- Node.js 18+ installed
- Git repository access to cogflare-temp

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FlareCog Platform                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Admin Dashboard │◄────────┤  Platform API    │         │
│  │  (Astro + React) │         │  (REST)          │         │
│  └──────────────────┘         └──────────────────┘         │
│           │                            │                     │
│           ▼                            ▼                     │
│  ┌──────────────────────────────────────────────┐          │
│  │           D1 Database                         │          │
│  │  - tenants                                    │          │
│  │  - cognitive_metrics                          │          │
│  │  - billing_events                             │          │
│  │  - subscription_tiers                         │          │
│  └──────────────────────────────────────────────┘          │
│           │                            │                     │
│           ▼                            ▼                     │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │ Cognitive        │         │ User Workers     │         │
│  │ Workflow         │         │ (Dispatch NS)    │         │
│  └──────────────────┘         └──────────────────┘         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Clone Repository

```bash
git clone https://github.com/cogpy/cogflare-temp.git
cd cogflare-temp/flarecog-admin
```

## Step 2: Install Dependencies

```bash
npm install
```

**Expected output:**

```
added 523 packages in 12s
```

## Step 3: Create D1 Database

```bash
npx wrangler d1 create flarecog-platform
```

**Expected output:**

```
✅ Successfully created DB 'flarecog-platform'

[[d1_databases]]
binding = "DB"
database_name = "flarecog-platform"
database_id = "1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p"
```

**Action:** Copy the `database_id` and update `wrangler.jsonc`:

```jsonc
{
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "flarecog-platform",
			"database_id": "1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p" // ← Your ID here
		}
	]
}
```

## Step 4: Run Database Migrations (Local)

```bash
npm run db:migrate
```

**Expected output:**

```
🌀 Executing on local database flarecog-platform (1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p) from .wrangler/state/v3/d1:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
├ 🌀 Executing 0001_create_tenants.sql
│ 🌀 CREATE TABLE tenants
│ 🌀 CREATE TRIGGER update_tenants_updated_at
│ 🌀 CREATE INDEX idx_tenants_tier
│ 🌀 CREATE INDEX idx_tenants_status
│ 🌀 CREATE INDEX idx_tenants_created_at
├ 🌀 Executing 0002_create_cognitive_metrics.sql
│ 🌀 CREATE TABLE cognitive_metrics
│ 🌀 CREATE INDEX idx_cognitive_metrics_tenant_timestamp
│ 🌀 CREATE INDEX idx_cognitive_metrics_timestamp
│ 🌀 CREATE INDEX idx_cognitive_metrics_tenant_created
├ 🌀 Executing 0003_create_billing_events.sql
│ 🌀 CREATE TABLE subscription_tiers
│ 🌀 CREATE TABLE billing_events
│ 🌀 CREATE TRIGGER update_subscription_tiers_updated_at
│ 🌀 CREATE INDEX idx_billing_events_tenant_timestamp
│ 🌀 CREATE INDEX idx_billing_events_event_type
│ 🌀 CREATE INDEX idx_billing_events_timestamp
│ 🌀 INSERT INTO subscription_tiers (3 rows)
✅ Successfully applied 3 migrations
```

## Step 5: Set Environment Variables

### Local Development

Create `.dev.vars` file:

```bash
echo "API_TOKEN=$(openssl rand -hex 32)" > .dev.vars
```

**Example `.dev.vars`:**

```
API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### Production

Set the secret in CloudFlare:

```bash
npx wrangler secret put API_TOKEN
```

**Prompt:**

```
Enter a secret value: ****************************************
✅ Successfully created secret for key: API_TOKEN
```

## Step 6: Test Locally

```bash
npm run dev
```

**Expected output:**

```
  🚀  astro  v5.1.6 started in 234ms

  ┃ Local    http://localhost:4321/
  ┃ Network  use --host to expose

  watching for file changes...
```

**Test the dashboard:**

1. Open `http://localhost:4321/admin`
2. You should see the dashboard home page
3. Navigate to `/admin/tenants` to see tenant management

## Step 7: Build for Production

```bash
npm run build
```

**Expected output:**

```
building client
✓ Completed in 2.34s.

building server
✓ Completed in 1.12s.

✓ Built in 3.51s
```

## Step 8: Deploy to CloudFlare

```bash
npx wrangler deploy
```

**Expected output:**

```
Total Upload: 1.23 MB / gzip: 345 KB
Uploaded flarecog-admin (2.1 sec)
Published flarecog-admin (0.3 sec)
  https://flarecog-admin.your-subdomain.workers.dev
Current Deployment ID: a1b2c3d4-e5f6-7g8h-9i0j-1k2l3m4n5o6p
```

## Step 9: Run Database Migrations (Remote)

```bash
npm run db:migrate:remote
```

**Expected output:**

```
🌀 Executing on remote database flarecog-platform (1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p):
├ 🌀 Executing 0001_create_tenants.sql
├ 🌀 Executing 0002_create_cognitive_metrics.sql
├ 🌀 Executing 0003_create_billing_events.sql
✅ Successfully applied 3 migrations
```

## Step 10: Verify Deployment

### Test API Endpoints

```bash
# Get API token from .dev.vars or wrangler secret
API_TOKEN="your_token_here"
WORKER_URL="https://flarecog-admin.your-subdomain.workers.dev"

# Test tenants endpoint
curl -H "Authorization: Bearer $API_TOKEN" \
  "$WORKER_URL/api/tenants"
```

**Expected response:**

```json
{
	"tenants": [],
	"count": 0
}
```

### Create Test Tenant

```bash
curl -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-tenant-001",
    "name": "Test Tenant",
    "tier": "free",
    "api_key": "test-api-key-001"
  }' \
  "$WORKER_URL/api/tenants"
```

**Expected response:**

```json
{
	"message": "Tenant created successfully",
	"success": true,
	"tenant_id": "test-tenant-001"
}
```

### Verify Dashboard

1. Visit `https://flarecog-admin.your-subdomain.workers.dev/admin`
2. You should see the dashboard with the test tenant

## Step 11: Configure Custom Domain (Optional)

### Add Custom Domain

```bash
npx wrangler domains add admin.flarecog.ai
```

### Update DNS

Add a CNAME record:

```
Type: CNAME
Name: admin
Target: flarecog-admin.your-subdomain.workers.dev
Proxy: Enabled (orange cloud)
```

### Verify Custom Domain

```bash
curl https://admin.flarecog.ai/api/tenants \
  -H "Authorization: Bearer $API_TOKEN"
```

## Step 12: Set Up Monitoring

### Enable Observability

Already enabled in `wrangler.jsonc`:

```jsonc
{
	"observability": {
		"enabled": true
	}
}
```

### View Metrics

1. Go to CloudFlare Dashboard
2. Navigate to Workers & Pages
3. Select `flarecog-admin`
4. Click "Metrics" tab

**Metrics available:**

- Requests per second
- CPU time
- Errors
- Success rate

## Troubleshooting

### Issue: Database Not Found

**Error:**

```
Error: D1 database not found: flarecog-platform
```

**Solution:**

1. Verify database ID in `wrangler.jsonc`
2. Run `npx wrangler d1 list` to see all databases
3. Update `database_id` with correct value

### Issue: API Token Invalid

**Error:**

```json
{
	"error": "Invalid API token"
}
```

**Solution:**

1. Verify `.dev.vars` file exists (local)
2. Verify secret is set: `npx wrangler secret list`
3. Re-set secret: `npx wrangler secret put API_TOKEN`

### Issue: Migrations Failed

**Error:**

```
Error: Migration failed: table already exists
```

**Solution:**

1. Drop and recreate database:
   ```bash
   npx wrangler d1 delete flarecog-platform
   npx wrangler d1 create flarecog-platform
   ```
2. Update `database_id` in `wrangler.jsonc`
3. Re-run migrations

### Issue: Build Failed

**Error:**

```
Error: Cannot find module '@astrojs/cloudflare'
```

**Solution:**

1. Delete `node_modules` and `package-lock.json`
2. Re-install dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

## Production Checklist

- [ ] D1 database created and configured
- [ ] Database migrations applied (remote)
- [ ] API token set as secret
- [ ] Application deployed to CloudFlare
- [ ] Custom domain configured (optional)
- [ ] Test tenant created and verified
- [ ] Dashboard accessible and functional
- [ ] API endpoints responding correctly
- [ ] Observability enabled and metrics visible
- [ ] Backup strategy defined

## Maintenance

### Update Deployment

```bash
git pull origin main
cd flarecog-admin
npm install
npm run build
npx wrangler deploy
```

### Add New Migration

1. Create migration file: `migrations/0004_your_migration.sql`
2. Run locally: `npm run db:migrate`
3. Test changes
4. Deploy: `npx wrangler deploy`
5. Run remotely: `npm run db:migrate:remote`

### View Logs

```bash
npx wrangler tail
```

### Rollback Deployment

```bash
npx wrangler rollback --message "Rollback to previous version"
```

## Security Best Practices

1. **API Token**: Use strong random tokens (32+ characters)
2. **Secrets**: Never commit `.dev.vars` to git
3. **CORS**: Configure allowed origins if needed
4. **Rate Limiting**: Implemented per tenant tier
5. **SQL Injection**: Prevented via prepared statements
6. **HTTPS**: Enforced by CloudFlare Workers

## Performance Optimization

1. **Caching**: Consider adding KV cache for frequently accessed data
2. **Indexes**: Already created on frequently queried columns
3. **Pagination**: Implement for large result sets
4. **Compression**: Enabled automatically by CloudFlare
5. **Source Maps**: Uploaded for debugging (production)

## Cost Estimation

### CloudFlare Workers

- **Free Tier**: 100,000 requests/day
- **Paid Plan**: $5/month for 10M requests

### D1 Database

- **Free Tier**: 5 GB storage, 5M reads/day, 100K writes/day
- **Paid Plan**: $0.75/GB storage, $0.001/1K reads, $1/1M writes

### Estimated Monthly Cost

- **Small Platform** (< 100 tenants): $0-5/month
- **Medium Platform** (100-1000 tenants): $5-50/month
- **Large Platform** (1000+ tenants): $50-500/month

## Support

For issues or questions:

- GitHub Issues: https://github.com/cogpy/cogflare-temp/issues
- Documentation: https://flarecog.ai/docs
- CloudFlare Support: https://support.cloudflare.com

## Next Steps

1. **Integrate with Dispatch Worker**: Connect admin dashboard to user Workers
2. **Add Monitoring Alerts**: Set up alerts for errors and resource limits
3. **Implement Backup Strategy**: Regular D1 database backups
4. **Add User Authentication**: OAuth or email/password login
5. **Create Analytics Dashboard**: Advanced metrics visualization
6. **Implement Billing Integration**: Stripe or other payment processor

## Conclusion

The FlareCog Admin Dashboard is now deployed and ready for production use. You have a complete platform management system with tenant management, metrics tracking, and billing capabilities.

For advanced features and customization, see the [Admin Dashboard Architecture](./architecture.md) documentation.
