import {
	Atom,
	Node,
	Link,
	AtomType,
	QueryPattern,
	VariableBinding,
	QueryClause,
} from "../types/cognitive";

/**
 * Pattern Matcher - Core reasoning engine for OpenCog-style pattern matching
 *
 * Implements variable binding, unification, and pattern-based queries
 * against the AtomSpace hypergraph.
 */

export interface MatchResult {
	bindings: Map<string, string>; // Variable name -> Atom ID
	satisfiedClauses: number;
	score: number;
}

export class PatternMatcher {
	/**
	 * Match a pattern against the AtomSpace
	 */
	static async matchPattern(
		pattern: QueryPattern,
		atomSpaceStub: DurableObjectStub,
	): Promise<MatchResult[]> {
		const results: MatchResult[] = [];

		// Get all candidate atoms for the first clause
		const firstClause = pattern.clauses[0];
		if (!firstClause) {
			return results;
		}

		const candidates = await this.getCandidatesForClause(
			firstClause,
			atomSpaceStub,
		);

		// Try to match the pattern starting from each candidate
		for (const candidate of candidates) {
			const bindings = new Map<string, string>();

			// Initialize bindings from the first clause
			if (this.isVariable(firstClause.atom)) {
				const varName = this.getVariableName(firstClause.atom);
				bindings.set(varName, candidate.id);
			}

			// Try to extend the match through all clauses
			const match = await this.extendMatch(
				pattern,
				bindings,
				1,
				atomSpaceStub,
			);

			if (match) {
				results.push(match);
			}
		}

		// Sort by score (descending)
		results.sort((a, b) => b.score - a.score);

		return results;
	}

	/**
	 * Extend a partial match by processing the next clause
	 */
	private static async extendMatch(
		pattern: QueryPattern,
		bindings: Map<string, string>,
		clauseIndex: number,
		atomSpaceStub: DurableObjectStub,
	): Promise<MatchResult | null> {
		// Base case: all clauses satisfied
		if (clauseIndex >= pattern.clauses.length) {
			return {
				bindings,
				satisfiedClauses: pattern.clauses.length,
				score: this.calculateScore(bindings, pattern),
			};
		}

		const clause = pattern.clauses[clauseIndex];

		// Get candidates for this clause given current bindings
		const candidates = await this.getCandidatesForClause(
			clause,
			atomSpaceStub,
			bindings,
		);

		// Try each candidate
		for (const candidate of candidates) {
			const newBindings = new Map(bindings);

			// Check if this candidate is consistent with existing bindings
			if (!this.isConsistent(clause, candidate, newBindings)) {
				continue;
			}

			// Add new bindings from this clause
			this.addBindings(clause, candidate, newBindings);

			// Recursively try to match remaining clauses
			const result = await this.extendMatch(
				pattern,
				newBindings,
				clauseIndex + 1,
				atomSpaceStub,
			);

			if (result) {
				return result;
			}
		}

		return null;
	}

	/**
	 * Get candidate atoms for a clause
	 */
	private static async getCandidatesForClause(
		clause: QueryClause,
		atomSpaceStub: DurableObjectStub,
		bindings?: Map<string, string>,
	): Promise<Atom[]> {
		// If the clause specifies a concrete atom, return just that
		if (clause.atom && !this.isVariable(clause.atom)) {
			const atomId = clause.atom as string;
			const response = await atomSpaceStub.fetch(
				new Request(`http://dummy/atom/${atomId}`),
			);
			const data = await response.json();
			return data.success && data.data ? [data.data] : [];
		}

		// If we have bindings for this clause's atom variable, use it
		if (clause.atom && this.isVariable(clause.atom) && bindings) {
			const varName = this.getVariableName(clause.atom);
			const atomId = bindings.get(varName);
			if (atomId) {
				const response = await atomSpaceStub.fetch(
					new Request(`http://dummy/atom/${atomId}`),
				);
				const data = await response.json();
				return data.success && data.data ? [data.data] : [];
			}
		}

		// Query based on clause type
		const query: any = { type: "find_atoms" };

		// Add type constraint if specified
		const variable = this.findVariable(clause, pattern => pattern.variables);
		if (variable && variable.type) {
			query.atomType = variable.type;
		}

		// Query the AtomSpace
		const response = await atomSpaceStub.fetch(
			new Request("http://dummy/query", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(query),
			}),
		);

