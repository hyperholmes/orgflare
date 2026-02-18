import { Hono } from "hono";
import {
	Env,
	CognitiveDashboardData,
	AtomSpaceResponse,
	Atom,
	Node,
	Link,
} from "./types/cognitive";
import { AtomSpace } from "./durable-objects/AtomSpace";
import { MindAgent } from "./durable-objects/MindAgent";
import { PatternMatcher } from "./cognitive/PatternMatcher";
import { AIEnhancedReasoning } from "./cognitive/AIEnhancedReasoning";
import { DistributedQueryEngine } from "./cognitive/DistributedQueryEngine";

/**
 * FlareCog: OpenCog AGI Cognitive Architecture on CloudFlare Workers
 *
 * Deep integration of OpenCog with CloudFlare Workers for Platforms
 * as a Distributed AtomSpace (DAS) with enhanced AI for Cognitive Synergy
 * and Relevance Realization.
 *
 * Version: 2.0 - Enhanced Integration
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
 * Root endpoint - Cognitive Platform Status
 */
app.get("/", async (c) => {
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

	const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
	const mindAgentStub = c.env.MIND_AGENT.get(mindAgentId);

	try {
		const [atomSpaceResponse, agentsResponse, goalsResponse] =
			await Promise.all([
				atomSpaceStub.fetch(new Request("http://dummy/stats")),
				mindAgentStub.fetch(new Request("http://dummy/agents")),
				mindAgentStub.fetch(new Request("http://dummy/goals")),
			]);

		const atomSpaceStats =
			(await atomSpaceResponse.json()) as AtomSpaceResponse;
		const agentsData = (await agentsResponse.json()) as AtomSpaceResponse;
		const goalsData = (await goalsResponse.json()) as AtomSpaceResponse;

		const status = {
			platform: "FlareCog: OpenCog AGI on CloudFlare Workers",
			version: "2.0.0-enhanced",
			status: "active",
			features: {
				atomSpace: "Hypergraph Knowledge Representation",
				mindAgents: "Autonomous Cognitive Processes",
				plnReasoning: "Probabilistic Logic Networks",
				aiEnhancement: "CloudFlare Workers AI Integration",
				distributedAtomSpace: "Multi-Instance Coordination",
				relevanceRealization: "Cognitive Synergy Engine",
			},
			atomSpace: atomSpaceStats.success ? atomSpaceStats.data : null,
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
			timestamp: Date.now(),
		};

		return c.json(status);
	} catch (error) {
		return c.json(
			{
				platform: "FlareCog: OpenCog AGI on CloudFlare Workers",
				version: "2.0.0-enhanced",
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: Date.now(),
			},
			500,
		);
	}
});

/**
 * AtomSpace API Routes - Direct proxy to Durable Object
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

/**
 * MindAgent API Routes - Direct proxy to Durable Object
 */
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
 * Cognitive Dashboard API
 */
