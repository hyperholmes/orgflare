/**
 * Core FlareCog/AtomSpace type definitions
 */

export type AtomType =
	| "Node"
	| "ConceptNode"
	| "PredicateNode"
	| "VariableNode"
	| "Link"
	| "EvaluationLink"
	| "InheritanceLink"
	| "SimilarityLink"
	| "ImplicationLink"
	| "ListLink";

export interface TruthValue {
	strength: number; // 0.0 to 1.0
	confidence: number; // 0.0 to 1.0
}

export interface AttentionValue {
	sti: number; // Short-term importance
	lti: number; // Long-term importance
	vlti: number; // Very long-term importance
}

export interface BaseAtom {
	id: string;
	type: AtomType;
	truthValue: TruthValue;
	attentionValue: AttentionValue;
	createdAt: number;
	updatedAt: number;
}

export interface Node extends BaseAtom {
	type: Extract<AtomType, "Node" | "ConceptNode" | "PredicateNode" | "VariableNode">;
	name: string;
}

export interface Link extends BaseAtom {
	type: Extract<
		AtomType,
		"Link" | "EvaluationLink" | "InheritanceLink" | "SimilarityLink" | "ImplicationLink" | "ListLink"
	>;
	outgoing: string[]; // Array of atom IDs
}

export type Atom = Node | Link;

export interface AtomSpaceQuery {
	type?: AtomType;
	name?: string;
	minSTI?: number;
	maxSTI?: number;
	minStrength?: number;
	maxStrength?: number;
	limit?: number;
}

export interface AtomSpaceStats {
	totalAtoms: number;
	nodeCount: number;
	linkCount: number;
	averageSTI: number;
	averageTruthStrength: number;
}
