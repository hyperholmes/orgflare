/**
 * HTN (Hierarchical Task Network) Planner Integration
 * 
 * Integrates HTN planning with the AtomSpace for goal-oriented behavior
 * and autonomous action planning in the cognitive architecture.
 */

import { Atom, Link, Node, Goal, GoalAction } from "../types/cognitive";

/**
 * HTN Task types
 */
export type TaskType = "primitive" | "compound";

/**
 * HTN Task
 */
export interface HTNTask {
	id: string;
	name: string;
	type: TaskType;
	parameters: Record<string, any>;
	preconditions: HTNCondition[];
	effects: HTNEffect[];
	methods?: HTNMethod[]; // For compound tasks
	action?: GoalAction; // For primitive tasks
}

/**
 * HTN Method - decomposition of compound task
 */
export interface HTNMethod {
	id: string;
	name: string;
	preconditions: HTNCondition[];
	subtasks: HTNTask[];
	ordering: TaskOrdering[];
}

/**
 * Task ordering constraint
 */
export interface TaskOrdering {
	before: string; // Task ID
	after: string; // Task ID
}

/**
 * HTN Condition
 */
export interface HTNCondition {
	type: "atom_exists" | "atom_property" | "custom";
	atomId?: string;
	atomType?: string;
	property?: string;
	value?: any;
	predicate?: (state: HTNState) => boolean;
}

/**
 * HTN Effect
 */
export interface HTNEffect {
	type: "create_atom" | "modify_atom" | "delete_atom";
	atomId?: string;
	atomType?: string;
	properties?: Record<string, any>;
}

/**
 * HTN Planning state
 */
export interface HTNState {
	atoms: Map<string, Atom>;
	goals: Goal[];
	currentTime: number;
}

/**
 * HTN Plan
 */
export interface HTNPlan {
	tasks: HTNTask[];
	totalCost: number;
	estimatedDuration: number;
	success: boolean;
	error?: string;
}

/**
 * HTN Planner
 */
export class HTNPlanner {
	private taskLibrary: Map<string, HTNTask> = new Map();
	private methodLibrary: Map<string, HTNMethod[]> = new Map();

	constructor() {
		this.initializeDefaultTasks();
	}

	/**
	 * Initialize default task library
	 */
	private initializeDefaultTasks(): void {
		// Primitive task: Create concept node
		this.registerTask({
			id: "create_concept",
			name: "Create Concept Node",
			type: "primitive",
			parameters: { name: "", truthValue: { strength: 0.5, confidence: 0.5 } },
			preconditions: [],
			effects: [
				{
					type: "create_atom",
					atomType: "ConceptNode",
				},
			],
			action: {
				type: "create_atom",
				parameters: {},
			},
		});

		// Primitive task: Create inheritance link
		this.registerTask({
			id: "create_inheritance",
			name: "Create Inheritance Link",
			type: "primitive",
			parameters: { source: "", target: "" },
			preconditions: [
				{ type: "atom_exists", atomId: "source" },
				{ type: "atom_exists", atomId: "target" },
			],
			effects: [
				{
					type: "create_atom",
					atomType: "InheritanceLink",
				},
			],
			action: {
				type: "create_atom",
				parameters: {},
			},
		});

		// Compound task: Learn concept hierarchy
		this.registerTask({
			id: "learn_hierarchy",
			name: "Learn Concept Hierarchy",
			type: "compound",
			parameters: { concepts: [] },
			preconditions: [],
			effects: [],
			methods: [
				{
					id: "method_learn_hierarchy_1",
					name: "Sequential Learning",
					preconditions: [],
					subtasks: [],
					ordering: [],
				},
			],
		});
	}

	/**
	 * Register a task in the library
	 */
	registerTask(task: HTNTask): void {
		this.taskLibrary.set(task.id, task);

		// Register methods for compound tasks
		if (task.type === "compound" && task.methods) {
			this.methodLibrary.set(task.id, task.methods);
		}
	}

	/**
	 * Get task by ID
	 */
	getTask(taskId: string): HTNTask | undefined {
		return this.taskLibrary.get(taskId);
	}

	/**
	 * Plan for a goal
	 */
	async plan(goal: Goal, state: HTNState): Promise<HTNPlan> {
		// Convert goal to HTN task
		const rootTask = this.goalToTask(goal);

		// Decompose task hierarchically
		const tasks = await this.decompose(rootTask, state);

		if (tasks.length === 0) {
			return {
				tasks: [],
				totalCost: 0,
				estimatedDuration: 0,
				success: false,
				error: "No valid decomposition found",
			};
		}

		// Calculate plan metrics
		const totalCost = tasks.length;
		const estimatedDuration = tasks.length * 1000; // 1 second per task

		return {
			tasks,
			totalCost,
			estimatedDuration,
			success: true,
		};
	}

	/**
	 * Convert goal to HTN task
	 */
	private goalToTask(goal: Goal): HTNTask {
		return {
			id: `goal_${goal.id}`,
			name: goal.description,
			type: "compound",
			parameters: {},
			preconditions: goal.conditions.map((c) => ({
				type: c.type as any,
				atomId: c.atomId,
				property: c.predicate,
			})),
			effects: [],
			methods: [
				{
					id: `method_${goal.id}`,
					name: "Default Method",
					preconditions: [],
					subtasks: goal.actions.map((action) => ({
						id: `action_${action.type}`,
						name: action.type,
						type: "primitive" as TaskType,
						parameters: action.parameters,
						preconditions: [],
						effects: [],
						action,
					})),
					ordering: [],
				},
			],
		};
	}

