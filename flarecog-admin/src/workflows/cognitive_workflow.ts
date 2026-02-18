import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";

type Env = {
	COGNITIVE_WORKFLOW: WorkflowEntrypoint<Env, Params>;
	DB: D1Database;
	ATOMSPACE: DurableObjectNamespace;
	MIND_AGENT: DurableObjectNamespace;
};

type Params = {
	tenantId: string;
	operation:
		| "reasoning"
		| "consolidation"
		| "learning"
		| "attention_update"
		| "metrics_collection";
	config?: any;
};

export class CognitiveWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const { DB, ATOMSPACE, MIND_AGENT } = this.env;
		const { tenantId, operation, config = {} } = event.payload;

		// Step 1: Fetch tenant information
		const tenant = await step.do("fetch tenant", async () => {
			const resp = await DB.prepare(
				`SELECT * FROM tenants WHERE id = ?`,
			)
				.bind(tenantId)
				.run();
			if (resp.success && resp.results.length > 0)
				return resp.results[0];
			return null;
		});

		if (!tenant) {
			console.error(`Tenant ${tenantId} not found`);
			return;
		}

		if (tenant.status !== "active") {
			console.log(
				`Tenant ${tenantId} is not active (status: ${tenant.status})`,
			);
			return;
		}

		// Step 2: Get AtomSpace stats
		const atomSpaceStats = await step.do(
			"fetch atomspace stats",
			async () => {
				try {
					const id = ATOMSPACE.idFromName(`${tenantId}:primary`);
					const stub = ATOMSPACE.get(id);

					const response = await stub.fetch(
						new Request("http://dummy/stats", { method: "GET" }),
					);

					return await response.json();
				} catch (error) {
					console.error("Failed to fetch AtomSpace stats:", error);
					return null;
				}
			},
		);

		// Step 3: Perform operation based on type
		if (operation === "reasoning") {
			await step.do("perform reasoning", async () => {
				try {
					const id = MIND_AGENT.idFromName(`${tenantId}:primary`);
					const stub = MIND_AGENT.get(id);

					const maxSteps = config.maxSteps || 100;

					await stub.fetch(
						new Request("http://dummy/execute", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								agentType: "reasoning",
								maxSteps: maxSteps,
							}),
						}),
					);

					console.log(
						`Reasoning completed for tenant ${tenantId}`,
					);
				} catch (error) {
					console.error("Failed to perform reasoning:", error);
				}
			});
		} else if (operation === "consolidation") {
			await step.do("perform consolidation", async () => {
				try {
					const id = MIND_AGENT.idFromName(`${tenantId}:primary`);
					const stub = MIND_AGENT.get(id);

					await stub.fetch(
						new Request("http://dummy/execute", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								agentType: "consolidation",
								maxSteps: 50,
							}),
						}),
					);

					console.log(
						`Consolidation completed for tenant ${tenantId}`,
					);
				} catch (error) {
					console.error("Failed to perform consolidation:", error);
				}
			});
		} else if (operation === "learning") {
			await step.do("perform learning", async () => {
				try {
					const id = MIND_AGENT.idFromName(`${tenantId}:primary`);
					const stub = MIND_AGENT.get(id);

					const learningRate = config.learningRate || 0.1;

					await stub.fetch(
						new Request("http://dummy/execute", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								agentType: "learning",
								learningRate: learningRate,
							}),
						}),
					);

					console.log(`Learning completed for tenant ${tenantId}`);
				} catch (error) {
					console.error("Failed to perform learning:", error);
				}
			});
		} else if (operation === "attention_update") {
			await step.do("update attention values", async () => {
				try {
					const id = ATOMSPACE.idFromName(`${tenantId}:primary`);
					const stub = ATOMSPACE.get(id);

					await stub.fetch(
						new Request("http://dummy/update-attention", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								decay: config.decay || 0.1,
							}),
						}),
					);

					console.log(
						`Attention values updated for tenant ${tenantId}`,
					);
				} catch (error) {
					console.error(
						"Failed to update attention values:",
						error,
					);
				}
			});
		} else if (operation === "metrics_collection") {
			await step.do("collect metrics", async () => {
				try {
					if (!atomSpaceStats) {
						console.log("No AtomSpace stats available");
						return;
					}

					// Record metrics
					await DB.prepare(
						`INSERT INTO cognitive_metrics 
            (tenant_id, timestamp, atoms_created, atoms_queried, inferences_performed, agents_executed, ai_calls_made, response_time_ms, success) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
						.bind(
							tenantId,
							Date.now(),
							atomSpaceStats.totalAtoms || 0,
							0,
							0,
							0,
							0,
							0,
							1,
						)
						.run();

					console.log(
						`Metrics collected for tenant ${tenantId}`,
					);
				} catch (error) {
					console.error("Failed to collect metrics:", error);
				}
			});
		}

		// Step 4: Update metrics
		await step.do("update cognitive metrics", async () => {
			try {
				const timestamp = Date.now();

				await DB.prepare(
					`INSERT INTO cognitive_metrics 
          (tenant_id, timestamp, atoms_created, atoms_queried, inferences_performed, agents_executed, ai_calls_made, response_time_ms, success) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
					.bind(
						tenantId,
						timestamp,
						0,
						0,
						operation === "reasoning" ? 1 : 0,
						1,
						0,
						0,
						1,
					)
					.run();

				console.log(
					`Metrics updated for tenant ${tenantId}, operation: ${operation}`,
				);
			} catch (error) {
				console.error("Failed to update metrics:", error);
			}
		});

		// Step 5: Record billing event if applicable
		if (
			operation === "reasoning" ||
			operation === "consolidation" ||
			operation === "learning"
		) {
			await step.do("record billing event", async () => {
				try {
					await DB.prepare(
						`INSERT INTO billing_events (tenant_id, event_type, amount, currency, timestamp, metadata) 
            VALUES (?, ?, ?, ?, ?, ?)`,
					)
						.bind(
							tenantId,
							"usage_recorded",
							0,
							"USD",
							Date.now(),
							JSON.stringify({ operation: operation }),
						)
						.run();

					console.log(
						`Billing event recorded for tenant ${tenantId}`,
					);
				} catch (error) {
					console.error("Failed to record billing event:", error);
				}
			});
		}
	}
}
