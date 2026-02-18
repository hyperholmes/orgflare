/**
 * Unit tests for v6 API validation schemas
 *
 * Tests all Zod schemas and helper functions for API request validation
 */

import { describe, it, expect } from 'vitest';
import {
  TruthValueSchema,
  AttentionValueSchema,
  AtomSchema,
  QueryConstraintSchema,
  QueryPatternSchema,
  TraverseRequestSchema,
  RelevanceContextSchema,
  RelevanceAssessRequestSchema,
  TenantConfigSchema,
  TenantQueryRequestSchema,
  TenantAtomRequestSchema,
  KnowledgeBaseCreateSchema,
  TaskTypeSchema,
  TaskPrioritySchema,
  CognitiveTaskSchema,
  recordToMap,
  toRelevanceContext,
  toQueryPattern,
  toCognitiveTask,
  validate,
  formatZodErrors,
} from '../v6-validation';

// ==================== TruthValueSchema Tests ====================

describe('TruthValueSchema', () => {
  it('should accept valid truth value', () => {
    const result = TruthValueSchema.safeParse({ strength: 0.8, confidence: 0.9 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.strength).toBe(0.8);
      expect(result.data.confidence).toBe(0.9);
    }
  });

  it('should accept boundary values', () => {
    expect(TruthValueSchema.safeParse({ strength: 0, confidence: 0 }).success).toBe(true);
    expect(TruthValueSchema.safeParse({ strength: 1, confidence: 1 }).success).toBe(true);
  });

  it('should reject strength below 0', () => {
    const result = TruthValueSchema.safeParse({ strength: -0.1, confidence: 0.5 });
    expect(result.success).toBe(false);
  });

  it('should reject strength above 1', () => {
    const result = TruthValueSchema.safeParse({ strength: 1.1, confidence: 0.5 });
    expect(result.success).toBe(false);
  });

  it('should reject confidence below 0', () => {
    const result = TruthValueSchema.safeParse({ strength: 0.5, confidence: -0.1 });
    expect(result.success).toBe(false);
  });

  it('should reject confidence above 1', () => {
    const result = TruthValueSchema.safeParse({ strength: 0.5, confidence: 1.1 });
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    expect(TruthValueSchema.safeParse({ strength: 0.5 }).success).toBe(false);
    expect(TruthValueSchema.safeParse({ confidence: 0.5 }).success).toBe(false);
    expect(TruthValueSchema.safeParse({}).success).toBe(false);
  });

  it('should reject non-numeric values', () => {
    expect(TruthValueSchema.safeParse({ strength: 'high', confidence: 0.5 }).success).toBe(false);
  });
});

// ==================== AttentionValueSchema Tests ====================

describe('AttentionValueSchema', () => {
  it('should accept valid attention value', () => {
    const result = AttentionValueSchema.safeParse({ sti: 50, lti: 10, vlti: 5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sti).toBe(50);
      expect(result.data.lti).toBe(10);
      expect(result.data.vlti).toBe(5);
    }
  });

  it('should allow negative STI', () => {
    const result = AttentionValueSchema.safeParse({ sti: -100, lti: 0 });
    expect(result.success).toBe(true);
  });

  it('should reject negative LTI', () => {
    const result = AttentionValueSchema.safeParse({ sti: 50, lti: -10 });
    expect(result.success).toBe(false);
  });

  it('should reject negative VLTI', () => {
    const result = AttentionValueSchema.safeParse({ sti: 50, lti: 10, vlti: -5 });
    expect(result.success).toBe(false);
  });

  it('should allow optional VLTI', () => {
    const result = AttentionValueSchema.safeParse({ sti: 50, lti: 10 });
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    expect(AttentionValueSchema.safeParse({ sti: 50 }).success).toBe(false);
    expect(AttentionValueSchema.safeParse({ lti: 10 }).success).toBe(false);
  });
});

// ==================== AtomSchema Tests ====================

