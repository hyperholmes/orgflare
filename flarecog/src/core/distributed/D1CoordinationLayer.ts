/**
 * CloudFlare D1 Distributed Coordination Layer
 * 
 * Implements global coordination and synchronization across multiple
 * AtomSpace instances using CloudFlare D1 database.
 */

import { Env, Atom, TruthValue } from "../../types/cognitive";

export interface VectorClock {
	[instanceId: string]: number;
}

export interface AtomSyncRecord {
	atomId: string;
	instanceId: string;
	version: number;
	vectorClock: VectorClock;
	atomData: string; // JSON serialized atom
	timestamp: number;
}

export interface ConflictResolution {
	resolvedAtom: Atom;
	strategy: "last-write-wins" | "truth-value-merge" | "manual";
	conflictingVersions: AtomSyncRecord[];
}

export interface DistributedQuery {
	queryId: string;
	pattern: string;
	targetInstances: string[];
	results: Atom[];
	status: "pending" | "complete" | "failed";
}

/**
 * D1 Coordination Layer for Distributed AtomSpace
 * 
 * Provides global coordination, consensus, and synchronization
 * across multiple AtomSpace instances deployed globally.
 */
export class D1CoordinationLayer {
	constructor(private env: Env) {}

	/**
	 * Initialize D1 coordination schema
	 */
	async initialize(): Promise<void> {
		await this.env.COORDINATION_DB.prepare(
			`
			CREATE TABLE IF NOT EXISTS atom_sync (
				atom_id TEXT NOT NULL,
				instance_id TEXT NOT NULL,
				version INTEGER NOT NULL,
				vector_clock TEXT NOT NULL,
				atom_data TEXT NOT NULL,
				timestamp INTEGER NOT NULL,
				PRIMARY KEY (atom_id, instance_id, version)
			);
			
			CREATE INDEX IF NOT EXISTS idx_atom_sync_atom_id ON atom_sync(atom_id);
			CREATE INDEX IF NOT EXISTS idx_atom_sync_instance_id ON atom_sync(instance_id);
			CREATE INDEX IF NOT EXISTS idx_atom_sync_timestamp ON atom_sync(timestamp);
			
			CREATE TABLE IF NOT EXISTS distributed_queries (
				query_id TEXT PRIMARY KEY,
				pattern TEXT NOT NULL,
				target_instances TEXT NOT NULL,
				results TEXT,
				status TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				completed_at INTEGER
			);
			
			CREATE TABLE IF NOT EXISTS instance_registry (
				instance_id TEXT PRIMARY KEY,
				region TEXT NOT NULL,
				last_heartbeat INTEGER NOT NULL,
				status TEXT NOT NULL,
				capabilities TEXT
			);
			
			CREATE TABLE IF NOT EXISTS consensus_votes (
				atom_id TEXT NOT NULL,
				instance_id TEXT NOT NULL,
				truth_strength REAL NOT NULL,
				truth_confidence REAL NOT NULL,
				vote_weight REAL NOT NULL,
				timestamp INTEGER NOT NULL,
				PRIMARY KEY (atom_id, instance_id)
			);
		`,
		).run();
	}

	/**
	 * Register an AtomSpace instance
	 */
	async registerInstance(
		instanceId: string,
		region: string,
		capabilities: string[],
	): Promise<void> {
		await this.env.COORDINATION_DB.prepare(
			`
			INSERT OR REPLACE INTO instance_registry 
			(instance_id, region, last_heartbeat, status, capabilities)
			VALUES (?, ?, ?, ?, ?)
		`,
		)
			.bind(
				instanceId,
				region,
				Date.now(),
				"active",
				JSON.stringify(capabilities),
			)
			.run();
	}

