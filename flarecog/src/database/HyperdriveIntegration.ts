/**
 * Hyperdrive Integration for FlareCog
 * 
 * Provides optimized database connectivity for:
 * - D1 global coordination database
 * - Cross-tenant queries
 * - Analytics and reporting
 * - External data sources
 */

import { Hyperdrive } from "@cloudflare/workers-types";
import { Atom, Link } from "../types/cognitive";

export interface HyperdriveConfig {
	hyperdrive: Hyperdrive;
	databaseName: string;
	maxConnections: number;
	idleTimeout: number;
}

/**
 * Global Coordination Database
 * 
 * Manages cross-AtomSpace coordination using D1 with Hyperdrive
 */
export class GlobalCoordinationDB {
	private config: HyperdriveConfig;
	
	constructor(config: HyperdriveConfig) {
		this.config = config;
	}
	
	/**
	 * Initialize database schema
	 */
	async initializeSchema(): Promise<void> {
		const db = this.config.hyperdrive;
		
		// Global atom index
		await db.exec(`
			CREATE TABLE IF NOT EXISTS global_atom_index (
				atom_id TEXT PRIMARY KEY,
				atom_type TEXT NOT NULL,
				tenant_id TEXT NOT NULL,
				atomspace_id TEXT NOT NULL,
				sti REAL NOT NULL,
				lti REAL NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				INDEX idx_tenant (tenant_id),
				INDEX idx_atomspace (atomspace_id),
				INDEX idx_type (atom_type),
				INDEX idx_sti (sti DESC)
			)
		`);
		
		// Link index for cross-AtomSpace links
		await db.exec(`
			CREATE TABLE IF NOT EXISTS global_link_index (
				link_id TEXT PRIMARY KEY,
				link_type TEXT NOT NULL,
				source_atomspace TEXT NOT NULL,
				target_atomspace TEXT NOT NULL,
				outgoing TEXT NOT NULL,
				tenant_id TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				INDEX idx_source (source_atomspace),
				INDEX idx_target (target_atomspace),
				INDEX idx_tenant (tenant_id)
			)
		`);
		
		// Tenant metadata
		await db.exec(`
			CREATE TABLE IF NOT EXISTS tenants (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				api_key TEXT UNIQUE NOT NULL,
				subdomain TEXT UNIQUE NOT NULL,
				plan TEXT NOT NULL,
				status TEXT NOT NULL,
				quotas TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				INDEX idx_api_key (api_key),
				INDEX idx_subdomain (subdomain)
			)
		`);
		
		// Usage metrics
		await db.exec(`
			CREATE TABLE IF NOT EXISTS usage_metrics (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id TEXT NOT NULL,
				timestamp INTEGER NOT NULL,
				request_count INTEGER NOT NULL,
				storage_used_gb REAL NOT NULL,
				compute_time_ms INTEGER NOT NULL,
				agent_executions INTEGER NOT NULL,
				INDEX idx_tenant_time (tenant_id, timestamp DESC)
			)
		`);
		
		console.log("Global coordination database schema initialized");
	}
	
