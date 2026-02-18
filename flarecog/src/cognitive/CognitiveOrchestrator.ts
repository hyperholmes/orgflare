/**
 * Cognitive Orchestrator
 * 
 * Unifies all cognitive components into a cohesive system:
 * - PLN Reasoning
 * - ECAN Attention
 * - HTN Planning
 * - Scheme Kernel
 * - Pattern Matching
 * - Distributed Query Engine
 */

import { Env, Atom, Link, Goal, AtomSpaceQuery } from "../types/cognitive";
import { PLNReasoning, PLNInferenceResult } from "./PLNReasoning";
import { ECANManager } from "./ECANAttention";
import { HTNPlanner, HTNPlan, HTNState } from "./HTNPlannerIntegration";
import { SchemeKernel, CognitiveGrammar } from "./SchemeKernel";

/**
 * Cognitive cycle result
 */
export interface CognitiveCycleResult {
	cycleNumber: number;
	timestamp: number;
	inferences: PLNInferenceResult[];
	attentionUpdates: Map<string, any>;
	plans: HTNPlan[];
	schemeEvaluations: any[];
	atomsCreated: number;
	atomsModified: number;
	executionTime: number;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
	enablePLN: boolean;
	enableECAN: boolean;
	enableHTN: boolean;
	enableScheme: boolean;
	cycleInterval: number; // milliseconds
	maxInferencesPerCycle: number;
	maxPlansPerCycle: number;
}

/**
 * Cognitive Orchestrator
 */
export class CognitiveOrchestrator {
	private plnReasoning: typeof PLNReasoning;
	private ecanManager: ECANManager;
	private htnPlanner: HTNPlanner;
	private schemeKernel: SchemeKernel;
	private cognitiveGrammar: CognitiveGrammar;

	private cycleCount: number = 0;
	private isRunning: boolean = false;

	private config: OrchestratorConfig = {
		enablePLN: true,
		enableECAN: true,
		enableHTN: true,
		enableScheme: true,
		cycleInterval: 1000,
		maxInferencesPerCycle: 10,
		maxPlansPerCycle: 5,
	};

	constructor(private env: Env, config?: Partial<OrchestratorConfig>) {
		this.plnReasoning = PLNReasoning;
		this.ecanManager = new ECANManager();
		this.htnPlanner = new HTNPlanner();
		this.schemeKernel = new SchemeKernel();
		this.cognitiveGrammar = new CognitiveGrammar();

		if (config) {
			this.config = { ...this.config, ...config };
		}
	}

	/**
	 * Run a single cognitive cycle
	 */
	async runCycle(
		atoms: Atom[],
		goals: Goal[],
		getIncoming: (atomId: string) => Promise<Link[]>
	): Promise<CognitiveCycleResult> {
		const startTime = Date.now();
		this.cycleCount++;

		const result: CognitiveCycleResult = {
			cycleNumber: this.cycleCount,
			timestamp: startTime,
			inferences: [],
			attentionUpdates: new Map(),
			plans: [],
			schemeEvaluations: [],
			atomsCreated: 0,
			atomsModified: 0,
			executionTime: 0,
		};

		// 1. ECAN: Update attention values
		if (this.config.enableECAN) {
			const attentionUpdates = await this.ecanManager.runCycle(
				atoms,
				getIncoming
			);
			result.attentionUpdates = attentionUpdates;
		}

		// 2. Get attentional focus
		const focus = this.ecanManager.getAttentionalFocus(atoms, 20);

		// 3. PLN: Perform inference on focused atoms
		if (this.config.enablePLN && focus.length > 0) {
			const inferences = this.plnReasoning.inferenceChain(
				focus,
				2 // Max depth
			);
			result.inferences = inferences.slice(
				0,
				this.config.maxInferencesPerCycle
			);
			result.atomsCreated += result.inferences.length;
		}

		// 4. HTN: Plan for active goals
		if (this.config.enableHTN && goals.length > 0) {
			const activeGoals = goals.filter((g) => g.status === "active");

			for (
				let i = 0;
				i < Math.min(activeGoals.length, this.config.maxPlansPerCycle);
				i++
			) {
				const goal = activeGoals[i];
				const state: HTNState = {
					atoms: new Map(atoms.map((a) => [a.id, a])),
					goals: [goal],
					currentTime: Date.now(),
				};

				const plan = await this.htnPlanner.plan(goal, state);
				if (plan.success) {
					result.plans.push(plan);
				}
			}
		}

		// 5. Scheme: Execute cognitive operations
		if (this.config.enableScheme && focus.length > 0) {
			// Example: Pattern matching on focused atoms
			try {
				const schemeAtoms = focus
					.slice(0, 5)
					.map((a) => this.schemeKernel.atomToScheme(a));
				result.schemeEvaluations.push({
					operation: "atom_conversion",
					results: schemeAtoms,
				});
			} catch (error) {
				console.error("Scheme evaluation error:", error);
			}
		}

		result.executionTime = Date.now() - startTime;
		return result;
	}

	/**
	 * Start continuous cognitive cycles
	 */
	startContinuousCycles(
		getAtoms: () => Promise<Atom[]>,
		getGoals: () => Promise<Goal[]>,
		getIncoming: (atomId: string) => Promise<Link[]>,
		onCycleComplete?: (result: CognitiveCycleResult) => void
	): void {
		if (this.isRunning) {
			console.warn("Cognitive cycles already running");
			return;
		}

		this.isRunning = true;

		const runNextCycle = async () => {
			if (!this.isRunning) return;

			try {
				const atoms = await getAtoms();
				const goals = await getGoals();
				const result = await this.runCycle(atoms, goals, getIncoming);

				if (onCycleComplete) {
					onCycleComplete(result);
				}
			} catch (error) {
				console.error("Cognitive cycle error:", error);
			}

			// Schedule next cycle
			setTimeout(runNextCycle, this.config.cycleInterval);
		};

		runNextCycle();
	}

