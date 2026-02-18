import { Atom, Link, QueryPattern } from "../../types/cognitive";
import { Env } from "../../types/cognitive";
import { nanoid } from "nanoid";

/**
 * Distributed AtomSpace
 *
 * Sharding and distribution of atoms across multiple Durable Objects
 */

export interface ShardInfo {
	id: string;
	stub: DurableObjectStub;
	atomCount: number;
	load: number;
}

export interface DistributedQueryResult {
	atoms: Atom[];
	shardResults: Map<string, Atom[]>;
	queryTime: number;
}

export interface ReplicationConfig {
	enabled: boolean;
	factor: number; // Number of replicas
	strategy: "primary-backup" | "multi-master";
}

export interface ConsistencyLevel {
	type: "eventual" | "strong" | "causal";
	timeout: number;
}

export class DistributedAtomSpace {
	private shards: Map<string, ShardInfo> = new Map();
	private shardCount: number;
	private replicationConfig: ReplicationConfig;
	private env: Env;

	constructor(
		env: Env,
		shardCount: number = 10,
		replicationConfig?: Partial<ReplicationConfig>,
	) {
		this.env = env;
		this.shardCount = shardCount;
		this.replicationConfig = {
			enabled: false,
			factor: 2,
			strategy: "primary-backup",
			...replicationConfig,
		};

		this.initializeShards();
	}

	/**
	 * Initialize shard stubs
	 */
	private initializeShards(): void {
		for (let i = 0; i < this.shardCount; i++) {
			const shardId = `shard_${i}`;
			const id = this.env.ATOMSPACE.idFromName(shardId);
			const stub = this.env.ATOMSPACE.get(id);

			this.shards.set(shardId, {
				id: shardId,
				stub,
				atomCount: 0,
				load: 0,
			});
		}
	}

	/**
	 * Create atom in distributed AtomSpace
	 */
	async createAtom(atom: Atom): Promise<string> {
		// Determine primary shard
		const primaryShardKey = this.getShardKey(atom);
		const primaryShard = this.shards.get(primaryShardKey)!;

		// Create in primary shard
		const response = await primaryShard.stub.fetch(
			new Request("http://dummy/node", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(atom),
			}),
		);

		const data = await response.json();
		const atomId = data.data.id;

		// Replicate if enabled
		if (this.replicationConfig.enabled) {
			await this.replicateAtom(atom, atomId, primaryShardKey);
		}

		// Update shard info
		primaryShard.atomCount++;

