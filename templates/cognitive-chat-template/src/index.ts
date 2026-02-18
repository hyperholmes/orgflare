/**
 * Cognitive Chat Application Template
 *
 * An AI chat application with cognitive memory using AtomSpace.
 * This template demonstrates how to build context-aware LLM interactions
 * with persistent knowledge representation using OpenCog's AtomSpace.
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";
import { AtomSpace } from "./atomspace";

// Export AtomSpace Durable Object
export { AtomSpace };

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Default system prompt
const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant with access to cognitive memory. You can remember concepts and relationships from previous conversations. Provide concise and accurate responses.";

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Cognitive memory endpoints
		if (url.pathname === "/api/memory/concepts") {
			return handleMemoryConcepts(request, env);
		}

		if (url.pathname === "/api/memory/stats") {
			return handleMemoryStats(request, env);
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests with cognitive memory integration
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [], userId = "default" } = (await request.json()) as {
			messages: ChatMessage[];
			userId?: string;
		};

		// Get user-specific AtomSpace
		const atomSpaceId = env.ATOMSPACE.idFromName(userId);
		const atomSpace = env.ATOMSPACE.get(atomSpaceId);

		// Extract concepts from user message
		const userMessage = messages[messages.length - 1]?.content || "";
		if (userMessage) {
			await storeConceptsInMemory(atomSpace, userMessage, userId);
		}

		// Retrieve relevant context from cognitive memory
		const contextResponse = await atomSpace.fetch("http://atomspace/query", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "ConceptNode",
				minSTI: 50, // Get important concepts
				limit: 10,
			}),
		});

		const contextResult: any = await contextResponse.json();
		const relevantConcepts = contextResult.success 
			? contextResult.data.map((atom: any) => atom.name).join(", ")
			: "";

		// Enhance system prompt with context
		const enhancedSystemPrompt = relevantConcepts
			? `${SYSTEM_PROMPT}\n\nRelevant concepts from memory: ${relevantConcepts}`
			: SYSTEM_PROMPT;

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: enhancedSystemPrompt });
		} else {
			// Update existing system prompt with context
			const systemMsg = messages.find((msg) => msg.role === "system");
			if (systemMsg) {
				systemMsg.content = enhancedSystemPrompt;
			}
		}

		const response: any = await env.AI.run(
			MODEL_ID as any,
			{
				messages,
				max_tokens: 1024,
			},
			{
				returnRawResponse: true,
			},
		);

		// Return streaming response
		return response;
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}

/**
 * Store concepts extracted from message in cognitive memory
 */
async function storeConceptsInMemory(
	atomSpace: DurableObjectStub,
	text: string,
	userId: string
): Promise<void> {
	// Simple concept extraction (split by spaces, filter common words)
	const commonWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "is", "are", "was", "were"]);
	const concepts = text
		.toLowerCase()
		.split(/\W+/)
		.filter((word) => word.length > 3 && !commonWords.has(word))
		.slice(0, 5); // Limit to 5 concepts per message

	// Store concepts in AtomSpace
	for (const concept of concepts) {
		try {
			await atomSpace.fetch("http://atomspace/node", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "ConceptNode",
					name: concept,
					truthValue: { strength: 0.7, confidence: 0.6 },
					attentionValue: { sti: 100, lti: 20, vlti: 0 },
				}),
			});
		} catch (err) {
			// Concept might already exist
		}
	}

	// Create user concept node
	try {
		await atomSpace.fetch("http://atomspace/node", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "ConceptNode",
				name: `user:${userId}`,
				truthValue: { strength: 1.0, confidence: 1.0 },
				attentionValue: { sti: 150, lti: 50, vlti: 10 },
			}),
		});
	} catch (err) {
		// User concept might already exist
	}
}

/**
 * Get concepts from cognitive memory
 */
async function handleMemoryConcepts(
	request: Request,
	env: Env
): Promise<Response> {
	try {
		const url = new URL(request.url);
		const userId = url.searchParams.get("userId") || "default";

		const atomSpaceId = env.ATOMSPACE.idFromName(userId);
		const atomSpace = env.ATOMSPACE.get(atomSpaceId);

		const response = await atomSpace.fetch("http://atomspace/query", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "ConceptNode",
				minSTI: 0,
				limit: 50,
			}),
		});

		return response;
	} catch (error) {
		return new Response(
			JSON.stringify({ error: "Failed to retrieve memory" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}

/**
 * Get cognitive memory statistics
 */
async function handleMemoryStats(
	request: Request,
	env: Env
): Promise<Response> {
	try {
		const url = new URL(request.url);
		const userId = url.searchParams.get("userId") || "default";

		const atomSpaceId = env.ATOMSPACE.idFromName(userId);
		const atomSpace = env.ATOMSPACE.get(atomSpaceId);

		const response = await atomSpace.fetch("http://atomspace/stats");
		return response;
	} catch (error) {
		return new Response(
			JSON.stringify({ error: "Failed to retrieve stats" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}
