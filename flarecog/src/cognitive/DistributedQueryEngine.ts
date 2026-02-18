import {
	Env,
	Atom,
	AtomSpaceQuery,
	QueryPattern,
} from "../types/cognitive";
import { IStorageNode } from "../durable-objects/StorageNode";
import { PatternMatcher, PatternMatchResult } from "./PatternMatcher";

/**
 * Distributed Query Engine
 * 
 * Coordinates queries across multiple AtomSpace instances in a distributed
 * architecture, implementing the DAS query coordination pattern.
 */

export interface DistributedQueryConfig {
	localFirst: boolean; // Query local AtomSpace before remote
	mergeStrategy: "union" | "intersection" | "ranked";
	maxRemoteQueries: number;
	timeout: number; // milliseconds
	cacheResults: boolean;
}

export interface QueryResult {
	atoms: Atom[];
	sources: Map<string, number>; // source -> atom count
	executionTime: number;
	fromCache: boolean;
}

export interface DistributedPatternMatchResult extends PatternMatchResult {
	sources: Map<string, number>;
	partialResults: Map<string, PatternMatchResult>;
}

/**
 * DistributedQueryEngine - Coordinates queries across distributed AtomSpaces
 */
export class DistributedQueryEngine {
	private patternMatcher: PatternMatcher;
	private providers: Map<string, IStorageNode> = new Map();
	private queryCache: Map<string, { result: QueryResult; timestamp: number }> =
		new Map();

	private defaultConfig: DistributedQueryConfig = {
		localFirst: true,
		mergeStrategy: "ranked",
		maxRemoteQueries: 5,
		timeout: 5000,
		cacheResults: true,
	};

	constructor(private env: Env) {
		this.patternMatcher = new PatternMatcher(env);
	}

	/**
	 * Register a provider AtomSpace
	 */
	registerProvider(name: string, provider: IStorageNode): void {
		this.providers.set(name, provider);
	}

	/**
	 * Unregister a provider AtomSpace
	 */
	unregisterProvider(name: string): void {
		this.providers.delete(name);
	}

	/**
	 * Execute a distributed query across all providers
	 */
	async query(
		query: AtomSpaceQuery,
		config?: Partial<DistributedQueryConfig>
	): Promise<QueryResult> {
		const startTime = Date.now();
		const mergedConfig = { ...this.defaultConfig, ...config };

		// Check cache first
		if (mergedConfig.cacheResults) {
			const cached = this.getCachedResult(query);
			if (cached) {
				return {
					...cached,
					fromCache: true,
				};
			}
		}

		// Execute query on all providers
		const providerQueries: Promise<{ name: string; atoms: Atom[] }>[] = [];

		for (const [name, provider] of this.providers) {
			if (providerQueries.length >= mergedConfig.maxRemoteQueries) {
				break;
			}

			const queryPromise = Promise.race([
				provider.queryAtoms(query).then((atoms) => ({ name, atoms })),
				this.timeout(mergedConfig.timeout).then(() => ({ name, atoms: [] })),
			]);

			providerQueries.push(queryPromise);
		}

		// Wait for all queries to complete
		const results = await Promise.all(providerQueries);

		// Merge results based on strategy
		const merged = this.mergeResults(results, mergedConfig.mergeStrategy);

		const queryResult: QueryResult = {
			atoms: merged.atoms,
			sources: merged.sources,
			executionTime: Date.now() - startTime,
			fromCache: false,
		};

		// Cache result
		if (mergedConfig.cacheResults) {
			this.cacheResult(query, queryResult);
		}

		return queryResult;
	}

