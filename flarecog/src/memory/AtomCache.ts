import { Atom, Node, Link } from "../types/cognitive";

/**
 * Atom Cache Manager - High-performance caching using Cloudflare KV
 *
 * Provides fast access to frequently used atoms, reducing Durable Object calls
 * and improving query performance.
 */

export class AtomCache {
	private kv: KVNamespace;
	private localCache: Map<string, { atom: Atom; timestamp: number }>;
	private maxLocalCacheSize: number;
	private localCacheTTL: number; // milliseconds

	constructor(
		kv: KVNamespace,
		maxLocalCacheSize: number = 1000,
		localCacheTTL: number = 60000,
	) {
		this.kv = kv;
		this.localCache = new Map();
		this.maxLocalCacheSize = maxLocalCacheSize;
		this.localCacheTTL = localCacheTTL;
	}

	/**
	 * Get atom from cache (local first, then KV)
	 */
	async get(atomId: string): Promise<Atom | null> {
		// Check local cache first
		const localEntry = this.localCache.get(atomId);
		if (localEntry) {
			const age = Date.now() - localEntry.timestamp;
			if (age < this.localCacheTTL) {
				return localEntry.atom;
			} else {
				// Expired, remove from local cache
				this.localCache.delete(atomId);
			}
		}

		// Check KV cache
		const cached = await this.kv.get(`atom:${atomId}`, "json");
		if (cached) {
			const atom = cached as Atom;
			// Store in local cache
			this.setLocal(atomId, atom);
			return atom;
		}

		return null;
	}

	/**
	 * Store atom in cache (both local and KV)
	 */
	async set(
		atomId: string,
		atom: Atom,
		ttl: number = 3600,
	): Promise<void> {
		// Store in local cache
		this.setLocal(atomId, atom);

		// Store in KV with TTL
		await this.kv.put(`atom:${atomId}`, JSON.stringify(atom), {
			expirationTtl: ttl,
		});
	}

	/**
	 * Store multiple atoms in cache
	 */
	async setMany(
		atoms: Atom[],
		ttl: number = 3600,
	): Promise<void> {
		// Store in local cache
		for (const atom of atoms) {
			this.setLocal(atom.id, atom);
		}

		// Batch store in KV (if supported)
		const promises = atoms.map((atom) =>
			this.kv.put(`atom:${atom.id}`, JSON.stringify(atom), {
				expirationTtl: ttl,
			}),
		);

		await Promise.all(promises);
	}

	/**
	 * Invalidate atom from cache
	 */
	async invalidate(atomId: string): Promise<void> {
		// Remove from local cache
		this.localCache.delete(atomId);

		// Remove from KV
		await this.kv.delete(`atom:${atomId}`);
	}

	/**
	 * Invalidate multiple atoms
	 */
	async invalidateMany(atomIds: string[]): Promise<void> {
		// Remove from local cache
		for (const atomId of atomIds) {
			this.localCache.delete(atomId);
		}

		// Batch delete from KV
		const promises = atomIds.map((atomId) =>
			this.kv.delete(`atom:${atomId}`),
		);

		await Promise.all(promises);
	}

	/**
	 * Cache query results
	 */
	async cacheQueryResult(
		queryKey: string,
		atoms: Atom[],
		ttl: number = 300,
	): Promise<void> {
		await this.kv.put(`query:${queryKey}`, JSON.stringify(atoms), {
			expirationTtl: ttl,
		});
	}

	/**
	 * Get cached query results
	 */
	async getCachedQueryResult(queryKey: string): Promise<Atom[] | null> {
		const cached = await this.kv.get(`query:${queryKey}`, "json");
		return cached ? (cached as Atom[]) : null;
	}

	/**
	 * Cache attention value snapshot
	 */
	async cacheAttentionSnapshot(
		snapshotId: string,
		attentionData: any,
		ttl: number = 600,
	): Promise<void> {
		await this.kv.put(
			`attention:${snapshotId}`,
			JSON.stringify(attentionData),
			{
				expirationTtl: ttl,
			},
		);
	}

	/**
	 * Get attention snapshot
	 */
	async getAttentionSnapshot(snapshotId: string): Promise<any | null> {
		const cached = await this.kv.get(`attention:${snapshotId}`, "json");
		return cached;
	}

	/**
	 * Cache high-STI atoms for quick access
	 */
	async cacheHighSTIAtoms(
		atoms: Atom[],
		ttl: number = 300,
	): Promise<void> {
		await this.kv.put("high_sti_atoms", JSON.stringify(atoms), {
			expirationTtl: ttl,
		});
	}

	/**
	 * Get cached high-STI atoms
	 */
	async getHighSTIAtoms(): Promise<Atom[] | null> {
		const cached = await this.kv.get("high_sti_atoms", "json");
		return cached ? (cached as Atom[]) : null;
	}

	/**
	 * Cache concept by name for fast lookup
	 */
	async cacheConceptByName(
		name: string,
		atom: Atom,
		ttl: number = 3600,
	): Promise<void> {
		await this.kv.put(`concept:${name}`, JSON.stringify(atom), {
			expirationTtl: ttl,
		});
	}

