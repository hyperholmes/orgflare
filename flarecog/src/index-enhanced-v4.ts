/**
 * FlareCog v4.0 - Advanced OpenCog-CloudFlare AGI Integration
 * 
 * Complete integration featuring:
 * - Optimized services (Hyperdrive, Vision Pipeline, Coalesced Alarms, Parallel R2, Batched Queues)
 * - Reimagined ECAN Attention System
 * - Cognitive Synergy Framework
 * - Deep Tree Echo Foundation
 */

import { Hono } from "hono";
import {
  Env,
  Atom,
  Node,
  Link,
  TruthValue,
  AttentionValue,
} from "./types/cognitive";

// Core components
import { AtomSpace } from "./durable-objects/AtomSpace";
import { MindAgent } from "./durable-objects/MindAgent";
import { CloudFlareAIIntegration } from "./cognitive/CloudFlareAIIntegration";
import { PatternMatcher } from "./cognitive/PatternMatcher";
import { AIEnhancedReasoning } from "./cognitive/AIEnhancedReasoning";

// Optimized components
import { HyperdriveCoordinationLayer } from "./optimizations/HyperdriveCoordination";
import { OptimizedVisionPipeline, VisionToAtomAdapter } from "./optimizations/OptimizedVisionPipeline";
import { CoalescedAlarmScheduler, TaskSchedulerClient } from "./optimizations/CoalescedAlarmScheduler";
import { ParallelR2Storage, AtomSpaceSerializer } from "./optimizations/ParallelR2Storage";
import { BatchedCognitiveQueue, CognitiveQueueConsumer } from "./optimizations/BatchedCognitiveQueue";

// New cognitive systems (to be implemented below)
import { ECANAttentionSystem } from "./cognitive/ECANAttentionSystem";
import { CognitiveSynergyEngine } from "./cognitive/CognitiveSynergyEngine";
import { DeepTreeEchoCore } from "./cognitive/DeepTreeEchoCore";

// Streaming
import {
  CognitiveEventPublisher,
  CognitiveWebSocketManager,
} from "./streaming/CognitiveWebSocket";

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use("*", async (c, next) => {
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  c.res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (c.req.method === "OPTIONS") {
    return c.text("", 200);
  }

  await next();
});

// ==================== Platform Status ====================