describe('AtomSchema', () => {
  it('should accept minimal atom with type', () => {
    const result = AtomSchema.safeParse({ type: 'ConceptNode' });
    expect(result.success).toBe(true);
  });

  it('should accept full atom with all fields', () => {
    const result = AtomSchema.safeParse({
      id: 'atom-123',
      type: 'ConceptNode',
      name: 'Cat',
      outgoing: ['id1', 'id2'],
      truthValue: { strength: 0.8, confidence: 0.9 },
      attentionValue: { sti: 50, lti: 10 },
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty type', () => {
    const result = AtomSchema.safeParse({ type: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing type', () => {
    const result = AtomSchema.safeParse({ name: 'Cat' });
    expect(result.success).toBe(false);
  });

  it('should validate nested truth value', () => {
    const result = AtomSchema.safeParse({
      type: 'ConceptNode',
      truthValue: { strength: 2.0, confidence: 0.5 },
    });
    expect(result.success).toBe(false);
  });

  it('should allow empty outgoing array', () => {
    const result = AtomSchema.safeParse({ type: 'ListLink', outgoing: [] });
    expect(result.success).toBe(true);
  });
});

// ==================== QueryConstraintSchema Tests ====================

describe('QueryConstraintSchema', () => {
  it('should accept valid constraint', () => {
    const result = QueryConstraintSchema.safeParse({
      type: 'type',
      field: 'atomType',
      operator: 'eq',
      value: 'ConceptNode',
    });
    expect(result.success).toBe(true);
  });

  it('should accept constraint without optional fields', () => {
    const result = QueryConstraintSchema.safeParse({
      type: 'truth',
      operator: 'gt',
    });
    expect(result.success).toBe(true);
  });

  it('should accept nested subConstraints', () => {
    const result = QueryConstraintSchema.safeParse({
      type: 'boolean',
      operator: 'and',
      subConstraints: [
        { type: 'type', operator: 'eq', value: 'ConceptNode' },
        { type: 'truth', operator: 'gt', value: 0.5 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid type', () => {
    const result = QueryConstraintSchema.safeParse({
      type: 'invalid',
      operator: 'eq',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid operator', () => {
    const result = QueryConstraintSchema.safeParse({
      type: 'type',
      operator: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid constraint types', () => {
    const types = ['type', 'truth', 'attention', 'topology', 'boolean'];
    for (const type of types) {
      const result = QueryConstraintSchema.safeParse({ type, operator: 'eq' });
      expect(result.success).toBe(true);
    }
  });

  it('should accept all valid operators', () => {
    const operators = ['eq', 'gt', 'lt', 'gte', 'lte', 'contains', 'and', 'or', 'not'];
    for (const operator of operators) {
      const result = QueryConstraintSchema.safeParse({ type: 'type', operator });
      expect(result.success).toBe(true);
    }
  });
});

// ==================== QueryPatternSchema Tests ====================

describe('QueryPatternSchema', () => {
  it('should accept minimal pattern', () => {
    const result = QueryPatternSchema.safeParse({ type: 'ConceptNode' });
    expect(result.success).toBe(true);
  });

  it('should accept full pattern', () => {
    const result = QueryPatternSchema.safeParse({
      type: 'InheritanceLink',
      variables: { x: 'any', y: 'ConceptNode' },
      constraints: [{ type: 'truth', operator: 'gt', value: 0.5 }],
      maxResults: 100,
      relevanceThreshold: 0.7,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty type', () => {
    const result = QueryPatternSchema.safeParse({ type: '' });
    expect(result.success).toBe(false);
  });

  it('should reject maxResults above 1000', () => {
    const result = QueryPatternSchema.safeParse({ type: 'any', maxResults: 1001 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer maxResults', () => {
    const result = QueryPatternSchema.safeParse({ type: 'any', maxResults: 10.5 });
    expect(result.success).toBe(false);
  });

  it('should reject negative maxResults', () => {
    const result = QueryPatternSchema.safeParse({ type: 'any', maxResults: -10 });
    expect(result.success).toBe(false);
  });

  it('should reject relevanceThreshold above 1', () => {
    const result = QueryPatternSchema.safeParse({ type: 'any', relevanceThreshold: 1.5 });
    expect(result.success).toBe(false);
  });

  it('should reject relevanceThreshold below 0', () => {
    const result = QueryPatternSchema.safeParse({ type: 'any', relevanceThreshold: -0.1 });
    expect(result.success).toBe(false);
  });
});

// ==================== TraverseRequestSchema Tests ====================

describe('TraverseRequestSchema', () => {
  it('should accept valid traverse request', () => {
    const result = TraverseRequestSchema.safeParse({
      startAtomId: 'atom-123',
      direction: 'outgoing',
      maxDepth: 3,
    });
    expect(result.success).toBe(true);
  });

  it('should accept all directions', () => {
    for (const direction of ['incoming', 'outgoing', 'both']) {
      const result = TraverseRequestSchema.safeParse({
        startAtomId: 'atom-1',
        direction,
        maxDepth: 1,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject empty startAtomId', () => {
    const result = TraverseRequestSchema.safeParse({
      startAtomId: '',
      direction: 'outgoing',
      maxDepth: 3,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid direction', () => {
    const result = TraverseRequestSchema.safeParse({
      startAtomId: 'atom-1',
      direction: 'invalid',
      maxDepth: 3,
    });
    expect(result.success).toBe(false);
  });

  it('should reject maxDepth below 1', () => {
    const result = TraverseRequestSchema.safeParse({
      startAtomId: 'atom-1',
      direction: 'outgoing',
      maxDepth: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject maxDepth above 10', () => {
    const result = TraverseRequestSchema.safeParse({
      startAtomId: 'atom-1',
      direction: 'outgoing',
      maxDepth: 11,
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional preFetch', () => {
    const result = TraverseRequestSchema.safeParse({
      startAtomId: 'atom-1',
      direction: 'outgoing',
      maxDepth: 5,
      preFetch: true,
    });
    expect(result.success).toBe(true);
  });
});

// ==================== RelevanceSchemas Tests ====================

describe('RelevanceContextSchema', () => {
  it('should accept empty context', () => {
    const result = RelevanceContextSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept full context', () => {
    const result = RelevanceContextSchema.safeParse({
      currentGoals: ['goal1', 'goal2'],
      activePatterns: ['pattern1'],
      recentActivations: { atom1: 0.8, atom2: 0.5 },
      environmentalFactors: { urgency: 0.9 },
      temporalWindow: 5000,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative temporalWindow', () => {
    const result = RelevanceContextSchema.safeParse({ temporalWindow: -1000 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer temporalWindow', () => {
    const result = RelevanceContextSchema.safeParse({ temporalWindow: 1000.5 });
    expect(result.success).toBe(false);
  });
});

describe('RelevanceAssessRequestSchema', () => {
  it('should accept valid request', () => {
    const result = RelevanceAssessRequestSchema.safeParse({
      atomIds: ['atom1', 'atom2'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept request with context', () => {
    const result = RelevanceAssessRequestSchema.safeParse({
      atomIds: ['atom1'],
      context: { currentGoals: ['goal1'] },
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty atomIds', () => {
    const result = RelevanceAssessRequestSchema.safeParse({
      atomIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject atomIds with empty strings', () => {
    const result = RelevanceAssessRequestSchema.safeParse({
      atomIds: ['atom1', ''],
    });
    expect(result.success).toBe(false);
  });

  it('should reject more than 100 atomIds', () => {
    const atomIds = Array.from({ length: 101 }, (_, i) => `atom${i}`);
    const result = RelevanceAssessRequestSchema.safeParse({ atomIds });
    expect(result.success).toBe(false);
  });

  it('should accept exactly 100 atomIds', () => {
    const atomIds = Array.from({ length: 100 }, (_, i) => `atom${i}`);
    const result = RelevanceAssessRequestSchema.safeParse({ atomIds });
    expect(result.success).toBe(true);
  });
});

// ==================== TenantSchemas Tests ====================

describe('TenantConfigSchema', () => {
  const validConfig = {
    tenantId: 'tenant-123',
    name: 'Test Tenant',
    tier: 'pro' as const,
    quotas: {
      maxAtoms: 10000,
      maxQueries: 1000,
      maxAgentExecutions: 100,
      maxStorageMB: 512,
    },
    features: {
      distributedQuery: true,
      aiEnhancement: true,
      customAgents: false,
      federatedLearning: false,
      sharedKnowledge: true,
    },
    isolation: 'strict' as const,
  };

  it('should accept valid tenant config', () => {
    const result = TenantConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should reject invalid tenantId format', () => {
    const result = TenantConfigSchema.safeParse({
      ...validConfig,
      tenantId: 'invalid@tenant',
    });
    expect(result.success).toBe(false);
  });

  it('should accept tenantId with dashes and underscores', () => {
    const result = TenantConfigSchema.safeParse({
      ...validConfig,
      tenantId: 'my_tenant-123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject tenantId exceeding 64 characters', () => {
    const result = TenantConfigSchema.safeParse({
      ...validConfig,
      tenantId: 'a'.repeat(65),
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid tier', () => {
    const result = TenantConfigSchema.safeParse({
      ...validConfig,
      tier: 'premium',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid tiers', () => {
    for (const tier of ['free', 'pro', 'enterprise']) {
      const result = TenantConfigSchema.safeParse({ ...validConfig, tier });
      expect(result.success).toBe(true);
    }
  });

  it('should accept all valid isolation modes', () => {
    for (const isolation of ['strict', 'shared', 'federated']) {
      const result = TenantConfigSchema.safeParse({ ...validConfig, isolation });
      expect(result.success).toBe(true);
    }
  });

  it('should reject missing quota fields', () => {
    const result = TenantConfigSchema.safeParse({
      ...validConfig,
      quotas: { maxAtoms: 100 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-positive quotas', () => {
    const result = TenantConfigSchema.safeParse({
      ...validConfig,
      quotas: { ...validConfig.quotas, maxAtoms: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing feature fields', () => {
    const result = TenantConfigSchema.safeParse({
      ...validConfig,
      features: { distributedQuery: true },
    });
    expect(result.success).toBe(false);
  });
});

describe('TenantQueryRequestSchema', () => {
  it('should accept empty request', () => {
    const result = TenantQueryRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept full request', () => {
    const result = TenantQueryRequestSchema.safeParse({
      type: 'ConceptNode',
      pattern: 'Cat*',
      filters: { active: true },
      limit: 50,
    });
    expect(result.success).toBe(true);
  });

  it('should reject limit above 1000', () => {
    const result = TenantQueryRequestSchema.safeParse({ limit: 1001 });
    expect(result.success).toBe(false);
  });

  it('should reject non-positive limit', () => {
    const result = TenantQueryRequestSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });
});

describe('TenantAtomRequestSchema', () => {
  it('should accept valid atom request', () => {
    const result = TenantAtomRequestSchema.safeParse({
      type: 'ConceptNode',
      name: 'Cat',
    });
    expect(result.success).toBe(true);
  });

  it('should require type (non-optional)', () => {
    const result = TenantAtomRequestSchema.safeParse({
      name: 'Cat',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty type', () => {
    const result = TenantAtomRequestSchema.safeParse({ type: '' });
    expect(result.success).toBe(false);
  });
});

// ==================== KnowledgeBaseCreateSchema Tests ====================

describe('KnowledgeBaseCreateSchema', () => {
  it('should accept valid knowledge base', () => {
    const result = KnowledgeBaseCreateSchema.safeParse({
      ownerTenantId: 'tenant-1',
      name: 'My Knowledge Base',
      description: 'A test knowledge base',
    });
    expect(result.success).toBe(true);
  });

  it('should accept with optional isPublic', () => {
    const result = KnowledgeBaseCreateSchema.safeParse({
      ownerTenantId: 'tenant-1',
      name: 'Public KB',
      description: 'Public knowledge base',
      isPublic: true,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty ownerTenantId', () => {
    const result = KnowledgeBaseCreateSchema.safeParse({
      ownerTenantId: '',
      name: 'KB',
      description: 'desc',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = KnowledgeBaseCreateSchema.safeParse({
      ownerTenantId: 'tenant-1',
      name: '',
      description: 'desc',
    });
    expect(result.success).toBe(false);
  });

  it('should reject name exceeding 256 characters', () => {
    const result = KnowledgeBaseCreateSchema.safeParse({
      ownerTenantId: 'tenant-1',
      name: 'a'.repeat(257),
      description: 'desc',
    });
    expect(result.success).toBe(false);
  });

  it('should reject description exceeding 2048 characters', () => {
    const result = KnowledgeBaseCreateSchema.safeParse({
      ownerTenantId: 'tenant-1',
      name: 'KB',
      description: 'a'.repeat(2049),
    });
    expect(result.success).toBe(false);
  });
});

// ==================== TaskSchemas Tests ====================

describe('TaskTypeSchema', () => {
  it('should accept all valid task types', () => {
    const types = ['inference', 'pattern_match', 'consolidation', 'coordination', 'learning'];
    for (const type of types) {
      const result = TaskTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid type', () => {
    const result = TaskTypeSchema.safeParse('invalid_type');
    expect(result.success).toBe(false);
  });
});

describe('TaskPrioritySchema', () => {
  it('should accept all valid priorities', () => {
    const priorities = ['low', 'normal', 'high', 'critical'];
    for (const priority of priorities) {
      const result = TaskPrioritySchema.safeParse(priority);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid priority', () => {
    const result = TaskPrioritySchema.safeParse('urgent');
    expect(result.success).toBe(false);
  });
});

describe('CognitiveTaskSchema', () => {
  it('should accept minimal task', () => {
    const result = CognitiveTaskSchema.safeParse({
      type: 'inference',
      params: {},
    });
    expect(result.success).toBe(true);
  });

  it('should accept full task', () => {
    const result = CognitiveTaskSchema.safeParse({
      id: 'task-123',
      type: 'pattern_match',
      priority: 'high',
      tenantId: 'tenant-1',
      atomSpaceId: 'main',
      params: { query: 'test' },
      scheduledFor: Date.now() + 60000,
      maxRetries: 3,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid task type', () => {
    const result = CognitiveTaskSchema.safeParse({
      type: 'invalid',
      params: {},
    });
    expect(result.success).toBe(false);
  });

  it('should reject maxRetries below 0', () => {
    const result = CognitiveTaskSchema.safeParse({
      type: 'inference',
      params: {},
      maxRetries: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject maxRetries above 10', () => {
    const result = CognitiveTaskSchema.safeParse({
      type: 'inference',
      params: {},
      maxRetries: 11,
    });
    expect(result.success).toBe(false);
  });

  it('should accept maxRetries at boundaries', () => {
    expect(
      CognitiveTaskSchema.safeParse({ type: 'inference', params: {}, maxRetries: 0 }).success
    ).toBe(true);
    expect(
      CognitiveTaskSchema.safeParse({ type: 'inference', params: {}, maxRetries: 10 }).success
    ).toBe(true);
  });

  it('should reject non-integer maxRetries', () => {
    const result = CognitiveTaskSchema.safeParse({
      type: 'inference',
      params: {},
      maxRetries: 3.5,
    });
    expect(result.success).toBe(false);
  });
});

// ==================== Helper Functions Tests ====================

describe('recordToMap', () => {
  it('should convert empty record', () => {
    const result = recordToMap({});
    expect(result.size).toBe(0);
  });

  it('should convert record with values', () => {
    const result = recordToMap({ a: 1, b: 2, c: 3 });
    expect(result.size).toBe(3);
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
    expect(result.get('c')).toBe(3);
  });

  it('should preserve value types', () => {
    const result = recordToMap({ str: 'hello', num: 42, bool: true });
    expect(typeof result.get('str')).toBe('string');
    expect(typeof result.get('num')).toBe('number');
    expect(typeof result.get('bool')).toBe('boolean');
  });
});

describe('toRelevanceContext', () => {
  it('should convert empty input with defaults', () => {
    const result = toRelevanceContext({});
    expect(result.currentGoals).toEqual([]);
    expect(result.activePatterns).toEqual([]);
    expect(result.recentActivations.size).toBe(0);
    expect(result.environmentalFactors.size).toBe(0);
    expect(result.temporalWindow).toBe(10000);
  });

  it('should convert full input', () => {
    const result = toRelevanceContext({
      currentGoals: ['goal1', 'goal2'],
      activePatterns: ['pattern1'],
      recentActivations: { atom1: 0.8 },
      environmentalFactors: { urgency: 0.9 },
      temporalWindow: 5000,
    });

    expect(result.currentGoals).toEqual(['goal1', 'goal2']);
    expect(result.activePatterns).toEqual(['pattern1']);
    expect(result.recentActivations.get('atom1')).toBe(0.8);
    expect(result.environmentalFactors.get('urgency')).toBe(0.9);
    expect(result.temporalWindow).toBe(5000);
  });
});

describe('toQueryPattern', () => {
  it('should convert minimal input', () => {
    const result = toQueryPattern({ type: 'ConceptNode' });
    expect(result.type).toBe('ConceptNode');
    expect(result.variables.size).toBe(0);
    expect(result.constraints).toEqual([]);
  });

  it('should convert full input', () => {
    const result = toQueryPattern({
      type: 'InheritanceLink',
      variables: { x: 'any' },
      constraints: [{ type: 'type', operator: 'eq' }],
      maxResults: 50,
      relevanceThreshold: 0.7,
    });

    expect(result.type).toBe('InheritanceLink');
    expect(result.variables.get('x')).toBe('any');
    expect(result.constraints.length).toBe(1);
    expect(result.maxResults).toBe(50);
    expect(result.relevanceThreshold).toBe(0.7);
  });
});

describe('toCognitiveTask', () => {
  it('should convert with defaults', () => {
    const result = toCognitiveTask({
      type: 'inference',
      params: { query: 'test' },
    });

    expect(result.id).toBeDefined();
    expect(result.type).toBe('inference');
    expect(result.priority).toBe('normal');
    expect(result.atomSpaceId).toBe('main');
    expect(result.createdAt).toBeDefined();
    expect(typeof result.createdAt).toBe('number');
  });

  it('should preserve provided values', () => {
    const result = toCognitiveTask({
      id: 'custom-id',
      type: 'pattern_match',
      priority: 'critical',
      tenantId: 'tenant-1',
      atomSpaceId: 'custom',
      params: { pattern: '*' },
      maxRetries: 5,
    });

    expect(result.id).toBe('custom-id');
    expect(result.type).toBe('pattern_match');
    expect(result.priority).toBe('critical');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.atomSpaceId).toBe('custom');
    expect(result.maxRetries).toBe(5);
  });
});

// ==================== validate Helper Tests ====================

describe('validate', () => {
  it('should return success with data for valid input', () => {
    const result = validate(TruthValueSchema, { strength: 0.8, confidence: 0.9 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.strength).toBe(0.8);
    }
  });

  it('should return failure with errors for invalid input', () => {
    const result = validate(TruthValueSchema, { strength: 2.0, confidence: 0.9 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('should work with complex schemas', () => {
    const result = validate(CognitiveTaskSchema, {
      type: 'inference',
      params: {},
    });
    expect(result.success).toBe(true);
  });
});

// ==================== formatZodErrors Tests ====================

describe('formatZodErrors', () => {
  it('should format errors with path', () => {
    const result = TruthValueSchema.safeParse({ strength: 2.0, confidence: 0.5 });
    if (!result.success) {
      const formatted = formatZodErrors(result.error.errors);
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted[0]).toContain('strength');
    }
  });

  it('should format errors without path', () => {
    const result = TaskTypeSchema.safeParse('invalid');
    if (!result.success) {
      const formatted = formatZodErrors(result.error.errors);
      expect(formatted.length).toBeGreaterThan(0);
    }
  });

  it('should handle nested errors', () => {
    const result = TenantConfigSchema.safeParse({
      tenantId: 'valid-id',
      name: 'Test',
      tier: 'pro',
      quotas: { maxAtoms: -1, maxQueries: 1, maxAgentExecutions: 1, maxStorageMB: 1 },
      features: {
        distributedQuery: true,
        aiEnhancement: true,
        customAgents: true,
        federatedLearning: true,
        sharedKnowledge: true,
      },
      isolation: 'strict',
    });
    if (!result.success) {
      const formatted = formatZodErrors(result.error.errors);
      expect(formatted[0]).toContain('quotas.maxAtoms');
    }
  });

  it('should handle empty errors array', () => {
    const formatted = formatZodErrors([]);
    expect(formatted).toEqual([]);
  });
});
