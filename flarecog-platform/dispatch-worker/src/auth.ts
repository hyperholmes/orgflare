/**
 * Authentication & Authorization
 * 
 * Handles authentication and authorization for tenant requests.
 * Supports multiple authentication methods:
 * - API Key authentication
 * - JWT token authentication
 * - Basic authentication (for development)
 */

export interface AuthResult {
	success: boolean;
	userId?: string;
	tenantId?: string;
	permissions?: string[];
	error?: string;
}

export interface AuthConfig {
	method: "api-key" | "jwt" | "basic" | "none";
	requireAuth: boolean;
}

export class Authenticator {
	private readonly config: AuthConfig;

	constructor(config: AuthConfig = { method: "api-key", requireAuth: true }) {
		this.config = config;
	}

	/**
	 * Authenticate incoming request
	 */
	async authenticate(
		request: Request,
		tenantId: string,
		env: any,
	): Promise<AuthResult> {
		// If auth is not required, allow all requests
		if (!this.config.requireAuth) {
			return {
				success: true,
				userId: "anonymous",
				tenantId,
				permissions: ["read", "write"],
			};
		}

		// Route to appropriate authentication method
		switch (this.config.method) {
			case "api-key":
				return this.authenticateApiKey(request, tenantId, env);
			case "jwt":
				return this.authenticateJWT(request, tenantId, env);
			case "basic":
				return this.authenticateBasic(request, tenantId, env);
			case "none":
				return {
					success: true,
					userId: "anonymous",
					tenantId,
					permissions: ["read", "write"],
				};
			default:
				return {
					success: false,
					error: "Unknown authentication method",
				};
		}
	}

	/**
	 * Authenticate using API key
	 * 
	 * Expects: Authorization: Bearer <api_key>
	 */
	private async authenticateApiKey(
		request: Request,
		tenantId: string,
		env: any,
	): Promise<AuthResult> {
		const authHeader = request.headers.get("Authorization");

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return {
				success: false,
				error: "Missing or invalid Authorization header",
			};
		}

		const apiKey = authHeader.substring(7); // Remove "Bearer "

		// Validate API key format
		if (!apiKey || apiKey.length < 32) {
			return {
				success: false,
				error: "Invalid API key format",
			};
		}

		// Look up API key in KV store
		const keyData = await env.TENANT_CONFIG?.get(`apikey:${apiKey}`);

		if (!keyData) {
			return {
				success: false,
				error: "Invalid API key",
			};
		}

		const keyInfo = JSON.parse(keyData);

		// Verify API key belongs to the requested tenant
		if (keyInfo.tenantId !== tenantId) {
			return {
				success: false,
				error: "API key does not match tenant",
			};
		}

		// Check if API key is expired
		if (keyInfo.expiresAt && Date.now() > keyInfo.expiresAt) {
			return {
				success: false,
				error: "API key expired",
			};
		}

		// Check if API key is revoked
		if (keyInfo.revoked) {
			return {
				success: false,
				error: "API key revoked",
			};
		}

