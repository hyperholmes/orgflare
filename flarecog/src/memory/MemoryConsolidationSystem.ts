/**
 * MemoryConsolidationSystem.ts
 * 
 * Memory consolidation system for FlareCog that implements sleep-like
 * offline processing to strengthen important memories and prune irrelevant ones.
 * 
 * Key concepts:
 * - Consolidation: Transfer from short-term to long-term memory
 * - Replay: Re-activation of recent experiences
 * - Pruning: Removal of low-importance memories
 * - Generalization: Extracting patterns from specific experiences
 * - Schema formation: Building abstract knowledge structures
 */

import { Ai } from '@cloudflare/workers-types';

// ==================== Types ====================

/**
 * Memory types
 */
type MemoryType = 
  | 'episodic'    // Specific experiences/events
  | 'semantic'    // General knowledge/facts
  | 'procedural'  // Skills/procedures
  | 'working';    // Active short-term memory

/**
 * Memory entry
 */
interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: any;
  encoding: number[];  // Vector embedding
  strength: number;    // 0-1, how well consolidated
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
  associations: string[];  // IDs of related memories
  metadata: Record<string, any>;
}

/**
 * Consolidation phase
 */
type ConsolidationPhase = 
  | 'replay'        // Re-activate recent memories
  | 'strengthen'    // Increase strength of important memories
  | 'prune'         // Remove weak memories
  | 'generalize'    // Extract patterns
  | 'integrate';    // Connect to existing knowledge

/**
 * Consolidation session
 */
interface ConsolidationSession {
  id: string;
  startTime: number;
  endTime?: number;
  phases: ConsolidationPhase[];
  currentPhase: ConsolidationPhase;
  stats: ConsolidationStats;
  status: 'running' | 'completed' | 'failed';
}

/**
 * Consolidation statistics
 */
interface ConsolidationStats {
  memoriesProcessed: number;
  memoriesStrengthened: number;
  memoriesPruned: number;
  patternsExtracted: number;
  associationsCreated: number;
  schemaUpdates: number;
  duration: number;
}

/**
 * Schema (abstract knowledge structure)
 */
interface Schema {
  id: string;
  name: string;
  type: string;
  slots: SchemaSlot[];
  instances: string[];  // Memory IDs that match this schema
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Schema slot
 */
interface SchemaSlot {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
  constraints?: string[];
}

/**
 * Replay event
 */
interface ReplayEvent {
  memoryId: string;
  timestamp: number;
  replayStrength: number;
  associationsActivated: string[];
}

/**
 * Consolidation configuration
 */
interface ConsolidationConfig {
  // Replay parameters
  replayBatchSize: number;
  replayIterations: number;
  
  // Strengthening parameters
  strengthenThreshold: number;
  strengthenRate: number;
  
  // Pruning parameters
  pruneThreshold: number;
  pruneAgeThreshold: number;  // Milliseconds
  
  // Generalization parameters
  minPatternSupport: number;
  maxPatternComplexity: number;
  
  // Integration parameters
  associationThreshold: number;
  maxAssociations: number;
}

// ==================== Environment ====================

interface Env {
  ATOMSPACE: DurableObjectNamespace;
  AI: Ai;
  MEMORY_STORE: KVNamespace;
  VECTORIZE: VectorizeIndex;
  COGNITIVE_QUEUE: Queue;
}

// ==================== Memory Consolidation System ====================

/**
 * MemoryConsolidationSystem
 * 
 * Implements sleep-like offline processing for memory consolidation.
 */
export class MemoryConsolidationSystem {
  private env: Env;
  private config: ConsolidationConfig;
  private statePrefix = 'memory:';
  private currentSession: ConsolidationSession | null = null;

  // Default configuration
  private static readonly DEFAULT_CONFIG: ConsolidationConfig = {
    replayBatchSize: 50,
    replayIterations: 3,
    strengthenThreshold: 0.3,
    strengthenRate: 0.1,
    pruneThreshold: 0.1,
    pruneAgeThreshold: 7 * 24 * 60 * 60 * 1000, // 7 days
    minPatternSupport: 3,
    maxPatternComplexity: 10,
    associationThreshold: 0.7,
    maxAssociations: 20
  };

  constructor(env: Env, config?: Partial<ConsolidationConfig>) {
    this.env = env;
    this.config = { ...MemoryConsolidationSystem.DEFAULT_CONFIG, ...config };
  }

  // ==================== Memory Storage ====================

