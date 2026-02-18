/**
 * AI-Enhanced FlareCog User Worker
 * 
 * Integrates CloudFlare AI binding and Vercel AI SDK for cognitive operations.
 * Provides streaming responses, tool calling, and human-in-the-loop confirmations.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamText, generateId, type CoreMessage } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { cognitiveTools, cognitiveExecutions } from "./cognitive-tools";

type Env = {
	ATOMSPACE: DurableObjectNamespace;
	MIND_AGENT: DurableObjectNamespace;
	COGNITIVE_DB: D1Database;
	ATOM_CACHE: KVNamespace;
	AI: any;
	TENANT_ID?: string;
	TENANT_NAME?: string;
};

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use("/*", cors());

/**
 * Extract tenant context from request headers
 */
function getTenantContext(c: any): { tenantId: string; userId: string } {
	const tenantId = c.req.header("X-Tenant-ID") || c.env.TENANT_ID || "default";
	const userId = c.req.header("X-User-ID") || "anonymous";
	return { tenantId, userId };
}

/**
 * Get tenant-specific Durable Object instances
 */
function getTenantDurableObjects(c: any): {
	atomSpace: DurableObjectStub;
	mindAgent: DurableObjectStub;
} {
	const { tenantId } = getTenantContext(c);

	const atomSpaceId = c.env.ATOMSPACE.idFromName(`${tenantId}:primary`);
	const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);

	const mindAgentId = c.env.MIND_AGENT.idFromName(`${tenantId}:primary`);
	const mindAgent = c.env.MIND_AGENT.get(mindAgentId);

	return { atomSpace, mindAgent };
}

// ============================================================================
// AI-Enhanced Cognitive Operations
// ============================================================================

/**
 * Streaming cognitive chat endpoint
 * 
 * Provides real-time AI-powered cognitive interactions with tool calling
 */
app.post("/cognitive/chat/stream", async (c) => {
	const { tenantId } = getTenantContext(c);
	const body = await c.req.json();

	// Create Workers AI instance
	const workersai = createWorkersAI({ binding: c.env.AI });

	try {
		const result = streamText({
			system: `You are an AI-powered cognitive assistant for tenant "${tenantId}".

You have access to a distributed AtomSpace knowledge base and cognitive reasoning capabilities.

Your cognitive tools:
- perceiveText: Extract concepts and relationships from text
- performInference: Apply PLN reasoning rules (requires confirmation)
- learnPattern: Learn associative patterns using Hebbian learning
- queryKnowledge: Search the AtomSpace knowledge base
- updateRelevance: Adjust attention values for relevance realization
- createGoal: Define new cognitive goals (requires confirmation)

Use these tools to help users with cognitive tasks like knowledge extraction, logical reasoning, pattern learning, and goal-directed behavior.`,
			messages: body.messages as CoreMessage[],
			model: workersai("@cf/meta/llama-3.1-8b-instruct"),
			tools: cognitiveTools,
			maxSteps: 10,
		});

		return result.toTextStreamResponse();
	} catch (error) {
		return c.json(
			{
				success: false,
				error: "Streaming failed",
				message: String(error),
			},
			500,
		);
	}
});

/**
 * Non-streaming cognitive chat endpoint
 * 
 * For clients that don't support streaming
 */
app.post("/cognitive/chat", async (c) => {
	const { tenantId } = getTenantContext(c);
	const body = await c.req.json();

	const workersai = createWorkersAI({ binding: c.env.AI });

	try {
		const result = await streamText({
			system: `You are an AI-powered cognitive assistant for tenant "${tenantId}".`,
			messages: body.messages as CoreMessage[],
			model: workersai("@cf/meta/llama-3.1-8b-instruct"),
			tools: cognitiveTools,
			maxSteps: 10,
		});

		// Wait for completion
		const { text, toolCalls, finishReason } = await result.toAIStream().getReader().read();

		return c.json({
			success: true,
			response: text,
			toolCalls,
			finishReason,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: "Chat failed",
				message: String(error),
			},
			500,
		);
	}
});

/**
 * Execute confirmed tool
 * 
 * Handles execution of tools that require human confirmation
 */
app.post("/cognitive/execute-tool", async (c) => {
	const body = await c.req.json();
	const { toolName, args } = body;

	if (!toolName || !args) {
		return c.json(
			{
				success: false,
				error: "Missing toolName or args",
			},
			400,
		);
	}

	// Check if tool requires confirmation
	if (!(toolName in cognitiveExecutions)) {
		return c.json(
			{
				success: false,
				error: `Tool ${toolName} does not require confirmation or does not exist`,
			},
			400,
		);
	}

	try {
		const result = await cognitiveExecutions[toolName](args);
		return c.json({
			success: true,
			toolName,
			result,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: "Tool execution failed",
				message: String(error),
			},
			500,
		);
	}
});

/**
 * AI-powered perception endpoint
 * 
 * Extract concepts from text and insert into AtomSpace
 */