		const data = await response.json();
		return data.success && data.data ? data.data : [];
	}

	/**
	 * Check if a candidate atom is consistent with existing bindings
	 */
	private static isConsistent(
		clause: QueryClause,
		candidate: Atom,
		bindings: Map<string, string>,
	): boolean {
		// Check clause type constraints
		if (clause.type === "inheritance" && !candidate.type.includes("Link")) {
			return false;
		}

		// Check if any bound variables match
		if (clause.atom && this.isVariable(clause.atom)) {
			const varName = this.getVariableName(clause.atom);
			const boundId = bindings.get(varName);
			if (boundId && boundId !== candidate.id) {
				return false;
			}
		}

		// For links, check outgoing consistency
		if ("outgoing" in candidate && clause.arguments) {
			const link = candidate as Link;
			for (let i = 0; i < clause.arguments.length; i++) {
				const arg = clause.arguments[i];
				if (this.isVariable(arg)) {
					const varName = this.getVariableName(arg);
					const boundId = bindings.get(varName);
					if (boundId && link.outgoing[i] !== boundId) {
						return false;
					}
				} else if (typeof arg === "string") {
					if (link.outgoing[i] !== arg) {
						return false;
					}
				}
			}
		}

		return true;
	}

	/**
	 * Add bindings from a matched clause
	 */
	private static addBindings(
		clause: QueryClause,
		candidate: Atom,
		bindings: Map<string, string>,
	): void {
		// Bind the main atom
		if (clause.atom && this.isVariable(clause.atom)) {
			const varName = this.getVariableName(clause.atom);
			bindings.set(varName, candidate.id);
		}

		// Bind arguments if it's a link
		if ("outgoing" in candidate && clause.arguments) {
			const link = candidate as Link;
			for (let i = 0; i < clause.arguments.length; i++) {
				const arg = clause.arguments[i];
				if (this.isVariable(arg)) {
					const varName = this.getVariableName(arg);
					if (!bindings.has(varName) && link.outgoing[i]) {
						bindings.set(varName, link.outgoing[i]);
					}
				}
			}
		}
	}

	/**
	 * Calculate match score based on truth values and attention
	 */
	private static calculateScore(
		bindings: Map<string, string>,
		pattern: QueryPattern,
	): number {
		// Base score from number of bindings
		let score = bindings.size * 10;

		// Could be enhanced with:
		// - Truth value strength of matched atoms
		// - Attention values (STI) of matched atoms
		// - Pattern complexity bonus
		// - Semantic similarity scores

		return score;
	}

	/**
	 * Check if a value is a variable binding
	 */
	private static isVariable(
		value: string | VariableBinding | undefined,
	): boolean {
		if (!value) return false;
		if (typeof value === "string") {
			return value.startsWith("$") || value.startsWith("?");
		}
		return "name" in value;
	}

	/**
	 * Get variable name from a variable binding
	 */
	private static getVariableName(value: string | VariableBinding): string {
		if (typeof value === "string") {
			return value.replace(/^[$?]/, "");
		}
		return value.name;
	}

	/**
	 * Find variable definition in pattern
	 */
	private static findVariable(
		clause: QueryClause,
		getVariables: (pattern: any) => VariableBinding[],
	): VariableBinding | undefined {
		// This is a simplified version - would need access to full pattern
		return undefined;
	}

	/**
	 * Compile a pattern for efficient matching
	 */
	static compilePattern(pattern: QueryPattern): CompiledPattern {
		return {
			pattern,
			variableCount: pattern.variables.length,
			clauseCount: pattern.clauses.length,
			complexity: this.calculateComplexity(pattern),
			optimizedOrder: this.optimizeClauseOrder(pattern),
		};
	}

	/**
	 * Calculate pattern complexity for optimization
	 */
	private static calculateComplexity(pattern: QueryPattern): number {
		let complexity = 0;

		// More variables = more complex
		complexity += pattern.variables.length * 2;

		// More clauses = more complex
		complexity += pattern.clauses.length * 3;

		// Nested patterns = more complex
		for (const clause of pattern.clauses) {
			if (clause.arguments && clause.arguments.length > 0) {
				complexity += clause.arguments.length;
			}
		}

		return complexity;
	}

	/**
	 * Optimize clause ordering for efficient matching
	 */
	private static optimizeClauseOrder(pattern: QueryPattern): number[] {
		// Start with most constrained clauses (fewest candidates)
		// This is a simplified heuristic - real implementation would be more sophisticated
		return pattern.clauses.map((_, i) => i);
	}
}

export interface CompiledPattern {
	pattern: QueryPattern;
	variableCount: number;
	clauseCount: number;
	complexity: number;
	optimizedOrder: number[];
}