		return atomId;
	}

	/**
	 * Get atom from distributed AtomSpace
	 */
	async getAtom(atomId: string): Promise<Atom | null> {
		// Try to find atom in shards
		// In a real implementation, would maintain an index

		for (const shard of this.shards.values()) {
			try {
				const response = await shard.stub.fetch(
					new Request(`http://dummy/atom/${atomId}`),
				);
				const data = await response.json();

				if (data.success && data.data) {
					return data.data;
				}
			} catch {
				continue;
			}
		}

		return null;
	}

	/**
	 * Query across all shards
	 */
	async query(pattern: QueryPattern): Promise<DistributedQueryResult> {
		const startTime = Date.now();
		const shardResults = new Map<string, Atom[]>();

		// Query all shards in parallel
		const promises = Array.from(this.shards.entries()).map(
			async ([shardId, shard]) => {
				const results = await this.queryShard(shard.stub, pattern);
				shardResults.set(shardId, results);
				return results;
			},
		);

		const results = await Promise.all(promises);

		// Merge and deduplicate results
		const atoms = this.mergeResults(results);

		return {
			atoms,
			shardResults,
			queryTime: Date.now() - startTime,
		};
	}

	/**
	 * Query a single shard
	 */
	private async queryShard(
		shard: DurableObjectStub,
		pattern: QueryPattern,
	): Promise<Atom[]> {
		try {
			const response = await shard.fetch(
				new Request("http://dummy/query", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ pattern }),
				}),
			);

			const data = await response.json();
			return data.success ? data.data : [];
		} catch {
			return [];
		}
	}

	/**
	 * Merge results from multiple shards
	 */
	private mergeResults(results: Atom[][]): Atom[] {
		const merged = new Map<string, Atom>();

		for (const shardResults of results) {
			for (const atom of shardResults) {
				if (!merged.has(atom.id)) {
					merged.set(atom.id, atom);
				} else {
					// Merge truth values if duplicate
					const existing = merged.get(atom.id)!;
					existing.truthValue = this.mergeTruthValues(
						existing.truthValue,
						atom.truthValue,
					);
				}
			}
		}

		return Array.from(merged.values());
	}

	/**
	 * Merge truth values from replicas
	 */
	private mergeTruthValues(tv1: any, tv2: any): any {
		// Use weighted average based on confidence
		const totalConf = tv1.confidence + tv2.confidence;

		return {
			strength:
				(tv1.strength * tv1.confidence + tv2.strength * tv2.confidence) /
				totalConf,
			confidence: totalConf / 2,
		};
	}

	/**
	 * Replicate atom to backup shards
	 */
	private async replicateAtom(
		atom: Atom,
		atomId: string,
		primaryShardKey: string,
	): Promise<void> {
		const replicaCount = this.replicationConfig.factor - 1;
		const replicaShards = this.selectReplicaShards(
			primaryShardKey,
			replicaCount,
		);

		// Replicate in parallel
		await Promise.all(
			replicaShards.map((shard) =>
				shard.stub.fetch(
					new Request("http://dummy/node", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ ...atom, id: atomId }),
					}),
				),
			),
		);
	}

	/**
	 * Select replica shards
	 */
	private selectReplicaShards(
		primaryShardKey: string,
		count: number,
	): ShardInfo[] {
		const shards = Array.from(this.shards.values()).filter(
			(s) => s.id !== primaryShardKey,
		);

		// Select shards with lowest load
		return shards.sort((a, b) => a.load - b.load).slice(0, count);
	}

	/**
	 * Determine shard key for atom
	 */
	private getShardKey(atom: Atom): string {
		// Hash-based sharding
		const hash = this.hashAtom(atom);
		const shardIndex = hash % this.shardCount;
		return `shard_${shardIndex}`;
	}

	/**
	 * Hash function for atoms
	 */
	private hashAtom(atom: Atom): number {
		const str = atom.name || atom.type;
		let hash = 0;

		for (let i = 0; i < str.length; i++) {
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash = hash & hash;
		}

		return Math.abs(hash);
	}

	/**
	 * Rebalance shards
	 */
	async rebalance(): Promise<void> {
		// Get atom counts from all shards
		const counts = await this.getShardCounts();

		// Calculate average
		const total = Array.from(counts.values()).reduce((sum, c) => sum + c, 0);
		const avg = total / this.shardCount;

		// Find overloaded and underloaded shards
		const overloaded = Array.from(counts.entries())
			.filter(([_, count]) => count > avg * 1.2)
			.map(([id]) => id);

		const underloaded = Array.from(counts.entries())
			.filter(([_, count]) => count < avg * 0.8)
			.map(([id]) => id);

		// Move atoms from overloaded to underloaded shards
		for (const overloadedId of overloaded) {
			if (underloaded.length === 0) break;

			const targetId = underloaded.shift()!;
			await this.moveAtoms(overloadedId, targetId, Math.floor(avg * 0.2));
		}
	}

	/**
	 * Get atom counts from all shards
	 */
	private async getShardCounts(): Promise<Map<string, number>> {
		const counts = new Map<string, number>();

		const promises = Array.from(this.shards.entries()).map(
			async ([shardId, shard]) => {
				const response = await shard.stub.fetch(
					new Request("http://dummy/stats"),
				);
				const data = await response.json();
				counts.set(shardId, data.data.totalAtoms || 0);
			},
		);

		await Promise.all(promises);
		return counts;
	}

	/**
	 * Move atoms between shards
	 */
	private async moveAtoms(
		fromShardId: string,
		toShardId: string,
		count: number,
	): Promise<void> {
		const fromShard = this.shards.get(fromShardId)!;
		const toShard = this.shards.get(toShardId)!;

		// Get atoms from source shard
		const response = await fromShard.stub.fetch(
			new Request(`http://dummy/atoms?limit=${count}`),
		);
		const data = await response.json();

		if (!data.success) return;

		// Move each atom
		for (const atom of data.data) {
			// Create in target shard
			await toShard.stub.fetch(
				new Request("http://dummy/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(atom),
				}),
			);

			// Delete from source shard
			await fromShard.stub.fetch(
				new Request(`http://dummy/atom/${atom.id}`, {
					method: "DELETE",
				}),
			);
		}
	}

	/**
	 * Get shard statistics
	 */
	async getStatistics(): Promise<{
		totalShards: number;
		totalAtoms: number;
		avgAtomsPerShard: number;
		loadBalance: number;
		shardStats: Map<string, any>;
	}> {
		const counts = await this.getShardCounts();
		const totalAtoms = Array.from(counts.values()).reduce(
			(sum, c) => sum + c,
			0,
		);
		const avgAtomsPerShard = totalAtoms / this.shardCount;

		// Calculate load balance (coefficient of variation)
		const variance =
			Array.from(counts.values()).reduce(
				(sum, c) => sum + Math.pow(c - avgAtomsPerShard, 2),
				0,
			) / this.shardCount;
		const stdDev = Math.sqrt(variance);
		const loadBalance = avgAtomsPerShard > 0 ? stdDev / avgAtomsPerShard : 0;

		return {
			totalShards: this.shardCount,
			totalAtoms,
			avgAtomsPerShard,
			loadBalance,
			shardStats: counts,
		};
	}

	/**
	 * Get shard for atom ID
	 */
	getShardForAtom(atomId: string): ShardInfo | null {
		// In a real implementation, would maintain an index
		// For now, return null
		return null;
	}
}
