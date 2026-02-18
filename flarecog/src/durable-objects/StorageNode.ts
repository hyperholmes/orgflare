import { DurableObject } from "cloudflare:workers";
import {
	Env,
	Atom,
	Node,
	Link,
	AtomType,
	TruthValue,
	AttentionValue,
	AtomSpaceQuery,
} from "../types/cognitive";

/**
 * StorageNode - Abstraction for inter-AtomSpace communication
 * 
 * Implements the OpenCog StorageNode pattern for distributed AtomSpace coordination.
 * Enables provider/user AtomSpace architecture and distributed query routing.
 */

export interface StorageNodeConfig {
	type: "local" | "remote" | "distributed";
	endpoint?: string;
	atomspaceId?: string;
	cacheEnabled?: boolean;
	cacheTTL?: number;
}

export interface StorageNodeStats {
	totalRequests: number;
	cacheHits: number;
	cacheMisses: number;
	averageLatency: number;
	lastSync: number;
}

/**
 * Base StorageNode interface
 */
export interface IStorageNode {
	// Core operations
	fetchAtom(id: string): Promise<Atom | null>;
	storeAtom(atom: Atom): Promise<boolean>;
	deleteAtom(id: string): Promise<boolean>;
	
	// Query operations
	queryAtoms(query: AtomSpaceQuery): Promise<Atom[]>;
	getIncoming(atomId: string): Promise<Link[]>;
	
	// Synchronization
	sync(): Promise<void>;
	
	// Statistics
	getStats(): Promise<StorageNodeStats>;
}

/**
 * LocalStorageNode - Direct access to local AtomSpace
 */
export class LocalStorageNode implements IStorageNode {
	constructor(
		private atomspace: DurableObjectStub,
		private env: Env
	) {}

	async fetchAtom(id: string): Promise<Atom | null> {
		const response = await this.atomspace.fetch(
			new Request(`https://atomspace/atom/${id}`, { method: "GET" })
		);
		if (!response.ok) return null;
		const data = await response.json() as { atom: Atom };
		return data.atom;
	}

	async storeAtom(atom: Atom): Promise<boolean> {
		const isNode = this.isNodeType(atom.type);
		const endpoint = isNode ? "node" : "link";
		
		const body = isNode
			? {
					type: atom.type,
					name: (atom as Node).name,
					truthValue: atom.truthValue,
					attentionValue: atom.attentionValue,
			  }
			: {
					type: atom.type,
					outgoing: (atom as Link).outgoing,
					truthValue: atom.truthValue,
					attentionValue: atom.attentionValue,
			  };

		const response = await this.atomspace.fetch(
			new Request(`https://atomspace/${endpoint}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			})
		);
		return response.ok;
	}

	async deleteAtom(id: string): Promise<boolean> {
		const response = await this.atomspace.fetch(
			new Request(`https://atomspace/atom/${id}`, { method: "DELETE" })
		);
		return response.ok;
	}

	async queryAtoms(query: AtomSpaceQuery): Promise<Atom[]> {
		const response = await this.atomspace.fetch(
			new Request("https://atomspace/query", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(query),
			})
		);
		if (!response.ok) return [];
		const data = await response.json() as { atoms?: Atom[] };
		return data.atoms || [];
	}

	async getIncoming(atomId: string): Promise<Link[]> {
		const response = await this.atomspace.fetch(
			new Request(`https://atomspace/incoming/${atomId}`, { method: "GET" })
		);
		if (!response.ok) return [];
		const data = await response.json() as { links?: Link[] };
		return data.links || [];
	}

	async sync(): Promise<void> {
		// Local storage is always in sync
		return;
	}

	async getStats(): Promise<StorageNodeStats> {
		return {
			totalRequests: 0,
			cacheHits: 0,
			cacheMisses: 0,
			averageLatency: 0,
			lastSync: Date.now(),
		};
	}

	private isNodeType(type: AtomType): boolean {
		return ["Node", "ConceptNode", "PredicateNode", "VariableNode"].includes(
			type
		);
	}
}

/**
 * RemoteStorageNode - Access to remote AtomSpace via HTTP/RPC
 */
