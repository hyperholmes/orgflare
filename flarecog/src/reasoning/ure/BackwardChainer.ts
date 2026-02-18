import {
	Rule,
	InferenceChain,
	InferenceStep,
	InferenceContext,
	BackwardChainingTarget,
} from "./RuleTypes";
import { Atom, TruthValue } from "../../types/cognitive";
import { PLNRules } from "../PLNRules";
import { nanoid } from "nanoid";

/**
 * Backward Chainer - Backward chaining inference engine
 *
 * Works backward from a goal to find supporting premises
 */

export class BackwardChainer {
	private context: InferenceContext;
	private chain: InferenceChain;
	private goalStack: string[] = [];

	constructor(context: InferenceContext) {
		this.context = context;
		this.chain = {
			id: nanoid(),
			steps: [],
			finalConclusions: [],
			overallTruthValue: { strength: 1.0, confidence: 1.0 },
			totalExecutionTime: 0,
			createdAt: Date.now(),
		};
	}

	/**
	 * Execute backward chaining from goal
	 */
	async execute(target: BackwardChainingTarget): Promise<InferenceChain> {
		const startTime = Date.now();

		try {
			this.chain.goal = target.goalAtom;
			this.goalStack.push(target.goalAtom);

			const proved = await this.proveGoal(
				target.goalAtom,
				0,
				target.maxDepth,
			);

			this.chain.finalConclusions = proved ? [target.goalAtom] : [];
			this.chain.completedAt = Date.now();
			this.chain.totalExecutionTime = Date.now() - startTime;
			this.chain.overallTruthValue = this.calculateOverallTruthValue();

			return this.chain;
		} catch (error) {
			throw new Error(
				`Backward chaining failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Recursively prove a goal
	 */
	private async proveGoal(
		goalId: string,
		depth: number,
		maxDepth: number,
	): Promise<boolean> {
		// Check depth limit
		if (depth >= maxDepth) {
			return false;
		}

		// Check if goal already proven (exists in AtomSpace with high TV)
		const goalAtom = await this.loadAtom(goalId);
		if (
			goalAtom &&
			goalAtom.truthValue.strength >= this.context.config.minTruthStrength &&
			goalAtom.truthValue.confidence >= this.context.config.minTruthConfidence
		) {
			return true;
		}

		// Find rules that can prove this goal
		const applicableRules = await this.findRulesForGoal(goalId);

		for (const rule of applicableRules) {
			// Get premises needed for this rule
			const premises = await this.getRulePremises(rule);

			// Try to prove all premises
			let allPremisesProved = true;
			const provedPremises: Atom[] = [];

			for (const premise of premises) {
				// Avoid circular reasoning
				if (this.goalStack.includes(premise.id)) {
					allPremisesProved = false;
					break;
				}

				this.goalStack.push(premise.id);
				const proved = await this.proveGoal(premise.id, depth + 1, maxDepth);
				this.goalStack.pop();

				if (!proved) {
					allPremisesProved = false;
					break;
				}

				provedPremises.push(premise);
			}

			// If all premises proved, apply rule to prove goal
			if (allPremisesProved && provedPremises.length > 0) {
				const truthValue = this.calculateRuleTruthValue(rule, provedPremises);

				// Create inference step
				const step: InferenceStep = {
					stepNumber: this.chain.steps.length + 1,
					rule,
					premises: provedPremises.map((p) => p.id),
					conclusions: [goalId],
					bindings: {},
					truthValue,
					timestamp: Date.now(),
				};

				this.chain.steps.push(step);

				// Update goal atom with new truth value
				await this.updateGoalTruthValue(goalId, truthValue);

				return true;
			}
		}

		return false;
	}

	/**
	 * Load atom from AtomSpace
	 */
	private async loadAtom(atomId: string): Promise<Atom | null> {
		try {
			const response = await this.context.atomSpace.fetch(
				new Request(`http://dummy/atom/${atomId}`),
			);
			const data = await response.json();
			return data.success ? data.data : null;
		} catch {
			return null;
		}
	}

	/**
	 * Find rules that can prove the goal
	 */
	private async findRulesForGoal(goalId: string): Promise<Rule[]> {
		// Simplified: return rules that could produce this type of conclusion
		// In full implementation, would match goal against rule rewrite patterns
		const allRules = Array.from(this.context.ruleBase.rules.values());

		return allRules
			.filter((rule) => !this.context.appliedRules.has(rule.id))
			.sort((a, b) => b.priority - a.priority)
			.slice(0, 5); // Limit to top 5 rules
	}

	/**
	 * Get premises required by a rule
	 */
	private async getRulePremises(rule: Rule): Promise<Atom[]> {
		// Simplified: return atoms that match rule pattern
		// In full implementation, would extract from BindLink pattern
		const response = await this.context.atomSpace.fetch(
			new Request("http://dummy/atoms?limit=10"),
		);
		const data = await response.json();

		return data.success ? data.data.slice(0, 2) : [];
	}

	/**
	 * Calculate truth value from rule application
	 */
	private calculateRuleTruthValue(
		rule: Rule,
		premises: Atom[],
	): TruthValue {
		if (premises.length === 0) {
			return { strength: 0, confidence: 0 };
		}

		// Apply rule-specific truth value calculation
		switch (rule.type) {
			case "deduction":
				if (premises.length >= 2) {
					return PLNRules.deduction(
						premises[0].truthValue,
						premises[1].truthValue,
					);
				}
				break;

			case "modus_ponens":
				if (premises.length >= 2) {
					return PLNRules.modusPonens(
						premises[0].truthValue,
						premises[1].truthValue,
					);
				}
				break;

			case "induction":
				if (premises.length >= 2) {
					return PLNRules.induction(
						premises[0].truthValue,
						premises[1].truthValue,
					);
				}
				break;
		}

		// Default: conjunction of all premises
		let result = premises[0].truthValue;
		for (let i = 1; i < premises.length; i++) {
			result = PLNRules.conjunction(result, premises[i].truthValue);
		}

		return result;
	}

	/**
	 * Update goal atom with new truth value
	 */
	private async updateGoalTruthValue(
		goalId: string,
		truthValue: TruthValue,
	): Promise<void> {
		await this.context.atomSpace.fetch(
			new Request(`http://dummy/atom/${goalId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ truthValue }),
			}),
		);
	}

	/**
	 * Calculate overall truth value
	 */
	private calculateOverallTruthValue(): TruthValue {
		if (this.chain.steps.length === 0) {
			return { strength: 0, confidence: 0 };
		}

		// Use conjunction of all steps
		let result = this.chain.steps[0].truthValue;
		for (let i = 1; i < this.chain.steps.length; i++) {
			result = PLNRules.conjunction(result, this.chain.steps[i].truthValue);
		}

		return result;
	}

	/**
	 * Get inference chain
	 */
	getChain(): InferenceChain {
		return this.chain;
	}
}
