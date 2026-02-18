#!/usr/bin/env ts-node
/**
 * FlareCog Tenant Deployment Script
 * 
 * Automates the deployment of a new tenant cognitive instance to the FlareCog platform.
 * Creates all necessary resources: Worker, D1 database, KV namespace, and Durable Object bindings.
 * 
 * Usage:
 *   ts-node scripts/deploy-tenant.ts <tenant-id> <tier> [options]
 * 
 * Example:
 *   ts-node scripts/deploy-tenant.ts acme-corp pro --name "Acme Corporation"
 */

import Cloudflare from "cloudflare";
import { toFile } from "cloudflare/index";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Configuration
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const DISPATCH_NAMESPACE = process.env.DISPATCH_NAMESPACE || "flarecog";

if (!API_TOKEN) {
	console.error("Error: CLOUDFLARE_API_TOKEN environment variable is required");
	process.exit(1);
}

if (!ACCOUNT_ID) {
	console.error("Error: CLOUDFLARE_ACCOUNT_ID environment variable is required");
	process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
	console.error("Usage: deploy-tenant <tenant-id> <tier> [--name <name>]");
	console.error("Tiers: free, pro, enterprise");
	process.exit(1);
}

const tenantId = args[0];
const tier = args[1] as "free" | "pro" | "enterprise";
const nameIndex = args.indexOf("--name");
const tenantName = nameIndex !== -1 ? args[nameIndex + 1] : tenantId;

// Validate tenant ID
if (!/^[a-z0-9-]{3,63}$/.test(tenantId)) {
	console.error(
		"Error: Invalid tenant ID. Must be 3-63 characters, lowercase letters, numbers, and hyphens only.",
	);
	process.exit(1);
}

// Validate tier
if (!["free", "pro", "enterprise"].includes(tier)) {
	console.error("Error: Invalid tier. Must be one of: free, pro, enterprise");
	process.exit(1);
}

// Initialize CloudFlare SDK
const cf = new Cloudflare({ apiToken: API_TOKEN });

/**
 * Load user Worker template
 */
function loadUserWorkerTemplate(): string {
	const templatePath = join(
		__dirname,
		"../flarecog-platform/user-worker-template/dist/worker.mjs",
	);

	if (!existsSync(templatePath)) {
		console.error(
			`Error: User Worker template not found at ${templatePath}`,
		);
		console.error("Please build the user Worker template first:");
		console.error(
			"  cd flarecog-platform/user-worker-template && npm run build",
		);
		process.exit(1);
	}

	return readFileSync(templatePath, "utf-8");
}

/**
 * Get tier configuration
 */
function getTierConfig(tier: "free" | "pro" | "enterprise") {
	const configs = {
		free: {
			rateLimit: { requestsPerMinute: 60, burstSize: 100 },
			limits: {
				atoms: 1000,
				inferences: 100,
				aiCalls: 100,
			},
		},
		pro: {
			rateLimit: { requestsPerMinute: 600, burstSize: 1000 },
			limits: {
				atoms: 100000,
				inferences: 10000,
				aiCalls: 10000,
			},
		},
		enterprise: {
			rateLimit: { requestsPerMinute: 6000, burstSize: 10000 },
			limits: {
				atoms: -1, // unlimited
				inferences: -1, // unlimited
				aiCalls: -1, // unlimited
			},
		},
	};

	return configs[tier];
}

/**
 * Create D1 database for tenant
 */
async function createD1Database(
	tenantId: string,
): Promise<{ id: string; name: string }> {
	console.log(`Creating D1 database for tenant ${tenantId}...`);

	try {
		const database = await cf.d1.databases.create({
			account_id: ACCOUNT_ID,
			name: `flarecog_${tenantId}`,
		});

		console.log(`✓ D1 database created: ${database.uuid}`);

		return {
			id: database.uuid,
			name: database.name,
		};
	} catch (error) {
		console.error("Failed to create D1 database:", error);
		throw error;
	}
}

/**
 * Create KV namespace for tenant
 */
async function createKVNamespace(
	tenantId: string,
): Promise<{ id: string; title: string }> {
	console.log(`Creating KV namespace for tenant ${tenantId}...`);

	try {
		const namespace = await cf.kv.namespaces.create({
			account_id: ACCOUNT_ID,
			title: `flarecog_${tenantId}_cache`,
		});

		console.log(`✓ KV namespace created: ${namespace.id}`);

		return {
			id: namespace.id,
			title: namespace.title,
		};
	} catch (error) {
		console.error("Failed to create KV namespace:", error);
		throw error;
	}
}

/**
 * Ensure dispatch namespace exists
 */
