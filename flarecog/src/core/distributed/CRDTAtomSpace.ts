/**
 * CRDT-based Distributed AtomSpace
 * 
 * Implements Conflict-free Replicated Data Types for distributed AtomSpace coordination
 * across CloudFlare Workers edge network. Enables eventual consistency without central
 * coordination, supporting the OpenCog vision of truly distributed cognitive processing.
 */

import { Atom, Node, Link, TruthValue, AttentionValue } from "../../types/cognitive";

/**
 * Vector Clock for causality tracking
 */
export interface VectorClock {
	[nodeId: string]: number;
}

/**
 * CRDT Operation types for AtomSpace
 */
export type CRDTOperation =
	| { type: "create_node"; atom: Node; timestamp: number; vectorClock: VectorClock }
	| { type: "create_link"; atom: Link; timestamp: number; vectorClock: VectorClock }
	| { type: "update_truth"; atomId: string; truthValue: TruthValue; timestamp: number; vectorClock: VectorClock }
	| { type: "update_attention"; atomId: string; attentionValue: AttentionValue; timestamp: number; vectorClock: VectorClock }
	| { type: "delete_atom"; atomId: string; timestamp: number; vectorClock: VectorClock };

/**
 * CRDT Atom with metadata for conflict resolution
 */
export interface CRDTAtom extends Atom {
	vectorClock: VectorClock;
	lastModified: number;
	originNode: string;
	tombstone?: boolean; // For soft deletes
}

/**
 * CRDT AtomSpace implementation
 * 
 * Uses Last-Write-Wins (LWW) strategy with vector clocks for causality tracking.
 * Supports eventual consistency across distributed edge nodes.
 */
export class CRDTAtomSpace {
	private atoms: Map<string, CRDTAtom> = new Map();
	private operations: CRDTOperation[] = [];
	private nodeId: string;
	private vectorClock: VectorClock;

	constructor(nodeId: string) {
		this.nodeId = nodeId;
		this.vectorClock = { [nodeId]: 0 };
	}

	/**
	 * Increment local vector clock
	 */
	private incrementClock(): VectorClock {
		this.vectorClock[this.nodeId] = (this.vectorClock[this.nodeId] || 0) + 1;
		return { ...this.vectorClock };
	}

	/**
	 * Merge vector clocks (take maximum for each node)
	 */
	private mergeVectorClocks(clock1: VectorClock, clock2: VectorClock): VectorClock {
		const merged: VectorClock = { ...clock1 };
		for (const [nodeId, timestamp] of Object.entries(clock2)) {
			merged[nodeId] = Math.max(merged[nodeId] || 0, timestamp);
		}
		return merged;
	}

	/**
	 * Compare vector clocks to determine causality
	 * Returns: 'before' | 'after' | 'concurrent'
	 */
	private compareVectorClocks(clock1: VectorClock, clock2: VectorClock): string {
		let hasLess = false;
		let hasGreater = false;

		const allNodes = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

		for (const nodeId of allNodes) {
			const t1 = clock1[nodeId] || 0;
			const t2 = clock2[nodeId] || 0;

			if (t1 < t2) hasLess = true;
			if (t1 > t2) hasGreater = true;
		}

		if (hasLess && !hasGreater) return "before";
		if (hasGreater && !hasLess) return "after";
		return "concurrent";
	}

	/**
	 * Create a new node with CRDT metadata
	 */
	createNode(node: Node): CRDTAtom {
		const vectorClock = this.incrementClock();
		const crdtAtom: CRDTAtom = {
			...node,
			vectorClock,
			lastModified: Date.now(),
			originNode: this.nodeId,
		};

		this.atoms.set(node.id, crdtAtom);

		// Record operation for gossip protocol
		this.operations.push({
			type: "create_node",
			atom: node,
			timestamp: Date.now(),
			vectorClock,
		});

		return crdtAtom;
	}

	/**
	 * Create a new link with CRDT metadata
	 */
	createLink(link: Link): CRDTAtom {
		const vectorClock = this.incrementClock();
		const crdtAtom: CRDTAtom = {
			...link,
			vectorClock,
			lastModified: Date.now(),
			originNode: this.nodeId,
		};

		this.atoms.set(link.id, crdtAtom);

		this.operations.push({
			type: "create_link",
			atom: link,
			timestamp: Date.now(),
			vectorClock,
		});

		return crdtAtom;
	}

