/**
 * Enhanced Distributed Query Engine
 * 
 * DAS-inspired distributed query processing for FlareCog
 * Implements traverse engine, sophisticated caching, and relevance-based result ranking
 * Optimized for Cloudflare Workers edge computing
 */

import { Atom, Link, Node, TruthValue, AttentionValue, KVNamespace } from '../../types/cognitive-v5';

export interface QueryPattern {
  type: string;
  variables: Map<string, string>;
  constraints: QueryConstraint[];
  maxResults?: number;
  relevanceThreshold?: number;
}

export interface QueryConstraint {
  type: 'type' | 'truth' | 'attention' | 'topology' | 'boolean';
  field?: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'and' | 'or' | 'not';
  value?: any;
  subConstraints?: QueryConstraint[];
}

export interface QueryResult {
  atoms: Atom[];
  bindings: Map<string, Atom>[];
  relevanceScores: number[];
  totalMatches: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface TraverseOptions {
  direction: 'incoming' | 'outgoing' | 'both';
  maxDepth: number;
  filterTypes?: string[];
  minAttention?: number;
  preFetch?: boolean;
}

export interface CacheEntry {
  key: string;
  results: Atom[];
  bindings: Map<string, Atom>[];
  relevanceScores: number[];
  timestamp: number;
  hitCount: number;
  partitions: CachePartition[];
}

export interface CachePartition {
  relevanceRange: [number, number];
  atoms: Atom[];
  bindings: Map<string, Atom>[];
}

/**
 * Enhanced Distributed Query Engine
 * Implements DAS-style distributed query processing with Cloudflare optimization
 */
export class EnhancedDistributedQueryEngine {
  private cache: Map<string, CacheEntry>;
  private cacheMaxSize: number;
  private cacheMaxAge: number;
  private remoteNodes: Map<string, string>; // node_id -> endpoint
  
  constructor(
    private kv: KVNamespace,
    private env: any,
    cacheMaxSize: number = 1000,
    cacheMaxAge: number = 3600000 // 1 hour
  ) {
    this.cache = new Map();
    this.cacheMaxSize = cacheMaxSize;
    this.cacheMaxAge = cacheMaxAge;
    this.remoteNodes = new Map();
  }

  /**
   * Traverse Engine - Navigate hypergraph with pre-fetching
   */
  async traverse(
    startAtom: Atom,
    options: TraverseOptions
  ): Promise<Atom[]> {
    const visited = new Set<string>();
    const results: Atom[] = [];
    const queue: Array<{ atom: Atom; depth: number }> = [{ atom: startAtom, depth: 0 }];

    while (queue.length > 0) {
      const { atom, depth } = queue.shift()!;
      
      if (visited.has(atom.id) || depth > options.maxDepth) {
        continue;
      }
      
      visited.add(atom.id);
      
      // Apply filters
      if (options.filterTypes && !options.filterTypes.includes(atom.type)) {
        continue;
      }
      
      if (options.minAttention && atom.attentionValue.sti < options.minAttention) {
        continue;
      }
      
      results.push(atom);
      
      // Get connected atoms
      const connected = await this.getConnectedAtoms(atom, options.direction);
      
      // Pre-fetch surrounding atoms if requested
      if (options.preFetch && depth < options.maxDepth - 1) {
        await this.preFetchNeighborhood(connected);
      }
      
      // Add to queue
      for (const connectedAtom of connected) {
        if (!visited.has(connectedAtom.id)) {
          queue.push({ atom: connectedAtom, depth: depth + 1 });
        }
      }
    }
    
    return results;
  }

  /**
   * Get atoms connected to the given atom
   */
  private async getConnectedAtoms(
    atom: Atom,
    direction: 'incoming' | 'outgoing' | 'both'
  ): Promise<Atom[]> {
    const cacheKey = `connected:${atom.id}:${direction}`;
    
    // Check cache first
    const cached = await this.kv.get(cacheKey, 'json');
    if (cached) {
      return cached as Atom[];
    }
    
    const connected: Atom[] = [];
    
    // Query local AtomSpace
    if (direction === 'outgoing' || direction === 'both') {
      const outgoing = await this.queryLocalOutgoing(atom);
      connected.push(...outgoing);
    }
    
    if (direction === 'incoming' || direction === 'both') {
      const incoming = await this.queryLocalIncoming(atom);
      connected.push(...incoming);
    }
    
    // Cache results
    await this.kv.put(cacheKey, JSON.stringify(connected), { expirationTtl: 300 });
    
    return connected;
  }

