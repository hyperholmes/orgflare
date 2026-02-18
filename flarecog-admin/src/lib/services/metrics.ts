export class MetricsService {
	private DB: D1Database;

	constructor(DB: D1Database) {
		this.DB = DB;
	}

	async record(metricData: {
		tenant_id: string;
		timestamp: number;
		atoms_created?: number;
		atoms_queried?: number;
		inferences_performed?: number;
		agents_executed?: number;
		ai_calls_made?: number;
		response_time_ms?: number;
		success?: boolean;
	}) {
		const {
			tenant_id,
			timestamp,
			atoms_created = 0,
			atoms_queried = 0,
			inferences_performed = 0,
			agents_executed = 0,
			ai_calls_made = 0,
			response_time_ms = 0,
			success = true,
		} = metricData;

		const response = await this.DB.prepare(
			`INSERT INTO cognitive_metrics 
      (tenant_id, timestamp, atoms_created, atoms_queried, inferences_performed, agents_executed, ai_calls_made, response_time_ms, success) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
			.bind(
				tenant_id,
				timestamp,
				atoms_created,
				atoms_queried,
				inferences_performed,
				agents_executed,
				ai_calls_made,
				response_time_ms,
				success ? 1 : 0,
			)
			.run();

		if (!response.success) {
			throw new Error("Failed to record metrics");
		}

		return { success: true, metricId: response.meta.last_row_id };
	}

	async getByTenant(
		tenantId: string,
		options?: {
			startTime?: number;
			endTime?: number;
			limit?: number;
		},
	) {
		const { startTime, endTime, limit = 1000 } = options || {};

		let query = `SELECT * FROM cognitive_metrics WHERE tenant_id = ?`;
		const bindings: any[] = [tenantId];

		if (startTime) {
			query += ` AND timestamp >= ?`;
			bindings.push(startTime);
		}

		if (endTime) {
			query += ` AND timestamp <= ?`;
			bindings.push(endTime);
		}

		query += ` ORDER BY timestamp DESC LIMIT ?`;
		bindings.push(limit);

		const response = await this.DB.prepare(query).bind(...bindings).all();

		if (response.success) {
			return response.results;
		}
		return [];
	}

	async getAggregatedByTenant(
		tenantId: string,
		options?: {
			startTime?: number;
			endTime?: number;
			groupBy?: "hour" | "day" | "week" | "month";
		},
	) {
		const { startTime, endTime, groupBy = "day" } = options || {};

		// SQLite doesn't have native date grouping, so we'll use timestamp arithmetic
		let timeGroup: string;
		switch (groupBy) {
			case "hour":
				timeGroup = "timestamp / 3600000 * 3600000"; // Group by hour
				break;
			case "day":
				timeGroup = "timestamp / 86400000 * 86400000"; // Group by day
				break;
			case "week":
				timeGroup = "timestamp / 604800000 * 604800000"; // Group by week
				break;
			case "month":
				timeGroup = "timestamp / 2592000000 * 2592000000"; // Group by ~30 days
				break;
			default:
				timeGroup = "timestamp / 86400000 * 86400000";
		}

		let query = `
      SELECT 
        ${timeGroup} as period,
        COUNT(*) as operations_count,
        SUM(atoms_created) as total_atoms_created,
        SUM(atoms_queried) as total_atoms_queried,
        SUM(inferences_performed) as total_inferences,
        SUM(agents_executed) as total_agents_executed,
        SUM(ai_calls_made) as total_ai_calls,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_operations,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_operations
      FROM cognitive_metrics 
      WHERE tenant_id = ?
    `;

		const bindings: any[] = [tenantId];

		if (startTime) {
			query += ` AND timestamp >= ?`;
			bindings.push(startTime);
		}

		if (endTime) {
			query += ` AND timestamp <= ?`;
			bindings.push(endTime);
		}

		query += ` GROUP BY period ORDER BY period DESC`;

		const response = await this.DB.prepare(query).bind(...bindings).all();

		if (response.success) {
			return response.results;
		}
		return [];
	}

	async getTenantSummary(tenantId: string, days: number = 30) {
		const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

		const response = await this.DB.prepare(
			`SELECT 
        COUNT(*) as total_operations,
        SUM(atoms_created) as total_atoms_created,
        SUM(atoms_queried) as total_atoms_queried,
        SUM(inferences_performed) as total_inferences,
        SUM(agents_executed) as total_agents_executed,
        SUM(ai_calls_made) as total_ai_calls,
        AVG(response_time_ms) as avg_response_time,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_operations,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_operations
      FROM cognitive_metrics 
      WHERE tenant_id = ? AND timestamp >= ?`,
		)
			.bind(tenantId, startTime)
			.first();

		return response || {};
	}

	async getPlatformSummary(days: number = 30) {
		const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

		const response = await this.DB.prepare(
			`SELECT 
        COUNT(DISTINCT tenant_id) as active_tenants,
        COUNT(*) as total_operations,
        SUM(atoms_created) as total_atoms_created,
        SUM(atoms_queried) as total_atoms_queried,
        SUM(inferences_performed) as total_inferences,
        SUM(agents_executed) as total_agents_executed,
        SUM(ai_calls_made) as total_ai_calls,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_operations,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_operations
      FROM cognitive_metrics 
      WHERE timestamp >= ?`,
		)
			.bind(startTime)
			.first();

		return response || {};
	}

	async getTopTenants(limit: number = 10, days: number = 30) {
		const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

		const response = await this.DB.prepare(
			`SELECT 
        tenant_id,
        COUNT(*) as operations_count,
        SUM(atoms_created) as total_atoms_created,
        SUM(inferences_performed) as total_inferences,
        SUM(ai_calls_made) as total_ai_calls
      FROM cognitive_metrics 
      WHERE timestamp >= ?
      GROUP BY tenant_id
      ORDER BY operations_count DESC
      LIMIT ?`,
		)
			.bind(startTime, limit)
			.all();

		if (response.success) {
			return response.results;
		}
		return [];
	}

	async checkResourceLimits(tenantId: string) {
		// Get tenant tier
		const tenant = await this.DB.prepare(
			`SELECT tier FROM tenants WHERE id = ?`,
		)
			.bind(tenantId)
			.first();

		if (!tenant) {
			throw new Error("Tenant not found");
		}

		// Get tier limits
		const tierLimits = await this.DB.prepare(
			`SELECT atoms_limit, inferences_limit, ai_calls_limit FROM subscription_tiers WHERE name = ?`,
		)
			.bind(tenant.tier)
			.first();

		if (!tierLimits) {
			throw new Error("Tier limits not found");
		}

		// Get current usage (last 30 days)
		const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
		const usage = await this.DB.prepare(
			`SELECT 
        SUM(atoms_created) as atoms_used,
        SUM(inferences_performed) as inferences_used,
        SUM(ai_calls_made) as ai_calls_used
      FROM cognitive_metrics 
      WHERE tenant_id = ? AND timestamp >= ?`,
		)
			.bind(tenantId, thirtyDaysAgo)
			.first();

		const atomsUsed = usage?.atoms_used || 0;
		const inferencesUsed = usage?.inferences_used || 0;
		const aiCallsUsed = usage?.ai_calls_used || 0;

		const atomsLimit = tierLimits.atoms_limit;
		const inferencesLimit = tierLimits.inferences_limit;
		const aiCallsLimit = tierLimits.ai_calls_limit;

		return {
			atoms: {
				used: atomsUsed,
				limit: atomsLimit,
				unlimited: atomsLimit === -1,
				exceeded: atomsLimit !== -1 && atomsUsed >= atomsLimit,
				percentage:
					atomsLimit === -1 ? 0 : (atomsUsed / atomsLimit) * 100,
			},
			inferences: {
				used: inferencesUsed,
				limit: inferencesLimit,
				unlimited: inferencesLimit === -1,
				exceeded:
					inferencesLimit !== -1 && inferencesUsed >= inferencesLimit,
				percentage:
					inferencesLimit === -1
						? 0
						: (inferencesUsed / inferencesLimit) * 100,
			},
			ai_calls: {
				used: aiCallsUsed,
				limit: aiCallsLimit,
				unlimited: aiCallsLimit === -1,
				exceeded: aiCallsLimit !== -1 && aiCallsUsed >= aiCallsLimit,
				percentage:
					aiCallsLimit === -1 ? 0 : (aiCallsUsed / aiCallsLimit) * 100,
			},
		};
	}
}