	/**
	 * Update truth value with conflict resolution
	 */
	updateTruthValue(atomId: string, truthValue: TruthValue): CRDTAtom | null {
		const atom = this.atoms.get(atomId);
		if (!atom || atom.tombstone) return null;

		const vectorClock = this.incrementClock();
		const updatedAtom: CRDTAtom = {
			...atom,
			truthValue,
			vectorClock,
			lastModified: Date.now(),
		};

		this.atoms.set(atomId, updatedAtom);

		this.operations.push({
			type: "update_truth",
			atomId,
			truthValue,
			timestamp: Date.now(),
			vectorClock,
		});

		return updatedAtom;
	}

	/**
	 * Update attention value with conflict resolution
	 */
	updateAttentionValue(atomId: string, attentionValue: AttentionValue): CRDTAtom | null {
		const atom = this.atoms.get(atomId);
		if (!atom || atom.tombstone) return null;

		const vectorClock = this.incrementClock();
		const updatedAtom: CRDTAtom = {
			...atom,
			attentionValue,
			vectorClock,
			lastModified: Date.now(),
		};

		this.atoms.set(atomId, updatedAtom);

		this.operations.push({
			type: "update_attention",
			atomId,
			attentionValue,
			timestamp: Date.now(),
			vectorClock,
		});

		return updatedAtom;
	}

	/**
	 * Soft delete an atom (tombstone)
	 */
	deleteAtom(atomId: string): boolean {
		const atom = this.atoms.get(atomId);
		if (!atom) return false;

		const vectorClock = this.incrementClock();
		const tombstonedAtom: CRDTAtom = {
			...atom,
			tombstone: true,
			vectorClock,
			lastModified: Date.now(),
		};

		this.atoms.set(atomId, tombstonedAtom);

		this.operations.push({
			type: "delete_atom",
			atomId,
			timestamp: Date.now(),
			vectorClock,
		});

		return true;
	}

	/**
	 * Merge operations from remote node (Gossip protocol)
	 */
	mergeOperations(remoteOps: CRDTOperation[]): void {
		for (const op of remoteOps) {
			// Merge vector clocks
			this.vectorClock = this.mergeVectorClocks(this.vectorClock, op.vectorClock);

			// Apply operation with conflict resolution
			switch (op.type) {
				case "create_node":
				case "create_link":
					this.mergeAtom(op.atom as CRDTAtom);
					break;

				case "update_truth":
					this.mergeTruthUpdate(op.atomId, op.truthValue, op.vectorClock, op.timestamp);
					break;

				case "update_attention":
					this.mergeAttentionUpdate(op.atomId, op.attentionValue, op.vectorClock, op.timestamp);
					break;

				case "delete_atom":
					this.mergeDelete(op.atomId, op.vectorClock, op.timestamp);
					break;
			}
		}
	}

	/**
	 * Merge atom creation with conflict resolution
	 */
	private mergeAtom(remoteAtom: CRDTAtom): void {
		const localAtom = this.atoms.get(remoteAtom.id);

		if (!localAtom) {
			// New atom, just add it
			this.atoms.set(remoteAtom.id, remoteAtom);
			return;
		}

		// Conflict resolution using vector clocks
		const comparison = this.compareVectorClocks(localAtom.vectorClock, remoteAtom.vectorClock);

		if (comparison === "before") {
			// Remote is newer, replace local
			this.atoms.set(remoteAtom.id, remoteAtom);
		} else if (comparison === "concurrent") {
			// Concurrent updates - use Last-Write-Wins with timestamp
			if (remoteAtom.lastModified > localAtom.lastModified) {
				this.atoms.set(remoteAtom.id, remoteAtom);
			}
		}
		// If comparison === "after", local is newer, keep it
	}

	/**
	 * Merge truth value update
	 */
	private mergeTruthUpdate(
		atomId: string,
		truthValue: TruthValue,
		vectorClock: VectorClock,
		timestamp: number
	): void {
		const localAtom = this.atoms.get(atomId);
		if (!localAtom || localAtom.tombstone) return;

		const comparison = this.compareVectorClocks(localAtom.vectorClock, vectorClock);

		if (comparison === "before" || (comparison === "concurrent" && timestamp > localAtom.lastModified)) {
			const updatedAtom: CRDTAtom = {
				...localAtom,
				truthValue,
				vectorClock: this.mergeVectorClocks(localAtom.vectorClock, vectorClock),
				lastModified: timestamp,
			};
			this.atoms.set(atomId, updatedAtom);
		}
	}