async function ensureDispatchNamespace(namespaceName: string): Promise<void> {
	console.log(`Ensuring dispatch namespace '${namespaceName}' exists...`);

	try {
		await cf.workersForPlatforms.dispatch.namespaces.get(namespaceName, {
			account_id: ACCOUNT_ID,
		});
		console.log(`✓ Dispatch namespace '${namespaceName}' exists`);
	} catch {
		console.log(
			`Creating dispatch namespace '${namespaceName}'...`,
		);
		await cf.workersForPlatforms.dispatch.namespaces.create({
			account_id: ACCOUNT_ID,
			name: namespaceName,
		});
		console.log(`✓ Dispatch namespace '${namespaceName}' created`);
	}
}

/**
 * Deploy user Worker to dispatch namespace
 */
async function deployUserWorker(
	tenantId: string,
	tenantName: string,
	tier: string,
	dbId: string,
	kvId: string,
): Promise<void> {
	console.log(`Deploying user Worker for tenant ${tenantId}...`);

	const userWorkerCode = loadUserWorkerTemplate();
	const tierConfig = getTierConfig(tier as "free" | "pro" | "enterprise");

	// Prepare bindings
	const bindings: any[] = [
		// Environment variables
		{ type: "plain_text", name: "TENANT_ID", text: tenantId },
		{ type: "plain_text", name: "TENANT_NAME", text: tenantName },
		{ type: "plain_text", name: "TIER", text: tier },
		{
			type: "plain_text",
			name: "RATE_LIMIT_RPM",
			text: String(tierConfig.rateLimit.requestsPerMinute),
		},
		{
			type: "plain_text",
			name: "RATE_LIMIT_BURST",
			text: String(tierConfig.rateLimit.burstSize),
		},

		// D1 Database
		{ type: "d1_database", name: "DB", database_id: dbId },

		// KV Namespace
		{ type: "kv_namespace", name: "ATOM_CACHE", namespace_id: kvId },

		// CloudFlare AI
		{ type: "ai", name: "AI" },

		// Durable Objects (reference to main flarecog Worker)
		// Note: These need to be configured after the main Worker is deployed
		// {
		//   type: "durable_object_namespace",
		//   name: "ATOMSPACE",
		//   class_name: "AtomSpace",
		//   script_name: "flarecog-user-worker"
		// },
		// {
		//   type: "durable_object_namespace",
		//   name: "MIND_AGENT",
		//   class_name: "MindAgent",
		//   script_name: "flarecog-user-worker"
		// }
	];

	try {
		await cf.workersForPlatforms.dispatch.namespaces.scripts.update(
			DISPATCH_NAMESPACE,
			tenantId,
			{
				account_id: ACCOUNT_ID,
				metadata: {
					main_module: `${tenantId}.mjs`,
					bindings,
				},
				files: {
					[`${tenantId}.mjs`]: await toFile(
						Buffer.from(userWorkerCode),
						`${tenantId}.mjs`,
						{
							type: "application/javascript+module",
						},
					),
				},
			},
		);

		console.log(`✓ User Worker deployed to dispatch namespace`);
	} catch (error) {
		console.error("Failed to deploy user Worker:", error);
		throw error;
	}
}

/**
 * Main deployment function
 */
async function deployTenant() {
	console.log("\n=== FlareCog Tenant Deployment ===\n");
	console.log(`Tenant ID: ${tenantId}`);
	console.log(`Tenant Name: ${tenantName}`);
	console.log(`Tier: ${tier}`);
	console.log(`Dispatch Namespace: ${DISPATCH_NAMESPACE}\n`);

	try {
		// Step 1: Ensure dispatch namespace exists
		await ensureDispatchNamespace(DISPATCH_NAMESPACE);

		// Step 2: Create D1 database
		const db = await createD1Database(tenantId);

		// Step 3: Create KV namespace
		const kv = await createKVNamespace(tenantId);

		// Step 4: Deploy user Worker
		await deployUserWorker(tenantId, tenantName, tier, db.id, kv.id);

		// Success!
		console.log("\n=== Deployment Complete ===\n");
		console.log("Tenant Resources:");
		console.log(`  - Tenant ID: ${tenantId}`);
		console.log(`  - D1 Database: ${db.id} (${db.name})`);
		console.log(`  - KV Namespace: ${kv.id} (${kv.title})`);
		console.log(
			`  - Worker: ${DISPATCH_NAMESPACE}/${tenantId}`,
		);
		console.log("\nNext Steps:");
		console.log(
			"  1. Configure DNS for tenant subdomain (if using subdomain routing)",
		);
		console.log("  2. Generate API key for tenant authentication");
		console.log("  3. Test tenant Worker endpoint");
		console.log(
			`  4. Access tenant at: https://${tenantId}.flarecog.ai (after DNS configuration)`,
		);
	} catch (error) {
		console.error("\n=== Deployment Failed ===\n");
		console.error(error);
		process.exit(1);
	}
}

// Run deployment
deployTenant();