	/**
	 * Sync atom to global coordination layer
	 */
	async syncAtom(
		atom: Atom,
		instanceId: string,
		vectorClock: VectorClock,
	): Promise<void> {
		const version = vectorClock[instanceId] || 0;

		await this.env.COORDINATION_DB.prepare(
			`
			INSERT INTO atom_sync 
			(atom_id, instance_id, version, vector_clock, atom_data, timestamp)
			VALUES (?, ?, ?, ?, ?, ?)
		`,
		)
			.bind(
				atom.id,
				instanceId,
				version,
				JSON.stringify(vectorClock),
				JSON.stringify(atom),
				Date.now(),
			)
			.run();
	}

	/**
	 * Get all versions of an atom from different instances
	 */
	async getAtomVersions(atomId: string): Promise<AtomSyncRecord[]> {
		const result = await this.env.COORDINATION_DB.prepare(
			`
			SELECT * FROM atom_sync 
			WHERE atom_id = ?
			ORDER BY timestamp DESC
		`,
		)
			.bind(atomId)
			.all();

		return result.results.map((row: any) => ({
			atomId: row.atom_id,
			instanceId: row.instance_id,
			version: row.version,
			vectorClock: JSON.parse(row.vector_clock),
			atomData: row.atom_data,
			timestamp: row.timestamp,
		}));
	}

	/**
	 * Resolve conflicts between atom versions
	 */
	async resolveConflicts(atomId: string): Promise<ConflictResolution> {
		const versions = await this.getAtomVersions(atomId);

		if (versions.length === 0) {
			throw new Error(`No versions found for atom ${atomId}`);
		}

		if (versions.length === 1) {
			return {
				resolvedAtom: JSON.parse(versions[0].atomData),
				strategy: "last-write-wins",
				conflictingVersions: versions,
			};
		}

		// Check for concurrent modifications using vector clocks
		const hasConcurrentModifications = this.detectConcurrentModifications(
			versions,
		);

		if (!hasConcurrentModifications) {
			// No conflict - use latest version
			return {
				resolvedAtom: JSON.parse(versions[0].atomData),
				strategy: "last-write-wins",
				conflictingVersions: versions,
			};
		}

		// Conflict detected - merge truth values
		const mergedAtom = await this.mergeTruthValues(versions);

		return {
			resolvedAtom: mergedAtom,
			strategy: "truth-value-merge",
			conflictingVersions: versions,
		};
	}

