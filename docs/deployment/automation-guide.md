# FlareCog Deployment Automation Guide

**Version:** 1.0.0  
**Date:** November 23, 2025

## Overview

This guide covers the automated deployment scripts for the FlareCog platform. These scripts use the CloudFlare SDK to programmatically create dispatch namespaces, deploy tenant Workers, and manage platform resources.

## Prerequisites

### 1. CloudFlare Account Setup

- CloudFlare account with Workers for Platforms enabled
- API token with the following permissions:
  - `Workers:Edit`
  - `Workers for Platforms:Edit`
  - `D1:Edit`
  - `KV:Edit`

### 2. Environment Variables

Create a `.env` file in the project root:

```bash
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
DISPATCH_NAMESPACE=flarecog
```

**Load environment variables:**

```bash
export $(cat .env | xargs)
```

### 3. Install Dependencies

```bash
cd scripts
npm install
```

## Deployment Scripts

### 1. Create Dispatch Namespace

**Purpose:** Creates the Workers for Platforms dispatch namespace that will host all tenant Workers.

**Usage:**

```bash
ts-node scripts/create-dispatch-namespace.ts [namespace-name]
```

**Example:**

```bash
ts-node scripts/create-dispatch-namespace.ts flarecog
```

**Output:**

```
=== Creating Dispatch Namespace ===

Namespace Name: flarecog
Account ID: d1fcd8dbbd35aec43e5499200f6baede

Creating dispatch namespace 'flarecog'...
✓ Dispatch namespace 'flarecog' created successfully
  Namespace ID: 12345678-1234-1234-1234-123456789012
  Namespace Name: flarecog
  Created: 2025-11-23T10:00:00.000Z

=== Next Steps ===

1. Update wrangler.jsonc in dispatch Worker
2. Deploy dispatch Worker
3. Deploy tenant Workers
```

**What It Does:**

1. Checks if namespace already exists
2. Creates namespace if it doesn't exist
3. Displays namespace information
4. Provides next steps for configuration

### 2. Deploy Tenant Worker

**Purpose:** Deploys a complete tenant cognitive instance with all required resources.

**Usage:**

```bash
ts-node scripts/deploy-tenant.ts <tenant-id> <tier> [--name <name>]
```

**Arguments:**

- `tenant-id`: Unique identifier for the tenant (3-63 characters, lowercase letters, numbers, hyphens)
- `tier`: Subscription tier (`free`, `pro`, `enterprise`)
- `--name`: Optional human-readable tenant name

**Example:**

```bash
ts-node scripts/deploy-tenant.ts acme-corp pro --name "Acme Corporation"
```

**Output:**

```
=== FlareCog Tenant Deployment ===

Tenant ID: acme-corp
Tenant Name: Acme Corporation
Tier: pro
Dispatch Namespace: flarecog

Ensuring dispatch namespace 'flarecog' exists...
✓ Dispatch namespace 'flarecog' exists
Creating D1 database for tenant acme-corp...
✓ D1 database created: 12345678-1234-1234-1234-123456789012
Creating KV namespace for tenant acme-corp...
✓ KV namespace created: 87654321-4321-4321-4321-210987654321
Deploying user Worker for tenant acme-corp...
✓ User Worker deployed to dispatch namespace

=== Deployment Complete ===

Tenant Resources:
  - Tenant ID: acme-corp
  - D1 Database: 12345678-1234-1234-1234-123456789012 (flarecog_acme-corp)
  - KV Namespace: 87654321-4321-4321-4321-210987654321 (flarecog_acme-corp_cache)
  - Worker: flarecog/acme-corp

Next Steps:
  1. Configure DNS for tenant subdomain (if using subdomain routing)
  2. Generate API key for tenant authentication
  3. Test tenant Worker endpoint
  4. Access tenant at: https://acme-corp.flarecog.ai (after DNS configuration)
```

**What It Does:**

1. Validates tenant ID and tier
2. Ensures dispatch namespace exists
3. Creates D1 database for tenant data
4. Creates KV namespace for caching
5. Loads user Worker template
6. Deploys Worker to dispatch namespace with bindings:
   - Environment variables (TENANT_ID, TENANT_NAME, TIER, rate limits)
   - D1 database binding
   - KV namespace binding
   - CloudFlare AI binding
7. Displays deployment summary

### 3. List Tenant Workers

**Purpose:** Lists all deployed tenant Workers in the dispatch namespace.

**Usage:**

```bash
ts-node scripts/list-tenants.ts [namespace-name]
```

**Example:**

```bash
ts-node scripts/list-tenants.ts flarecog
```

**Output:**

