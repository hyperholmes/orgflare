import { DurableObject } from "cloudflare:workers";
import { nanoid } from "nanoid";
import {
	Env,
	MindAgentConfig,
	MindAgentType,
	MindAgentResult,
	Goal,
	GoalType,
	GoalStatus,
	AtomSpaceQuery,
} from "../types/cognitive";

/**
 * MindAgent Durable Object - Autonomous cognitive processing agents
 *
 * Implements various cognitive functions that operate on the AtomSpace:
 * - ForgetAgent: Manages attention decay and memory cleanup
 * - HebbianAgent: Implements Hebbian learning patterns
 * - ImportanceSpreadingAgent: Spreads attention through the network
 * - GoalAgent: Manages and pursues system goals
 * - ReasoningAgent: Performs logical inference
 * - LearningAgent: Adapts system behavior based on experience
 */
export class MindAgent extends DurableObject<Env> {
	private agents: Map<string, MindAgentConfig> = new Map();
	private executionQueue: Array<{ agentId: string; scheduledTime: number }> =
		[];
	private isRunning = false;
	private goals: Map<string, Goal> = new Map();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.loadState();
		this.startScheduler();
	}

	/**
	 * Load agent state from storage
	 */
	private async loadState(): Promise<void> {
		const agentsData =
			(await this.ctx.storage.get<MindAgentConfig[]>("agents")) || [];
		const goalsData = (await this.ctx.storage.get<Goal[]>("goals")) || [];

		agentsData.forEach((agent) => this.agents.set(agent.id, agent));
		goalsData.forEach((goal) => this.goals.set(goal.id, goal));

		// Initialize default agents if none exist
		if (this.agents.size === 0) {
			await this.initializeDefaultAgents();
		}
	}

	/**
	 * Save agent state to storage
	 */
	private async saveState(): Promise<void> {
		await this.ctx.storage.put("agents", Array.from(this.agents.values()));
		await this.ctx.storage.put("goals", Array.from(this.goals.values()));
	}

	/**
	 * Initialize default cognitive agents
	 */
	private async initializeDefaultAgents(): Promise<void> {
		const defaultAgents: MindAgentConfig[] = [
			{
				id: nanoid(),
				name: "ForgetAgent",
				type: "ForgetAgent",
				frequency: 30000, // 30 seconds
				priority: 1,
				enabled: true,
				parameters: {
					minSTI: -100,
					decayRate: 0.1,
				},
			},
			{
				id: nanoid(),
				name: "ImportanceSpreadingAgent",
				type: "ImportanceSpreadingAgent",
				frequency: 10000, // 10 seconds
				priority: 2,
				enabled: true,
				parameters: {
					spreadFactor: 0.1,
					maxHops: 3,
				},
			},
			{
				id: nanoid(),
				name: "GoalAgent",
				type: "GoalAgent",
				frequency: 5000, // 5 seconds
				priority: 3,
				enabled: true,
				parameters: {
					maxConcurrentGoals: 10,
				},
			},
			{
				id: nanoid(),
				name: "HebbianAgent",
				type: "HebbianAgent",
				frequency: 20000, // 20 seconds
				priority: 2,
				enabled: true,
				parameters: {
					learningRate: 0.05,
					threshold: 0.7,
				},
			},
		];

		defaultAgents.forEach((agent) => this.agents.set(agent.id, agent));
		await this.saveState();
	}

	/**
	 * Start the agent scheduler
	 */
	private startScheduler(): void {
		if (this.isRunning) return;

		this.isRunning = true;
		this.scheduleNextExecution();
	}

	/**
	 * Schedule next agent execution
	 */
	private scheduleNextExecution(): void {
		const now = Date.now();

		// Schedule enabled agents based on their frequency
		for (const agent of this.agents.values()) {
			if (agent.enabled) {
				const nextExecution = now + agent.frequency;
				this.executionQueue.push({
					agentId: agent.id,
					scheduledTime: nextExecution,
				});
			}
		}

		// Sort by scheduled time
		this.executionQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);

		// Execute the next agent
		this.executeNext();
	}

	/**
	 * Execute the next scheduled agent
	 */
	private async executeNext(): Promise<void> {
		if (this.executionQueue.length === 0) {
			// No more agents to execute, reschedule
			setTimeout(() => this.scheduleNextExecution(), 1000);
			return;
		}

		const next = this.executionQueue.shift()!;
		const delay = Math.max(0, next.scheduledTime - Date.now());

		setTimeout(async () => {
			try {
				await this.executeAgent(next.agentId);
			} catch (error) {
				console.error(`Error executing agent ${next.agentId}:`, error);
			}

			// Continue with next execution
			this.executeNext();
		}, delay);
	}

	/**
	 * Execute a specific agent
	 */
	private async executeAgent(agentId: string): Promise<MindAgentResult> {
		const agent = this.agents.get(agentId);
		if (!agent || !agent.enabled) {
			throw new Error(`Agent ${agentId} not found or disabled`);
		}

		const startTime = Date.now();
		let result: MindAgentResult;

		try {
			switch (agent.type) {
				case "ForgetAgent":
					result = await this.executeForgetAgent(agent);
					break;
				case "ImportanceSpreadingAgent":
					result = await this.executeImportanceSpreadingAgent(agent);
					break;
				case "GoalAgent":
					result = await this.executeGoalAgent(agent);
					break;
				case "HebbianAgent":
					result = await this.executeHebbianAgent(agent);
					break;
				case "ReasoningAgent":
					result = await this.executeReasoningAgent(agent);
					break;
				case "LearningAgent":
					result = await this.executeLearningAgent(agent);
					break;
				case "PlanningAgent":
					result = await this.executePlanningAgent(agent);
					break;
				case "PerceptionAgent":
					result = await this.executePerceptionAgent(agent);
					break;
				default:
					throw new Error(`Unknown agent type: ${agent.type}`);
			}

			result.executionTime = Date.now() - startTime;
			result.success = true;
		} catch (error) {
			result = {
				agentId,
				executionTime: Date.now() - startTime,
				atomsProcessed: 0,
				atomsCreated: 0,
				atomsModified: 0,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}

		// Store execution result
		await this.ctx.storage.put(`execution_${agentId}_${Date.now()}`, result);

		return result;
	}

	/**
	 * ForgetAgent: Manages attention decay and removes low-importance atoms
	 */
	private async executeForgetAgent(
		agent: MindAgentConfig,
	): Promise<MindAgentResult> {
		const atomSpace = this.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = this.env.ATOMSPACE.get(atomSpace);

		// Query atoms with low STI values
		const query: AtomSpaceQuery = {
			type: "find_atoms",
			attentionValueMin: { sti: agent.parameters.minSTI, lti: 0, vlti: 0 },
			limit: 100,
		};

		const response = await atomSpaceStub.fetch(
			new Request("http://dummy/query", {
				method: "POST",
				body: JSON.stringify(query),
			}),
		);

		const { data: lowSTIAtoms } = (await response.json()) as any;
		let atomsProcessed = 0;
		let atomsModified = 0;

		// Decay attention values and remove very low importance atoms
		for (const atom of lowSTIAtoms) {
			atomsProcessed++;

			const newSTI = atom.attentionValue.sti * (1 - agent.parameters.decayRate);

			if (newSTI < agent.parameters.minSTI * 2) {
				// Remove atom if STI is very low
				await atomSpaceStub.fetch(
					new Request(`http://dummy/atom/${atom.id}`, {
						method: "DELETE",
					}),
				);
			} else {
				// Update with decayed STI
				await atomSpaceStub.fetch(
					new Request(`http://dummy/atom/${atom.id}`, {
						method: "PUT",
						body: JSON.stringify({
							attentionValue: {
								...atom.attentionValue,
								sti: newSTI,
							},
						}),
					}),
				);
				atomsModified++;
			}
		}

		return {
			agentId: agent.id,
			executionTime: 0, // Will be set by caller
			atomsProcessed,
			atomsCreated: 0,
			atomsModified,
			success: true,
			metrics: {
				decayRate: agent.parameters.decayRate,
				atomsRemoved: atomsProcessed - atomsModified,
			},
		};
	}

	/**
	 * ImportanceSpreadingAgent: Spreads attention through connected atoms
	 */
	private async executeImportanceSpreadingAgent(
		agent: MindAgentConfig,
	): Promise<MindAgentResult> {
		const atomSpace = this.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = this.env.ATOMSPACE.get(atomSpace);

		// Find high-STI atoms to spread from
		const query: AtomSpaceQuery = {
			type: "find_atoms",
			attentionValueMin: { sti: 50, lti: 0, vlti: 0 },
			limit: 20,
		};

		const response = await atomSpaceStub.fetch(
			new Request("http://dummy/query", {
				method: "POST",
				body: JSON.stringify(query),
			}),
		);

		const { data: highSTIAtoms } = (await response.json()) as any;
		let atomsProcessed = 0;
		let atomsModified = 0;

		// Spread importance to connected atoms
		for (const atom of highSTIAtoms) {
			atomsProcessed++;

			// Get incoming links
			const incomingResponse = await atomSpaceStub.fetch(
				new Request(`http://dummy/incoming/${atom.id}`),
			);
			const { data: incomingLinks } = (await incomingResponse.json()) as any;

			// Spread STI to connected atoms
			for (const link of incomingLinks) {
				const spreadAmount =
					atom.attentionValue.sti * agent.parameters.spreadFactor;

				await atomSpaceStub.fetch(
					new Request(`http://dummy/atom/${link.id}`, {
						method: "PUT",
						body: JSON.stringify({
							attentionValue: {
								...link.attentionValue,
								sti: link.attentionValue.sti + spreadAmount,
							},
						}),
					}),
				);
				atomsModified++;
			}
		}

		return {
			agentId: agent.id,
			executionTime: 0,
			atomsProcessed,
			atomsCreated: 0,
			atomsModified,
			success: true,
			metrics: {
				spreadFactor: agent.parameters.spreadFactor,
				sourceAtoms: highSTIAtoms.length,
			},
		};
	}

	/**
	 * GoalAgent: Manages and pursues system goals
	 */
	private async executeGoalAgent(
		agent: MindAgentConfig,
	): Promise<MindAgentResult> {
		let atomsProcessed = 0;
		let atomsCreated = 0;
		let atomsModified = 0;

		// Process active goals
		for (const goal of this.goals.values()) {
			if (goal.status === "active") {
				atomsProcessed++;

				// Check goal conditions
				const conditionsMet = await this.checkGoalConditions(goal);

				if (conditionsMet) {
					// Execute goal actions
					for (const action of goal.actions) {
						if (action.type === "create_atom") {
							// Create new atoms as specified by the goal
							atomsCreated++;
						} else if (action.type === "modify_atom") {
							// Modify existing atoms
							atomsModified++;
						}
					}

					// Mark goal as completed
					goal.status = "completed";
					goal.completedAt = Date.now();
					goal.updatedAt = Date.now();
				}
			}
		}

		// Create new implicit goals based on system state
		if (this.goals.size < agent.parameters.maxConcurrentGoals) {
			const newGoal: Goal = {
				id: nanoid(),
				type: "implicit",
				description: "Maintain cognitive coherence",
				priority: 1,
				status: "active",
				conditions: [],
				actions: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			this.goals.set(newGoal.id, newGoal);
			atomsCreated++;
		}

		await this.saveState();

		return {
			agentId: agent.id,
			executionTime: 0,
			atomsProcessed,
			atomsCreated,
			atomsModified,
			success: true,
			metrics: {
				activeGoals: Array.from(this.goals.values()).filter(
					(g) => g.status === "active",
				).length,
				completedGoals: Array.from(this.goals.values()).filter(
					(g) => g.status === "completed",
				).length,
			},
		};
	}

	/**
	 * HebbianAgent: Implements Hebbian learning ("neurons that fire together, wire together")
	 */
	private async executeHebbianAgent(
		agent: MindAgentConfig,
	): Promise<MindAgentResult> {
		// Implementation would analyze co-occurring atoms and strengthen their connections
		return {
			agentId: agent.id,
			executionTime: 0,
			atomsProcessed: 0,
			atomsCreated: 0,
			atomsModified: 0,
			success: true,
			metrics: {
				learningRate: agent.parameters.learningRate,
			},
		};
	}

	/**
	 * ReasoningAgent: Performs logical inference using PLN and URE
	 */
	private async executeReasoningAgent(
		agent: MindAgentConfig,
	): Promise<MindAgentResult> {
		const atomSpace = this.env.ATOMSPACE.idFromName("primary");
		const atomSpaceStub = this.env.ATOMSPACE.get(atomSpace);
		
		let atomsProcessed = 0;
		let atomsCreated = 0;
		let atomsModified = 0;
		
		// Find high-confidence implication links for inference
		const query: AtomSpaceQuery = {
			type: "find_atoms",
			atomType: "ImplicationLink",
			truthValueMin: { strength: 0.6, confidence: 0.5 },
			limit: 10,
		};
		
		const response = await atomSpaceStub.fetch(
			new Request("http://dummy/query", {
				method: "POST",
				body: JSON.stringify(query),
			}),
		);
		
		const { data: implications } = (await response.json()) as any;
		
		// Perform PLN inference on found implications
		for (const impl of implications || []) {
			atomsProcessed++;
			
			// Look for chains: if we have A->B and B->C, infer A->C via deduction
			if (impl.outgoing && impl.outgoing.length === 2) {
				const [antecedent, consequent] = impl.outgoing;
				
				// Find other implications starting from consequent
				const chainQuery: AtomSpaceQuery = {
					type: "find_atoms",
					atomType: "ImplicationLink",
					limit: 5,
				};
				
				const chainResponse = await atomSpaceStub.fetch(
					new Request("http://dummy/query", {
						method: "POST",
						body: JSON.stringify(chainQuery),
					}),
				);
				
				const { data: chainCandidates } = (await chainResponse.json()) as any;
				
				// Apply deduction rule to create new inference
				for (const candidate of chainCandidates || []) {
					if (candidate.outgoing && candidate.outgoing[0] === consequent) {
						// We have A->B and B->C, apply deduction
						const newTruthValue = {
							strength: impl.truthValue.strength * candidate.truthValue.strength,
							confidence: impl.truthValue.confidence * candidate.truthValue.confidence * candidate.truthValue.strength,
						};
						
						// Create inferred implication A->C
						try {
							await atomSpaceStub.fetch(
								new Request("http://dummy/link", {
									method: "POST",
									body: JSON.stringify({
										type: "ImplicationLink",
										outgoing: [antecedent, candidate.outgoing[1]],
										truthValue: newTruthValue,
										attentionValue: { sti: 50, lti: 30, vlti: 5 },
									}),
								}),
							);
							atomsCreated++;
						} catch (error) {
							// Link might already exist, continue
						}
					}
				}
			}
		}
		
		return {
			agentId: agent.id,
			executionTime: 0,
			atomsProcessed,
			atomsCreated,
			atomsModified,
			success: true,
			metrics: {
				implicationsFound: implications?.length || 0,
				inferencesCreated: atomsCreated,
			},
		};
	}

	/**
	 * LearningAgent: Adapts system behavior based on experience
	 */
	private async executeLearningAgent(
		agent: MindAgentConfig,
	): Promise<MindAgentResult> {
		// Implementation would analyze patterns and adapt agent parameters
		return {
			agentId: agent.id,
			executionTime: 0,
			atomsProcessed: 0,
			atomsCreated: 0,
			atomsModified: 0,
			success: true,
		};
	}

	/**
	 * PlanningAgent: Creates and executes plans to achieve goals
	 */
	private async executePlanningAgent(
		agent: MindAgentConfig,
	): Promise<MindAgentResult> {
		// Implementation would create action sequences to achieve goals
		return {
			agentId: agent.id,
			executionTime: 0,
			atomsProcessed: 0,
			atomsCreated: 0,
			atomsModified: 0,
			success: true,
		};
	}

	/**
	 * PerceptionAgent: Processes sensory input and creates percepts
	 */
	private async executePerceptionAgent(
		agent: MindAgentConfig,
	): Promise<MindAgentResult> {
		// Implementation would process external input and create perceptual atoms
		return {
			agentId: agent.id,
			executionTime: 0,
			atomsProcessed: 0,
			atomsCreated: 0,
			atomsModified: 0,
			success: true,
		};
	}

	/**
	 * Check if a goal's conditions are met
	 */
	private async checkGoalConditions(goal: Goal): Promise<boolean> {
		// Simple implementation - in practice this would be more sophisticated
		return Math.random() > 0.8; // 20% chance of goal completion per check
	}

	/**
	 * Create a new goal
	 */
	async createGoal(
		goalData: Omit<Goal, "id" | "createdAt" | "updatedAt">,
	): Promise<Goal> {
		const goal: Goal = {
			...goalData,
			id: nanoid(),
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		this.goals.set(goal.id, goal);
		await this.saveState();
		return goal;
	}

	/**
	 * Get all goals
	 */
	getGoals(): Goal[] {
		return Array.from(this.goals.values());
	}

	/**
	 * Get all agents
	 */
	getAgents(): MindAgentConfig[] {
		return Array.from(this.agents.values());
	}

	/**
	 * Handle HTTP requests
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			if (request.method === "GET" && path === "/agents") {
				return Response.json({
					success: true,
					data: this.getAgents(),
					timestamp: Date.now(),
				});
			}

			if (request.method === "GET" && path === "/goals") {
				return Response.json({
					success: true,
					data: this.getGoals(),
					timestamp: Date.now(),
				});
			}

			if (request.method === "POST" && path === "/goal") {
				const goalData = (await request.json()) as Omit<
					Goal,
					"id" | "createdAt" | "updatedAt"
				>;
				const goal = await this.createGoal(goalData);
				return Response.json({
					success: true,
					data: goal,
					timestamp: Date.now(),
				});
			}

			if (request.method === "POST" && path.startsWith("/execute/")) {
				const agentId = path.split("/")[2];
				const result = await this.executeAgent(agentId);
				return Response.json({
					success: true,
					data: result,
					timestamp: Date.now(),
				});
			}

			return Response.json(
				{
					success: false,
					error: "Not found",
					timestamp: Date.now(),
				},
				{ status: 404 },
			);
		} catch (error) {
			console.error("MindAgent error:", error);
			return Response.json(
				{
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
					timestamp: Date.now(),
				},
				{ status: 500 },
			);
		}
	}
}