		return {
			success: true,
			userId: keyInfo.userId,
			tenantId: keyInfo.tenantId,
			permissions: keyInfo.permissions || ["read", "write"],
		};
	}

	/**
	 * Authenticate using JWT token
	 * 
	 * Expects: Authorization: Bearer <jwt_token>
	 */
	private async authenticateJWT(
		request: Request,
		tenantId: string,
		env: any,
	): Promise<AuthResult> {
		const authHeader = request.headers.get("Authorization");

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return {
				success: false,
				error: "Missing or invalid Authorization header",
			};
		}

		const token = authHeader.substring(7);

		try {
			// Verify JWT signature and decode payload
			const payload = await this.verifyJWT(token, env);

			// Verify tenant ID matches
			if (payload.tenantId !== tenantId) {
				return {
					success: false,
					error: "Token tenant does not match requested tenant",
				};
			}

			// Check token expiration
			if (payload.exp && Date.now() / 1000 > payload.exp) {
				return {
					success: false,
					error: "Token expired",
				};
			}

			return {
				success: true,
				userId: payload.sub,
				tenantId: payload.tenantId,
				permissions: payload.permissions || ["read", "write"],
			};
		} catch (error) {
			return {
				success: false,
				error: `JWT verification failed: ${error}`,
			};
		}
	}

	/**
	 * Authenticate using Basic authentication
	 * 
	 * Expects: Authorization: Basic <base64(username:password)>
	 * 
	 * NOTE: Only for development/testing, not recommended for production
	 */
	private async authenticateBasic(
		request: Request,
		tenantId: string,
		env: any,
	): Promise<AuthResult> {
		const authHeader = request.headers.get("Authorization");

		if (!authHeader || !authHeader.startsWith("Basic ")) {
			return {
				success: false,
				error: "Missing or invalid Authorization header",
			};
		}

		const base64Credentials = authHeader.substring(6);
		const credentials = atob(base64Credentials);
		const [username, password] = credentials.split(":");

		if (!username || !password) {
			return {
				success: false,
				error: "Invalid credentials format",
			};
		}

		// Look up user credentials in KV store
		const userKey = `user:${tenantId}:${username}`;
		const userData = await env.TENANT_CONFIG?.get(userKey);

		if (!userData) {
			return {
				success: false,
				error: "Invalid credentials",
			};
		}

		const user = JSON.parse(userData);

		// Verify password (in production, use proper password hashing)
		if (user.password !== password) {
			return {
				success: false,
				error: "Invalid credentials",
			};
		}

		return {
			success: true,
			userId: user.id,
			tenantId,
			permissions: user.permissions || ["read", "write"],
		};
	}

	/**
	 * Verify JWT token using HMAC-SHA256
	 *
	 * Uses Web Crypto API for secure signature verification
	 */
	private async verifyJWT(token: string, env: any): Promise<any> {
		// Split token into parts
		const parts = token.split(".");
		if (parts.length !== 3) {
			throw new Error("Invalid JWT format");
		}

		const [headerB64, payloadB64, signatureB64] = parts;

		// Get secret from environment
		const secret = env.JWT_SECRET;
		if (!secret) {
			throw new Error("JWT_SECRET not configured");
		}

		// Verify signature using Web Crypto API
		const encoder = new TextEncoder();
		const signingInput = `${headerB64}.${payloadB64}`;

		// Import the secret key
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["verify"]
		);

		// Decode the signature from base64url
		const signature = this.base64UrlDecode(signatureB64);

		// Verify the signature
		const isValid = await crypto.subtle.verify(
			"HMAC",
			key,
			signature,
			encoder.encode(signingInput)
		);

		if (!isValid) {
			throw new Error("Invalid JWT signature");
		}

		// Decode and return payload
		const payloadJson = new TextDecoder().decode(this.base64UrlDecode(payloadB64));
		return JSON.parse(payloadJson);
	}

	/**
	 * Decode base64url string to Uint8Array
	 */
	private base64UrlDecode(str: string): Uint8Array {
		// Convert base64url to base64
		const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
		// Add padding if needed
		const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
		// Decode
		const binary = atob(padded);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	}

	/**
	 * Check if user has specific permission
	 */
	static hasPermission(authResult: AuthResult, permission: string): boolean {
		if (!authResult.success || !authResult.permissions) {
			return false;
		}

		return authResult.permissions.includes(permission) || authResult.permissions.includes("*");
	}

	/**
	 * Generate API key
	 */
	static generateApiKey(): string {
		const array = new Uint8Array(32);
		crypto.getRandomValues(array);
		return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
}

/**
 * Authorization middleware
 */
export class Authorizer {
	/**
	 * Check if request is authorized for operation
	 */
	static authorize(
		authResult: AuthResult,
		operation: "read" | "write" | "delete" | "admin",
	): boolean {
		if (!authResult.success) {
			return false;
		}

		// Map operations to required permissions
		const permissionMap: Record<string, string[]> = {
			read: ["read", "write", "admin", "*"],
			write: ["write", "admin", "*"],
			delete: ["delete", "admin", "*"],
			admin: ["admin", "*"],
		};

		const requiredPermissions = permissionMap[operation] || [];

		return (
			authResult.permissions?.some((p) => requiredPermissions.includes(p)) || false
		);
	}

	/**
	 * Get operation from HTTP method and path
	 */
	static getOperationFromRequest(request: Request): "read" | "write" | "delete" | "admin" {
		const method = request.method.toUpperCase();
		const url = new URL(request.url);

		// Admin operations
		if (url.pathname.includes("/admin")) {
			return "admin";
		}

		// Map HTTP methods to operations
		switch (method) {
			case "GET":
			case "HEAD":
			case "OPTIONS":
				return "read";
			case "POST":
			case "PUT":
			case "PATCH":
				return "write";
			case "DELETE":
				return "delete";
			default:
				return "read";
		}
	}
}