  /**
   * Store a new memory
   */
  async storeMemory(
    instanceId: string,
    type: MemoryType,
    content: any,
    metadata?: Record<string, any>
  ): Promise<MemoryEntry> {
    // Generate embedding for the content
    const encoding = await this.generateEmbedding(content);

    const memory: MemoryEntry = {
      id: crypto.randomUUID(),
      type,
      content,
      encoding,
      strength: 0.5,  // Initial strength
      accessCount: 1,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
      associations: [],
      metadata: metadata || {}
    };

    // Store in KV
    await this.saveMemory(instanceId, memory);

    // Index in Vectorize for similarity search
    await this.indexMemory(instanceId, memory);

    // Find and create associations
    const associations = await this.findAssociations(instanceId, memory);
    memory.associations = associations.map(a => a.id);
    await this.saveMemory(instanceId, memory);

    return memory;
  }

  /**
   * Retrieve a memory
   */
  async retrieveMemory(
    instanceId: string,
    memoryId: string
  ): Promise<MemoryEntry | null> {
    const memory = await this.loadMemory(instanceId, memoryId);
    
    if (memory) {
      // Update access stats
      memory.accessCount++;
      memory.lastAccessed = Date.now();
      
      // Strengthen on access
      memory.strength = Math.min(1, memory.strength + 0.05);
      
      await this.saveMemory(instanceId, memory);
    }

    return memory;
  }

  /**
   * Search memories by similarity
   */
  async searchMemories(
    instanceId: string,
    query: string,
    limit: number = 10
  ): Promise<MemoryEntry[]> {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Search in Vectorize
    const results = await this.env.VECTORIZE.query(queryEmbedding, {
      topK: limit,
      filter: { instanceId }
    });

    // Load full memory entries
    const memories: MemoryEntry[] = [];
    for (const match of results.matches) {
      const memory = await this.loadMemory(instanceId, match.id);
      if (memory) {
        memories.push(memory);
      }
    }

    return memories;
  }

  // ==================== Consolidation ====================

  /**
   * Run a full consolidation session
   */
  async runConsolidation(instanceId: string): Promise<ConsolidationSession> {
    const session: ConsolidationSession = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      phases: ['replay', 'strengthen', 'prune', 'generalize', 'integrate'],
      currentPhase: 'replay',
      stats: this.createEmptyStats(),
      status: 'running'
    };

    this.currentSession = session;

    try {
      // Phase 1: Replay
      session.currentPhase = 'replay';
      await this.replayPhase(instanceId, session);

      // Phase 2: Strengthen
      session.currentPhase = 'strengthen';
      await this.strengthenPhase(instanceId, session);

      // Phase 3: Prune
      session.currentPhase = 'prune';
      await this.prunePhase(instanceId, session);

      // Phase 4: Generalize
      session.currentPhase = 'generalize';
      await this.generalizePhase(instanceId, session);

      // Phase 5: Integrate
      session.currentPhase = 'integrate';
      await this.integratePhase(instanceId, session);

      session.status = 'completed';
    } catch (error) {
      session.status = 'failed';
      console.error('Consolidation failed:', error);
    }

    session.endTime = Date.now();
    session.stats.duration = session.endTime - session.startTime;

    // Save session record
    await this.saveSession(instanceId, session);

    this.currentSession = null;
    return session;
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): ConsolidationStats {
    return {
      memoriesProcessed: 0,
      memoriesStrengthened: 0,
      memoriesPruned: 0,
      patternsExtracted: 0,
      associationsCreated: 0,
      schemaUpdates: 0,
      duration: 0
    };
  }

  // ==================== Consolidation Phases ====================

  /**
   * Phase 1: Replay recent memories
   */
  private async replayPhase(
    instanceId: string,
    session: ConsolidationSession
  ): Promise<void> {
    // Get recent memories
    const recentMemories = await this.getRecentMemories(instanceId);

    for (let iteration = 0; iteration < this.config.replayIterations; iteration++) {
      // Process in batches
      for (let i = 0; i < recentMemories.length; i += this.config.replayBatchSize) {
        const batch = recentMemories.slice(i, i + this.config.replayBatchSize);
        
        for (const memory of batch) {
          // Simulate replay by activating associated memories
          const replayEvent: ReplayEvent = {
            memoryId: memory.id,
            timestamp: Date.now(),
            replayStrength: 0.5 + Math.random() * 0.5,
            associationsActivated: []
          };

          // Activate associations
          for (const assocId of memory.associations) {
            const assocMemory = await this.loadMemory(instanceId, assocId);
            if (assocMemory) {
              // Strengthen association
              assocMemory.strength = Math.min(1, assocMemory.strength + 0.02);
              await this.saveMemory(instanceId, assocMemory);
              replayEvent.associationsActivated.push(assocId);
            }
          }

          // Strengthen the replayed memory
          memory.strength = Math.min(1, memory.strength + 0.03 * replayEvent.replayStrength);
          await this.saveMemory(instanceId, memory);

          session.stats.memoriesProcessed++;
        }
      }
    }
  }

