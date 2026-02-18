/**
 * R2 Cold Storage Integration for FlareCog
 * 
 * Provides Tier 4 (Frozen) storage for very low STI atoms
 * Cost: $0.015/GB-month (93% cheaper than SQLite at $0.20/GB-month)
 * Latency: 50-200ms (acceptable for rarely accessed atoms)
 */

import { R2Bucket } from "@cloudflare/workers-types";
import { Atom, Node, Link } from "../types/cognitive";

export interface R2ColdStorageConfig {
	bucket: R2Bucket;
	tenantId: string;
	atomspaceId: string;
	archivalThreshold: number;  // STI threshold for archival (default: 5)
	archivalAge: number;         // Days of inactivity before archival (default: 30)
	compressionEnabled: boolean; // Enable gzip compression (default: true)
}

export interface ArchivalMetadata {
	atomId: string;
	atomType: string;
	archivedAt: number;
	lastAccessedAt: number;
	stiAtArchival: number;
	compressedSize: number;
	originalSize: number;
}

/**
 * R2 Cold Storage Manager
 * 
 * Handles automatic archival and retrieval of low-attention atoms
 */
export class R2ColdStorage {
	private config: R2ColdStorageConfig;
	private keyPrefix: string;
	
	constructor(config: R2ColdStorageConfig) {
		this.config = config;
		this.keyPrefix = `tenants/${config.tenantId}/frozen/${config.atomspaceId}/`;
	}
	
	/**
	 * Archive an atom to R2 cold storage
	 */
	async archiveAtom(atom: Atom): Promise<boolean> {
		try {
			const key = this.getAtomKey(atom.id);
			
			// Prepare atom data
			const atomData = JSON.stringify(atom);
			const originalSize = new Blob([atomData]).size;
			
			// Compress if enabled
			let dataToStore: string | Uint8Array = atomData;
			let compressedSize = originalSize;
			
			if (this.config.compressionEnabled) {
				const compressed = await this.compressData(atomData);
				dataToStore = compressed;
				compressedSize = compressed.length;
			}
			
			// Create metadata
			const metadata: ArchivalMetadata = {
				atomId: atom.id,
				atomType: atom.type,
				archivedAt: Date.now(),
				lastAccessedAt: atom.attentionValue?.lastAccessTime || Date.now(),
				stiAtArchival: atom.attentionValue?.sti || 0,
				compressedSize,
				originalSize,
			};
			
			// Store in R2
			await this.config.bucket.put(key, dataToStore, {
				customMetadata: this.metadataToHeaders(metadata),
			});
			
			console.log(`Archived atom ${atom.id} to R2 (${compressedSize} bytes, ${Math.round((1 - compressedSize / originalSize) * 100)}% compression)`);
			return true;
		} catch (error) {
			console.error("R2 archival error:", error);
			return false;
		}
	}
	
	/**
	 * Retrieve an atom from R2 cold storage
	 */
	async retrieveAtom(atomId: string): Promise<Atom | null> {
		try {
			const key = this.getAtomKey(atomId);
			const object = await this.config.bucket.get(key);
			
			if (!object) {
				return null;
			}
			
			// Get data
			let atomData: string;
			
			if (this.config.compressionEnabled) {
				const compressed = await object.arrayBuffer();
				atomData = await this.decompressData(new Uint8Array(compressed));
			} else {
				atomData = await object.text();
			}
			
			const atom = JSON.parse(atomData) as Atom;
			
			// Update metadata to track access
			const metadata = this.headersToMetadata(object.customMetadata || {});
			metadata.lastAccessedAt = Date.now();
			
			await this.config.bucket.put(key, atomData, {
				customMetadata: this.metadataToHeaders(metadata),
			});
			
			console.log(`Retrieved atom ${atomId} from R2 cold storage`);
			return atom;
		} catch (error) {
			console.error("R2 retrieval error:", error);
			return null;
		}
	}
	
	/**
	 * Delete an archived atom
	 */
	async deleteAtom(atomId: string): Promise<boolean> {
		try {
			const key = this.getAtomKey(atomId);
			await this.config.bucket.delete(key);
			console.log(`Deleted atom ${atomId} from R2 cold storage`);
			return true;
		} catch (error) {
			console.error("R2 deletion error:", error);
			return false;
		}
	}
	
	/**
	 * List all archived atoms for this AtomSpace
	 */
	async listArchived(limit: number = 1000): Promise<ArchivalMetadata[]> {
		try {
			const listed = await this.config.bucket.list({
				prefix: this.keyPrefix,
				limit,
			});
			
			const metadata: ArchivalMetadata[] = [];
			
			for (const object of listed.objects) {
				if (object.customMetadata) {
					metadata.push(this.headersToMetadata(object.customMetadata));
				}
			}
			
			return metadata;
		} catch (error) {
			console.error("R2 list error:", error);
			return [];
		}
	}
	
