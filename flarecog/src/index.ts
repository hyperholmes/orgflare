/**
 * FlareCog v6.0 Integrated Worker Entry Point
 * 
 * Combines existing Cogflare functionality with new v6.0 components
 */

import { Hono } from "hono";
import {
	CognitiveDashboardData,
	AtomSpaceResponse,
} from "./types/cognitive";
import { Env } from "./types/cognitive-v5";
import { AtomSpace } from "./durable-objects/AtomSpace";
import { MindAgent } from "./durable-objects/MindAgent";
import v6Endpoints from './api/v6-endpoints';
import { V6_AGENTS, getAgentsByPriority } from './agents/v6-agents';
import { CloudflareQueueIntegration } from './optimizations/CloudflareQueueIntegration';

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
 * Root endpoint - Enhanced with v6.0 info
 */
app.get("/", async (c) => {
	const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
	const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

	const mindAgentId = c.env.MIND_AGENT.idFromName("primary");
	const mindAgentStub = c.env.MIND_AGENT.get(mindAgentId);

	try {
		const atomSpaceResponse = await atomSpaceStub.fetch(
			new Request("http://dummy/stats"),
		);
		const atomSpaceStats =
			(await atomSpaceResponse.json()) as AtomSpaceResponse;

		const agentsResponse = await mindAgentStub.fetch(
			new Request("http://dummy/agents"),
		);
		const agentsData = (await agentsResponse.json()) as AtomSpaceResponse;

		const goalsResponse = await mindAgentStub.fetch(
			new Request("http://dummy/goals"),
		);
		const goalsData = (await goalsResponse.json()) as AtomSpaceResponse;

		const status = {
			platform: "FlareCog OpenCog Platform",
			version: "6.0.0",
			status: "active",
			features: {
				v5: ["AtomSpace", "MindAgents", "Goals", "AI Reasoning"],
				v6: [
					"Distributed Query Engine",
					"Relevance Realization",
					"Multi-Tenant Platform",
					"Queue Processing",
					"Tiered Storage",
					"Federated Learning"
				]
			},
			atomSpace: atomSpaceStats.success ? atomSpaceStats.data : null,
			mindAgents: {
				total: agentsData.success ? (agentsData.data as any[]).length : 0,
				active: agentsData.success
					? (agentsData.data as any[]).filter((a: any) => a.enabled).length
					: 0,
				v6Agents: V6_AGENTS.length
			},
			goals: {
				total: goalsData.success ? (goalsData.data as any[]).length : 0,
				active: goalsData.success
					? (goalsData.data as any[]).filter((g: any) => g.status === "active")
							.length
					: 0,
			},
			endpoints: {
				legacy: ["/atomspace/*", "/mindagent/*", "/api/dashboard", "/api/cognitive/*"],
				v6: ["/api/v6/query/*", "/api/v6/relevance/*", "/api/v6/tenant/*", "/api/v6/task/*", "/api/v6/storage/*"]
			},
			timestamp: Date.now(),
		};

		return c.json(status);
	} catch (error) {
		return c.json(
			{
				platform: "FlareCog OpenCog Platform",
				version: "6.0.0",
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: Date.now(),
			},
			500,
		);
	}
});

// ==================== Mount v6.0 API Endpoints ====================
app.route('/api/v6', v6Endpoints);

// ==================== Legacy AtomSpace API Routes ====================
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

// ==================== Legacy MindAgent API Routes ====================
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

// ==================== Legacy Cognitive Dashboard API ====================
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

// ==================== Legacy Cognitive Operations API ====================
app.post("/api/cognitive/perceive", async (c) => {
	try {
		const { input, inputType = "text" } = await c.req.json();

		const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

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

app.post("/api/cognitive/reason", async (c) => {
	try {
		const { query, context } = await c.req.json();

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

// ==================== Health Check ====================
app.get("/health", async (c) => {
	return c.json({
		status: "healthy",
		platform: "FlareCog OpenCog Platform",
		version: "6.0.0",
		timestamp: Date.now(),
	});
});

// ==================== Queue Consumers ====================

async function handleCognitiveQueue(batch: MessageBatch<any>, env: Env): Promise<void> {
  const queueIntegration = new CloudflareQueueIntegration({
    COGNITIVE_QUEUE: env.COGNITIVE_QUEUE,
    INFERENCE_QUEUE: env.INFERENCE_QUEUE,
    CONSOLIDATION_QUEUE: env.CONSOLIDATION_QUEUE,
    COORDINATION_QUEUE: env.COORDINATION_QUEUE,
    TASK_RESULTS: env.TASK_RESULTS,
    ATOMSPACE_DO: env.ATOMSPACE
  });

  for (const message of batch.messages) {
    try {
      const task = message.body;
      await queueIntegration.processTask(task);
      message.ack();
    } catch (error) {
      console.error('Error processing cognitive task:', error);
      message.retry();
    }
  }
}

async function runMindAgents(env: Env): Promise<void> {
  console.log('Running v6.0 MindAgents...');
  
  const agents = getAgentsByPriority();
  
  for (const agent of agents) {
    try {
      const result = await agent.run(env);
      console.log(`Agent ${agent.name}: ${result.success ? 'SUCCESS' : 'FAILED'}`, {
        atomsProcessed: result.atomsProcessed,
        changes: result.changes
      });
    } catch (error) {
      console.error(`Error running agent ${agent.name}:`, error);
    }
  }
}

// ==================== Worker Export ====================

export { AtomSpace, MindAgent };
export { CRDTAtomSpaceCoordinator } from './durable-objects/CRDTAtomSpaceCoordinator';

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		return app.fetch(request, env, ctx);
	},

	async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
		await handleCognitiveQueue(batch, env);
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(runMindAgents(env));
	}
} satisfies ExportedHandler<Env>;

// ==================== Type Definitions ====================

interface MessageBatch<T> {
  queue: string;
  messages: Message<T>[];
}

interface Message<T> {
  id: string;
  timestamp: Date;
  body: T;
  ack(): void;
  retry(): void;
}

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

interface ExportedHandler<Env> {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
  queue?(batch: MessageBatch<any>, env: Env): Promise<void>;
  scheduled?(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void>;
}