  /**
   * Phase 2: Strengthen important memories
   */
  private async strengthenPhase(
    instanceId: string,
    session: ConsolidationSession
  ): Promise<void> {
    const memories = await this.getAllMemories(instanceId);

    for (const memory of memories) {
      // Calculate importance score
      const importance = this.calculateImportance(memory);

      if (importance >= this.config.strengthenThreshold) {
        // Strengthen based on importance
        const strengthIncrease = this.config.strengthenRate * importance;
        memory.strength = Math.min(1, memory.strength + strengthIncrease);

        // Convert to long-term if strength is high enough
        if (memory.strength > 0.8 && memory.type === 'working') {
          memory.type = 'episodic';
        }

        await this.saveMemory(instanceId, memory);
        session.stats.memoriesStrengthened++;
      }
    }
  }

  /**
   * Phase 3: Prune weak memories
   */
  private async prunePhase(
    instanceId: string,
    session: ConsolidationSession
  ): Promise<void> {
    const memories = await this.getAllMemories(instanceId);
    const now = Date.now();

    for (const memory of memories) {
      const age = now - memory.createdAt;
      
      // Check if memory should be pruned
      const shouldPrune = 
        memory.strength < this.config.pruneThreshold &&
        age > this.config.pruneAgeThreshold &&
        memory.accessCount < 3;

      if (shouldPrune) {
        // Remove from storage
        await this.deleteMemory(instanceId, memory.id);
        
        // Remove from associations of other memories
        await this.removeFromAssociations(instanceId, memory.id);

        session.stats.memoriesPruned++;
      }
    }
  }

  /**
   * Phase 4: Generalize patterns from memories
   */
  private async generalizePhase(
    instanceId: string,
    session: ConsolidationSession
  ): Promise<void> {
    // Get episodic memories for pattern extraction
    const episodicMemories = await this.getMemoriesByType(instanceId, 'episodic');

    // Cluster similar memories
    const clusters = await this.clusterMemories(episodicMemories);

    for (const cluster of clusters) {
      if (cluster.length >= this.config.minPatternSupport) {
        // Extract pattern from cluster
        const pattern = await this.extractPattern(cluster);

        if (pattern) {
          // Create or update schema
          await this.updateSchema(instanceId, pattern);
          session.stats.patternsExtracted++;
        }
      }
    }
  }

