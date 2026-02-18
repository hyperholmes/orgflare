# Dispatch Namespace Patterns Analysis

**Source:** worker-publisher-template repository

**Date:** November 23, 2025

## Key Patterns Extracted

### 1. **Dispatch Namespace Binding Configuration**

```jsonc
{
	"dispatch_namespaces": [
		{
			"binding": "DISPATCHER",
			"namespace": "my-dispatch-namespace",
			"experimental_remote": true
		}
	]
}
```

**Key Points:**
- `binding`: The variable name used in Worker code to access the namespace
- `namespace`: The dispatch namespace name (must be created first)
- `experimental_remote`: **Critical** - Enables access to production dispatch namespaces

### 2. **Dynamic Worker Dispatch Pattern**

```typescript
// Get worker from dispatch namespace
const worker = env.DISPATCHER.get(workerName);

// Forward request to the worker
return await worker.fetch(request);
```

**Usage:**
- URL path determines which worker to dispatch to: `/{workerName}/...`
- Simple `.get()` method retrieves worker by name
- Direct `.fetch()` call forwards the request

**Error Handling:**
```typescript
try {
	const worker = env.DISPATCHER.get(workerName);
	return await worker.fetch(request);
} catch (e) {
	if (e.message.startsWith("Worker not found")) {
		return new Response(`Worker '${workerName}' not found`, {
			status: 404,
		});
	}
	return new Response("Internal error", { status: 500 });
}
```

### 3. **Programmatic Worker Deployment via CloudFlare SDK**

```typescript
import Cloudflare from "cloudflare";

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
				{ type: "plain_text", name: "MESSAGE", text: "Hello!" },
				{ type: "kv_namespace", name: "KV", namespace_id: "xxx" },
				{ type: "r2_bucket", name: "BUCKET", bucket_name: "my-bucket" },
			],
		},
		files: {
			[`${scriptName}.mjs`]: new File([code], `${scriptName}.mjs`, {
				type: "application/javascript+module",
			}),
		},
	},
);
```

**Key Features:**
- Automatic namespace creation if missing
- Support for multiple binding types (plain_text, kv_namespace, r2_bucket, etc.)
- Module-based worker deployment (.mjs files)
- Metadata-driven configuration

### 4. **Binding Types Support**

```typescript
type Binding =
	| { type: "plain_text"; name: string; text: string }
	| { type: "kv_namespace"; name: string; namespace_id: string }
	| { type: "r2_bucket"; name: string; bucket_name: string }
	| { type: "d1_database"; name: string; database_id: string }
	| { type: "durable_object_namespace"; name: string; class_name: string; script_name: string }
	| { type: "service"; name: string; service: string; environment?: string }
	| { type: "analytics_engine"; name: string; dataset: string };
```

**Common Bindings:**
- **plain_text**: Environment variables
- **kv_namespace**: KV storage
- **r2_bucket**: R2 object storage
- **d1_database**: D1 SQL database
- **durable_object_namespace**: Durable Objects
- **service**: Service bindings (other Workers)
- **analytics_engine**: Analytics Engine datasets

### 5. **Read-Only Mode Pattern**

```typescript
const isReadOnly = env.READONLY === "true" || env.READONLY === true;

if (isReadOnly) {
	return new Response(
		JSON.stringify({ error: "Read-only mode enabled" }),
		{ status: 403 }
	);
}
```

**Use Cases:**
- Demo deployments
- Public examples
- Testing without side effects

### 6. **Self-Service Deployment UI**

The template includes a complete HTML UI for deploying workers:

```typescript
const HTML_UI = ({ isReadOnly }: { isReadOnly: boolean }) => `
<!DOCTYPE html>
<html>
  <head>
    <title>Worker Publisher</title>
    <!-- Inline CSS and JavaScript -->
  </head>
  <body>
    <form id="deployForm">
      <input type="text" id="scriptName" placeholder="my-worker" required>
      <textarea id="code">/* Worker code */</textarea>
      <button type="submit">Deploy Worker</button>
    </form>
  </body>
</html>
`;
```

**Features:**
- Inline CSS and JavaScript (no external dependencies)
- Form-based worker deployment
- Real-time deployment feedback
- Automatic redirect to deployed worker

### 7. **Environment Variable Configuration**

```jsonc
{
	"vars": {
		"CLOUDFLARE_ACCOUNT_ID": "d1fcd8dbbd35aec43e5499200f6baede",
		"READONLY": "true"
	}
}
```

**Secrets (via wrangler secret):**
```bash
npx wrangler secret put CLOUDFLARE_API_TOKEN
```

**Best Practices:**
- Non-sensitive config in `vars`
- Sensitive tokens in secrets
- Account ID can be in `vars` (not sensitive)

