/**
 * FlareCog Platform Management API
 * 
 * Programmatic tenant provisioning and management using CloudFlare SDK.
 * Provides REST API for creating, updating, and deleting tenant cognitive instances.
 */

import Cloudflare from "cloudflare";
import { toFile } from "cloudflare/index";

export interface Env {
	CLOUDFLARE_API_TOKEN: string;
	CLOUDFLARE_ACCOUNT_ID: string;
	TENANT_CONFIG: KVNamespace;
	ANALYTICS_DB: D1Database;
	ADMIN_API_KEY: string;
}

/**
 * Provision a new tenant
 */
async function provisionTenant(
	opts: {
		tenantId: string;
		tenantName: string;
		tier: "free" | "pro" | "enterprise";
		config?: {
			rateLimit?: {
				requestsPerMinute: number;
				burstSize: number;
			};
		};
	},
	env: Env,
): Promise<{ success: boolean; tenantId: string; error?: string }> {
	const { tenantId, tenantName, tier, config } = opts;

	// Validate tenant ID
	if (!/^[a-z0-9-]{3,63}$/.test(tenantId)) {
		return {
			success: false,
			tenantId,
			error: "Invalid tenant ID format",
		};
	}

	// Check if tenant already exists
	const existingConfig = await env.TENANT_CONFIG.get(`config:${tenantId}`);
	if (existingConfig) {
		return {
			success: false,
			tenantId,
			error: "Tenant already exists",
		};
	}

	try {
		const cf = new Cloudflare({
			apiToken: env.CLOUDFLARE_API_TOKEN,
		});

		// Generate user Worker code
		const userWorkerCode = generateUserWorkerCode(tenantId, tenantName);

		// Deploy user Worker to dispatch namespace
		await cf.workersForPlatforms.dispatch.namespaces.scripts.update(
			"flarecog",
			tenantId,
			{
				account_id: env.CLOUDFLARE_ACCOUNT_ID,
				metadata: {
					main_module: `${tenantId}.mjs`,
					bindings: [
						{ type: "plain_text", name: "TENANT_ID", text: tenantId },
						{ type: "plain_text", name: "TENANT_NAME", text: tenantName },
					],
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

		// Store tenant configuration
		const tenantConfig = {
			tenantId,
			tenantName,
			tier,
			rateLimit: config?.rateLimit || getDefaultRateLimit(tier),
			createdAt: Date.now(),
			status: "active",
		};

		await env.TENANT_CONFIG.put(
			`config:${tenantId}`,
			JSON.stringify(tenantConfig),
		);

		// Log provisioning event
		await env.ANALYTICS_DB.prepare(
			`INSERT INTO tenant_events (tenant_id, event_type, timestamp, data)
			VALUES (?, ?, ?, ?)`,
		)
			.bind(
				tenantId,
				"provisioned",
				Date.now(),
				JSON.stringify({ tier, tenantName }),
			)
			.run();

		return {
			success: true,
			tenantId,
		};
	} catch (error) {
		console.error("Failed to provision tenant:", error);
		return {
			success: false,
			tenantId,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Deprovision a tenant
 */
async function deprovisionTenant(
	tenantId: string,
	env: Env,
): Promise<{ success: boolean; error?: string }> {
	try {
		const cf = new Cloudflare({
			apiToken: env.CLOUDFLARE_API_TOKEN,
		});

		// Delete user Worker from dispatch namespace
		await cf.workersForPlatforms.dispatch.namespaces.scripts.delete(
			"flarecog",
			tenantId,
			{
				account_id: env.CLOUDFLARE_ACCOUNT_ID,
			},
		);

		// Delete tenant configuration
		await env.TENANT_CONFIG.delete(`config:${tenantId}`);

		// Log deprovisioning event
		await env.ANALYTICS_DB.prepare(
			`INSERT INTO tenant_events (tenant_id, event_type, timestamp, data)
			VALUES (?, ?, ?, ?)`,
		)
			.bind(tenantId, "deprovisioned", Date.now(), JSON.stringify({}))
			.run();

		return {
			success: true,
		};
	} catch (error) {
		console.error("Failed to deprovision tenant:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * List all tenants
 */
async function listTenants(
	env: Env,
): Promise<Array<{ tenantId: string; tenantName: string; tier: string; createdAt: number }>> {
	const tenants: Array<any> = [];

	// List all tenant configs from KV
	const list = await env.TENANT_CONFIG.list({ prefix: "config:" });

	for (const key of list.keys) {
		const configData = await env.TENANT_CONFIG.get(key.name);
		if (configData) {
			const config = JSON.parse(configData);
			tenants.push({
				tenantId: config.tenantId,
				tenantName: config.tenantName,
				tier: config.tier,
				createdAt: config.createdAt,
			});
		}
	}

	return tenants;
}

/**
 * Get tenant configuration
 */
async function getTenantConfig(
	tenantId: string,
	env: Env,
): Promise<any | null> {
	const configData = await env.TENANT_CONFIG.get(`config:${tenantId}`);
	if (!configData) {
		return null;
	}
	return JSON.parse(configData);
}

/**
 * Update tenant configuration
 */
async function updateTenantConfig(
	tenantId: string,
	updates: Partial<{
		tenantName: string;
		tier: "free" | "pro" | "enterprise";
		rateLimit: { requestsPerMinute: number; burstSize: number };
	}>,
	env: Env,
): Promise<{ success: boolean; error?: string }> {
	const config = await getTenantConfig(tenantId, env);
	if (!config) {
		return {
			success: false,
			error: "Tenant not found",
		};
	}

	// Update configuration
	const updatedConfig = {
		...config,
		...updates,
		updatedAt: Date.now(),
	};

	await env.TENANT_CONFIG.put(
		`config:${tenantId}`,
		JSON.stringify(updatedConfig),
	);

	// Log update event
	await env.ANALYTICS_DB.prepare(
		`INSERT INTO tenant_events (tenant_id, event_type, timestamp, data)
		VALUES (?, ?, ?, ?)`,
	)
		.bind(tenantId, "updated", Date.now(), JSON.stringify(updates))
		.run();

	return {
		success: true,
	};
}

/**
 * Generate user Worker code
 */
function generateUserWorkerCode(tenantId: string, tenantName: string): string {
	// In production, this would load the actual user Worker template
	// For now, we'll generate a simple placeholder
	return `
export default {
	async fetch(request, env, ctx) {
		const tenantId = env.TENANT_ID || "${tenantId}";
		const tenantName = env.TENANT_NAME || "${tenantName}";
		
		return new Response(JSON.stringify({
			platform: "FlareCog Cognitive Platform",
			tenantId,
			tenantName,
			version: "1.0.0",
			message: "Tenant cognitive instance is active",
			endpoints: {
				atomspace: "/atomspace/*",
				mindagent: "/mindagent/*",
				reasoning: "/reasoning/*",
				cognitive: "/cognitive/*",
				dashboard: "/api/dashboard",
				health: "/api/health"
			}
		}), {
			headers: { "Content-Type": "application/json" }
		});
	}
};
`;
}

/**
 * Get default rate limit for tier
 */
function getDefaultRateLimit(tier: "free" | "pro" | "enterprise"): {
	requestsPerMinute: number;
	burstSize: number;
} {
	const limits = {
		free: { requestsPerMinute: 60, burstSize: 100 },
		pro: { requestsPerMinute: 600, burstSize: 1000 },
		enterprise: { requestsPerMinute: 6000, burstSize: 10000 },
	};
	return limits[tier];
}

/**
 * Authenticate admin request
 */
function authenticateAdmin(request: Request, env: Env): boolean {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return false;
	}

	const apiKey = authHeader.substring(7);
	return apiKey === env.ADMIN_API_KEY;
}

/**
 * Main request handler
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Authenticate admin request
		if (!authenticateAdmin(request, env)) {
			return new Response(
				JSON.stringify({
					error: "Unauthorized",
					message: "Invalid or missing admin API key",
				}),
				{
					status: 401,
					headers: {
						"Content-Type": "application/json",
						"WWW-Authenticate": "Bearer",
					},
				},
			);
		}

		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		try {
			// POST /tenants - Create new tenant
			if (path === "/tenants" && method === "POST") {
				const body = await request.json();
				const result = await provisionTenant(body, env);

				return new Response(JSON.stringify(result), {
					status: result.success ? 201 : 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// GET /tenants - List all tenants
			if (path === "/tenants" && method === "GET") {
				const tenants = await listTenants(env);

				return new Response(
					JSON.stringify({
						success: true,
						count: tenants.length,
						tenants,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// GET /tenants/:tenantId - Get tenant configuration
			const getTenantMatch = path.match(/^\/tenants\/([a-z0-9-]+)$/);
			if (getTenantMatch && method === "GET") {
				const tenantId = getTenantMatch[1];
				const config = await getTenantConfig(tenantId, env);

				if (!config) {
					return new Response(
						JSON.stringify({
							success: false,
							error: "Tenant not found",
						}),
						{
							status: 404,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				return new Response(
					JSON.stringify({
						success: true,
						tenant: config,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// PATCH /tenants/:tenantId - Update tenant configuration
			const updateTenantMatch = path.match(/^\/tenants\/([a-z0-9-]+)$/);
			if (updateTenantMatch && method === "PATCH") {
				const tenantId = updateTenantMatch[1];
				const updates = await request.json();
				const result = await updateTenantConfig(tenantId, updates, env);

				return new Response(JSON.stringify(result), {
					status: result.success ? 200 : 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// DELETE /tenants/:tenantId - Deprovision tenant
			const deleteTenantMatch = path.match(/^\/tenants\/([a-z0-9-]+)$/);
			if (deleteTenantMatch && method === "DELETE") {
				const tenantId = deleteTenantMatch[1];
				const result = await deprovisionTenant(tenantId, env);

				return new Response(JSON.stringify(result), {
					status: result.success ? 200 : 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// GET /health - Health check
			if (path === "/health" && method === "GET") {
				return new Response(
					JSON.stringify({
						status: "healthy",
						service: "FlareCog Platform API",
						timestamp: Date.now(),
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// 404 - Not found
			return new Response(
				JSON.stringify({
					error: "Not Found",
					message: "The requested endpoint does not exist",
				}),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			console.error("Platform API error:", error);

			return new Response(
				JSON.stringify({
					error: "Internal Server Error",
					message: error instanceof Error ? error.message : "Unknown error",
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	},
};
