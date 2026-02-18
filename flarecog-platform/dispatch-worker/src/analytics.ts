/**
 * Analytics Tracker
 * 
 * Tracks usage metrics for billing, monitoring, and analytics.
 * Records request metrics, cognitive operations, and resource usage.
 */

export interface RequestMetrics {
	tenantId: string;
	userId?: string;
	timestamp: number;
	method: string;
	path: string;
	statusCode: number;
	responseTime: number;
	bytesIn: number;
	bytesOut: number;
	operation: string;
	success: boolean;
}

export interface CognitiveMetrics {
	tenantId: string;
	timestamp: number;
	atomsCreated: number;
	atomsQueried: number;
	inferencesPerformed: number;
	agentsExecuted: number;
	aiCallsMade: number;
}

export class AnalyticsTracker {
	private readonly env: any;

	constructor(env: any) {
		this.env = env;
	}

	/**
	 * Track HTTP request
	 */
	async trackRequest(
		tenantId: string,
		request: Request,
		response: Response,
		startTime: number,
		userId?: string,
	): Promise<void> {
		const endTime = Date.now();
		const url = new URL(request.url);

		const metrics: RequestMetrics = {
			tenantId,
			userId,
			timestamp: startTime,
			method: request.method,
			path: url.pathname,
			statusCode: response.status,
			responseTime: endTime - startTime,
			bytesIn: parseInt(request.headers.get("Content-Length") || "0"),
			bytesOut: parseInt(response.headers.get("Content-Length") || "0"),
			operation: this.extractOperation(url.pathname),
			success: response.status >= 200 && response.status < 400,
		};

		// Store metrics in D1 database
		await this.storeRequestMetrics(metrics);

		// Update real-time counters in KV
		await this.updateCounters(tenantId, metrics);
	}

	/**
	 * Track cognitive operation
	 */
	async trackCognitiveOperation(
		tenantId: string,
		metrics: Partial<CognitiveMetrics>,
	): Promise<void> {
		const fullMetrics: CognitiveMetrics = {
			tenantId,
			timestamp: Date.now(),
			atomsCreated: metrics.atomsCreated || 0,
			atomsQueried: metrics.atomsQueried || 0,
			inferencesPerformed: metrics.inferencesPerformed || 0,
			agentsExecuted: metrics.agentsExecuted || 0,
			aiCallsMade: metrics.aiCallsMade || 0,
		};

		// Store in D1 database
		await this.storeCognitiveMetrics(fullMetrics);

		// Update aggregated counters
		await this.updateCognitiveCounters(tenantId, fullMetrics);
	}

