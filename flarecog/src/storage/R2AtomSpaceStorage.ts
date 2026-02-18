/**
 * CloudFlare R2 Cold Storage for AtomSpace
 * 
 * Implements tiered storage strategy to overcome Durable Object memory limits
 * by offloading cold atoms to R2 object storage.
 */

import { Env, Atom, AttentionValue } from "../types/cognitive";

export interface StorageTier {
	tier: "hot" | "warm" | "cold";
	threshold: number; // STI threshold
	location: "memory" | "durable-object" | "r2";
}

export interface AtomStorageMetadata {
	atomId: string;
	tier: StorageTier["tier"];
	lastAccessed: number;
	accessCount: number;
	size: number;
	r2Key?: string;
}

export interface StorageStats {
	hotAtoms: number;
	warmAtoms: number;
	coldAtoms: number;
	totalSize: number;
	r2Objects: number;
}

/**
 * R2 AtomSpace Storage Manager
 * 
 * Implements intelligent tiered storage:
 * - Hot: High STI atoms in Durable Object memory (fast access)
 * - Warm: Medium STI atoms in Durable Object SQL (moderate access)
 * - Cold: Low STI atoms in R2 storage (slow access, unlimited size)
 */
export class R2AtomSpaceStorage {
	private readonly HOT_THRESHOLD = 100; // STI > 100
	private readonly WARM_THRESHOLD = 50; // STI > 50
	private readonly COLD_THRESHOLD = 0; // STI <= 50

	constructor(private env: Env) {}

	/**
	 * Store atom with automatic tier selection
	 */
	async storeAtom(atom: Atom, instanceId: string): Promise<void> {
		const tier = this.determineTier(atom.attentionValue);
		const metadata: AtomStorageMetadata = {
			atomId: atom.id,
			tier,
			lastAccessed: Date.now(),
			accessCount: 1,
			size: this.estimateAtomSize(atom),
		};

		if (tier === "cold") {
			await this.storeToCold(atom, instanceId, metadata);
		}
		// Hot and warm are handled by Durable Object
	}

	/**
	 * Retrieve atom from appropriate tier
	 */
	async retrieveAtom(
		atomId: string,
		instanceId: string,
	): Promise<Atom | null> {
		// Try to get metadata first
		const metadata = await this.getMetadata(atomId, instanceId);

		if (!metadata) {
			return null;
		}

		// Update access statistics
		await this.updateAccessStats(atomId, instanceId);

		if (metadata.tier === "cold" && metadata.r2Key) {
			return await this.retrieveFromCold(metadata.r2Key);
		}

		// Hot and warm atoms are in Durable Object
		return null; // Caller should check Durable Object
	}

	/**
	 * Move atoms between tiers based on attention values
	 */
	async rebalanceTiers(instanceId: string): Promise<{
		promoted: number;
		demoted: number;
	}> {
		let promoted = 0;
		let demoted = 0;

		// Get all atom metadata
		const allMetadata = await this.getAllMetadata(instanceId);

		for (const metadata of allMetadata) {
			// This would need to fetch the actual atom to check current STI
			// For now, we'll use a simplified approach based on access patterns

			if (
				metadata.tier === "cold" &&
				metadata.accessCount > 10 &&
				Date.now() - metadata.lastAccessed < 3600000
			) {
				// Promote frequently accessed cold atoms
				await this.promoteAtom(metadata.atomId, instanceId);
				promoted++;
			} else if (
				metadata.tier === "warm" &&
				metadata.accessCount < 2 &&
				Date.now() - metadata.lastAccessed > 86400000
			) {
				// Demote rarely accessed warm atoms
				await this.demoteAtom(metadata.atomId, instanceId);
				demoted++;
			}
		}

		return { promoted, demoted };
	}

	/**
	 * Store atom to R2 cold storage
	 */
	private async storeToCold(
		atom: Atom,
		instanceId: string,
		metadata: AtomStorageMetadata,
	): Promise<void> {
		const r2Key = `atomspace/${instanceId}/atoms/${atom.id}.json`;
		const atomData = JSON.stringify(atom);

		await this.env.ATOMSPACE_COLD_STORAGE.put(r2Key, atomData, {
			httpMetadata: {
				contentType: "application/json",
			},
			customMetadata: {
				atomId: atom.id,
				instanceId,
				tier: "cold",
				storedAt: Date.now().toString(),
			},
		});

		metadata.r2Key = r2Key;
		await this.storeMetadata(metadata, instanceId);
	}

	/**
	 * Retrieve atom from R2 cold storage
	 */
	private async retrieveFromCold(r2Key: string): Promise<Atom | null> {
		const object = await this.env.ATOMSPACE_COLD_STORAGE.get(r2Key);

		if (!object) {
			return null;
		}

		const atomData = await object.text();
		return JSON.parse(atomData) as Atom;
	}

	/**
	 * Promote atom to warmer tier
	 */
	private async promoteAtom(
		atomId: string,
		instanceId: string,
	): Promise<void> {
		const metadata = await this.getMetadata(atomId, instanceId);

		if (!metadata) {
			return;
		}

		if (metadata.tier === "cold") {
			// Retrieve from R2
			const atom = await this.retrieveFromCold(metadata.r2Key!);

			if (atom) {
				// Delete from R2
				await this.env.ATOMSPACE_COLD_STORAGE.delete(metadata.r2Key!);

				// Update metadata
				metadata.tier = "warm";
				metadata.r2Key = undefined;
				await this.storeMetadata(metadata, instanceId);
			}
		}
	}

