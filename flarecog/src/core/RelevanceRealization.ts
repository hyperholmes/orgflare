import { Atom, TruthValue, AttentionValue, QueryPattern } from "../types/cognitive";
import { PLNRules } from "../reasoning/PLNRules";

/**
 * Relevance Realization Engine
 * 
 * Implements John Vervaeke's concept of Relevance Realization for cognitive processing.
 * Dynamically determines what information is relevant in a given context through
 * the interplay of opponent processing, constraint satisfaction, and attention allocation.
 * 
 * This is the key mechanism for "Optimal Grip" - the cognitive state where the system
 * has the right level of abstraction and focus for the current task.
 * 
 * Core Principles:
 * 1. Opponent Processing: Balance exploration vs exploitation, abstraction vs concreteness
 * 2. Constraint Satisfaction: Multiple constraints compete and cooperate
 * 3. Attention Allocation: Dynamic focusing based on salience and affordances
 * 4. Perspectival Knowing: Context-sensitive knowledge activation
 */

export interface RelevanceContext {
	currentGoal?: string;
	activeAtoms: string[];
	environmentalConstraints: Constraint[];
	cognitiveState: CognitiveState;
	timestamp: number;
}

export interface Constraint {
	type: "goal" | "environmental" | "cognitive" | "social";
	description: string;
	weight: number;
	satisfactionLevel: number;
}

export interface CognitiveState {
	focusLevel: number; // 0.0 (diffuse) to 1.0 (focused)
	arousalLevel: number; // 0.0 (calm) to 1.0 (excited)
	uncertaintyLevel: number; // 0.0 (certain) to 1.0 (uncertain)
	explorationBias: number; // 0.0 (exploit) to 1.0 (explore)
}

export interface RelevanceScore {
	atomId: string;
	score: number;
	components: {
		salience: number;
		coherence: number;
		affordance: number;
		novelty: number;
		goalAlignment: number;
	};
	explanation: string;
}

export interface OpponentProcess {
	name: string;
	pole1: string;
	pole2: string;
	currentBalance: number; // -1.0 (pole1) to 1.0 (pole2)
	optimalRange: [number, number];
}

/**
 * Relevance Realization Engine
 */
export class RelevanceRealizationEngine {
	private context: RelevanceContext;
	private opponentProcesses: OpponentProcess[];

	constructor(initialContext: RelevanceContext) {
		this.context = initialContext;
		this.opponentProcesses = this.initializeOpponentProcesses();
	}

	/**
	 * Initialize opponent processing dimensions
	 */
	private initializeOpponentProcesses(): OpponentProcess[] {
		return [
			{
				name: "abstraction",
				pole1: "concrete",
				pole2: "abstract",
				currentBalance: 0.0,
				optimalRange: [-0.3, 0.3],
			},
			{
				name: "exploration",
				pole1: "exploit",
				pole2: "explore",
				currentBalance: 0.0,
				optimalRange: [-0.2, 0.4],
			},
			{
				name: "focus",
				pole1: "diffuse",
				pole2: "focused",
				currentBalance: 0.0,
				optimalRange: [-0.1, 0.5],
			},
			{
				name: "processing",
				pole1: "bottom-up",
				pole2: "top-down",
				currentBalance: 0.0,
				optimalRange: [-0.2, 0.2],
			},
			{
				name: "temporal",
				pole1: "present",
				pole2: "future",
				currentBalance: 0.0,
				optimalRange: [-0.3, 0.3],
			},
		];
	}

	/**
	 * Calculate relevance score for an atom in the current context
	 */
	calculateRelevance(atom: Atom, atomSpace: DurableObjectStub): RelevanceScore {
		// Component 1: Salience (attention value)
		const salience = this.calculateSalience(atom);

		// Component 2: Coherence (fit with existing knowledge)
		const coherence = this.calculateCoherence(atom);

		// Component 3: Affordance (action possibilities)
		const affordance = this.calculateAffordance(atom);

		// Component 4: Novelty (information gain)
		const novelty = this.calculateNovelty(atom);

		// Component 5: Goal Alignment (relevance to current goals)
		const goalAlignment = this.calculateGoalAlignment(atom);

		// Weighted combination based on cognitive state
		const weights = this.getComponentWeights();
		
		const score =
			salience * weights.salience +
			coherence * weights.coherence +
			affordance * weights.affordance +
			novelty * weights.novelty +
			goalAlignment * weights.goalAlignment;

		return {
			atomId: atom.id,
			score,
			components: {
				salience,
				coherence,
				affordance,
				novelty,
				goalAlignment,
			},
			explanation: this.generateExplanation(atom, {
				salience,
				coherence,
				affordance,
				novelty,
				goalAlignment,
			}),
		};
	}

	/**
	 * Calculate salience based on attention values
	 */
	private calculateSalience(atom: Atom): number {
		const { sti, lti, vlti } = atom.attentionValue;
		
		// Normalize STI (assume range -100 to 100)
		const normalizedSTI = (sti + 100) / 200;
		
		// Combine with LTI and VLTI
		return (
			normalizedSTI * 0.6 +
			(lti / 100) * 0.3 +
			(vlti / 100) * 0.1
		);
	}