app.get("/", async (c) => {
  const atomSpaceId = c.env.ATOMSPACE.idFromName("primary");
  const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

  try {
    const coordination = new HyperdriveCoordinationLayer(c.env);
    const storage = new ParallelR2Storage(c.env);
    const queueManager = new BatchedCognitiveQueue(c.env);

    const [atomSpaceStats, queueStats] = await Promise.all([
      atomSpaceStub
        .fetch(new Request("http://dummy/stats"))
        .then((r) => r.json()),
      queueManager.getStats(),
    ]);

    return c.json({
      platform: "FlareCog v4.0: Advanced OpenCog AGI on CloudFlare",
      version: "4.0.0",
      status: "active",
      features: {
        core: {
          atomSpace: "Hypergraph Knowledge Representation",
          mindAgents: "Autonomous Cognitive Processes",
          plnReasoning: "Probabilistic Logic Networks",
        },
        optimizations: {
          hyperdrive: "D1 Coordination with <20ms latency",
          visionPipeline: "Task-specific AI models <100ms",
          coalescedAlarms: "Batched scheduling 1000+/sec",
          parallelR2: "Multipart storage 200+ MB/s",
          batchedQueues: "Message batching 5000+/sec",
        },
        cognitive: {
          ecanAttention: "Reimagined Economic Attention Network",
          cognitiveSynergy: "Cross-component integration engine",
          deepTreeEcho: "Emergent awareness foundation",
        },
        ai: {
          workersAI: "Neural reasoning and perception",
          vectorize: "Semantic memory and similarity",
          streaming: "Real-time WebSocket events",
        },
      },
      metrics: {
        atomSpace: atomSpaceStats,
        queue: queueStats,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        platform: "FlareCog v4.0",
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// ==================== ECAN Attention System ====================

/**
 * Update atom attention values
 */
app.post("/api/attention/update", async (c) => {
  try {
    const { atomId, stiDelta, ltiDelta, instanceId } = await c.req.json();

    const ecan = new ECANAttentionSystem(c.env);
    const result = await ecan.updateAttention(
      instanceId || "primary",
      atomId,
      stiDelta,
      ltiDelta
    );

    // Schedule attention decay
    const scheduler = new TaskSchedulerClient(
      c.env.ALARM_SCHEDULER.get(c.env.ALARM_SCHEDULER.idFromName("global"))
    );
    await scheduler.scheduleAttentionDecay(instanceId || "primary", 60000);

    return c.json({
      success: true,
      atomId,
      newAttention: result,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * Get attention focus (high-STI atoms)
 */
app.get("/api/attention/focus/:instanceId", async (c) => {
  try {
    const instanceId = c.req.param("instanceId");
    const threshold = parseInt(c.req.query("threshold") || "50");

    const ecan = new ECANAttentionSystem(c.env);
    const focusAtoms = await ecan.getAttentionalFocus(instanceId, threshold);

    return c.json({
      success: true,
      threshold,
      count: focusAtoms.length,
      atoms: focusAtoms,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * Spread attention via HebbianLinks
 */
app.post("/api/attention/spread", async (c) => {
  try {
    const { sourceAtomId, instanceId } = await c.req.json();

    const ecan = new ECANAttentionSystem(c.env);
    const spreadResult = await ecan.spreadAttention(
      instanceId || "primary",
      sourceAtomId
    );

    return c.json({
      success: true,
      source: sourceAtomId,
      affectedAtoms: spreadResult.affected,
      totalSpread: spreadResult.totalSpread,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// ==================== Cognitive Synergy ====================

/**
 * Trigger cognitive synergy cycle
 */
app.post("/api/synergy/cycle", async (c) => {
  try {
    const { instanceId, components } = await c.req.json();

    const synergy = new CognitiveSynergyEngine(c.env);
    const result = await synergy.runSynergyCycle(
      instanceId || "primary",
      components || ["pln", "pattern", "attention", "learning"]
    );

    return c.json({
      success: true,
      cycleId: result.cycleId,
      interactions: result.interactions,
      emergentInsights: result.emergentInsights,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * Get synergy status
 */
app.get("/api/synergy/status/:instanceId", async (c) => {
  try {
    const instanceId = c.req.param("instanceId");

    const synergy = new CognitiveSynergyEngine(c.env);
    const status = await synergy.getStatus(instanceId);

    return c.json({
      success: true,
      status,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// ==================== Deep Tree Echo ====================

/**
 * Initialize Deep Tree Echo consciousness stream
 */
app.post("/api/echo/initialize", async (c) => {
  try {
    const { instanceId, config } = await c.req.json();

    const echo = new DeepTreeEchoCore(c.env);
    const result = await echo.initialize(instanceId || "primary", config);

    return c.json({
      success: true,
      echoId: result.echoId,
      streams: result.streams,
      status: "initialized",
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * Run echo cognitive loop iteration
 */
app.post("/api/echo/iterate", async (c) => {
  try {
    const { instanceId, input } = await c.req.json();

    const echo = new DeepTreeEchoCore(c.env);
    const result = await echo.iterate(instanceId || "primary", input);

    return c.json({
      success: true,
      iteration: result.iteration,
      streams: result.streamStates,
      output: result.output,
      emergentState: result.emergentState,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * Get echo consciousness state
 */
app.get("/api/echo/state/:instanceId", async (c) => {
  try {
    const instanceId = c.req.param("instanceId");

    const echo = new DeepTreeEchoCore(c.env);
    const state = await echo.getState(instanceId);

    return c.json({
      success: true,
      state,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// ==================== Optimized Vision ====================

/**
 * Process image with optimized vision pipeline
 */
app.post("/api/vision/process", async (c) => {
  try {
    const formData = await c.req.formData();
    const image = formData.get("image") as File;
    const task = formData.get("task") as string;
    const question = formData.get("question") as string;
    const instanceId = formData.get("instanceId") as string;

    if (!image) {
      throw new Error("No image provided");
    }

    const imageData = await image.arrayBuffer();
    const vision = new OptimizedVisionPipeline(c.env);

    const result = await vision.processImage(imageData, {
      detectObjects: task === "detect",
      classify: task === "classify",
      describe: task === "describe",
      question: question || undefined,
    });

    // Convert to atoms if requested
    if (formData.get("createAtoms") === "true") {
      const atomSpaceId = c.env.ATOMSPACE.idFromName(instanceId || "primary");
      const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

      let atoms: any[] = [];
      if (Array.isArray(result.results)) {
        atoms = VisionToAtomAdapter.detectionsToAtoms(result.results as any);
      }

      for (const atom of atoms) {
        await atomSpaceStub.fetch(
          new Request("http://dummy/atoms", {
            method: "POST",
            body: JSON.stringify(atom),
          })
        );
      }

      return c.json({
        success: true,
        vision: result,
        atomsCreated: atoms.length,
      });
    }

    return c.json({
      success: true,
      result,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// ==================== Optimized Storage ====================

/**
 * Create AtomSpace snapshot
 */
app.post("/api/storage/snapshot", async (c) => {
  try {
    const { instanceId } = await c.req.json();

    const atomSpaceId = c.env.ATOMSPACE.idFromName(instanceId || "primary");
    const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

    // Get all atoms
    const response = await atomSpaceStub.fetch(new Request("http://dummy/atoms"));
    const data = await response.json();
    const atoms = data.data as Atom[];

    // Serialize and upload
    const serialized = AtomSpaceSerializer.serialize(atoms);
    const storage = new ParallelR2Storage(c.env);
    const version = Date.now();

    const result = await storage.uploadSnapshot(
      instanceId || "primary",
      version,
      serialized
    );

    return c.json({
      success: true,
      snapshot: {
        key: result.key,
        version,
        atomCount: atoms.length,
        size: result.size,
        compressedSize: result.compressedSize,
        compressionRatio: result.compressionRatio,
        throughputMBps: result.throughputMBps,
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * Restore AtomSpace from snapshot
 */
app.post("/api/storage/restore", async (c) => {
  try {
    const { instanceId, version } = await c.req.json();

    const storage = new ParallelR2Storage(c.env);
    const result = await storage.downloadSnapshot(instanceId || "primary", version);

    const atoms = AtomSpaceSerializer.deserialize(result.data);

    // Restore to AtomSpace
    const atomSpaceId = c.env.ATOMSPACE.idFromName(instanceId || "primary");
    const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

    // Clear existing atoms
    await atomSpaceStub.fetch(
      new Request("http://dummy/atoms/clear", { method: "POST" })
    );

    // Restore atoms
    for (const atom of atoms) {
      await atomSpaceStub.fetch(
        new Request("http://dummy/atoms", {
          method: "POST",
          body: JSON.stringify(atom),
        })
      );
    }

    return c.json({
      success: true,
      restored: {
        version,
        atomCount: atoms.length,
        throughputMBps: result.throughputMBps,
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * List available snapshots
 */
app.get("/api/storage/snapshots/:instanceId", async (c) => {
  try {
    const instanceId = c.req.param("instanceId");

    const storage = new ParallelR2Storage(c.env);
    const result = await storage.listSnapshots(instanceId);

    return c.json({
      success: true,
      snapshots: result.snapshots,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// ==================== Batched Queue Operations ====================

/**
 * Enqueue cognitive task
 */
app.post("/api/queue/enqueue", async (c) => {
  try {
    const { category, priority, payload, deadline } = await c.req.json();

    const queueManager = new BatchedCognitiveQueue(c.env);
    const taskId = await queueManager.enqueue({
      category,
      priority: priority || 5,
      payload,
      deadline,
    });

    return c.json({
      success: true,
      taskId,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * Bulk enqueue tasks
 */
app.post("/api/queue/bulk-enqueue", async (c) => {
  try {
    const { tasks } = await c.req.json();

    const queueManager = new BatchedCognitiveQueue(c.env);
    const taskIds = await queueManager.enqueueBulk(tasks);

    return c.json({
      success: true,
      taskIds,
      count: taskIds.length,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * Get queue statistics
 */
app.get("/api/queue/stats", async (c) => {
  try {
    const queueManager = new BatchedCognitiveQueue(c.env);
    const stats = await queueManager.getStats();

    return c.json({
      success: true,
      stats,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// ==================== Distributed Coordination ====================

/**
 * Get coordination state
 */
app.get("/api/coordination/state/:atomspaceId", async (c) => {
  try {
    const atomspaceId = c.req.param("atomspaceId");

    const coordination = new HyperdriveCoordinationLayer(c.env);
    const state = await coordination.getCoordinationState(atomspaceId);

    return c.json({
      success: true,
      state,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * Update vector clock
 */
app.post("/api/coordination/clock", async (c) => {
  try {
    const { atomspaceId, nodeId, increment } = await c.req.json();

    const coordination = new HyperdriveCoordinationLayer(c.env);
    const newClock = await coordination.updateVectorClock(
      atomspaceId,
      nodeId,
      increment
    );

    return c.json({
      success: true,
      vectorClock: newClock,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// ==================== WebSocket Endpoint ====================

app.get("/ws", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected WebSocket", 426);
  }

  const wsManagerId = c.env.WS_MANAGER.idFromName("global");
  const wsManager = c.env.WS_MANAGER.get(wsManagerId);

  return wsManager.fetch(c.req.raw);
});

// ==================== Legacy API Compatibility ====================

// Include all v3 endpoints for backward compatibility
app.post("/api/cognitive/ai-pattern-match", async (c) => {
  try {
    const { pattern, useAI, instanceId } = await c.req.json();

    const atomSpaceId = c.env.ATOMSPACE.idFromName(instanceId || "primary");
    const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

    const response = await atomSpaceStub.fetch(new Request("http://dummy/atoms"));
    const atomsData = await response.json();
    const atoms = atomsData.data as Atom[];

    let results: Atom[];

    if (useAI) {
      const ai = new CloudFlareAIIntegration(c.env);
      results = await ai.naturalLanguageQuery(pattern, atoms);
    } else {
      const matcher = new PatternMatcher();
      results = matcher.match(pattern, atoms);
    }

    return c.json({
      success: true,
      pattern,
      matchCount: results.length,
      matches: results,
      aiEnhanced: useAI,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

app.post("/api/cognitive/ai-inference", async (c) => {
  try {
    const { premises, goal, instanceId } = await c.req.json();

    const atomSpaceId = c.env.ATOMSPACE.idFromName(instanceId || "primary");
    const atomSpaceStub = c.env.ATOMSPACE.get(atomSpaceId);

    const premiseAtoms: Atom[] = [];
    for (const premiseId of premises) {
      const response = await atomSpaceStub.fetch(
        new Request(`http://dummy/atoms/${premiseId}`)
      );
      const data = await response.json();
      if (data.success) {
        premiseAtoms.push(data.data);
      }
    }

    const ai = new CloudFlareAIIntegration(c.env);
    const inference = await ai.enhancedInference(premiseAtoms, goal);

    await atomSpaceStub.fetch(
      new Request("http://dummy/atoms", {
        method: "POST",
        body: JSON.stringify({
          type: "ConceptNode",
          name: inference.conclusion.name,
          truthValue: inference.truthValue,
        }),
      })
    );

    const publisher = new CognitiveEventPublisher(c.env);
    await publisher.publishAtomCreated(
      inference.conclusion,
      instanceId || "primary"
    );

    return c.json({
      success: true,
      conclusion: inference.conclusion,
      reasoning: inference.reasoning,
      confidence: inference.confidence,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// Export the app
export default app;

// Export Durable Object classes
export { AtomSpace } from "./durable-objects/AtomSpace";
export { MindAgent } from "./durable-objects/MindAgent";
export { CognitiveWebSocketManager } from "./streaming/CognitiveWebSocket";
export { CoalescedAlarmScheduler } from "./optimizations/CoalescedAlarmScheduler";
