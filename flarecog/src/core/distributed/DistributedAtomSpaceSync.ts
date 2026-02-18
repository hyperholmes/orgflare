/**
 * Distributed AtomSpace Synchronization Protocol
 *
 * Implements consensus mechanisms and synchronization protocols for
 * coordinating multiple AtomSpace instances across CloudFlare's edge network.
 *
 * Key Features:
 * - Eventual consistency for distributed knowledge
 * - Conflict resolution for concurrent updates
 * - Attention value propagation across instances
 * - Cross-instance query routing
 * - Distributed truth value consensus
 */

import { Atom, Node, Link, TruthValue, AttentionValue } from "../../types/cognitive";

export interface SyncMessage {
	type: "atom_created" | "atom_updated" | "atom_deleted" | "attention_spread" | "truth_update";
	sourceInstanceId: string;
	targetInstanceId?: string; // undefined = broadcast
	timestamp: number;
	payload: any;
	vectorClock: Map<string, number>;
}

export interface AtomSpaceInstance {
	id: string;
	region: string;
	atomCount: number;
	lastSync: number;
	status: "active" | "hibernating" | "offline";
}

export interface ConflictResolutionStrategy {
	name: "last-write-wins" | "truth-value-merge" | "attention-weighted" | "manual";
	apply: (local: Atom, remote: Atom) => Atom;
}

export interface SyncConfig {
	syncInterval: number; // milliseconds
	conflictStrategy: ConflictResolutionStrategy;
	attentionThreshold: number; // Only sync atoms above this STI
	batchSize: number;
	enableRealtime: boolean;
}

/**
 * Distributed AtomSpace Synchronization Manager
 */
export class DistributedAtomSpaceSync {
	private instanceId: string;
	private vectorClock: Map<string, number>;
	private knownInstances: Map<string, AtomSpaceInstance>;
	private config: SyncConfig;
	private syncQueue: SyncMessage[];

	constructor(instanceId: string, config: Partial<SyncConfig> = {}) {
		this.instanceId = instanceId;
		this.vectorClock = new Map([[instanceId, 0]]);
		this.knownInstances = new Map();
		this.syncQueue = [];

		this.config = {
			syncInterval: config.syncInterval || 5000,
			conflictStrategy: config.conflictStrategy || this.createLastWriteWinsStrategy(),
			attentionThreshold: config.attentionThreshold || 50,
			batchSize: config.batchSize || 100,
			enableRealtime: config.enableRealtime ?? true,
		};
	}

	/**
	 * Register a new AtomSpace instance in the distributed system
	 */
	registerInstance(instance: AtomSpaceInstance): void {
		this.knownInstances.set(instance.id, instance);
		if (!this.vectorClock.has(instance.id)) {
			this.vectorClock.set(instance.id, 0);
		}
	}

	/**
	 * Broadcast atom creation to other instances
	 */
	async broadcastAtomCreation(atom: Atom): Promise<void> {
		// Only broadcast high-attention atoms
		if (atom.attentionValue.sti < this.config.attentionThreshold) {
			return;
		}

		const message: SyncMessage = {
			type: "atom_created",
			sourceInstanceId: this.instanceId,
			timestamp: Date.now(),
			payload: atom,
			vectorClock: new Map(this.vectorClock),
		};

		this.incrementVectorClock();
		this.syncQueue.push(message);

		if (this.config.enableRealtime) {
			await this.flushSyncQueue();
		}
	}

	/**
	 * Broadcast atom update to other instances
	 */
	async broadcastAtomUpdate(atomId: string, updates: Partial<Atom>): Promise<void> {
		const message: SyncMessage = {
			type: "atom_updated",
			sourceInstanceId: this.instanceId,
			timestamp: Date.now(),
			payload: { atomId, updates },
			vectorClock: new Map(this.vectorClock),
		};

		this.incrementVectorClock();
		this.syncQueue.push(message);

		if (this.config.enableRealtime) {
			await this.flushSyncQueue();
		}
	}

	/**
	 * Spread attention values across distributed instances
	 */
	async spreadAttention(
		sourceAtomId: string,
		targetAtomId: string,
		attentionDelta: number,
	): Promise<void> {
		const message: SyncMessage = {
			type: "attention_spread",
			sourceInstanceId: this.instanceId,
			timestamp: Date.now(),
			payload: {
				sourceAtomId,
				targetAtomId,
				attentionDelta,
			},
			vectorClock: new Map(this.vectorClock),
		};

		this.incrementVectorClock();
		this.syncQueue.push(message);

		if (this.config.enableRealtime) {
			await this.flushSyncQueue();
		}
	}

	/**
	 * Propose truth value update with consensus mechanism
	 */
	async proposeTruthValueUpdate(
		atomId: string,
		newTruthValue: TruthValue,
	): Promise<TruthValue> {
		// Collect truth values from all instances
		const truthValues: TruthValue[] = [newTruthValue];

		// In production, query other instances for their truth values
		// For now, use consensus algorithm on collected values

		return this.consensusTruthValue(truthValues);
	}

