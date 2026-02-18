/**
 * FlareCog v3.0 - Complete OpenCog-CloudFlare Integration
 * 
 * Deep integration of OpenCog AGI Cognitive Architecture with CloudFlare Workers
 * featuring AI-enhanced reasoning, distributed coordination, tiered storage,
 * and real-time WebSocket streaming.
 */

import { Hono } from "hono";
import {
	Env,
	Atom,
	Node,
	Link,
	TruthValue,
	AttentionValue,
} from "./types/cognitive";
import { AtomSpace } from "./durable-objects/AtomSpace";
import { MindAgent } from "./durable-objects/MindAgent";
import { CloudFlareAIIntegration } from "./cognitive/CloudFlareAIIntegration";
import { D1CoordinationLayer } from "./core/distributed/D1CoordinationLayer";
import { R2AtomSpaceStorage } from "./storage/R2AtomSpaceStorage";
import {
	CognitiveEventPublisher,
	CognitiveWebSocketManager,
} from "./streaming/CognitiveWebSocket";
import { PatternMatcher } from "./cognitive/PatternMatcher";
import { AIEnhancedReasoning } from "./cognitive/AIEnhancedReasoning";

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use("*", async (c, next) => {
	c.res.headers.set("Access-Control-Allow-Origin", "*");
	c.res.headers.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, OPTIONS",
	);
	c.res.headers.set(
		"Access-Control-Allow-Headers",
		"Content-Type, Authorization",
	);

	if (c.req.method === "OPTIONS") {
		return c.text("", 200);
	}

	await next();
});

/**
 * Root endpoint - Platform status with comprehensive metrics
 */