	/**
	 * Get storage statistics
	 */
	async getStorageStats(): Promise<{
		totalAtoms: number;
		totalSizeBytes: number;
		totalSizeGB: number;
		averageCompressionRatio: number;
	}> {
		try {
			const listed = await this.config.bucket.list({
				prefix: this.keyPrefix,
				limit: 10000,
			});
			
			let totalSize = 0;
			let totalOriginalSize = 0;
			
			for (const object of listed.objects) {
				totalSize += object.size;
				if (object.customMetadata?.originalSize) {
					totalOriginalSize += parseInt(object.customMetadata.originalSize);
				}
			}
			
			const compressionRatio = totalOriginalSize > 0 ? totalSize / totalOriginalSize : 1;
			
			return {
				totalAtoms: listed.objects.length,
				totalSizeBytes: totalSize,
				totalSizeGB: totalSize / (1024 * 1024 * 1024),
				averageCompressionRatio: compressionRatio,
			};
		} catch (error) {
			console.error("R2 stats error:", error);
			return {
				totalAtoms: 0,
				totalSizeBytes: 0,
				totalSizeGB: 0,
				averageCompressionRatio: 1,
			};
		}
	}
	
	/**
	 * Identify atoms eligible for archival
	 */
	async identifyArchivalCandidates(atoms: Atom[]): Promise<Atom[]> {
		const now = Date.now();
		const ageThresholdMs = this.config.archivalAge * 24 * 60 * 60 * 1000;
		
		return atoms.filter(atom => {
			const sti = atom.attentionValue?.sti || 0;
			const lastAccess = atom.attentionValue?.lastAccessTime || atom.timestamp;
			const age = now - lastAccess;
			
			return sti < this.config.archivalThreshold && age > ageThresholdMs;
		});
	}
	
	/**
	 * Bulk archive multiple atoms
	 */
	async bulkArchive(atoms: Atom[]): Promise<{
		succeeded: number;
		failed: number;
		totalSizeBytes: number;
	}> {
		let succeeded = 0;
		let failed = 0;
		let totalSize = 0;
		
		for (const atom of atoms) {
			const result = await this.archiveAtom(atom);
			if (result) {
				succeeded++;
				totalSize += JSON.stringify(atom).length;
			} else {
				failed++;
			}
		}
		
		return { succeeded, failed, totalSizeBytes: totalSize };
	}
	
	/**
	 * Restore archived atoms back to active storage
	 */
	async restoreAtoms(atomIds: string[]): Promise<Atom[]> {
		const restored: Atom[] = [];
		
		for (const atomId of atomIds) {
			const atom = await this.retrieveAtom(atomId);
			if (atom) {
				restored.push(atom);
			}
		}
		
		return restored;
	}
	
	// Helper methods
	
	private getAtomKey(atomId: string): string {
		return `${this.keyPrefix}${atomId}.json${this.config.compressionEnabled ? '.gz' : ''}`;
	}
	
	private async compressData(data: string): Promise<Uint8Array> {
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(data));
				controller.close();
			}
		});
		
		const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
		const reader = compressedStream.getReader();
		const chunks: Uint8Array[] = [];
		
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
		}
		
		// Concatenate chunks
		const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		const result = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}
		
		return result;
	}
	
	private async decompressData(data: Uint8Array): Promise<string> {
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(data);
				controller.close();
			}
		});
		
		const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
		const reader = decompressedStream.getReader();
		const chunks: Uint8Array[] = [];
		
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
		}
		
		// Concatenate and decode
		const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		const result = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}
		
		const decoder = new TextDecoder();
		return decoder.decode(result);
	}
	
	private metadataToHeaders(metadata: ArchivalMetadata): Record<string, string> {
		return {
			atomId: metadata.atomId,
			atomType: metadata.atomType,
			archivedAt: String(metadata.archivedAt),
			lastAccessedAt: String(metadata.lastAccessedAt),
			stiAtArchival: String(metadata.stiAtArchival),
			compressedSize: String(metadata.compressedSize),
			originalSize: String(metadata.originalSize),
		};
	}
	
	private headersToMetadata(headers: Record<string, string>): ArchivalMetadata {
		return {
			atomId: headers.atomId,
			atomType: headers.atomType,
			archivedAt: parseInt(headers.archivedAt),
			lastAccessedAt: parseInt(headers.lastAccessedAt),
			stiAtArchival: parseFloat(headers.stiAtArchival),
			compressedSize: parseInt(headers.compressedSize),
			originalSize: parseInt(headers.originalSize),
		};
	}
}

/**
 * Automatic Archival Service
 * 
 * Background service that periodically identifies and archives cold atoms
 */
export class AutoArchivalService {
	private coldStorage: R2ColdStorage;
	private checkIntervalMs: number;
	
	constructor(coldStorage: R2ColdStorage, checkIntervalHours: number = 24) {
		this.coldStorage = coldStorage;
		this.checkIntervalMs = checkIntervalHours * 60 * 60 * 1000;
	}
	
	/**
	 * Run archival check and archive eligible atoms
	 */
	async runArchivalCycle(atoms: Atom[]): Promise<{
		checked: number;
		archived: number;
		spaceSavedGB: number;
	}> {
		console.log(`Starting archival cycle for ${atoms.length} atoms`);
		
		// Identify candidates
		const candidates = await this.coldStorage.identifyArchivalCandidates(atoms);
		console.log(`Found ${candidates.length} atoms eligible for archival`);
		
		if (candidates.length === 0) {
			return { checked: atoms.length, archived: 0, spaceSavedGB: 0 };
		}
		
		// Bulk archive
		const result = await this.coldStorage.bulkArchive(candidates);
		const spaceSavedGB = result.totalSizeBytes / (1024 * 1024 * 1024);
		
		console.log(`Archival cycle complete: ${result.succeeded} archived, ${result.failed} failed, ${spaceSavedGB.toFixed(2)} GB saved`);
		
		return {
			checked: atoms.length,
			archived: result.succeeded,
			spaceSavedGB,
		};
	}
}