	/**
	 * Index an atom in the global index
	 */
	async indexAtom(atom: Atom, tenantId: string, atomspaceId: string): Promise<void> {
		const db = this.config.hyperdrive;
		
		await db.prepare(`
			INSERT OR REPLACE INTO global_atom_index 
			(atom_id, atom_type, tenant_id, atomspace_id, sti, lti, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			atom.id,
			atom.type,
			tenantId,
			atomspaceId,
			atom.attentionValue?.sti || 0,
			atom.attentionValue?.lti || 0,
			atom.timestamp,
			Date.now()
		).run();
	}
	
	/**
	 * Find atom location across all AtomSpaces
	 */
	async findAtomLocation(atomId: string): Promise<{
		tenantId: string;
		atomspaceId: string;
	} | null> {
		const db = this.config.hyperdrive;
		
		const result = await db.prepare(`
			SELECT tenant_id, atomspace_id 
			FROM global_atom_index 
			WHERE atom_id = ?
		`).bind(atomId).first();
		
		if (!result) return null;
		
		return {
			tenantId: result.tenant_id as string,
			atomspaceId: result.atomspace_id as string,
		};
	}
	
	/**
	 * Query atoms across multiple AtomSpaces
	 */
	async crossAtomSpaceQuery(query: {
		tenantId?: string;
		atomType?: string;
		minSTI?: number;
		limit?: number;
	}): Promise<Array<{
		atomId: string;
		atomType: string;
		atomspaceId: string;
		sti: number;
	}>> {
		const db = this.config.hyperdrive;
		
		let sql = "SELECT atom_id, atom_type, atomspace_id, sti FROM global_atom_index WHERE 1=1";
		const bindings: any[] = [];
		
		if (query.tenantId) {
			sql += " AND tenant_id = ?";
			bindings.push(query.tenantId);
		}
		
		if (query.atomType) {
			sql += " AND atom_type = ?";
			bindings.push(query.atomType);
		}
		
		if (query.minSTI !== undefined) {
			sql += " AND sti >= ?";
			bindings.push(query.minSTI);
		}
		
		sql += " ORDER BY sti DESC";
		
		if (query.limit) {
			sql += " LIMIT ?";
			bindings.push(query.limit);
		}
		
		const results = await db.prepare(sql).bind(...bindings).all();
		
		return results.results.map(row => ({
			atomId: row.atom_id as string,
			atomType: row.atom_type as string,
			atomspaceId: row.atomspace_id as string,
			sti: row.sti as number,
		}));
	}
	
	/**
	 * Index a cross-AtomSpace link
	 */
	async indexLink(link: Link, tenantId: string, sourceAtomspace: string, targetAtomspace: string): Promise<void> {
		const db = this.config.hyperdrive;
		
		await db.prepare(`
			INSERT OR REPLACE INTO global_link_index 
			(link_id, link_type, source_atomspace, target_atomspace, outgoing, tenant_id, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`).bind(
			link.id,
			link.type,
			sourceAtomspace,
			targetAtomspace,
			JSON.stringify(link.outgoing),
			tenantId,
			Date.now()
		).run();
	}
	
	/**
	 * Get tenant information
	 */
	async getTenant(identifier: string): Promise<any | null> {
		const db = this.config.hyperdrive;
		
		const result = await db.prepare(`
			SELECT * FROM tenants 
			WHERE id = ? OR api_key = ? OR subdomain = ?
		`).bind(identifier, identifier, identifier).first();
		
		if (!result) return null;
		
		return {
			...result,
			quotas: JSON.parse(result.quotas as string),
		};
	}
	
	/**
	 * Create a new tenant
	 */
	async createTenant(tenant: {
		id: string;
		name: string;
		apiKey: string;
		subdomain: string;
		plan: string;
		quotas: any;
	}): Promise<void> {
		const db = this.config.hyperdrive;
		
		await db.prepare(`
			INSERT INTO tenants 
			(id, name, api_key, subdomain, plan, status, quotas, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
		`).bind(
			tenant.id,
			tenant.name,
			tenant.apiKey,
			tenant.subdomain,
			tenant.plan,
			JSON.stringify(tenant.quotas),
			Date.now(),
			Date.now()
		).run();
	}
	
	/**
	 * Record usage metrics
	 */
	async recordUsage(metrics: {
		tenantId: string;
		requestCount: number;
		storageUsedGB: number;
		computeTimeMs: number;
		agentExecutions: number;
	}): Promise<void> {
		const db = this.config.hyperdrive;
		
		await db.prepare(`
			INSERT INTO usage_metrics 
			(tenant_id, timestamp, request_count, storage_used_gb, compute_time_ms, agent_executions)
			VALUES (?, ?, ?, ?, ?, ?)
		`).bind(
			metrics.tenantId,
			Date.now(),
			metrics.requestCount,
			metrics.storageUsedGB,
			metrics.computeTimeMs,
			metrics.agentExecutions
		).run();
	}
	
	/**
	 * Get usage statistics for a tenant
	 */
	async getUsageStats(tenantId: string, fromTimestamp: number, toTimestamp: number): Promise<{
		totalRequests: number;
		totalStorageGB: number;
		totalComputeMs: number;
		totalAgentExecutions: number;
	}> {
		const db = this.config.hyperdrive;
		
		const result = await db.prepare(`
			SELECT 
				SUM(request_count) as total_requests,
				AVG(storage_used_gb) as avg_storage,
				SUM(compute_time_ms) as total_compute,
				SUM(agent_executions) as total_agents
			FROM usage_metrics
			WHERE tenant_id = ? AND timestamp >= ? AND timestamp <= ?
		`).bind(tenantId, fromTimestamp, toTimestamp).first();
		
		return {
			totalRequests: (result?.total_requests as number) || 0,
			totalStorageGB: (result?.avg_storage as number) || 0,
			totalComputeMs: (result?.total_compute as number) || 0,
			totalAgentExecutions: (result?.total_agents as number) || 0,
		};
	}
	
	/**
	 * Get analytics data for dashboard
	 */
	async getAnalytics(tenantId?: string): Promise<{
		totalAtoms: number;
		totalLinks: number;
		totalTenants: number;
		avgSTI: number;
		topAtomTypes: Array<{ type: string; count: number }>;
	}> {
		const db = this.config.hyperdrive;
		
		let atomCountQuery = "SELECT COUNT(*) as count, AVG(sti) as avg_sti FROM global_atom_index";
		let linkCountQuery = "SELECT COUNT(*) as count FROM global_link_index";
		const bindings: any[] = [];
		
		if (tenantId) {
			atomCountQuery += " WHERE tenant_id = ?";
			linkCountQuery += " WHERE tenant_id = ?";
			bindings.push(tenantId);
		}
		
		const atomStats = await db.prepare(atomCountQuery).bind(...bindings).first();
		const linkStats = await db.prepare(linkCountQuery).bind(...bindings).first();
		const tenantCount = await db.prepare("SELECT COUNT(*) as count FROM tenants").first();
		
		let topTypesQuery = "SELECT atom_type, COUNT(*) as count FROM global_atom_index";
		if (tenantId) {
			topTypesQuery += " WHERE tenant_id = ?";
		}
		topTypesQuery += " GROUP BY atom_type ORDER BY count DESC LIMIT 10";
		
		const topTypes = await db.prepare(topTypesQuery).bind(...bindings).all();
		
		return {
			totalAtoms: (atomStats?.count as number) || 0,
			totalLinks: (linkStats?.count as number) || 0,
			totalTenants: (tenantCount?.count as number) || 0,
			avgSTI: (atomStats?.avg_sti as number) || 0,
			topAtomTypes: topTypes.results.map(row => ({
				type: row.atom_type as string,
				count: row.count as number,
			})),
		};
	}
}

/**
 * External Data Source Integration
 * 
 * Connect to external databases via Hyperdrive
 */
export class ExternalDataSource {
	private hyperdrive: Hyperdrive;
	
	constructor(hyperdrive: Hyperdrive) {
		this.hyperdrive = hyperdrive;
	}
	
	/**
	 * Import atoms from external database
	 */
	async importAtoms(query: string): Promise<Atom[]> {
		const results = await this.hyperdrive.prepare(query).all();
		
		// Transform external data to Atom format
		// Implementation depends on external schema
		return [];
	}
	
	/**
	 * Export atoms to external database
	 */
	async exportAtoms(atoms: Atom[], tableName: string): Promise<void> {
		// Batch insert atoms to external database
		// Implementation depends on external schema
	}
	
	/**
	 * Sync with external knowledge base
	 */
	async syncWithExternal(): Promise<{
		imported: number;
		exported: number;
		errors: number;
	}> {
		// Bidirectional sync logic
		return { imported: 0, exported: 0, errors: 0 };
	}
}
