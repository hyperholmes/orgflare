/**
 * CRDT AtomSpace Coordinator - Durable Object
 * 
 * Implements distributed coordination for CRDT-based AtomSpace across
 * CloudFlare's edge network. This Durable Object manages:
 * 
 * 1. Gossip protocol for state synchronization
 * 2. Vector clock management for causality tracking
 * 3. Conflict resolution for concurrent updates
 * 4. Network partition handling
 * 5. Peer discovery and health monitoring
 * 
 * This enables truly distributed cognitive processing where multiple
 * AtomSpace instances can operate independently and eventually converge
 * to a consistent state without central coordination.
 */

import { DurableObject } from "cloudflare:workers";
import { Env } from "../types/cognitive";
import {
	CRDTAtomSpace,
	CRDTOperation,
	VectorClock,
	GossipProtocolManager,
} from "../core/distributed/CRDTAtomSpace";

/**
 * Peer information for distributed coordination
 */
interface PeerInfo {
	peerId: string;
	lastSeen: number;
	vectorClock: VectorClock;
	health: "healthy" | "degraded" | "unreachable";
	latency: number;
}

/**
 * Synchronization request
 */
interface SyncRequest {
	requestId: string;
	fromPeerId: string;
	vectorClock: VectorClock;
	timestamp: number;
}

/**
 * Synchronization response
 */
interface SyncResponse {
	requestId: string;
	operations: CRDTOperation[];
	vectorClock: VectorClock;
	timestamp: number;
}

/**
 * CRDT AtomSpace Coordinator Durable Object
 * 
 * Each instance represents a distributed AtomSpace node that can
 * synchronize with other nodes via gossip protocol.
 */
