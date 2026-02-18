/**
 * Enhanced Storage Node - Distributed AtomSpace Coordination
 * 
 * Implements advanced storage node capabilities for the Distributed AtomSpace (DAS)
 * including replication, sharding, and cross-node query coordination.
 */

import { DurableObject } from "cloudflare:workers";
import { nanoid } from "nanoid";
import { Env, Atom, AtomSpaceQuery } from "../types/cognitive";

/**
 * Storage node configuration
 */
export interface StorageNodeConfig {
	nodeId: string;
	region: string;
	capacity: number; // Max atoms
	replicationFactor: number;
	shardKey?: string;
}

/**
 * Replication status
 */
export interface ReplicationStatus {
	nodeId: string;
	lastSync: number;
	atomCount: number;
	status: "synced" | "syncing" | "stale" | "error";
}

/**
 * Shard information
 */
export interface ShardInfo {
	shardId: string;
	keyRange: [string, string]; // [start, end) hash range
	nodeIds: string[]; // Nodes holding this shard
	atomCount: number;
}

/**
 * Enhanced Storage Node Durable Object
 */
export class EnhancedStorageNode extends DurableObject<Env> {
	private config!: StorageNodeConfig;
	private peers: Map<string, string> = new Map(); // nodeId -> URL
	private replicationStatus: Map<string, ReplicationStatus> = new Map();
	private shards: Map<string, ShardInfo> = new Map();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.loadConfig();
	}

	/**
	 * Load configuration from storage
	 */
	private async loadConfig(): Promise<void> {
		const config = await this.ctx.storage.get<StorageNodeConfig>("config");
		if (config) {
			this.config = config;
		} else {
			// Initialize default config
			this.config = {
				nodeId: nanoid(),
				region: "auto",
				capacity: 1000000,
				replicationFactor: 3,
			};
			await this.ctx.storage.put("config", this.config);
		}

		// Load peer information
		const peers = await this.ctx.storage.get<Map<string, string>>("peers");
		if (peers) {
			this.peers = new Map(peers);
		}

		// Load replication status
		const replStatus = await this.ctx.storage.get<Map<string, ReplicationStatus>>(
			"replicationStatus"
		);
		if (replStatus) {
			this.replicationStatus = new Map(replStatus);
		}

		// Load shard information
		const shards = await this.ctx.storage.get<Map<string, ShardInfo>>("shards");
		if (shards) {
			this.shards = new Map(shards);
		}
	}

	/**
	 * Save configuration to storage
	 */
	private async saveConfig(): Promise<void> {
		await this.ctx.storage.put("config", this.config);
		await this.ctx.storage.put("peers", Array.from(this.peers.entries()));
		await this.ctx.storage.put(
			"replicationStatus",
			Array.from(this.replicationStatus.entries())
		);
		await this.ctx.storage.put("shards", Array.from(this.shards.entries()));
	}

	/**
	 * Register a peer storage node
	 */
	async registerPeer(nodeId: string, url: string): Promise<void> {
		this.peers.set(nodeId, url);
		this.replicationStatus.set(nodeId, {
			nodeId,
			lastSync: 0,
			atomCount: 0,
			status: "stale",
		});
		await this.saveConfig();
	}

	/**
	 * Unregister a peer storage node
	 */
	async unregisterPeer(nodeId: string): Promise<void> {
		this.peers.delete(nodeId);
		this.replicationStatus.delete(nodeId);
		await this.saveConfig();
	}

	/**
	 * Get shard for atom based on consistent hashing
	 */
	private getShardForAtom(atomId: string): ShardInfo | null {
		const hash = this.hashAtomId(atomId);

		for (const shard of this.shards.values()) {
			const [start, end] = shard.keyRange;
			if (hash >= start && hash < end) {
				return shard;
			}
		}

		return null;
	}

	/**
	 * Hash atom ID for consistent hashing
	 */
	private hashAtomId(atomId: string): string {
		// Simple hash function - in production use better hash
		let hash = 0;
		for (let i = 0; i < atomId.length; i++) {
			hash = (hash << 5) - hash + atomId.charCodeAt(i);
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(16).padStart(8, "0");
	}

	/**
	 * Replicate atom to peer nodes
	 */
	async replicateAtom(atom: Atom): Promise<void> {
		const shard = this.getShardForAtom(atom.id);
		if (!shard) {
			console.warn(`No shard found for atom ${atom.id}`);
			return;
		}

		// Replicate to all nodes in shard
		const replicationPromises = shard.nodeIds
			.filter((nodeId) => nodeId !== this.config.nodeId)
			.map(async (nodeId) => {
				const url = this.peers.get(nodeId);
				if (!url) return;

				try {
					const response = await fetch(`${url}/replicate`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ atom }),
					});

					if (response.ok) {
						const status = this.replicationStatus.get(nodeId);
						if (status) {
							status.lastSync = Date.now();
							status.status = "synced";
						}
					}
				} catch (error) {
					console.error(`Replication failed to node ${nodeId}:`, error);
					const status = this.replicationStatus.get(nodeId);
					if (status) {
						status.status = "error";
					}
				}
			});

		await Promise.all(replicationPromises);
		await this.saveConfig();
	}

	/**
	 * Execute distributed query across peer nodes
	 */
	async distributedQuery(query: AtomSpaceQuery): Promise<Atom[]> {
		const localAtomSpace = this.env.ATOMSPACE.idFromName("primary");
		const localStub = this.env.ATOMSPACE.get(localAtomSpace);

		// Query local AtomSpace
		const localResponse = await localStub.fetch(
			new Request("http://dummy/query", {
				method: "POST",
				body: JSON.stringify(query),
			})
		);
		const localData = await localResponse.json() as { data?: Atom[] };
		const localAtoms: Atom[] = localData.data || [];

		// Query peer nodes in parallel
		const peerQueries = Array.from(this.peers.entries()).map(
			async ([nodeId, url]) => {
				try {
					const response = await fetch(`${url}/query`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(query),
						signal: AbortSignal.timeout(5000), // 5 second timeout
					});

					if (response.ok) {
const data = await response.json() as { atoms?: Atom[] };
							return data.atoms || [];
					}
				} catch (error) {
					console.error(`Query failed to node ${nodeId}:`, error);
				}
				return [];
			}
		);

		const peerResults = await Promise.all(peerQueries);

		// Merge results (remove duplicates by ID)
		const atomMap = new Map<string, Atom>();
		for (const atom of localAtoms) {
			atomMap.set(atom.id, atom);
		}
		for (const atoms of peerResults) {
			for (const atom of atoms) {
				atomMap.set(atom.id, atom);
			}
		}

		return Array.from(atomMap.values());
	}

	/**
	 * Initialize sharding scheme
	 */
	async initializeSharding(shardCount: number): Promise<void> {
		this.shards.clear();

		// Create hash range partitions
		const rangeSize = Math.floor(0xffffffff / shardCount);

		for (let i = 0; i < shardCount; i++) {
			const start = (i * rangeSize).toString(16).padStart(8, "0");
			const end = ((i + 1) * rangeSize).toString(16).padStart(8, "0");

			const shardId = `shard-${i}`;
			this.shards.set(shardId, {
				shardId,
				keyRange: [start, end],
				nodeIds: [this.config.nodeId], // Initially assign to self
				atomCount: 0,
			});
		}

		await this.saveConfig();
	}

	/**
	 * Assign shard to nodes
	 */
	async assignShard(shardId: string, nodeIds: string[]): Promise<void> {
		const shard = this.shards.get(shardId);
		if (!shard) {
			throw new Error(`Shard ${shardId} not found`);
		}

		shard.nodeIds = nodeIds;
		await this.saveConfig();
	}

	/**
	 * Get node statistics
	 */
	async getStatistics(): Promise<{
		nodeId: string;
		atomCount: number;
		shardCount: number;
		peerCount: number;
		replicationStatus: ReplicationStatus[];
	}> {
		// Query local AtomSpace for atom count
		const localAtomSpace = this.env.ATOMSPACE.idFromName("primary");
		const localStub = this.env.ATOMSPACE.get(localAtomSpace);

		const statsResponse = await localStub.fetch(
			new Request("http://dummy/stats", { method: "GET" })
		);
		const statsData = await statsResponse.json() as { data?: { totalAtoms?: number } };

		return {
			nodeId: this.config.nodeId,
			atomCount: statsData.data?.totalAtoms || 0,
			shardCount: this.shards.size,
			peerCount: this.peers.size,
			replicationStatus: Array.from(this.replicationStatus.values()),
		};
	}

	/**
	 * Sync with peer node
	 */
	async syncWithPeer(nodeId: string): Promise<void> {
		const url = this.peers.get(nodeId);
		if (!url) {
			throw new Error(`Peer ${nodeId} not found`);
		}

		const status = this.replicationStatus.get(nodeId);
		if (status) {
			status.status = "syncing";
		}

		try {
			// Get all atoms from local AtomSpace
			const localAtomSpace = this.env.ATOMSPACE.idFromName("primary");
			const localStub = this.env.ATOMSPACE.get(localAtomSpace);

			const queryResponse = await localStub.fetch(
				new Request("http://dummy/query", {
					method: "POST",
					body: JSON.stringify({ type: "find_atoms", limit: 1000 }),
				})
			);
const queryData = await queryResponse.json() as { data?: Atom[] };
				const atoms: Atom[] = queryData.data || [];

			// Send atoms to peer
			const syncResponse = await fetch(`${url}/sync`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ atoms }),
			});

			if (syncResponse.ok) {
				if (status) {
					status.lastSync = Date.now();
					status.atomCount = atoms.length;
					status.status = "synced";
				}
			} else {
				throw new Error(`Sync failed: ${syncResponse.statusText}`);
			}
		} catch (error) {
			console.error(`Sync with peer ${nodeId} failed:`, error);
			if (status) {
				status.status = "error";
			}
		}

		await this.saveConfig();
	}

	/**
	 * Handle incoming HTTP requests
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			// Register peer
if (path === "/register" && request.method === "POST") {
					const { nodeId, url } = await request.json() as { nodeId: string; url: string };
				await this.registerPeer(nodeId, url);
				return Response.json({ success: true });
			}

			// Unregister peer
if (path === "/unregister" && request.method === "POST") {
					const { nodeId } = await request.json() as { nodeId: string };
				await this.unregisterPeer(nodeId);
				return Response.json({ success: true });
			}

			// Distributed query
if (path === "/query" && request.method === "POST") {
					const query = await request.json() as AtomSpaceQuery;
				const atoms = await this.distributedQuery(query);
				return Response.json({ success: true, atoms });
			}

			// Get statistics
			if (path === "/stats" && request.method === "GET") {
				const stats = await this.getStatistics();
				return Response.json({ success: true, data: stats });
			}

			// Sync with peer
if (path === "/sync" && request.method === "POST") {
					const { nodeId } = await request.json() as { nodeId: string };
				await this.syncWithPeer(nodeId);
				return Response.json({ success: true });
			}

			// Initialize sharding
if (path === "/sharding/init" && request.method === "POST") {
					const { shardCount } = await request.json() as { shardCount: number };
				await this.initializeSharding(shardCount);
				return Response.json({ success: true });
			}

			// Assign shard
if (path === "/sharding/assign" && request.method === "POST") {
					const { shardId, nodeIds } = await request.json() as { shardId: string; nodeIds: string[] };
				await this.assignShard(shardId, nodeIds);
				return Response.json({ success: true });
			}

			return Response.json(
				{ success: false, error: "Not found" },
				{ status: 404 }
			);
		} catch (error) {
			return Response.json(
				{
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
				{ status: 500 }
			);
		}
	}
}
