/**
 * FlareCog Dispatch Worker
 * 
 * Dynamic dispatch Worker for multi-tenant FlareCog platform.
 * Routes requests to tenant-specific user Workers with authentication,
 * rate limiting, and analytics tracking.
 */

import { TenantResolver } from "./tenant-resolver";
import { Authenticator, Authorizer, AuthResult } from "./auth";
import { RateLimiter, RateLimitHeaders } from "./rate-limiter";
import { AnalyticsTracker } from "./analytics";

export interface Env {
	// Dispatch namespace binding
	FLARECOG_NAMESPACE: DurableObjectNamespace;

	// KV namespaces
	TENANT_CONFIG: KVNamespace;
	RATE_LIMITS: KVNamespace;

	// D1 database
	ANALYTICS_DB: D1Database;

	// Environment variables
	PLATFORM_NAME?: string;
	BASE_DOMAIN?: string;
	DEFAULT_RATE_LIMIT?: string;
	REQUIRE_AUTH?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const startTime = Date.now();

		try {
			// 1. Resolve tenant from request
			const tenantResolver = new TenantResolver(env.BASE_DOMAIN || "flarecog.ai");
			const resolution = tenantResolver.resolve(request);

			if (!resolution.tenantId) {
				return new Response(
					JSON.stringify({
						error: "Tenant not found",
						message: "Unable to identify tenant from request. Please use a valid subdomain or tenant identifier.",
					}),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			const tenantId = resolution.tenantId;

			// 2. Authenticate request
			const authenticator = new Authenticator({
				method: "api-key",
				requireAuth: env.REQUIRE_AUTH !== "false",
			});

			const authResult = await authenticator.authenticate(request, tenantId, env);

			if (!authResult.success) {
				return new Response(
					JSON.stringify({
						error: "Unauthorized",
						message: authResult.error || "Authentication failed",
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

			// 3. Authorize request
			const operation = Authorizer.getOperationFromRequest(request);
			const authorized = Authorizer.authorize(authResult, operation);

			if (!authorized) {
				return new Response(
					JSON.stringify({
						error: "Forbidden",
						message: `Insufficient permissions for ${operation} operation`,
					}),
					{
						status: 403,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// 4. Check rate limits
			const rateLimiter = new RateLimiter(env);
			const rateLimitResult = await rateLimiter.checkLimit(
				tenantId,
				authResult.userId,
			);

			if (!rateLimitResult.allowed) {
				return RateLimitHeaders.createRateLimitResponse(rateLimitResult);
			}

			// 5. Get user Worker for tenant from dispatch namespace
			const userWorker = env.FLARECOG_NAMESPACE.get(tenantId);

			// 6. Prepare request with tenant context
			const modifiedRequest = new Request(request.url, {
				method: request.method,
				headers: new Headers(request.headers),
				body: request.body,
			});

			// Add tenant and user context headers
			modifiedRequest.headers.set("X-Tenant-ID", tenantId);
			modifiedRequest.headers.set("X-User-ID", authResult.userId || "anonymous");
			modifiedRequest.headers.set("X-Tenant-Resolution-Strategy", resolution.strategy);

			// Add permissions for downstream authorization
			if (authResult.permissions) {
				modifiedRequest.headers.set(
					"X-User-Permissions",
					authResult.permissions.join(","),
				);
			}

			// 7. Forward request to user Worker
			let response: Response;
			try {
				response = await userWorker.fetch(modifiedRequest);
			} catch (error) {
				console.error(`Error forwarding to user Worker for tenant ${tenantId}:`, error);
				
				// Check if worker not found in dispatch namespace
				if (error instanceof Error && error.message.startsWith("Worker not found")) {
					return new Response(
						JSON.stringify({
							error: "Tenant Not Found",
							message: `No cognitive instance found for tenant '${tenantId}'. Please provision the tenant first.`,
							tenantId: tenantId,
						}),
						{
							status: 404,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				
				// Other errors (service unavailable)
				return new Response(
					JSON.stringify({
						error: "Service Unavailable",
						message: "Tenant cognitive system is temporarily unavailable",
						details: error instanceof Error ? error.message : "Unknown error",
					}),
					{
						status: 503,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// 8. Add rate limit headers to response
			response = RateLimitHeaders.addHeaders(response, rateLimitResult);

			// 9. Track analytics (async, don't block response)
			ctx.waitUntil(
				(async () => {
					try {
						const analytics = new AnalyticsTracker(env);
						await analytics.trackRequest(
							tenantId,
							request,
							response,
							startTime,
							authResult.userId,
						);
					} catch (error) {
						console.error("Failed to track analytics:", error);
					}
				})(),
			);

			return response;
		} catch (error) {
			console.error("Dispatch Worker error:", error);

			return new Response(
				JSON.stringify({
					error: "Internal Server Error",
					message: "An unexpected error occurred",
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	},
};

/**
 * Health check endpoint for monitoring
 */
export async function handleHealthCheck(env: Env): Promise<Response> {
	const health = {
		status: "healthy",
		platform: env.PLATFORM_NAME || "FlareCog",
		timestamp: Date.now(),
		services: {
			dispatchNamespace: "operational",
			tenantConfig: env.TENANT_CONFIG ? "operational" : "unavailable",
			rateLimits: env.RATE_LIMITS ? "operational" : "unavailable",
			analytics: env.ANALYTICS_DB ? "operational" : "unavailable",
		},
	};

	return new Response(JSON.stringify(health), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}
