import { Hono } from "hono";
import {
	Env,
	CognitiveDashboardData,
	AtomSpaceResponse,
	QueryPattern,
} from "./types/cognitive";
import { AtomSpace } from "./durable-objects/AtomSpace";
import { MindAgent } from "./durable-objects/MindAgent";
import { PatternMatcher } from "./reasoning/PatternMatcher";
import { PLNRules } from "./reasoning/PLNRules";
import { EpisodicMemory } from "./memory/EpisodicMemory";
import { AtomCache, CacheStrategy } from "./memory/AtomCache";
import { PerceptionEngine } from "./perception/PerceptionEngine";

/**
 * Enhanced Cogflare OpenCog Worker Platform
 *
 * Integrated with:
 * - Pattern Matcher for advanced queries
 * - PLN inference rules
 * - D1 episodic memory
 * - KV atom caching
 * - Workers AI perception
 */

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
 * Initialize episodic memory on first request
 */
let episodicMemoryInitialized = false;

async function getEpisodicMemory(env: Env): Promise<EpisodicMemory> {
	const memory = new EpisodicMemory(env.COGNITIVE_DB);

	if (!episodicMemoryInitialized) {
		await memory.initialize();
		episodicMemoryInitialized = true;
	}

	return memory;
}

/**
 * Get atom cache instance
 */
function getAtomCache(env: Env): AtomCache {
	return new AtomCache(env.ATOM_CACHE);
}

/**
 * Root endpoint - Enhanced Platform Status
 */
app.get("/", async (c) => {
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

	const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
	const mindAgentStub = c.env.MIND_AGENT.get(mindAgentId);

	try {
		// Try to get cached stats first
		const cache = getAtomCache(c.env);
		let atomSpaceStats = await cache.getCachedStats();

		if (!atomSpaceStats) {
			// Fetch fresh stats
			const atomSpaceResponse = await atomSpaceStub.fetch(
				new Request("http://dummy/stats"),
			);
			const atomSpaceData =
				(await atomSpaceResponse.json()) as AtomSpaceResponse;
			atomSpaceStats = atomSpaceData.data;

			// Cache for 60 seconds
			await cache.cacheStats(atomSpaceStats, 60);
		}

		const agentsResponse = await mindAgentStub.fetch(
			new Request("http://dummy/agents"),
		);
		const agentsData = (await agentsResponse.json()) as AtomSpaceResponse;

		const goalsResponse = await mindAgentStub.fetch(
			new Request("http://dummy/goals"),
		);
		const goalsData = (await goalsResponse.json()) as AtomSpaceResponse;

		const status = {
			platform: "Cogflare OpenCog Platform (Enhanced)",
			version: "2.0.0",
			status: "active",
			features: {
				patternMatcher: true,
				plnInference: true,
				episodicMemory: true,
				atomCache: true,
				perception: true,
			},
			atomSpace: atomSpaceStats,
			mindAgents: {
				total: agentsData.success ? (agentsData.data as any[]).length : 0,
				active: agentsData.success
					? (agentsData.data as any[]).filter((a: any) => a.enabled).length
					: 0,
			},
			goals: {
				total: goalsData.success ? (goalsData.data as any[]).length : 0,
				active: goalsData.success
					? (goalsData.data as any[]).filter((g: any) => g.status === "active")
							.length
					: 0,
			},
			cache: cache.getCacheStats(),
			timestamp: Date.now(),
		};

		return c.json(status);
	} catch (error) {
		return c.json(
			{
				platform: "Cogflare OpenCog Platform (Enhanced)",
				version: "2.0.0",
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: Date.now(),
			},
			500,
		);
	}
});

/**
 * Pattern Matching API
 */
