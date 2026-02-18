#!/usr/bin/env ts-node
/**
 * List Tenants Script
 * 
 * Lists all deployed tenant Workers in the FlareCog dispatch namespace.
 * 
 * Usage:
 *   ts-node scripts/list-tenants.ts [namespace-name]
 * 
 * Example:
 *   ts-node scripts/list-tenants.ts flarecog
 */

import Cloudflare from "cloudflare";

// Configuration
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

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
const namespaceName = args[0] || "flarecog";

// Initialize CloudFlare SDK
const cf = new Cloudflare({ apiToken: API_TOKEN });

/**
 * List all tenant Workers
 */
async function listTenants() {
	console.log("\n=== FlareCog Tenant Workers ===\n");
	console.log(`Namespace: ${namespaceName}`);
	console.log(`Account ID: ${ACCOUNT_ID}\n`);

	try {
		// Get namespace info
		const namespace = await cf.workersForPlatforms.dispatch.namespaces.get(
			namespaceName,
			{
				account_id: ACCOUNT_ID,
			},
		);

		console.log(`Namespace ID: ${namespace.namespace_id}`);
		console.log(`Created: ${namespace.created_on}`);
		console.log(`Modified: ${namespace.modified_on}\n`);

		// List all scripts in namespace
		console.log("Deployed Tenant Workers:\n");

		const scripts = await cf.workersForPlatforms.dispatch.namespaces.scripts.list(
			namespaceName,
			{
				account_id: ACCOUNT_ID,
			},
		);

		if (!scripts || scripts.length === 0) {
			console.log("  No tenant Workers deployed yet.");
			console.log("\n  Deploy your first tenant:");
			console.log("    ts-node scripts/deploy-tenant.ts <tenant-id> <tier>");
			return;
		}

		// Display tenant Workers
		for (const script of scripts) {
			console.log(`  • ${script.id}`);
			console.log(`    Created: ${script.created_on}`);
			console.log(`    Modified: ${script.modified_on}`);
			console.log(`    URL: https://${script.id}.flarecog.ai (after DNS config)`);
			console.log();
		}

		console.log(`Total: ${scripts.length} tenant Worker(s)\n`);
	} catch (error) {
		console.error("\n=== Failed to List Tenants ===\n");
		console.error(error);
		process.exit(1);
	}
}

// Run listing
listTenants();