	/**
	 * Stop continuous cognitive cycles
	 */
	stopContinuousCycles(): void {
		this.isRunning = false;
	}

	/**
	 * Perform inference on specific atoms
	 */
	async performInference(atoms: Atom[]): Promise<PLNInferenceResult[]> {
		return this.plnReasoning.inferenceChain(atoms, 3);
	}

	/**
	 * Plan for a specific goal
	 */
	async planForGoal(goal: Goal, atoms: Atom[]): Promise<HTNPlan> {
		const state: HTNState = {
			atoms: new Map(atoms.map((a) => [a.id, a])),
			goals: [goal],
			currentTime: Date.now(),
		};
		return this.htnPlanner.plan(goal, state);
	}

	/**
	 * Execute Scheme code
	 */
	executeScheme(code: string): any {
		return this.schemeKernel.execute(code);
	}

	/**
	 * Get attention statistics
	 */
	getAttentionStatistics(atoms: Atom[]): any {
		return this.ecanManager.getStatistics(atoms);
	}

	/**
	 * Stimulate specific atoms
	 */
	stimulateAtoms(atoms: Atom[], amount: number): Map<string, any> {
		const updates = new Map();
		for (const atom of atoms) {
			const newAV = this.ecanManager.stimulate(atom, amount);
			updates.set(atom.id, newAV);
		}
		return updates;
	}

	/**
	 * Get cognitive system status
	 */
	getStatus(): {
		cycleCount: number;
		isRunning: boolean;
		config: OrchestratorConfig;
		components: {
			pln: boolean;
			ecan: boolean;
			htn: boolean;
			scheme: boolean;
		};
	} {
		return {
			cycleCount: this.cycleCount,
			isRunning: this.isRunning,
			config: this.config,
			components: {
				pln: this.config.enablePLN,
				ecan: this.config.enableECAN,
				htn: this.config.enableHTN,
				scheme: this.config.enableScheme,
			},
		};
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<OrchestratorConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Reset orchestrator state
	 */
	reset(): void {
		this.stopContinuousCycles();
		this.cycleCount = 0;
		this.ecanManager = new ECANManager();
		this.htnPlanner = new HTNPlanner();
		this.schemeKernel = new SchemeKernel();
		this.cognitiveGrammar = new CognitiveGrammar();
	}

	/**
	 * Perform cognitive synergy - combine multiple reasoning methods
	 */
	async cognitiveSynergy(
		atoms: Atom[],
		goals: Goal[],
		query: string
	): Promise<{
		inferences: PLNInferenceResult[];
		plans: HTNPlan[];
		schemeResult: any;
		synthesis: string;
	}> {
		// 1. PLN inference
		const inferences = await this.performInference(atoms);

		// 2. HTN planning
		const plans: HTNPlan[] = [];
		for (const goal of goals.slice(0, 3)) {
			const plan = await this.planForGoal(goal, atoms);
			if (plan.success) {
				plans.push(plan);
			}
		}

		// 3. Scheme reasoning
		let schemeResult = null;
		try {
			// Convert query to Scheme and evaluate
			const schemeQuery = `(query "${query}")`;
			schemeResult = this.executeScheme(schemeQuery);
		} catch (error) {
			console.error("Scheme reasoning error:", error);
		}

		// 4. Synthesize results
		const synthesis = this.synthesizeResults(inferences, plans, schemeResult);

		return {
			inferences,
			plans,
			schemeResult,
			synthesis,
		};
	}

	/**
	 * Synthesize results from multiple cognitive processes
	 */
	private synthesizeResults(
		inferences: PLNInferenceResult[],
		plans: HTNPlan[],
		schemeResult: any
	): string {
		const parts: string[] = [];

		if (inferences.length > 0) {
			parts.push(
				`Generated ${inferences.length} inferences using PLN reasoning.`
			);
			const highConfidence = inferences.filter((i) => i.confidence > 0.7);
			if (highConfidence.length > 0) {
				parts.push(
					`${highConfidence.length} inferences have high confidence (>0.7).`
				);
			}
		}

		if (plans.length > 0) {
			parts.push(`Created ${plans.length} action plans using HTN planning.`);
			const successfulPlans = plans.filter((p) => p.success);
			if (successfulPlans.length > 0) {
				parts.push(
					`${successfulPlans.length} plans are executable with total ${successfulPlans.reduce((sum, p) => sum + p.tasks.length, 0)} tasks.`
				);
			}
		}

		if (schemeResult) {
			parts.push(`Scheme evaluation completed successfully.`);
		}

		if (parts.length === 0) {
			return "No cognitive processes produced results.";
		}

		return parts.join(" ");
	}

	/**
	 * Get all cognitive components
	 */
	getComponents(): {
		plnReasoning: typeof PLNReasoning;
		ecanManager: ECANManager;
		htnPlanner: HTNPlanner;
		schemeKernel: SchemeKernel;
		cognitiveGrammar: CognitiveGrammar;
	} {
		return {
			plnReasoning: this.plnReasoning,
			ecanManager: this.ecanManager,
			htnPlanner: this.htnPlanner,
			schemeKernel: this.schemeKernel,
			cognitiveGrammar: this.cognitiveGrammar,
		};
	}
}
