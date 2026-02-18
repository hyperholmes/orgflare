/**
 * FlareCog v6.0 API Endpoints
 *
 * Integration layer for new v6.0 components:
 * - Enhanced Distributed Query Engine
 * - Relevance Realization Engine
 * - Workers for Platforms (Multi-tenancy)
 * - Queue Task Submission
 * - Storage Tier Management
 */

import { Hono } from 'hono';
import { Env } from '../types/cognitive-v5';
import { EnhancedDistributedQueryEngine, QueryPattern } from '../core/distributed/EnhancedDistributedQueryEngine';
import { RelevanceRealizationEngine, RelevanceContext } from '../core/RelevanceRealizationEngine';
import { WorkersForPlatformsIntegration, TenantConfig } from '../platforms/WorkersForPlatformsIntegration';
import { CloudflareQueueIntegration, CognitiveTask } from '../optimizations/CloudflareQueueIntegration';
import { R2ColdStorageEnhanced } from '../storage/R2ColdStorageEnhanced';
import {
  QueryPatternSchema,
  TraverseRequestSchema,
  RelevanceAssessRequestSchema,
  TenantConfigSchema,
  TenantQueryRequestSchema,
  TenantAtomRequestSchema,
  KnowledgeBaseCreateSchema,
  CognitiveTaskSchema,
  validate,
  formatZodErrors,
  toQueryPattern,
  toRelevanceContext,
  toCognitiveTask
} from './v6-validation';

const app = new Hono<{ Bindings: Env }>();

// ==================== Distributed Query Endpoints ====================

/**
 * POST /api/v6/query/distributed
 * Execute distributed query across edge network
 */