	/**
	 * Calculate coherence with existing knowledge
	 */
	private calculateCoherence(atom: Atom): number {
		// High truth value confidence indicates coherence
		const truthCoherence = atom.truthValue.confidence;
		
		// Atoms that fit well with existing knowledge have high coherence
		// This would ideally check connections to other high-confidence atoms
		return truthCoherence;
	}

	/**
	 * Calculate affordance (action possibilities)
	 */
	private calculateAffordance(atom: Atom): number {
		// Atoms with many outgoing links offer more affordances
		if ("outgoing" in atom) {
			const link = atom as any;
			return Math.min(1.0, link.outgoing.length / 5);
		}
		
		// Nodes offer affordances based on their type and truth value
		return atom.truthValue.strength * 0.5;
	}

	/**
	 * Calculate novelty (information gain)
	 */
	private calculateNovelty(atom: Atom): number {
		// Low confidence indicates novelty (less certain knowledge)
		const uncertaintyNovelty = 1.0 - atom.truthValue.confidence;
		
		// Recent creation indicates novelty
		const ageNovelty = this.calculateAgeNovelty(atom);
		
		return (uncertaintyNovelty * 0.6 + ageNovelty * 0.4);
	}

	/**
	 * Calculate novelty based on atom age
	 */
	private calculateAgeNovelty(atom: Atom): number {
		const ageMs = Date.now() - atom.createdAt;
		const ageHours = ageMs / (1000 * 60 * 60);
		
		// Exponential decay: atoms are most novel when just created
		return Math.exp(-ageHours / 24); // Half-life of 24 hours
	}

	/**
	 * Calculate alignment with current goals
	 */
	private calculateGoalAlignment(atom: Atom): number {
		if (!this.context.currentGoal) {
			return 0.5; // Neutral when no goal
		}
		
		// Check if atom is in active set
		const isActive = this.context.activeAtoms.includes(atom.id);
		
		// High STI indicates goal relevance
		const stiAlignment = (atom.attentionValue.sti + 100) / 200;
		
		return isActive ? 1.0 : stiAlignment;
	}

	/**
	 * Get component weights based on cognitive state
	 */
	private getComponentWeights(): {
		salience: number;
		coherence: number;
		affordance: number;
		novelty: number;
		goalAlignment: number;
	} {
		const state = this.context.cognitiveState;

		return {
			// High focus increases salience weight
			salience: 0.2 + state.focusLevel * 0.2,
			
			// Low uncertainty increases coherence weight
			coherence: 0.2 + (1 - state.uncertaintyLevel) * 0.2,
			
			// High arousal increases affordance weight
			affordance: 0.15 + state.arousalLevel * 0.15,
			
			// High exploration bias increases novelty weight
			novelty: 0.15 + state.explorationBias * 0.2,
			
			// Goal-directed states increase goal alignment weight
			goalAlignment: 0.3 + (1 - state.explorationBias) * 0.2,
		};
	}

	/**
	 * Generate human-readable explanation of relevance
	 */
	private generateExplanation(
		atom: Atom,
		components: {
			salience: number;
			coherence: number;
			affordance: number;
			novelty: number;
			goalAlignment: number;
		},
	): string {
		const parts: string[] = [];

		if (components.salience > 0.7) {
			parts.push("high attention");
		}
		if (components.coherence > 0.7) {
			parts.push("strong coherence");
		}
		if (components.affordance > 0.6) {
			parts.push("rich affordances");
		}
		if (components.novelty > 0.6) {
			parts.push("novel information");
		}
		if (components.goalAlignment > 0.7) {
			parts.push("goal-aligned");
		}

		if (parts.length === 0) {
			return "Low overall relevance";
		}

		return `Relevant due to: ${parts.join(", ")}`;
	}

	/**
	 * Achieve optimal grip by balancing opponent processes
	 */
	achieveOptimalGrip(): {
		inOptimalGrip: boolean;
		adjustments: Map<string, number>;
		recommendations: string[];
	} {
		const adjustments = new Map<string, number>();
		const recommendations: string[] = [];
		let inOptimalGrip = true;

		for (const process of this.opponentProcesses) {
			const [minOptimal, maxOptimal] = process.optimalRange;
			
			if (process.currentBalance < minOptimal) {
				// Too much pole1, need to shift toward pole2
				const adjustment = minOptimal - process.currentBalance;
				adjustments.set(process.name, adjustment);
				recommendations.push(
					`Increase ${process.pole2} (currently too ${process.pole1})`,
				);
				inOptimalGrip = false;
			} else if (process.currentBalance > maxOptimal) {
				// Too much pole2, need to shift toward pole1
				const adjustment = maxOptimal - process.currentBalance;
				adjustments.set(process.name, adjustment);
				recommendations.push(
					`Increase ${process.pole1} (currently too ${process.pole2})`,
				);
				inOptimalGrip = false;
			}
		}

		return {
			inOptimalGrip,
			adjustments,
			recommendations,
		};
	}