export class RemoteStorageNode implements IStorageNode {
	private stats: StorageNodeStats = {
		totalRequests: 0,
		cacheHits: 0,
		cacheMisses: 0,
		averageLatency: 0,
		lastSync: 0,
	};

	constructor(
		private config: StorageNodeConfig,
		private env: Env
	) {}

	async fetchAtom(id: string): Promise<Atom | null> {
		// Check cache first
		if (this.config.cacheEnabled) {
			const cached = await this.env.ATOM_CACHE.get(
				`atom:${id}`,
				"json"
			);
			if (cached) {
				this.stats.cacheHits++;
				return cached as Atom;
			}
			this.stats.cacheMisses++;
		}

		// Fetch from remote
		const startTime = Date.now();
		this.stats.totalRequests++;

		try {
			const response = await fetch(`${this.config.endpoint}/atom/${id}`, {
				method: "GET",
			});

		if (!response.ok) return null;

		const data = await response.json() as { atom: Atom };
		const atom = data.atom;

			// Update cache
			if (this.config.cacheEnabled && atom) {
				await this.env.ATOM_CACHE.put(
					`atom:${id}`,
					JSON.stringify(atom),
					{ expirationTtl: this.config.cacheTTL || 3600 }
				);
			}

			// Update latency stats
			const latency = Date.now() - startTime;
			this.stats.averageLatency =
				(this.stats.averageLatency * (this.stats.totalRequests - 1) + latency) /
				this.stats.totalRequests;

			return atom;
		} catch (error) {
			console.error("RemoteStorageNode fetch error:", error);
			return null;
		}
	}