  /**
   * Pre-fetch neighborhood atoms for faster traversal
   */
  private async preFetchNeighborhood(atoms: Atom[]): Promise<void> {
    const prefetchPromises = atoms.map(async (atom) => {
      const cacheKey = `atom:${atom.id}`;
      const cached = await this.kv.get(cacheKey);
      if (!cached) {
        await this.kv.put(cacheKey, JSON.stringify(atom), { expirationTtl: 300 });
      }
    });
    
    await Promise.all(prefetchPromises);
  }

  /**
   * Execute distributed query with pattern matching
   */
  async executeQuery(
    pattern: QueryPattern,
    includeRemote: boolean = true
  ): Promise<QueryResult> {
    const cacheKey = this.generateCacheKey(pattern);
    
    // Check sophisticated cache
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      return this.buildQueryResult(cachedResult, pattern.maxResults);
    }
    
    // Execute local query
    const localResults = await this.executeLocalQuery(pattern);
    
    // Execute remote queries if requested
    let remoteResults: Array<{ atoms: Atom[]; bindings: Map<string, Atom>[] }> = [];
    if (includeRemote && this.remoteNodes.size > 0) {
      remoteResults = await this.executeRemoteQueries(pattern);
    }
    
    // Merge and rank results
    const mergedResults = this.mergeResults(localResults, remoteResults);
    const rankedResults = this.rankByRelevance(mergedResults, pattern);
    
    // Cache results with partitioning
    const cacheEntry = this.cacheResults(cacheKey, rankedResults);
    
    return this.buildQueryResult(cacheEntry, pattern.maxResults);
  }

  /**
   * Execute pattern matching on local AtomSpace
   */
  private async executeLocalQuery(
    pattern: QueryPattern
  ): Promise<{ atoms: Atom[]; bindings: Map<string, Atom>[] }> {
    // Get candidate atoms using inverted index
    const candidates = await this.getCandidatesFromIndex(pattern);
    
    const matchedAtoms: Atom[] = [];
    const bindings: Map<string, Atom>[] = [];
    
    for (const candidate of candidates) {
      const binding = this.matchPattern(candidate, pattern);
      if (binding) {
        matchedAtoms.push(candidate);
        bindings.push(binding);
      }
    }
    
    return { atoms: matchedAtoms, bindings };
  }

  /**
   * Get candidate atoms from pattern inverted index
   */
  private async getCandidatesFromIndex(pattern: QueryPattern): Promise<Atom[]> {
    const indexKey = `pattern_index:${pattern.type}`;
    const indexData = await this.kv.get(indexKey, 'json');
    
    if (!indexData) {
      // Fallback to full scan (should build index)
      return this.getAllAtoms();
    }
    
    return (indexData as any).atoms || [];
  }

  /**
   * Match atom against pattern with variable binding
   */
  private matchPattern(
    atom: Atom,
    pattern: QueryPattern
  ): Map<string, Atom> | null {
    const bindings = new Map<string, Atom>();
    
    // Type matching
    if (pattern.type !== '*' && atom.type !== pattern.type) {
      return null;
    }
    
    // Variable binding
    for (const [varName, varType] of pattern.variables.entries()) {
      if (varType === '*' || atom.type === varType) {
        bindings.set(varName, atom);
      }
    }
    
    // Constraint evaluation
    for (const constraint of pattern.constraints) {
      if (!this.evaluateConstraint(atom, constraint, bindings)) {
        return null;
      }
    }
    
    return bindings;
  }

  /**
   * Evaluate constraint against atom
   */
  private evaluateConstraint(
    atom: Atom,
    constraint: QueryConstraint,
    bindings: Map<string, Atom>
  ): boolean {
    switch (constraint.type) {
      case 'type':
        return this.evaluateTypeConstraint(atom, constraint);
      case 'truth':
        return this.evaluateTruthConstraint(atom, constraint);
      case 'attention':
        return this.evaluateAttentionConstraint(atom, constraint);
      case 'topology':
        return this.evaluateTopologyConstraint(atom, constraint);
      case 'boolean':
        return this.evaluateBooleanConstraint(atom, constraint, bindings);
      default:
        return true;
    }
  }

  private evaluateTypeConstraint(atom: Atom, constraint: QueryConstraint): boolean {
    return constraint.operator === 'eq' 
      ? atom.type === constraint.value
      : atom.type !== constraint.value;
  }

  private evaluateTruthConstraint(atom: Atom, constraint: QueryConstraint): boolean {
    if (!atom.truthValue) return false;
    
    const value = constraint.field === 'strength' 
      ? atom.truthValue.strength 
      : atom.truthValue.confidence;
    
    return this.compareValues(value, constraint.operator, constraint.value);
  }

