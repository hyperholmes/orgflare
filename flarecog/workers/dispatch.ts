/**
 * Dispatch Worker for FlareCog Multi-Tenant Architecture
 * 
 * Routes requests to tenant-specific AtomSpace instances with:
 * - Tenant identification via API key or subdomain
 * - Rate limiting per tenant
 * - Usage tracking for billing
 * - Strong isolation between tenants
 */

import { DurableObjectNamespace } from "@cloudflare/workers-types";

export interface Env {
	// Dispatch namespace for tenant workers
	FLARECOG_TENANTS: DurableObjectNamespace;
	
	// Global resources
	TENANT_DB: D1Database;
	TENANT_CACHE: KVNamespace;
	USAGE_QUEUE: Queue;
	
	// Secrets
	JWT_SECRET: string;
}

interface Tenant {
	id: string;
	name: string;
	apiKey: string;
	subdomain: string;
	plan: "basic" | "pro" | "enterprise";
	quotas: TenantQuotas;
	status: "active" | "suspended" | "deleted";
	createdAt: number;
}

interface TenantQuotas {
	maxAtomSpaces: number;
	maxAtomsPerAtomSpace: number;
	maxRequestsPerDay: number;
	maxStorageGB: number;
	maxConcurrentAgents: number;
	enabledFeatures: string[];
}

interface UsageMetrics {
	tenantId: string;
	timestamp: number;
	requestCount: number;
	storageUsedGB: number;
	computeTimeMs: number;
	agentExecutions: number;
}

/**
 * Extract tenant identifier from request
 */
function getTenantId(request: Request): string | null {
	const url = new URL(request.url);
	
	// Method 1: API Key in Authorization header
	const authHeader = request.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.substring(7); // Return API key
	}
	
	// Method 2: Subdomain routing (e.g., tenant-a.flarecog.com)
	const hostname = url.hostname;
	const parts = hostname.split(".");
	if (parts.length >= 3) {
		return parts[0]; // Return subdomain as tenant ID
	}
	
	// Method 3: Query parameter (for testing)
	const tenantParam = url.searchParams.get("tenant");
	if (tenantParam) {
		return tenantParam;
	}
	
	return null;
}

/**
 * Load tenant information from database or cache
 */
async function loadTenant(tenantId: string, env: Env): Promise<Tenant | null> {
	// Try cache first
	const cached = await env.TENANT_CACHE.get(`tenant:${tenantId}`);
	if (cached) {
		return JSON.parse(cached);
	}
	
	// Load from database
	const result = await env.TENANT_DB
		.prepare("SELECT * FROM tenants WHERE id = ? OR api_key = ? OR subdomain = ?")
		.bind(tenantId, tenantId, tenantId)
		.first<Tenant>();
	
	if (result) {
		// Cache for 5 minutes
		await env.TENANT_CACHE.put(
			`tenant:${tenantId}`,
			JSON.stringify(result),
			{ expirationTtl: 300 }
		);
		return result;
	}
	
	return null;
}

/**
 * Check rate limit for tenant
 */
async function checkRateLimit(tenant: Tenant, env: Env): Promise<boolean> {
	const key = `ratelimit:${tenant.id}:${Math.floor(Date.now() / 86400000)}`;
	const count = await env.TENANT_CACHE.get(key);
	
	if (count) {
		const currentCount = parseInt(count);
		if (currentCount >= tenant.quotas.maxRequestsPerDay) {
			return false; // Rate limit exceeded
		}
		await env.TENANT_CACHE.put(key, String(currentCount + 1), { expirationTtl: 86400 });
	} else {
		await env.TENANT_CACHE.put(key, "1", { expirationTtl: 86400 });
	}
	
	return true;
}

/**
 * Track usage metrics for billing
 */
async function trackUsage(tenant: Tenant, request: Request, responseTime: number, env: Env): Promise<void> {
	const metrics: UsageMetrics = {
		tenantId: tenant.id,
		timestamp: Date.now(),
		requestCount: 1,
		storageUsedGB: 0, // Will be updated by background job
		computeTimeMs: responseTime,
		agentExecutions: 0,
	};
	
	// Send to usage queue for async processing
	await env.USAGE_QUEUE.send(metrics);
}

