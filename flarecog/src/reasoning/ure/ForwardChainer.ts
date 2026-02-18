import {
	Rule,
	RuleApplicationResult,
	InferenceChain,
	InferenceStep,
	InferenceContext,
	ForwardChainingTarget,
	ChainingConfig,
} from "./RuleTypes";
import { Atom, TruthValue } from "../../types/cognitive";
import { PatternMatcher } from "../PatternMatcher";
import { PLNRules } from "../PLNRules";
import { nanoid } from "nanoid";

/**
 * Forward Chainer - Forward chaining inference engine
 *
 * Applies rules forward from known facts to derive new conclusions
 */

export class ForwardChainer {
	private context: InferenceContext;
	private chain: InferenceChain;

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
	 * Execute forward chaining
	 */
	async execute(target: ForwardChainingTarget): Promise<InferenceChain> {
		const startTime = Date.now();

		try {
			// Initialize with source atoms
			let currentAtoms = await this.loadAtoms(target.sourceAtoms);
			let inferredAtoms: Atom[] = [];
			let iteration = 0;

			while (
				iteration < target.maxInferences &&
				Date.now() - startTime < this.context.config.maxTime
			) {
				// Select applicable rules
				const applicableRules = await this.selectApplicableRules(currentAtoms);

				if (applicableRules.length === 0) {
					break; // No more rules to apply
				}

				// Apply rules
				const results = await this.applyRules(applicableRules, currentAtoms);

				if (results.length === 0) {
					break; // No new inferences
				}

				// Collect new atoms
				const newAtoms = results.flatMap((r) => r.conclusions);
				inferredAtoms.push(...newAtoms);

				// Add to chain
				for (const result of results) {
					this.addStep(result);
				}

				// Check stop condition
				if (target.stopCondition && target.stopCondition(inferredAtoms)) {
					break;
				}

				// Prepare for next iteration
				currentAtoms = [...currentAtoms, ...newAtoms];
				iteration++;
			}

			// Finalize chain
			this.chain.finalConclusions = inferredAtoms.map((a) => a.id);
			this.chain.completedAt = Date.now();
			this.chain.totalExecutionTime = Date.now() - startTime;

			// Calculate overall truth value
			this.chain.overallTruthValue = this.calculateOverallTruthValue();

			return this.chain;
		} catch (error) {
			throw new Error(
				`Forward chaining failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Load atoms from AtomSpace
	 */
	private async loadAtoms(atomIds: string[]): Promise<Atom[]> {
		const atoms: Atom[] = [];

		for (const id of atomIds) {
			const response = await this.context.atomSpace.fetch(
				new Request(`http://dummy/atom/${id}`),
			);
			const data = await response.json();

			if (data.success && data.data) {
				atoms.push(data.data);
			}
		}

		return atoms;
	}

	/**
	 * Select applicable rules based on current atoms
	 */
	private async selectApplicableRules(atoms: Atom[]): Promise<Rule[]> {
		const allRules = Array.from(this.context.ruleBase.rules.values());
		const applicableRules: Rule[] = [];

		for (const rule of allRules) {
			// Skip already applied rules if configured
			if (this.context.appliedRules.has(rule.id)) {
				continue;
			}

			// Check preconditions
			if (rule.preconditions) {
				const preconditionsMet = await this.checkPreconditions(
					rule.preconditions,
					atoms,
				);
				if (!preconditionsMet) {
					continue;
				}
			}

			// Check if rule pattern matches any atoms
			const matches = await this.matchRulePattern(rule, atoms);
			if (matches.length > 0) {
				applicableRules.push(rule);
			}
		}

		// Select rules based on strategy
		return this.selectByStrategy(
			applicableRules,
			this.context.config.ruleSelectionStrategy,
		);
	}

	/**
	 * Check rule preconditions
	 */
	private async checkPreconditions(
		preconditions: any[],
		atoms: Atom[],
	): Promise<boolean> {
		for (const precondition of preconditions) {
			switch (precondition.type) {
				case "atom_exists":
					if (!atoms.some((a) => a.id === precondition.predicate)) {
						return false;
					}
					break;

				case "truth_value":
					const atom = atoms.find((a) => a.id === precondition.predicate);
					if (
						!atom ||
						atom.truthValue.strength < (precondition.threshold || 0)
					) {
						return false;
					}
					break;

				case "attention_value":
					const atomAttn = atoms.find((a) => a.id === precondition.predicate);
					if (
						!atomAttn ||
						atomAttn.attentionValue.sti < (precondition.threshold || 0)
					) {
						return false;
					}
					break;
			}
		}

		return true;
	}

	/**
	 * Match rule pattern against atoms
	 */
	private async matchRulePattern(rule: Rule, atoms: Atom[]): Promise<any[]> {
		// Simplified pattern matching
		// In full implementation, would use PatternMatcher with rule.bindLink
		return atoms.length > 0 ? [{ bindings: {}, atoms }] : [];
	}

