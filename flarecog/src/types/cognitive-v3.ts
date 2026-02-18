/**
 * FlareCog v3.0 Type Definitions
 * 
 * Complete type definitions for OpenCog-CloudFlare integration
 */

/**
 * CloudFlare Environment Bindings
 */
export interface Env {
	// Durable Objects
	ATOMSPACE: DurableObjectNamespace;
	MIND_AGENT: DurableObjectNamespace;
	STORAGE_NODE: DurableObjectNamespace;
	WS_MANAGER: DurableObjectNamespace;

	// Storage
	ATOMSPACE_COLD_STORAGE: R2Bucket;
	CACHE: KVNamespace;

	// Database
	COORDINATION_DB: D1Database;

	// AI
	AI: Ai;

	// Analytics
	ANALYTICS?: AnalyticsEngineDataset;

	// Environment Variables
	ENVIRONMENT?: string;
	LOG_LEVEL?: string;
	MAX_ATOMSPACES_PER_TENANT?: string;
	DEFAULT_ATOMSPACE_QUOTA?: string;
	ENABLE_AI_ENHANCEMENT?: string;
	ENABLE_DISTRIBUTED_SYNC?: string;
	ENABLE_WEBSOCKET_STREAMING?: string;
}

/**
 * Atom Types - Core OpenCog atom types
 */
export type AtomType =
	| "Node"
	| "Link"
	| "ConceptNode"
	| "PredicateNode"
	| "VariableNode"
	| "TypeNode"
	| "EvaluationLink"
	| "InheritanceLink"
	| "SimilarityLink"
	| "ImplicationLink"
	| "ListLink"
	| "AndLink"
	| "OrLink"
	| "NotLink"
	| "ExecutionLink"
	| "SequentialAndLink"
	| "ContextLink";

/**
 * Truth Value - Probabilistic truth representation
 */
export interface TruthValue {
	strength: number; // [0, 1]
	confidence: number; // [0, 1]
}

/**
 * Attention Value - Cognitive resource allocation
 */
export interface AttentionValue {
	sti: number; // Short-term importance
	lti: number; // Long-term importance
	vlti: number; // Very long-term importance
}

/**
 * Base Atom interface
 */
export interface BaseAtom {
	id: string;
	type: AtomType;
	truthValue: TruthValue;
	attentionValue: AttentionValue;
	createdAt: number;
	updatedAt: number;
}

/**
 * Node - Atom with a name
 */
export interface Node extends BaseAtom {
	type: Extract<
		AtomType,
		"Node" | "ConceptNode" | "PredicateNode" | "VariableNode" | "TypeNode"
	>;
	name: string;
}

/**
 * Link - Atom with outgoing atoms
 */
export interface Link extends BaseAtom {
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
		| "ExecutionLink"
		| "SequentialAndLink"
		| "ContextLink"
	>;
	outgoing: string[]; // Array of atom IDs
}

/**
 * Atom - Union type of Node and Link
 */
export type Atom = Node | Link;

/**
 * AtomSpace Query
 */
export interface AtomSpaceQuery {
	type?: AtomType;
	name?: string;
	minSTI?: number;
	minTruthStrength?: number;
	limit?: number;
}

/**
 * AtomSpace Response
 */
export interface AtomSpaceResponse {
	success: boolean;
	data?: any;
	error?: string;
}

/**
 * Cognitive Dashboard Data
 */
export interface CognitiveDashboardData {
	platform: string;
	version: string;
	status: string;
	features: Record<string, string>;
	metrics: {
		atomSpace: any;
		distributed: any;
		storage: any;
	};
	timestamp: number;
}

/**
 * MindAgent Definition
 */
export interface MindAgentDefinition {
	id: string;
	name: string;
	description: string;
	enabled: boolean;
	frequency: number; // milliseconds
	priority: number;
	lastRun?: number;
	runCount: number;
}

/**
 * Cognitive Goal
 */
export interface CognitiveGoal {
	id: string;
	description: string;
	targetAtoms: string[];
	status: "pending" | "active" | "achieved" | "failed";
	priority: number;
	createdAt: number;
	updatedAt: number;
	achievedAt?: number;
}

