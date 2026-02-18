/**
 * FlareCog Dispatch Worker Template
 * 
 * This worker runs in a tenant's isolated dispatch namespace.
 * Each tenant gets their own instance with dedicated resources.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types/cognitive-v5';
import { EnhancedDistributedQueryEngine } from './core/distributed/EnhancedDistributedQueryEngine';
import { RelevanceRealizationEngine } from './core/RelevanceRealizationEngine';
import { AtomSpace } from './durable-objects/AtomSpace';
import { MindAgent } from './durable-objects/MindAgent';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors());

// ==================== Tenant Worker Root ====================

app.get('/', (c) => {
  return c.json({
    service: 'FlareCog Tenant Worker',
    version: '6.0.0',
    tenant: c.env.TENANT_ID || 'unknown',
    status: 'operational',
    features: [
      'Isolated AtomSpace',
      'Distributed Query Engine',
      'Relevance Realization',
      'Cognitive Processing'
    ],
    timestamp: Date.now()
  });
});

// ==================== Health Check ====================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    tenant: c.env.TENANT_ID || 'unknown',
    timestamp: Date.now()
  });
});

// ==================== Query Endpoints ====================

/**
 * POST /query
 * Execute query on tenant's AtomSpace
 */
app.post('/query', async (c) => {
  try {
    const pattern = await c.req.json();
    
    const queryEngine = new EnhancedDistributedQueryEngine({
      CACHE: c.env.COORDINATION_CACHE || c.env.ATOM_CACHE,
      ATOMSPACE_DO: c.env.ATOMSPACE
    });
    
    const result = await queryEngine.executeQuery(pattern);
    
    return c.json({
      success: true,
      tenant: c.env.TENANT_ID,
      result,
      metadata: {
        atomCount: result.atoms.length,
        bindingCount: result.bindings.length
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
 * POST /atom
 * Add atom to tenant's AtomSpace
 */
app.post('/atom', async (c) => {
  try {
    const atom = await c.req.json();
    
    // Get tenant's AtomSpace Durable Object
    const atomSpaceId = c.env.ATOMSPACE.idFromName(`tenant-${c.env.TENANT_ID}`);
    const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);
    
    const response = await atomSpaceStub.fetch(
      new Request('http://dummy/node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(atom)
      })
    );
    
    const data = await response.json();
    
    return c.json({
      success: true,
      tenant: c.env.TENANT_ID,
      data
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /atoms
 * List atoms in tenant's AtomSpace
 */
app.get('/atoms', async (c) => {
  try {
    const atomSpaceId = c.env.ATOMSPACE.idFromName(`tenant-${c.env.TENANT_ID}`);
    const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);
    
    const response = await atomSpaceStub.fetch(
      new Request('http://dummy/stats')
    );
    
    const data = await response.json();
    
    return c.json({
      success: true,
      tenant: c.env.TENANT_ID,
      data
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /relevance
 * Assess relevance of atoms
 */
app.post('/relevance', async (c) => {
  try {
    const { atomIds, context } = await c.req.json();
    
    const relevanceEngine = new RelevanceRealizationEngine();
    
    // Mock atoms for now - in production, fetch from AtomSpace
    const atoms = atomIds.map((id: string) => ({
      id,
      type: 'ConceptNode',
      name: `atom-${id}`,
      truthValue: { strength: 0.8, confidence: 0.9 },
      attentionValue: { sti: 50, lti: 10, vlti: 0 }
    }));
    
    const assessments = relevanceEngine.assessRelevance(atoms, context);
    
    return c.json({
      success: true,
      tenant: c.env.TENANT_ID,
      assessments
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ==================== Worker Export ====================

export { AtomSpace, MindAgent };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  }
} satisfies ExportedHandler<Env>;
