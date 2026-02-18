export const TENANT_QUERIES = {
	BASE_SELECT: `
    SELECT 
      tenants.*,
      (SELECT COUNT(*) FROM cognitive_metrics WHERE tenant_id = tenants.id) as total_operations,
      (SELECT SUM(atoms_created) FROM cognitive_metrics WHERE tenant_id = tenants.id) as total_atoms_created,
      (SELECT SUM(inferences_performed) FROM cognitive_metrics WHERE tenant_id = tenants.id) as total_inferences
    FROM tenants
  `,
	INSERT_TENANT: `INSERT INTO tenants (id, name, tier, status, email, api_key, rate_limit_rpm, rate_limit_burst) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	UPDATE_TENANT: `UPDATE tenants SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
	UPDATE_TIER: `UPDATE tenants SET tier = ?, rate_limit_rpm = ?, rate_limit_burst = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
	UPDATE_STATUS: `UPDATE tenants SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
	UPDATE_API_KEY: `UPDATE tenants SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
	DELETE_TENANT: `DELETE FROM tenants WHERE id = ?`,
	GET_BY_ID: `WHERE tenants.id = ?`,
	GET_BY_API_KEY: `WHERE tenants.api_key = ?`,
};

const processTenantResults = (rows: any[]) => {
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		tier: row.tier,
		status: row.status,
		email: row.email,
		api_key: row.api_key,
		rate_limit_rpm: row.rate_limit_rpm,
		rate_limit_burst: row.rate_limit_burst,
		created_at: row.created_at,
		updated_at: row.updated_at,
		stats: {
			total_operations: row.total_operations || 0,
			total_atoms_created: row.total_atoms_created || 0,
			total_inferences: row.total_inferences || 0,
		},
	}));
};

export class TenantService {
	private DB: D1Database;

	constructor(DB: D1Database) {
		this.DB = DB;
	}

	async getById(id: string) {
		const query = `${TENANT_QUERIES.BASE_SELECT} ${TENANT_QUERIES.GET_BY_ID}`;
		const response = await this.DB.prepare(query).bind(id).all();

		if (response.success && response.results.length > 0) {
			const [tenant] = processTenantResults(response.results);
			return tenant;
		}
		return null;
	}

	async getByApiKey(apiKey: string) {
		const query = `${TENANT_QUERIES.BASE_SELECT} ${TENANT_QUERIES.GET_BY_API_KEY}`;
		const response = await this.DB.prepare(query).bind(apiKey).all();

		if (response.success && response.results.length > 0) {
			const [tenant] = processTenantResults(response.results);
			return tenant;
		}
		return null;
	}

	async getAll() {
		const query = `${TENANT_QUERIES.BASE_SELECT} ORDER BY tenants.created_at DESC`;
		const response = await this.DB.prepare(query).all();

		if (response.success) {
			return processTenantResults(response.results);
		}
		return [];
	}

	async getAllByTier(tier: string) {
		const query = `${TENANT_QUERIES.BASE_SELECT} WHERE tenants.tier = ? ORDER BY tenants.created_at DESC`;
		const response = await this.DB.prepare(query).bind(tier).all();

		if (response.success) {
			return processTenantResults(response.results);
		}
		return [];
	}

	async getAllByStatus(status: string) {
		const query = `${TENANT_QUERIES.BASE_SELECT} WHERE tenants.status = ? ORDER BY tenants.created_at DESC`;
		const response = await this.DB.prepare(query).bind(status).all();

		if (response.success) {
			return processTenantResults(response.results);
		}
		return [];
	}

	async create(tenantData: {
		id: string;
		name: string;
		tier?: string;
		status?: string;
		email?: string;
		api_key: string;
		rate_limit_rpm?: number;
		rate_limit_burst?: number;
	}) {
		const {
			id,
			name,
			tier = "free",
			status = "active",
			email = null,
			api_key,
			rate_limit_rpm = 60,
			rate_limit_burst = 100,
		} = tenantData;

		const response = await this.DB.prepare(TENANT_QUERIES.INSERT_TENANT)
			.bind(
				id,
				name,
				tier,
				status,
				email,
				api_key,
				rate_limit_rpm,
				rate_limit_burst,
			)
			.run();

		if (!response.success) {
			throw new Error("Failed to create tenant");
		}

		return { success: true, tenantId: id };
	}

	async update(
		id: string,
		updates: {
			name?: string;
			email?: string;
		},
	) {
		const tenant = await this.getById(id);
		if (!tenant) {
			throw new Error("Tenant not found");
		}

		const name = updates.name || tenant.name;
		const email = updates.email || tenant.email;

		const response = await this.DB.prepare(TENANT_QUERIES.UPDATE_TENANT)
			.bind(name, email, id)
			.run();

		if (!response.success) {
			throw new Error("Failed to update tenant");
		}

		return { success: true };
	}

	async updateTier(id: string, tier: string) {
		// Get tier limits
		const tierInfo = await this.DB.prepare(
			`SELECT rate_limit_rpm, rate_limit_burst FROM subscription_tiers WHERE name = ?`,
		)
			.bind(tier)
			.first();

		if (!tierInfo) {
			throw new Error("Invalid tier");
		}

		const response = await this.DB.prepare(TENANT_QUERIES.UPDATE_TIER)
			.bind(tier, tierInfo.rate_limit_rpm, tierInfo.rate_limit_burst, id)
			.run();

		if (!response.success) {
			throw new Error("Failed to update tenant tier");
		}

		// Record billing event
		await this.DB.prepare(
			`INSERT INTO billing_events (tenant_id, event_type, amount, timestamp, metadata) VALUES (?, ?, ?, ?, ?)`,
		)
			.bind(
				id,
				"subscription_upgraded",
				0,
				Date.now(),
				JSON.stringify({ new_tier: tier }),
			)
			.run();

		return { success: true };
	}

	async updateStatus(id: string, status: string) {
		const response = await this.DB.prepare(TENANT_QUERIES.UPDATE_STATUS)
			.bind(status, id)
			.run();

		if (!response.success) {
			throw new Error("Failed to update tenant status");
		}

		return { success: true };
	}

	async suspend(id: string) {
		return await this.updateStatus(id, "suspended");
	}

	async activate(id: string) {
		return await this.updateStatus(id, "active");
	}

	async delete(id: string) {
		// Soft delete by setting status to 'deleted'
		return await this.updateStatus(id, "deleted");
	}

	async hardDelete(id: string) {
		const response = await this.DB.prepare(TENANT_QUERIES.DELETE_TENANT)
			.bind(id)
			.run();

		if (!response.success) {
			throw new Error("Failed to delete tenant");
		}

		return { success: true };
	}

	async regenerateApiKey(id: string) {
		const newApiKey = crypto.randomUUID();

		const response = await this.DB.prepare(TENANT_QUERIES.UPDATE_API_KEY)
			.bind(newApiKey, id)
			.run();

		if (!response.success) {
			throw new Error("Failed to regenerate API key");
		}

		return { success: true, api_key: newApiKey };
	}

	async getStats(id: string) {
		const tenant = await this.getById(id);
		if (!tenant) {
			throw new Error("Tenant not found");
		}

		// Get recent metrics (last 30 days)
		const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
		const metricsResponse = await this.DB.prepare(
			`SELECT 
        COUNT(*) as operations_count,
        SUM(atoms_created) as atoms_created,
        SUM(atoms_queried) as atoms_queried,
        SUM(inferences_performed) as inferences_performed,
        SUM(agents_executed) as agents_executed,
        SUM(ai_calls_made) as ai_calls_made,
        AVG(response_time_ms) as avg_response_time
      FROM cognitive_metrics 
      WHERE tenant_id = ? AND timestamp >= ?`,
		)
			.bind(id, thirtyDaysAgo)
			.first();

		// Get billing events
		const billingResponse = await this.DB.prepare(
			`SELECT 
        event_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM billing_events 
      WHERE tenant_id = ? 
      GROUP BY event_type`,
		)
			.bind(id)
			.all();

		return {
			tenant: tenant,
			metrics: metricsResponse || {},
			billing: billingResponse.results || [],
		};
	}
}