  private evaluateAttentionConstraint(atom: Atom, constraint: QueryConstraint): boolean {
    if (!atom.attentionValue) return false;
    
    let value: number;
    switch (constraint.field) {
      case 'sti': value = atom.attentionValue.sti; break;
      case 'lti': value = atom.attentionValue.lti; break;
      case 'vlti': value = atom.attentionValue.vlti; break;
      default: return false;
    }
    
    return this.compareValues(value, constraint.operator, constraint.value);
  }

  private evaluateTopologyConstraint(atom: Atom, constraint: QueryConstraint): boolean {
    // Check if atom has specific topological properties
    // e.g., number of incoming/outgoing links, connectivity patterns
    return true; // Stub for now
  }

  private evaluateBooleanConstraint(
    atom: Atom,
    constraint: QueryConstraint,
    bindings: Map<string, Atom>
  ): boolean {
    if (!constraint.subConstraints) return true;
    
    switch (constraint.operator) {
      case 'and':
        return constraint.subConstraints.every(sub => 
          this.evaluateConstraint(atom, sub, bindings)
        );
      case 'or':
        return constraint.subConstraints.some(sub => 
          this.evaluateConstraint(atom, sub, bindings)
        );
      case 'not':
        return !this.evaluateConstraint(atom, constraint.subConstraints[0], bindings);
      default:
        return true;
    }
  }

  private compareValues(
    actual: number,
    operator: string,
    expected: number
  ): boolean {
    switch (operator) {
      case 'eq': return actual === expected;
      case 'gt': return actual > expected;
      case 'lt': return actual < expected;
      case 'gte': return actual >= expected;
      case 'lte': return actual <= expected;
      default: return false;
    }
  }

