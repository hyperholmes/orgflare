import { Atom, TruthValue, AttentionValue } from "../../types/cognitive";
import { PLNRules } from "../../reasoning/PLNRules";

/**
 * Distributed AtomSpace Coordinator
 * 
 * Manages synchronization and coordination across multiple AtomSpace instances
 * running on different CloudFlare Workers in the global edge network.
 * 
 * Key Features:
 * - Cross-worker atom synchronization
 * - Distributed truth value consensus
 * - Attention value propagation
 * - Conflict resolution via PLN revision
 * - Eventually consistent knowledge base
 */

export interface AtomSpaceNode {
	workerId: string;
	region: string;
	lastSync: number;
	atomCount: number;
	health: "healthy" | "degraded" | "offline";
}

export interface SyncOperation {
	id: string;
	type: "create" | "update" | "delete";
	atomId: string;
	atom?: Atom;
	sourceWorkerId: string;
	timestamp: number;
	vectorClock: Map<string, number>;
}

export interface ConflictResolution {
	atomId: string;
	conflicts: Atom[];
	resolved: Atom;
	strategy: "revision" | "latest" | "highest_confidence" | "manual";
}

export class DistributedAtomSpaceCoordinator {
	private nodes: Map<string, AtomSpaceNode> = new Map();
	private syncQueue: SyncOperation[] = [];
	private vectorClock: Map<string, number> = new Map();
	private workerId: string;

	constructor(workerId: string) {
		this.workerId = workerId;
		this.vectorClock.set(workerId, 0);
	}

	/**
	 * Register a new AtomSpace node in the distributed network
	 */
	registerNode(node: AtomSpaceNode): void {
		this.nodes.set(node.workerId, node);
		this.vectorClock.set(node.workerId, 0);
	}

	/**
	 * Synchronize atom across distributed AtomSpace instances
	 */
	async syncAtom(
		atom: Atom,
		operation: "create" | "update" | "delete",
		targetNodes?: string[],
	): Promise<void> {
		// Increment local vector clock
		const currentClock = this.vectorClock.get(this.workerId) || 0;
		this.vectorClock.set(this.workerId, currentClock + 1);

		const syncOp: SyncOperation = {
			id: `${this.workerId}_${Date.now()}_${Math.random()}`,
			type: operation,
			atomId: atom.id,
			atom: operation !== "delete" ? atom : undefined,
			sourceWorkerId: this.workerId,
			timestamp: Date.now(),
			vectorClock: new Map(this.vectorClock),
		};

		// Add to local sync queue
		this.syncQueue.push(syncOp);

		// Determine target nodes
		const targets = targetNodes || Array.from(this.nodes.keys());

		// Propagate to target nodes
		for (const targetId of targets) {
			const node = this.nodes.get(targetId);
			if (node && node.health === "healthy") {
				await this.sendSyncOperation(targetId, syncOp);
			}
		}
	}

	/**
	 * Send sync operation to a specific node
	 */
	private async sendSyncOperation(
		targetWorkerId: string,
		operation: SyncOperation,
	): Promise<void> {
		// In production, this would use Durable Object stubs or HTTP requests
		// to communicate with other workers
		// For now, this is a placeholder for the coordination protocol
		
		console.log(`Syncing ${operation.type} of atom ${operation.atomId} to worker ${targetWorkerId}`);
		
		// Update vector clock for the target
		const targetClock = this.vectorClock.get(targetWorkerId) || 0;
		this.vectorClock.set(targetWorkerId, Math.max(targetClock, operation.vectorClock.get(targetWorkerId) || 0));
	}

	/**
	 * Receive sync operation from another node
	 */
	async receiveSyncOperation(operation: SyncOperation): Promise<void> {
		// Update vector clock
		for (const [workerId, clock] of operation.vectorClock.entries()) {
			const currentClock = this.vectorClock.get(workerId) || 0;
			this.vectorClock.set(workerId, Math.max(currentClock, clock));
		}

		// Add to sync queue for processing
		this.syncQueue.push(operation);

		// Process the operation
		await this.processSyncOperation(operation);
	}

	/**
	 * Process a sync operation
	 */
	private async processSyncOperation(operation: SyncOperation): Promise<void> {
		// This would interact with the local AtomSpace Durable Object
		// to apply the sync operation
		
		switch (operation.type) {
			case "create":
				// Create atom in local AtomSpace
				break;
			case "update":
				// Update atom in local AtomSpace
				// May need conflict resolution
				break;
			case "delete":
				// Delete atom from local AtomSpace
				break;
		}
	}