```
=== FlareCog Tenant Workers ===

Namespace: flarecog
Account ID: d1fcd8dbbd35aec43e5499200f6baede

Namespace ID: 12345678-1234-1234-1234-123456789012
Created: 2025-11-23T10:00:00.000Z
Modified: 2025-11-23T10:30:00.000Z

Deployed Tenant Workers:

  • acme-corp
    Created: 2025-11-23T10:15:00.000Z
    Modified: 2025-11-23T10:15:00.000Z
    URL: https://acme-corp.flarecog.ai (after DNS config)

  • globex-inc
    Created: 2025-11-23T10:20:00.000Z
    Modified: 2025-11-23T10:20:00.000Z
    URL: https://globex-inc.flarecog.ai (after DNS config)

Total: 2 tenant Worker(s)
```

**What It Does:**

1. Connects to dispatch namespace
2. Lists all deployed scripts
3. Displays creation and modification dates
4. Shows tenant URLs (after DNS configuration)

## Tier Configuration

Each tier has different resource limits and rate limits:

### Free Tier

```typescript
{
  rateLimit: {
    requestsPerMinute: 60,
    burstSize: 100
  },
  limits: {
    atoms: 1000,
    inferences: 100,
    aiCalls: 100
  }
}
```

### Pro Tier

```typescript
{
  rateLimit: {
    requestsPerMinute: 600,
    burstSize: 1000
  },
  limits: {
    atoms: 100000,
    inferences: 10000,
    aiCalls: 10000
  }
}
```

### Enterprise Tier

```typescript
{
  rateLimit: {
    requestsPerMinute: 6000,
    burstSize: 10000
  },
  limits: {
    atoms: -1,        // unlimited
    inferences: -1,   // unlimited
    aiCalls: -1       // unlimited
  }
}
```

## Worker Bindings

Each deployed tenant Worker includes the following bindings:

### Environment Variables

| Name | Type | Description |
|------|------|-------------|
| `TENANT_ID` | plain_text | Unique tenant identifier |
| `TENANT_NAME` | plain_text | Human-readable tenant name |
| `TIER` | plain_text | Subscription tier (free/pro/enterprise) |
| `RATE_LIMIT_RPM` | plain_text | Requests per minute limit |
| `RATE_LIMIT_BURST` | plain_text | Burst size limit |

### Resource Bindings

| Name | Type | Description |
|------|------|-------------|
| `DB` | d1_database | D1 database for persistent storage |
| `ATOM_CACHE` | kv_namespace | KV namespace for caching |
| `AI` | ai | CloudFlare AI binding |

### Durable Object Bindings (Future)

| Name | Type | Description |
|------|------|-------------|
| `ATOMSPACE` | durable_object_namespace | AtomSpace Durable Object |
| `MIND_AGENT` | durable_object_namespace | MindAgent Durable Object |

**Note:** Durable Object bindings require the main flarecog Worker to be deployed first with the DO classes exported.

## Deployment Workflow

### Initial Platform Setup

```bash
# 1. Set environment variables
export CLOUDFLARE_API_TOKEN=your_token
export CLOUDFLARE_ACCOUNT_ID=your_account_id

# 2. Create dispatch namespace
ts-node scripts/create-dispatch-namespace.ts flarecog

# 3. Build user Worker template
cd flarecog-platform/user-worker-template
npm install
npm run build
cd ../..

# 4. Deploy dispatch Worker
cd flarecog-platform/dispatch-worker
npm install
npx wrangler deploy
cd ../..

# 5. Deploy platform API
cd flarecog-platform/platform-api
npm install
npx wrangler deploy
cd ../..
```

### Tenant Provisioning

```bash
# Deploy a new tenant
ts-node scripts/deploy-tenant.ts <tenant-id> <tier> --name "<Tenant Name>"

# Examples:
ts-node scripts/deploy-tenant.ts acme-corp pro --name "Acme Corporation"
ts-node scripts/deploy-tenant.ts startup-xyz free --name "Startup XYZ"
ts-node scripts/deploy-tenant.ts enterprise-abc enterprise --name "Enterprise ABC"
```

### Verification

```bash
# List all deployed tenants
ts-node scripts/list-tenants.ts flarecog

# Test tenant endpoint
curl https://acme-corp.flarecog.ai/api/health

# Expected response:
# {
#   "platform": "FlareCog Cognitive Platform",
#   "tenantId": "acme-corp",
#   "tenantName": "Acme Corporation",
#   "version": "1.0.0",
#   "message": "Tenant cognitive instance is active"
# }
```

## Troubleshooting

### Error: "CLOUDFLARE_API_TOKEN environment variable is required"

**Solution:** Set the environment variable:

```bash
export CLOUDFLARE_API_TOKEN=your_token_here
```

### Error: "Invalid tenant ID format"

**Solution:** Ensure tenant ID:
- Is 3-63 characters long
- Contains only lowercase letters, numbers, and hyphens
- Starts with a letter or number