app.post('/query/distributed', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validate(QueryPatternSchema, body);

    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodErrors(validation.errors)
      }, 400);
    }

    const pattern = toQueryPattern(validation.data);

    const queryEngine = new EnhancedDistributedQueryEngine(
      c.env.COORDINATION_CACHE,
      c.env
    );

    const result = await queryEngine.executeQuery(pattern);

    return c.json({
      success: true,
      result,
      metadata: {
        atomCount: result.atoms.length,
        bindingCount: result.bindings.length,
        hasMore: result.hasMore
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/v6/query/traverse
 * Traverse hypergraph from starting atoms
 */
app.post('/query/traverse', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validate(TraverseRequestSchema, body);

    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodErrors(validation.errors)
      }, 400);
    }

    const { startAtomId, direction, maxDepth, preFetch } = validation.data;

    const queryEngine = new EnhancedDistributedQueryEngine(
      c.env.COORDINATION_CACHE,
      c.env
    );

    // Fetch the starting atom from AtomSpace
    const atomSpaceId = c.env.ATOMSPACE.idFromName('main');
    const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);

    const response = await atomSpace.fetch(`https://internal/atoms/${startAtomId}`);
    const startAtom = await response.json() as { id: string; type: string; name?: string; truthValue: any; attentionValue: any };

    const result = await queryEngine.traverse(startAtom as any, {
      direction,
      maxDepth,
      preFetch
    });

    return c.json({
      success: true,
      atoms: result,
      count: result.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ==================== Relevance Realization Endpoints ====================

/**
 * POST /api/v6/relevance/assess
 * Assess relevance of atoms in given context
 */
app.post('/relevance/assess', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validate(RelevanceAssessRequestSchema, body);

    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodErrors(validation.errors)
      }, 400);
    }

    const { atomIds, context } = validation.data;

    const relevanceEngine = new RelevanceRealizationEngine();

    // Update engine context if provided
    if (context) {
      relevanceEngine.updateContext(toRelevanceContext(context));
    }

    // Fetch atoms from AtomSpace
    const atomSpaceId = c.env.ATOMSPACE.idFromName('main');
    const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);

    const response = await atomSpace.fetch('https://internal/atoms/batch', {
      method: 'POST',
      body: JSON.stringify({ ids: atomIds })
    });

    const atoms = await response.json() as Array<{ id: string; type: string; name?: string; truthValue: any; attentionValue: any }>;

    // Assess relevance for each atom using realizeRelevance
    const assessments = await Promise.all(
      atoms.map(async (atom) => {
        const relevance = await relevanceEngine.realizeRelevance(atom as any);
        return { atomId: atom.id, relevance };
      })
    );

    return c.json({
      success: true,
      assessments
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/v6/relevance/grip
 * Get optimal cognitive grip recommendations
 */
app.get('/relevance/grip', async (c) => {
  try {
    const relevanceEngine = new RelevanceRealizationEngine();
    const grip = relevanceEngine.getOptimalGrip();
    
    return c.json({
      success: true,
      grip
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/v6/relevance/landscape
 * Get current salience landscape
 */
app.get('/relevance/landscape', async (c) => {
  try {
    const relevanceEngine = new RelevanceRealizationEngine();
    const landscape = relevanceEngine.getSalienceLandscape();
    
    return c.json({
      success: true,
      landscape
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ==================== Multi-Tenant Endpoints ====================

/**
 * POST /api/v6/tenant/create
 * Create new tenant with isolated AtomSpace
 */
app.post('/tenant/create', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validate(TenantConfigSchema, body);

    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodErrors(validation.errors)
      }, 400);
    }

    const config = {
      ...validation.data,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    } as TenantConfig;

    const platformsIntegration = new WorkersForPlatformsIntegration({
      TENANT_REGISTRY: c.env.TENANT_REGISTRY,
      USAGE_TRACKER: c.env.USAGE_TRACKER,
      SHARED_KNOWLEDGE: c.env.SHARED_KNOWLEDGE,
      ATOMSPACE_DO: c.env.ATOMSPACE,
      TENANT_ATOMSPACE_DO: c.env.TENANT_ATOMSPACE_DO
    });

    const tenantAtomSpace = await platformsIntegration.initializeTenant(config);

    return c.json({
      success: true,
      tenant: tenantAtomSpace
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/v6/tenant/:tenantId/query
 * Execute query on tenant's AtomSpace
 */
app.post('/tenant/:tenantId/query', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const body = await c.req.json();
    const validation = validate(TenantQueryRequestSchema, body);

    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodErrors(validation.errors)
      }, 400);
    }

    const query = validation.data;

    const platformsIntegration = new WorkersForPlatformsIntegration({
      TENANT_REGISTRY: c.env.TENANT_REGISTRY,
      USAGE_TRACKER: c.env.USAGE_TRACKER,
      SHARED_KNOWLEDGE: c.env.SHARED_KNOWLEDGE,
      ATOMSPACE_DO: c.env.ATOMSPACE,
      TENANT_ATOMSPACE_DO: c.env.TENANT_ATOMSPACE_DO
    });

    const result = await platformsIntegration.executeQuery(tenantId, query);

    return c.json({
      success: true,
      result
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/v6/tenant/:tenantId/atom
 * Add atom to tenant's AtomSpace
 */
app.post('/tenant/:tenantId/atom', async (c) => {
  try {
    const tenantId = c.req.param('tenantId');
    const body = await c.req.json();
    const validation = validate(TenantAtomRequestSchema, body);

    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodErrors(validation.errors)
      }, 400);
    }

    const atom = validation.data;

    const platformsIntegration = new WorkersForPlatformsIntegration({
      TENANT_REGISTRY: c.env.TENANT_REGISTRY,
      USAGE_TRACKER: c.env.USAGE_TRACKER,
      SHARED_KNOWLEDGE: c.env.SHARED_KNOWLEDGE,
      ATOMSPACE_DO: c.env.ATOMSPACE,
      TENANT_ATOMSPACE_DO: c.env.TENANT_ATOMSPACE_DO
    });

    const result = await platformsIntegration.addAtom(tenantId, atom);

    return c.json({
      success: true,
      atom: result
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/v6/knowledge/create
 * Create shared knowledge base
 */
app.post('/knowledge/create', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validate(KnowledgeBaseCreateSchema, body);

    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodErrors(validation.errors)
      }, 400);
    }

    const { ownerTenantId, name, description, isPublic } = validation.data;

    const platformsIntegration = new WorkersForPlatformsIntegration({
      TENANT_REGISTRY: c.env.TENANT_REGISTRY,
      USAGE_TRACKER: c.env.USAGE_TRACKER,
      SHARED_KNOWLEDGE: c.env.SHARED_KNOWLEDGE,
      ATOMSPACE_DO: c.env.ATOMSPACE,
      TENANT_ATOMSPACE_DO: c.env.TENANT_ATOMSPACE_DO
    });

    const knowledgeBase = await platformsIntegration.createSharedKnowledgeBase(
      ownerTenantId,
      name,
      description,
      isPublic
    );

    return c.json({
      success: true,
      knowledgeBase
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ==================== Queue Task Endpoints ====================

/**
 * POST /api/v6/task/enqueue
 * Enqueue cognitive task for asynchronous processing
 */
app.post('/task/enqueue', async (c) => {
  try {
    const body = await c.req.json();
    const validation = validate(CognitiveTaskSchema, body);

    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: formatZodErrors(validation.errors)
      }, 400);
    }

    const task = toCognitiveTask(validation.data);

    const queueIntegration = new CloudflareQueueIntegration({
      COGNITIVE_QUEUE: c.env.COGNITIVE_QUEUE,
      INFERENCE_QUEUE: c.env.INFERENCE_QUEUE,
      CONSOLIDATION_QUEUE: c.env.CONSOLIDATION_QUEUE,
      COORDINATION_QUEUE: c.env.COORDINATION_QUEUE,
      TASK_RESULTS: c.env.TASK_RESULTS,
      ATOMSPACE_DO: c.env.ATOMSPACE
    });

    await queueIntegration.enqueueTask(task);

    return c.json({
      success: true,
      taskId: task.id,
      message: 'Task enqueued successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/v6/task/:taskId/result
 * Get result of completed task
 */
app.get('/task/:taskId/result', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    
    const queueIntegration = new CloudflareQueueIntegration({
      COGNITIVE_QUEUE: c.env.COGNITIVE_QUEUE,
      INFERENCE_QUEUE: c.env.INFERENCE_QUEUE,
      CONSOLIDATION_QUEUE: c.env.CONSOLIDATION_QUEUE,
      COORDINATION_QUEUE: c.env.COORDINATION_QUEUE,
      TASK_RESULTS: c.env.TASK_RESULTS,
      ATOMSPACE_DO: c.env.ATOMSPACE
    });
    
    const result = await queueIntegration.getResult(taskId);
    
    if (!result) {
      return c.json({
        success: false,
        error: 'Task result not found'
      }, 404);
    }
    
    return c.json({
      success: true,
      result
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ==================== Storage Tier Endpoints ====================

/**
 * GET /api/v6/storage/metrics
 * Get storage tier metrics
 */
app.get('/storage/metrics', async (c) => {
  try {
    const storage = new R2ColdStorageEnhanced({
      R2_COLD_STORAGE: c.env.R2_COLD_STORAGE,
      KV_WARM_STORAGE: c.env.KV_WARM_STORAGE,
      ATOMSPACE_DO: c.env.ATOMSPACE,
      STORAGE_METADATA: c.env.STORAGE_METADATA
    });
    
    const metrics = storage.getMetrics();
    
    return c.json({
      success: true,
      metrics
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/v6/storage/maintenance
 * Run storage tier maintenance
 */
app.post('/storage/maintenance', async (c) => {
  try {
    const storage = new R2ColdStorageEnhanced({
      R2_COLD_STORAGE: c.env.R2_COLD_STORAGE,
      KV_WARM_STORAGE: c.env.KV_WARM_STORAGE,
      ATOMSPACE_DO: c.env.ATOMSPACE,
      STORAGE_METADATA: c.env.STORAGE_METADATA
    });
    
    await storage.runTieringMaintenance();
    
    return c.json({
      success: true,
      message: 'Tiering maintenance completed'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/v6/storage/evict
 * Evict old atoms from cold storage
 */
app.post('/storage/evict', async (c) => {
  try {
    const storage = new R2ColdStorageEnhanced({
      R2_COLD_STORAGE: c.env.R2_COLD_STORAGE,
      KV_WARM_STORAGE: c.env.KV_WARM_STORAGE,
      ATOMSPACE_DO: c.env.ATOMSPACE,
      STORAGE_METADATA: c.env.STORAGE_METADATA
    });
    
    const evictedCount = await storage.evictOldAtoms();
    
    return c.json({
      success: true,
      evictedCount,
      message: `Evicted ${evictedCount} old atoms`
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ==================== Health Check ====================

/**
 * GET /api/v6/health
 * Health check for v6.0 components
 */
app.get('/health', async (c) => {
  const healthChecks: Record<string, { status: string; latency?: number; error?: string }> = {};
  const startTime = Date.now();

  // Check AtomSpace connectivity
  try {
    const atomSpaceStart = Date.now();
    const atomSpaceId = c.env.ATOMSPACE.idFromName('main');
    const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
    await atomSpace.fetch('https://internal/ping');
    healthChecks.atomspace = { status: 'healthy', latency: Date.now() - atomSpaceStart };
  } catch (error) {
    healthChecks.atomspace = { status: 'unhealthy', error: error instanceof Error ? error.message : 'Connection failed' };
  }

  // Check KV store (COORDINATION_CACHE)
  try {
    const kvStart = Date.now();
    await c.env.COORDINATION_CACHE?.get('health-check');
    healthChecks.kvStore = { status: 'healthy', latency: Date.now() - kvStart };
  } catch (error) {
    healthChecks.kvStore = { status: 'unhealthy', error: error instanceof Error ? error.message : 'Connection failed' };
  }

  // Check R2 Cold Storage
  try {
    const r2Start = Date.now();
    await c.env.R2_COLD_STORAGE?.head('health-check');
    healthChecks.r2Storage = { status: 'healthy', latency: Date.now() - r2Start };
  } catch (error) {
    healthChecks.r2Storage = { status: 'unhealthy', error: error instanceof Error ? error.message : 'Connection failed' };
  }

  // Check AI binding
  try {
    healthChecks.workersAI = { status: c.env.AI ? 'healthy' : 'unavailable' };
  } catch {
    healthChecks.workersAI = { status: 'unavailable' };
  }

  // Check Vectorize
  try {
    healthChecks.vectorize = { status: c.env.VECTORIZE ? 'healthy' : 'unavailable' };
  } catch {
    healthChecks.vectorize = { status: 'unavailable' };
  }

  // Determine overall status
  const unhealthyComponents = Object.values(healthChecks).filter(h => h.status === 'unhealthy');
  const overallStatus = unhealthyComponents.length === 0 ? 'healthy' :
                        unhealthyComponents.length < 3 ? 'degraded' : 'unhealthy';

  return c.json({
    success: overallStatus !== 'unhealthy',
    version: '6.0.0',
    status: overallStatus,
    components: {
      distributedQuery: healthChecks.atomspace?.status === 'healthy' ? 'operational' : 'degraded',
      relevanceRealization: 'operational',
      multiTenant: healthChecks.kvStore?.status === 'healthy' ? 'operational' : 'degraded',
      queueProcessing: 'operational',
      tieredStorage: healthChecks.r2Storage?.status === 'healthy' ? 'operational' : 'degraded',
      workersAI: healthChecks.workersAI?.status === 'healthy' ? 'operational' : 'unavailable',
      vectorize: healthChecks.vectorize?.status === 'healthy' ? 'operational' : 'unavailable'
    },
    healthChecks,
    totalLatency: Date.now() - startTime,
    timestamp: Date.now()
  });
});

/**
 * GET /api/v6/metrics
 * Get system metrics for monitoring
 */
app.get('/metrics', async (c) => {
  try {
    // Collect metrics from various sources
    const metrics: Record<string, any> = {
      timestamp: Date.now(),
      version: '6.0.0'
    };

    // Get AtomSpace metrics
    try {
      const atomSpaceId = c.env.ATOMSPACE.idFromName('main');
      const atomSpace = c.env.ATOMSPACE.get(atomSpaceId);
      const response = await atomSpace.fetch('https://internal/metrics');
      metrics.atomspace = await response.json();
    } catch {
      metrics.atomspace = { error: 'unavailable' };
    }

    // Get storage metrics
    try {
      const storage = new R2ColdStorageEnhanced({
        R2_COLD_STORAGE: c.env.R2_COLD_STORAGE,
        KV_WARM_STORAGE: c.env.KV_WARM_STORAGE,
        ATOMSPACE_DO: c.env.ATOMSPACE,
        STORAGE_METADATA: c.env.STORAGE_METADATA
      });
      metrics.storage = storage.getMetrics();
    } catch {
      metrics.storage = { error: 'unavailable' };
    }

    // Get relevance engine state
    try {
      const relevanceEngine = new RelevanceRealizationEngine();
      metrics.relevance = {
        landscape: relevanceEngine.getSalienceLandscape(),
        grip: relevanceEngine.getOptimalGrip()
      };
    } catch {
      metrics.relevance = { error: 'unavailable' };
    }

    return c.json({
      success: true,
      metrics
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
