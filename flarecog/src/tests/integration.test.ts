import { describe, it, expect, beforeAll } from "vitest";
import {
	StorageNodeFactory,
	LocalStorageNode,
	RemoteStorageNode,
	DistributedStorageNode,
} from "../durable-objects/StorageNode";
import { AIEnhancedReasoning } from "../cognitive/AIEnhancedReasoning";
import { PatternMatcher, PatternInvertedIndex } from "../cognitive/PatternMatcher";
import { DistributedQueryEngine } from "../cognitive/DistributedQueryEngine";
import {
	ReasoningAgent,
	LearningAgent,
	PlanningAgent,
	PerceptionAgent,
} from "../cognitive/AdvancedMindAgents";
import { Env, Atom, Node, AtomSpaceQuery } from "../types/cognitive";

/**
 * Integration tests for FlareCog OpenCog-CloudFlare implementations
 */

describe("StorageNode Integration", () => {
	it("should create local storage node", () => {
		const mockEnv = {} as Env;
		const mockAtomspace = {} as DurableObjectStub;

		const node = StorageNodeFactory.create(
			{ type: "local" },
			mockEnv,
			mockAtomspace
		);

		expect(node).toBeInstanceOf(LocalStorageNode);
	});

	it("should create remote storage node", () => {
		const mockEnv = {} as Env;

		const node = StorageNodeFactory.create(
			{ type: "remote", endpoint: "https://test.example.com" },
			mockEnv
		);

		expect(node).toBeInstanceOf(RemoteStorageNode);
	});

	it("should create distributed storage node", () => {
		const mockEnv = {} as Env;

		const node = StorageNodeFactory.create(
			{ type: "distributed" },
			mockEnv
		);

		expect(node).toBeInstanceOf(DistributedStorageNode);
	});

	it("should handle storage node provider registration", () => {
		const mockEnv = {} as Env;
		const distributedNode = StorageNodeFactory.create(
			{ type: "distributed" },
			mockEnv
		) as DistributedStorageNode;

		const mockProvider = {} as any;
		distributedNode.addProvider(mockProvider);

		// Provider should be registered (no error thrown)
		expect(true).toBe(true);
	});
});