	/**
	 * Get concept by name from cache
	 */
	async getConceptByName(name: string): Promise<Atom | null> {
		const cached = await this.kv.get(`concept:${name}`, "json");
		return cached ? (cached as Atom) : null;
	}

	/**
	 * Cache statistics
	 */
	async cacheStats(
		stats: any,
		ttl: number = 60,
	): Promise<void> {
		await this.kv.put("atomspace_stats", JSON.stringify(stats), {
			expirationTtl: ttl,
		});
	}

	/**
	 * Get cached statistics
	 */
	async getCachedStats(): Promise<any | null> {
		const cached = await this.kv.get("atomspace_stats", "json");
		return cached;
	}

	/**
	 * Warm up cache with frequently accessed atoms
	 */
	async warmup(
		atomSpaceStub: DurableObjectStub,
		atomIds: string[],
	): Promise<void> {
		const promises = atomIds.map(async (atomId) => {
			const response = await atomSpaceStub.fetch(
				new Request(`http://dummy/atom/${atomId}`),
			);
			const data = await response.json();
			if (data.success && data.data) {
				await this.set(atomId, data.data);
			}
		});

		await Promise.all(promises);
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): {
		localCacheSize: number;
		maxLocalCacheSize: number;
		localCacheTTL: number;
	} {
		return {
			localCacheSize: this.localCache.size,
			maxLocalCacheSize: this.maxLocalCacheSize,
			localCacheTTL: this.localCacheTTL,
		};
	}

	/**
	 * Clear local cache
	 */
	clearLocal(): void {
		this.localCache.clear();
	}

	/**
	 * Store atom in local cache with LRU eviction
	 */
	private setLocal(atomId: string, atom: Atom): void {
		// If cache is full, remove oldest entry
		if (this.localCache.size >= this.maxLocalCacheSize) {
			const oldestKey = this.localCache.keys().next().value;
			this.localCache.delete(oldestKey);
		}

		this.localCache.set(atomId, {
			atom,
			timestamp: Date.now(),
		});
	}

	/**
	 * Generate cache key from query parameters
	 */
	static generateQueryKey(query: any): string {
		// Create a deterministic string from query object
		const sorted = Object.keys(query)
			.sort()
			.map((key) => `${key}:${JSON.stringify(query[key])}`)
			.join("|");

		// Simple hash function (could use crypto.subtle for better hashing)
		let hash = 0;
		for (let i = 0; i < sorted.length; i++) {
			const char = sorted.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32bit integer
		}

		return `q_${Math.abs(hash)}`;
	}

	/**
	 * Prefetch related atoms
	 *
	 * When an atom is accessed, prefetch its incoming/outgoing links
	 */
	async prefetchRelated(
		atomId: string,
		atomSpaceStub: DurableObjectStub,
	): Promise<void> {
		// Get the atom first
		const atomResponse = await atomSpaceStub.fetch(
			new Request(`http://dummy/atom/${atomId}`),
		);
		const atomData = await atomResponse.json();

		if (!atomData.success || !atomData.data) return;

		const atom = atomData.data as Atom;

		// If it's a link, prefetch outgoing atoms
		if ("outgoing" in atom) {
			const link = atom as Link;
			await this.warmup(atomSpaceStub, link.outgoing);
		}

		// Prefetch incoming links
		const incomingResponse = await atomSpaceStub.fetch(
			new Request(`http://dummy/incoming/${atomId}`),
		);
		const incomingData = await incomingResponse.json();

		if (incomingData.success && incomingData.data) {
			const incomingLinks = incomingData.data as Link[];
			const incomingIds = incomingLinks.map((l) => l.id);
			await this.warmup(atomSpaceStub, incomingIds);
		}
	}
}

/**
 * Cache Strategy - Determines what to cache and for how long
 */
export class CacheStrategy {
	/**
	 * Determine TTL based on atom properties
	 */
	static determineTTL(atom: Atom): number {
		// High STI atoms: cache longer
		if (atom.attentionValue.sti > 80) {
			return 3600; // 1 hour
		}

		// Medium STI atoms: moderate cache
		if (atom.attentionValue.sti > 40) {
			return 1800; // 30 minutes
		}

		// Low STI atoms: short cache
		return 600; // 10 minutes
	}

	/**
	 * Determine if atom should be cached
	 */
	static shouldCache(atom: Atom): boolean {
		// Cache atoms with significant attention
		if (atom.attentionValue.sti > 20) {
			return true;
		}

		// Cache atoms with high truth value
		if (
			atom.truthValue.strength > 0.7 &&
			atom.truthValue.confidence > 0.7
		) {
			return true;
		}

		// Don't cache low-importance atoms
		return false;
	}

	/**
	 * Determine cache priority
	 */
	static getPriority(atom: Atom): number {
		// Higher priority = more important to cache
		let priority = 0;

		// STI contributes to priority
		priority += atom.attentionValue.sti;

		// LTI contributes to priority
		priority += atom.attentionValue.lti * 0.5;

		// Truth value contributes
		priority += atom.truthValue.strength * atom.truthValue.confidence * 10;

		return priority;
	}
}