**Valid:** `acme-corp`, `tenant-001`, `my-tenant`  
**Invalid:** `Acme-Corp`, `te`, `tenant_001`

### Error: "User Worker template not found"

**Solution:** Build the user Worker template:

```bash
cd flarecog-platform/user-worker-template
npm install
npm run build
```

### Error: "Worker not found" when accessing tenant

**Possible Causes:**
1. Tenant not deployed yet
2. DNS not configured
3. Dispatch Worker not deployed

**Solution:**
1. Verify tenant is deployed: `ts-node scripts/list-tenants.ts`
2. Check dispatch Worker is deployed: `npx wrangler deployments list`
3. Configure DNS wildcard record: `*.flarecog.ai` → dispatch Worker

## Advanced Usage

### Custom Bindings

To add custom bindings (e.g., R2 buckets, additional KV namespaces), edit `scripts/deploy-tenant.ts`:

```typescript
const bindings: any[] = [
  // ... existing bindings ...
  
  // Add R2 bucket
  {
    type: "r2_bucket",
    name: "FILES",
    bucket_name: `flarecog-${tenantId}-files`
  },
  
  // Add additional KV namespace
  {
    type: "kv_namespace",
    name: "SESSIONS",
    namespace_id: sessionKvId
  }
];
```

### Batch Deployment

To deploy multiple tenants at once:

```bash
#!/bin/bash
# deploy-batch.sh

tenants=(
  "acme-corp:pro:Acme Corporation"
  "globex-inc:enterprise:Globex Inc"
  "startup-xyz:free:Startup XYZ"
)

for tenant in "${tenants[@]}"; do
  IFS=':' read -r id tier name <<< "$tenant"
  echo "Deploying $id..."
  ts-node scripts/deploy-tenant.ts "$id" "$tier" --name "$name"
done
```

### Programmatic Deployment

Use the deployment functions in your own code:

```typescript
import { deployTenant } from "./scripts/deploy-tenant";

async function provisionTenant(tenantId: string, tier: string) {
  try {
    await deployTenant({
      tenantId,
      tier,
      tenantName: tenantId,
      env: {
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
        CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
      }
    });
    console.log(`Tenant ${tenantId} provisioned successfully`);
  } catch (error) {
    console.error(`Failed to provision tenant ${tenantId}:`, error);
  }
}
```

## Best Practices

1. **Environment Variables:** Always use environment variables for sensitive data (API tokens)
2. **Tenant ID Naming:** Use consistent, descriptive tenant IDs (e.g., company slug)
3. **Tier Selection:** Start with free tier for testing, upgrade as needed
4. **Resource Cleanup:** Delete unused tenant resources to avoid costs
5. **Monitoring:** Track deployment metrics and errors
6. **Backup:** Regularly backup tenant D1 databases
7. **Testing:** Test tenant Workers after deployment
8. **Documentation:** Document custom configurations and bindings

## Cost Optimization

### Free Tier (< 100 tenants)

- **Workers:** $0 (included in Workers free tier)
- **D1:** $0 (5 GB free)
- **KV:** $0 (1 GB free)
- **AI:** $0 (10,000 neurons/day free)

**Estimated Monthly Cost:** $0-5

### Pro Tier (100-1000 tenants)

- **Workers:** $5/month (Workers Paid plan)
- **D1:** $0.75/GB/month
- **KV:** $0.50/GB/month
- **AI:** $0.011/1000 neurons

**Estimated Monthly Cost:** $10-50

### Enterprise Tier (1000+ tenants)

- **Workers:** $5/month (Workers Paid plan)
- **D1:** Volume pricing
- **KV:** Volume pricing
- **AI:** Volume pricing

**Estimated Monthly Cost:** $100-500+

## Security Considerations

1. **API Token Security:** Never commit API tokens to version control
2. **Tenant Isolation:** Each tenant has isolated resources (DB, KV, Worker)
3. **Authentication:** Implement API key or JWT authentication
4. **Rate Limiting:** Enforce tier-based rate limits
5. **Input Validation:** Validate all tenant IDs and configuration
6. **Audit Logging:** Log all deployment operations
7. **Access Control:** Restrict deployment script access to authorized users

## Next Steps

1. **Deploy Platform:** Follow the Initial Platform Setup workflow
2. **Provision Tenants:** Deploy tenant Workers using the scripts
3. **Configure DNS:** Set up wildcard DNS for tenant subdomains
4. **Implement Authentication:** Add API key generation and validation
5. **Monitor Platform:** Set up logging and monitoring
6. **Scale:** Deploy additional tenants as needed

## Support

For issues or questions:
- GitHub Issues: https://github.com/cogpy/cogflare-temp/issues
- Documentation: https://github.com/cogpy/cogflare-temp/docs
- Email: support@flarecog.ai
