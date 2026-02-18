#!/usr/bin/env ts-node
/**
 * Create Dispatch Namespace Script
 * 
 * Creates a Workers for Platforms dispatch namespace for FlareCog.
 * This namespace will host all tenant user Workers.
 * 
 * Usage:
 *   ts-node scripts/create-dispatch-namespace.ts [namespace-name]
 * 
 * Example:
 *   ts-node scripts/create-dispatch-namespace.ts flarecog
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

// Validate namespace name
if (!/^[a-z0-9-]{1,63}$/.test(namespaceName)) {
	console.error(
		"Error: Invalid namespace name. Must be 1-63 characters, lowercase letters, numbers, and hyphens only.",
	);
	process.exit(1);
}

// Initialize CloudFlare SDK
const cf = new Cloudflare({ apiToken: API_TOKEN });

/**
 * Create dispatch namespace
 */
async function createDispatchNamespace() {
	console.log("\n=== Creating Dispatch Namespace ===\n");
	console.log(`Namespace Name: ${namespaceName}`);
	console.log(`Account ID: ${ACCOUNT_ID}\n`);

	try {
		// Check if namespace already exists
		try {
			const existing = await cf.workersForPlatforms.dispatch.namespaces.get(
				namespaceName,
				{
					account_id: ACCOUNT_ID,
				},
			);

			console.log(`✓ Dispatch namespace '${namespaceName}' already exists`);
			console.log(`  Namespace ID: ${existing.namespace_id}`);
			console.log(`  Namespace Name: ${existing.namespace_name}`);
			console.log(`  Created: ${existing.created_on}`);
			console.log(`  Modified: ${existing.modified_on}`);

			console.log("\nNamespace is ready to use!");
			return;
		} catch (error) {
			// Namespace doesn't exist, create it
			console.log(`Creating dispatch namespace '${namespaceName}'...`);
		}

		// Create namespace
		const namespace = await cf.workersForPlatforms.dispatch.namespaces.create({
			account_id: ACCOUNT_ID,
			name: namespaceName,
		});

		console.log(`✓ Dispatch namespace '${namespaceName}' created successfully`);
		console.log(`  Namespace ID: ${namespace.namespace_id}`);
		console.log(`  Namespace Name: ${namespace.namespace_name}`);
		console.log(`  Created: ${namespace.created_on}`);

		console.log("\n=== Next Steps ===\n");
		console.log("1. Update wrangler.jsonc in dispatch Worker:");
		console.log(`   "dispatch_namespaces": [`);
		console.log(`     {`);
		console.log(`       "binding": "FLARECOG_NAMESPACE",`);
		console.log(`       "namespace": "${namespaceName}",`);
		console.log(`       "experimental_remote": true`);
		console.log(`     }`);
		console.log(`   ]`);
		console.log("\n2. Deploy dispatch Worker:");
		console.log(`   cd flarecog-platform/dispatch-worker`);
		console.log(`   npx wrangler deploy`);
		console.log("\n3. Deploy tenant Workers:");
		console.log(`   ts-node scripts/deploy-tenant.ts <tenant-id> <tier>`);
	} catch (error) {
		console.error("\n=== Creation Failed ===\n");
		console.error(error);
		process.exit(1);
	}
}

// Run creation
createDispatchNamespace();