	/**
	 * Execute a distributed pattern match
	 */
	async patternMatch(
		pattern: QueryPattern,
		atomspaceStubs: Map<string, DurableObjectStub>,
		config?: Partial<DistributedQueryConfig>
	): Promise<DistributedPatternMatchResult> {
		const startTime = Date.now();
		const mergedConfig = { ...this.defaultConfig, ...config };

		// Execute pattern match on each AtomSpace
		const matchPromises: Promise<{
			name: string;
			result: PatternMatchResult;
		}>[] = [];

		for (const [name, stub] of atomspaceStubs) {
			if (matchPromises.length >= mergedConfig.maxRemoteQueries) {
				break;
			}

			const matchPromise = Promise.race([
				this.patternMatcher
					.match(pattern, stub, false)
					.then((result) => ({ name, result })),
				this.timeout(mergedConfig.timeout).then(() => ({
					name,
					result: {
						matches: [],
						confidence: 0,
						executionTime: mergedConfig.timeout,
						nodesExamined: 0,
					},
				})),
			]);

			matchPromises.push(matchPromise);
		}

		// Wait for all matches
		const matchResults = await Promise.all(matchPromises);

		// Merge pattern match results
		const allMatches: Map<string, Atom>[] = [];
		const sources = new Map<string, number>();
		const partialResults = new Map<string, PatternMatchResult>();
		let totalNodesExamined = 0;

		for (const { name, result } of matchResults) {
			allMatches.push(...result.matches);
			sources.set(name, result.matches.length);
			partialResults.set(name, result);
			totalNodesExamined += result.nodesExamined;
		}

		// Deduplicate matches by atom ID
		const uniqueMatches = this.deduplicateMatches(allMatches);

		return {
			matches: uniqueMatches,
			confidence: this.calculateAggregateConfidence(matchResults),
			executionTime: Date.now() - startTime,
			nodesExamined: totalNodesExamined,
			sources,
			partialResults,
		};
	}

	/**
	 * Execute a federated query that combines results from multiple sources
	 */
	async federatedQuery(
		queries: Map<string, AtomSpaceQuery>,
		config?: Partial<DistributedQueryConfig>
	): Promise<QueryResult> {
		const startTime = Date.now();
		const mergedConfig = { ...this.defaultConfig, ...config };

		// Execute each query on its designated provider
		const queryPromises: Promise<{ name: string; atoms: Atom[] }>[] = [];

		for (const [providerName, query] of queries) {
			const provider = this.providers.get(providerName);
			if (!provider) continue;

			const queryPromise = Promise.race([
				provider.queryAtoms(query).then((atoms) => ({ name: providerName, atoms })),
				this.timeout(mergedConfig.timeout).then(() => ({
					name: providerName,
					atoms: [],
				})),
			]);

			queryPromises.push(queryPromise);
		}

		// Wait for all queries
		const results = await Promise.all(queryPromises);

		// Merge results
		const merged = this.mergeResults(results, mergedConfig.mergeStrategy);

		return {
			atoms: merged.atoms,
			sources: merged.sources,
			executionTime: Date.now() - startTime,
			fromCache: false,
		};
	}

	/**
	 * Get statistics about the distributed query engine
	 */
	getStats(): {
		providerCount: number;
		cacheSize: number;
		cacheHitRate: number;
	} {
		return {
			providerCount: this.providers.size,
			cacheSize: this.queryCache.size,
			cacheHitRate: 0, // Would need to track hits/misses
		};
	}

	/**
	 * Clear query cache
	 */
	clearCache(): void {
		this.queryCache.clear();
	}

	// Private helper methods

	private mergeResults(
		results: { name: string; atoms: Atom[] }[],
		strategy: "union" | "intersection" | "ranked"
	): { atoms: Atom[]; sources: Map<string, number> } {
		const sources = new Map<string, number>();

		for (const { name, atoms } of results) {
			sources.set(name, atoms.length);
		}

		switch (strategy) {
			case "union":
				return this.mergeUnion(results, sources);

			case "intersection":
				return this.mergeIntersection(results, sources);

			case "ranked":
				return this.mergeRanked(results, sources);

			default:
				return this.mergeUnion(results, sources);
		}
	}

	private mergeUnion(
		results: { name: string; atoms: Atom[] }[],
		sources: Map<string, number>
	): { atoms: Atom[]; sources: Map<string, number> } {
		const atomMap = new Map<string, Atom>();

		for (const { atoms } of results) {
			for (const atom of atoms) {
				if (!atomMap.has(atom.id)) {
					atomMap.set(atom.id, atom);
				}
			}
		}

		return {
			atoms: Array.from(atomMap.values()),
			sources,
		};
	}