	/**
	 * Merge attention value update
	 */
	private mergeAttentionUpdate(
		atomId: string,
		attentionValue: AttentionValue,
		vectorClock: VectorClock,
		timestamp: number
	): void {
		const localAtom = this.atoms.get(atomId);
		if (!localAtom || localAtom.tombstone) return;

		const comparison = this.compareVectorClocks(localAtom.vectorClock, vectorClock);

		if (comparison === "before" || (comparison === "concurrent" && timestamp > localAtom.lastModified)) {
			const updatedAtom: CRDTAtom = {
				...localAtom,
				attentionValue,
				vectorClock: this.mergeVectorClocks(localAtom.vectorClock, vectorClock),
				lastModified: timestamp,
			};
			this.atoms.set(atomId, updatedAtom);
		}
	}

	/**
	 * Merge delete operation
	 */
	private mergeDelete(atomId: string, vectorClock: VectorClock, timestamp: number): void {
		const localAtom = this.atoms.get(atomId);
		if (!localAtom) return;

		const comparison = this.compareVectorClocks(localAtom.vectorClock, vectorClock);

		if (comparison === "before" || (comparison === "concurrent" && timestamp > localAtom.lastModified)) {
			const tombstonedAtom: CRDTAtom = {
				...localAtom,
				tombstone: true,
				vectorClock: this.mergeVectorClocks(localAtom.vectorClock, vectorClock),
				lastModified: timestamp,
			};
			this.atoms.set(atomId, tombstonedAtom);
		}
	}

	/**
	 * Get all operations since a given vector clock (for gossip)
	 */
	getOperationsSince(sinceVectorClock: VectorClock): CRDTOperation[] {
		return this.operations.filter((op) => {
			const comparison = this.compareVectorClocks(sinceVectorClock, op.vectorClock);
			return comparison === "before";
		});
	}

	/**
	 * Get all active atoms (non-tombstoned)
	 */
	getAllAtoms(): CRDTAtom[] {
		return Array.from(this.atoms.values()).filter((atom) => !atom.tombstone);
	}

	/**
	 * Get atom by ID
	 */
	getAtom(atomId: string): CRDTAtom | null {
		const atom = this.atoms.get(atomId);
		return atom && !atom.tombstone ? atom : null;
	}

	/**
	 * Query atoms by type
	 */
	queryByType(type: string): CRDTAtom[] {
		return this.getAllAtoms().filter((atom) => atom.type === type);
	}

	/**
	 * Get current vector clock
	 */
	getVectorClock(): VectorClock {
		return { ...this.vectorClock };
	}

	/**
	 * Garbage collect old tombstones
	 */
	garbageCollectTombstones(maxAge: number): number {
		const now = Date.now();
		let collected = 0;

		for (const [atomId, atom] of this.atoms.entries()) {
			if (atom.tombstone && now - atom.lastModified > maxAge) {
				this.atoms.delete(atomId);
				collected++;
			}
		}

		return collected;
	}

	/**
	 * Get statistics
	 */
	getStats() {
		const atoms = Array.from(this.atoms.values());
		return {
			totalAtoms: atoms.length,
			activeAtoms: atoms.filter((a) => !a.tombstone).length,
			tombstones: atoms.filter((a) => a.tombstone).length,
			operations: this.operations.length,
			vectorClock: this.vectorClock,
			nodeId: this.nodeId,
		};
	}
}

/**
 * Gossip Protocol Manager for distributed synchronization
 */
export class GossipProtocolManager {
	private crdtAtomSpace: CRDTAtomSpace;
	private peers: Set<string> = new Set();
	private syncInterval: number = 5000; // 5 seconds

	constructor(crdtAtomSpace: CRDTAtomSpace) {
		this.crdtAtomSpace = crdtAtomSpace;
	}

	/**
	 * Add peer node
	 */
	addPeer(peerId: string): void {
		this.peers.add(peerId);
	}

	/**
	 * Remove peer node
	 */
	removePeer(peerId: string): void {
		this.peers.delete(peerId);
	}

	/**
	 * Gossip operations to random peer subset
	 */
	async gossipToPeers(peerVectorClocks: Map<string, VectorClock>): Promise<Map<string, CRDTOperation[]>> {
		const messages = new Map<string, CRDTOperation[]>();

		for (const peerId of this.peers) {
			const peerClock = peerVectorClocks.get(peerId) || {};
			const operations = this.crdtAtomSpace.getOperationsSince(peerClock);

			if (operations.length > 0) {
				messages.set(peerId, operations);
			}
		}

		return messages;
	}

	/**
	 * Receive and merge operations from peer
	 */
	receiveGossip(peerId: string, operations: CRDTOperation[]): void {
		this.crdtAtomSpace.mergeOperations(operations);
	}

	/**
	 * Get current state for synchronization
	 */
	getSyncState() {
		return {
			vectorClock: this.crdtAtomSpace.getVectorClock(),
			stats: this.crdtAtomSpace.getStats(),
		};
	}
}
