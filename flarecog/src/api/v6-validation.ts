/**
 * FlareCog v6.0 API Request Validation Schemas
 *
 * Zod schemas for validating incoming API requests
 */

import { z } from 'zod';

// ==================== Common Schemas ====================

export const TruthValueSchema = z.object({
  strength: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1)
});

export const AttentionValueSchema = z.object({
  sti: z.number(),
  lti: z.number().min(0),
  vlti: z.number().min(0).optional()
});

export const AtomSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  name: z.string().optional(),
  outgoing: z.array(z.string()).optional(),
  truthValue: TruthValueSchema.optional(),
  attentionValue: AttentionValueSchema.optional()
});

// ==================== Query Schemas ====================

// Define base schema without recursive reference
const BaseQueryConstraintSchema = z.object({
  type: z.enum(['type', 'truth', 'attention', 'topology', 'boolean']),
  field: z.string().optional(),
  operator: z.enum(['eq', 'gt', 'lt', 'gte', 'lte', 'contains', 'and', 'or', 'not']),
  value: z.any().optional()
});

// Inferred type for the constraint
type QueryConstraint = z.infer<typeof BaseQueryConstraintSchema> & {
  subConstraints?: QueryConstraint[];
};

// Full schema with optional subConstraints
export const QueryConstraintSchema: z.ZodType<QueryConstraint> = BaseQueryConstraintSchema.extend({
  subConstraints: z.lazy(() => z.array(QueryConstraintSchema)).optional()
});

export const QueryPatternSchema = z.object({
  type: z.string().min(1),
  variables: z.record(z.string()).optional(),
  constraints: z.array(QueryConstraintSchema).optional(),
  maxResults: z.number().int().positive().max(1000).optional(),
  relevanceThreshold: z.number().min(0).max(1).optional()
});

export const TraverseRequestSchema = z.object({
  startAtomId: z.string().min(1),
  direction: z.enum(['incoming', 'outgoing', 'both']),
  maxDepth: z.number().int().min(1).max(10),
  preFetch: z.boolean().optional()
});

// ==================== Relevance Schemas ====================

export const RelevanceContextSchema = z.object({
  currentGoals: z.array(z.string()).optional(),
  activePatterns: z.array(z.string()).optional(),
  recentActivations: z.record(z.number()).optional(),
  environmentalFactors: z.record(z.number()).optional(),
  temporalWindow: z.number().int().positive().optional()
});

export const RelevanceAssessRequestSchema = z.object({
  atomIds: z.array(z.string().min(1)).min(1).max(100),
  context: RelevanceContextSchema.optional()
});

// ==================== Tenant Schemas ====================

export const TenantConfigSchema = z.object({
  tenantId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1).max(256),
  tier: z.enum(['free', 'pro', 'enterprise']),
  quotas: z.object({
    maxAtoms: z.number().int().positive(),
    maxQueries: z.number().int().positive(),
    maxAgentExecutions: z.number().int().positive(),
    maxStorageMB: z.number().int().positive()
  }),
  features: z.object({
    distributedQuery: z.boolean(),
    aiEnhancement: z.boolean(),
    customAgents: z.boolean(),
    federatedLearning: z.boolean(),
    sharedKnowledge: z.boolean()
  }),
  isolation: z.enum(['strict', 'shared', 'federated'])
});

export const TenantQueryRequestSchema = z.object({
  type: z.string().optional(),
  pattern: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
  limit: z.number().int().positive().max(1000).optional()
});

export const TenantAtomRequestSchema = AtomSchema.extend({
  type: z.string().min(1)
});

// ==================== Knowledge Base Schemas ====================

export const KnowledgeBaseCreateSchema = z.object({
  ownerTenantId: z.string().min(1),
  name: z.string().min(1).max(256),
  description: z.string().max(2048),
  isPublic: z.boolean().optional()
});

// ==================== Task Schemas ====================

export const TaskTypeSchema = z.enum([
  'inference',
  'pattern_match',
  'consolidation',
  'coordination',
  'learning'
]);

export const TaskPrioritySchema = z.enum(['low', 'normal', 'high', 'critical']);

export const CognitiveTaskSchema = z.object({
  id: z.string().min(1).optional(),
  type: TaskTypeSchema,
  priority: TaskPrioritySchema.optional(),
  tenantId: z.string().optional(),
  atomSpaceId: z.string().min(1).optional(),
  params: z.record(z.unknown()),
  scheduledFor: z.number().optional(),
  maxRetries: z.number().int().min(0).max(10).optional()
});

// ==================== Type Converters ====================

/**
 * Convert a Record to a Map
 */
export function recordToMap<V>(record: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(record));
}

// Input types for converter functions (before defaults are applied)
type RelevanceContextInput = z.infer<typeof RelevanceContextSchema>;
type QueryPatternInput = z.infer<typeof QueryPatternSchema>;
type CognitiveTaskInput = z.infer<typeof CognitiveTaskSchema>;

/**
 * Convert RelevanceContext from validation schema to internal type
 */
export function toRelevanceContext(input: RelevanceContextInput) {
  return {
    currentGoals: input.currentGoals ?? [],
    activePatterns: input.activePatterns ?? [],
    recentActivations: recordToMap(input.recentActivations ?? {}),
    environmentalFactors: recordToMap(input.environmentalFactors ?? {}),
    temporalWindow: input.temporalWindow ?? 10000
  };
}

/**
 * Convert QueryPattern from validation schema to internal type
 */
export function toQueryPattern(input: QueryPatternInput) {
  return {
    type: input.type,
    variables: recordToMap(input.variables ?? {}),
    constraints: input.constraints ?? [],
    maxResults: input.maxResults,
    relevanceThreshold: input.relevanceThreshold
  };
}

/**
 * Convert CognitiveTask from validation schema to internal type
 */
export function toCognitiveTask(input: CognitiveTaskInput) {
  return {
    id: input.id ?? crypto.randomUUID(),
    type: input.type,
    priority: input.priority ?? 'normal' as const,
    tenantId: input.tenantId,
    atomSpaceId: input.atomSpaceId ?? 'main',
    params: input.params,
    createdAt: Date.now(),
    scheduledFor: input.scheduledFor,
    maxRetries: input.maxRetries
  };
}

// ==================== Validation Helpers ====================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodError['errors'] };

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.errors };
}

export function formatZodErrors(errors: z.ZodError['errors']): string[] {
  return errors.map(err => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
}