	/**
	 * Decompose compound task into primitive tasks
	 */
	private async decompose(
		task: HTNTask,
		state: HTNState,
		depth: number = 0
	): Promise<HTNTask[]> {
		// Prevent infinite recursion
		if (depth > 10) {
			return [];
		}

		// If primitive task, return it
		if (task.type === "primitive") {
			// Check preconditions
			if (this.checkPreconditions(task.preconditions, state)) {
				return [task];
			}
			return [];
		}

		// Compound task - try each method
		const methods = task.methods || this.methodLibrary.get(task.id) || [];

		for (const method of methods) {
			// Check method preconditions
			if (!this.checkPreconditions(method.preconditions, state)) {
				continue;
			}

			// Decompose subtasks
			const decomposedTasks: HTNTask[] = [];
			let validDecomposition = true;

			for (const subtask of method.subtasks) {
				const subDecomposed = await this.decompose(subtask, state, depth + 1);
				if (subDecomposed.length === 0) {
					validDecomposition = false;
					break;
				}
				decomposedTasks.push(...subDecomposed);
			}

			if (validDecomposition) {
				// Apply ordering constraints
				const orderedTasks = this.applyOrdering(
					decomposedTasks,
					method.ordering
				);
				return orderedTasks;
			}
		}

		// No valid method found
		return [];
	}

	/**
	 * Check if preconditions are satisfied
	 */
	private checkPreconditions(
		conditions: HTNCondition[],
		state: HTNState
	): boolean {
		for (const condition of conditions) {
			if (condition.type === "atom_exists") {
				if (!condition.atomId || !state.atoms.has(condition.atomId)) {
					return false;
				}
			} else if (condition.type === "atom_property") {
				const atom = condition.atomId
					? state.atoms.get(condition.atomId)
					: null;
				if (!atom) return false;

				// Check property value
				if (condition.property && condition.value !== undefined) {
					const atomValue = (atom as any)[condition.property];
					if (atomValue !== condition.value) {
						return false;
					}
				}
			} else if (condition.type === "custom" && condition.predicate) {
				if (!condition.predicate(state)) {
					return false;
				}
			}
		}
		return true;
	}

	/**
	 * Apply ordering constraints to tasks
	 */
	private applyOrdering(
		tasks: HTNTask[],
		ordering: TaskOrdering[]
	): HTNTask[] {
		if (ordering.length === 0) {
			return tasks;
		}

		// Build dependency graph
		const taskMap = new Map<string, HTNTask>();
		const dependencies = new Map<string, Set<string>>();

		for (const task of tasks) {
			taskMap.set(task.id, task);
			dependencies.set(task.id, new Set());
		}

		for (const order of ordering) {
			const deps = dependencies.get(order.after);
			if (deps) {
				deps.add(order.before);
			}
		}

		// Topological sort
		const sorted: HTNTask[] = [];
		const visited = new Set<string>();

		const visit = (taskId: string) => {
			if (visited.has(taskId)) return;
			visited.add(taskId);

			const deps = dependencies.get(taskId);
			if (deps) {
				for (const depId of deps) {
					visit(depId);
				}
			}

			const task = taskMap.get(taskId);
			if (task) {
				sorted.push(task);
			}
		};

		for (const task of tasks) {
			visit(task.id);
		}

		return sorted;
	}

	/**
	 * Execute a plan
	 */
	async executePlan(
		plan: HTNPlan,
		executor: (task: HTNTask) => Promise<void>
	): Promise<boolean> {
		if (!plan.success) {
			return false;
		}

		for (const task of plan.tasks) {
			try {
				await executor(task);
			} catch (error) {
				console.error(`Task execution failed: ${task.name}`, error);
				return false;
			}
		}

		return true;
	}

	/**
	 * Replan if execution fails
	 */
	async replan(
		goal: Goal,
		state: HTNState,
		failedTask: HTNTask
	): Promise<HTNPlan> {
		// Remove failed method from consideration
		const task = this.getTask(failedTask.id);
		if (task && task.methods) {
			// Filter out failed method
			task.methods = task.methods.filter(
				(m) => !m.subtasks.some((st) => st.id === failedTask.id)
			);
		}

		// Replan
		return this.plan(goal, state);
	}

	/**
	 * Get all registered tasks
	 */
	getAllTasks(): HTNTask[] {
		return Array.from(this.taskLibrary.values());
	}

	/**
	 * Clear task library
	 */
	clearLibrary(): void {
		this.taskLibrary.clear();
		this.methodLibrary.clear();
		this.initializeDefaultTasks();
	}
}

/**
 * HTN Planner Integration with AtomSpace
 */
export class HTNAtomSpaceIntegration {
	private planner: HTNPlanner;

	constructor() {
		this.planner = new HTNPlanner();
	}

	/**
	 * Create HTN state from AtomSpace
	 */
	createStateFromAtoms(atoms: Atom[], goals: Goal[]): HTNState {
		const atomMap = new Map<string, Atom>();
		for (const atom of atoms) {
			atomMap.set(atom.id, atom);
		}

		return {
			atoms: atomMap,
			goals,
			currentTime: Date.now(),
		};
	}

	/**
	 * Plan for goal using AtomSpace state
	 */
	async planForGoal(
		goal: Goal,
		atoms: Atom[]
	): Promise<HTNPlan> {
		const state = this.createStateFromAtoms(atoms, [goal]);
		return this.planner.plan(goal, state);
	}

	/**
	 * Get planner instance
	 */
	getPlanner(): HTNPlanner {
		return this.planner;
	}
}