	/**
	 * Detect concurrent modifications using vector clocks
	 */
	private detectConcurrentModifications(
		versions: AtomSyncRecord[],
	): boolean {
		for (let i = 0; i < versions.length - 1; i++) {
			for (let j = i + 1; j < versions.length; j++) {
				const clock1 = versions[i].vectorClock;
				const clock2 = versions[j].vectorClock;

				if (this.areConcurrent(clock1, clock2)) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Check if two vector clocks are concurrent
	 */
	private areConcurrent(clock1: VectorClock, clock2: VectorClock): boolean {
		const allKeys = new Set([
			...Object.keys(clock1),
			...Object.keys(clock2),
		]);

		let clock1Greater = false;
		let clock2Greater = false;

		for (const key of allKeys) {
			const v1 = clock1[key] || 0;
			const v2 = clock2[key] || 0;

			if (v1 > v2) clock1Greater = true;
			if (v2 > v1) clock2Greater = true;
		}

		return clock1Greater && clock2Greater;
	}

	/**
	 * Merge truth values from conflicting versions
	 */
	private async mergeTruthValues(
		versions: AtomSyncRecord[],
	): Promise<Atom> {
		const atoms = versions.map((v) => JSON.parse(v.atomData) as Atom);

		// Calculate weighted average of truth values
		let totalStrength = 0;
		let totalConfidence = 0;
		let totalWeight = 0;

		for (const atom of atoms) {
			const weight = atom.truthValue.confidence; // Use confidence as weight
			totalStrength += atom.truthValue.strength * weight;
			totalConfidence += atom.truthValue.confidence * weight;
			totalWeight += weight;
		}

		const mergedTruthValue: TruthValue = {
			strength: totalStrength / totalWeight,
			confidence: totalConfidence / totalWeight,
		};

		// Use the most recent atom as base
		const baseAtom = atoms[0];
		baseAtom.truthValue = mergedTruthValue;
		baseAtom.updatedAt = Date.now();

		return baseAtom;
	}

	/**
	 * Execute distributed query across multiple instances
	 */
	async executeDistributedQuery(
		pattern: string,
		targetInstances: string[],
	): Promise<DistributedQuery> {
		const queryId = `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		await this.env.COORDINATION_DB.prepare(
			`
			INSERT INTO distributed_queries 
			(query_id, pattern, target_instances, status, created_at)
			VALUES (?, ?, ?, ?, ?)
		`,
		)
			.bind(
				queryId,
				pattern,
				JSON.stringify(targetInstances),
				"pending",
				Date.now(),
			)
			.run();

		return {
			queryId,
			pattern,
			targetInstances,
			results: [],
			status: "pending",
		};
	}

	/**
	 * Get active instances
	 */
	async getActiveInstances(): Promise<string[]> {
		const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

		const result = await this.env.COORDINATION_DB.prepare(
			`
			SELECT instance_id FROM instance_registry 
			WHERE last_heartbeat > ? AND status = 'active'
		`,
		)
			.bind(fiveMinutesAgo)
			.all();

		return result.results.map((row: any) => row.instance_id);
	}

	/**
	 * Submit consensus vote for atom truth value
	 */
	async submitConsensusVote(
		atomId: string,
		instanceId: string,
		truthValue: TruthValue,
		weight: number,
	): Promise<void> {
		await this.env.COORDINATION_DB.prepare(
			`
			INSERT OR REPLACE INTO consensus_votes 
			(atom_id, instance_id, truth_strength, truth_confidence, vote_weight, timestamp)
			VALUES (?, ?, ?, ?, ?, ?)
		`,
		)
			.bind(
				atomId,
				instanceId,
				truthValue.strength,
				truthValue.confidence,
				weight,
				Date.now(),
			)
			.run();
	}

	/**
	 * Calculate consensus truth value
	 */
	async calculateConsensus(atomId: string): Promise<TruthValue> {
		const result = await this.env.COORDINATION_DB.prepare(
			`
			SELECT truth_strength, truth_confidence, vote_weight 
			FROM consensus_votes 
			WHERE atom_id = ?
		`,
		)
			.bind(atomId)
			.all();

		if (result.results.length === 0) {
			return { strength: 0.5, confidence: 0.0 };
		}

		let totalStrength = 0;
		let totalConfidence = 0;
		let totalWeight = 0;

		for (const row of result.results as any[]) {
			totalStrength += row.truth_strength * row.vote_weight;
			totalConfidence += row.truth_confidence * row.vote_weight;
			totalWeight += row.vote_weight;
		}

		return {
			strength: totalStrength / totalWeight,
			confidence: totalConfidence / totalWeight,
		};
	}

	/**
	 * Update instance heartbeat
	 */
	async updateHeartbeat(instanceId: string): Promise<void> {
		await this.env.COORDINATION_DB.prepare(
			`
			UPDATE instance_registry 
			SET last_heartbeat = ? 
			WHERE instance_id = ?
		`,
		)
			.bind(Date.now(), instanceId)
			.run();
	}

	/**
	 * Get global statistics
	 */
	async getGlobalStats(): Promise<{
		totalInstances: number;
		activeInstances: number;
		totalAtoms: number;
		totalQueries: number;
	}> {
		const [instances, atoms, queries] = await Promise.all([
			this.env.COORDINATION_DB.prepare(
				"SELECT COUNT(*) as count FROM instance_registry",
			).first(),
			this.env.COORDINATION_DB.prepare(
				"SELECT COUNT(DISTINCT atom_id) as count FROM atom_sync",
			).first(),
			this.env.COORDINATION_DB.prepare(
				"SELECT COUNT(*) as count FROM distributed_queries",
			).first(),
		]);

		const activeInstances = await this.getActiveInstances();

		return {
			totalInstances: (instances as any)?.count || 0,
			activeInstances: activeInstances.length,
			totalAtoms: (atoms as any)?.count || 0,
			totalQueries: (queries as any)?.count || 0,
		};
	}
}