	/**
	 * Resolve conflicts when multiple nodes update the same atom
	 * 
	 * Uses PLN revision to combine conflicting truth values
	 */
	resolveConflicts(conflicts: Atom[]): ConflictResolution {
		if (conflicts.length === 0) {
			throw new Error("No conflicts to resolve");
		}

		if (conflicts.length === 1) {
			return {
				atomId: conflicts[0].id,
				conflicts,
				resolved: conflicts[0],
				strategy: "latest",
			};
		}

		// Use PLN revision to combine truth values
		let resolvedTruthValue = conflicts[0].truthValue;
		
		for (let i = 1; i < conflicts.length; i++) {
			resolvedTruthValue = PLNRules.revision(
				resolvedTruthValue,
				conflicts[i].truthValue,
			);
		}

		// Combine attention values (take maximum STI, average LTI/VLTI)
		const resolvedAttentionValue: AttentionValue = {
			sti: Math.max(...conflicts.map(c => c.attentionValue.sti)),
			lti: Math.floor(
				conflicts.reduce((sum, c) => sum + c.attentionValue.lti, 0) / conflicts.length,
			),
			vlti: Math.floor(
				conflicts.reduce((sum, c) => sum + c.attentionValue.vlti, 0) / conflicts.length,
			),
		};

		// Use the most recent atom as the base
		const latestAtom = conflicts.reduce((latest, current) =>
			current.updatedAt > latest.updatedAt ? current : latest,
		);

		const resolved: Atom = {
			...latestAtom,
			truthValue: resolvedTruthValue,
			attentionValue: resolvedAttentionValue,
			updatedAt: Date.now(),
		};

		return {
			atomId: resolved.id,
			conflicts,
			resolved,
			strategy: "revision",
		};
	}

	/**
	 * Propagate attention values across the distributed network
	 * 
	 * High-STI atoms in one region should influence attention in other regions
	 */
	async propagateAttention(
		sourceAtomId: string,
		attentionValue: AttentionValue,
		spreadFactor: number = 0.1,
	): Promise<void> {
		// Calculate propagated attention
		const propagatedSTI = Math.floor(attentionValue.sti * spreadFactor);

		if (propagatedSTI < 1) {
			return; // Not enough attention to propagate
		}

		// Propagate to all healthy nodes
		for (const [workerId, node] of this.nodes.entries()) {
			if (node.health === "healthy" && workerId !== this.workerId) {
				// Send attention update to remote node
				await this.sendAttentionUpdate(workerId, sourceAtomId, propagatedSTI);
			}
		}
	}

	/**
	 * Send attention update to a remote node
	 */
	private async sendAttentionUpdate(
		targetWorkerId: string,
		atomId: string,
		stiDelta: number,
	): Promise<void> {
		// Placeholder for remote attention update
		console.log(`Propagating ${stiDelta} STI for atom ${atomId} to worker ${targetWorkerId}`);
	}

	/**
	 * Perform distributed query across all nodes
	 * 
	 * Aggregates results from multiple AtomSpace instances
	 */
	async distributedQuery(
		query: any,
		aggregationStrategy: "union" | "intersection" | "consensus" = "union",
	): Promise<Atom[]> {
		const results: Map<string, Atom[]> = new Map();

		// Query all healthy nodes
		for (const [workerId, node] of this.nodes.entries()) {
			if (node.health === "healthy") {
				const nodeResults = await this.queryNode(workerId, query);
				results.set(workerId, nodeResults);
			}
		}

		// Aggregate results based on strategy
		return this.aggregateQueryResults(results, aggregationStrategy);
	}

	/**
	 * Query a specific node
	 */
	private async queryNode(workerId: string, query: any): Promise<Atom[]> {
		// Placeholder - would send query to remote AtomSpace
		return [];
	}

