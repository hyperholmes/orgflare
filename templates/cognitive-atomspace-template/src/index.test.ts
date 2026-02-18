import { describe, it, expect, beforeAll } from "vitest";
// @ts-ignore - cloudflare:test not available in types
import { env, createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";

describe("Cognitive AtomSpace Template", () => {
	let atomspaceId: string;

	beforeAll(async () => {
		// Initialize AtomSpace
		const id = env.ATOMSPACE.idFromName("test");
		const stub = env.ATOMSPACE.get(id);
		await stub.fetch(new Request("http://test/stats"));
	});

	it("should create a ConceptNode", async () => {
		const response = await SELF.fetch("http://example.com/atomspace/node", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "ConceptNode",
				name: "test-concept",
				truthValue: { strength: 0.8, confidence: 0.7 },
				attentionValue: { sti: 100, lti: 50, vlti: 10 },
			}),
		});

		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.success).toBe(true);
		expect(result.data.type).toBe("ConceptNode");
		expect(result.data.name).toBe("test-concept");
		expect(result.data.truthValue.strength).toBe(0.8);
		atomspaceId = result.data.id;
	});

	it("should retrieve an atom by ID", async () => {
		// Create a node first
		const createRes = await SELF.fetch("http://example.com/atomspace/node", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "ConceptNode",
				name: "retrieve-test",
				truthValue: { strength: 0.9, confidence: 0.8 },
			}),
		});
		const created = await createRes.json();
		const id = created.data.id;

		// Retrieve it
		const response = await SELF.fetch(`http://example.com/atomspace/atom/${id}`);
		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.success).toBe(true);
		expect(result.data.id).toBe(id);
		expect(result.data.name).toBe("retrieve-test");
	});

	it("should create a Link between nodes", async () => {
		// Create two nodes
		const node1Res = await SELF.fetch("http://example.com/atomspace/node", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "ConceptNode",
				name: "cat",
			}),
		});
		const node1 = await node1Res.json();

		const node2Res = await SELF.fetch("http://example.com/atomspace/node", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "ConceptNode",
				name: "mammal",
			}),
		});
		const node2 = await node2Res.json();

		// Create link
		const response = await SELF.fetch("http://example.com/atomspace/link", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "InheritanceLink",
				outgoing: [node1.data.id, node2.data.id],
				truthValue: { strength: 0.95, confidence: 0.9 },
			}),
		});

		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.success).toBe(true);
		expect(result.data.type).toBe("InheritanceLink");
		expect(result.data.outgoing).toHaveLength(2);
	});

	it("should query atoms by type", async () => {
		// Create some test nodes
		await SELF.fetch("http://example.com/atomspace/node", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "ConceptNode",
				name: "query-test-1",
			}),
		});

		await SELF.fetch("http://example.com/atomspace/node", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "PredicateNode",
				name: "query-test-pred",
			}),
		});

		// Query ConceptNodes
		const response = await SELF.fetch("http://example.com/atomspace/query", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "ConceptNode",
			}),
		});

		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.success).toBe(true);
		expect(Array.isArray(result.data)).toBe(true);
		expect(result.data.length).toBeGreaterThan(0);
	});

	it("should return statistics", async () => {
		const response = await SELF.fetch("http://example.com/atomspace/stats");
		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.success).toBe(true);
		expect(result.data).toHaveProperty("totalAtoms");
		expect(result.data).toHaveProperty("nodeCount");
		expect(result.data).toHaveProperty("linkCount");
		expect(result.data).toHaveProperty("averageSTI");
		expect(result.data).toHaveProperty("averageTruthStrength");
	});

	it("should render the home page", async () => {
		const response = await SELF.fetch("http://example.com/");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		const html = await response.text();
		expect(html).toContain("Cognitive AtomSpace");
		expect(html).toContain("Hypergraph Knowledge Representation");
	});

	it("should handle AI perception endpoint", async () => {
		const response = await SELF.fetch("http://example.com/api/perceive", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				text: "Cognitive computing enables intelligent systems",
			}),
		});

		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.success).toBe(true);
		expect(Array.isArray(result.concepts)).toBe(true);
	});
});