app.get("/", async (c) => {
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

	const coordination = new D1CoordinationLayer(c.env);
	const storage = new R2AtomSpaceStorage(c.env);

	try {
		const [atomSpaceStats, globalStats, storageStats] = await Promise.all([
			atomSpaceStub
				.fetch(new Request("http://dummy/stats"))
				.then((r) => r.json()),
			coordination.getGlobalStats(),
			storage.getStorageStats("primary"),
		]);

		return c.json({
			platform: "FlareCog v3.0: OpenCog AGI on CloudFlare Workers",
			version: "3.0.0",
			status: "active",
			features: {
				atomSpace: "Hypergraph Knowledge Representation",
				mindAgents: "Autonomous Cognitive Processes",
				plnReasoning: "Probabilistic Logic Networks",
				aiEnhancement: "CloudFlare Workers AI Integration",
				distributedCoordination: "D1-based Global Sync",
				tieredStorage: "R2 Cold Storage for Scale",
				realtimeStreaming: "WebSocket Event Broadcasting",
				relevanceRealization: "Cognitive Synergy Engine",
			},
			metrics: {
				atomSpace: atomSpaceStats,
				distributed: globalStats,
				storage: storageStats,
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		return c.json(
			{
				platform: "FlareCog v3.0",
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * AI-Enhanced Pattern Matching
 */
app.post("/api/cognitive/ai-pattern-match", async (c) => {
	try {
		const { pattern, useAI, instanceId } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName(instanceId || "primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Get all atoms
		const response = await atomSpaceStub.fetch(
			new Request("http://dummy/atoms"),
		);
		const atomsData = await response.json();
		const atoms = atomsData.data as Atom[];

		let results: Atom[];

		if (useAI) {
			// Use AI for semantic pattern matching
			const ai = new CloudFlareAIIntegration(c.env);
			results = await ai.naturalLanguageQuery(pattern, atoms);
		} else {
			// Use traditional pattern matching
			const matcher = new PatternMatcher();
			results = matcher.match(pattern, atoms);
		}

		return c.json({
			success: true,
			pattern,
			matchCount: results.length,
			matches: results,
			aiEnhanced: useAI,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * AI-Enhanced Inference
 */
app.post("/api/cognitive/ai-inference", async (c) => {
	try {
		const { premises, goal, instanceId } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName(instanceId || "primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Get premise atoms
		const premiseAtoms: Atom[] = [];
		for (const premiseId of premises) {
			const response = await atomSpaceStub.fetch(
				new Request(`http://dummy/atoms/${premiseId}`),
			);
			const data = await response.json();
			if (data.success) {
				premiseAtoms.push(data.data);
			}
		}

		// Perform AI-enhanced inference
		const ai = new CloudFlareAIIntegration(c.env);
		const inference = await ai.enhancedInference(premiseAtoms, goal);

		// Store conclusion in AtomSpace
		await atomSpaceStub.fetch(
			new Request("http://dummy/atoms", {
				method: "POST",
				body: JSON.stringify({
					type: "ConceptNode",
					name: inference.conclusion.name,
					truthValue: inference.truthValue,
				}),
			}),
		);

		// Publish event
		const publisher = new CognitiveEventPublisher(c.env);
		await publisher.publishAtomCreated(
			inference.conclusion,
			instanceId || "primary",
		);

		return c.json({
			success: true,
			conclusion: inference.conclusion,
			reasoning: inference.reasoning,
			confidence: inference.confidence,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * Semantic Similarity Calculation
 */
app.post("/api/cognitive/semantic-similarity", async (c) => {
	try {
		const { atom1Id, atom2Id, instanceId } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName(instanceId || "primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Get atoms
		const [response1, response2] = await Promise.all([
			atomSpaceStub.fetch(new Request(`http://dummy/atoms/${atom1Id}`)),
			atomSpaceStub.fetch(new Request(`http://dummy/atoms/${atom2Id}`)),
		]);

		const [data1, data2] = await Promise.all([
			response1.json(),
			response2.json(),
		]);

		if (!data1.success || !data2.success) {
			throw new Error("Failed to retrieve atoms");
		}

		const ai = new CloudFlareAIIntegration(c.env);
		const similarity = await ai.calculateSemanticSimilarity(
			data1.data,
			data2.data,
		);

		return c.json({
			success: true,
			similarity,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * Distributed Synchronization
 */
app.post("/api/distributed/sync", async (c) => {
	try {
		const { atomId, instanceId, vectorClock } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName(instanceId || "primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Get atom
		const response = await atomSpaceStub.fetch(
			new Request(`http://dummy/atoms/${atomId}`),
		);
		const data = await response.json();

		if (!data.success) {
			throw new Error("Atom not found");
		}

		// Sync to coordination layer
		const coordination = new D1CoordinationLayer(c.env);
		await coordination.syncAtom(data.data, instanceId, vectorClock);

		return c.json({
			success: true,
			message: "Atom synchronized",
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * Conflict Resolution
 */
app.post("/api/distributed/resolve-conflicts", async (c) => {
	try {
		const { atomId } = await c.req.json();

		const coordination = new D1CoordinationLayer(c.env);
		const resolution = await coordination.resolveConflicts(atomId);

		return c.json({
			success: true,
			resolution,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * Storage Tier Management
 */
app.post("/api/storage/rebalance", async (c) => {
	try {
		const { instanceId } = await c.req.json();

		const storage = new R2AtomSpaceStorage(c.env);
		const result = await storage.rebalanceTiers(instanceId || "primary");

		return c.json({
			success: true,
			promoted: result.promoted,
			demoted: result.demoted,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * Storage Statistics
 */
app.get("/api/storage/stats/:instanceId", async (c) => {
	try {
		const instanceId = c.req.param("instanceId");

		const storage = new R2AtomSpaceStorage(c.env);
		const stats = await storage.getStorageStats(instanceId);

		return c.json({
			success: true,
			stats,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * WebSocket Endpoint
 */
app.get("/ws", async (c) => {
	const upgradeHeader = c.req.header("Upgrade");
	if (upgradeHeader !== "websocket") {
		return c.text("Expected WebSocket", 426);
	}

	const wsManagerId = c.env.WS_MANAGER.idFromName("global");
	const wsManager = c.env.WS_MANAGER.get(wsManagerId);

	return wsManager.fetch(c.req.raw);
});

/**
 * Concept Explanation
 */
app.post("/api/cognitive/explain", async (c) => {
	try {
		const { atomId, instanceId } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName(instanceId || "primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Get atom
		const response = await atomSpaceStub.fetch(
			new Request(`http://dummy/atoms/${atomId}`),
		);
		const data = await response.json();

		if (!data.success) {
			throw new Error("Atom not found");
		}

		// Get context atoms (related atoms)
		const allAtomsResponse = await atomSpaceStub.fetch(
			new Request("http://dummy/atoms"),
		);
		const allAtomsData = await allAtomsResponse.json();
		const contextAtoms = (allAtomsData.data as Atom[]).slice(0, 10);

		// Generate explanation
		const ai = new CloudFlareAIIntegration(c.env);
		const explanation = await ai.explainConcept(data.data, contextAtoms);

		return c.json({
			success: true,
			atom: data.data,
			explanation,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * Pattern Discovery
 */
app.post("/api/cognitive/discover-patterns", async (c) => {
	try {
		const { instanceId } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName(instanceId || "primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Get atoms
		const response = await atomSpaceStub.fetch(
			new Request("http://dummy/atoms"),
		);
		const data = await response.json();

		const ai = new CloudFlareAIIntegration(c.env);
		const patterns = await ai.discoverPatterns(data.data);

		return c.json({
			success: true,
			patterns,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * Global Distributed Statistics
 */
app.get("/api/distributed/stats", async (c) => {
	try {
		const coordination = new D1CoordinationLayer(c.env);
		const stats = await coordination.getGlobalStats();

		return c.json({
			success: true,
			stats,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * Initialize Coordination Layer
 */
app.post("/api/distributed/initialize", async (c) => {
	try {
		const coordination = new D1CoordinationLayer(c.env);
		await coordination.initialize();

		return c.json({
			success: true,
			message: "Coordination layer initialized",
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * Register Instance
 */
app.post("/api/distributed/register", async (c) => {
	try {
		const { instanceId, region, capabilities } = await c.req.json();

		const coordination = new D1CoordinationLayer(c.env);
		await coordination.registerInstance(instanceId, region, capabilities);

		return c.json({
			success: true,
			message: "Instance registered",
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

/**
 * Health Check
 */
app.get("/health", async (c) => {
	return c.json({
		status: "healthy",
		timestamp: Date.now(),
		version: "3.0.0",
	});
});

export default app;

// Export Durable Objects
export { AtomSpace } from "./durable-objects/AtomSpace";
export { MindAgent } from "./durable-objects/MindAgent";
export { CognitiveWebSocketManager as WS_MANAGER } from "./streaming/CognitiveWebSocket";