	/**
	 * Aggregate query results from multiple nodes
	 */
	private aggregateQueryResults(
		results: Map<string, Atom[]>,
		strategy: "union" | "intersection" | "consensus",
	): Atom[] {
		if (results.size === 0) {
			return [];
		}

		switch (strategy) {
			case "union":
				// Combine all unique atoms
				const atomMap = new Map<string, Atom>();
				for (const nodeResults of results.values()) {
					for (const atom of nodeResults) {
						if (!atomMap.has(atom.id)) {
							atomMap.set(atom.id, atom);
						} else {
							// Merge truth values using revision
							const existing = atomMap.get(atom.id)!;
							const merged = {
								...existing,
								truthValue: PLNRules.revision(
									existing.truthValue,
									atom.truthValue,
								),
								updatedAt: Math.max(existing.updatedAt, atom.updatedAt),
							};
							atomMap.set(atom.id, merged);
						}
					}
				}
				return Array.from(atomMap.values());

			case "intersection":
				// Only atoms present in all nodes
				const firstResults = Array.from(results.values())[0];
				return firstResults.filter(atom =>
					Array.from(results.values()).every(nodeResults =>
						nodeResults.some(a => a.id === atom.id),
					),
				);

			case "consensus":
				// Atoms present in majority of nodes
				const atomCounts = new Map<string, number>();
				for (const nodeResults of results.values()) {
					for (const atom of nodeResults) {
						atomCounts.set(atom.id, (atomCounts.get(atom.id) || 0) + 1);
					}
				}

				const threshold = Math.ceil(results.size / 2);
				const consensusAtomIds = Array.from(atomCounts.entries())
					.filter(([_, count]) => count >= threshold)
					.map(([id, _]) => id);

				// Collect atoms that meet consensus
				const consensusAtoms: Atom[] = [];
				for (const nodeResults of results.values()) {
					for (const atom of nodeResults) {
						if (consensusAtomIds.includes(atom.id) && 
							!consensusAtoms.some(a => a.id === atom.id)) {
							consensusAtoms.push(atom);
						}
					}
				}

				return consensusAtoms;

			default:
				return [];
		}
	}

	/**
	 * Get network health status
	 */
	getNetworkHealth(): {
		totalNodes: number;
		healthyNodes: number;
		degradedNodes: number;
		offlineNodes: number;
		syncQueueSize: number;
	} {
		const nodes = Array.from(this.nodes.values());
		
		return {
			totalNodes: nodes.length,
			healthyNodes: nodes.filter(n => n.health === "healthy").length,
			degradedNodes: nodes.filter(n => n.health === "degraded").length,
			offlineNodes: nodes.filter(n => n.health === "offline").length,
			syncQueueSize: this.syncQueue.length,
		};
	}

	/**
	 * Check if operation is causally ready based on vector clocks
	 */
	isCausallyReady(operation: SyncOperation): boolean {
		for (const [workerId, clock] of operation.vectorClock.entries()) {
			const localClock = this.vectorClock.get(workerId) || 0;
			
			// Skip check for source worker
			if (workerId === operation.sourceWorkerId) {
				continue;
			}
			
			// Operation is not ready if it depends on future events
			if (clock > localClock + 1) {
				return false;
			}
		}
		
		return true;
	}

	/**
	 * Process pending sync operations that are causally ready
	 */
	async processPendingSyncs(): Promise<number> {
		let processed = 0;
		const remaining: SyncOperation[] = [];

		for (const operation of this.syncQueue) {
			if (this.isCausallyReady(operation)) {
				await this.processSyncOperation(operation);
				processed++;
			} else {
				remaining.push(operation);
			}
		}

		this.syncQueue = remaining;
		return processed;
	}
}

/**
 * Distributed AtomSpace Manager
 * 
 * High-level interface for managing distributed cognitive operations
 */
export class DistributedAtomSpaceManager {
	private coordinator: DistributedAtomSpaceCoordinator;
	private localAtomSpaceStub: DurableObjectStub;

	constructor(workerId: string, atomSpaceStub: DurableObjectStub) {
		this.coordinator = new DistributedAtomSpaceCoordinator(workerId);
		this.localAtomSpaceStub = atomSpaceStub;
	}

	/**
	 * Create atom with distributed synchronization
	 */
	async createAtom(atom: Atom, syncToAll: boolean = true): Promise<Atom> {
		// Create in local AtomSpace
		const response = await this.localAtomSpaceStub.fetch(
			new Request("http://dummy/node", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(atom),
			}),
		);

		const { data: createdAtom } = await response.json();

		// Sync to distributed network
		if (syncToAll) {
			await this.coordinator.syncAtom(createdAtom, "create");
		}

		return createdAtom;
	}

	/**
	 * Update atom with conflict resolution
	 */
	async updateAtom(
		atomId: string,
		updates: { truthValue?: TruthValue; attentionValue?: AttentionValue },
		syncToAll: boolean = true,
	): Promise<Atom> {
		// Update in local AtomSpace
		const response = await this.localAtomSpaceStub.fetch(
			new Request(`http://dummy/atom/${atomId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(updates),
			}),
		);

		const { data: updatedAtom } = await response.json();

		// Sync to distributed network
		if (syncToAll) {
			await this.coordinator.syncAtom(updatedAtom, "update");
		}

		return updatedAtom;
	}

	/**
	 * Perform distributed reasoning across the network
	 */
	async distributedReasoning(query: any): Promise<Atom[]> {
		return await this.coordinator.distributedQuery(query, "consensus");
	}

	/**
	 * Get coordinator for advanced operations
	 */
	getCoordinator(): DistributedAtomSpaceCoordinator {
		return this.coordinator;
	}
}