/**
 * Main dispatch worker handler
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const startTime = Date.now();
		
		// Extract tenant ID
		const tenantId = getTenantId(request);
		if (!tenantId) {
			return new Response(
				JSON.stringify({ error: "Missing tenant identifier" }),
				{ status: 401, headers: { "Content-Type": "application/json" } }
			);
		}
		
		// Load tenant
		const tenant = await loadTenant(tenantId, env);
		if (!tenant) {
			return new Response(
				JSON.stringify({ error: "Invalid tenant" }),
				{ status: 401, headers: { "Content-Type": "application/json" } }
			);
		}
		
		// Check tenant status
		if (tenant.status !== "active") {
			return new Response(
				JSON.stringify({ error: "Tenant account is suspended or deleted" }),
				{ status: 403, headers: { "Content-Type": "application/json" } }
			);
		}
		
		// Check rate limit
		const allowed = await checkRateLimit(tenant, env);
		if (!allowed) {
			return new Response(
				JSON.stringify({ error: "Rate limit exceeded" }),
				{ status: 429, headers: { "Content-Type": "application/json" } }
			);
		}
		
		try {
			// Get tenant-specific worker from dispatch namespace
			const tenantWorker = env.FLARECOG_TENANTS.get(
				env.FLARECOG_TENANTS.idFromName(tenant.id)
			);
			
			// Forward request to tenant worker
			const response = await tenantWorker.fetch(request);
			
			// Track usage
			const responseTime = Date.now() - startTime;
			ctx.waitUntil(trackUsage(tenant, request, responseTime, env));
			
			// Add tenant context to response headers
			const modifiedResponse = new Response(response.body, response);
			modifiedResponse.headers.set("X-Tenant-Id", tenant.id);
			modifiedResponse.headers.set("X-Tenant-Plan", tenant.plan);
			modifiedResponse.headers.set("X-Response-Time", String(responseTime));
			
			return modifiedResponse;
		} catch (error) {
			console.error("Dispatch error:", error);
			return new Response(
				JSON.stringify({ error: "Internal server error" }),
				{ status: 500, headers: { "Content-Type": "application/json" } }
			);
		}
	},
};

/**
 * Tenant Worker (runs in isolated namespace)
 * 
 * This is the actual worker that handles tenant-specific requests
 * and interacts with tenant-specific AtomSpace instances.
 */
export class TenantWorker implements DurableObject {
	private tenantId: string;
	private env: Env;
	
	constructor(state: DurableObjectState, env: Env) {
		this.tenantId = state.id.toString();
		this.env = env;
	}
	
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		
		// Route to appropriate handler
		if (path.startsWith("/atomspace/")) {
			return this.handleAtomSpaceRequest(request);
		} else if (path.startsWith("/agent/")) {
			return this.handleAgentRequest(request);
		} else if (path.startsWith("/workflow/")) {
			return this.handleWorkflowRequest(request);
		} else if (path.startsWith("/query/")) {
			return this.handleQueryRequest(request);
		} else {
			return new Response(
				JSON.stringify({ error: "Unknown endpoint" }),
				{ status: 404, headers: { "Content-Type": "application/json" } }
			);
		}
	}
	
	private async handleAtomSpaceRequest(request: Request): Promise<Response> {
		// Forward to AtomSpace Durable Object
		// Implementation will interact with tenant-specific AtomSpace
		return new Response(JSON.stringify({ message: "AtomSpace request handled" }), {
			headers: { "Content-Type": "application/json" }
		});
	}
	
	private async handleAgentRequest(request: Request): Promise<Response> {
		// Forward to MindAgent
		return new Response(JSON.stringify({ message: "Agent request handled" }), {
			headers: { "Content-Type": "application/json" }
		});
	}
	
	private async handleWorkflowRequest(request: Request): Promise<Response> {
		// Trigger CloudFlare Workflow
		return new Response(JSON.stringify({ message: "Workflow request handled" }), {
			headers: { "Content-Type": "application/json" }
		});
	}
	
	private async handleQueryRequest(request: Request): Promise<Response> {
		// Execute distributed query
		return new Response(JSON.stringify({ message: "Query request handled" }), {
			headers: { "Content-Type": "application/json" }
		});
	}
}