app.get("/api/dashboard", async (c) => {
	try {
		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
		const mindAgentStub = c.env.MIND_AGENT.get(mindAgentId);

		const [atomSpaceResponse, agentsResponse, goalsResponse] =
			await Promise.all([
				atomSpaceStub.fetch(new Request("http://dummy/stats")),
				mindAgentStub.fetch(new Request("http://dummy/agents")),
				mindAgentStub.fetch(new Request("http://dummy/goals")),
			]);

		const atomSpaceData = (await atomSpaceResponse.json()) as AtomSpaceResponse;
		const agentsData = (await agentsResponse.json()) as AtomSpaceResponse;
		const goalsData = (await goalsResponse.json()) as AtomSpaceResponse;

		const dashboardData: CognitiveDashboardData = {
			atomSpace: atomSpaceData.success
				? atomSpaceData.data
				: {
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
 * AI-Enhanced Pattern Matching
 * Uses CloudFlare Workers AI to enhance pattern discovery and matching
 */
app.post("/api/cognitive/pattern-match", async (c) => {
	try {
		const { pattern, useAI = true, maxResults = 10 } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Get all atoms for pattern matching
		const atomsResponse = await atomSpaceStub.fetch(
			new Request("http://dummy/atoms"),
		);
		const atomsData = (await atomsResponse.json()) as AtomSpaceResponse;

		if (!atomsData.success) {
			throw new Error("Failed to retrieve atoms from AtomSpace");
		}

		const atoms = atomsData.data as Atom[];

		// Initialize pattern matcher
		const patternMatcher = new PatternMatcher();
		let matches = patternMatcher.match(pattern, atoms);

		// AI Enhancement: Use Workers AI to refine and rank matches
		if (useAI && c.env.AI) {
			const aiEnhancer = new AIEnhancedReasoning(c.env.AI);
			matches = await aiEnhancer.enhancePatternMatches(
				pattern,
				matches,
				atoms,
			);
		}

		// Limit results
		const limitedMatches = matches.slice(0, maxResults);

		return c.json({
			success: true,
			pattern,
			matchCount: matches.length,
			matches: limitedMatches,
			aiEnhanced: useAI,
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
 * AI-Enhanced Reasoning with PLN Integration
 * Combines Probabilistic Logic Networks with CloudFlare Workers AI
 */
app.post("/api/cognitive/reason", async (c) => {
	try {
		const {
			premises,
			goal,
			maxSteps = 10,
			useAI = true,
			reasoningMode = "forward",
		} = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Initialize AI-enhanced reasoning
		const aiReasoning = new AIEnhancedReasoning(c.env.AI);

		// Perform reasoning with AI enhancement
		const reasoningResult = await aiReasoning.performReasoning({
			premises,
			goal,
			maxSteps,
			reasoningMode,
			atomSpace: atomSpaceStub,
		});

		// Store reasoning results in AtomSpace
		for (const conclusion of reasoningResult.conclusions) {
			await atomSpaceStub.fetch(
				new Request("http://dummy/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "ConceptNode",
						name: `conclusion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						truthValue: conclusion.truthValue,
						attentionValue: { sti: 80, lti: 20, vlti: 0 },
					}),
				}),
			);
		}

		return c.json({
			success: true,
			reasoning: reasoningResult,
			aiEnhanced: useAI,
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
 * Relevance Realization Engine
 * Implements cognitive synergy between AtomSpace and AI for optimal grip
 */
app.post("/api/cognitive/relevance-realization", async (c) => {
	try {
		const { context, goal, atoms } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Get current AtomSpace state
		const statsResponse = await atomSpaceStub.fetch(
			new Request("http://dummy/stats"),
		);
		const statsData = (await statsResponse.json()) as AtomSpaceResponse;

		// Initialize AI-enhanced reasoning for relevance realization
		const aiReasoning = new AIEnhancedReasoning(c.env.AI);

		// Perform relevance realization
		const relevanceResult = await aiReasoning.realizeRelevance({
			context,
			goal,
			atoms,
			atomSpaceStats: statsData.data,
		});

		// Update attention values based on relevance
		for (const relevantAtom of relevanceResult.relevantAtoms) {
			await atomSpaceStub.fetch(
				new Request(`http://dummy/atom/${relevantAtom.id}/attention`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						sti: relevantAtom.relevanceScore * 100,
						lti: relevantAtom.relevanceScore * 50,
						vlti: 0,
					}),
				}),
			);
		}

		return c.json({
			success: true,
			relevance: relevanceResult,
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
 * Distributed AtomSpace Query
 * Queries across multiple AtomSpace instances for true DAS functionality
 */
app.post("/api/cognitive/distributed-query", async (c) => {
	try {
		const { query, atomSpaceIds = ["primary"], aggregationMode = "union" } =
			await c.req.json();

		// Initialize distributed query engine
		const distributedEngine = new DistributedQueryEngine(c.env);

		// Execute distributed query
		const results = await distributedEngine.query({
			query,
			atomSpaceIds,
			aggregationMode,
		});

		return c.json({
			success: true,
			query,
			results,
			atomSpaceCount: atomSpaceIds.length,
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
 * Perception Input Processing
 * Converts external input into AtomSpace representations
 */
app.post("/api/cognitive/perceive", async (c) => {
	try {
		const { input, inputType = "text", metadata = {} } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Use AI to extract concepts from input
		const aiReasoning = new AIEnhancedReasoning(c.env.AI);
		const concepts = await aiReasoning.extractConcepts(input, inputType);

		// Create nodes for each concept
		const createdAtoms = [];
		for (const concept of concepts) {
			const nodeResponse = await atomSpaceStub.fetch(
				new Request("http://dummy/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "ConceptNode",
						name: concept.name,
						truthValue: concept.truthValue || { strength: 0.8, confidence: 0.7 },
						attentionValue: { sti: 100, lti: 0, vlti: 0 },
					}),
				}),
			);

			const nodeData = (await nodeResponse.json()) as AtomSpaceResponse;
			if (nodeData.success) {
				createdAtoms.push(nodeData.data);
			}
		}

		// Create links between related concepts
		for (let i = 0; i < concepts.length - 1; i++) {
			for (let j = i + 1; j < concepts.length; j++) {
				if (concepts[i].relatedTo?.includes(concepts[j].name)) {
					await atomSpaceStub.fetch(
						new Request("http://dummy/link", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								type: "SimilarityLink",
								targets: [concepts[i].name, concepts[j].name],
								truthValue: { strength: 0.7, confidence: 0.6 },
								attentionValue: { sti: 50, lti: 10, vlti: 0 },
							}),
						}),
					);
				}
			}
		}

		return c.json({
			success: true,
			message: "Input perceived and integrated into AtomSpace",
			concepts: concepts.length,
			atoms: createdAtoms,
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
 * Goal-Oriented Planning
 * Creates and executes cognitive plans to achieve goals
 */
app.post("/api/cognitive/plan", async (c) => {
	try {
		const { goal, constraints = [], maxDepth = 5 } = await c.req.json();

		const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
		const mindAgentStub = c.env.MIND_AGENT.get(mindAgentId);

		// Create goal in MindAgent
		const goalResponse = await mindAgentStub.fetch(
			new Request("http://dummy/goal", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "explicit",
					description: goal,
					priority: 0.8,
					conditions: constraints,
					actions: [],
				}),
			}),
		);

		const goalData = (await goalResponse.json()) as AtomSpaceResponse;

		// Use AI to generate plan
		const aiReasoning = new AIEnhancedReasoning(c.env.AI);
		const plan = await aiReasoning.generatePlan(goal, constraints, maxDepth);

		return c.json({
			success: true,
			goal: goalData.data,
			plan,
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
 * Cognitive Synergy Endpoint
 * Demonstrates emergent behavior through multi-level cognitive processing
 */
app.post("/api/cognitive/synergy", async (c) => {
	try {
		const { input, depth = 3 } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		const aiReasoning = new AIEnhancedReasoning(c.env.AI);

		// Multi-level cognitive processing
		const synergyResult = {
			perception: await aiReasoning.extractConcepts(input, "text"),
			reasoning: await aiReasoning.performReasoning({
				premises: [input],
				goal: "understand and respond",
				maxSteps: depth,
				reasoningMode: "forward",
				atomSpace: atomSpaceStub,
			}),
			relevance: await aiReasoning.realizeRelevance({
				context: input,
				goal: "optimal understanding",
				atoms: [],
				atomSpaceStats: {},
			}),
		};

		return c.json({
			success: true,
			synergy: synergyResult,
			message:
				"Cognitive synergy achieved through integrated perception, reasoning, and relevance realization",
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
 * Health check endpoint
 */
app.get("/health", async (c) => {
	return c.json({
		status: "healthy",
		platform: "FlareCog: OpenCog AGI on CloudFlare Workers",
		version: "2.0.0-enhanced",
		timestamp: Date.now(),
	});
});

/**
 * Export Durable Object classes and main handler
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
