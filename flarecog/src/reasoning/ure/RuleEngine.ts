import {
	Rule,
	InferenceChain,
	InferenceContext,
	ChainingConfig,
	ChainingDirection,
	ForwardChainingTarget,
	BackwardChainingTarget,
} from "./RuleTypes";
import { RuleBaseManager } from "./RuleBase";
import { ForwardChainer } from "./ForwardChainer";
import { BackwardChainer } from "./BackwardChainer";

/**
 * Unified Rule Engine (URE)
 *
 * Main interface for rule-based inference with forward and backward chaining
 */

export class RuleEngine {
	private ruleBase: RuleBaseManager;
	private atomSpace: DurableObjectStub;

	constructor(atomSpace: DurableObjectStub, ruleBaseName: string = "default") {
		this.atomSpace = atomSpace;
		this.ruleBase = new RuleBaseManager(ruleBaseName);
	}

	/**
	 * Execute inference with specified configuration
	 */
	async infer(
		target: ForwardChainingTarget | BackwardChainingTarget,
		config: ChainingConfig,
	): Promise<InferenceChain> {
		const context = this.createContext(config);

		if (config.direction === "forward") {
			const forwardChainer = new ForwardChainer(context);
			return await forwardChainer.execute(target as ForwardChainingTarget);
		} else if (config.direction === "backward") {
			const backwardChainer = new BackwardChainer(context);
			return await backwardChainer.execute(target as BackwardChainingTarget);
		} else {
			// Mixed chaining: try forward first, then backward if needed
			try {
				const forwardChainer = new ForwardChainer(context);
				const forwardResult = await forwardChainer.execute(
					target as ForwardChainingTarget,
				);

				if (forwardResult.finalConclusions.length > 0) {
					return forwardResult;
				}

				// Try backward chaining
				const backwardChainer = new BackwardChainer(context);
				return await backwardChainer.execute(target as BackwardChainingTarget);
			} catch (error) {
				throw new Error(
					`Mixed chaining failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}
	}

	/**
	 * Forward chaining convenience method
	 */
	async forwardChain(
		sourceAtoms: string[],
		maxInferences: number = 100,
		config?: Partial<ChainingConfig>,
	): Promise<InferenceChain> {
		const fullConfig = this.createDefaultConfig("forward", config);
		const target: ForwardChainingTarget = {
			sourceAtoms,
			maxInferences,
		};

		return await this.infer(target, fullConfig);
	}

	/**
	 * Backward chaining convenience method
	 */
	async backwardChain(
		goalAtom: string,
		maxDepth: number = 10,
		config?: Partial<ChainingConfig>,
	): Promise<InferenceChain> {
		const fullConfig = this.createDefaultConfig("backward", config);
		const target: BackwardChainingTarget = {
			goalAtom,
			maxDepth,
		};

		return await this.infer(target, fullConfig);
	}

	/**
	 * Add rule to rule base
	 */
	addRule(rule: Rule): void {
		this.ruleBase.addRule(rule);
	}

	/**
	 * Remove rule from rule base
	 */
	removeRule(ruleId: string): boolean {
		return this.ruleBase.removeRule(ruleId);
	}

	/**
	 * Get rule by ID
	 */
	getRule(ruleId: string): Rule | undefined {
		return this.ruleBase.getRule(ruleId);
	}

	/**
	 * Get all rules
	 */
	getAllRules(): Rule[] {
		return this.ruleBase.getAllRules();
	}

	/**
	 * Get rule base statistics
	 */
	getRuleBaseStatistics() {
		return this.ruleBase.getStatistics();
	}

	/**
	 * Export rule base
	 */
	exportRuleBase(): string {
		return this.ruleBase.export();
	}

	/**
	 * Import rule base
	 */
	importRuleBase(json: string): void {
		this.ruleBase.import(json);
	}

	/**
	 * Create inference context
	 */
	private createContext(config: ChainingConfig): InferenceContext {
		return {
			atomSpace: this.atomSpace,
			ruleBase: this.ruleBase.getRuleBase(),
			config,
			visitedAtoms: new Set(),
			appliedRules: new Set(),
			currentDepth: 0,
			startTime: Date.now(),
		};
	}

	/**
	 * Create default configuration
	 */
	private createDefaultConfig(
		direction: ChainingDirection,
		overrides?: Partial<ChainingConfig>,
	): ChainingConfig {
		return {
			direction,
			maxSteps: 100,
			maxTime: 30000, // 30 seconds
			minTruthStrength: 0.5,
			minTruthConfidence: 0.5,
			ruleSelectionStrategy: "priority",
			pruningStrategy: "truth_value",
			...overrides,
		};
	}

	/**
	 * Get rule base manager
	 */
	getRuleBaseManager(): RuleBaseManager {
		return this.ruleBase;
	}
}
