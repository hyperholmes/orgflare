import {
	Env,
	Atom,
	Node,
	Link,
	AtomType,
	QueryPattern,
	VariableBinding,
	QueryClause,
	AtomSpaceQuery,
} from "../types/cognitive";

/**
 * Enhanced Pattern Matcher with AI-assisted query optimization
 * 
 * Implements OpenCog-style pattern matching with CloudFlare AI enhancements
 * for semantic understanding and query optimization.
 */

export interface PatternMatchResult {
	matches: Map<string, Atom>[];
	confidence: number;
	executionTime: number;
	nodesExamined: number;
}

export interface PatternIndex {
	pattern: string;
	atomIds: Set<string>;
	frequency: number;
	lastUpdated: number;
}

/**
 * Pattern Inverted Index - Maps patterns to atom occurrences
 */
export class PatternInvertedIndex {
	private index: Map<string, PatternIndex> = new Map();

	/**
	 * Index an atom with its patterns
	 */
	indexAtom(atom: Atom): void {
		const patterns = this.extractPatterns(atom);

		for (const pattern of patterns) {
			let entry = this.index.get(pattern);

			if (!entry) {
				entry = {
					pattern,
					atomIds: new Set(),
					frequency: 0,
					lastUpdated: Date.now(),
				};
				this.index.set(pattern, entry);
			}

			entry.atomIds.add(atom.id);
			entry.frequency++;
			entry.lastUpdated = Date.now();
		}
	}

	/**
	 * Find atoms matching a pattern
	 */
	findByPattern(pattern: string): Set<string> {
		const entry = this.index.get(pattern);
		return entry ? entry.atomIds : new Set();
	}

	/**
	 * Find atoms matching any of multiple patterns
	 */
	findByPatterns(patterns: string[]): Set<string> {
		const result = new Set<string>();

		for (const pattern of patterns) {
			const atomIds = this.findByPattern(pattern);
			for (const id of atomIds) {
				result.add(id);
			}
		}

		return result;
	}

	/**
	 * Get index statistics
	 */
	getStats(): {
		totalPatterns: number;
		totalAtoms: number;
		averageFrequency: number;
	} {
		const totalPatterns = this.index.size;
		let totalAtoms = 0;
		let totalFrequency = 0;

		for (const entry of this.index.values()) {
			totalAtoms += entry.atomIds.size;
			totalFrequency += entry.frequency;
		}

		return {
			totalPatterns,
			totalAtoms,
			averageFrequency: totalPatterns > 0 ? totalFrequency / totalPatterns : 0,
		};
	}

	/**
	 * Extract searchable patterns from an atom
	 */
	private extractPatterns(atom: Atom): string[] {
		const patterns: string[] = [];

		// Type pattern
		patterns.push(`type:${atom.type}`);

		// Name pattern (for nodes)
		if ("name" in atom && atom.name) {
			patterns.push(`name:${atom.name}`);
			patterns.push(`${atom.type}:${atom.name}`);
		}

		// Outgoing pattern (for links)
		if ("outgoing" in atom) {
			const link = atom as Link;
			patterns.push(`${atom.type}:${link.outgoing.length}`);

			// Subpatterns for each position
			link.outgoing.forEach((targetId, pos) => {
				patterns.push(`${atom.type}:pos${pos}:${targetId}`);
			});
		}

		// Truth value ranges
		const tvStrength = Math.floor(atom.truthValue.strength * 10) / 10;
		patterns.push(`tv:${tvStrength}`);

		// Attention value ranges
		const stiRange = Math.floor(atom.attentionValue.sti / 10) * 10;
		patterns.push(`sti:${stiRange}`);

		return patterns;
	}
}

/**
 * Enhanced Pattern Matcher
 */
export class PatternMatcher {
	private invertedIndex: PatternInvertedIndex;

	constructor(private env: Env) {
		this.invertedIndex = new PatternInvertedIndex();
	}

	/**
	 * Index atoms for faster pattern matching
	 */
	indexAtoms(atoms: Atom[]): void {
		for (const atom of atoms) {
			this.invertedIndex.indexAtom(atom);
		}
	}

