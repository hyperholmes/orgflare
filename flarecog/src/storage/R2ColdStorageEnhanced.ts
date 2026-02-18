/**
 * Enhanced R2 Cold Storage for FlareCog
 * 
 * Implements intelligent tiered storage for AtomSpace:
 * - Hot tier: Durable Objects (high STI atoms, active processing)
 * - Warm tier: KV (medium STI atoms, recent access)
 * - Cold tier: R2 (low STI atoms, archival)
 * 
 * Features:
 * - Automatic tiering based on attention values
 * - Lazy loading with pre-fetching
 * - Compression for cold storage
 * - Batch operations for efficiency
 * - Attention-based eviction policies
 */

import { Atom, AttentionValue } from '../types/cognitive-v5';
import type { R2Bucket, KVNamespace, DurableObjectNamespace } from '@cloudflare/workers-types';

export interface StorageTier {
  name: 'hot' | 'warm' | 'cold';
  minSTI: number;
  maxSTI: number;
  accessLatency: number; // ms
  costPerGB: number;
}

export interface AtomMetadata {
  atomId: string;
  tier: 'hot' | 'warm' | 'cold';
  size: number;
  lastAccessed: number;
  accessCount: number;
  attentionValue: AttentionValue;
  compressionRatio?: number;
}

export interface TieringPolicy {
  hotThreshold: number;   // STI >= this -> hot tier
  warmThreshold: number;  // STI >= this -> warm tier
  coldThreshold: number;  // STI < this -> cold tier
  evictionAge: number;    // ms before considering eviction
  preFetchThreshold: number; // Probability threshold for pre-fetching
}

export interface StorageMetrics {
  hotTier: {
    atomCount: number;
    totalSize: number;
    avgAccessTime: number;
  };
  warmTier: {
    atomCount: number;
    totalSize: number;
    avgAccessTime: number;
  };
  coldTier: {
    atomCount: number;
    totalSize: number;
    avgAccessTime: number;
    compressionRatio: number;
  };
  migrations: {
    hotToWarm: number;
    warmToCold: number;
    coldToWarm: number;
    warmToHot: number;
  };
}

/**
 * Enhanced R2 Cold Storage Manager
 */
export class R2ColdStorageEnhanced {
  private metadata: Map<string, AtomMetadata>;
  private tieringPolicy: TieringPolicy;
  private metrics: StorageMetrics;
  
  constructor(
    private env: {
      R2_COLD_STORAGE: R2Bucket;
      KV_WARM_STORAGE: KVNamespace;
      ATOMSPACE_DO: DurableObjectNamespace;
      STORAGE_METADATA: KVNamespace;
    },
    policy?: Partial<TieringPolicy>
  ) {
    this.metadata = new Map();
    
    this.tieringPolicy = {
      hotThreshold: 80,
      warmThreshold: 40,
      coldThreshold: 10,
      evictionAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      preFetchThreshold: 0.7,
      ...policy
    };
    
    this.metrics = {
      hotTier: { atomCount: 0, totalSize: 0, avgAccessTime: 0 },
      warmTier: { atomCount: 0, totalSize: 0, avgAccessTime: 0 },
      coldTier: { atomCount: 0, totalSize: 0, avgAccessTime: 0, compressionRatio: 0 },
      migrations: { hotToWarm: 0, warmToCold: 0, coldToWarm: 0, warmToHot: 0 }
    };
  }

  /**
   * Store atom with automatic tier selection
   */
  async storeAtom(atom: Atom): Promise<void> {
    const tier = this.determineTier(atom.attentionValue);
    const metadata: AtomMetadata = {
      atomId: atom.id,
      tier,
      size: this.estimateSize(atom),
      lastAccessed: Date.now(),
      accessCount: 0,
      attentionValue: atom.attentionValue
    };
    
    switch (tier) {
      case 'hot':
        await this.storeInHotTier(atom);
        break;
      case 'warm':
        await this.storeInWarmTier(atom);
        break;
      case 'cold':
        await this.storeInColdTier(atom);
        break;
    }
    
    await this.updateMetadata(metadata);
    this.updateMetrics(tier, 'add', metadata.size);
  }