  /**
   * Execute queries on remote DAS nodes
   */
  private async executeRemoteQueries(
    pattern: QueryPattern
  ): Promise<Array<{ atoms: Atom[]; bindings: Map<string, Atom>[] }>> {
    const remotePromises = Array.from(this.remoteNodes.entries()).map(
      async ([nodeId, endpoint]) => {
        try {
          const response = await fetch(`${endpoint}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pattern)
          });
          
          if (!response.ok) {
            console.error(`Remote query failed for node ${nodeId}`);
            return { atoms: [], bindings: [] };
          }
          
          return await response.json() as { atoms: Atom[]; bindings: Map<string, Atom>[] };
        } catch (error) {
          console.error(`Error querying remote node ${nodeId}:`, error);
          return { atoms: [] as Atom[], bindings: [] as Map<string, Atom>[] };
        }
      }
    );

    return await Promise.all(remotePromises);
  }

  /**
   * Merge local and remote results, preferring local versions
   */
  private mergeResults(
    local: { atoms: Atom[]; bindings: Map<string, Atom>[] },
    remote: Array<{ atoms: Atom[]; bindings: Map<string, Atom>[] }>
  ): { atoms: Atom[]; bindings: Map<string, Atom>[] } {
    const atomMap = new Map<string, Atom>();
    const bindingsArray: Map<string, Atom>[] = [];
    
    // Add local results first (they take precedence)
    for (let i = 0; i < local.atoms.length; i++) {
      const atom = local.atoms[i];
      atomMap.set(atom.id, atom);
      bindingsArray.push(local.bindings[i]);
    }
    
    // Add remote results if not already present
    for (const remoteResult of remote) {
      for (let i = 0; i < remoteResult.atoms.length; i++) {
        const atom = remoteResult.atoms[i];
        if (!atomMap.has(atom.id)) {
          atomMap.set(atom.id, atom);
          bindingsArray.push(remoteResult.bindings[i]);
        }
      }
    }
    
    return {
      atoms: Array.from(atomMap.values()),
      bindings: bindingsArray
    };
  }

  /**
   * Rank results by relevance using multi-factor scoring
   */
  private rankByRelevance(
    results: { atoms: Atom[]; bindings: Map<string, Atom>[] },
    pattern: QueryPattern
  ): { atoms: Atom[]; bindings: Map<string, Atom>[]; scores: number[] } {
    const scored = results.atoms.map((atom, index) => {
      const score = this.calculateRelevanceScore(atom, pattern);
      return { atom, binding: results.bindings[index], score };
    });
    
    // Sort by relevance score descending
    scored.sort((a, b) => b.score - a.score);
    
    return {
      atoms: scored.map(s => s.atom),
      bindings: scored.map(s => s.binding),
      scores: scored.map(s => s.score)
    };
  }

  /**
   * Calculate relevance score for atom based on multiple factors
   */
  private calculateRelevanceScore(atom: Atom, pattern: QueryPattern): number {
    let score = 0.0;
    
    // Attention-based relevance (40%)
    if (atom.attentionValue) {
      const stiNorm = Math.min(atom.attentionValue.sti / 100, 1.0);
      const ltiNorm = Math.min(atom.attentionValue.lti / 100, 1.0);
      score += (stiNorm * 0.3 + ltiNorm * 0.1);
    }
    
    // Truth value confidence (30%)
    if (atom.truthValue) {
      score += atom.truthValue.confidence * 0.3;
    }
    
    // Type match exactness (20%)
    if (atom.type === pattern.type) {
      score += 0.2;
    }
    
    // Recency (10%) - newer atoms slightly preferred
    const age = Date.now() - (atom.createdAt || 0);
    const recencyScore = Math.exp(-age / (24 * 60 * 60 * 1000)); // Decay over days
    score += recencyScore * 0.1;
    
    return score;
  }

  /**
   * Cache results with sophisticated partitioning
   */
  private cacheResults(
    key: string,
    results: { atoms: Atom[]; bindings: Map<string, Atom>[]; scores: number[] }
  ): CacheEntry {
    // Partition by relevance ranges
    const partitions = this.partitionByRelevance(results);
    
    const entry: CacheEntry = {
      key,
      results: results.atoms,
      bindings: results.bindings,
      relevanceScores: results.scores,
      timestamp: Date.now(),
      hitCount: 0,
      partitions
    };
    
    // Evict old entries if cache is full
    if (this.cache.size >= this.cacheMaxSize) {
      this.evictLRU();
    }
    
    this.cache.set(key, entry);
    return entry;
  }

  /**
   * Partition results by relevance score ranges
   */
  private partitionByRelevance(
    results: { atoms: Atom[]; bindings: Map<string, Atom>[]; scores: number[] }
  ): CachePartition[] {
    const partitions: CachePartition[] = [
      { relevanceRange: [0.8, 1.0], atoms: [], bindings: [] },
      { relevanceRange: [0.6, 0.8], atoms: [], bindings: [] },
      { relevanceRange: [0.4, 0.6], atoms: [], bindings: [] },
      { relevanceRange: [0.0, 0.4], atoms: [], bindings: [] }
    ];
    
    for (let i = 0; i < results.atoms.length; i++) {
      const score = results.scores[i];
      const partition = partitions.find(p => 
        score >= p.relevanceRange[0] && score <= p.relevanceRange[1]
      );
      
      if (partition) {
        partition.atoms.push(results.atoms[i]);
        partition.bindings.push(results.bindings[i]);
      }
    }
    
    return partitions;
  }

  /**
   * Get cached results with hit counting
   */
  private getCachedResult(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.cacheMaxAge) {
      this.cache.delete(key);
      return null;
    }
    
    // Increment hit count
    entry.hitCount++;
    
    return entry;
  }

  /**
   * Evict least recently used cache entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < lruTime) {
        lruTime = entry.timestamp;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Build final query result with pagination
   */
  private buildQueryResult(
    cached: CacheEntry,
    maxResults?: number
  ): QueryResult {
    const limit = maxResults || cached.results.length;
    const hasMore = cached.results.length > limit;
    
    return {
      atoms: cached.results.slice(0, limit),
      bindings: cached.bindings.slice(0, limit),
      relevanceScores: cached.relevanceScores.slice(0, limit),
      totalMatches: cached.results.length,
      hasMore,
      nextCursor: hasMore ? `${cached.key}:${limit}` : undefined
    };
  }

  /**
   * Register remote DAS node
   */
  registerRemoteNode(nodeId: string, endpoint: string): void {
    this.remoteNodes.set(nodeId, endpoint);
  }

  /**
   * Generate cache key from pattern
   */
  private generateCacheKey(pattern: QueryPattern): string {
    return `query:${pattern.type}:${JSON.stringify(pattern.constraints)}`;
  }

  // Stub methods for local AtomSpace queries
  private async queryLocalOutgoing(atom: Atom): Promise<Atom[]> {
    // Implementation depends on AtomSpace storage
    return [];
  }

  private async queryLocalIncoming(atom: Atom): Promise<Atom[]> {
    // Implementation depends on AtomSpace storage
    return [];
  }

  private async getAllAtoms(): Promise<Atom[]> {
    // Implementation depends on AtomSpace storage
    return [];
  }
}