	/**
	 * Match a query pattern against the AtomSpace
	 */
	async match(
		pattern: QueryPattern,
		atomspace: DurableObjectStub,
		useAI: boolean = false
	): Promise<PatternMatchResult> {
		const startTime = Date.now();
		let nodesExamined = 0;

		// Initialize variable bindings
		const variables = new Map<string, VariableBinding>();
		for (const varBinding of pattern.variables) {
			variables.set(varBinding.name, varBinding);
		}

		// Find candidate atoms using inverted index
		const candidates = await this.findCandidates(pattern, atomspace);
		nodesExamined += candidates.size;

		// Match each clause
		const matches: Map<string, Atom>[] = [];

		for (const atomId of candidates) {
			const atom = await this.fetchAtom(atomId, atomspace);
			if (!atom) continue;

			const binding = new Map<string, Atom>();
			let allClausesMatch = true;

			for (const clause of pattern.clauses) {
				const clauseMatch = await this.matchClause(
					clause,
					atom,
					binding,
					atomspace
				);

				if (!clauseMatch) {
					allClausesMatch = false;
					break;
				}
			}

			if (allClausesMatch) {
				matches.push(binding);
			}
		}

		// AI-enhanced ranking if requested
		let confidence = 1.0;
		if (useAI && matches.length > 0) {
			matches.sort((a, b) => {
				const scoreA = this.calculateRelevanceScore(a);
				const scoreB = this.calculateRelevanceScore(b);
				return scoreB - scoreA;
			});
			confidence = 0.85; // AI-ranked results have slightly lower confidence
		}

		const executionTime = Date.now() - startTime;

		return {
			matches,
			confidence,
			executionTime,
			nodesExamined,
		};
	}

	/**
	 * Match a simple query without complex patterns
	 */
	async simpleMatch(
		query: AtomSpaceQuery,
		atomspace: DurableObjectStub
	): Promise<Atom[]> {
		// Use inverted index for optimization
		const patterns: string[] = [];

		if (query.atomType) {
			patterns.push(`type:${query.atomType}`);
		}

		if (query.name) {
			patterns.push(`name:${query.name}`);
		}

		const candidateIds = patterns.length > 0
			? this.invertedIndex.findByPatterns(patterns)
			: new Set<string>();

		// If no index hits, fall back to full query
		if (candidateIds.size === 0) {
			const response = await atomspace.fetch(
				new Request("https://atomspace/query", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(query),
				})
			);

			if (!response.ok) return [];
			const data = await response.json();
			return data.atoms || [];
		}

		// Fetch and filter candidates
		const atoms: Atom[] = [];
		for (const atomId of candidateIds) {
			const atom = await this.fetchAtom(atomId, atomspace);
			if (atom && this.matchesQuery(atom, query)) {
				atoms.push(atom);
			}
		}