app.post("/cognitive/perceive", async (c) => {
	const { atomSpace } = getTenantDurableObjects(c);
	const body = await c.req.json();

	if (!body.text) {
		return c.json(
			{
				success: false,
				error: "Missing text field",
			},
			400,
		);
	}

	try {
		// Use AI to extract concepts
		const response = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content:
						"Extract key concepts from text as a JSON array of strings. Return only the JSON array.",
				},
				{
					role: "user",
					content: body.text,
				},
			],
		});

		// Parse concepts
		let concepts = [];
		try {
			concepts =
				typeof response === "string" ? JSON.parse(response) : response;
		} catch {
			// Fallback: split by common delimiters
			concepts = body.text.split(/[,.\n]/).filter((c: string) => c.trim().length > 3);
		}

		// Create ConceptNodes in AtomSpace
		const createdAtoms = [];
		for (const concept of concepts) {
			const atomResponse = await atomSpace.fetch(
				new Request("http://dummy/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "ConceptNode",
						name: concept.trim(),
						truthValue: { strength: 0.8, confidence: 0.6 },
						attentionValue: { sti: 100, lti: 50, vlti: 10 },
					}),
				}),
			);

			if (atomResponse.ok) {
				const atomData = await atomResponse.json();
				createdAtoms.push(atomData);
			}
		}

		return c.json({
			success: true,
			conceptsExtracted: concepts.length,
			atomsCreated: createdAtoms.length,
			concepts,
			atoms: createdAtoms,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: "Perception failed",
				message: String(error),
			},
			500,
		);
	}
});

/**
 * AI-powered reasoning endpoint
 * 
 * Use AI to suggest inference rules and apply them
 */
app.post("/cognitive/reason", async (c) => {
	const { atomSpace } = getTenantDurableObjects(c);
	const body = await c.req.json();

	try {
		// Get current atoms from AtomSpace
		const statsResponse = await atomSpace.fetch(
			new Request("http://dummy/stats", { method: "GET" }),
		);
		const stats = await statsResponse.json();

		// Use AI to suggest reasoning strategies
		const response = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content:
						"You are a cognitive reasoning assistant. Suggest logical inferences based on the knowledge base.",
				},
				{
					role: "user",
					content: `Knowledge base contains ${stats.totalAtoms} atoms. User query: ${body.query || "Perform general reasoning"}`,
				},
			],
		});

		return c.json({
			success: true,
			suggestion: response,
			atomSpaceStats: stats,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: "Reasoning failed",
				message: String(error),
			},
			500,
		);
	}
});

/**
 * AI-powered learning endpoint
 * 
 * Learn patterns from cognitive experiences
 */
app.post("/cognitive/learn", async (c) => {
	const { mindAgent } = getTenantDurableObjects(c);
	const body = await c.req.json();

	if (!body.experiences || !Array.isArray(body.experiences)) {
		return c.json(
			{
				success: false,
				error: "Missing or invalid experiences array",
			},
			400,
		);
	}

	try {
		// Use AI to identify patterns
		const response = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content:
						"Identify patterns and associations in the provided experiences. Return a JSON object with patterns.",
				},
				{
					role: "user",
					content: JSON.stringify(body.experiences),
				},
			],
		});

		// Trigger learning agent
		const learningResponse = await mindAgent.fetch(
			new Request("http://dummy/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					agentType: "learning",
					patterns: response,
				}),
			}),
		);

		const learningResult = await learningResponse.json();

		return c.json({
			success: true,
			experiencesProcessed: body.experiences.length,
			patternsIdentified: response,
			learningResult,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: "Learning failed",
				message: String(error),
			},
			500,
		);
	}
});

// ============================================================================
// Legacy Endpoints (Proxy to Durable Objects)
// ============================================================================

app.all("/atomspace/*", async (c) => {
	const { atomSpace } = getTenantDurableObjects(c);
	const path = c.req.path.replace("/atomspace", "");
	const url = new URL(c.req.url);
	url.pathname = path || "/";

	return atomSpace.fetch(
		new Request(url.toString(), {
			method: c.req.method,
			headers: c.req.raw.headers,
			body: c.req.raw.body,
		}),
	);
});

app.all("/mindagent/*", async (c) => {
	const { mindAgent } = getTenantDurableObjects(c);
	const path = c.req.path.replace("/mindagent", "");
	const url = new URL(c.req.url);
	url.pathname = path || "/";

	return mindAgent.fetch(
		new Request(url.toString(), {
			method: c.req.method,
			headers: c.req.raw.headers,
			body: c.req.raw.body,
		}),
	);
});

// ============================================================================
// Dashboard & Status
// ============================================================================

app.get("/api/dashboard", async (c) => {
	const { atomSpace, mindAgent } = getTenantDurableObjects(c);
	const { tenantId } = getTenantContext(c);

	const atomSpaceStats = await atomSpace.fetch(
		new Request("http://dummy/stats", { method: "GET" }),
	);
	const atomSpaceData = await atomSpaceStats.json();

	const mindAgentStats = await mindAgent.fetch(
		new Request("http://dummy/agents", { method: "GET" }),
	);
	const mindAgentData = await mindAgentStats.json();

	return c.json({
		success: true,
		tenantId,
		timestamp: Date.now(),
		aiEnabled: true,
		atomSpace: atomSpaceData,
		mindAgent: mindAgentData,
	});
});

app.get("/api/health", (c) => {
	const { tenantId } = getTenantContext(c);

	return c.json({
		status: "healthy",
		tenantId,
		aiEnabled: true,
		timestamp: Date.now(),
	});
});

// ============================================================================
// Root Route
// ============================================================================

app.get("/", (c) => {
	const { tenantId } = getTenantContext(c);

	return c.json({
		platform: "FlareCog AI-Enhanced Cognitive Platform",
		tenantId,
		version: "2.0.0",
		aiEnabled: true,
		endpoints: {
			cognitive: {
				chatStream: "/cognitive/chat/stream",
				chat: "/cognitive/chat",
				executeTool: "/cognitive/execute-tool",
				perceive: "/cognitive/perceive",
				reason: "/cognitive/reason",
				learn: "/cognitive/learn",
			},
			atomspace: "/atomspace/*",
			mindagent: "/mindagent/*",
			dashboard: "/api/dashboard",
			health: "/api/health",
		},
	});
});

export default app;
