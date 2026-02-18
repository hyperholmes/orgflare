/**
 * ParallelR2Storage.ts
 * 
 * Optimized R2 storage with parallel transfers and compression
 * for high-throughput AtomSpace snapshot operations.
 * 
 * Expected improvement: 100 MB/s → 200+ MB/s throughput
 */

import { R2Bucket, R2Object, R2MultipartUpload } from '@cloudflare/workers-types';

// Configuration
const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB - use multipart above this
const PART_SIZE = 10 * 1024 * 1024; // 10MB per part
const MAX_CONCURRENT_PARTS = 10; // Parallel upload/download streams
const COMPRESSION_THRESHOLD = 1024; // Compress data larger than 1KB

// Types
interface StorageMetadata {
  atomspaceId: string;
  version: number;
  atomCount: number;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
  createdAt: number;
  checksum: string;
}

interface UploadResult {
  key: string;
  size: number;
  compressedSize: number;
  compressionRatio: number;
  uploadTime: number;
  throughputMBps: number;
}

interface DownloadResult {
  data: ArrayBuffer;
  metadata: StorageMetadata;
  downloadTime: number;
  throughputMBps: number;
}

// Environment bindings
interface Env {
  R2_ATOMSPACE: R2Bucket;
  STORAGE_CACHE: KVNamespace;
}

/**
 * ParallelR2Storage
 * 
 * High-performance R2 storage manager with:
 * - Parallel multipart uploads/downloads
 * - Automatic compression
 * - Caching layer for frequently accessed data
 */
export class ParallelR2Storage {
  private r2: R2Bucket;
  private cache: KVNamespace;
  private cachePrefix = 'r2cache:';
  private cacheTTL = 300; // 5 minutes for metadata cache

  constructor(env: Env) {
    this.r2 = env.R2_ATOMSPACE;
    this.cache = env.STORAGE_CACHE;
  }