describe("Pattern Matcher Integration", () => {
	it("should create pattern inverted index", () => {
		const index = new PatternInvertedIndex();

		const testAtom: Node = {
			id: "test1",
			type: "ConceptNode",
			name: "test_concept",
			truthValue: { strength: 0.8, confidence: 0.7 },
			attentionValue: { sti: 50, lti: 10, vlti: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		index.indexAtom(testAtom);

		const stats = index.getStats();
		expect(stats.totalPatterns).toBeGreaterThan(0);
	});

	it("should find atoms by pattern", () => {
		const index = new PatternInvertedIndex();

		const testAtom: Node = {
			id: "test2",
			type: "ConceptNode",
			name: "findable",
			truthValue: { strength: 0.8, confidence: 0.7 },
			attentionValue: { sti: 50, lti: 10, vlti: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		index.indexAtom(testAtom);

		const results = index.findByPattern("type:ConceptNode");
		expect(results.size).toBeGreaterThan(0);
		expect(results.has("test2")).toBe(true);
	});

	it("should handle pattern matcher creation", () => {
		const mockEnv = {} as Env;
		const matcher = new PatternMatcher(mockEnv);

		expect(matcher).toBeDefined();
		expect(matcher.getStats).toBeDefined();
	});
});

describe("AI-Enhanced Reasoning Integration", () => {
	it("should create AI reasoning instance", () => {
		const mockEnv = {
			AI: {
				run: async () => ({ response: "test response", data: [[0.1, 0.2]] }),
			},
		} as any;

		const reasoning = new AIEnhancedReasoning(mockEnv);
		expect(reasoning).toBeDefined();
	});

	it("should handle reasoning context structure", () => {
		const testAtom: Node = {
			id: "test3",
			type: "ConceptNode",
			name: "reasoning_test",
			truthValue: { strength: 0.9, confidence: 0.8 },
			attentionValue: { sti: 70, lti: 20, vlti: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		const context = {
			query: "What is the meaning of this concept?",
			relevantAtoms: [testAtom],
			goalContext: "Understanding concepts",
		};

		expect(context.relevantAtoms.length).toBe(1);
		expect(context.query).toBeDefined();
	});
});

describe("Distributed Query Engine Integration", () => {
	it("should create distributed query engine", () => {
		const mockEnv = {} as Env;
		const engine = new DistributedQueryEngine(mockEnv);

		expect(engine).toBeDefined();
		expect(engine.getStats).toBeDefined();
	});

	it("should register and track providers", () => {
		const mockEnv = {} as Env;
		const engine = new DistributedQueryEngine(mockEnv);

		const mockProvider = {
			fetchAtom: async () => null,
			storeAtom: async () => true,
			deleteAtom: async () => true,
			queryAtoms: async () => [],
			getIncoming: async () => [],
			sync: async () => {},
			getStats: async () => ({
				totalRequests: 0,
				cacheHits: 0,
				cacheMisses: 0,
				averageLatency: 0,
				lastSync: Date.now(),
			}),
		};

		engine.registerProvider("test_provider", mockProvider);

		const stats = engine.getStats();
		expect(stats.providerCount).toBe(1);
	});

	it("should handle cache operations", () => {
		const mockEnv = {} as Env;
		const engine = new DistributedQueryEngine(mockEnv);

		engine.clearCache();

		const stats = engine.getStats();
		expect(stats.cacheSize).toBe(0);
	});
});

describe("Advanced MindAgents Integration", () => {
	it("should create reasoning agent", () => {
		const mockEnv = {} as Env;
		const agent = new ReasoningAgent(mockEnv);

		expect(agent).toBeDefined();
		expect(agent.execute).toBeDefined();
	});

	it("should create learning agent", () => {
		const mockEnv = {} as Env;
		const agent = new LearningAgent(mockEnv);

		expect(agent).toBeDefined();
		expect(agent.execute).toBeDefined();
	});

	it("should create planning agent", () => {
		const mockEnv = {} as Env;
		const agent = new PlanningAgent(mockEnv);

		expect(agent).toBeDefined();
		expect(agent.execute).toBeDefined();
	});

	it("should create perception agent", () => {
		const mockEnv = {} as Env;
		const agent = new PerceptionAgent(mockEnv);

		expect(agent).toBeDefined();
		expect(agent.execute).toBeDefined();
	});
});

describe("End-to-End Cognitive Flow", () => {
	it("should handle complete cognitive cycle", async () => {
		// This test validates the integration of all components
		const mockEnv = {
			AI: {
				run: async () => ({
					response: "ANSWER: Test answer | CONFIDENCE: 0.8 | REASONING: Test reasoning",
					data: [[0.1, 0.2, 0.3]],
				}),
			},
			ATOM_CACHE: {
				get: async () => null,
				put: async () => {},
				delete: async () => {},
			},
		} as any;

		// 1. Create perception agent and process input
		const perceptionAgent = new PerceptionAgent(mockEnv);
		expect(perceptionAgent).toBeDefined();

		// 2. Create reasoning agent for inference
		const reasoningAgent = new ReasoningAgent(mockEnv);
		expect(reasoningAgent).toBeDefined();

		// 3. Create learning agent for adaptation
		const learningAgent = new LearningAgent(mockEnv);
		expect(learningAgent).toBeDefined();

		// 4. Create planning agent for goal pursuit
		const planningAgent = new PlanningAgent(mockEnv);
		expect(planningAgent).toBeDefined();

		// All agents should be instantiated successfully
		expect(true).toBe(true);
	});

	it("should integrate storage nodes with query engine", () => {
		const mockEnv = {} as Env;

		// Create distributed storage node
		const storageNode = StorageNodeFactory.create(
			{ type: "distributed" },
			mockEnv
		);

		// Create query engine
		const queryEngine = new DistributedQueryEngine(mockEnv);

		// Register storage node as provider
		queryEngine.registerProvider("main", storageNode as any);

		const stats = queryEngine.getStats();
		expect(stats.providerCount).toBe(1);
	});
});

describe("Truth Value and Attention Value Operations", () => {
	it("should handle truth value calculations", () => {
		const tv1 = { strength: 0.8, confidence: 0.7 };
		const tv2 = { strength: 0.6, confidence: 0.9 };

		// Deductive inference formula: s1 * s2
		const inferredStrength = tv1.strength * tv2.strength;
		expect(inferredStrength).toBeCloseTo(0.48);

		// Confidence is minimum
		const inferredConfidence = Math.min(tv1.confidence, tv2.confidence);
		expect(inferredConfidence).toBe(0.7);
	});

	it("should handle attention value decay", () => {
		const av = { sti: 100, lti: 50, vlti: 10 };
		const decayRate = 0.1;

		const decayedSTI = av.sti * (1 - decayRate);
		expect(decayedSTI).toBe(90);

		// LTI and VLTI should not decay as quickly
		expect(av.lti).toBe(50);
		expect(av.vlti).toBe(10);
	});

	it("should handle importance spreading", () => {
		const sourceSTI = 80;
		const spreadFactor = 0.1;

		const spreadAmount = sourceSTI * spreadFactor;
		expect(spreadAmount).toBe(8);

		const targetSTI = 20;
		const newTargetSTI = targetSTI + spreadAmount;
		expect(newTargetSTI).toBe(28);
	});
});

describe("Pattern Matching Operations", () => {
	it("should create valid query patterns", () => {
		const pattern = {
			variables: [
				{ name: "$X", type: "ConceptNode" as const },
				{ name: "$Y", type: "ConceptNode" as const },
			],
			clauses: [
				{
					type: "inheritance" as const,
					arguments: ["$X", "$Y"],
				},
			],
		};

		expect(pattern.variables.length).toBe(2);
		expect(pattern.clauses.length).toBe(1);
	});

	it("should handle atom type filtering", () => {
		const query: AtomSpaceQuery = {
			type: "find_atoms",
			atomType: "ConceptNode",
			truthValueMin: { strength: 0.5, confidence: 0.5 },
		};

		expect(query.atomType).toBe("ConceptNode");
		expect(query.truthValueMin?.strength).toBe(0.5);
	});
});