	/**
	 * Demote atom to colder tier
	 */
	private async demoteAtom(
		atomId: string,
		instanceId: string,
	): Promise<void> {
		const metadata = await this.getMetadata(atomId, instanceId);

		if (!metadata) {
			return;
		}

		if (metadata.tier === "warm") {
			// This would need to fetch the atom from Durable Object
			// and move it to R2
			metadata.tier = "cold";
			await this.storeMetadata(metadata, instanceId);
		}
	}

	/**
	 * Determine storage tier based on attention value
	 */
	private determineTier(attentionValue: AttentionValue): StorageTier["tier"] {
		if (attentionValue.sti > this.HOT_THRESHOLD) {
			return "hot";
		} else if (attentionValue.sti > this.WARM_THRESHOLD) {
			return "warm";
		} else {
			return "cold";
		}
	}

	/**
	 * Estimate atom size in bytes
	 */
	private estimateAtomSize(atom: Atom): number {
		return JSON.stringify(atom).length;
	}

	/**
	 * Store metadata in KV
	 */
	private async storeMetadata(
		metadata: AtomStorageMetadata,
		instanceId: string,
	): Promise<void> {
		const key = `metadata:${instanceId}:${metadata.atomId}`;
		await this.env.CACHE.put(key, JSON.stringify(metadata), {
			expirationTtl: 86400 * 30, // 30 days
		});
	}

	/**
	 * Get metadata from KV
	 */
	private async getMetadata(
		atomId: string,
		instanceId: string,
	): Promise<AtomStorageMetadata | null> {
		const key = `metadata:${instanceId}:${atomId}`;
		const data = await this.env.CACHE.get(key);

		if (!data) {
			return null;
		}

		return JSON.parse(data) as AtomStorageMetadata;
	}

	/**
	 * Get all metadata for an instance
	 */
	private async getAllMetadata(
		instanceId: string,
	): Promise<AtomStorageMetadata[]> {
		const prefix = `metadata:${instanceId}:`;
		const list = await this.env.CACHE.list({ prefix });

		const metadata: AtomStorageMetadata[] = [];

		for (const key of list.keys) {
			const data = await this.env.CACHE.get(key.name);
			if (data) {
				metadata.push(JSON.parse(data) as AtomStorageMetadata);
			}
		}

		return metadata;
	}

	/**
	 * Update access statistics
	 */
	private async updateAccessStats(
		atomId: string,
		instanceId: string,
	): Promise<void> {
		const metadata = await this.getMetadata(atomId, instanceId);

		if (metadata) {
			metadata.lastAccessed = Date.now();
			metadata.accessCount++;
			await this.storeMetadata(metadata, instanceId);
		}
	}

	/**
	 * Get storage statistics
	 */
	async getStorageStats(instanceId: string): Promise<StorageStats> {
		const allMetadata = await this.getAllMetadata(instanceId);

		const stats: StorageStats = {
			hotAtoms: 0,
			warmAtoms: 0,
			coldAtoms: 0,
			totalSize: 0,
			r2Objects: 0,
		};

		for (const metadata of allMetadata) {
			stats.totalSize += metadata.size;

			if (metadata.tier === "hot") {
				stats.hotAtoms++;
			} else if (metadata.tier === "warm") {
				stats.warmAtoms++;
			} else if (metadata.tier === "cold") {
				stats.coldAtoms++;
				if (metadata.r2Key) {
					stats.r2Objects++;
				}
			}
		}

		return stats;
	}

	/**
	 * Batch export atoms to R2
	 */
	async batchExportToR2(
		atoms: Atom[],
		instanceId: string,
	): Promise<number> {
		let exported = 0;

		for (const atom of atoms) {
			if (atom.attentionValue.sti <= this.WARM_THRESHOLD) {
				const metadata: AtomStorageMetadata = {
					atomId: atom.id,
					tier: "cold",
					lastAccessed: Date.now(),
					accessCount: 0,
					size: this.estimateAtomSize(atom),
				};

				await this.storeToCold(atom, instanceId, metadata);
				exported++;
			}
		}

		return exported;
	}

	/**
	 * Batch import atoms from R2
	 */
	async batchImportFromR2(
		atomIds: string[],
		instanceId: string,
	): Promise<Atom[]> {
		const atoms: Atom[] = [];

		for (const atomId of atomIds) {
			const metadata = await this.getMetadata(atomId, instanceId);

			if (metadata?.r2Key) {
				const atom = await this.retrieveFromCold(metadata.r2Key);
				if (atom) {
					atoms.push(atom);
				}
			}
		}

		return atoms;
	}

	/**
	 * Clean up old cold storage
	 */
	async cleanupOldStorage(instanceId: string, daysOld: number): Promise<number> {
		const cutoffTime = Date.now() - daysOld * 86400000;
		const allMetadata = await this.getAllMetadata(instanceId);
		let deleted = 0;

		for (const metadata of allMetadata) {
			if (
				metadata.tier === "cold" &&
				metadata.lastAccessed < cutoffTime &&
				metadata.accessCount === 0 &&
				metadata.r2Key
			) {
				await this.env.ATOMSPACE_COLD_STORAGE.delete(metadata.r2Key);
				await this.env.CACHE.delete(
					`metadata:${instanceId}:${metadata.atomId}`,
				);
				deleted++;
			}
		}

		return deleted;
	}
}
