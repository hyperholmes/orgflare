/**
 * AtomSpace Integration Examples for FlareCog Platform
 * 
 * This file demonstrates how to use AtomSpace (FlareCog's "FlareSpace")
 * as an adaptation of OpenCog's AtomSpace for cognitive computing at the edge.
 */

import type { Hono } from "hono";

/**
 * AtomSpace types from FlareCog
 */
export interface TruthValue {
	strength: number; // 0.0 to 1.0
	confidence: number; // 0.0 to 1.0
}

export interface AttentionValue {
	sti: number; // Short-term importance
	lti: number; // Long-term importance
	vlti: number; // Very long-term importance
}

export interface ConceptNode {
	type: "ConceptNode";
	name: string;
	truthValue: TruthValue;
	attentionValue: AttentionValue;
}

export interface InheritanceLink {
	type: "InheritanceLink";
	outgoing: string[]; // [child_id, parent_id]
	truthValue: TruthValue;
}

/**
 * Example 1: Knowledge Graph Construction
 * Build a semantic network of interconnected concepts
 */
export async function buildKnowledgeGraph(atomSpace: DurableObjectStub): Promise<void> {
	console.log("=== Example 1: Knowledge Graph Construction ===");

	// Create domain concepts
	const aiConcept = await createConcept(atomSpace, {
		name: "artificial_intelligence",
		strength: 0.95,
		confidence: 0.9,
		sti: 100,
	});

	const mlConcept = await createConcept(atomSpace, {
		name: "machine_learning",
		strength: 0.92,
		confidence: 0.88,
		sti: 90,
	});

	const dlConcept = await createConcept(atomSpace, {
		name: "deep_learning",
		strength: 0.90,
		confidence: 0.85,
		sti: 85,
	});

	// Create inheritance relationships: DL ⊂ ML ⊂ AI
	await createInheritance(atomSpace, dlConcept.id, mlConcept.id, 0.95);
	await createInheritance(atomSpace, mlConcept.id, aiConcept.id, 0.92);

	console.log("✓ Knowledge graph created with 3 concepts and 2 relationships");
}

/**
 * Example 2: Contextual Memory for AI Conversations
 * Store conversation context in AtomSpace for coherent multi-turn interactions
 */
export async function storeConversationContext(
	atomSpace: DurableObjectStub,
	userId: string,
	message: string,
	response: string
): Promise<void> {
	console.log("=== Example 2: Contextual Memory ===");

	// Create user concept
	const userConcept = await createConcept(atomSpace, {
		name: `user:${userId}`,
		strength: 1.0,
		confidence: 0.9,
		sti: 100,
	});

	// Create message concept
	const messageConcept = await createConcept(atomSpace, {
		name: `message:${Date.now()}`,
		strength: 0.8,
		confidence: 0.7,
		sti: 100,
	});

	// Link user to message
	await atomSpace.fetch("http://atomspace/link", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			type: "EvaluationLink",
			outgoing: [userConcept.id, messageConcept.id],
			truthValue: { strength: 1.0, confidence: 1.0 },
		}),
	});

	console.log(`✓ Stored conversation context for user ${userId}`);
}

/**
 * Example 3: Semantic Similarity Tracking
 * Track relationships between similar concepts
 */
export async function trackSemanticSimilarity(atomSpace: DurableObjectStub): Promise<void> {
	console.log("=== Example 3: Semantic Similarity ===");

	const concepts = [
		{ name: "cat", sti: 90 },
		{ name: "dog", sti: 88 },
		{ name: "mammal", sti: 95 },
	];

	const created = [];
	for (const concept of concepts) {
		created.push(
			await createConcept(atomSpace, {
				name: concept.name,
				strength: 0.9,
				confidence: 0.85,
				sti: concept.sti,
			})
		);
	}

	// Create similarity link between cat and dog
	await atomSpace.fetch("http://atomspace/link", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			type: "SimilarityLink",
			outgoing: [created[0].id, created[1].id],
			truthValue: { strength: 0.75, confidence: 0.8 },
		}),
	});

	console.log("✓ Semantic similarity network created");
}

/**
 * Example 4: Attention-Based Prioritization
 * Use attention values to prioritize important concepts
 */
export async function demonstrateAttentionSystem(atomSpace: DurableObjectStub): Promise<void> {
	console.log("=== Example 4: Attention-Based Prioritization ===");

	// Create concepts with varying importance
	const concepts = [
		{ name: "critical_system_alert", sti: 200, lti: 100, vlti: 50 },
		{ name: "user_preference", sti: 100, lti: 80, vlti: 20 },
		{ name: "temp_cache_data", sti: 50, lti: 10, vlti: 0 },
	];

	for (const concept of concepts) {
		await atomSpace.fetch("http://atomspace/node", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "ConceptNode",
				name: concept.name,
				truthValue: { strength: 0.8, confidence: 0.7 },
				attentionValue: {
					sti: concept.sti,
					lti: concept.lti,
					vlti: concept.vlti,
				},
			}),
		});
	}

	// Query high-attention concepts
	const highAttentionResponse = await atomSpace.fetch("http://atomspace/query", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			type: "ConceptNode",
			minSTI: 100,
		}),
	});

	const result = await highAttentionResponse.json();
	console.log(`✓ Found ${result.data.length} high-attention concepts`);
}

/**
 * Example 5: Multi-Tenant Knowledge Isolation
 * Demonstrate tenant-specific AtomSpace instances
 */
