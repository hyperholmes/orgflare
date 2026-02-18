/**
 * FlareCog v5.0 - Complete OpenCog AGI on CloudFlare Workers
 * 
 * This is the unified worker that integrates all cognitive systems:
 * - MOSES Evolutionary Learning
 * - PLN Probabilistic Logic Reasoning
 * - Sensorimotor Interface
 * - Attention Allocation Agent
 * - Memory Consolidation System
 * - ECAN Attention System
 * - Cognitive Synergy Engine
 * - Deep Tree Echo Core
 * 
 * Plus all optimization modules from v3/v4.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Core cognitive systems
import { ECANAttentionSystem } from './cognitive/ECANAttentionSystem';
import { CognitiveSynergyEngine } from './cognitive/CognitiveSynergyEngine';
import { DeepTreeEchoCore } from './cognitive/DeepTreeEchoCore';

// New v5 systems
import { MOSESEvolutionary } from './learning/MOSESEvolutionary';
import { PLNRuleEngine } from './reasoning/PLNRuleEngine';
import { SensorimotorInterface } from './interfaces/SensorimotorInterface';
import { AttentionAllocationAgent } from './agents/AttentionAllocationAgent';
import { MemoryConsolidationSystem } from './memory/MemoryConsolidationSystem';

// Optimization modules
import { HyperdriveCoordination } from './optimizations/HyperdriveCoordination';
import { OptimizedVisionPipeline } from './optimizations/OptimizedVisionPipeline';
import { CoalescedAlarmScheduler } from './optimizations/CoalescedAlarmScheduler';
import { ParallelR2Storage } from './optimizations/ParallelR2Storage';
import { BatchedCognitiveQueue } from './optimizations/BatchedCognitiveQueue';

// Types
import { Env } from './types/cognitive-v5';

// ==================== Application Setup ====================

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('*', cors());

// ==================== Health & Info ====================

app.get('/', (c) => {
  return c.json({
    name: 'FlareCog',
    version: '5.0.0',
    description: 'Complete OpenCog AGI on CloudFlare Workers',
    status: 'operational',
    systems: {
      core: ['AtomSpace', 'MindAgent', 'WebSocket'],
      cognitive: ['ECAN', 'CognitiveSynergy', 'DeepTreeEcho'],
      learning: ['MOSES'],
      reasoning: ['PLN'],
      interfaces: ['Sensorimotor'],
      agents: ['AttentionAllocation'],
      memory: ['Consolidation'],
      optimization: ['Hyperdrive', 'Vision', 'Alarms', 'R2Storage', 'Queues']
    },
    endpoints: {
      moses: '/api/moses/*',
      pln: '/api/pln/*',
      sensorimotor: '/api/sensorimotor/*',
      attention: '/api/attention/*',
      memory: '/api/memory/*',
      synergy: '/api/synergy/*',
      echo: '/api/echo/*',
      atoms: '/api/atoms/*'
    }
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: Date.now() });
});

// ==================== MOSES Evolutionary Learning ====================

app.post('/api/moses/evolve', async (c) => {
  const { problemId, examples, inputArity, outputType } = await c.req.json();
  
  const moses = new MOSESEvolutionary(c.env as any);
  const result = await moses.evolve(problemId, examples, inputArity, outputType);
  
  return c.json({
    success: true,
    data: {
      bestProgram: moses.treeToProgram(result.bestIndividual.tree),
      score: result.bestIndividual.score,
      generations: result.generations,
      evaluations: result.evaluations,
      demeStats: result.demeStats
    }
  });
});

app.get('/api/moses/state/:problemId', async (c) => {
  const problemId = c.req.param('problemId');
  
  const moses = new MOSESEvolutionary(c.env as any);
  const state = await moses.loadState(problemId);
  
  return c.json({ success: true, data: state });
});

// ==================== PLN Reasoning ====================

app.post('/api/pln/forward-chain', async (c) => {
  const { atomspaceId, maxSteps } = await c.req.json();
  
  const pln = new PLNRuleEngine(c.env as any);
  const chain = await pln.forwardChain(atomspaceId, maxSteps);
  
  return c.json({
    success: true,
    data: {
      chainId: chain.id,
      steps: chain.steps.length,
      finalConclusion: chain.finalConclusion,
      totalConfidence: chain.totalConfidence
    }
  });
});

app.post('/api/pln/backward-chain', async (c) => {
  const { atomspaceId, goal, maxDepth } = await c.req.json();
  
  const pln = new PLNRuleEngine(c.env as any);
  const chain = await pln.backwardChain(atomspaceId, goal, maxDepth);
  
  return c.json({
    success: true,
    data: {
      chainId: chain.id,
      proven: !!chain.finalConclusion,
      steps: chain.steps.length,
      confidence: chain.totalConfidence
    }
  });
});

app.post('/api/pln/apply-rule', async (c) => {
  const { atomspaceId, ruleName, premiseIds } = await c.req.json();
  
  const pln = new PLNRuleEngine(c.env as any);
  const step = await pln.applyRule(atomspaceId, ruleName, premiseIds);
  
  return c.json({ success: true, data: step });
});

app.get('/api/pln/rules', async (c) => {
  const pln = new PLNRuleEngine(c.env as any);
  const rules = pln.getRules();
  
  return c.json({ success: true, data: rules });
});

app.get('/api/pln/chain/:chainId', async (c) => {
  const chainId = c.req.param('chainId');
  
  const pln = new PLNRuleEngine(c.env as any);
  const chain = await pln.getChain(chainId);
  
  if (!chain) {
    return c.json({ success: false, error: 'Chain not found' }, 404);
  }
  
  const explanation = await pln.explainChain(chain);
  
  return c.json({ success: true, data: { chain, explanation } });
});

// ==================== Sensorimotor Interface ====================

app.post('/api/sensorimotor/initialize', async (c) => {
  const { instanceId } = await c.req.json();
  
  const sensorimotor = new SensorimotorInterface(c.env as any);
  await sensorimotor.initialize(instanceId);
  
  return c.json({ success: true, data: sensorimotor.getStateSummary() });
});

app.post('/api/sensorimotor/sensor/register', async (c) => {
  const { instanceId, config } = await c.req.json();
  
  const sensorimotor = new SensorimotorInterface(c.env as any);
  await sensorimotor.initialize(instanceId);
  const result = await sensorimotor.registerSensor(instanceId, config);
  
  return c.json({ success: true, data: result });
});

app.post('/api/sensorimotor/actuator/register', async (c) => {
  const { instanceId, config } = await c.req.json();
  
  const sensorimotor = new SensorimotorInterface(c.env as any);
  await sensorimotor.initialize(instanceId);
  const result = await sensorimotor.registerActuator(instanceId, config);
  
  return c.json({ success: true, data: result });
});

app.post('/api/sensorimotor/perceive', async (c) => {
  const { instanceId, sensorId, data } = await c.req.json();
  
  const sensorimotor = new SensorimotorInterface(c.env as any);
  await sensorimotor.initialize(instanceId);
  const perception = await sensorimotor.perceive(instanceId, sensorId, data);
  
  return c.json({ success: true, data: perception });
});

app.post('/api/sensorimotor/act', async (c) => {
  const { instanceId, actuatorId, command } = await c.req.json();
  
  const sensorimotor = new SensorimotorInterface(c.env as any);
  await sensorimotor.initialize(instanceId);
  const action = await sensorimotor.act(instanceId, actuatorId, command);
  
  return c.json({ success: true, data: action });
});

app.post('/api/sensorimotor/ground', async (c) => {
  const { instanceId, symbolId, symbolName, groundingType, externalId, externalSource } = await c.req.json();
  
  const sensorimotor = new SensorimotorInterface(c.env as any);
  await sensorimotor.initialize(instanceId);
  const grounding = await sensorimotor.ground(
    instanceId, symbolId, symbolName, groundingType, externalId, externalSource
  );
  
  return c.json({ success: true, data: grounding });
});

app.get('/api/sensorimotor/state/:instanceId', async (c) => {
  const instanceId = c.req.param('instanceId');
  
  const sensorimotor = new SensorimotorInterface(c.env as any);
  await sensorimotor.initialize(instanceId);
  
  return c.json({ success: true, data: sensorimotor.getStateSummary() });
});

// ==================== Attention Allocation Agent ====================

app.post('/api/attention/agent/initialize', async (c) => {
  const { instanceId, config } = await c.req.json();
  
  const agent = new AttentionAllocationAgent(c.env as any, config);
  const state = await agent.initialize(instanceId);
  
  return c.json({ success: true, data: state });
});

app.post('/api/attention/agent/cycle', async (c) => {
  const { instanceId } = await c.req.json();
  
  const agent = new AttentionAllocationAgent(c.env as any);
  await agent.initialize(instanceId);
  const stats = await agent.runCycle();
  
  return c.json({ success: true, data: stats });
});

app.post('/api/attention/stimulate', async (c) => {
  const { instanceId, atomId, amount } = await c.req.json();
  
  const agent = new AttentionAllocationAgent(c.env as any);
  await agent.initialize(instanceId);
  const attention = await agent.stimulate(atomId, amount);
  
  return c.json({ success: true, data: attention });
});

app.get('/api/attention/focus/:instanceId', async (c) => {
  const instanceId = c.req.param('instanceId');
  
  const agent = new AttentionAllocationAgent(c.env as any);
  await agent.initialize(instanceId);
  const focus = await agent.getAttentionalFocus();
  
  return c.json({ success: true, data: focus });
});

app.get('/api/attention/agent/state/:instanceId', async (c) => {
  const instanceId = c.req.param('instanceId');
  
  const agent = new AttentionAllocationAgent(c.env as any);
  await agent.initialize(instanceId);
  
  return c.json({ success: true, data: agent.getState() });
});

app.get('/api/attention/events/:instanceId', async (c) => {
  const instanceId = c.req.param('instanceId');
  const count = parseInt(c.req.query('count') || '100');
  
  const agent = new AttentionAllocationAgent(c.env as any);
  await agent.initialize(instanceId);
  
  return c.json({ success: true, data: agent.getRecentEvents(count) });
});

// ==================== Memory Consolidation ====================

app.post('/api/memory/store', async (c) => {
  const { instanceId, type, content, metadata } = await c.req.json();
  
  const memory = new MemoryConsolidationSystem(c.env as any);
  const entry = await memory.storeMemory(instanceId, type, content, metadata);
  
  return c.json({ success: true, data: entry });
});

app.get('/api/memory/:instanceId/:memoryId', async (c) => {
  const instanceId = c.req.param('instanceId');
  const memoryId = c.req.param('memoryId');
  
  const memory = new MemoryConsolidationSystem(c.env as any);
  const entry = await memory.retrieveMemory(instanceId, memoryId);
  
  if (!entry) {
    return c.json({ success: false, error: 'Memory not found' }, 404);
  }
  
  return c.json({ success: true, data: entry });
});

app.post('/api/memory/search', async (c) => {
  const { instanceId, query, limit } = await c.req.json();
  
  const memory = new MemoryConsolidationSystem(c.env as any);
  const results = await memory.searchMemories(instanceId, query, limit);
  
  return c.json({ success: true, data: results });
});

app.post('/api/memory/consolidate', async (c) => {
  const { instanceId } = await c.req.json();
  
  const memory = new MemoryConsolidationSystem(c.env as any);
  const session = await memory.runConsolidation(instanceId);
  
  return c.json({ success: true, data: session });
});

app.get('/api/memory/stats/:instanceId', async (c) => {
  const instanceId = c.req.param('instanceId');
  
  const memory = new MemoryConsolidationSystem(c.env as any);
  const stats = await memory.getMemoryStats(instanceId);
  
  return c.json({ success: true, data: stats });
});

app.get('/api/memory/history/:instanceId', async (c) => {
  const instanceId = c.req.param('instanceId');
  const limit = parseInt(c.req.query('limit') || '10');
  
  const memory = new MemoryConsolidationSystem(c.env as any);
  const history = await memory.getConsolidationHistory(instanceId, limit);
  
  return c.json({ success: true, data: history });
});

// ==================== Cognitive Synergy ====================

app.post('/api/synergy/cycle', async (c) => {
  const { instanceId, focusAtomIds } = await c.req.json();
  
  const synergy = new CognitiveSynergyEngine(c.env as any);
  await synergy.initialize(instanceId);
  const result = await synergy.runSynergyCycle(focusAtomIds);
  
  return c.json({ success: true, data: result });
});

app.get('/api/synergy/status/:instanceId', async (c) => {
  const instanceId = c.req.param('instanceId');
  
  const synergy = new CognitiveSynergyEngine(c.env as any);
  await synergy.initialize(instanceId);
  
  return c.json({ success: true, data: synergy.getStatus() });
});

// ==================== Deep Tree Echo ====================

app.post('/api/echo/initialize', async (c) => {
  const { instanceId, config } = await c.req.json();
  
  const echo = new DeepTreeEchoCore(c.env as any);
  const result = await echo.initialize(instanceId, config);
  
  return c.json({ success: true, data: result });
});

app.post('/api/echo/iterate', async (c) => {
  const { instanceId, input } = await c.req.json();
  
  const echo = new DeepTreeEchoCore(c.env as any);
  const result = await echo.iterate(instanceId, input);
  
  return c.json({ success: true, data: result });
});

app.get('/api/echo/state/:instanceId', async (c) => {
  const instanceId = c.req.param('instanceId');
  
  const echo = new DeepTreeEchoCore(c.env as any);
  const state = await echo.getState(instanceId);
  
  return c.json({ success: true, data: state });
});

app.post('/api/echo/demonstrate', async (c) => {
  const { instanceId } = await c.req.json();
  
  const echo = new DeepTreeEchoCore(c.env as any);
  const demonstration = await echo.demonstrateEntelechy(instanceId);
  
  return c.json({ success: true, data: demonstration });
});

// ==================== ECAN Attention ====================

app.post('/api/ecan/update', async (c) => {
  const { instanceId, atomId, sti, lti, vlti } = await c.req.json();
  
  const ecan = new ECANAttentionSystem(c.env as any);
  const result = await ecan.updateAttention(instanceId, atomId, { sti, lti, vlti });
  
  return c.json({ success: true, data: result });
});

app.post('/api/ecan/spread', async (c) => {
  const { instanceId, sourceAtomId } = await c.req.json();
  
  const ecan = new ECANAttentionSystem(c.env as any);
  const result = await ecan.spreadAttention(instanceId, sourceAtomId);
  
  return c.json({ success: true, data: result });
});

app.post('/api/ecan/decay', async (c) => {
  const { instanceId } = await c.req.json();
  
  const ecan = new ECANAttentionSystem(c.env as any);
  const result = await ecan.applyDecay(instanceId);
  
  return c.json({ success: true, data: result });
});

// ==================== AtomSpace Operations ====================

app.post('/api/atoms', async (c) => {
  const { instanceId, atom } = await c.req.json();
  
  const id = c.env.ATOMSPACE.idFromName(instanceId);
  const stub = c.env.ATOMSPACE.get(id);
  
  const response = await stub.fetch(
    new Request('http://dummy/atoms', {
      method: 'POST',
      body: JSON.stringify(atom)
    })
  );
  
  const data = await response.json();
  return c.json(data);
});

app.get('/api/atoms/:instanceId/:atomId', async (c) => {
  const instanceId = c.req.param('instanceId');
  const atomId = c.req.param('atomId');
  
  const id = c.env.ATOMSPACE.idFromName(instanceId);
  const stub = c.env.ATOMSPACE.get(id);
  
  const response = await stub.fetch(
    new Request(`http://dummy/atoms/${atomId}`, { method: 'GET' })
  );
  
  const data = await response.json();
  return c.json(data);
});

app.post('/api/atoms/query', async (c) => {
  const { instanceId, query } = await c.req.json();
  
  const id = c.env.ATOMSPACE.idFromName(instanceId);
  const stub = c.env.ATOMSPACE.get(id);
  
  const response = await stub.fetch(
    new Request('http://dummy/query', {
      method: 'POST',
      body: JSON.stringify(query)
    })
  );
  
  const data = await response.json();
  return c.json(data);
});

// ==================== Optimization Endpoints ====================

app.post('/api/vision/process', async (c) => {
  const { instanceId, image, task, question } = await c.req.json();
  
  const vision = new OptimizedVisionPipeline(c.env as any);
  const result = await vision.process(instanceId, image, task, question);
  
  return c.json({ success: true, data: result });
});

app.post('/api/storage/snapshot', async (c) => {
  const { instanceId, atomspaceData } = await c.req.json();
  
  const storage = new ParallelR2Storage(c.env as any);
  const result = await storage.createSnapshot(instanceId, atomspaceData);
  
  return c.json({ success: true, data: result });
});

app.post('/api/storage/restore', async (c) => {
  const { instanceId, snapshotKey } = await c.req.json();
  
  const storage = new ParallelR2Storage(c.env as any);
  const result = await storage.restoreSnapshot(instanceId, snapshotKey);
  
  return c.json({ success: true, data: result });
});

app.post('/api/queue/enqueue', async (c) => {
  const { category, priority, payload } = await c.req.json();
  
  const queue = new BatchedCognitiveQueue(c.env as any);
  await queue.enqueue(category, priority, payload);
  
  return c.json({ success: true });
});

app.get('/api/queue/stats', async (c) => {
  const queue = new BatchedCognitiveQueue(c.env as any);
  const stats = await queue.getStats();
  
  return c.json({ success: true, data: stats });
});

// ==================== Scheduled Tasks ====================

app.get('/api/scheduled/attention-decay', async (c) => {
  // Triggered by cron every 5 minutes
  const instances = await getActiveInstances(c.env);
  
  for (const instanceId of instances) {
    const agent = new AttentionAllocationAgent(c.env as any);
    await agent.initialize(instanceId);
    await agent.runCycle();
  }
  
  return c.json({ success: true, processed: instances.length });
});

app.get('/api/scheduled/memory-consolidation', async (c) => {
  // Triggered by cron every hour
  const instances = await getActiveInstances(c.env);
  
  for (const instanceId of instances) {
    const memory = new MemoryConsolidationSystem(c.env as any);
    await memory.runConsolidation(instanceId);
  }
  
  return c.json({ success: true, processed: instances.length });
});

// ==================== Helper Functions ====================

async function getActiveInstances(env: Env): Promise<string[]> {
  // Get list of active instances from KV
  const list = await env.INSTANCE_REGISTRY.list({ prefix: 'instance:' });
  return list.keys.map(k => k.name.replace('instance:', ''));
}

// ==================== Error Handling ====================

app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    success: false,
    error: err.message || 'Internal server error'
  }, 500);
});

app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found'
  }, 404);
});

// ==================== Export ====================

export default app;

// Export Durable Objects
export { AtomSpace } from './durable-objects/AtomSpace';
export { MindAgent } from './durable-objects/MindAgent';
export { CognitiveWebSocketManager } from './streaming/CognitiveWebSocket';
export { CoalescedAlarmScheduler } from './optimizations/CoalescedAlarmScheduler';