app.post("/api/pattern/match", async (c) => {
	try {
		const { pattern } = (await c.req.json()) as { pattern: QueryPattern };

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Execute pattern matching
		const results = await PatternMatcher.matchPattern(pattern, atomSpaceStub);

		return c.json({
			success: true,
			matches: results.length,
			results,
			timestamp: Date.now(),
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
 * PLN Inference API
 */
app.post("/api/reasoning/infer", async (c) => {
	try {
		const { rule, premises } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Get premise atoms
		const premiseAtoms = await Promise.all(
			premises.map(async (id: string) => {
				const response = await atomSpaceStub.fetch(
					new Request(`http://dummy/atom/${id}`),
				);
				const data = await response.json();
				return data.success ? data.data : null;
			}),
		);

		// Apply inference rule
		let result;
		switch (rule) {
			case "deduction":
				if (premiseAtoms.length >= 2) {
					result = PLNRules.deduction(
						premiseAtoms[0].truthValue,
						premiseAtoms[1].truthValue,
					);
				}
				break;
			case "induction":
				if (premiseAtoms.length >= 2) {
					result = PLNRules.induction(
						premiseAtoms[0].truthValue,
						premiseAtoms[1].truthValue,
					);
				}
				break;
			case "abduction":
				if (premiseAtoms.length >= 2) {
					result = PLNRules.abduction(
						premiseAtoms[0].truthValue,
						premiseAtoms[1].truthValue,
					);
				}
				break;
			case "revision":
				if (premiseAtoms.length >= 2) {
					result = PLNRules.revision(
						premiseAtoms[0].truthValue,
						premiseAtoms[1].truthValue,
					);
				}
				break;
			default:
				throw new Error(`Unknown inference rule: ${rule}`);
		}

		// Store inference in episodic memory
		const memory = await getEpisodicMemory(c.env);
		const episodeId = `inference_${Date.now()}`;
		await memory.storeEpisode({
			id: episodeId,
			type: "reasoning",
			timestamp: Date.now(),
			context: { rule, premises },
			atoms: premises,
			importance: 70,
			tags: ["inference", rule],
		});

		await memory.storeReasoningTrace(
			episodeId,
			1,
			rule,
			premises,
			"conclusion_pending",
			result?.strength || 0,
			result?.confidence || 0,
		);

		return c.json({
			success: true,
			rule,
			result,
			episodeId,
			timestamp: Date.now(),
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
 * Enhanced Perception API with Workers AI
 */
app.post("/api/cognitive/perceive", async (c) => {
	try {
		const { input, type = "text", metadata } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Use perception engine
		const perceptionEngine = new PerceptionEngine(c.env, atomSpaceStub);
		const result = await perceptionEngine.perceive({
			type,
			data: input,
			metadata,
		});

		// Store perception episode
		const memory = await getEpisodicMemory(c.env);
		await memory.storeEpisode({
			id: `perception_${Date.now()}`,
			type: "perception",
			timestamp: Date.now(),
			context: { inputType: type, metadata },
			atoms: result.atoms.map((a) => a.id),
			importance: 80,
			tags: ["perception", type],
		});

		// Cache high-importance atoms
		const cache = getAtomCache(c.env);
		const atomsToCache = result.atoms.filter((a) =>
			CacheStrategy.shouldCache(a),
		);
		await cache.setMany(
			atomsToCache,
			atomsToCache.map((a) => CacheStrategy.determineTTL(a))[0],
		);

		return c.json({
			success: true,
			atomsCreated: result.atoms.length,
			confidence: result.confidence,
			processingTime: result.processingTime,
			metadata: result.metadata,
			timestamp: Date.now(),
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
 * Episodic Memory API
 */
app.get("/api/memory/episodes", async (c) => {
	try {
		const memory = await getEpisodicMemory(c.env);

		const limit = parseInt(c.req.query("limit") || "10");
		const type = c.req.query("type");
		const minImportance = parseInt(c.req.query("minImportance") || "0");

		const episodes = await memory.queryEpisodes({
			type: type as any,
			minImportance,
			limit,
		});

		return c.json({
			success: true,
			count: episodes.length,
			episodes,
			timestamp: Date.now(),
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

app.get("/api/memory/episodes/:id", async (c) => {
	try {
		const memory = await getEpisodicMemory(c.env);
		const episodeId = c.req.param("id");

		const episode = await memory.getEpisode(episodeId);
		const traces = await memory.getReasoningTraces(episodeId);

		return c.json({
			success: true,
			episode,
			traces,
			timestamp: Date.now(),
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

app.get("/api/memory/agent-stats/:agentId", async (c) => {
	try {
		const memory = await getEpisodicMemory(c.env);
		const agentId = c.req.param("agentId");

		const stats = await memory.getAgentStats(agentId);
		const executions = await memory.getAgentExecutions(agentId, 20);

		return c.json({
			success: true,
			stats,
			recentExecutions: executions,
			timestamp: Date.now(),
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
 * Cache Management API
 */
app.post("/api/cache/warmup", async (c) => {
	try {
		const { atomIds } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		const cache = getAtomCache(c.env);
		await cache.warmup(atomSpaceStub, atomIds);

		return c.json({
			success: true,
			warmedUp: atomIds.length,
			timestamp: Date.now(),
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

app.delete("/api/cache/invalidate", async (c) => {
	try {
		const { atomIds } = await c.req.json();

		const cache = getAtomCache(c.env);
		await cache.invalidateMany(atomIds);

		return c.json({
			success: true,
			invalidated: atomIds.length,
			timestamp: Date.now(),
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
 * Forward to existing AtomSpace and MindAgent routes
 */
app.all("/atomspace/*", async (c) => {
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

	const url = new URL(c.req.url);
	url.pathname = url.pathname.replace("/atomspace", "");

	const forwardedRequest = new Request(url.toString(), {
		method: c.req.method,
		headers: c.req.raw.headers,
		body:
			c.req.method !== "GET" && c.req.method !== "HEAD"
				? await c.req.arrayBuffer()
				: undefined,
	});

	const response = await atomSpaceStub.fetch(forwardedRequest);
	return new Response(response.body, {
		status: response.status,
		headers: response.headers,
	});
});

app.all("/mindagent/*", async (c) => {
	const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
	const mindAgentStub = c.env.MIND_AGENT.get(mindAgentId);

	const url = new URL(c.req.url);
	url.pathname = url.pathname.replace("/mindagent", "");

	const forwardedRequest = new Request(url.toString(), {
		method: c.req.method,
		headers: c.req.raw.headers,
		body:
			c.req.method !== "GET" && c.req.method !== "HEAD"
				? await c.req.arrayBuffer()
				: undefined,
	});

	const response = await mindAgentStub.fetch(forwardedRequest);
	return new Response(response.body, {
		status: response.status,
		headers: response.headers,
	});
});

/**
 * Enhanced Dashboard API
 */
app.get("/api/dashboard", async (c) => {
	try {
		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
		const mindAgentStub = c.env.MIND_AGENT.get(mindAgentId);

		const cache = getAtomCache(c.env);
		const memory = await getEpisodicMemory(c.env);

		// Get data with caching
		let atomSpaceStats = await cache.getCachedStats();
		if (!atomSpaceStats) {
			const atomSpaceResponse = await atomSpaceStub.fetch(
				new Request("http://dummy/stats"),
			);
			const atomSpaceData =
				(await atomSpaceResponse.json()) as AtomSpaceResponse;
			atomSpaceStats = atomSpaceData.data;
			await cache.cacheStats(atomSpaceStats, 60);
		}

		const [agentsResponse, goalsResponse] = await Promise.all([
			mindAgentStub.fetch(new Request("http://dummy/agents")),
			mindAgentStub.fetch(new Request("http://dummy/goals")),
		]);

		const agentsData = (await agentsResponse.json()) as AtomSpaceResponse;
		const goalsData = (await goalsResponse.json()) as AtomSpaceResponse;

		// Get recent episodes
		const recentEpisodes = await memory.getRecentEpisodes(5);

		const dashboardData: CognitiveDashboardData & { memory?: any; cache?: any } =
			{
				atomSpace: atomSpaceStats || {
					totalAtoms: 0,
					nodeCount: 0,
					linkCount: 0,
					averageTruthValue: { strength: 0, confidence: 0 },
					averageAttentionValue: { sti: 0, lti: 0, vlti: 0 },
				},
				mindAgents: {
					activeAgents: agentsData.success
						? (agentsData.data as any[]).filter((a: any) => a.enabled).length
						: 0,
					totalExecutions: 0,
					averageExecutionTime: 0,
					recentResults: [],
				},
				goals: {
					activeGoals: goalsData.success
						? (goalsData.data as any[]).filter((g: any) => g.status === "active")
								.length
						: 0,
					completedGoals: goalsData.success
						? (goalsData.data as any[]).filter(
								(g: any) => g.status === "completed",
							).length
						: 0,
					averagePriority:
						goalsData.success && (goalsData.data as any[]).length > 0
							? (goalsData.data as any[]).reduce(
									(sum: number, g: any) => sum + g.priority,
									0,
								) / (goalsData.data as any[]).length
							: 0,
					recentGoals: goalsData.success
						? (goalsData.data as any[]).slice(-5)
						: [],
				},
				performance: {
					operationsPerSecond: 0,
					memoryUsage: 0,
					responseTime: Date.now(),
				},
				memory: {
					recentEpisodes,
					episodeCount: recentEpisodes.length,
				},
				cache: cache.getCacheStats(),
			};

		return c.json(dashboardData);
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			500,
		);
	}
});

/**
 * Health check
 */
app.get("/health", async (c) => {
	return c.json({
		status: "healthy",
		platform: "Cogflare OpenCog Platform (Enhanced)",
		version: "2.0.0",
		timestamp: Date.now(),
	});
});

/**
 * Export Durable Objects and handler
 */
export { AtomSpace, MindAgent };

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		return app.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
