/**
 * FlareCog User Worker Template
 * 
 * Tenant-specific cognitive Worker instance.
 * Each tenant gets their own isolated AtomSpace and MindAgent.
 * 
 * This template is deployed to the dispatch namespace for each tenant.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { registerAtomSpaceExamples } from "./atomspace-examples";

// Import types from the main flarecog implementation
// In production, these would be shared via npm package or monorepo
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

	// Create tenant-specific Durable Object IDs
	const atomSpaceId = c.env.ATOMSPACE.idFromName(`${tenantId}:primary`);
	const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);

	const mindAgentId = c.env.MIND_AGENT.idFromName(`${tenantId}:primary`);
	const mindAgent = c.env.MIND_AGENT.get(mindAgentId);

	return { atomSpace, mindAgent };
}

// ============================================================================
// AtomSpace Proxy Routes
// ============================================================================

app.all("/atomspace/*", async (c) => {
	const { atomSpace } = getTenantDurableObjects(c);
	const path = c.req.path.replace("/atomspace", "");
	const url = new URL(c.req.url);
	url.pathname = path || "/";

	const request = new Request(url.toString(), {
		method: c.req.method,
		headers: c.req.raw.headers,
		body: c.req.raw.body,
	});

	return atomSpace.fetch(request);
});

// ============================================================================
// MindAgent Proxy Routes
// ============================================================================

app.all("/mindagent/*", async (c) => {
	const { mindAgent } = getTenantDurableObjects(c);
	const path = c.req.path.replace("/mindagent", "");
	const url = new URL(c.req.url);
	url.pathname = path || "/";

	const request = new Request(url.toString(), {
		method: c.req.method,
		headers: c.req.raw.headers,
		body: c.req.raw.body,
	});

	return mindAgent.fetch(request);
});

// ============================================================================
// Reasoning Routes
// ============================================================================

app.post("/reasoning/pattern-match", async (c) => {
	const { atomSpace } = getTenantDurableObjects(c);
	const body = await c.req.json();

	const response = await atomSpace.fetch(
		new Request("http://dummy/query", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "pattern_match",
				pattern: body.pattern,
			}),
		}),
	);

	return response;
});

app.post("/reasoning/pln/:rule", async (c) => {
	const { atomSpace } = getTenantDurableObjects(c);
	const rule = c.req.param("rule");
	const body = await c.req.json();

	// Forward to reasoning endpoint
	// This would use the PLN modules from the main implementation
	return c.json({
		success: true,
		rule,
		input: body,
		message: "PLN reasoning endpoint - integrate with actual PLN implementation",
	});
});

app.post("/reasoning/forward-chain", async (c) => {
	const body = await c.req.json();

	return c.json({
		success: true,
		message: "Forward chaining endpoint - integrate with URE implementation",
		input: body,
	});
});

app.post("/reasoning/backward-chain", async (c) => {
	const body = await c.req.json();

	return c.json({
		success: true,
		message: "Backward chaining endpoint - integrate with URE implementation",
		input: body,
	});
});

// ============================================================================
// Cognitive Operations Routes
// ============================================================================

app.post("/cognitive/perceive", async (c) => {
	const { atomSpace } = getTenantDurableObjects(c);
	const { tenantId, userId } = getTenantContext(c);
	const body = await c.req.json();

	// Use CloudFlare AI to process perception
	if (c.env.AI && body.text) {
		try {
			const aiResponse = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
				messages: [
					{
						role: "system",
						content:
							"Extract key concepts and relationships from the following text. Return a JSON array of concepts.",
					},
					{
						role: "user",
						content: body.text,
					},
				],
			});

			// Parse AI response and create atoms
			const concepts = this.extractConcepts(aiResponse.response);

			// Create ConceptNodes in AtomSpace
			for (const concept of concepts) {
				await atomSpace.fetch(
					new Request("http://dummy/node", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							type: "ConceptNode",
							name: concept,
							truthValue: { strength: 0.8, confidence: 0.6 },
							attentionValue: { sti: 100, lti: 50, vlti: 10 },
						}),
					}),
				);
			}

			return c.json({
				success: true,
				conceptsCreated: concepts.length,
				concepts,
			});
		} catch (error) {
			return c.json(
				{
					success: false,
					error: "AI perception failed",
					message: String(error),
				},
				500,
			);
		}
	}

	return c.json({
		success: false,
		error: "AI binding not available or no text provided",
	});
});

app.post("/cognitive/reason", async (c) => {
	const { atomSpace, mindAgent } = getTenantDurableObjects(c);
	const body = await c.req.json();

	// Trigger reasoning agent execution
	const response = await mindAgent.fetch(
		new Request("http://dummy/execute", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				agentType: "reasoning",
			}),
		}),
	);

	return response;
});

app.post("/cognitive/plan", async (c) => {
	const { mindAgent } = getTenantDurableObjects(c);
	const body = await c.req.json();

	// Trigger planning agent execution
	const response = await mindAgent.fetch(
		new Request("http://dummy/execute", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				agentType: "planning",
			}),
		}),
	);

	return response;
});

app.post("/cognitive/learn", async (c) => {
	const { mindAgent } = getTenantDurableObjects(c);
	const body = await c.req.json();

	// Trigger learning agent execution
	const response = await mindAgent.fetch(
		new Request("http://dummy/execute", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				agentType: "learning",
			}),
		}),
	);

	return response;
});

// ============================================================================
// Dashboard & Status Routes
// ============================================================================

app.get("/api/dashboard", async (c) => {
	const { atomSpace, mindAgent } = getTenantDurableObjects(c);
	const { tenantId } = getTenantContext(c);

	// Get AtomSpace stats
	const atomSpaceStats = await atomSpace.fetch(
		new Request("http://dummy/stats", { method: "GET" }),
	);
	const atomSpaceData = await atomSpaceStats.json();

	// Get MindAgent stats
	const mindAgentStats = await mindAgent.fetch(
		new Request("http://dummy/agents", { method: "GET" }),
	);
	const mindAgentData = await mindAgentStats.json();

	return c.json({
		success: true,
		tenantId,
		timestamp: Date.now(),
		atomSpace: atomSpaceData,
		mindAgent: mindAgentData,
	});
});

app.get("/api/health", async (c) => {
	const { tenantId } = getTenantContext(c);

	return c.json({
		status: "healthy",
		tenantId,
		timestamp: Date.now(),
	});
});

// ============================================================================
// Root Route
// ============================================================================

app.get("/", (c) => {
	const { tenantId } = getTenantContext(c);

	return c.json({
		platform: "FlareCog Cognitive Platform",
		tenantId,
		version: "1.0.0",
		endpoints: {
			atomspace: "/atomspace/*",
			mindagent: "/mindagent/*",
			reasoning: "/reasoning/*",
			cognitive: "/cognitive/*",
			dashboard: "/api/dashboard",
			health: "/api/health",
			examples: "/examples/atomspace/*",
		},
	});
});

// ============================================================================
// AtomSpace Examples (FlareSpace Adaptation)
// ============================================================================

registerAtomSpaceExamples(app);

// ============================================================================
// Helper Functions
// ============================================================================

function extractConcepts(text: string): string[] {
	// Simple concept extraction (in production, use proper NLP)
	const words = text
		.toLowerCase()
		.split(/\W+/)
		.filter((w) => w.length > 3);

	// Remove duplicates
	return Array.from(new Set(words));
}

// ============================================================================
// Export
// ============================================================================

export default app;