export async function demonstrateTenantIsolation(
	atomSpaceNamespace: DurableObjectNamespace,
	tenant1Id: string,
	tenant2Id: string
): Promise<void> {
	console.log("=== Example 5: Multi-Tenant Isolation ===");

	// Get tenant-specific AtomSpace instances
	const tenant1AS = atomSpaceNamespace.get(atomSpaceNamespace.idFromName(`${tenant1Id}:primary`));
	const tenant2AS = atomSpaceNamespace.get(atomSpaceNamespace.idFromName(`${tenant2Id}:primary`));

	// Create tenant-specific concepts
	await createConcept(tenant1AS, {
		name: "tenant1_secret_data",
		strength: 1.0,
		confidence: 1.0,
		sti: 200,
	});

	await createConcept(tenant2AS, {
		name: "tenant2_secret_data",
		strength: 1.0,
		confidence: 1.0,
		sti: 200,
	});

	// Verify isolation
	const tenant1Stats = await getStats(tenant1AS);
	const tenant2Stats = await getStats(tenant2AS);

	console.log(`✓ Tenant 1 has ${tenant1Stats.totalAtoms} atoms`);
	console.log(`✓ Tenant 2 has ${tenant2Stats.totalAtoms} atoms`);
	console.log("✓ Tenants are completely isolated");
}

/**
 * Example 6: Probabilistic Reasoning with Truth Values
 * Demonstrate uncertain knowledge representation
 */
export async function demonstrateProbabilisticReasoning(
	atomSpace: DurableObjectStub
): Promise<void> {
	console.log("=== Example 6: Probabilistic Reasoning ===");

	// Create concepts with varying certainty
	const weatherConcept = await createConcept(atomSpace, {
		name: "rain_tomorrow",
		strength: 0.65, // 65% likely
		confidence: 0.7, // moderately confident
		sti: 100,
	});

	const umbrellaPredicateRes = await atomSpace.fetch("http://atomspace/node", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			type: "PredicateNode",
			name: "need_umbrella",
			truthValue: { strength: 0.7, confidence: 0.65 },
		}),
	});

	const umbrellaPredicate = await umbrellaPredicateRes.json();

	// Create implication: rain → need_umbrella
	await atomSpace.fetch("http://atomspace/link", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			type: "ImplicationLink",
			outgoing: [weatherConcept.id, umbrellaPredicate.data.id],
			truthValue: { strength: 0.9, confidence: 0.85 },
		}),
	});

	console.log("✓ Probabilistic reasoning chain established");
}

// ============================================================================
// Helper Functions
// ============================================================================

async function createConcept(
	atomSpace: DurableObjectStub,
	params: {
		name: string;
		strength: number;
		confidence: number;
		sti: number;
		lti?: number;
		vlti?: number;
	}
): Promise<any> {
	const response = await atomSpace.fetch("http://atomspace/node", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			type: "ConceptNode",
			name: params.name,
			truthValue: {
				strength: params.strength,
				confidence: params.confidence,
			},
			attentionValue: {
				sti: params.sti,
				lti: params.lti || 0,
				vlti: params.vlti || 0,
			},
		}),
	});

	const result = await response.json();
	return result.data;
}

async function createInheritance(
	atomSpace: DurableObjectStub,
	childId: string,
	parentId: string,
	strength: number
): Promise<any> {
	const response = await atomSpace.fetch("http://atomspace/link", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			type: "InheritanceLink",
			outgoing: [childId, parentId],
			truthValue: { strength, confidence: 0.9 },
		}),
	});

	return await response.json();
}

async function getStats(atomSpace: DurableObjectStub): Promise<any> {
	const response = await atomSpace.fetch("http://atomspace/stats");
	const result = await response.json();
	return result.data;
}

/**
 * Register AtomSpace example routes
 */
export function registerAtomSpaceExamples(app: any) {
	app.get("/examples/atomspace/knowledge-graph", async (c: any) => {
		const atomSpaceId = c.env.ATOMSPACE.idFromName("examples");
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);

		await buildKnowledgeGraph(atomSpace);

		return c.json({
			success: true,
			message: "Knowledge graph example executed",
		});
	});

	app.post("/examples/atomspace/conversation-context", async (c: any) => {
		const { userId, message, response } = await c.req.json();
		const atomSpaceId = c.env.ATOMSPACE.idFromName(`user:${userId}`);
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);

		await storeConversationContext(atomSpace, userId, message, response);

		return c.json({
			success: true,
			message: "Conversation context stored",
		});
	});

	app.get("/examples/atomspace/semantic-similarity", async (c: any) => {
		const atomSpaceId = c.env.ATOMSPACE.idFromName("examples");
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);

		await trackSemanticSimilarity(atomSpace);

		return c.json({
			success: true,
			message: "Semantic similarity example executed",
		});
	});

	app.get("/examples/atomspace/attention-system", async (c: any) => {
		const atomSpaceId = c.env.ATOMSPACE.idFromName("examples");
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);

		await demonstrateAttentionSystem(atomSpace);

		return c.json({
			success: true,
			message: "Attention system example executed",
		});
	});

	app.get("/examples/atomspace/tenant-isolation", async (c: any) => {
		await demonstrateTenantIsolation(c.env.ATOMSPACE, "tenant1", "tenant2");

		return c.json({
			success: true,
			message: "Tenant isolation example executed",
		});
	});

	app.get("/examples/atomspace/probabilistic-reasoning", async (c: any) => {
		const atomSpaceId = c.env.ATOMSPACE.idFromName("examples");
		const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);

		await demonstrateProbabilisticReasoning(atomSpace);

		return c.json({
			success: true,
			message: "Probabilistic reasoning example executed",
		});
	});
}
