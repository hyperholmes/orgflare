/**
 * Tenant Resolver
 * 
 * Identifies which tenant a request belongs to based on various strategies:
 * - Subdomain extraction (primary method)
 * - Path-based routing (fallback)
 * - Header-based routing (for API clients)
 */

export interface TenantResolution {
	tenantId: string | null;
	strategy: "subdomain" | "path" | "header" | "none";
	confidence: "high" | "medium" | "low";
}

export class TenantResolver {
	private readonly baseDomain: string;

	constructor(baseDomain: string = "flarecog.ai") {
		this.baseDomain = baseDomain;
	}

	/**
	 * Resolve tenant from incoming request
	 */
	resolve(request: Request): TenantResolution {
		const url = new URL(request.url);

		// Strategy 1: Subdomain-based (highest confidence)
		const subdomainTenant = this.extractFromSubdomain(url.hostname);
		if (subdomainTenant) {
			return {
				tenantId: subdomainTenant,
				strategy: "subdomain",
				confidence: "high",
			};
		}

		// Strategy 2: Header-based (medium confidence, for API clients)
		const headerTenant = this.extractFromHeader(request);
		if (headerTenant) {
			return {
				tenantId: headerTenant,
				strategy: "header",
				confidence: "medium",
			};
		}

		// Strategy 3: Path-based (low confidence, fallback)
		const pathTenant = this.extractFromPath(url.pathname);
		if (pathTenant) {
			return {
				tenantId: pathTenant,
				strategy: "path",
				confidence: "low",
			};
		}

		// No tenant identified
		return {
			tenantId: null,
			strategy: "none",
			confidence: "low",
		};
	}

	/**
	 * Extract tenant from subdomain
	 * 
	 * Examples:
	 * - acme.flarecog.ai → "acme"
	 * - corp.flarecog.ai → "corp"
	 * - flarecog.ai → null (no subdomain)
	 * - www.flarecog.ai → null (www is not a tenant)
	 */
	private extractFromSubdomain(hostname: string): string | null {
		// Remove base domain
		const subdomain = hostname.replace(`.${this.baseDomain}`, "");

		// If no subdomain or just www, return null
		if (subdomain === hostname || subdomain === "www" || subdomain === "") {
			return null;
		}

		// Validate subdomain format (alphanumeric and hyphens only)
		if (!/^[a-z0-9-]+$/.test(subdomain)) {
			return null;
		}

		return subdomain;
	}

	/**
	 * Extract tenant from request header
	 * 
	 * Looks for X-Tenant-ID header
	 */
	private extractFromHeader(request: Request): string | null {
		const tenantId = request.headers.get("X-Tenant-ID");

		if (!tenantId) {
			return null;
		}

		// Validate tenant ID format
		if (!/^[a-z0-9-]+$/.test(tenantId)) {
			return null;
		}

		return tenantId;
	}

	/**
	 * Extract tenant from URL path
	 * 
	 * Examples:
	 * - /tenants/acme/... → "acme"
	 * - /t/corp/... → "corp"
	 */
	private extractFromPath(pathname: string): string | null {
		// Match /tenants/{tenantId}/...
		const tenantsMatch = pathname.match(/^\/tenants\/([a-z0-9-]+)/);
		if (tenantsMatch) {
			return tenantsMatch[1];
		}

		// Match /t/{tenantId}/...
		const shortMatch = pathname.match(/^\/t\/([a-z0-9-]+)/);
		if (shortMatch) {
			return shortMatch[1];
		}

		return null;
	}

	/**
	 * Validate tenant ID format
	 */
	static isValidTenantId(tenantId: string): boolean {
		// Must be lowercase alphanumeric with hyphens
		// Length between 3 and 63 characters (DNS subdomain limits)
		return /^[a-z0-9-]{3,63}$/.test(tenantId);
	}

	/**
	 * Normalize tenant ID to valid format
	 */
	static normalizeTenantId(input: string): string {
		return input
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
			.substring(0, 63);
	}
}