/**
 * Pattern Match Result
 */
export interface PatternMatchResult {
	pattern: string;
	matches: Atom[];
	matchCount: number;
	aiEnhanced: boolean;
}

/**
 * Inference Result
 */
export interface InferenceResult {
	conclusion: Atom;
	truthValue: TruthValue;
	reasoning: string;
	confidence: number;
	premises: string[];
}

/**
 * Semantic Similarity Result
 */
export interface SemanticSimilarityResult {
	atom1Id: string;
	atom2Id: string;
	similarity: number;
	method: "embedding" | "structural" | "hybrid";
}

/**
 * Distributed Sync Status
 */
export interface DistributedSyncStatus {
	instanceId: string;
	region: string;
	lastSync: number;
	atomCount: number;
	pendingSync: number;
	conflicts: number;
}

/**
 * Storage Tier Statistics
 */
export interface StorageTierStats {
	hotAtoms: number;
	warmAtoms: number;
	coldAtoms: number;
	totalSize: number;
	r2Objects: number;
}

/**
 * Cognitive Event
 */
export interface CognitiveEvent {
	type: string;
	timestamp: number;
	instanceId: string;
	data: any;
}

/**
 * WebSocket Subscription
 */
export interface WebSocketSubscription {
	clientId: string;
	eventTypes: string[];
	filters?: {
		instanceId?: string;
		atomTypes?: string[];
		minSTI?: number;
	};
}

/**
 * Vector Clock for distributed coordination
 */
export interface VectorClock {
	[instanceId: string]: number;
}

/**
 * Conflict Resolution Strategy
 */
export type ConflictResolutionStrategy =
	| "last-write-wins"
	| "truth-value-merge"
	| "manual"
	| "consensus";

/**
 * Distributed Query
 */
export interface DistributedQuery {
	queryId: string;
	pattern: string;
	targetInstances: string[];
	results: Atom[];
	status: "pending" | "complete" | "failed";
	createdAt: number;
	completedAt?: number;
}

/**
 * AI Model Configuration
 */
export interface AIModelConfig {
	model: string;
	temperature?: number;
	maxTokens?: number;
	topP?: number;
}

/**
 * Embedding Result
 */
export interface EmbeddingResult {
	embedding: number[];
	dimensions: number;
	model: string;
}

/**
 * Instance Registration
 */
export interface InstanceRegistration {
	instanceId: string;
	region: string;
	capabilities: string[];
	status: "active" | "inactive" | "maintenance";
	lastHeartbeat: number;
}

/**
 * Global Statistics
 */
export interface GlobalStatistics {
	totalInstances: number;
	activeInstances: number;
	totalAtoms: number;
	totalQueries: number;
	totalSyncEvents: number;
	averageLatency: number;
}

/**
 * Relevance Realization Context
 */
export interface RelevanceContext {
	goal?: string;
	constraints?: string[];
	focusAtoms?: string[];
	timeWindow?: number;
}

/**
 * Optimal Grip Result
 */
export interface OptimalGripResult {
	relevantAtoms: Atom[];
	relevanceScores: Record<string, number>;
	cognitiveState: {
		salience: number;
		coherence: number;
		affordance: number;
	};
}

/**
 * PLN Rule
 */
export interface PLNRule {
	id: string;
	name: string;
	type: "deduction" | "induction" | "abduction" | "revision" | "analogy";
	premises: number; // Number of required premises
	formula: string;
	enabled: boolean;
}

/**
 * Reasoning Chain
 */
export interface ReasoningChain {
	steps: ReasoningStep[];
	conclusion: Atom;
	totalConfidence: number;
}

/**
 * Reasoning Step
 */
export interface ReasoningStep {
	stepNumber: number;
	rule: string;
	premises: string[];
	conclusion: string;
	truthValue: TruthValue;
}

/**
 * Attention Allocation Result
 */
export interface AttentionAllocationResult {
	atomId: string;
	oldSTI: number;
	newSTI: number;
	reason: string;
	timestamp: number;
}

/**
 * Pattern Discovery Result
 */
export interface PatternDiscoveryResult {
	patterns: string[];
	frequency: number;
	significance: number;
	atoms: string[];
}
