import { Atom } from "../../types/cognitive";
import { nanoid } from "nanoid";

/**
 * HTN (Hierarchical Task Network) Planner
 *
 * Goal-directed action planning with hierarchical decomposition
 */

export interface Goal {
	id: string;
	description: string;
	preconditions: Condition[];
	postconditions: Condition[];
	priority: number;
}

export interface Condition {
	type: "atom_exists" | "predicate" | "value_check";
	predicate: string;
	value?: any;
}

export interface WorldState {
	atoms: Map<string, Atom>;
	variables: Map<string, any>;
	timestamp: number;
}

export interface Task {
	id: string;
	name: string;
	isPrimitive: boolean;
	preconditions: Condition[];
	effects: Effect[];
	parameters: Map<string, any>;
}

export interface Effect {
	type: "create_atom" | "update_atom" | "delete_atom" | "set_variable";
	target: string;
	value?: any;
}

export interface Method {
	id: string;
	name: string;
	goal: string;
	preconditions: Condition[];
	subtasks: Task[];
}

export interface Plan {
	id: string;
	goal: Goal;
	tasks: Task[];
	status: "planning" | "ready" | "executing" | "completed" | "failed";
	currentTaskIndex: number;
	createdAt: number;
	startedAt?: number;
	completedAt?: number;
}

export interface ExecutionResult {
	success: boolean;
	plan: Plan;
	results: TaskResult[];
	error?: string;
}

export interface TaskResult {
	task: Task;
	success: boolean;
	output?: any;
	error?: string;
	executionTime: number;
}

export class HTNPlanner {
	private methods: Map<string, Method[]> = new Map();
	private primitiveActions: Map<string, (params: any) => Promise<any>> =
		new Map();
	private atomSpace: DurableObjectStub;

	constructor(atomSpace: DurableObjectStub) {
		this.atomSpace = atomSpace;
		this.initializeDefaultMethods();
		this.initializePrimitiveActions();
	}

	/**
	 * Create a plan to achieve the goal
	 */
	async plan(goal: Goal, currentState: WorldState): Promise<Plan> {
		const plan: Plan = {
			id: nanoid(),
			goal,
			tasks: [],
			status: "planning",
			currentTaskIndex: 0,
			createdAt: Date.now(),
		};

		try {
			// Decompose goal into tasks
			const tasks = await this.decompose(goal, currentState);

			if (tasks.length === 0) {
				plan.status = "failed";
				return plan;
			}

			// Order tasks based on dependencies
			plan.tasks = this.orderTasks(tasks);
			plan.status = "ready";

			return plan;
		} catch (error) {
			plan.status = "failed";
			return plan;
		}
	}

	/**
	 * Decompose goal into tasks
	 */
	private async decompose(
		goal: Goal,
		state: WorldState,
		depth: number = 0,
	): Promise<Task[]> {
		// Prevent infinite recursion
		if (depth > 10) {
			return [];
		}

		// Find methods that can achieve this goal
		const applicableMethods = this.findApplicableMethods(goal, state);

		for (const method of applicableMethods) {
			// Try to decompose using this method
			const tasks: Task[] = [];

			for (const subtask of method.subtasks) {
				if (subtask.isPrimitive) {
					// Primitive task - add directly
					tasks.push(subtask);
				} else {
					// Non-primitive - recursively decompose
					const subgoal = this.taskToGoal(subtask);
					const subtasks = await this.decompose(subgoal, state, depth + 1);

					if (subtasks.length === 0) {
						// Decomposition failed
						break;
					}

					tasks.push(...subtasks);
				}
			}

			// If we successfully decomposed all subtasks, return
			if (tasks.length > 0) {
				return tasks;
			}
		}

		return [];
	}

	/**
	 * Find methods applicable to the goal
	 */
	private findApplicableMethods(goal: Goal, state: WorldState): Method[] {
		const methods = this.methods.get(goal.description) || [];

		return methods.filter((method) =>
			this.checkPreconditions(method.preconditions, state),
		);
	}

	/**
	 * Check if preconditions are satisfied
	 */
	private checkPreconditions(
		preconditions: Condition[],
		state: WorldState,
	): boolean {
		for (const condition of preconditions) {
			switch (condition.type) {
				case "atom_exists":
					if (!state.atoms.has(condition.predicate)) {
						return false;
					}
					break;

				case "value_check":
					const value = state.variables.get(condition.predicate);
					if (value !== condition.value) {
						return false;
					}
					break;

				case "predicate":
					// Custom predicate evaluation
					// Would need to be implemented based on specific predicates
					break;
			}
		}

		return true;
	}

	/**
	 * Convert task to goal
	 */
	private taskToGoal(task: Task): Goal {
		return {
			id: nanoid(),
			description: task.name,
			preconditions: task.preconditions,
			postconditions: task.effects.map((e) => ({
				type: "atom_exists" as const,
				predicate: e.target,
			})),
			priority: 5,
		};
	}

	/**
	 * Order tasks based on dependencies
	 */
	private orderTasks(tasks: Task[]): Task[] {
		// Topological sort based on preconditions and effects
		const ordered: Task[] = [];
		const remaining = [...tasks];

		while (remaining.length > 0) {
			let added = false;

			for (let i = 0; i < remaining.length; i++) {
				const task = remaining[i];

				// Check if all preconditions are satisfied by previous tasks
				const canExecute = task.preconditions.every((precond) =>
					ordered.some((t) =>
						t.effects.some((e) => e.target === precond.predicate),
					),
				);

				if (canExecute || task.preconditions.length === 0) {
					ordered.push(task);
					remaining.splice(i, 1);
					added = true;
					break;
				}
			}

			// If no task could be added, add the first one to avoid infinite loop
			if (!added && remaining.length > 0) {
				ordered.push(remaining.shift()!);
			}
		}

		return ordered;
	}

