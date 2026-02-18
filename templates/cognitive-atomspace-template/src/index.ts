import { Hono } from "hono";
import { AtomSpace } from "./atomspace";
import type { TruthValue, AttentionValue, AtomSpaceQuery } from "./types";

// Export Durable Object
export { AtomSpace };

type Bindings = {
	ATOMSPACE: DurableObjectNamespace<AtomSpace>;
	AI: Ai;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Home page with cognitive dashboard
 */
app.get("/", (c) => {
	return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Cognitive AtomSpace - FlareCog</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			min-height: 100vh;
			padding: 2rem;
			color: #333;
		}
		.container {
			max-width: 1200px;
			margin: 0 auto;
			background: white;
			border-radius: 16px;
			padding: 2rem;
			box-shadow: 0 20px 60px rgba(0,0,0,0.3);
		}
		h1 {
			color: #667eea;
			margin-bottom: 0.5rem;
			font-size: 2.5rem;
		}
		.subtitle {
			color: #666;
			margin-bottom: 2rem;
			font-size: 1.1rem;
		}
		.section {
			margin: 2rem 0;
			padding: 1.5rem;
			background: #f7fafc;
			border-radius: 8px;
			border-left: 4px solid #667eea;
		}
		h2 {
			color: #667eea;
			margin-bottom: 1rem;
			font-size: 1.5rem;
		}
		.api-endpoint {
			background: white;
			padding: 1rem;
			margin: 0.5rem 0;
			border-radius: 6px;
			border: 1px solid #e2e8f0;
		}
		.method {
			display: inline-block;
			padding: 0.25rem 0.75rem;
			border-radius: 4px;
			font-weight: bold;
			margin-right: 1rem;
			font-size: 0.875rem;
		}
		.post { background: #48bb78; color: white; }
		.get { background: #4299e1; color: white; }
		code {
			background: #edf2f7;
			padding: 0.2rem 0.4rem;
			border-radius: 4px;
			font-family: 'Monaco', 'Courier New', monospace;
			font-size: 0.875rem;
		}
		.feature {
			display: flex;
			align-items: center;
			margin: 1rem 0;
			padding: 1rem;
			background: white;
			border-radius: 6px;
		}
		.feature-icon {
			font-size: 2rem;
			margin-right: 1rem;
		}
		.stats {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 1rem;
			margin: 1rem 0;
		}
		.stat-card {
			background: white;
			padding: 1.5rem;
			border-radius: 8px;
			text-align: center;
			border: 2px solid #667eea;
		}
		.stat-value {
			font-size: 2rem;
			font-weight: bold;
			color: #667eea;
			margin: 0.5rem 0;
		}
		.stat-label {
			color: #666;
			font-size: 0.875rem;
		}
		button {
			background: #667eea;
			color: white;
			border: none;
			padding: 0.75rem 1.5rem;
			border-radius: 6px;
			font-size: 1rem;
			cursor: pointer;
			transition: background 0.3s;
		}
		button:hover {
			background: #5568d3;
		}
		#statsDisplay {
			margin-top: 1rem;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>🧠 Cognitive AtomSpace</h1>
		<p class="subtitle">Hypergraph Knowledge Representation on Cloudflare Workers</p>

		<div class="section">
			<h2>What is AtomSpace?</h2>
			<p>AtomSpace is a hypergraph knowledge representation system from OpenCog that stores concepts (Nodes) and relationships (Links) with probabilistic truth values and attention values. This template demonstrates cognitive computing at the edge using Cloudflare Durable Objects.</p>
		</div>

		<div class="section">
			<h2>Key Features</h2>
			<div class="feature">
				<span class="feature-icon">🔗</span>
				<div>
					<strong>Hypergraph Structure</strong>
					<p>Store complex relationships between concepts as nodes and links</p>
				</div>
			</div>
			<div class="feature">
				<span class="feature-icon">📊</span>
				<div>
					<strong>Truth Values</strong>
					<p>Probabilistic knowledge with strength and confidence measures</p>
				</div>
			</div>
			<div class="feature">
				<span class="feature-icon">🎯</span>
				<div>
					<strong>Attention Values</strong>
					<p>Focus cognitive resources on important concepts (STI, LTI, VLTI)</p>
				</div>
			</div>
			<div class="feature">
				<span class="feature-icon">⚡</span>
				<div>
					<strong>Edge Computing</strong>
					<p>Global cognitive processing with Durable Objects persistence</p>
				</div>
			</div>
		</div>

		<div class="section">
			<h2>API Endpoints</h2>
			
			<div class="api-endpoint">
				<span class="method post">POST</span>
				<code>/atomspace/node</code>
				<p>Create a concept node (ConceptNode, PredicateNode, VariableNode)</p>
			</div>

			<div class="api-endpoint">
				<span class="method post">POST</span>
				<code>/atomspace/link</code>
				<p>Create a relationship link (InheritanceLink, SimilarityLink, etc.)</p>
			</div>

			<div class="api-endpoint">
				<span class="method get">GET</span>
				<code>/atomspace/atom/:id</code>
				<p>Get atom by ID</p>
			</div>

			<div class="api-endpoint">
				<span class="method post">POST</span>
				<code>/atomspace/query</code>
				<p>Query atoms by type, name, truth values, or attention values</p>
			</div>

			<div class="api-endpoint">
				<span class="method get">GET</span>
				<code>/atomspace/stats</code>
				<p>Get AtomSpace statistics</p>
			</div>
		</div>

		<div class="section">
			<h2>Live Statistics</h2>
			<button onclick="loadStats()">Refresh Stats</button>
			<div id="statsDisplay">
				<p style="color: #666; margin-top: 1rem;">Click "Refresh Stats" to load current AtomSpace statistics</p>
			</div>
		</div>

		<div class="section">
			<h2>Example Usage</h2>
			<p><strong>Create a concept:</strong></p>
			<pre><code>fetch('/atomspace/node', {
  method: 'POST',
  body: JSON.stringify({
    type: 'ConceptNode',
    name: 'intelligence',
    truthValue: { strength: 0.9, confidence: 0.8 },
    attentionValue: { sti: 100, lti: 50, vlti: 20 }
  })
})</code></pre>
			
			<p style="margin-top: 1rem;"><strong>Create a relationship:</strong></p>
			<pre><code>// First create two concepts, then link them
fetch('/atomspace/link', {
  method: 'POST',
  body: JSON.stringify({
    type: 'InheritanceLink',
    outgoing: [conceptId1, conceptId2],
    truthValue: { strength: 0.95, confidence: 0.9 }
  })
})</code></pre>
		</div>
	</div>

	<script>
		async function loadStats() {
			const display = document.getElementById('statsDisplay');
			display.innerHTML = '<p style="color: #666;">Loading...</p>';
			
			try {
				const response = await fetch('/atomspace/stats');
				const result = await response.json();
				
				if (result.success) {
					const stats = result.data;
					display.innerHTML = \`
						<div class="stats">
							<div class="stat-card">
								<div class="stat-label">Total Atoms</div>
								<div class="stat-value">\${stats.totalAtoms}</div>
							</div>
							<div class="stat-card">
								<div class="stat-label">Nodes</div>
								<div class="stat-value">\${stats.nodeCount}</div>
							</div>
							<div class="stat-card">
								<div class="stat-label">Links</div>
								<div class="stat-value">\${stats.linkCount}</div>
							</div>
							<div class="stat-card">
								<div class="stat-label">Avg STI</div>
								<div class="stat-value">\${stats.averageSTI.toFixed(1)}</div>
							</div>
							<div class="stat-card">
								<div class="stat-label">Avg Truth</div>
								<div class="stat-value">\${stats.averageTruthStrength.toFixed(2)}</div>
							</div>
						</div>
					\`;
				} else {
					display.innerHTML = '<p style="color: red;">Error loading stats</p>';
				}
			} catch (error) {
				display.innerHTML = \`<p style="color: red;">Error: \${error.message}</p>\`;
			}
		}
	</script>
</body>
</html>`);
});

/**
 * AtomSpace endpoints - proxy to Durable Object
 */
app.all("/atomspace/*", async (c) => {
	// Get or create AtomSpace instance
	const id = c.env.ATOMSPACE.idFromName("primary");
	const stub = c.env.ATOMSPACE.get(id);

	// Forward request to Durable Object
	const url = new URL(c.req.url);
	url.pathname = url.pathname.replace("/atomspace", "");

	const response = await stub.fetch(new Request(url.toString(), {
		method: c.req.method,
		headers: c.req.raw.headers,
		body: c.req.raw.body,
	}));

	return response;
});

/**
 * AI-enhanced perception endpoint
 */
app.post("/api/perceive", async (c) => {
	try {
		const { text } = await c.req.json<{ text: string }>();

		// Use Workers AI to extract concepts
		const response: any = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct" as any, {
			messages: [
				{
					role: "system",
					content: "You are a cognitive perception system. Extract key concepts from text as a JSON array of concept names. Respond only with the JSON array, no other text.",
				},
				{
					role: "user",
					content: `Extract key concepts from: ${text}`,
				},
			],
		});

		// Parse response
		const concepts = typeof response === "string" ? JSON.parse(response) : response;

		// Create nodes in AtomSpace
		const id = c.env.ATOMSPACE.idFromName("primary");
		const stub = c.env.ATOMSPACE.get(id);

		const createdNodes = [];
		for (const concept of concepts) {
			try {
				const nodeResponse = await stub.fetch(new Request("http://atomspace/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "ConceptNode",
						name: concept,
						truthValue: { strength: 0.7, confidence: 0.6 },
						attentionValue: { sti: 100, lti: 10, vlti: 0 },
					}),
				}));

				const result: any = await nodeResponse.json();
				if (result.success) {
					createdNodes.push(result.data);
				}
			} catch (err) {
				// Node might already exist, skip
			}
		}

		return c.json({
			success: true,
			concepts,
			createdNodes,
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500
		);
	}
});

export default app;