	/**
	 * Apply rules to atoms
	 */
	private async applyRules(
		rules: Rule[],
		atoms: Atom[],
	): Promise<RuleApplicationResult[]> {
		const results: RuleApplicationResult[] = [];

		for (const rule of rules) {
			const result = await this.applyRule(rule, atoms);
			if (result.success) {
				results.push(result);
				this.context.appliedRules.add(rule.id);

				// Update rule statistics
				rule.metadata.timesApplied++;
				rule.metadata.updatedAt = Date.now();
			}
		}

		return results;
	}

	/**
	 * Apply a single rule
	 */
	private async applyRule(
		rule: Rule,
		atoms: Atom[],
	): Promise<RuleApplicationResult> {
		const startTime = Date.now();

		try {
			// Find matching atoms for rule
			const matches = await this.matchRulePattern(rule, atoms);

			if (matches.length === 0) {
				return {
					success: false,
					rule,
					premises: [],
					conclusions: [],
					bindings: new Map(),
					truthValue: { strength: 0, confidence: 0 },
					executionTime: Date.now() - startTime,
					error: "No matches found",
				};
			}

			// Take first match (could be improved with better selection)
			const match = matches[0];

			// Apply rule based on type
			let conclusions: Atom[] = [];
			let truthValue: TruthValue = { strength: 1.0, confidence: 1.0 };

			switch (rule.type) {
				case "deduction":
					if (match.atoms.length >= 2) {
						truthValue = PLNRules.deduction(
							match.atoms[0].truthValue,
							match.atoms[1].truthValue,
						);
						conclusions = await this.createConclusion(rule, match, truthValue);
					}
					break;

				case "modus_ponens":
					if (match.atoms.length >= 2) {
						truthValue = PLNRules.modusPonens(
							match.atoms[0].truthValue,
							match.atoms[1].truthValue,
						);
						conclusions = await this.createConclusion(rule, match, truthValue);
					}
					break;

				default:
					// Generic rule application
					conclusions = await this.createConclusion(
						rule,
						match,
						match.atoms[0]?.truthValue || { strength: 0.5, confidence: 0.5 },
					);
			}

			return {
				success: true,
				rule,
				premises: match.atoms,
				conclusions,
				bindings: new Map(Object.entries(match.bindings)),
				truthValue,
				executionTime: Date.now() - startTime,
			};
		} catch (error) {
			return {
				success: false,
				rule,
				premises: [],
				conclusions: [],
				bindings: new Map(),
				truthValue: { strength: 0, confidence: 0 },
				executionTime: Date.now() - startTime,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Create conclusion atom from rule application
	 */
	private async createConclusion(
		rule: Rule,
		match: any,
		truthValue: TruthValue,
	): Promise<Atom[]> {
		// Simplified conclusion creation
		// In full implementation, would apply rewrite pattern from BindLink

		const conclusionAtom: Atom = {
			id: nanoid(),
			type: "ConceptNode",
			name: `inferred_by_${rule.name}_${Date.now()}`,
			truthValue,
			attentionValue: { sti: 50, lti: 0, vlti: 0 },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		// Store in AtomSpace
		await this.context.atomSpace.fetch(
			new Request("http://dummy/node", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: conclusionAtom.type,
					name: conclusionAtom.name,
					truthValue: conclusionAtom.truthValue,
				}),
			}),
		);

		return [conclusionAtom];
	}

	/**
	 * Add step to inference chain
	 */
	private addStep(result: RuleApplicationResult): void {
		const step: InferenceStep = {
			stepNumber: this.chain.steps.length + 1,
			rule: result.rule,
			premises: result.premises.map((a) => a.id),
			conclusions: result.conclusions.map((a) => a.id),
			bindings: Object.fromEntries(result.bindings),
			truthValue: result.truthValue,
			timestamp: Date.now(),
		};

		this.chain.steps.push(step);
	}

	/**
	 * Select rules by strategy
	 */
	private selectByStrategy(rules: Rule[], strategy: string): Rule[] {
		switch (strategy) {
			case "priority":
				return rules.sort((a, b) => b.priority - a.priority);

			case "weight":
				return rules.sort((a, b) => b.weight - a.weight);

			case "success_rate":
				return rules.sort(
					(a, b) =>
						(b.metadata.successRate || 0) - (a.metadata.successRate || 0),
				);

			case "complexity":
				return rules.sort(
					(a, b) => a.metadata.complexity - b.metadata.complexity,
				);

			default:
				return rules;
		}
	}

	/**
	 * Calculate overall truth value of inference chain
	 */
	private calculateOverallTruthValue(): TruthValue {
		if (this.chain.steps.length === 0) {
			return { strength: 0, confidence: 0 };
		}

		// Use conjunction of all step truth values
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