	private mergeIntersection(
		results: { name: string; atoms: Atom[] }[],
		sources: Map<string, number>
	): { atoms: Atom[]; sources: Map<string, number> } {
		if (results.length === 0) {
			return { atoms: [], sources };
		}

		// Find atoms that appear in all result sets
		const atomCounts = new Map<string, number>();

		for (const { atoms } of results) {
			for (const atom of atoms) {
				atomCounts.set(atom.id, (atomCounts.get(atom.id) || 0) + 1);
			}
		}

		// Keep only atoms that appear in all results
		const intersection: Atom[] = [];
		const firstResult = results[0].atoms;

		for (const atom of firstResult) {
			if (atomCounts.get(atom.id) === results.length) {
				intersection.push(atom);
			}
		}

		return {
			atoms: intersection,
			sources,
		};
	}

	private mergeRanked(
		results: { name: string; atoms: Atom[] }[],
		sources: Map<string, number>
	): { atoms: Atom[]; sources: Map<string, number> } {
		// Merge and rank by relevance score
		const atomScores = new Map<string, { atom: Atom; score: number }>();

		for (const { atoms } of results) {
			for (const atom of atoms) {
				const score = this.calculateRelevanceScore(atom);

				if (!atomScores.has(atom.id)) {
					atomScores.set(atom.id, { atom, score });
				} else {
					// Boost score if atom appears in multiple sources
					const existing = atomScores.get(atom.id)!;
					existing.score = Math.max(existing.score, score) * 1.1;
				}
			}
		}

		// Sort by score descending
		const ranked = Array.from(atomScores.values())
			.sort((a, b) => b.score - a.score)
			.map((entry) => entry.atom);

		return {
			atoms: ranked,
			sources,
		};
	}

	private calculateRelevanceScore(atom: Atom): number {
		// Combine truth value and attention for relevance
		const tvScore = atom.truthValue.strength * atom.truthValue.confidence;
		const attScore = atom.attentionValue.sti / 100;
		return tvScore * 0.6 + attScore * 0.4;
	}

	private deduplicateMatches(
		matches: Map<string, Atom>[]
	): Map<string, Atom>[] {
		const seen = new Set<string>();
		const unique: Map<string, Atom>[] = [];

		for (const match of matches) {
			// Create a signature for this match
			const signature = Array.from(match.keys())
				.sort()
				.map((key) => `${key}:${match.get(key)!.id}`)
				.join("|");

			if (!seen.has(signature)) {
				seen.add(signature);
				unique.push(match);
			}
		}

		return unique;
	}

	private calculateAggregateConfidence(
		results: { name: string; result: PatternMatchResult }[]
	): number {
		if (results.length === 0) return 0;

		const avgConfidence =
			results.reduce((sum, r) => sum + r.result.confidence, 0) / results.length;

		// Boost confidence if multiple sources agree
		const agreementBoost = Math.min(results.length / 5, 0.2);

		return Math.min(avgConfidence + agreementBoost, 1.0);
	}

	private getCachedResult(query: AtomSpaceQuery): QueryResult | null {
		const key = this.queryCacheKey(query);
		const cached = this.queryCache.get(key);

		if (!cached) return null;

		// Check if cache is still valid (5 minutes)
		const age = Date.now() - cached.timestamp;
		if (age > 300000) {
			this.queryCache.delete(key);
			return null;
		}

		return cached.result;
	}

	private cacheResult(query: AtomSpaceQuery, result: QueryResult): void {
		const key = this.queryCacheKey(query);
		this.queryCache.set(key, {
			result,
			timestamp: Date.now(),
		});

		// Limit cache size
		if (this.queryCache.size > 100) {
			// Remove oldest entry
			const oldest = Array.from(this.queryCache.entries()).sort(
				(a, b) => a[1].timestamp - b[1].timestamp
			)[0];
			this.queryCache.delete(oldest[0]);
		}
	}

	private queryCacheKey(query: AtomSpaceQuery): string {
		return JSON.stringify(query);
	}

	private timeout(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