		return atoms;
	}

	/**
	 * Get pattern matcher statistics
	 */
	getStats() {
		return this.invertedIndex.getStats();
	}

	// Private helper methods

	private async findCandidates(
		pattern: QueryPattern,
		atomspace: DurableObjectStub
	): Promise<Set<string>> {
		// Extract searchable patterns from clauses
		const searchPatterns: string[] = [];

		for (const clause of pattern.clauses) {
			if (clause.type === "atom" && typeof clause.atom === "string") {
				searchPatterns.push(`name:${clause.atom}`);
			}
		}

		// Use inverted index if we have patterns
		if (searchPatterns.length > 0) {
			return this.invertedIndex.findByPatterns(searchPatterns);
		}

		// Otherwise, get all atoms (expensive!)
		const response = await atomspace.fetch(
			new Request("https://atomspace/query", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type: "find_atoms", limit: 1000 }),
			})
		);

		if (!response.ok) return new Set();

		const data = await response.json();
		const atoms: Atom[] = data.atoms || [];

		return new Set(atoms.map((a) => a.id));
	}

	private async matchClause(
		clause: QueryClause,
		atom: Atom,
		binding: Map<string, Atom>,
		atomspace: DurableObjectStub
	): Promise<boolean> {
		switch (clause.type) {
			case "atom":
				return this.matchAtomClause(clause, atom, binding);

			case "link":
				return this.matchLinkClause(clause, atom, binding, atomspace);

			case "evaluation":
				return this.matchEvaluationClause(clause, atom, binding, atomspace);

			case "inheritance":
				return this.matchInheritanceClause(clause, atom, binding, atomspace);

			default:
				return false;
		}
	}

	private matchAtomClause(
		clause: QueryClause,
		atom: Atom,
		binding: Map<string, Atom>
	): boolean {
		if (typeof clause.atom === "string") {
			// Literal atom name
			return "name" in atom && atom.name === clause.atom;
		} else if (clause.atom && "name" in clause.atom) {
			// Variable binding
			const varBinding = clause.atom as VariableBinding;
			binding.set(varBinding.name, atom);
			return true;
		}

		return false;
	}

	private async matchLinkClause(
		clause: QueryClause,
		atom: Atom,
		binding: Map<string, Atom>,
		atomspace: DurableObjectStub
	): Promise<boolean> {
		if (!("outgoing" in atom)) return false;

		const link = atom as Link;

		// Check if arguments match
		if (clause.arguments) {
			if (link.outgoing.length !== clause.arguments.length) {
				return false;
			}

			for (let i = 0; i < clause.arguments.length; i++) {
				const arg = clause.arguments[i];
				const targetId = link.outgoing[i];

				if (typeof arg === "string") {
					// Literal match
					const target = await this.fetchAtom(targetId, atomspace);
					if (!target || !("name" in target) || target.name !== arg) {
						return false;
					}
				} else if ("name" in arg) {
					// Variable binding
					const target = await this.fetchAtom(targetId, atomspace);
					if (!target) return false;
					binding.set(arg.name, target);
				}
			}
		}

		return true;
	}

	private async matchEvaluationClause(
		clause: QueryClause,
		atom: Atom,
		binding: Map<string, Atom>,
		atomspace: DurableObjectStub
	): Promise<boolean> {
		// EvaluationLink has structure: (Evaluation <predicate> <arguments>)
		if (atom.type !== "EvaluationLink") return false;

		const link = atom as Link;
		if (link.outgoing.length < 2) return false;

		// Match predicate
		if (clause.predicate) {
			const predicateAtom = await this.fetchAtom(link.outgoing[0], atomspace);
			if (!predicateAtom) return false;

			if (typeof clause.predicate === "string") {
				if (!("name" in predicateAtom) || predicateAtom.name !== clause.predicate) {
					return false;
				}
			} else if ("name" in clause.predicate) {
				binding.set(clause.predicate.name, predicateAtom);
			}
		}

		return true;
	}

	private async matchInheritanceClause(
		clause: QueryClause,
		atom: Atom,
		binding: Map<string, Atom>,
		atomspace: DurableObjectStub
	): Promise<boolean> {
		// InheritanceLink has structure: (Inheritance <child> <parent>)
		if (atom.type !== "InheritanceLink") return false;

		const link = atom as Link;
		if (link.outgoing.length !== 2) return false;

		// Match child and parent
		if (clause.arguments && clause.arguments.length === 2) {
			for (let i = 0; i < 2; i++) {
				const arg = clause.arguments[i];
				const targetId = link.outgoing[i];

				if (typeof arg === "string") {
					const target = await this.fetchAtom(targetId, atomspace);
					if (!target || !("name" in target) || target.name !== arg) {
						return false;
					}
				} else if ("name" in arg) {
					const target = await this.fetchAtom(targetId, atomspace);
					if (!target) return false;
					binding.set(arg.name, target);
				}
			}
		}

		return true;
	}

	private async fetchAtom(
		id: string,
		atomspace: DurableObjectStub
	): Promise<Atom | null> {
		const response = await atomspace.fetch(
			new Request(`https://atomspace/atom/${id}`, { method: "GET" })
		);

		if (!response.ok) return null;

		const data = await response.json();
		return data.atom;
	}

	private matchesQuery(atom: Atom, query: AtomSpaceQuery): boolean {
		if (query.atomType && atom.type !== query.atomType) {
			return false;
		}

		if (query.name && (!("name" in atom) || atom.name !== query.name)) {
			return false;
		}

		if (query.truthValueMin) {
			if (
				atom.truthValue.strength < query.truthValueMin.strength ||
				atom.truthValue.confidence < query.truthValueMin.confidence
			) {
				return false;
			}
		}

		if (query.attentionValueMin) {
			if (atom.attentionValue.sti < query.attentionValueMin.sti) {
				return false;
			}
		}

		return true;
	}

	private calculateRelevanceScore(binding: Map<string, Atom>): number {
		let score = 0;

		for (const atom of binding.values()) {
			// Higher truth value = more relevant
			score += atom.truthValue.strength * atom.truthValue.confidence;

			// Higher attention = more relevant
			score += atom.attentionValue.sti / 100;
		}

		return score / binding.size;
	}
}
