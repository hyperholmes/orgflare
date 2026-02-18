/**
 * FlareCog v5.0 Type Definitions
 * 
 * Complete type definitions for all CloudFlare bindings and cognitive structures.
 * Extends v4 types with new systems.
 */

import { Ai, Queue, VectorizeIndex, DurableObjectNamespace, D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types';

export type { DurableObjectNamespace, D1Database, R2Bucket, KVNamespace };

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
  R2_COLD_STORAGE: R2Bucket;

  // KV Namespaces
  ATTENTION_CACHE: KVNamespace;
  VISION_CACHE: KVNamespace;
  COORDINATION_CACHE: KVNamespace;
  STORAGE_CACHE: KVNamespace;
  QUEUE_STATS: KVNamespace;
  SYNERGY_STATE: KVNamespace;
  ECHO_STATE: KVNamespace;
  KV_WARM_STORAGE: KVNamespace;
  STORAGE_METADATA: KVNamespace;

  // New v5 KV Namespaces
  MOSES_STATE: KVNamespace;
  PLN_CACHE: KVNamespace;
  SENSORIMOTOR_STATE: KVNamespace;
  MEMORY_STORE: KVNamespace;
  INSTANCE_REGISTRY: KVNamespace;

  // Multi-tenant platform bindings
  TENANT_REGISTRY: KVNamespace;
  USAGE_TRACKER: KVNamespace;
  SHARED_KNOWLEDGE: KVNamespace;
  TENANT_ATOMSPACE_DO: DurableObjectNamespace;

  // Queues
  COGNITIVE_QUEUE: Queue<unknown>;
  PRIORITY_QUEUE: Queue<unknown>;
  INFERENCE_QUEUE: Queue<unknown>;
  CONSOLIDATION_QUEUE: Queue<unknown>;
  COORDINATION_QUEUE: Queue<unknown>;

  // Task Results KV
  TASK_RESULTS: KVNamespace;

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
  vlti: number;         // Very Long-Term Importance (0 to 100)
}

export interface Atom {
  id: string;
  type: string;
  name?: string;
  outgoing?: string[];
  truthValue: TruthValue;
  attentionValue: AttentionValue;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
}

export interface Node extends Atom {
  name: string;
}

export interface Link extends Atom {
  outgoing: string[];
}

// ==================== MOSES Types ====================

export type ComboNodeType = 
  | 'and' | 'or' | 'not'
  | 'plus' | 'minus' | 'times' | 'div'
  | 'sin' | 'cos' | 'exp' | 'log'
  | 'if' | 'cond'
  | 'arg' | 'const' | 'impulse' | 'null';

export interface ComboNode {
  type: ComboNodeType;
  value?: number | string;
  argIndex?: number;
  children?: ComboNode[];
}

export interface MOSESIndividual {
  id: string;
  tree: ComboNode;
  score: number;
  complexity: number;
  generation: number;
  parentIds: string[];
}

export interface MOSESDeme {
  id: string;
  exemplar: ComboNode;
  population: MOSESIndividual[];
  generation: number;
  bestScore: number;
  stagnationCount: number;
}

export interface TrainingExample {
  inputs: number[];
  output: number | boolean;
  weight?: number;
}

// ==================== PLN Types ====================

export type PLNRuleType = 
  | 'deduction'
  | 'induction'
  | 'abduction'
  | 'modus_ponens'
  | 'modus_tollens'
  | 'and_introduction'
  | 'or_introduction'
  | 'not_introduction'
  | 'revision';

export interface InferenceStep {
  rule: PLNRuleType;
  premises: Atom[];
  conclusion: Atom;
  truthValue: TruthValue;
  confidence: number;
  timestamp: number;
}

export interface InferenceChain {
  id: string;
  goal?: Atom;
  steps: InferenceStep[];
  finalConclusion?: Atom;
  totalConfidence: number;
  timestamp: number;
}

// ==================== Sensorimotor Types ====================

export type SensorType = 
  | 'text' | 'image' | 'audio' | 'structured'
  | 'time' | 'location' | 'social' | 'financial' | 'environmental';

export type ActuatorType = 
  | 'text' | 'image' | 'audio' | 'api_call'
  | 'database' | 'notification' | 'email' | 'webhook' | 'file';

export interface SensorConfig {
  id: string;
  type: SensorType;
  name: string;
  endpoint?: string;
  apiKey?: string;
  pollInterval?: number;
  enabled: boolean;
}

export interface ActuatorConfig {
  id: string;
  type: ActuatorType;
  name: string;
  endpoint?: string;
  apiKey?: string;
  rateLimit?: number;
  enabled: boolean;
}

export interface Perception {
  id: string;
  sensorId: string;
  sensorType: SensorType;
  timestamp: number;
  rawData: any;
  processedData: any;
  confidence: number;
}

export interface Action {
  id: string;
  actuatorId: string;
  actuatorType: ActuatorType;
  timestamp: number;
  command: any;
  result?: any;
  success: boolean;
  error?: string;
}

export interface GroundingEntry {
  symbolId: string;
  symbolName: string;
  groundingType: 'entity' | 'property' | 'relation' | 'action';
  externalId?: string;
  externalSource?: string;
  lastUpdated: number;
}

// ==================== Attention Agent Types ====================

export interface AAAgentConfig {
  focusThreshold: number;
  focusSize: number;
  stiDecayRate: number;
  ltiDecayRate: number;
  rentRate: number;
  wageRate: number;
  spreadFraction: number;
  maxSpreadDepth: number;
  forgetThreshold: number;
  forgetProbability: number;
  cycleInterval: number;
  explorationRate: number;
}

export interface AAAgentState {
  instanceId: string;
  config: AAAgentConfig;
  cycleCount: number;
  lastCycleTime: number;
  focusBoundary: number;
  totalSTI: number;
  totalLTI: number;
  atomCount: number;
  focusCount: number;
  forgottenCount: number;
}

export interface AttentionEvent {
  type: 'decay' | 'spread' | 'rent' | 'wage' | 'forget' | 'boost' | 'access';
  atomId: string;
  previousSTI: number;
  newSTI: number;
  delta: number;
  timestamp: number;
}

// ==================== Memory Types ====================

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: any;
  encoding: number[];
  strength: number;
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
  associations: string[];
  metadata: Record<string, any>;
}

export interface Schema {
  id: string;
  name: string;
  type: string;
  slots: SchemaSlot[];
  instances: string[];
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

export interface SchemaSlot {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
  constraints?: string[];
}

export interface ConsolidationSession {
  id: string;
  startTime: number;
  endTime?: number;
  phases: string[];
  currentPhase: string;
  stats: ConsolidationStats;
  status: 'running' | 'completed' | 'failed';
}

export interface ConsolidationStats {
  memoriesProcessed: number;
  memoriesStrengthened: number;
  memoriesPruned: number;
  patternsExtracted: number;
  associationsCreated: number;
  schemaUpdates: number;
  duration: number;
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

// ==================== Hyperdrive Types ====================

export interface Hyperdrive {
  connectionString: string;
}

// Re-export for convenience
export type { Ai, Queue, VectorizeIndex };
