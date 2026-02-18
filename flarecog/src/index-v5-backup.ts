import { Hono } from "hono";
import {
	Env,
	CognitiveDashboardData,
	AtomSpaceResponse,
} from "./types/cognitive";
import { AtomSpace } from "./durable-objects/AtomSpace";
import { MindAgent } from "./durable-objects/MindAgent";

/**
 * Cogflare OpenCog Worker Platform
 *
 * A distributed cognitive architecture based on OpenCog, running on Cloudflare Workers.
 * Provides AtomSpace hypergraph knowledge representation, autonomous MindAgents,
 * and goal-oriented cognitive processing across the edge.
 */

const app = new Hono<{ Bindings: Env }>();

// CORS middleware for development
app.use("*", async (c, next) => {
	// Set CORS headers
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
		// Get AtomSpace stats
		const atomSpaceResponse = await atomSpaceStub.fetch(
			new Request("http://dummy/stats"),
		);
		const atomSpaceStats =
			(await atomSpaceResponse.json()) as AtomSpaceResponse;

		// Get MindAgent stats
		const agentsResponse = await mindAgentStub.fetch(
			new Request("http://dummy/agents"),
		);
		const agentsData = (await agentsResponse.json()) as AtomSpaceResponse;

		const goalsResponse = await mindAgentStub.fetch(
			new Request("http://dummy/goals"),
		);
		const goalsData = (await goalsResponse.json()) as AtomSpaceResponse;

		const status = {
			platform: "Cogflare OpenCog Platform",
			version: "1.0.0",
			status: "active",
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
				platform: "Cogflare OpenCog Platform",
				version: "1.0.0",
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: Date.now(),
			},
			500,
		);
	}
});

/**
 * AtomSpace API Routes
 */
app.all("/atomspace/*", async (c) => {
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

	// Forward request to AtomSpace Durable Object
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
 * MindAgent API Routes
 */
app.all("/mindagent/*", async (c) => {
	const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
	const mindAgentStub = c.env.MIND_AGENT.get(mindAgentId);

	// Forward request to MindAgent Durable Object
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

		// Get comprehensive cognitive data
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
				totalExecutions: 0, // Would need to track this
				averageExecutionTime: 0, // Would need to calculate this
				recentResults: [], // Would need to store recent execution results
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
				operationsPerSecond: 0, // Would need to track this
				memoryUsage: 0, // Would need to estimate this
				responseTime: Date.now(), // Simple timestamp for now
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
 * Cognitive Operations API
 */
app.post("/api/cognitive/perceive", async (c) => {
	try {
		const { input, inputType = "text" } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Create a concept node for the input
		const conceptResponse = await atomSpaceStub.fetch(
			new Request("http://dummy/node", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "ConceptNode",
					name: `input_${Date.now()}`,
					truthValue: { strength: 0.8, confidence: 0.9 },
					attentionValue: { sti: 100, lti: 0, vlti: 0 },
				}),
			}),
		);

		const conceptData = (await conceptResponse.json()) as AtomSpaceResponse;

		return c.json({
			success: true,
			message: "Input perceived and added to AtomSpace",
			data: conceptData.data,
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
 * AI-Enhanced Reasoning
 */
app.post("/api/cognitive/reason", async (c) => {
	try {
		const { query, context } = await c.req.json();

		// Use Cloudflare AI for enhanced reasoning
		const aiResponse = await c.env.AI.run(
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			{
				messages: [
					{
						role: "system",
						content:
							"You are a cognitive reasoning engine. Analyze the query in the context of a cognitive architecture and provide insights.",
					},
					{
						role: "user",
						content: `Query: ${query}\nContext: ${context || "No additional context provided"}`,
					},
				],
			},
		);

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

		// Store the reasoning result in AtomSpace
		const reasoningNodeResponse = await atomSpaceStub.fetch(
			new Request("http://dummy/node", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "ConceptNode",
					name: `reasoning_${Date.now()}`,
					truthValue: { strength: 0.7, confidence: 0.8 },
					attentionValue: { sti: 80, lti: 10, vlti: 0 },
				}),
			}),
		);

		const reasoningNodeData =
			(await reasoningNodeResponse.json()) as AtomSpaceResponse;

		// Extract the response text from the AI output
		let reasoningText = "No response generated";
		if (
			typeof aiResponse === "object" &&
			aiResponse !== null &&
			"response" in aiResponse
		) {
			reasoningText = aiResponse.response as string;
		}

		return c.json({
			success: true,
			reasoning: reasoningText,
			atomSpaceEntry: reasoningNodeData.data,
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
		platform: "Cogflare OpenCog Platform",
		timestamp: Date.now(),
	});
});

/**
 * Serve static files from public directory
 */
app.get("/*", async (c) => {
	const url = new URL(c.req.url);
	let filePath = url.pathname;

	// Default to index.html for root path
	if (filePath === "/" || filePath === "") {
		filePath = "/index.html";
	}

	try {
		// Simple static file serving - in production you'd want more robust handling
		const response = await fetch(`${url.origin}/public${filePath}`);
		if (response.ok) {
			return response;
		}

		// Fallback to index.html for SPA routing
		const indexResponse = await fetch(`${url.origin}/public/index.html`);
		return indexResponse;
	} catch (error) {
		// Return a simple HTML response if file serving fails
		return c.html(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Cogflare OpenCog Platform</title>
				<style>
					body { font-family: Arial, sans-serif; margin: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
					.container { max-width: 600px; margin: 0 auto; text-align: center; }
					h1 { font-size: 2.5rem; margin-bottom: 1rem; }
					p { font-size: 1.1rem; margin-bottom: 2rem; }
					.error { background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; }
				</style>
			</head>
			<body>
				<div class="container">
					<h1>🧠 Cogflare OpenCog Platform</h1>
					<p>Autonomous cognitive architecture powered by Cloudflare Workers</p>
					<div class="error">
						<p>Static file serving not available. Please use the API endpoints directly:</p>
						<ul style="text-align: left; max-width: 400px; margin: 0 auto;">
							<li>GET /health - Health check</li>
							<li>GET /api/dashboard - Cognitive dashboard data</li>
							<li>POST /api/cognitive/perceive - Perception input</li>
							<li>POST /api/cognitive/reason - AI reasoning</li>
							<li>GET /atomspace/stats - AtomSpace statistics</li>
							<li>GET /mindagent/agents - MindAgent information</li>
						</ul>
					</div>
				</div>
			</body>
			</html>
		`);
	}
});

/**
 * Export the Durable Object classes and main handler
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