	/**
	 * Calculate consensus truth value from multiple sources
	 */
	private consensusTruthValue(truthValues: TruthValue[]): TruthValue {
		if (truthValues.length === 0) {
			return { strength: 0.5, confidence: 0.0 };
		}

		if (truthValues.length === 1) {
			return truthValues[0];
		}

		// Weighted average based on confidence
		const totalConfidence = truthValues.reduce((sum, tv) => sum + tv.confidence, 0);

		if (totalConfidence === 0) {
			// No confident values, use simple average
			const avgStrength =
				truthValues.reduce((sum, tv) => sum + tv.strength, 0) / truthValues.length;
			return { strength: avgStrength, confidence: 0.1 };
		}

		// Confidence-weighted average
		const weightedStrength = truthValues.reduce(
			(sum, tv) => sum + tv.strength * tv.confidence,
			0,
		);

		const consensusStrength = weightedStrength / totalConfidence;

		// Consensus confidence increases with agreement
		const variance =
			truthValues.reduce(
				(sum, tv) => sum + Math.pow(tv.strength - consensusStrength, 2),
				0,
			) / truthValues.length;

		const agreement = 1.0 - Math.sqrt(variance);
		const consensusConfidence = Math.min(1.0, totalConfidence / truthValues.length * agreement);

		return {
			strength: consensusStrength,
			confidence: consensusConfidence,
		};
	}

	/**
	 * Handle incoming sync message from another instance
	 */
	async handleSyncMessage(
		message: SyncMessage,
		localAtomSpace: any,
	): Promise<void> {
		// Update vector clock
		this.mergeVectorClock(message.vectorClock);

		switch (message.type) {
			case "atom_created":
				await this.handleAtomCreation(message.payload, localAtomSpace);
				break;

			case "atom_updated":
				await this.handleAtomUpdate(message.payload, localAtomSpace);
				break;

			case "atom_deleted":
				await this.handleAtomDeletion(message.payload, localAtomSpace);
				break;

			case "attention_spread":
				await this.handleAttentionSpread(message.payload, localAtomSpace);
				break;

			case "truth_update":
				await this.handleTruthUpdate(message.payload, localAtomSpace);
				break;
		}
	}

	/**
	 * Handle atom creation from remote instance
	 */
	private async handleAtomCreation(
		remoteAtom: Atom,
		localAtomSpace: any,
	): Promise<void> {
		// Check if atom already exists locally
		const localAtom = await this.getLocalAtom(remoteAtom.id, localAtomSpace);

		if (!localAtom) {
			// Create new atom locally
			await this.createLocalAtom(remoteAtom, localAtomSpace);
		} else {
			// Conflict: atom exists locally
			const resolved = this.config.conflictStrategy.apply(localAtom, remoteAtom);
			await this.updateLocalAtom(resolved, localAtomSpace);
		}
	}

	/**
	 * Handle atom update from remote instance
	 */
	private async handleAtomUpdate(
		payload: { atomId: string; updates: Partial<Atom> },
		localAtomSpace: any,
	): Promise<void> {
		const localAtom = await this.getLocalAtom(payload.atomId, localAtomSpace);

		if (!localAtom) {
			// Atom doesn't exist locally, skip update
			return;
		}

		// Apply updates with conflict resolution
		const updatedAtom = { ...localAtom, ...payload.updates };
		const resolved = this.config.conflictStrategy.apply(localAtom, updatedAtom);

		await this.updateLocalAtom(resolved, localAtomSpace);
	}

	/**
	 * Handle atom deletion from remote instance
	 */
	private async handleAtomDeletion(
		atomId: string,
		localAtomSpace: any,
	): Promise<void> {
		// Soft delete: mark as deleted but keep for conflict resolution
		await this.markAtomDeleted(atomId, localAtomSpace);
	}

	/**
	 * Handle attention spreading from remote instance
	 */
	private async handleAttentionSpread(
		payload: { sourceAtomId: string; targetAtomId: string; attentionDelta: number },
		localAtomSpace: any,
	): Promise<void> {
		const targetAtom = await this.getLocalAtom(payload.targetAtomId, localAtomSpace);

		if (!targetAtom) {
			return;
		}

		// Apply attention delta
		const newSTI = targetAtom.attentionValue.sti + payload.attentionDelta;

		await this.updateLocalAtom(
			{
				...targetAtom,
				attentionValue: {
					...targetAtom.attentionValue,
					sti: Math.max(-100, Math.min(100, newSTI)),
				},
			},
			localAtomSpace,
		);
	}

