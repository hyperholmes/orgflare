/**
 * Core cognitive types for the OpenCog-based Cogflare platform
 */

export interface Env {
	ATOMSPACE: DurableObjectNamespace;
	MIND_AGENT: DurableObjectNamespace;
	COGNITIVE_DB: D1Database;
	ATOM_CACHE: KVNamespace;
	AI: Ai;
	ATOMSPACE_MODE?: string;
}

// Core Atom types
export type AtomType =
	| "Node"
	| "Link"
	| "ConceptNode"
	| "PredicateNode"
	| "VariableNode"
	| "EvaluationLink"
	| "InheritanceLink"
	| "SimilarityLink"
	| "ImplicationLink"
	| "ListLink"
	| "AndLink"
	| "OrLink"
	| "NotLink";

export interface Atom {
	id: string;
	type: AtomType;
	name?: string;
	truthValue: TruthValue;
	attentionValue: AttentionValue;
	createdAt: number;
	updatedAt: number;
}

export interface Node extends Atom {
	type: Extract<
		AtomType,
		"Node" | "ConceptNode" | "PredicateNode" | "VariableNode"
	>;
	name: string;
}

export interface Link extends Atom {
	type: Extract<
		AtomType,
		| "Link"
		| "EvaluationLink"
		| "InheritanceLink"
		| "SimilarityLink"
		| "ImplicationLink"
		| "ListLink"
		| "AndLink"
		| "OrLink"
		| "NotLink"
	>;
	outgoing: string[]; // Array of atom IDs
}

export interface TruthValue {
	strength: number; // 0.0 to 1.0
	confidence: number; // 0.0 to 1.0
}

export interface AttentionValue {
	sti: number; // Short-term importance
	lti: number; // Long-term importance
	vlti: number; // Very long-term importance
}

// MindAgent types
export interface MindAgentConfig {
	id: string;
	name: string;
	type: MindAgentType;
	frequency: number; // execution frequency in ms
	priority: number; // execution priority
	enabled: boolean;
	parameters: Record<string, any>;
}

export type MindAgentType =
	| "ForgetAgent"
	| "HebbianAgent"
	| "ImportanceSpreadingAgent"
	| "GoalAgent"
	| "PlanningAgent"
	| "ReasoningAgent"
	| "LearningAgent"
	| "PerceptionAgent";

export interface MindAgentResult {
	agentId: string;
	executionTime: number;
	atomsProcessed: number;
	atomsCreated: number;
	atomsModified: number;
	success: boolean;
	error?: string;
	metrics?: Record<string, number>;
}

// Goal system types
export interface Goal {
	id: string;
	type: GoalType;
	description: string;
	priority: number;
	status: GoalStatus;
	targetAtom?: string;
	conditions: GoalCondition[];
	actions: GoalAction[];
	createdAt: number;
	updatedAt: number;
	completedAt?: number;
}

export type GoalType = "explicit" | "implicit" | "system";
export type GoalStatus =
	| "active"
	| "paused"
	| "completed"
	| "failed"
	| "cancelled";

export interface GoalCondition {
	type: "atom_exists" | "atom_truth_value" | "atom_attention" | "custom";
	atomId?: string;
	predicate: string;
	threshold?: number;
}

export interface GoalAction {
	type: "create_atom" | "modify_atom" | "execute_agent" | "custom";
	parameters: Record<string, any>;
}

// AtomSpace query types
export interface AtomSpaceQuery {
	type: "find_atoms" | "get_incoming" | "get_outgoing" | "pattern_match";
	atomType?: AtomType;
	name?: string;
	truthValueMin?: TruthValue;
	attentionValueMin?: AttentionValue;
	pattern?: QueryPattern;
	limit?: number;
	offset?: number;
}

export interface QueryPattern {
	variables: VariableBinding[];
	clauses: QueryClause[];
}

export interface VariableBinding {
	name: string;
	type?: AtomType;
	constraints?: Record<string, any>;
}

export interface QueryClause {
	type: "atom" | "link" | "evaluation" | "inheritance";
	atom?: string | VariableBinding;
	predicate?: string | VariableBinding;
	arguments?: (string | VariableBinding)[];
}

// API types
export interface AtomSpaceResponse {
	success: boolean;
	data?: any;
	error?: string;
	timestamp: number;
}

export interface CognitiveDashboardData {
	atomSpace: {
		totalAtoms: number;
		nodeCount: number;
		linkCount: number;
		averageTruthValue: TruthValue;
		averageAttentionValue: AttentionValue;
	};
	mindAgents: {
		activeAgents: number;
		totalExecutions: number;
		averageExecutionTime: number;
		recentResults: MindAgentResult[];
	};
	goals: {
		activeGoals: number;
		completedGoals: number;
		averagePriority: number;
		recentGoals: Goal[];
	};
	performance: {
		operationsPerSecond: number;
		memoryUsage: number;
		responseTime: number;
	};
}
