export class BillingService {
	private DB: D1Database;

	constructor(DB: D1Database) {
		this.DB = DB;
	}

	async recordEvent(eventData: {
		tenant_id: string;
		event_type:
			| "subscription_created"
			| "subscription_upgraded"
			| "subscription_downgraded"
			| "subscription_cancelled"
			| "payment_succeeded"
			| "payment_failed"
			| "usage_recorded";
		amount?: number;
		currency?: string;
		metadata?: any;
	}) {
		const {
			tenant_id,
			event_type,
			amount = 0,
			currency = "USD",
			metadata = null,
		} = eventData;

		const response = await this.DB.prepare(
			`INSERT INTO billing_events (tenant_id, event_type, amount, currency, timestamp, metadata) 
      VALUES (?, ?, ?, ?, ?, ?)`,
		)
			.bind(
				tenant_id,
				event_type,
				amount,
				currency,
				Date.now(),
				metadata ? JSON.stringify(metadata) : null,
			)
			.run();

		if (!response.success) {
			throw new Error("Failed to record billing event");
		}

		return { success: true, eventId: response.meta.last_row_id };
	}

	async getByTenant(
		tenantId: string,
		options?: {
			startTime?: number;
			endTime?: number;
			eventType?: string;
			limit?: number;
		},
	) {
		const { startTime, endTime, eventType, limit = 1000 } = options || {};

		let query = `SELECT * FROM billing_events WHERE tenant_id = ?`;
		const bindings: any[] = [tenantId];

		if (startTime) {
			query += ` AND timestamp >= ?`;
			bindings.push(startTime);
		}

		if (endTime) {
			query += ` AND timestamp <= ?`;
			bindings.push(endTime);
		}

		if (eventType) {
			query += ` AND event_type = ?`;
			bindings.push(eventType);
		}

		query += ` ORDER BY timestamp DESC LIMIT ?`;
		bindings.push(limit);

		const response = await this.DB.prepare(query).bind(...bindings).all();

		if (response.success) {
			return response.results.map((row) => ({
				...row,
				metadata: row.metadata ? JSON.parse(row.metadata) : null,
			}));
		}
		return [];
	}

	async getTenantSummary(tenantId: string, days: number = 30) {
		const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

		const response = await this.DB.prepare(
			`SELECT 
        event_type,
        COUNT(*) as event_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
      FROM billing_events 
      WHERE tenant_id = ? AND timestamp >= ?
      GROUP BY event_type`,
		)
			.bind(tenantId, startTime)
			.all();

		if (response.success) {
			return response.results;
		}
		return [];
	}

	async getPlatformRevenue(days: number = 30) {
		const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

		const response = await this.DB.prepare(
			`SELECT 
        SUM(CASE WHEN event_type = 'payment_succeeded' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN event_type = 'payment_failed' THEN amount ELSE 0 END) as failed_payments,
        COUNT(DISTINCT tenant_id) as paying_tenants,
        COUNT(CASE WHEN event_type = 'subscription_created' THEN 1 END) as new_subscriptions,
        COUNT(CASE WHEN event_type = 'subscription_cancelled' THEN 1 END) as cancelled_subscriptions
      FROM billing_events 
      WHERE timestamp >= ?`,
		)
			.bind(startTime)
			.first();

		return response || {};
	}

	async getSubscriptionTiers() {
		const response = await this.DB.prepare(
			`SELECT * FROM subscription_tiers ORDER BY price_monthly ASC`,
		).all();

		if (response.success) {
			return response.results.map((row) => ({
				...row,
				features: row.features ? JSON.parse(row.features) : [],
			}));
		}
		return [];
	}

	async getSubscriptionTier(name: string) {
		const response = await this.DB.prepare(
			`SELECT * FROM subscription_tiers WHERE name = ?`,
		)
			.bind(name)
			.first();

		if (response) {
			return {
				...response,
				features: response.features ? JSON.parse(response.features) : [],
			};
		}
		return null;
	}

	async calculateUsageCost(
		tenantId: string,
		options?: {
			startTime?: number;
			endTime?: number;
		},
	) {
		const { startTime, endTime } = options || {};

		// Get tenant tier
		const tenant = await this.DB.prepare(
			`SELECT tier FROM tenants WHERE id = ?`,
		)
			.bind(tenantId)
			.first();

		if (!tenant) {
			throw new Error("Tenant not found");
		}

		// Get tier pricing
		const tierInfo = await this.getSubscriptionTier(tenant.tier);
		if (!tierInfo) {
			throw new Error("Tier not found");
		}

		// Get usage metrics
		let query = `
      SELECT 
        SUM(atoms_created) as atoms_used,
        SUM(inferences_performed) as inferences_used,
        SUM(ai_calls_made) as ai_calls_used
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

		const usage = await this.DB.prepare(query).bind(...bindings).first();

		const atomsUsed = usage?.atoms_used || 0;
		const inferencesUsed = usage?.inferences_used || 0;
		const aiCallsUsed = usage?.ai_calls_used || 0;

		// Calculate overage costs (if applicable)
		// This is a simplified model - adjust based on your pricing
		const atomOverageCost = 0.001; // $0.001 per atom over limit
		const inferenceOverageCost = 0.01; // $0.01 per inference over limit
		const aiCallOverageCost = 0.001; // $0.001 per AI call over limit

		let overageCost = 0;

		if (
			tierInfo.atoms_limit !== -1 &&
			atomsUsed > tierInfo.atoms_limit
		) {
			overageCost +=
				(atomsUsed - tierInfo.atoms_limit) * atomOverageCost;
		}

		if (
			tierInfo.inferences_limit !== -1 &&
			inferencesUsed > tierInfo.inferences_limit
		) {
			overageCost +=
				(inferencesUsed - tierInfo.inferences_limit) *
				inferenceOverageCost;
		}

		if (
			tierInfo.ai_calls_limit !== -1 &&
			aiCallsUsed > tierInfo.ai_calls_limit
		) {
			overageCost +=
				(aiCallsUsed - tierInfo.ai_calls_limit) * aiCallOverageCost;
		}

		return {
			tier: tenant.tier,
			base_cost: tierInfo.price_monthly,
			usage: {
				atoms: atomsUsed,
				inferences: inferencesUsed,
				ai_calls: aiCallsUsed,
			},
			limits: {
				atoms: tierInfo.atoms_limit,
				inferences: tierInfo.inferences_limit,
				ai_calls: tierInfo.ai_calls_limit,
			},
			overage_cost: Math.round(overageCost * 100), // Convert to cents
			total_cost:
				tierInfo.price_monthly + Math.round(overageCost * 100),
		};
	}
}