  /**
   * Retrieve atom with automatic tier promotion
   */
  async retrieveAtom(atomId: string): Promise<Atom | null> {
    const startTime = Date.now();
    let atom: Atom | null = null;
    let metadata = await this.getMetadata(atomId);
    
    if (!metadata) {
      return null;
    }
    
    // Try to retrieve from current tier
    switch (metadata.tier) {
      case 'hot':
        atom = await this.retrieveFromHotTier(atomId);
        break;
      case 'warm':
        atom = await this.retrieveFromWarmTier(atomId);
        break;
      case 'cold':
        atom = await this.retrieveFromColdTier(atomId);
        break;
    }
    
    if (!atom) {
      return null;
    }
    
    // Update metadata
    metadata.lastAccessed = Date.now();
    metadata.accessCount++;
    
    // Check if tier promotion is needed
    const newTier = this.determineTier(atom.attentionValue);
    if (newTier !== metadata.tier) {
      await this.migrateTier(atom, metadata.tier, newTier);
      metadata.tier = newTier;
    }
    
    await this.updateMetadata(metadata);
    
    // Record access time
    const accessTime = Date.now() - startTime;
    this.recordAccessTime(metadata.tier, accessTime);
    
    // Pre-fetch related atoms if likely to be accessed
    if (metadata.tier === 'cold' || metadata.tier === 'warm') {
      await this.preFetchRelated(atom);
    }
    
    return atom;
  }

  /**
   * Batch retrieve atoms
   */
  async retrieveBatch(atomIds: string[]): Promise<Map<string, Atom>> {
    const results = new Map<string, Atom>();
    
    // Group by tier for efficient batch operations
    const byTier = new Map<'hot' | 'warm' | 'cold', string[]>();
    
    for (const atomId of atomIds) {
      const metadata = await this.getMetadata(atomId);
      if (metadata) {
        if (!byTier.has(metadata.tier)) {
          byTier.set(metadata.tier, []);
        }
        byTier.get(metadata.tier)!.push(atomId);
      }
    }
    
    // Batch retrieve from each tier
    const promises: Promise<void>[] = [];
    
    if (byTier.has('hot')) {
      promises.push(
        this.retrieveBatchFromHotTier(byTier.get('hot')!).then(atoms => {
          atoms.forEach((atom, id) => results.set(id, atom));
        })
      );
    }
    
    if (byTier.has('warm')) {
      promises.push(
        this.retrieveBatchFromWarmTier(byTier.get('warm')!).then(atoms => {
          atoms.forEach((atom, id) => results.set(id, atom));
        })
      );
    }
    
    if (byTier.has('cold')) {
      promises.push(
        this.retrieveBatchFromColdTier(byTier.get('cold')!).then(atoms => {
          atoms.forEach((atom, id) => results.set(id, atom));
        })
      );
    }
    
    await Promise.all(promises);
    
    return results;
  }

  /**
   * Run tiering maintenance - migrate atoms between tiers
   */
  async runTieringMaintenance(): Promise<void> {
    // Get all metadata
    const allMetadata = await this.getAllMetadata();
    
    const migrations: Array<{ atom: Atom; from: 'hot' | 'warm' | 'cold'; to: 'hot' | 'warm' | 'cold' }> = [];
    
    for (const metadata of allMetadata) {
      const atom = await this.retrieveAtom(metadata.atomId);
      if (!atom) continue;
      
      const newTier = this.determineTier(atom.attentionValue);
      
      if (newTier !== metadata.tier) {
        migrations.push({ atom, from: metadata.tier, to: newTier });
      }
    }
    
    // Execute migrations in batches
    const batchSize = 100;
    for (let i = 0; i < migrations.length; i += batchSize) {
      const batch = migrations.slice(i, i + batchSize);
      await Promise.all(
        batch.map(({ atom, from, to }) => this.migrateTier(atom, from, to))
      );
    }
  }

  /**
   * Evict old cold-tier atoms
   */
  async evictOldAtoms(): Promise<number> {
    const allMetadata = await this.getAllMetadata();
    const now = Date.now();
    let evictedCount = 0;
    
    for (const metadata of allMetadata) {
      if (metadata.tier === 'cold') {
        const age = now - metadata.lastAccessed;
        
        if (age > this.tieringPolicy.evictionAge && metadata.attentionValue.sti < 5) {
          await this.deleteAtom(metadata.atomId);
          evictedCount++;
        }
      }
    }
    
    return evictedCount;
  }