export class CRDTAtomSpaceCoordinator extends DurableObject<Env> {
	private crdtAtomSpace: CRDTAtomSpace;
	private gossipManager: GossipProtocolManager;
	private peers: Map<string, PeerInfo> = new Map();
	private nodeId: string;
	private syncInterval: number = 5000; // 5 seconds
	private healthCheckInterval: number = 10000; // 10 seconds
	private syncAlarm: boolean = false;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.nodeId = ctx.id.toString();
		this.crdtAtomSpace = new CRDTAtomSpace(this.nodeId);
		this.gossipManager = new GossipProtocolManager(this.crdtAtomSpace);
	}

	/**
	 * Initialize the coordinator
	 */
	async initialize(): Promise<void> {
		// Load persisted state
		await this.loadState();

		// Start periodic synchronization
		await this.scheduleSyncAlarm();
	}

	/**
	 * Handle HTTP requests
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			// Node operations
			if (path === "/node" && request.method === "POST") {
				return this.handleCreateNode(request);
			}

			// Link operations
			if (path === "/link" && request.method === "POST") {
				return this.handleCreateLink(request);
			}

			// Update operations
			if (path === "/update/truth" && request.method === "PUT") {
				return this.handleUpdateTruth(request);
			}

			if (path === "/update/attention" && request.method === "PUT") {
				return this.handleUpdateAttention(request);
			}

			// Query operations
			if (path === "/query" && request.method === "GET") {
				return this.handleQuery(request);
			}

			if (path === "/atom" && request.method === "GET") {
				return this.handleGetAtom(request);
			}

			// Synchronization operations
			if (path === "/sync/request" && request.method === "POST") {
				return this.handleSyncRequest(request);
			}

			if (path === "/sync/response" && request.method === "POST") {
				return this.handleSyncResponse(request);
			}

			// Peer management
			if (path === "/peer/register" && request.method === "POST") {
				return this.handleRegisterPeer(request);
			}

			if (path === "/peer/heartbeat" && request.method === "POST") {
				return this.handleHeartbeat(request);
			}

			// Status and diagnostics
			if (path === "/status" && request.method === "GET") {
				return this.handleGetStatus(request);
			}

			return new Response("Not Found", { status: 404 });
		} catch (error) {
			console.error("Request handling error:", error);
			return new Response(JSON.stringify({ error: String(error) }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	/**
	 * Handle alarm for periodic synchronization
	 */
	async alarm(): Promise<void> {
		try {
			// Perform gossip synchronization
			await this.performGossipSync();

			// Health check peers
			await this.performHealthCheck();

			// Garbage collect old tombstones
			this.crdtAtomSpace.garbageCollectTombstones(86400000); // 24 hours

			// Persist state
			await this.persistState();

			// Schedule next alarm
			await this.scheduleSyncAlarm();
		} catch (error) {
			console.error("Alarm error:", error);
			// Retry alarm
			await this.scheduleSyncAlarm();
		}
	}

	/**
	 * Create node
	 */
	private async handleCreateNode(request: Request): Promise<Response> {
		const body = await request.json();
		const { type, name, truthValue, attentionValue } = body;

		const node = {
			id: crypto.randomUUID(),
			type,
			name,
			truthValue: truthValue || { strength: 0.5, confidence: 0.5 },
			attentionValue: attentionValue || { sti: 0, lti: 0, vlti: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		const crdtAtom = this.crdtAtomSpace.createNode(node);

		return new Response(JSON.stringify(crdtAtom), {
			headers: { "Content-Type": "application/json" },
		});
	}

	/**
	 * Create link
	 */
	private async handleCreateLink(request: Request): Promise<Response> {
		const body = await request.json();
		const { type, outgoing, truthValue, attentionValue } = body;

		const link = {
			id: crypto.randomUUID(),
			type,
			outgoing,
			truthValue: truthValue || { strength: 0.5, confidence: 0.5 },
			attentionValue: attentionValue || { sti: 0, lti: 0, vlti: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		const crdtAtom = this.crdtAtomSpace.createLink(link);

		return new Response(JSON.stringify(crdtAtom), {
			headers: { "Content-Type": "application/json" },
		});
	}

	/**
	 * Update truth value
	 */
	private async handleUpdateTruth(request: Request): Promise<Response> {
		const body = await request.json();
		const { atomId, truthValue } = body;

		const updatedAtom = this.crdtAtomSpace.updateTruthValue(atomId, truthValue);

		if (!updatedAtom) {
			return new Response(JSON.stringify({ error: "Atom not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response(JSON.stringify(updatedAtom), {
			headers: { "Content-Type": "application/json" },
		});
	}

	/**
	 * Update attention value
	 */
	private async handleUpdateAttention(request: Request): Promise<Response> {
		const body = await request.json();
		const { atomId, attentionValue } = body;

		const updatedAtom = this.crdtAtomSpace.updateAttentionValue(
			atomId,
			attentionValue
		);

		if (!updatedAtom) {
			return new Response(JSON.stringify({ error: "Atom not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response(JSON.stringify(updatedAtom), {
			headers: { "Content-Type": "application/json" },
		});
	}

	/**
	 * Query atoms
	 */
	private async handleQuery(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const type = url.searchParams.get("type");

		let atoms;
		if (type) {
			atoms = this.crdtAtomSpace.queryByType(type);
		} else {
			atoms = this.crdtAtomSpace.getAllAtoms();
		}

		return new Response(JSON.stringify({ atoms, count: atoms.length }), {
			headers: { "Content-Type": "application/json" },
		});
	}

	/**
	 * Get single atom
	 */
	private async handleGetAtom(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const atomId = url.searchParams.get("id");

		if (!atomId) {
			return new Response(JSON.stringify({ error: "Missing atom ID" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const atom = this.crdtAtomSpace.getAtom(atomId);

		if (!atom) {
			return new Response(JSON.stringify({ error: "Atom not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response(JSON.stringify(atom), {
			headers: { "Content-Type": "application/json" },
		});
	}

	/**
	 * Handle synchronization request from peer
	 */
	private async handleSyncRequest(request: Request): Promise<Response> {
		const syncRequest: SyncRequest = await request.json();

		// Get operations since peer's vector clock
		const operations = this.crdtAtomSpace.getOperationsSince(
			syncRequest.vectorClock
		);

		const syncResponse: SyncResponse = {
			requestId: syncRequest.requestId,
			operations,
			vectorClock: this.crdtAtomSpace.getVectorClock(),
			timestamp: Date.now(),
		};

		// Update peer info
		this.updatePeerInfo(syncRequest.fromPeerId, syncRequest.vectorClock);

		return new Response(JSON.stringify(syncResponse), {
			headers: { "Content-Type": "application/json" },
		});
	}

	/**
	 * Handle synchronization response from peer
	 */
	private async handleSyncResponse(request: Request): Promise<Response> {
		const syncResponse: SyncResponse = await request.json();

		// Merge operations from peer
		this.crdtAtomSpace.mergeOperations(syncResponse.operations);

		return new Response(
			JSON.stringify({ success: true, mergedOperations: syncResponse.operations.length }),
			{
				headers: { "Content-Type": "application/json" },
			}
		);
	}

	/**
	 * Register peer
	 */
	private async handleRegisterPeer(request: Request): Promise<Response> {
		const body = await request.json();
		const { peerId } = body;

		this.gossipManager.addPeer(peerId);

		this.peers.set(peerId, {
			peerId,
			lastSeen: Date.now(),
			vectorClock: {},
			health: "healthy",
			latency: 0,
		});

		return new Response(
			JSON.stringify({ success: true, nodeId: this.nodeId }),
			{
				headers: { "Content-Type": "application/json" },
			}
		);
	}

	/**
	 * Handle heartbeat from peer
	 */
	private async handleHeartbeat(request: Request): Promise<Response> {
		const body = await request.json();
		const { peerId, vectorClock } = body;

		this.updatePeerInfo(peerId, vectorClock);

		return new Response(
			JSON.stringify({
				success: true,
				vectorClock: this.crdtAtomSpace.getVectorClock(),
			}),
			{
				headers: { "Content-Type": "application/json" },
			}
		);
	}

	/**
	 * Get status
	 */
	private async handleGetStatus(request: Request): Promise<Response> {
		const stats = this.crdtAtomSpace.getStats();
		const peerInfo = Array.from(this.peers.values());

		return new Response(
			JSON.stringify({
				nodeId: this.nodeId,
				stats,
				peers: peerInfo,
				syncInterval: this.syncInterval,
			}),
			{
				headers: { "Content-Type": "application/json" },
			}
		);
	}

	/**
	 * Perform gossip synchronization
	 */
	private async performGossipSync(): Promise<void> {
		const peerVectorClocks = new Map<string, VectorClock>();

		for (const [peerId, peerInfo] of this.peers.entries()) {
			peerVectorClocks.set(peerId, peerInfo.vectorClock);
		}

		// Get messages to gossip
		const messages = await this.gossipManager.gossipToPeers(peerVectorClocks);

		// Send messages to peers (would use actual network calls in production)
		for (const [peerId, operations] of messages.entries()) {
			console.log(
				`Gossiping ${operations.length} operations to peer ${peerId}`
			);
			// In production, send HTTP request to peer's sync endpoint
		}
	}

	/**
	 * Perform health check on peers
	 */
	private async performHealthCheck(): Promise<void> {
		const now = Date.now();
		const healthTimeout = 30000; // 30 seconds

		for (const [peerId, peerInfo] of this.peers.entries()) {
			const timeSinceLastSeen = now - peerInfo.lastSeen;

			if (timeSinceLastSeen > healthTimeout) {
				peerInfo.health = "unreachable";
			} else if (timeSinceLastSeen > healthTimeout / 2) {
				peerInfo.health = "degraded";
			} else {
				peerInfo.health = "healthy";
			}
		}
	}

	/**
	 * Update peer information
	 */
	private updatePeerInfo(peerId: string, vectorClock: VectorClock): void {
		const existing = this.peers.get(peerId);

		this.peers.set(peerId, {
			peerId,
			lastSeen: Date.now(),
			vectorClock,
			health: "healthy",
			latency: existing?.latency || 0,
		});
	}

	/**
	 * Schedule synchronization alarm
	 */
	private async scheduleSyncAlarm(): Promise<void> {
		if (!this.syncAlarm) {
			await this.ctx.storage.setAlarm(Date.now() + this.syncInterval);
			this.syncAlarm = true;
		}
	}

	/**
	 * Load state from storage
	 */
	private async loadState(): Promise<void> {
		// Load peers
		const peersData = await this.ctx.storage.get<string>("peers");
		if (peersData) {
			const peers = JSON.parse(peersData);
			for (const peer of peers) {
				this.peers.set(peer.peerId, peer);
				this.gossipManager.addPeer(peer.peerId);
			}
		}
	}

	/**
	 * Persist state to storage
	 */
	private async persistState(): Promise<void> {
		// Persist peers
		const peers = Array.from(this.peers.values());
		await this.ctx.storage.put("peers", JSON.stringify(peers));

		// Persist stats
		const stats = this.crdtAtomSpace.getStats();
		await this.ctx.storage.put("stats", JSON.stringify(stats));
	}
}