  /**
   * Upload AtomSpace snapshot with parallel multipart and compression
   */
  async uploadSnapshot(
    atomspaceId: string,
    version: number,
    data: ArrayBuffer,
    options: {
      compress?: boolean;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const key = this.generateKey(atomspaceId, version);
    const shouldCompress = options.compress !== false && data.byteLength > COMPRESSION_THRESHOLD;
    
    // Compress if beneficial
    let uploadData = data;
    let compressed = false;
    
    if (shouldCompress) {
      const compressedData = await this.compress(data);
      // Only use compression if it actually reduces size
      if (compressedData.byteLength < data.byteLength * 0.9) {
        uploadData = compressedData;
        compressed = true;
      }
    }

    // Calculate checksum
    const checksum = await this.calculateChecksum(uploadData);

    // Prepare metadata
    const metadata: StorageMetadata = {
      atomspaceId,
      version,
      atomCount: 0, // Would be populated from actual atom data
      compressed,
      originalSize: data.byteLength,
      compressedSize: uploadData.byteLength,
      createdAt: Date.now(),
      checksum
    };

    // Choose upload strategy based on size
    if (uploadData.byteLength > MULTIPART_THRESHOLD) {
      await this.multipartUpload(key, uploadData, metadata);
    } else {
      await this.simpleUpload(key, uploadData, metadata);
    }

    const uploadTime = Date.now() - startTime;
    const throughputMBps = (uploadData.byteLength / (1024 * 1024)) / (uploadTime / 1000);

    // Cache metadata for quick lookups
    await this.cache.put(
      `${this.cachePrefix}meta:${key}`,
      JSON.stringify(metadata),
      { expirationTtl: this.cacheTTL }
    );

    return {
      key,
      size: data.byteLength,
      compressedSize: uploadData.byteLength,
      compressionRatio: compressed ? data.byteLength / uploadData.byteLength : 1,
      uploadTime,
      throughputMBps
    };
  }

  /**
   * Simple upload for small files
   */
  private async simpleUpload(
    key: string,
    data: ArrayBuffer,
    metadata: StorageMetadata
  ): Promise<void> {
    await this.r2.put(key, data, {
      customMetadata: {
        ...metadata,
        atomspaceId: metadata.atomspaceId,
        version: String(metadata.version),
        compressed: String(metadata.compressed),
        originalSize: String(metadata.originalSize),
        checksum: metadata.checksum
      } as any
    });
  }

  /**
   * Multipart upload for large files with parallel part uploads
   */
  private async multipartUpload(
    key: string,
    data: ArrayBuffer,
    metadata: StorageMetadata
  ): Promise<void> {
    // Create multipart upload
    const multipart = await this.r2.createMultipartUpload(key, {
      customMetadata: {
        atomspaceId: metadata.atomspaceId,
        version: String(metadata.version),
        compressed: String(metadata.compressed),
        originalSize: String(metadata.originalSize),
        checksum: metadata.checksum
      } as any
    });

    try {
      // Split data into parts
      const parts: Array<{ partNumber: number; data: ArrayBuffer }> = [];
      let offset = 0;
      let partNumber = 1;

      while (offset < data.byteLength) {
        const end = Math.min(offset + PART_SIZE, data.byteLength);
        parts.push({
          partNumber,
          data: data.slice(offset, end)
        });
        offset = end;
        partNumber++;
      }

      // Upload parts in parallel batches
      const uploadedParts: Array<{ partNumber: number; etag: string }> = [];
      
      for (let i = 0; i < parts.length; i += MAX_CONCURRENT_PARTS) {
        const batch = parts.slice(i, i + MAX_CONCURRENT_PARTS);
        const batchResults = await Promise.all(
          batch.map(async (part) => {
            const uploaded = await multipart.uploadPart(part.partNumber, part.data);
            return {
              partNumber: part.partNumber,
              etag: uploaded.etag
            };
          })
        );
        uploadedParts.push(...batchResults);
      }

      // Complete multipart upload
      await multipart.complete(uploadedParts);

    } catch (error) {
      // Abort on failure
      await multipart.abort();
      throw error;
    }
  }

  /**
   * Download AtomSpace snapshot with parallel range requests
   */
  async downloadSnapshot(
    atomspaceId: string,
    version: number
  ): Promise<DownloadResult> {
    const startTime = Date.now();
    const key = this.generateKey(atomspaceId, version);

    // Get object info first
    const head = await this.r2.head(key);
    if (!head) {
      throw new Error(`Snapshot not found: ${key}`);
    }

    const size = head.size;
    let data: ArrayBuffer;

    // Use parallel range requests for large files
    if (size > MULTIPART_THRESHOLD) {
      data = await this.parallelDownload(key, size);
    } else {
      const object = await this.r2.get(key);
      if (!object) {
        throw new Error(`Failed to download: ${key}`);
      }
      data = await object.arrayBuffer();
    }

    // Parse metadata
    const metadata: StorageMetadata = {
      atomspaceId: head.customMetadata?.atomspaceId || atomspaceId,
      version: parseInt(head.customMetadata?.version || String(version)),
      atomCount: parseInt(head.customMetadata?.atomCount || '0'),
      compressed: head.customMetadata?.compressed === 'true',
      originalSize: parseInt(head.customMetadata?.originalSize || String(size)),
      compressedSize: size,
      createdAt: head.uploaded.getTime(),
      checksum: head.customMetadata?.checksum || ''
    };

    // Decompress if needed
    if (metadata.compressed) {
      data = await this.decompress(data);
    }

    // Verify checksum
    const actualChecksum = await this.calculateChecksum(
      metadata.compressed ? await this.compress(data) : data
    );
    if (metadata.checksum && actualChecksum !== metadata.checksum) {
      throw new Error('Checksum mismatch - data may be corrupted');
    }

    const downloadTime = Date.now() - startTime;
    const throughputMBps = (size / (1024 * 1024)) / (downloadTime / 1000);

    return {
      data,
      metadata,
      downloadTime,
      throughputMBps
    };
  }

  /**
   * Parallel download using range requests
   */
  private async parallelDownload(key: string, size: number): Promise<ArrayBuffer> {
    const parts: Array<{ start: number; end: number }> = [];
    let offset = 0;

    while (offset < size) {
      const end = Math.min(offset + PART_SIZE, size) - 1;
      parts.push({ start: offset, end });
      offset = end + 1;
    }

    // Download parts in parallel
    const downloadedParts: Array<{ index: number; data: ArrayBuffer }> = [];

    for (let i = 0; i < parts.length; i += MAX_CONCURRENT_PARTS) {
      const batch = parts.slice(i, i + MAX_CONCURRENT_PARTS);
      const batchResults = await Promise.all(
        batch.map(async (part, batchIndex) => {
          const object = await this.r2.get(key, {
            range: { offset: part.start, length: part.end - part.start + 1 }
          });
          if (!object) {
            throw new Error(`Failed to download part ${i + batchIndex}`);
          }
          return {
            index: i + batchIndex,
            data: await object.arrayBuffer()
          };
        })
      );
      downloadedParts.push(...batchResults);
    }

    // Sort and concatenate parts
    downloadedParts.sort((a, b) => a.index - b.index);
    
    const result = new Uint8Array(size);
    let writeOffset = 0;
    for (const part of downloadedParts) {
      result.set(new Uint8Array(part.data), writeOffset);
      writeOffset += part.data.byteLength;
    }

    return result.buffer;
  }

  /**
   * List available snapshots for an AtomSpace
   */
  async listSnapshots(
    atomspaceId: string,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<{
    snapshots: Array<{ version: number; size: number; createdAt: Date }>;
    cursor?: string;
  }> {
    const prefix = `atomspace/${atomspaceId}/`;
    const listed = await this.r2.list({
      prefix,
      limit: options.limit || 100,
      cursor: options.cursor
    });

    const snapshots = listed.objects.map(obj => ({
      version: this.extractVersion(obj.key),
      size: obj.size,
      createdAt: obj.uploaded
    }));

    return {
      snapshots,
      cursor: listed.truncated ? listed.cursor : undefined
    };
  }

  /**
   * Delete old snapshots (keep N most recent)
   */
  async pruneSnapshots(atomspaceId: string, keepCount: number = 10): Promise<number> {
    const { snapshots } = await this.listSnapshots(atomspaceId, { limit: 1000 });
    
    // Sort by version descending
    snapshots.sort((a, b) => b.version - a.version);
    
    // Delete all but the most recent keepCount
    const toDelete = snapshots.slice(keepCount);
    
    for (const snapshot of toDelete) {
      const key = this.generateKey(atomspaceId, snapshot.version);
      await this.r2.delete(key);
      await this.cache.delete(`${this.cachePrefix}meta:${key}`);
    }

    return toDelete.length;
  }

  // ==================== Helper Methods ====================

  private generateKey(atomspaceId: string, version: number): string {
    return `atomspace/${atomspaceId}/v${version.toString().padStart(10, '0')}.snapshot`;
  }

  private extractVersion(key: string): number {
    const match = key.match(/v(\d+)\.snapshot$/);
    return match ? parseInt(match[1]) : 0;
  }

  private async compress(data: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new Response(data).body!;
    const compressed = stream.pipeThrough(new CompressionStream('gzip'));
    return new Response(compressed).arrayBuffer();
  }

  private async decompress(data: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new Response(data).body!;
    const decompressed = stream.pipeThrough(new DecompressionStream('gzip'));
    return new Response(decompressed).arrayBuffer();
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * AtomSpace serializer for R2 storage
 */
export class AtomSpaceSerializer {
  /**
   * Serialize AtomSpace to binary format
   */
  static serialize(atoms: Array<{
    type: string;
    name: string;
    truthValue: { strength: number; confidence: number };
    attentionValue?: { sti: number; lti: number };
    outgoing?: string[];
  }>): ArrayBuffer {
    const encoder = new TextEncoder();
    const json = JSON.stringify(atoms);
    return encoder.encode(json).buffer;
  }

  /**
   * Deserialize AtomSpace from binary format
   */
  static deserialize(data: ArrayBuffer): Array<{
    type: string;
    name: string;
    truthValue: { strength: number; confidence: number };
    attentionValue?: { sti: number; lti: number };
    outgoing?: string[];
  }> {
    const decoder = new TextDecoder();
    const json = decoder.decode(data);
    return JSON.parse(json);
  }
}

export default ParallelR2Storage;
