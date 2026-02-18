/**
 * FlareCog v4.0 Type Definitions
 * 
 * Complete type definitions for all CloudFlare bindings and cognitive structures.
 */

import { Ai, Queue, VectorizeIndex } from '@cloudflare/workers-types';

// ==================== Environment Bindings ====================

export interface Env {
  // Durable Objects
  ATOMSPACE: DurableObjectNamespace;
  MIND_AGENT: DurableObjectNamespace;
  WS_MANAGER: DurableObjectNamespace;
  ALARM_SCHEDULER: DurableObjectNamespace;

  // D1 Database
  D1_COORDINATION: D1Database;

  // Hyperdrive
  HYPERDRIVE: Hyperdrive;

  // R2 Storage
  R2_ATOMSPACE: R2Bucket;

  // KV Namespaces
  ATTENTION_CACHE: KVNamespace;
  VISION_CACHE: KVNamespace;
  COORDINATION_CACHE: KVNamespace;
  STORAGE_CACHE: KVNamespace;
  QUEUE_STATS: KVNamespace;
  SYNERGY_STATE: KVNamespace;
  ECHO_STATE: KVNamespace;

  // Queues
  COGNITIVE_QUEUE: Queue;
  PRIORITY_QUEUE: Queue;

  // AI
  AI: Ai;

  // Vectorize
  VECTORIZE: VectorizeIndex;

  // Environment Variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  ECAN_DECAY_RATE: string;
  ECAN_SPREAD_FRACTION: string;
  SYNERGY_CYCLE_TIMEOUT: string;
  ECHO_AWARENESS_THRESHOLD: string;
}

// ==================== Core Atom Types ====================

export interface TruthValue {
  strength: number;     // 0 to 1
  confidence: number;   // 0 to 1
}

export interface AttentionValue {
  sti: number;          // Short-Term Importance (-100 to 100)
  lti: number;          // Long-Term Importance (0 to 100)
  vlti: boolean;        // Very Long-Term Importance flag
}

export interface Atom {
  id: string;
  type: string;
  name?: string;
  outgoing?: string[];
  truthValue: TruthValue;
  attention?: AttentionValue;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface Node extends Atom {
  name: string;
}

export interface Link extends Atom {
  outgoing: string[];
}

// ==================== Cognitive Types ====================

export type CognitiveComponent = 
  | 'pln'
  | 'pattern'
  | 'attention'
  | 'learning'
  | 'perception'
  | 'action'
  | 'memory'
  | 'language';

export type ConsciousnessStream = 'perception' | 'action' | 'simulation';

export interface SynergyInteraction {
  source: CognitiveComponent;
  target: CognitiveComponent;
  type: 'request' | 'provide' | 'modulate';
  data: any;
  timestamp: number;
}

export interface EmergentInsight {
  id: string;
  type: 'pattern' | 'inference' | 'association' | 'prediction';
  content: any;
  confidence: number;
  contributingComponents: CognitiveComponent[];
  timestamp: number;
}

// ==================== ECAN Types ====================

export interface HebbianLink {
  sourceId: string;
  targetId: string;
  strength: number;
  timestamp: number;
}

export interface AttentionUpdateResult {
  atomId: string;
  previousAttention: AttentionValue;
  newAttention: AttentionValue;
  delta: { sti: number; lti: number };
}

export interface AttentionSpreadResult {
  sourceId: string;
  affected: Array<{ atomId: string; stiDelta: number }>;
  totalSpread: number;
}

// ==================== Deep Tree Echo Types ====================

export interface SalienceLandscape {
  peaks: Array<{ id: string; salience: number; position: [number, number, number] }>;
  valleys: Array<{ id: string; depth: number; position: [number, number, number] }>;
  gradients: Array<{ from: string; to: string; strength: number }>;
}

export interface Affordance {
  id: string;
  type: 'physical' | 'cognitive' | 'social' | 'abstract';
  description: string;
  relevance: number;
  cost: number;
  benefit: number;
}

export interface StreamState {
  stream: ConsciousnessStream;
  currentStep: number;
  salienceLandscape: SalienceLandscape;
  affordances: Affordance[];
  attention: number;
  content: any;
}

export interface EmergentSelf {
  identity: string;
  capabilities: string[];
  limitations: string[];
  goals: string[];
  currentFocus: string;
  awarenessLevel: number;
}

export interface EntelechyState {
  potential: string[];
  actualized: string[];
  inProgress: string[];
  blocked: string[];
}

export interface EchoState {
  echoId: string;
  iteration: number;
  streams: Record<ConsciousnessStream, StreamState>;
  emergentSelf: EmergentSelf;
  entelechy: EntelechyState;
  timestamp: number;
}

// ==================== Queue Types ====================

export type CognitiveTaskCategory = 
  | 'inference'
  | 'reasoning'
  | 'attention'
  | 'memory'
  | 'sync'
  | 'perception'
  | 'action';

export interface CognitiveTask {
  taskId: string;
  category: CognitiveTaskCategory;
  priority: number;
  payload: Record<string, any>;
  createdAt: number;
  deadline?: number;
}

export interface BatchedMessage {
  batchId: string;
  category: CognitiveTaskCategory;
  tasks: CognitiveTask[];
  createdAt: number;
  totalTasks: number;
}

export interface BatchResult {
  batchId: string;
  processedCount: number;
  successCount: number;
  failedCount: number;
  processingTime: number;
  results: Array<{
    taskId: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
}

// ==================== Storage Types ====================

export interface SnapshotMetadata {
  key: string;
  version: number;
  atomCount: number;
  size: number;
  compressedSize: number;
  checksum: string;
  createdAt: number;
}

export interface StorageStats {
  totalSnapshots: number;
  totalSize: number;
  oldestSnapshot: number;
  newestSnapshot: number;
}

// ==================== Coordination Types ====================

export interface VectorClock {
  [nodeId: string]: number;
}

export interface CoordinationState {
  atomspaceId: string;
  vectorClock: VectorClock;
  lastSync: number;
  conflictCount: number;
}

export interface ConflictResolution {
  atomId: string;
  strategy: 'last-write-wins' | 'merge' | 'manual';
  resolvedValue: any;
  timestamp: number;
}

// ==================== Vision Types ====================

export type VisionTask = 'detect' | 'classify' | 'describe' | 'segment' | 'answer';

export interface VisionResult {
  task: VisionTask;
  results: any;
  latency: number;
  cached: boolean;
}

export interface ObjectDetection {
  label: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ImageClassification {
  label: string;
  confidence: number;
}

// ==================== API Response Types ====================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ==================== WebSocket Types ====================

export type CognitiveEventType = 
  | 'atom_created'
  | 'atom_updated'
  | 'atom_deleted'
  | 'attention_changed'
  | 'inference_completed'
  | 'pattern_discovered'
  | 'synergy_cycle'
  | 'echo_iteration';

export interface CognitiveEvent {
  type: CognitiveEventType;
  instanceId: string;
  data: any;
  timestamp: number;
}

export interface WebSocketSubscription {
  clientId: string;
  eventTypes: CognitiveEventType[];
  instanceIds: string[];
}

// ==================== Hyperdrive Types ====================

export interface Hyperdrive {
  connectionString: string;
}

// Re-export for convenience
export type { Ai, Queue, VectorizeIndex };