  /**
   * Phase 5: Integrate memories with existing knowledge
   */
  private async integratePhase(
    instanceId: string,
    session: ConsolidationSession
  ): Promise<void> {
    const memories = await this.getAllMemories(instanceId);

    for (const memory of memories) {
      // Find new associations
      const newAssociations = await this.findAssociations(instanceId, memory);
      
      for (const assoc of newAssociations) {
        if (!memory.associations.includes(assoc.id)) {
          memory.associations.push(assoc.id);
          session.stats.associationsCreated++;

          // Limit associations
          if (memory.associations.length > this.config.maxAssociations) {
            memory.associations = memory.associations.slice(-this.config.maxAssociations);
          }
        }
      }

      await this.saveMemory(instanceId, memory);

      // Link to relevant schemas
      const schemas = await this.findMatchingSchemas(instanceId, memory);
      for (const schema of schemas) {
        if (!schema.instances.includes(memory.id)) {
          schema.instances.push(memory.id);
          await this.saveSchema(instanceId, schema);
          session.stats.schemaUpdates++;
        }
      }
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Calculate memory importance
   */
  private calculateImportance(memory: MemoryEntry): number {
    const recencyFactor = 1 / (1 + (Date.now() - memory.lastAccessed) / (24 * 60 * 60 * 1000));
    const frequencyFactor = Math.min(1, memory.accessCount / 10);
    const associationFactor = Math.min(1, memory.associations.length / 5);

    return (recencyFactor + frequencyFactor + associationFactor) / 3;
  }

  /**
   * Generate embedding for content
   */
  private async generateEmbedding(content: any): Promise<number[]> {
    const text = typeof content === 'string' 
      ? content 
      : JSON.stringify(content);

    const response = await this.env.AI.run(
      '@cf/baai/bge-base-en-v1.5' as any,
      { text: [text] }
    );

    return (response as any).data?.[0] || new Array(768).fill(0);
  }

  /**
   * Index memory in Vectorize
   */
  private async indexMemory(
    instanceId: string,
    memory: MemoryEntry
  ): Promise<void> {
    await this.env.VECTORIZE.upsert([{
      id: memory.id,
      values: memory.encoding,
      metadata: {
        instanceId,
        type: memory.type,
        createdAt: memory.createdAt
      }
    }]);
  }

  /**
   * Find associations for a memory
   */
  private async findAssociations(
    instanceId: string,
    memory: MemoryEntry
  ): Promise<MemoryEntry[]> {
    // Search for similar memories
    const results = await this.env.VECTORIZE.query(memory.encoding, {
      topK: 10,
      filter: { instanceId }
    });

    const associations: MemoryEntry[] = [];
    for (const match of results.matches) {
      if (match.id !== memory.id && match.score >= this.config.associationThreshold) {
        const assocMemory = await this.loadMemory(instanceId, match.id);
        if (assocMemory) {
          associations.push(assocMemory);
        }
      }
    }

    return associations;
  }

  /**
   * Cluster memories by similarity
   */
  private async clusterMemories(
    memories: MemoryEntry[]
  ): Promise<MemoryEntry[][]> {
    if (memories.length < 2) return [memories];

    // Simple clustering based on embedding similarity
    const clusters: MemoryEntry[][] = [];
    const assigned = new Set<string>();

    for (const memory of memories) {
      if (assigned.has(memory.id)) continue;

      const cluster: MemoryEntry[] = [memory];
      assigned.add(memory.id);

      // Find similar memories
      for (const other of memories) {
        if (assigned.has(other.id)) continue;

        const similarity = this.cosineSimilarity(memory.encoding, other.encoding);
        if (similarity >= 0.8) {
          cluster.push(other);
          assigned.add(other.id);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Extract pattern from a cluster of memories
   */
  private async extractPattern(
    cluster: MemoryEntry[]
  ): Promise<{ name: string; type: string; slots: SchemaSlot[] } | null> {
    if (cluster.length < this.config.minPatternSupport) return null;

    // Use AI to extract common pattern
    const contents = cluster.map(m => JSON.stringify(m.content)).join('\n---\n');

    const response = await this.env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct-fast' as any,
      {
        prompt: `Analyze these ${cluster.length} related memories and extract a common pattern/schema:

${contents}

Return a JSON object with:
- name: A descriptive name for this pattern
- type: The category of pattern (event, concept, procedure, etc.)
- slots: Array of {name, type, required, description} for the pattern's components`,
        max_tokens: 500
      }
    );

    try {
      return JSON.parse((response as any).response);
    } catch {
      return null;
    }
  }

  /**
   * Update or create a schema
   */
  private async updateSchema(
    instanceId: string,
    pattern: { name: string; type: string; slots: SchemaSlot[] }
  ): Promise<void> {
    // Check if similar schema exists
    const existingSchemas = await this.getAllSchemas(instanceId);
    
    for (const schema of existingSchemas) {
      if (schema.name === pattern.name || schema.type === pattern.type) {
        // Update existing schema
        schema.slots = pattern.slots;
        schema.updatedAt = Date.now();
        schema.confidence = Math.min(1, schema.confidence + 0.1);
        await this.saveSchema(instanceId, schema);
        return;
      }
    }

    // Create new schema
    const schema: Schema = {
      id: crypto.randomUUID(),
      name: pattern.name,
      type: pattern.type,
      slots: pattern.slots,
      instances: [],
      confidence: 0.5,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.saveSchema(instanceId, schema);
  }

  /**
   * Find schemas matching a memory
   */
  private async findMatchingSchemas(
    instanceId: string,
    memory: MemoryEntry
  ): Promise<Schema[]> {
    const schemas = await this.getAllSchemas(instanceId);
    const matching: Schema[] = [];

    for (const schema of schemas) {
      // Check if memory content matches schema slots
      const content = memory.content;
      let matchCount = 0;

      for (const slot of schema.slots) {
        if (content[slot.name] !== undefined) {
          matchCount++;
        }
      }

      const matchRatio = matchCount / schema.slots.length;
      if (matchRatio >= 0.5) {
        matching.push(schema);
      }
    }

    return matching;
  }

  // ==================== Storage Operations ====================

  /**
   * Save memory to KV
   */
  private async saveMemory(
    instanceId: string,
    memory: MemoryEntry
  ): Promise<void> {
    const key = `${this.statePrefix}${instanceId}:memory:${memory.id}`;
    await this.env.MEMORY_STORE.put(key, JSON.stringify(memory));
  }

  /**
   * Load memory from KV
   */
  private async loadMemory(
    instanceId: string,
    memoryId: string
  ): Promise<MemoryEntry | null> {
    const key = `${this.statePrefix}${instanceId}:memory:${memoryId}`;
    return await this.env.MEMORY_STORE.get(key, 'json');
  }

  /**
   * Delete memory from KV
   */
  private async deleteMemory(
    instanceId: string,
    memoryId: string
  ): Promise<void> {
    const key = `${this.statePrefix}${instanceId}:memory:${memoryId}`;
    await this.env.MEMORY_STORE.delete(key);
  }

  /**
   * Get all memories for an instance
   */
  private async getAllMemories(instanceId: string): Promise<MemoryEntry[]> {
    const prefix = `${this.statePrefix}${instanceId}:memory:`;
    const list = await this.env.MEMORY_STORE.list({ prefix });
    
    const memories: MemoryEntry[] = [];
    for (const key of list.keys) {
      const memory = await this.env.MEMORY_STORE.get(key.name, 'json') as MemoryEntry;
      if (memory) {
        memories.push(memory);
      }
    }

    return memories;
  }

  /**
   * Get recent memories
   */
  private async getRecentMemories(
    instanceId: string,
    limit: number = 100
  ): Promise<MemoryEntry[]> {
    const memories = await this.getAllMemories(instanceId);
    return memories
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get memories by type
   */
  private async getMemoriesByType(
    instanceId: string,
    type: MemoryType
  ): Promise<MemoryEntry[]> {
    const memories = await this.getAllMemories(instanceId);
    return memories.filter(m => m.type === type);
  }

  /**
   * Remove memory from associations
   */
  private async removeFromAssociations(
    instanceId: string,
    memoryId: string
  ): Promise<void> {
    const memories = await this.getAllMemories(instanceId);
    
    for (const memory of memories) {
      const idx = memory.associations.indexOf(memoryId);
      if (idx !== -1) {
        memory.associations.splice(idx, 1);
        await this.saveMemory(instanceId, memory);
      }
    }
  }

  /**
   * Save schema
   */
  private async saveSchema(
    instanceId: string,
    schema: Schema
  ): Promise<void> {
    const key = `${this.statePrefix}${instanceId}:schema:${schema.id}`;
    await this.env.MEMORY_STORE.put(key, JSON.stringify(schema));
  }

  /**
   * Get all schemas
   */
  private async getAllSchemas(instanceId: string): Promise<Schema[]> {
    const prefix = `${this.statePrefix}${instanceId}:schema:`;
    const list = await this.env.MEMORY_STORE.list({ prefix });
    
    const schemas: Schema[] = [];
    for (const key of list.keys) {
      const schema = await this.env.MEMORY_STORE.get(key.name, 'json') as Schema;
      if (schema) {
        schemas.push(schema);
      }
    }

    return schemas;
  }

  /**
   * Save consolidation session
   */
  private async saveSession(
    instanceId: string,
    session: ConsolidationSession
  ): Promise<void> {
    const key = `${this.statePrefix}${instanceId}:session:${session.id}`;
    await this.env.MEMORY_STORE.put(key, JSON.stringify(session));
  }

  /**
   * Get consolidation history
   */
  async getConsolidationHistory(
    instanceId: string,
    limit: number = 10
  ): Promise<ConsolidationSession[]> {
    const prefix = `${this.statePrefix}${instanceId}:session:`;
    const list = await this.env.MEMORY_STORE.list({ prefix });
    
    const sessions: ConsolidationSession[] = [];
    for (const key of list.keys) {
      const session = await this.env.MEMORY_STORE.get(key.name, 'json') as ConsolidationSession;
      if (session) {
        sessions.push(session);
      }
    }

    return sessions
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(instanceId: string): Promise<{
    totalMemories: number;
    byType: Record<MemoryType, number>;
    avgStrength: number;
    totalSchemas: number;
    lastConsolidation?: number;
  }> {
    const memories = await this.getAllMemories(instanceId);
    const schemas = await this.getAllSchemas(instanceId);
    const sessions = await this.getConsolidationHistory(instanceId, 1);

    const byType: Record<MemoryType, number> = {
      episodic: 0,
      semantic: 0,
      procedural: 0,
      working: 0
    };

    let totalStrength = 0;
    for (const memory of memories) {
      byType[memory.type]++;
      totalStrength += memory.strength;
    }

    return {
      totalMemories: memories.length,
      byType,
      avgStrength: memories.length > 0 ? totalStrength / memories.length : 0,
      totalSchemas: schemas.length,
      lastConsolidation: sessions[0]?.endTime
    };
  }
}

export default MemoryConsolidationSystem;