	async storeAtom(atom: Atom): Promise<boolean> {
		const isNode = this.isNodeType(atom.type);
		const endpoint = isNode ? "node" : "link";

		const body = isNode
			? {
					type: atom.type,
					name: (atom as Node).name,
					truthValue: atom.truthValue,
					attentionValue: atom.attentionValue,
			  }
			: {
					type: atom.type,
					outgoing: (atom as Link).outgoing,
					truthValue: atom.truthValue,
					attentionValue: atom.attentionValue,
			  };

		try {
			const response = await fetch(`${this.config.endpoint}/${endpoint}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			// Invalidate cache
			if (this.config.cacheEnabled && response.ok) {
				await this.env.ATOM_CACHE.delete(`atom:${atom.id}`);
			}

			return response.ok;
		} catch (error) {
			console.error("RemoteStorageNode store error:", error);
			return false;
		}
	}

	async deleteAtom(id: string): Promise<boolean> {
		try {
			const response = await fetch(`${this.config.endpoint}/atom/${id}`, {
				method: "DELETE",
			});

			// Invalidate cache
			if (this.config.cacheEnabled && response.ok) {
				await this.env.ATOM_CACHE.delete(`atom:${id}`);
			}

			return response.ok;
		} catch (error) {
			console.error("RemoteStorageNode delete error:", error);
			return false;
		}
	}

	async queryAtoms(query: AtomSpaceQuery): Promise<Atom[]> {
		try {
			const response = await fetch(`${this.config.endpoint}/query`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(query),
			});

		if (!response.ok) return [];

		const data = await response.json() as { atoms?: Atom[] };
		return data.atoms || [];
		} catch (error) {
			console.error("RemoteStorageNode query error:", error);
			return [];
		}
	}

	async getIncoming(atomId: string): Promise<Link[]> {
		try {
			const response = await fetch(
				`${this.config.endpoint}/incoming/${atomId}`,
				{ method: "GET" }
			);

		if (!response.ok) return [];

		const data = await response.json() as { links?: Link[] };
		return data.links || [];
		} catch (error) {
			console.error("RemoteStorageNode getIncoming error:", error);
			return [];
		}
	}

	async sync(): Promise<void> {
		this.stats.lastSync = Date.now();
		// Could implement sync logic here
	}

	async getStats(): Promise<StorageNodeStats> {
		return { ...this.stats };
	}

	private isNodeType(type: AtomType): boolean {
		return ["Node", "ConceptNode", "PredicateNode", "VariableNode"].includes(
			type
		);
	}
}

/**
 * DistributedStorageNode - Coordinates multiple provider AtomSpaces
 */
export class DistributedStorageNode implements IStorageNode {
	private providers: IStorageNode[] = [];
	private stats: StorageNodeStats = {
		totalRequests: 0,
		cacheHits: 0,
		cacheMisses: 0,
		averageLatency: 0,
		lastSync: 0,
	};

	constructor(
		private config: StorageNodeConfig,
		private env: Env
	) {}

	/**
	 * Add a provider AtomSpace to the distributed network
	 */
	addProvider(provider: IStorageNode): void {
		this.providers.push(provider);
	}

	/**
	 * Fetch atom from first available provider
	 */
	async fetchAtom(id: string): Promise<Atom | null> {
		this.stats.totalRequests++;

		// Try each provider in order
		for (const provider of this.providers) {
			const atom = await provider.fetchAtom(id);
			if (atom) {
				return atom;
			}
		}

		return null;
	}

	/**
	 * Store atom to all providers (write-through)
	 */
	async storeAtom(atom: Atom): Promise<boolean> {
		const results = await Promise.all(
			this.providers.map((provider) => provider.storeAtom(atom))
		);
		return results.every((r) => r);
	}

	/**
	 * Delete atom from all providers
	 */
	async deleteAtom(id: string): Promise<boolean> {
		const results = await Promise.all(
			this.providers.map((provider) => provider.deleteAtom(id))
		);
		return results.every((r) => r);
	}

	/**
	 * Query all providers and merge results
	 */
	async queryAtoms(query: AtomSpaceQuery): Promise<Atom[]> {
		const results = await Promise.all(
			this.providers.map((provider) => provider.queryAtoms(query))
		);

		// Merge and deduplicate results by atom ID
		const atomMap = new Map<string, Atom>();
		for (const providerResults of results) {
			for (const atom of providerResults) {
				if (!atomMap.has(atom.id)) {
					atomMap.set(atom.id, atom);
				}
			}
		}

		return Array.from(atomMap.values());
	}

	/**
	 * Get incoming links from all providers
	 */
	async getIncoming(atomId: string): Promise<Link[]> {
		const results = await Promise.all(
			this.providers.map((provider) => provider.getIncoming(atomId))
		);

		// Merge and deduplicate links by ID
		const linkMap = new Map<string, Link>();
		for (const providerResults of results) {
			for (const link of providerResults) {
				if (!linkMap.has(link.id)) {
					linkMap.set(link.id, link);
				}
			}
		}

		return Array.from(linkMap.values());
	}

	/**
	 * Sync all providers
	 */
	async sync(): Promise<void> {
		await Promise.all(this.providers.map((provider) => provider.sync()));
		this.stats.lastSync = Date.now();
	}

	/**
	 * Aggregate stats from all providers
	 */
	async getStats(): Promise<StorageNodeStats> {
		const providerStats = await Promise.all(
			this.providers.map((provider) => provider.getStats())
		);

		const aggregated: StorageNodeStats = {
			totalRequests: this.stats.totalRequests,
			cacheHits: 0,
			cacheMisses: 0,
			averageLatency: 0,
			lastSync: this.stats.lastSync,
		};

		for (const stats of providerStats) {
			aggregated.cacheHits += stats.cacheHits;
			aggregated.cacheMisses += stats.cacheMisses;
			aggregated.averageLatency += stats.averageLatency;
		}

		if (providerStats.length > 0) {
			aggregated.averageLatency /= providerStats.length;
		}

		return aggregated;
	}
}

/**
 * Factory for creating StorageNodes
 */
export class StorageNodeFactory {
	static create(
		config: StorageNodeConfig,
		env: Env,
		atomspace?: DurableObjectStub
	): IStorageNode {
		switch (config.type) {
			case "local":
				if (!atomspace) {
					throw new Error("LocalStorageNode requires atomspace stub");
				}
				return new LocalStorageNode(atomspace, env);

			case "remote":
				if (!config.endpoint) {
					throw new Error("RemoteStorageNode requires endpoint");
				}
				return new RemoteStorageNode(config, env);

			case "distributed":
				return new DistributedStorageNode(config, env);

			default:
				throw new Error(`Unknown storage node type: ${config.type}`);
		}
	}
}