### 8. **Module Worker Format**

All deployed workers use ES module format:

```typescript
export default {
	async fetch(request, env, ctx) {
		// Worker logic
		return new Response("Hello!");
	},
};
```

**Key Points:**
- Must use `export default`
- Must have `fetch` handler
- File extension: `.mjs`
- Content-Type: `application/javascript+module`

## Comparison with FlareCog Current Implementation

### Current FlareCog Dispatch Worker

```typescript
// flarecog-platform/dispatch-worker/src/index.ts
const tenantWorker = env.FLARECOG_NAMESPACE.get(tenantId);
return await tenantWorker.fetch(modifiedRequest);
```

**Issues:**
- ✅ Correct dispatch pattern
- ✅ Uses namespace binding
- ❌ Missing programmatic deployment via SDK
- ❌ No self-service UI
- ❌ No read-only mode
- ❌ Limited binding type support

### Proposed Improvements

1. **Add CloudFlare SDK deployment function**
2. **Create self-service tenant provisioning UI**
3. **Add read-only mode for demos**
4. **Support all binding types (D1, DO, KV, R2)**
5. **Add deployment automation scripts**

## Application to FlareCog

### 1. Enhanced Platform API

Add programmatic deployment to `flarecog-platform/platform-api`:

```typescript
import Cloudflare from "cloudflare";

async function deployTenantWorker(opts: {
	tenantId: string;
	tier: string;
	bindings: Binding[];
}) {
	const cf = new Cloudflare({ apiToken: env.CLOUDFLARE_API_TOKEN });

	// Deploy user worker to dispatch namespace
	await cf.workersForPlatforms.dispatch.namespaces.scripts.update(
		"flarecog",
		opts.tenantId,
		{
			account_id: env.CLOUDFLARE_ACCOUNT_ID,
			metadata: {
				main_module: "worker.mjs",
				bindings: opts.bindings,
			},
			files: {
				"worker.mjs": await toFile(
					Buffer.from(USER_WORKER_TEMPLATE),
					"worker.mjs",
					{ type: "application/javascript+module" }
				),
			},
		}
	);
}
```

### 2. Self-Service Provisioning UI

Add to `flarecog-admin`:

```typescript
// src/pages/admin/provision.astro
<form id="provisionForm">
	<input type="text" id="tenantId" placeholder="tenant-001" required />
	<select id="tier">
		<option value="free">Free</option>
		<option value="pro">Pro</option>
		<option value="enterprise">Enterprise</option>
	</select>
	<button type="submit">Provision Tenant</button>
</form>
```

### 3. Deployment Script

Create `scripts/deploy-tenant.ts`:

```typescript
import Cloudflare from "cloudflare";
import { readFileSync } from "fs";

const userWorkerCode = readFileSync("./user-worker-template/dist/worker.mjs", "utf-8");

async function deployTenant(tenantId: string, tier: string) {
	// Deploy to dispatch namespace
	// Create D1 database
	// Create KV namespace
	// Create Durable Object bindings
}
```

### 4. Binding Configuration

Support all CloudFlare binding types:

```typescript
const bindings = [
	// Environment variables
	{ type: "plain_text", name: "TENANT_ID", text: tenantId },
	{ type: "plain_text", name: "TIER", text: tier },

	// D1 Database
	{ type: "d1_database", name: "DB", database_id: dbId },

	// KV Namespace
	{ type: "kv_namespace", name: "CACHE", namespace_id: kvId },

	// Durable Objects
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

	// CloudFlare AI
	{ type: "ai", name: "AI" },
];
```

## Implementation Priority

1. **High Priority:**
   - Add CloudFlare SDK to platform-api
   - Implement programmatic tenant deployment
   - Support D1, KV, and DO bindings

2. **Medium Priority:**
   - Create self-service provisioning UI
   - Add deployment automation scripts
   - Implement read-only mode

3. **Low Priority:**
   - Add R2 bucket support
   - Add Analytics Engine support
   - Create advanced binding configurations

## Benefits

1. **Automated Deployment:** No manual wrangler commands
2. **Self-Service:** Tenants can provision themselves
3. **Consistent Configuration:** Template-based deployment
4. **Scalability:** Deploy thousands of tenants programmatically
5. **Flexibility:** Support all CloudFlare binding types
6. **Maintainability:** Single source of truth for worker code

## Next Steps

1. Update `flarecog-platform/platform-api` with SDK deployment
2. Create `scripts/deploy-tenant.ts` automation script
3. Add self-service UI to `flarecog-admin`
4. Update documentation with new deployment patterns
5. Test with multiple tenant deployments