	/**
	 * Handle truth value update from remote instance
	 */
	private async handleTruthUpdate(
		payload: { atomId: string; truthValue: TruthValue },
		localAtomSpace: any,
	): Promise<void> {
		const localAtom = await this.getLocalAtom(payload.atomId, localAtomSpace);

		if (!localAtom) {
			return;
		}

		// Merge truth values using consensus
		const consensusTruth = this.consensusTruthValue([
			localAtom.truthValue,
			payload.truthValue,
		]);

		await this.updateLocalAtom(
			{
				...localAtom,
				truthValue: consensusTruth,
			},
			localAtomSpace,
		);
	}

	/**
	 * Flush sync queue to other instances
	 */
	private async flushSyncQueue(): Promise<void> {
		if (this.syncQueue.length === 0) {
			return;
		}

		// Batch messages
		const batch = this.syncQueue.splice(0, this.config.batchSize);

		// In production, send batch to message queue or pub/sub system
		// For now, just log
		console.log(`Flushing ${batch.length} sync messages`);
	}

	/**
	 * Increment local vector clock
	 */
	private incrementVectorClock(): void {
		const current = this.vectorClock.get(this.instanceId) || 0;
		this.vectorClock.set(this.instanceId, current + 1);
	}

	/**
	 * Merge remote vector clock with local
	 */
	private mergeVectorClock(remoteVectorClock: Map<string, number>): void {
		for (const [instanceId, remoteClock] of remoteVectorClock.entries()) {
			const localClock = this.vectorClock.get(instanceId) || 0;
			this.vectorClock.set(instanceId, Math.max(localClock, remoteClock));
		}
	}

	/**
	 * Check if message has been seen before (causality check)
	 */
	private hasSeenMessage(messageVectorClock: Map<string, number>): boolean {
		for (const [instanceId, remoteClock] of messageVectorClock.entries()) {
			const localClock = this.vectorClock.get(instanceId) || 0;
			if (remoteClock > localClock) {
				return false; // New message
			}
		}
		return true; // Already seen
	}

	// Helper methods for AtomSpace operations

	private async getLocalAtom(atomId: string, atomSpace: any): Promise<Atom | null> {
		// In production, query local AtomSpace
		return null;
	}

	private async createLocalAtom(atom: Atom, atomSpace: any): Promise<void> {
		// In production, create atom in local AtomSpace
	}

	private async updateLocalAtom(atom: Atom, atomSpace: any): Promise<void> {
		// In production, update atom in local AtomSpace
	}

	private async markAtomDeleted(atomId: string, atomSpace: any): Promise<void> {
		// In production, mark atom as deleted in local AtomSpace
	}

	// Conflict resolution strategies

	private createLastWriteWinsStrategy(): ConflictResolutionStrategy {
		return {
			name: "last-write-wins",
			apply: (local: Atom, remote: Atom) => {
				return local.updatedAt > remote.updatedAt ? local : remote;
			},
		};
	}

	private createTruthValueMergeStrategy(): ConflictResolutionStrategy {
		return {
			name: "truth-value-merge",
			apply: (local: Atom, remote: Atom) => {
				const mergedTruth = this.consensusTruthValue([
					local.truthValue,
					remote.truthValue,
				]);

				return {
					...local,
					truthValue: mergedTruth,
					updatedAt: Math.max(local.updatedAt, remote.updatedAt),
				};
			},
		};
	}

	private createAttentionWeightedStrategy(): ConflictResolutionStrategy {
		return {
			name: "attention-weighted",
			apply: (local: Atom, remote: Atom) => {
				// Prefer atom with higher attention
				const localAttention = local.attentionValue.sti + local.attentionValue.lti;
				const remoteAttention = remote.attentionValue.sti + remote.attentionValue.lti;

				return localAttention >= remoteAttention ? local : remote;
			},
		};
	}

	/**
	 * Get synchronization statistics
	 */
	getSyncStats(): {
		instanceId: string;
		vectorClock: Map<string, number>;
		knownInstances: number;
		queueSize: number;
		lastSync: number;
	} {
		return {
			instanceId: this.instanceId,
			vectorClock: new Map(this.vectorClock),
			knownInstances: this.knownInstances.size,
			queueSize: this.syncQueue.length,
			lastSync: Date.now(),
		};
	}

	/**
	 * Perform periodic synchronization
	 */
	async periodicSync(atomSpace: any): Promise<void> {
		// Flush any pending messages
		await this.flushSyncQueue();

		// Request sync from other instances
		for (const [instanceId, instance] of this.knownInstances.entries()) {
			if (instance.status === "active" && instanceId !== this.instanceId) {
				// In production, request sync from remote instance
				console.log(`Requesting sync from instance ${instanceId}`);
			}
		}
	}

	/**
	 * Start periodic sync timer
	 */
	startPeriodicSync(atomSpace: any): NodeJS.Timeout {
		return setInterval(
			() => this.periodicSync(atomSpace),
			this.config.syncInterval,
		);
	}
}

/**
 * Factory function for creating sync manager
 */
export function createSyncManager(
	instanceId: string,
	config?: Partial<SyncConfig>,
): DistributedAtomSpaceSync {
	return new DistributedAtomSpaceSync(instanceId, config);
}