  /**
   * Get storage metrics
   */
  getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }

  /**
   * Determine appropriate tier based on attention value
   */
  private determineTier(attentionValue: AttentionValue): 'hot' | 'warm' | 'cold' {
    const sti = attentionValue.sti;
    
    if (sti >= this.tieringPolicy.hotThreshold) {
      return 'hot';
    } else if (sti >= this.tieringPolicy.warmThreshold) {
      return 'warm';
    } else {
      return 'cold';
    }
  }

  /**
   * Store atom in hot tier (Durable Objects)
   */
  private async storeInHotTier(atom: Atom): Promise<void> {
    const atomSpaceId = this.env.ATOMSPACE_DO.idFromName('main');
    const stub = this.env.ATOMSPACE_DO.get(atomSpaceId);
    
    await stub.fetch('https://internal/atom', {
      method: 'POST',
      body: JSON.stringify(atom)
    });
  }

  /**
   * Store atom in warm tier (KV)
   */
  private async storeInWarmTier(atom: Atom): Promise<void> {
    await this.env.KV_WARM_STORAGE.put(
      `atom:${atom.id}`,
      JSON.stringify(atom),
      { expirationTtl: 86400 } // 24 hours
    );
  }

  /**
   * Store atom in cold tier (R2 with compression)
   */
  private async storeInColdTier(atom: Atom): Promise<void> {
    const json = JSON.stringify(atom);
    const compressed = await this.compress(json);
    
    await this.env.R2_COLD_STORAGE.put(`atom:${atom.id}`, compressed, {
      customMetadata: {
        originalSize: json.length.toString(),
        compressedSize: compressed.byteLength.toString(),
        compressionRatio: (compressed.byteLength / json.length).toString()
      }
    });
  }

  /**
   * Retrieve atom from hot tier
   */
  private async retrieveFromHotTier(atomId: string): Promise<Atom | null> {
    const atomSpaceId = this.env.ATOMSPACE_DO.idFromName('main');
    const stub = this.env.ATOMSPACE_DO.get(atomSpaceId);
    
    const response = await stub.fetch(`https://internal/atom/${atomId}`);
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  }

  /**
   * Retrieve atom from warm tier
   */
  private async retrieveFromWarmTier(atomId: string): Promise<Atom | null> {
    const data = await this.env.KV_WARM_STORAGE.get(`atom:${atomId}`, 'json');
    return data as Atom | null;
  }

  /**
   * Retrieve atom from cold tier
   */
  private async retrieveFromColdTier(atomId: string): Promise<Atom | null> {
    const object = await this.env.R2_COLD_STORAGE.get(`atom:${atomId}`);
    
    if (!object) {
      return null;
    }
    
    const compressed = await object.arrayBuffer();
    const json = await this.decompress(compressed);
    return JSON.parse(json);
  }

  /**
   * Batch retrieve from hot tier
   */
  private async retrieveBatchFromHotTier(atomIds: string[]): Promise<Map<string, Atom>> {
    const results = new Map<string, Atom>();
    
    // Durable Objects don't have native batch operations, so we parallelize
    const promises = atomIds.map(async (id) => {
      const atom = await this.retrieveFromHotTier(id);
      if (atom) {
        results.set(id, atom);
      }
    });
    
    await Promise.all(promises);
    
    return results;
  }

  /**
   * Batch retrieve from warm tier
   */
  private async retrieveBatchFromWarmTier(atomIds: string[]): Promise<Map<string, Atom>> {
    const results = new Map<string, Atom>();
    
    // KV doesn't have native batch get, so we parallelize
    const promises = atomIds.map(async (id) => {
      const atom = await this.retrieveFromWarmTier(id);
      if (atom) {
        results.set(id, atom);
      }
    });
    
    await Promise.all(promises);
    
    return results;
  }

  /**
   * Batch retrieve from cold tier
   */
  private async retrieveBatchFromColdTier(atomIds: string[]): Promise<Map<string, Atom>> {
    const results = new Map<string, Atom>();
    
    // R2 supports batch operations
    const promises = atomIds.map(async (id) => {
      const atom = await this.retrieveFromColdTier(id);
      if (atom) {
        results.set(id, atom);
      }
    });
    
    await Promise.all(promises);
    
    return results;
  }

  /**
   * Migrate atom between tiers
   */
  private async migrateTier(
    atom: Atom,
    from: 'hot' | 'warm' | 'cold',
    to: 'hot' | 'warm' | 'cold'
  ): Promise<void> {
    // Store in new tier
    switch (to) {
      case 'hot':
        await this.storeInHotTier(atom);
        this.metrics.migrations.warmToHot++;
        break;
      case 'warm':
        await this.storeInWarmTier(atom);
        if (from === 'hot') this.metrics.migrations.hotToWarm++;
        if (from === 'cold') this.metrics.migrations.coldToWarm++;
        break;
      case 'cold':
        await this.storeInColdTier(atom);
        this.metrics.migrations.warmToCold++;
        break;
    }
    
    // Delete from old tier
    await this.deleteFromTier(atom.id, from);
    
    // Update metrics
    const size = this.estimateSize(atom);
    this.updateMetrics(from, 'remove', size);
    this.updateMetrics(to, 'add', size);
  }

  /**
   * Delete atom from specific tier
   */
  private async deleteFromTier(atomId: string, tier: 'hot' | 'warm' | 'cold'): Promise<void> {
    switch (tier) {
      case 'hot':
        const atomSpaceId = this.env.ATOMSPACE_DO.idFromName('main');
        const stub = this.env.ATOMSPACE_DO.get(atomSpaceId);
        await stub.fetch(`https://internal/atom/${atomId}`, { method: 'DELETE' });
        break;
      case 'warm':
        await this.env.KV_WARM_STORAGE.delete(`atom:${atomId}`);
        break;
      case 'cold':
        await this.env.R2_COLD_STORAGE.delete(`atom:${atomId}`);
        break;
    }
  }

  /**
   * Delete atom completely
   */
  private async deleteAtom(atomId: string): Promise<void> {
    const metadata = await this.getMetadata(atomId);
    if (!metadata) return;
    
    await this.deleteFromTier(atomId, metadata.tier);
    await this.env.STORAGE_METADATA.delete(`metadata:${atomId}`);
    this.metadata.delete(atomId);
    
    this.updateMetrics(metadata.tier, 'remove', metadata.size);
  }

  /**
   * Pre-fetch atoms likely to be accessed soon
   */
  private async preFetchRelated(atom: Atom): Promise<void> {
    // For links, pre-fetch connected atoms
    if (atom.type.includes('Link') && 'outgoing' in atom) {
      const link = atom as any;
      const relatedIds = link.outgoing || [];
      
      // Pre-fetch to warm tier
      for (const relatedId of relatedIds.slice(0, 5)) {
        const metadata = await this.getMetadata(relatedId);
        if (metadata && metadata.tier === 'cold') {
          const relatedAtom = await this.retrieveFromColdTier(relatedId);
          if (relatedAtom) {
            await this.storeInWarmTier(relatedAtom);
          }
        }
      }
    }
  }

  /**
   * Compress data for cold storage
   */
  private async compress(data: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const input = encoder.encode(data);
    
    // Use CompressionStream if available
    if (typeof CompressionStream !== 'undefined') {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(input);
          controller.close();
        }
      });
      
      const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
      const reader = compressedStream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result.buffer;
    }
    
    // Fallback: no compression - use slice to get a proper ArrayBuffer
    return input.buffer.slice(0) as ArrayBuffer;
  }

  /**
   * Decompress data from cold storage
   */
  private async decompress(data: ArrayBuffer): Promise<string> {
    // Use DecompressionStream if available
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(data));
          controller.close();
        }
      });
      
      const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
      const reader = decompressedStream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      const decoder = new TextDecoder();
      return decoder.decode(result);
    }
    
    // Fallback: no decompression
    const decoder = new TextDecoder();
    return decoder.decode(data);
  }

  /**
   * Update metadata
   */
  private async updateMetadata(metadata: AtomMetadata): Promise<void> {
    await this.env.STORAGE_METADATA.put(
      `metadata:${metadata.atomId}`,
      JSON.stringify(metadata)
    );
    this.metadata.set(metadata.atomId, metadata);
  }

  /**
   * Get metadata
   */
  private async getMetadata(atomId: string): Promise<AtomMetadata | null> {
    let metadata = this.metadata.get(atomId);
    
    if (!metadata) {
      const data = await this.env.STORAGE_METADATA.get(`metadata:${atomId}`, 'json');
      if (data) {
        metadata = data as AtomMetadata;
        this.metadata.set(atomId, metadata);
      }
    }
    
    return metadata || null;
  }

  /**
   * Get all metadata (for maintenance)
   */
  private async getAllMetadata(): Promise<AtomMetadata[]> {
    const list = await this.env.STORAGE_METADATA.list({ prefix: 'metadata:' });
    const promises = list.keys.map(async (key) => {
      const data = await this.env.STORAGE_METADATA.get(key.name, 'json');
      return data as AtomMetadata;
    });
    
    return await Promise.all(promises);
  }

  /**
   * Estimate atom size in bytes
   */
  private estimateSize(atom: Atom): number {
    return JSON.stringify(atom).length;
  }

  /**
   * Update metrics
   */
  private updateMetrics(tier: 'hot' | 'warm' | 'cold', operation: 'add' | 'remove', size: number): void {
    const tierMetrics = this.metrics[`${tier}Tier`];
    
    if (operation === 'add') {
      tierMetrics.atomCount++;
      tierMetrics.totalSize += size;
    } else {
      tierMetrics.atomCount--;
      tierMetrics.totalSize -= size;
    }
  }

  /**
   * Record access time for tier
   */
  private recordAccessTime(tier: 'hot' | 'warm' | 'cold', accessTime: number): void {
    const tierMetrics = this.metrics[`${tier}Tier`];
    
    // Moving average
    if (tierMetrics.avgAccessTime === 0) {
      tierMetrics.avgAccessTime = accessTime;
    } else {
      tierMetrics.avgAccessTime = tierMetrics.avgAccessTime * 0.9 + accessTime * 0.1;
    }
  }
}
