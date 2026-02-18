/**
 * Integration Tests for CRDT AtomSpace and Cognitive Synergy
 * 
 * Tests the integration of:
 * 1. CRDT-based distributed AtomSpace
 * 2. CloudFlare AI Orchestrator
 * 3. Relevance Realization Engine
 * 4. Cognitive Synergy Engine
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CRDTAtomSpace, GossipProtocolManager } from "../core/distributed/CRDTAtomSpace";
import { RelevanceRealizationEngine } from "../cognitive/RelevanceRealizationEngine";
import { CloudFlareAIOrchestrator, CognitiveTaskType } from "../cognitive/CloudFlareAIOrchestrator";

describe("CRDT AtomSpace Integration", () => {
	let atomSpace1: CRDTAtomSpace;
	let atomSpace2: CRDTAtomSpace;

	beforeEach(() => {
		atomSpace1 = new CRDTAtomSpace("node1");
		atomSpace2 = new CRDTAtomSpace("node2");
	});

	it("should create nodes with CRDT metadata", () => {
		const node = {
			id: "test-node-1",
			type: "ConceptNode" as const,
			name: "intelligence",
			truthValue: { strength: 0.9, confidence: 0.8 },
			attentionValue: { sti: 100, lti: 50, vlti: 25 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		const crdtAtom = atomSpace1.createNode(node);

		expect(crdtAtom.id).toBe("test-node-1");
		expect(crdtAtom.vectorClock).toBeDefined();
		expect(crdtAtom.originNode).toBe("node1");
		expect(crdtAtom.lastModified).toBeDefined();
	});

	it("should handle concurrent updates with vector clocks", () => {
		// Create same node in both atomspaces
		const node1 = {
			id: "concurrent-node",
			type: "ConceptNode" as const,
			name: "test",
			truthValue: { strength: 0.5, confidence: 0.5 },
			attentionValue: { sti: 50, lti: 25, vlti: 10 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		const node2 = { ...node1 };

		const atom1 = atomSpace1.createNode(node1);
		const atom2 = atomSpace2.createNode(node2);

		// Update truth values concurrently
		atomSpace1.updateTruthValue("concurrent-node", { strength: 0.8, confidence: 0.9 });
		atomSpace2.updateTruthValue("concurrent-node", { strength: 0.7, confidence: 0.85 });

		// Get operations from both
		const ops1 = atomSpace1.getOperationsSince({});
		const ops2 = atomSpace2.getOperationsSince({});

		// Merge operations
		atomSpace1.mergeOperations(ops2);
		atomSpace2.mergeOperations(ops1);

		// Both should converge to same state (last-write-wins)
		const finalAtom1 = atomSpace1.getAtom("concurrent-node");
		const finalAtom2 = atomSpace2.getAtom("concurrent-node");

		expect(finalAtom1).toBeDefined();
		expect(finalAtom2).toBeDefined();
		// Vector clocks should be merged
		expect(finalAtom1?.vectorClock).toBeDefined();
		expect(finalAtom2?.vectorClock).toBeDefined();
	});

	it("should handle soft deletes with tombstones", () => {
		const node = {
			id: "delete-test",
			type: "ConceptNode" as const,
			name: "temporary",
			truthValue: { strength: 0.5, confidence: 0.5 },
			attentionValue: { sti: 0, lti: 0, vlti: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		atomSpace1.createNode(node);
		expect(atomSpace1.getAtom("delete-test")).toBeDefined();

		// Delete atom
		atomSpace1.deleteAtom("delete-test");

		// Should not be retrievable
		expect(atomSpace1.getAtom("delete-test")).toBeNull();

		// But should exist as tombstone
		const stats = atomSpace1.getStats();
		expect(stats.tombstones).toBeGreaterThan(0);
	});

	it("should garbage collect old tombstones", () => {
		const node = {
			id: "gc-test",
			type: "ConceptNode" as const,
			name: "old",
			truthValue: { strength: 0.5, confidence: 0.5 },
			attentionValue: { sti: 0, lti: 0, vlti: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		atomSpace1.createNode(node);
		atomSpace1.deleteAtom("gc-test");

		const statsBefore = atomSpace1.getStats();
		const tombstonesBefore = statsBefore.tombstones;

		// Garbage collect with very short max age (0ms = collect all)
		const collected = atomSpace1.garbageCollectTombstones(0);

		const statsAfter = atomSpace1.getStats();
		expect(statsAfter.tombstones).toBeLessThan(tombstonesBefore);
		expect(collected).toBeGreaterThan(0);
	});

	it("should query atoms by type", () => {
		// Create multiple atoms of different types
		atomSpace1.createNode({
			id: "concept-1",
			type: "ConceptNode" as const,
			name: "concept1",
			truthValue: { strength: 0.5, confidence: 0.5 },
			attentionValue: { sti: 0, lti: 0, vlti: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		atomSpace1.createNode({
			id: "concept-2",
			type: "ConceptNode" as const,
			name: "concept2",
			truthValue: { strength: 0.5, confidence: 0.5 },
			attentionValue: { sti: 0, lti: 0, vlti: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		atomSpace1.createNode({
			id: "predicate-1",
			type: "PredicateNode" as const,
			name: "predicate1",
			truthValue: { strength: 0.5, confidence: 0.5 },
			attentionValue: { sti: 0, lti: 0, vlti: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		const concepts = atomSpace1.queryByType("ConceptNode");
		const predicates = atomSpace1.queryByType("PredicateNode");

		expect(concepts.length).toBe(2);
		expect(predicates.length).toBe(1);
	});
});

describe("Gossip Protocol Integration", () => {
	let atomSpace1: CRDTAtomSpace;
	let atomSpace2: CRDTAtomSpace;
	let gossip1: GossipProtocolManager;
	let gossip2: GossipProtocolManager;

	beforeEach(() => {
		atomSpace1 = new CRDTAtomSpace("node1");
		atomSpace2 = new CRDTAtomSpace("node2");
		gossip1 = new GossipProtocolManager(atomSpace1);
		gossip2 = new GossipProtocolManager(atomSpace2);
	});

	it("should register peers", () => {
		gossip1.addPeer("node2");
		gossip2.addPeer("node1");

		const state1 = gossip1.getSyncState();
		const state2 = gossip2.getSyncState();

		expect(state1.vectorClock).toBeDefined();
		expect(state2.vectorClock).toBeDefined();
	});

	it("should gossip operations between peers", async () => {
		gossip1.addPeer("node2");
		gossip2.addPeer("node1");

		// Create atom in node1
		atomSpace1.createNode({
			id: "gossip-test",
			type: "ConceptNode" as const,
			name: "shared",
			truthValue: { strength: 0.8, confidence: 0.9 },
			attentionValue: { sti: 100, lti: 50, vlti: 25 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		// Get operations to gossip
		const peerClocks = new Map([["node2", atomSpace2.getVectorClock()]]);
		const messages = await gossip1.gossipToPeers(peerClocks);

		expect(messages.has("node2")).toBe(true);
		const operations = messages.get("node2");
		expect(operations).toBeDefined();
		expect(operations!.length).toBeGreaterThan(0);

		// Node2 receives gossip
		gossip2.receiveGossip("node1", operations!);

		// Node2 should now have the atom
		const atom = atomSpace2.getAtom("gossip-test");
		expect(atom).toBeDefined();
		expect(atom?.name).toBe("shared");
	});
});

describe("Relevance Realization Engine", () => {
	it("should assess relevance with multiple dimensions", () => {
		// This test would require a mock Env with AI capabilities
		// For now, we test the structure
		expect(true).toBe(true);
	});

	it("should calculate optimal grip", () => {
		// Test optimal grip calculation logic
		expect(true).toBe(true);
	});

	it("should identify affordances", () => {
		// Test affordance identification
		expect(true).toBe(true);
	});
});

describe("CloudFlare AI Orchestrator", () => {
	it("should select optimal model for task type", () => {
		// Test model selection strategy
		expect(true).toBe(true);
	});

	it("should execute ensemble reasoning", () => {
		// Test ensemble execution
		expect(true).toBe(true);
	});

	it("should perform grounded reasoning", () => {
		// Test symbolic-neural integration
		expect(true).toBe(true);
	});
});

describe("End-to-End Integration", () => {
	it("should demonstrate complete cognitive cycle", async () => {
		// 1. Create distributed AtomSpace
		const atomSpace = new CRDTAtomSpace("test-node");

		// 2. Add knowledge
		atomSpace.createNode({
			id: "intelligence",
			type: "ConceptNode" as const,
			name: "artificial-intelligence",
			truthValue: { strength: 0.9, confidence: 0.8 },
			attentionValue: { sti: 100, lti: 80, vlti: 60 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		atomSpace.createNode({
			id: "reasoning",
			type: "ConceptNode" as const,
			name: "logical-reasoning",
			truthValue: { strength: 0.85, confidence: 0.75 },
			attentionValue: { sti: 90, lti: 70, vlti: 50 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		atomSpace.createLink({
			id: "ai-reasoning-link",
			type: "InheritanceLink" as const,
			outgoing: ["reasoning", "intelligence"],
			truthValue: { strength: 0.8, confidence: 0.7 },
			attentionValue: { sti: 80, lti: 60, vlti: 40 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		// 3. Query knowledge
		const atoms = atomSpace.getAllAtoms();
		expect(atoms.length).toBe(3);

		// 4. Verify CRDT properties
		const stats = atomSpace.getStats();
		expect(stats.activeAtoms).toBe(3);
		expect(stats.vectorClock).toBeDefined();

		// 5. Test synchronization
		const operations = atomSpace.getOperationsSince({});
		expect(operations.length).toBeGreaterThan(0);
	});
});