	/**
	 * Execute a plan
	 */
	async execute(plan: Plan): Promise<ExecutionResult> {
		plan.status = "executing";
		plan.startedAt = Date.now();

		const results: TaskResult[] = [];
		const state = await this.getCurrentState();

		for (let i = 0; i < plan.tasks.length; i++) {
			plan.currentTaskIndex = i;
			const task = plan.tasks[i];

			// Check preconditions
			if (!this.checkPreconditions(task.preconditions, state)) {
				// Preconditions not met - try to replan
				const newPlan = await this.replan(plan, task, state);

				if (newPlan) {
					return await this.execute(newPlan);
				}

				// Replanning failed
				plan.status = "failed";
				return {
					success: false,
					plan,
					results,
					error: `Preconditions not met for task: ${task.name}`,
				};
			}

			// Execute task
			const result = await this.executeTask(task);
			results.push(result);

			if (!result.success) {
				// Task failed - try to replan
				const newPlan = await this.replan(plan, task, state);

				if (newPlan) {
					return await this.execute(newPlan);
				}

				// Replanning failed
				plan.status = "failed";
				return {
					success: false,
					plan,
					results,
					error: `Task failed: ${task.name}`,
				};
			}

			// Apply effects to state
			this.applyEffects(task.effects, state);
		}

		plan.status = "completed";
		plan.completedAt = Date.now();

		return {
			success: true,
			plan,
			results,
		};
	}

	/**
	 * Execute a single task
	 */
	private async executeTask(task: Task): Promise<TaskResult> {
		const startTime = Date.now();

		try {
			// Get primitive action
			const action = this.primitiveActions.get(task.name);

			if (!action) {
				return {
					task,
					success: false,
					error: `Unknown action: ${task.name}`,
					executionTime: Date.now() - startTime,
				};
			}

			// Execute action
			const output = await action(
				Object.fromEntries(task.parameters.entries()),
			);

			return {
				task,
				success: true,
				output,
				executionTime: Date.now() - startTime,
			};
		} catch (error) {
			return {
				task,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				executionTime: Date.now() - startTime,
			};
		}
	}

	/**
	 * Replan when a task fails
	 */
	private async replan(
		originalPlan: Plan,
		failedTask: Task,
		state: WorldState,
	): Promise<Plan | null> {
		// Try to find alternative methods
		const goal = this.taskToGoal(failedTask);
		const newPlan = await this.plan(goal, state);

		if (newPlan.status === "ready") {
			// Merge with remaining tasks from original plan
			const remainingTasks = originalPlan.tasks.slice(
				originalPlan.currentTaskIndex + 1,
			);
			newPlan.tasks.push(...remainingTasks);

			return newPlan;
		}

		return null;
	}

	/**
	 * Get current world state
	 */
	private async getCurrentState(): Promise<WorldState> {
		const response = await this.atomSpace.fetch(
			new Request("http://dummy/atoms"),
		);
		const data = await response.json();

		const atoms = new Map<string, Atom>();
		if (data.success && Array.isArray(data.data)) {
			for (const atom of data.data) {
				atoms.set(atom.id, atom);
			}
		}

		return {
			atoms,
			variables: new Map(),
			timestamp: Date.now(),
		};
	}

	/**
	 * Apply task effects to state
	 */
	private applyEffects(effects: Effect[], state: WorldState): void {
		for (const effect of effects) {
			switch (effect.type) {
				case "set_variable":
					state.variables.set(effect.target, effect.value);
					break;

				// Other effects would modify the AtomSpace
			}
		}
	}

	/**
	 * Register a method
	 */
	registerMethod(method: Method): void {
		if (!this.methods.has(method.goal)) {
			this.methods.set(method.goal, []);
		}
		this.methods.get(method.goal)!.push(method);
	}

	/**
	 * Register a primitive action
	 */
	registerAction(name: string, action: (params: any) => Promise<any>): void {
		this.primitiveActions.set(name, action);
	}

	/**
	 * Initialize default methods
	 */
	private initializeDefaultMethods(): void {
		// Example: Navigate to location
		this.registerMethod({
			id: nanoid(),
			name: "navigate_to_location",
			goal: "be_at_location",
			preconditions: [],
			subtasks: [
				{
					id: nanoid(),
					name: "find_path",
					isPrimitive: true,
					preconditions: [],
					effects: [{ type: "set_variable", target: "path", value: null }],
					parameters: new Map(),
				},
				{
					id: nanoid(),
					name: "follow_path",
					isPrimitive: true,
					preconditions: [{ type: "value_check", predicate: "path", value: null }],
					effects: [{ type: "set_variable", target: "location", value: null }],
					parameters: new Map(),
				},
			],
		});
	}

	/**
	 * Initialize primitive actions
	 */
	private initializePrimitiveActions(): void {
		// Example actions
		this.registerAction("find_path", async (params) => {
			// Path finding logic
			return { path: ["A", "B", "C"] };
		});

		this.registerAction("follow_path", async (params) => {
			// Path following logic
			return { success: true };
		});

		this.registerAction("create_atom", async (params) => {
			// Create atom in AtomSpace
			const response = await this.atomSpace.fetch(
				new Request("http://dummy/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(params),
				}),
			);
			return await response.json();
		});
	}
}