	/**
	 * Update opponent process balance based on feedback
	 */
	updateOpponentProcess(
		processName: string,
		delta: number,
	): void {
		const process = this.opponentProcesses.find(p => p.name === processName);
		if (process) {
			process.currentBalance = Math.max(-1.0, Math.min(1.0, process.currentBalance + delta));
		}
	}

	/**
	 * Rank atoms by relevance
	 */
	async rankAtomsByRelevance(
		atoms: Atom[],
		atomSpace: DurableObjectStub,
	): Promise<RelevanceScore[]> {
		const scores = atoms.map(atom => this.calculateRelevance(atom, atomSpace));
		return scores.sort((a, b) => b.score - a.score);
	}

	/**
	 * Filter atoms by relevance threshold
	 */
	async filterRelevantAtoms(
		atoms: Atom[],
		atomSpace: DurableObjectStub,
		threshold: number = 0.6,
	): Promise<Atom[]> {
		const scores = await this.rankAtomsByRelevance(atoms, atomSpace);
		const relevantIds = scores
			.filter(s => s.score >= threshold)
			.map(s => s.atomId);
		
		return atoms.filter(atom => relevantIds.includes(atom.id));
	}

	/**
	 * Update context with new information
	 */
	updateContext(updates: Partial<RelevanceContext>): void {
		this.context = {
			...this.context,
			...updates,
			timestamp: Date.now(),
		};
	}

	/**
	 * Get current cognitive state
	 */
	getCognitiveState(): CognitiveState {
		return this.context.cognitiveState;
	}

	/**
	 * Adjust cognitive state based on task demands
	 */
	adjustCognitiveState(adjustments: Partial<CognitiveState>): void {
		this.context.cognitiveState = {
			...this.context.cognitiveState,
			...adjustments,
		};

		// Update opponent processes based on cognitive state
		this.syncOpponentProcessesWithState();
	}

	/**
	 * Synchronize opponent processes with cognitive state
	 */
	private syncOpponentProcessesWithState(): void {
		const state = this.context.cognitiveState;

		// Focus level affects focus opponent process
		const focusProcess = this.opponentProcesses.find(p => p.name === "focus");
		if (focusProcess) {
			focusProcess.currentBalance = state.focusLevel * 2 - 1; // Map [0,1] to [-1,1]
		}

		// Exploration bias affects exploration opponent process
		const explorationProcess = this.opponentProcesses.find(p => p.name === "exploration");
		if (explorationProcess) {
			explorationProcess.currentBalance = state.explorationBias * 2 - 1;
		}

		// Uncertainty affects abstraction (high uncertainty -> more abstract)
		const abstractionProcess = this.opponentProcesses.find(p => p.name === "abstraction");
		if (abstractionProcess) {
			abstractionProcess.currentBalance = state.uncertaintyLevel * 2 - 1;
		}
	}

	/**
	 * Get opponent processes status
	 */
	getOpponentProcesses(): OpponentProcess[] {
		return [...this.opponentProcesses];
	}
}

/**
 * Cognitive Synergy Coordinator
 * 
 * Orchestrates the interaction between multiple cognitive processes
 * to achieve emergent intelligence through their synergistic interaction.
 */
export class CognitiveSynergyCoordinator {
	private relevanceEngine: RelevanceRealizationEngine;
	private activeProcesses: Set<string> = new Set();

	constructor(context: RelevanceContext) {
		this.relevanceEngine = new RelevanceRealizationEngine(context);
	}

	/**
	 * Coordinate multiple cognitive processes for synergistic effect
	 */
	async coordinateProcesses(
		processes: string[],
		atoms: Atom[],
		atomSpace: DurableObjectStub,
	): Promise<{
		relevantAtoms: Atom[];
		processOutputs: Map<string, any>;
		synergyScore: number;
	}> {
		const processOutputs = new Map<string, any>();

		// Activate processes
		processes.forEach(p => this.activeProcesses.add(p));

		// Filter atoms by relevance
		const relevantAtoms = await this.relevanceEngine.filterRelevantAtoms(
			atoms,
			atomSpace,
			0.5,
		);

		// Calculate synergy score (how well processes work together)
		const synergyScore = this.calculateSynergy();

		return {
			relevantAtoms,
			processOutputs,
			synergyScore,
		};
	}

	/**
	 * Calculate synergy between active processes
	 */
	private calculateSynergy(): number {
		// Synergy emerges from balanced opponent processing
		const gripStatus = this.relevanceEngine.achieveOptimalGrip();
		
		if (gripStatus.inOptimalGrip) {
			return 1.0;
		}

		// Calculate distance from optimal grip
		const totalDeviation = Array.from(gripStatus.adjustments.values())
			.reduce((sum, adj) => sum + Math.abs(adj), 0);

		// Normalize to [0, 1]
		return Math.max(0, 1.0 - totalDeviation / 2.0);
	}

	/**
	 * Get relevance engine for direct access
	 */
	getRelevanceEngine(): RelevanceRealizationEngine {
		return this.relevanceEngine;
	}
}
