/**
 * Rate Limiter
 * 
 * Implements token bucket algorithm for rate limiting tenant requests.
 * Supports per-tenant and per-user rate limits with different tiers.
 */

export interface RateLimitConfig {
	requestsPerMinute: number;
	burstSize: number;
	tier: "free" | "pro" | "enterprise";
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
	retryAfter?: number;
}

export class RateLimiter {
	private readonly env: any;

	constructor(env: any) {
		this.env = env;
	}

	/**
	 * Check if request is within rate limit
	 */
	async checkLimit(
		tenantId: string,
		userId?: string,
	): Promise<RateLimitResult> {
		// Get rate limit configuration for tenant
		const config = await this.getTenantRateLimitConfig(tenantId);

		// Create rate limit key
		const key = userId ? `ratelimit:${tenantId}:${userId}` : `ratelimit:${tenantId}`;

		// Get current bucket state
		const bucketState = await this.getBucketState(key);

		// Calculate tokens to add based on time elapsed
		const now = Date.now();
		const elapsed = now - bucketState.lastRefill;
		const tokensToAdd = Math.floor(
			(elapsed / 60000) * config.requestsPerMinute,
		);

		// Refill bucket
		let tokens = Math.min(
			bucketState.tokens + tokensToAdd,
			config.burstSize,
		);

		// Check if request can be allowed
		if (tokens >= 1) {
			// Allow request and consume token
			tokens -= 1;

			// Update bucket state
			await this.updateBucketState(key, {
				tokens,
				lastRefill: now,
			});

			return {
				allowed: true,
				remaining: tokens,
				resetAt: now + 60000,
			};
		} else {
			// Rate limit exceeded
			const retryAfter = Math.ceil(
				(60000 - elapsed) / 1000,
			);

			return {
				allowed: false,
				remaining: 0,
				resetAt: bucketState.lastRefill + 60000,
				retryAfter,
			};
		}
	}

	/**
	 * Get tenant rate limit configuration
	 */
	private async getTenantRateLimitConfig(
		tenantId: string,
	): Promise<RateLimitConfig> {
		// Try to get tenant-specific config from KV
		const configData = await this.env.TENANT_CONFIG?.get(
			`config:${tenantId}`,
		);

		if (configData) {
			const config = JSON.parse(configData);
			if (config.rateLimit) {
				return config.rateLimit;
			}
		}

		// Default rate limits by tier
		const defaultConfigs: Record<string, RateLimitConfig> = {
			free: {
				requestsPerMinute: 60,
				burstSize: 100,
				tier: "free",
			},
			pro: {
				requestsPerMinute: 600,
				burstSize: 1000,
				tier: "pro",
			},
			enterprise: {
				requestsPerMinute: 6000,
				burstSize: 10000,
				tier: "enterprise",
			},
		};

		// Default to free tier
		return defaultConfigs.free;
	}

	/**
	 * Get current bucket state
	 */
	private async getBucketState(
		key: string,
	): Promise<{ tokens: number; lastRefill: number }> {
		const stateData = await this.env.RATE_LIMITS?.get(key);

		if (stateData) {
			return JSON.parse(stateData);
		}

		// Initialize new bucket
		const config = await this.getTenantRateLimitConfig(
			key.split(":")[1],
		);

		return {
			tokens: config.burstSize,
			lastRefill: Date.now(),
		};
	}

	/**
	 * Update bucket state
	 */
	private async updateBucketState(
		key: string,
		state: { tokens: number; lastRefill: number },
	): Promise<void> {
		// Store in KV with 2-minute expiration
		await this.env.RATE_LIMITS?.put(key, JSON.stringify(state), {
			expirationTtl: 120,
		});
	}

	/**
	 * Reset rate limit for tenant (admin operation)
	 */
	async resetLimit(tenantId: string, userId?: string): Promise<void> {
		const key = userId ? `ratelimit:${tenantId}:${userId}` : `ratelimit:${tenantId}`;
		await this.env.RATE_LIMITS?.delete(key);
	}

	/**
	 * Get rate limit status
	 */
	async getStatus(
		tenantId: string,
		userId?: string,
	): Promise<{
		config: RateLimitConfig;
		current: { tokens: number; lastRefill: number };
	}> {
		const config = await this.getTenantRateLimitConfig(tenantId);
		const key = userId ? `ratelimit:${tenantId}:${userId}` : `ratelimit:${tenantId}`;
		const current = await this.getBucketState(key);

		return { config, current };
	}
}

/**
 * Rate limit response headers
 */
export class RateLimitHeaders {
	/**
	 * Add rate limit headers to response
	 */
	static addHeaders(
		response: Response,
		result: RateLimitResult,
	): Response {
		const headers = new Headers(response.headers);

		headers.set("X-RateLimit-Remaining", result.remaining.toString());
		headers.set("X-RateLimit-Reset", result.resetAt.toString());

		if (!result.allowed && result.retryAfter) {
			headers.set("Retry-After", result.retryAfter.toString());
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	/**
	 * Create rate limit exceeded response
	 */
	static createRateLimitResponse(result: RateLimitResult): Response {
		return new Response(
			JSON.stringify({
				error: "Rate limit exceeded",
				retryAfter: result.retryAfter,
				resetAt: result.resetAt,
			}),
			{
				status: 429,
				headers: {
					"Content-Type": "application/json",
					"X-RateLimit-Remaining": "0",
					"X-RateLimit-Reset": result.resetAt.toString(),
					"Retry-After": (result.retryAfter || 60).toString(),
				},
			},
		);
	}
}
