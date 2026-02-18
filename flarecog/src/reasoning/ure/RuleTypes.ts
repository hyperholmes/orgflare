import { Atom, Link, TruthValue, AttentionValue } from "../../types/cognitive";

/**
 * Rule Types for Unified Rule Engine (URE)
 *
 * Defines rule atom types and structures for generic rule application
 */

/**
 * BindLink - Pattern matching and variable binding rule
 *
 * Structure:
 * BindLink
 *   VariableList (variables to bind)
 *   Pattern (pattern to match)
 *   Rewrite (result to produce)
 */
export interface BindLink extends Link {
	type: "BindLink";
	outgoing: [string, string, string]; // [variableList, pattern, rewrite]
}

/**
 * ExecutionLink - Execute a procedure or function
 *
 * Structure:
 * ExecutionLink
 *   GroundedSchemaNode (procedure name)
 *   ListLink (arguments)
 */
export interface ExecutionLink extends Link {
	type: "ExecutionLink";
	outgoing: [string, string]; // [schema, arguments]
}

/**
 * Rule - Generic inference rule
 */
export interface Rule {
	id: string;
	name: string;
	type: RuleType;
	bindLink: BindLink;
	priority: number;
	weight: number; // Probability of selection
	preconditions?: RulePrecondition[];
	postconditions?: RulePostcondition[];
	metadata: RuleMetadata;
}

export type RuleType =
	| "deduction"
	| "induction"
	| "abduction"
	| "modus_ponens"
	| "modus_tollens"
	| "and_elimination"
	| "or_introduction"
	| "implication"
	| "equivalence"
	| "custom";

export interface RulePrecondition {
	type: "atom_exists" | "truth_value" | "attention_value" | "custom";
	predicate: string;
	threshold?: number;
}

export interface RulePostcondition {
	type: "create_atom" | "update_atom" | "delete_atom" | "custom";
	action: string;
}

export interface RuleMetadata {
	description: string;
	category: string;
	complexity: number;
	successRate?: number;
	avgExecutionTime?: number;
	timesApplied: number;
	createdAt: number;
	updatedAt: number;
}

/**
 * Rule Application Result
 */
export interface RuleApplicationResult {
	success: boolean;
	rule: Rule;
	premises: Atom[];
	conclusions: Atom[];
	bindings: Map<string, string>;
	truthValue: TruthValue;
	executionTime: number;
	error?: string;
}

/**
 * Inference Step
 */
export interface InferenceStep {
	stepNumber: number;
	rule: Rule;
	premises: string[]; // Atom IDs
	conclusions: string[]; // Atom IDs
	bindings: Record<string, string>;
	truthValue: TruthValue;
	timestamp: number;
}

/**
 * Inference Chain
 */
export interface InferenceChain {
	id: string;
	goal?: string; // Target atom ID for backward chaining
	steps: InferenceStep[];
	finalConclusions: string[];
	overallTruthValue: TruthValue;
	totalExecutionTime: number;
	createdAt: number;
	completedAt?: number;
}

/**
 * Chaining Direction
 */
export type ChainingDirection = "forward" | "backward" | "mixed";

/**
 * Chaining Configuration
 */
export interface ChainingConfig {
	direction: ChainingDirection;
	maxSteps: number;
	maxTime: number; // milliseconds
	minTruthStrength: number;
	minTruthConfidence: number;
	ruleSelectionStrategy: RuleSelectionStrategy;
	pruningStrategy: PruningStrategy;
}

export type RuleSelectionStrategy =
	| "priority"
	| "weight"
	| "random"
	| "success_rate"
	| "complexity";

export type PruningStrategy =
	| "none"
	| "truth_value"
	| "attention_value"
	| "depth_first"
	| "breadth_first";

/**
 * Rule Base - Collection of rules
 */
export interface RuleBase {
	id: string;
	name: string;
	rules: Map<string, Rule>;
	categories: Map<string, string[]>; // category -> rule IDs
	metadata: {
		totalRules: number;
		avgComplexity: number;
		createdAt: number;
		updatedAt: number;
	};
}

/**
 * Inference Context - State during inference
 */
export interface InferenceContext {
	atomSpace: DurableObjectStub;
	ruleBase: RuleBase;
	config: ChainingConfig;
	visitedAtoms: Set<string>;
	appliedRules: Set<string>;
	currentDepth: number;
	startTime: number;
}

/**
 * Forward Chaining Target
 */
export interface ForwardChainingTarget {
	sourceAtoms: string[]; // Starting atoms
	maxInferences: number;
	stopCondition?: (atoms: Atom[]) => boolean;
}

/**
 * Backward Chaining Target
 */
export interface BackwardChainingTarget {
	goalAtom: string; // Target to prove
	maxDepth: number;
	stopCondition?: (chain: InferenceChain) => boolean;
}

/**
 * Rule Template - For creating new rules
 */
export interface RuleTemplate {
	name: string;
	type: RuleType;
	variablePattern: string;
	matchPattern: string;
	rewritePattern: string;
	priority: number;
	weight: number;
}

/**
 * Common rule templates
 */
export const CommonRuleTemplates: Record<string, RuleTemplate> = {
	deduction: {
		name: "Deduction Rule",
		type: "deduction",
		variablePattern: "($A, $B, $C)",
		matchPattern: "AND(Implication($A, $B), Implication($B, $C))",
		rewritePattern: "Implication($A, $C)",
		priority: 10,
		weight: 0.8,
	},
	modusPonens: {
		name: "Modus Ponens",
		type: "modus_ponens",
		variablePattern: "($A, $B)",
		matchPattern: "AND($A, Implication($A, $B))",
		rewritePattern: "$B",
		priority: 15,
		weight: 0.9,
	},
	andElimination: {
		name: "AND Elimination",
		type: "and_elimination",
		variablePattern: "($A, $B)",
		matchPattern: "AND($A, $B)",
		rewritePattern: "$A",
		priority: 5,
		weight: 1.0,
	},
	orIntroduction: {
		name: "OR Introduction",
		type: "or_introduction",
		variablePattern: "($A, $B)",
		matchPattern: "$A",
		rewritePattern: "OR($A, $B)",
		priority: 3,
		weight: 0.5,
	},
};
