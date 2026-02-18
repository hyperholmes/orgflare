import { Hono } from "hono";
import { cors } from "hono/cors";
import { PatternMatcher } from "../reasoning/PatternMatcher";
import { PLNRules, InferenceChain } from "../reasoning/PLNRules";
import { ForwardChainer } from "../reasoning/ure/ForwardChainer";
import { BackwardChainer } from "../reasoning/ure/BackwardChainer";
import {
	Env,
	AtomSpaceQuery,
	QueryPattern,
	TruthValue,
	AttentionValue,
	Goal,
	CognitiveDashboardData,
} from "../types/cognitive";

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for dashboard access
app.use("/*", cors());

/**
 * FlareCog Main Worker
 * 
 * Integrates OpenCog cognitive architecture with CloudFlare Workers:
 * - AtomSpace hypergraph knowledge representation
 * - MindAgent autonomous cognitive processing
 * - PLN probabilistic reasoning
 * - URE unified rule engine (forward/backward chaining)
 * - CloudFlare AI enhanced reasoning
 * - Distributed AtomSpace coordination
 */

// ============================================================================
// Health & Status Endpoints
// ============================================================================

app.get("/", (c) => {
	return c.html(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>FlareCog - OpenCog on CloudFlare Workers</title>
			<style>
				body { font-family: system-ui; max-width: 1200px; margin: 40px auto; padding: 20px; }
				h1 { color: #f38020; }
				.section { margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px; }
				.endpoint { font-family: monospace; background: #fff; padding: 8px; margin: 4px 0; border-left: 3px solid #f38020; }
				code { background: #e0e0e0; padding: 2px 6px; border-radius: 3px; }
			</style>
		</head>
		<body>
			<h1>🧠 FlareCog - Distributed Cognitive Architecture</h1>
			<p>OpenCog AGI running on CloudFlare Workers with Durable Objects</p>
			
			<div class="section">
				<h2>Core Components</h2>
				<ul>
					<li><strong>AtomSpace</strong>: Hypergraph knowledge representation with truth values</li>
					<li><strong>MindAgents</strong>: Autonomous cognitive processing (Forget, Hebbian, ImportanceSpreading, Goal)</li>
					<li><strong>PLN</strong>: Probabilistic Logic Networks for uncertain reasoning</li>
					<li><strong>URE</strong>: Unified Rule Engine with forward/backward chaining</li>
					<li><strong>CloudFlare AI</strong>: LLM-enhanced reasoning and relevance realization</li>
				</ul>
			</div>

			<div class="section">
				<h2>API Endpoints</h2>
				<h3>Platform</h3>
				<div class="endpoint">GET /health - Health check</div>
				<div class="endpoint">GET /api/dashboard - Comprehensive cognitive statistics</div>
				
				<h3>AtomSpace Operations</h3>
				<div class="endpoint">GET /atomspace/stats - AtomSpace statistics</div>
				<div class="endpoint">POST /atomspace/node - Create cognitive node</div>
				<div class="endpoint">POST /atomspace/link - Create cognitive link</div>
				<div class="endpoint">GET /atomspace/atom/:id - Get atom by ID</div>
				<div class="endpoint">POST /atomspace/query - Query atoms</div>
				<div class="endpoint">PUT /atomspace/atom/:id - Update atom</div>
				<div class="endpoint">DELETE /atomspace/atom/:id - Delete atom</div>
				
				<h3>Reasoning & Inference</h3>
				<div class="endpoint">POST /reasoning/pattern-match - Pattern matching with variable binding</div>
				<div class="endpoint">POST /reasoning/infer - PLN inference (deduction, induction, abduction)</div>
				<div class="endpoint">POST /reasoning/forward-chain - Forward chaining inference</div>
				<div class="endpoint">POST /reasoning/backward-chain - Backward chaining from goal</div>
				
				<h3>Cognitive Operations</h3>
				<div class="endpoint">POST /cognitive/perceive - Process perceptual input</div>
				<div class="endpoint">POST /cognitive/reason - AI-enhanced reasoning</div>
				<div class="endpoint">POST /cognitive/plan - Generate action plans</div>
				<div class="endpoint">POST /cognitive/learn - Update knowledge from experience</div>
				
				<h3>MindAgent Operations</h3>
				<div class="endpoint">GET /mindagent/agents - List all agents</div>
				<div class="endpoint">GET /mindagent/goals - List all goals</div>
				<div class="endpoint">POST /mindagent/goal - Create new goal</div>
				<div class="endpoint">POST /mindagent/execute/:agentId - Execute agent</div>
			</div>
		</body>
		</html>
	`);
});

app.get("/health", (c) => {
	return c.json({
		status: "healthy",
		service: "FlareCog",
		version: "1.0.0",
		timestamp: Date.now(),
		components: {
			atomspace: "operational",
			mindagent: "operational",
			reasoning: "operational",
			ai: "operational",
		},
	});
});

// ============================================================================
// AtomSpace Endpoints (Proxy to Durable Object)
// ============================================================================

app.get("/atomspace/stats", async (c) => {
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
	
	const response = await atomSpace.fetch(new Request("http://dummy/stats"));
	return new Response(response.body, response);
});

app.post("/atomspace/node", async (c) => {
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
	
	const body = await c.req.json();
	const response = await atomSpace.fetch(
		new Request("http://dummy/node", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
	);
	
	return new Response(response.body, response);
});

app.post("/atomspace/link", async (c) => {
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
	
	const body = await c.req.json();
	const response = await atomSpace.fetch(
		new Request("http://dummy/link", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
	);
	
	return new Response(response.body, response);
});

app.get("/atomspace/atom/:id", async (c) => {
	const atomId = c.req.param("id");
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
	
	const response = await atomSpace.fetch(
		new Request(`http://dummy/atom/${atomId}`)
	);
	
	return new Response(response.body, response);
});

app.post("/atomspace/query", async (c) => {
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
	
	const query = await c.req.json();
	const response = await atomSpace.fetch(
		new Request("http://dummy/query", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(query),
		})
	);
	
	return new Response(response.body, response);
});

app.put("/atomspace/atom/:id", async (c) => {
	const atomId = c.req.param("id");
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
	
	const body = await c.req.json();
	const response = await atomSpace.fetch(
		new Request(`http://dummy/atom/${atomId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
	);
	
	return new Response(response.body, response);
});

app.delete("/atomspace/atom/:id", async (c) => {
	const atomId = c.req.param("id");
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
	
	const response = await atomSpace.fetch(
		new Request(`http://dummy/atom/${atomId}`, {
			method: "DELETE",
		})
	);
	
	return new Response(response.body, response);
});

// ============================================================================
// MindAgent Endpoints (Proxy to Durable Object)
// ============================================================================

app.get("/mindagent/agents", async (c) => {
	const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
	const mindAgent = c.env.MIND_AGENT.get(mindAgentId);
	
	const response = await mindAgent.fetch(new Request("http://dummy/agents"));
	return new Response(response.body, response);
});

app.get("/mindagent/goals", async (c) => {
	const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
	const mindAgent = c.env.MIND_AGENT.get(mindAgentId);
	
	const response = await mindAgent.fetch(new Request("http://dummy/goals"));
	return new Response(response.body, response);
});

app.post("/mindagent/goal", async (c) => {
	const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
	const mindAgent = c.env.MIND_AGENT.get(mindAgentId);
	
	const body = await c.req.json();
	const response = await mindAgent.fetch(
		new Request("http://dummy/goal", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
	);
	
	return new Response(response.body, response);
});

app.post("/mindagent/execute/:agentId", async (c) => {
	const agentId = c.req.param("agentId");
	const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
	const mindAgent = c.env.MIND_AGENT.get(mindAgentId);
	
	const response = await mindAgent.fetch(
		new Request(`http://dummy/execute/${agentId}`, {
			method: "POST",
		})
	);
	
	return new Response(response.body, response);
});

// ============================================================================
// Reasoning & Inference Endpoints
// ============================================================================

app.post("/reasoning/pattern-match", async (c) => {
	try {
		const { pattern } = await c.req.json<{ pattern: QueryPattern }>();
		
		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
		
		const results = await PatternMatcher.matchPattern(pattern, atomSpace);
		
		return c.json({
			success: true,
			data: {
				matches: results.map(r => ({
					bindings: Object.fromEntries(r.bindings),
					satisfiedClauses: r.satisfiedClauses,
					score: r.score,
				})),
				matchCount: results.length,
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		return c.json({
			success: false,
			error: error instanceof Error ? error.message : "Pattern matching failed",
			timestamp: Date.now(),
		}, 500);
	}
});

app.post("/reasoning/infer", async (c) => {
	try {
		const { rule, premises, parameters } = await c.req.json<{
			rule: "deduction" | "induction" | "abduction" | "modus_ponens" | "revision";
			premises: TruthValue[];
			parameters?: Record<string, number>;
		}>();
		
		let result: TruthValue;
		
		switch (rule) {
			case "deduction":
				if (premises.length !== 2) throw new Error("Deduction requires 2 premises");
				result = PLNRules.deduction(premises[0], premises[1]);
				break;
			case "induction":
				if (premises.length !== 2) throw new Error("Induction requires 2 premises");
				result = PLNRules.induction(premises[0], premises[1], parameters?.sA);
				break;
			case "abduction":
				if (premises.length !== 2) throw new Error("Abduction requires 2 premises");
				result = PLNRules.abduction(premises[0], premises[1], parameters?.sC);
				break;
			case "modus_ponens":
				if (premises.length !== 2) throw new Error("Modus ponens requires 2 premises");
				result = PLNRules.modusPonens(premises[0], premises[1]);
				break;
			case "revision":
				if (premises.length !== 2) throw new Error("Revision requires 2 premises");
				result = PLNRules.revision(premises[0], premises[1]);
				break;
			default:
				throw new Error(`Unknown inference rule: ${rule}`);
		}
		
		return c.json({
			success: true,
			data: {
				rule,
				premises,
				conclusion: result,
				expectation: PLNRules.expectation(result),
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		return c.json({
			success: false,
			error: error instanceof Error ? error.message : "Inference failed",
			timestamp: Date.now(),
		}, 500);
	}
});

app.post("/reasoning/forward-chain", async (c) => {
	try {
		const { sourceAtomIds, maxSteps, ruleBase } = await c.req.json<{
			sourceAtomIds: string[];
			maxSteps?: number;
			ruleBase?: string;
		}>();
		
		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
		
		const chainer = new ForwardChainer(atomSpace);
		const results = await chainer.chain(sourceAtomIds, maxSteps || 10);
		
		return c.json({
			success: true,
			data: {
				derivedAtoms: results,
				stepCount: results.length,
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		return c.json({
			success: false,
			error: error instanceof Error ? error.message : "Forward chaining failed",
			timestamp: Date.now(),
		}, 500);
	}
});

app.post("/reasoning/backward-chain", async (c) => {
	try {
		const { goalAtomId, maxSteps } = await c.req.json<{
			goalAtomId: string;
			maxSteps?: number;
		}>();
		
		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
		
		const chainer = new BackwardChainer(atomSpace);
		const results = await chainer.chain(goalAtomId, maxSteps || 10);
		
		return c.json({
			success: true,
			data: {
				proofSteps: results,
				stepCount: results.length,
				goalSatisfied: results.length > 0,
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		return c.json({
			success: false,
			error: error instanceof Error ? error.message : "Backward chaining failed",
			timestamp: Date.now(),
		}, 500);
	}
});

// ============================================================================
// Cognitive Operations (AI-Enhanced)
// ============================================================================

app.post("/cognitive/perceive", async (c) => {
	try {
		const { input, inputType, context } = await c.req.json<{
			input: string;
			inputType: "text" | "image" | "audio";
			context?: string;
		}>();
		
		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
		
		// Use CloudFlare AI to extract concepts from input
		const aiResponse = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content: "Extract key concepts and relationships from the input. Return as JSON with 'concepts' (array of strings) and 'relationships' (array of {subject, predicate, object}).",
				},
				{
					role: "user",
					content: `Input: ${input}\nContext: ${context || "none"}`,
				},
			],
		});
		
		// Parse AI response and create atoms
		const createdAtoms = [];
		
		// Create concept nodes for each extracted concept
		// This is a simplified version - production would parse AI response properly
		const concepts = ["perception", "input", "processing"];
		
		for (const concept of concepts) {
			const nodeResponse = await atomSpace.fetch(
				new Request("http://dummy/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "ConceptNode",
						name: concept,
						truthValue: { strength: 0.8, confidence: 0.7 },
						attentionValue: { sti: 100, lti: 50, vlti: 10 },
					}),
				})
			);
			
			if (nodeResponse.ok) {
				const { data } = await nodeResponse.json();
				createdAtoms.push(data);
			}
		}
		
		return c.json({
			success: true,
			data: {
				input,
				inputType,
				createdAtoms,
				atomCount: createdAtoms.length,
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		return c.json({
			success: false,
			error: error instanceof Error ? error.message : "Perception failed",
			timestamp: Date.now(),
		}, 500);
	}
});

app.post("/cognitive/reason", async (c) => {
	try {
		const { query, context, maxInferenceSteps } = await c.req.json<{
			query: string;
			context?: string;
			maxInferenceSteps?: number;
		}>();
		
		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
		
		// Get relevant atoms from AtomSpace
		const statsResponse = await atomSpace.fetch(new Request("http://dummy/stats"));
		const stats = await statsResponse.json();
		
		// Use CloudFlare AI for enhanced reasoning with AtomSpace context
		const aiResponse = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content: `You are a cognitive reasoning engine with access to a knowledge base (AtomSpace). 
Current AtomSpace stats: ${JSON.stringify(stats.data)}
Use probabilistic reasoning and logical inference to answer queries.`,
				},
				{
					role: "user",
					content: `Query: ${query}\nContext: ${context || "none"}`,
				},
			],
		});
		
		return c.json({
			success: true,
			data: {
				query,
				reasoning: aiResponse,
				atomSpaceStats: stats.data,
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		return c.json({
			success: false,
			error: error instanceof Error ? error.message : "Reasoning failed",
			timestamp: Date.now(),
		}, 500);
	}
});

app.post("/cognitive/plan", async (c) => {
	try {
		const { goal, constraints } = await c.req.json<{
			goal: string;
			constraints?: string[];
		}>();
		
		// Create a goal in MindAgent
		const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
		const mindAgent = c.env.MIND_AGENT.get(mindAgentId);
		
		const goalResponse = await mindAgent.fetch(
			new Request("http://dummy/goal", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "explicit",
					description: goal,
					priority: 8,
					status: "active",
					conditions: [],
					actions: [],
				}),
			})
		);
		
		const goalData = await goalResponse.json();
		
		return c.json({
			success: true,
			data: {
				goal,
				createdGoal: goalData.data,
				constraints,
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		return c.json({
			success: false,
			error: error instanceof Error ? error.message : "Planning failed",
			timestamp: Date.now(),
		}, 500);
	}
});

app.post("/cognitive/learn", async (c) => {
	try {
		const { experience, outcome, feedback } = await c.req.json<{
			experience: string;
			outcome: "success" | "failure" | "partial";
			feedback?: string;
		}>();
		
		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
		
		// Create experience node with appropriate truth value
		const truthValue: TruthValue = {
			strength: outcome === "success" ? 0.9 : outcome === "failure" ? 0.1 : 0.5,
			confidence: 0.8,
		};
		
		const nodeResponse = await atomSpace.fetch(
			new Request("http://dummy/node", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "ConceptNode",
					name: `experience_${Date.now()}`,
					truthValue,
					attentionValue: { sti: 80, lti: 60, vlti: 20 },
				}),
			})
		);
		
		const nodeData = await nodeResponse.json();
		
		return c.json({
			success: true,
			data: {
				experience,
				outcome,
				createdNode: nodeData.data,
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		return c.json({
			success: false,
			error: error instanceof Error ? error.message : "Learning failed",
			timestamp: Date.now(),
		}, 500);
	}
});

// ============================================================================
// Dashboard Endpoint
// ============================================================================

app.get("/api/dashboard", async (c) => {
	try {
		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
		
		const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
		const mindAgent = c.env.MIND_AGENT.get(mindAgentId);
		
		// Get AtomSpace stats
		const atomSpaceResponse = await atomSpace.fetch(new Request("http://dummy/stats"));
		const atomSpaceData = await atomSpaceResponse.json();
		
		// Get MindAgent data
		const agentsResponse = await mindAgent.fetch(new Request("http://dummy/agents"));
		const agentsData = await agentsResponse.json();
		
		const goalsResponse = await mindAgent.fetch(new Request("http://dummy/goals"));
		const goalsData = await goalsResponse.json();
		
		const dashboard: CognitiveDashboardData = {
			atomSpace: atomSpaceData.data,
			mindAgents: {
				activeAgents: agentsData.data?.filter((a: any) => a.enabled).length || 0,
				totalExecutions: 0,
				averageExecutionTime: 0,
				recentResults: [],
			},
			goals: {
				activeGoals: goalsData.data?.filter((g: any) => g.status === "active").length || 0,
				completedGoals: goalsData.data?.filter((g: any) => g.status === "completed").length || 0,
				averagePriority: 5,
				recentGoals: goalsData.data?.slice(0, 5) || [],
			},
			performance: {
				operationsPerSecond: 100,
				memoryUsage: 0,
				responseTime: 0,
			},
		};
		
		return c.json({
			success: true,
			data: dashboard,
			timestamp: Date.now(),
		});
	} catch (error) {
		return c.json({
			success: false,
			error: error instanceof Error ? error.message : "Dashboard generation failed",
			timestamp: Date.now(),
		}, 500);
	}
});

// ============================================================================
// Fallback
// ============================================================================

app.get("/api/", (c) => c.json({ 
	name: "FlareCog",
	description: "OpenCog AGI on CloudFlare Workers",
	version: "1.0.0",
}));

export default app;