	/**
	 * Store request metrics in D1
	 */
	private async storeRequestMetrics(metrics: RequestMetrics): Promise<void> {
		if (!this.env.ANALYTICS_DB) {
			return; // Analytics DB not configured
		}

		try {
			await this.env.ANALYTICS_DB.prepare(
				`INSERT INTO request_metrics 
				(tenant_id, user_id, timestamp, method, path, status_code, response_time, bytes_in, bytes_out, operation, success)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
				.bind(
					metrics.tenantId,
					metrics.userId || null,
					metrics.timestamp,
					metrics.method,
					metrics.path,
					metrics.statusCode,
					metrics.responseTime,
					metrics.bytesIn,
					metrics.bytesOut,
					metrics.operation,
					metrics.success ? 1 : 0,
				)
				.run();
		} catch (error) {
			console.error("Failed to store request metrics:", error);
		}
	}

	/**
	 * Store cognitive metrics in D1
	 */
	private async storeCognitiveMetrics(metrics: CognitiveMetrics): Promise<void> {
		if (!this.env.ANALYTICS_DB) {
			return;
		}

		try {
			await this.env.ANALYTICS_DB.prepare(
				`INSERT INTO cognitive_metrics 
				(tenant_id, timestamp, atoms_created, atoms_queried, inferences_performed, agents_executed, ai_calls_made)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
				.bind(
					metrics.tenantId,
					metrics.timestamp,
					metrics.atomsCreated,
					metrics.atomsQueried,
					metrics.inferencesPerformed,
					metrics.agentsExecuted,
					metrics.aiCallsMade,
				)
				.run();
		} catch (error) {
			console.error("Failed to store cognitive metrics:", error);
		}
	}

	/**
	 * Update real-time counters in KV
	 */
	private async updateCounters(
		tenantId: string,
		metrics: RequestMetrics,
	): Promise<void> {
		if (!this.env.TENANT_CONFIG) {
			return;
		}

		const key = `counters:${tenantId}:${this.getDateKey()}`;

		// Get current counters
		const currentData = await this.env.TENANT_CONFIG.get(key);
		const current = currentData ? JSON.parse(currentData) : {
			requests: 0,
			errors: 0,
			totalResponseTime: 0,
			totalBytesIn: 0,
			totalBytesOut: 0,
		};

		// Update counters
		current.requests += 1;
		if (!metrics.success) {
			current.errors += 1;
		}
		current.totalResponseTime += metrics.responseTime;
		current.totalBytesIn += metrics.bytesIn;
		current.totalBytesOut += metrics.bytesOut;

		// Store updated counters (expire after 48 hours)
		await this.env.TENANT_CONFIG.put(key, JSON.stringify(current), {
			expirationTtl: 172800,
		});
	}

	/**
	 * Update cognitive operation counters
	 */
	private async updateCognitiveCounters(
		tenantId: string,
		metrics: CognitiveMetrics,
	): Promise<void> {
		if (!this.env.TENANT_CONFIG) {
			return;
		}

		const key = `cognitive:${tenantId}:${this.getDateKey()}`;

		// Get current counters
		const currentData = await this.env.TENANT_CONFIG.get(key);
		const current = currentData ? JSON.parse(currentData) : {
			atomsCreated: 0,
			atomsQueried: 0,
			inferencesPerformed: 0,
			agentsExecuted: 0,
			aiCallsMade: 0,
		};

		// Update counters
		current.atomsCreated += metrics.atomsCreated;
		current.atomsQueried += metrics.atomsQueried;
		current.inferencesPerformed += metrics.inferencesPerformed;
		current.agentsExecuted += metrics.agentsExecuted;
		current.aiCallsMade += metrics.aiCallsMade;

		// Store updated counters
		await this.env.TENANT_CONFIG.put(key, JSON.stringify(current), {
			expirationTtl: 172800,
		});
	}

	/**
	 * Get usage statistics for tenant
	 */
	async getUsageStats(
		tenantId: string,
		startDate?: Date,
		endDate?: Date,
	): Promise<{
		requests: number;
		errors: number;
		avgResponseTime: number;
		totalBytesIn: number;
		totalBytesOut: number;
		cognitive: CognitiveMetrics;
	}> {
		if (!this.env.ANALYTICS_DB) {
			return {
				requests: 0,
				errors: 0,
				avgResponseTime: 0,
				totalBytesIn: 0,
				totalBytesOut: 0,
				cognitive: {
					tenantId,
					timestamp: Date.now(),
					atomsCreated: 0,
					atomsQueried: 0,
					inferencesPerformed: 0,
					agentsExecuted: 0,
					aiCallsMade: 0,
				},
			};
		}

		const start = startDate ? startDate.getTime() : Date.now() - 86400000; // Last 24 hours
		const end = endDate ? endDate.getTime() : Date.now();

		// Query request metrics
		const requestStats = await this.env.ANALYTICS_DB.prepare(
			`SELECT 
				COUNT(*) as requests,
				SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errors,
				AVG(response_time) as avg_response_time,
				SUM(bytes_in) as total_bytes_in,
				SUM(bytes_out) as total_bytes_out
			FROM request_metrics
			WHERE tenant_id = ? AND timestamp >= ? AND timestamp <= ?`,
		)
			.bind(tenantId, start, end)
			.first();

		// Query cognitive metrics
		const cognitiveStats = await this.env.ANALYTICS_DB.prepare(
			`SELECT 
				SUM(atoms_created) as atoms_created,
				SUM(atoms_queried) as atoms_queried,
				SUM(inferences_performed) as inferences_performed,
				SUM(agents_executed) as agents_executed,
				SUM(ai_calls_made) as ai_calls_made
			FROM cognitive_metrics
			WHERE tenant_id = ? AND timestamp >= ? AND timestamp <= ?`,
		)
			.bind(tenantId, start, end)
			.first();

		return {
			requests: requestStats?.requests || 0,
			errors: requestStats?.errors || 0,
			avgResponseTime: requestStats?.avg_response_time || 0,
			totalBytesIn: requestStats?.total_bytes_in || 0,
			totalBytesOut: requestStats?.total_bytes_out || 0,
			cognitive: {
				tenantId,
				timestamp: Date.now(),
				atomsCreated: cognitiveStats?.atoms_created || 0,
				atomsQueried: cognitiveStats?.atoms_queried || 0,
				inferencesPerformed: cognitiveStats?.inferences_performed || 0,
				agentsExecuted: cognitiveStats?.agents_executed || 0,
				aiCallsMade: cognitiveStats?.ai_calls_made || 0,
			},
		};
	}

	/**
	 * Extract operation type from path
	 */
	private extractOperation(path: string): string {
		if (path.includes("/atomspace")) {
			return "atomspace";
		} else if (path.includes("/mindagent")) {
			return "mindagent";
		} else if (path.includes("/reasoning")) {
			return "reasoning";
		} else if (path.includes("/cognitive")) {
			return "cognitive";
		} else {
			return "other";
		}
	}

	/**
	 * Get date key for daily aggregation
	 */
	private getDateKey(): string {
		const now = new Date();
		return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
	}
}

/**
 * Initialize analytics database schema
 */
export const ANALYTICS_SCHEMA = `
CREATE TABLE IF NOT EXISTS request_metrics (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tenant_id TEXT NOT NULL,
	user_id TEXT,
	timestamp INTEGER NOT NULL,
	method TEXT NOT NULL,
	path TEXT NOT NULL,
	status_code INTEGER NOT NULL,
	response_time INTEGER NOT NULL,
	bytes_in INTEGER NOT NULL,
	bytes_out INTEGER NOT NULL,
	operation TEXT NOT NULL,
	success INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_request_metrics_tenant_timestamp 
ON request_metrics(tenant_id, timestamp);

CREATE TABLE IF NOT EXISTS cognitive_metrics (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tenant_id TEXT NOT NULL,
	timestamp INTEGER NOT NULL,
	atoms_created INTEGER NOT NULL,
	atoms_queried INTEGER NOT NULL,
	inferences_performed INTEGER NOT NULL,
	agents_executed INTEGER NOT NULL,
	ai_calls_made INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cognitive_metrics_tenant_timestamp 
ON cognitive_metrics(tenant_id, timestamp);
`;
