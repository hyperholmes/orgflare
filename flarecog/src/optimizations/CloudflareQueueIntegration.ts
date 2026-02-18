/**
 * Cloudflare Queue Integration for FlareCog
 *
 * Asynchronous cognitive processing using Cloudflare Queues
 * Enables background processing of:
 * - Long-running inference chains
 * - Batch pattern matching
 * - Memory consolidation
 * - Distributed coordination
 * - Federated learning aggregation
 */

import type { Queue, KVNamespace, DurableObjectNamespace } from '@cloudflare/workers-types';

export interface CognitiveTask {
  id: string;
  type: 'inference' | 'pattern_match' | 'consolidation' | 'coordination' | 'learning';
  priority: 'low' | 'normal' | 'high' | 'critical';
  tenantId?: string;
  atomSpaceId: string;
  params: any;
  createdAt: number;
  scheduledFor?: number;
  retryCount?: number;
  maxRetries?: number;
}

export interface TaskResult {
  taskId: string;
  status: 'success' | 'failure' | 'partial';
  result?: any;
  error?: string;
  processingTime: number;
  completedAt: number;
}

export interface InferenceChainTask {
  chainId: string;
  rules: string[];
  startAtoms: string[];
  maxDepth: number;
  timeout: number;
  currentDepth: number;
  intermediateResults: any[];
}

export interface PatternMatchTask {
  pattern: any;
  atomSpaceId: string;
  maxResults: number;
  timeout: number;
}

export interface ConsolidationTask {
  atomSpaceId: string;
  phase: 'replay' | 'strengthen' | 'prune' | 'generalize' | 'integrate';
  batchSize: number;
  criteria: any;
}

export interface CoordinationTask {
  operation: 'sync' | 'merge' | 'resolve_conflict';
  sourceNodes: string[];
  targetNode: string;
  conflictResolution: 'latest' | 'highest_confidence' | 'merge';
}

export interface LearningTask {
  type: 'hebbian' | 'pattern_mining' | 'federated_aggregate';
  atomSpaceId: string;
  config: any;
}

/**
 * Cloudflare Queue Integration Manager
 */
export class CloudflareQueueIntegration {
  constructor(
    private env: {
      COGNITIVE_QUEUE: Queue<unknown>;
      INFERENCE_QUEUE: Queue<unknown>;
      CONSOLIDATION_QUEUE: Queue<unknown>;
      COORDINATION_QUEUE: Queue<unknown>;
      TASK_RESULTS: KVNamespace;
      ATOMSPACE_DO: DurableObjectNamespace;
    }
  ) {}

  /**
   * Enqueue cognitive task
   */
  async enqueueTask(task: CognitiveTask): Promise<void> {
    const queue = this.selectQueue(task.type);

    await queue.send({
      ...task,
      enqueuedAt: Date.now()
    }, {
      contentType: 'json',
      delaySeconds: task.scheduledFor ? Math.max(0, (task.scheduledFor - Date.now()) / 1000) : 0
    });
  }

  /**
   * Process a cognitive task based on its type
   */
  async processTask(task: CognitiveTask): Promise<TaskResult> {
    let result: TaskResult;

    switch (task.type) {
      case 'inference':
        result = await this.processInferenceChain(task.params as InferenceChainTask);
        break;
      case 'pattern_match':
        result = await this.processPatternMatch(task.params as PatternMatchTask);
        break;
      case 'consolidation':
        result = await this.processConsolidation(task.params as ConsolidationTask);
        break;
      case 'coordination':
        result = await this.processCoordination(task.params as CoordinationTask);
        break;
      case 'learning':
        result = await this.processLearning(task.params as LearningTask);
        break;
      default:
        result = {
          taskId: task.id,
          status: 'failure',
          error: `Unknown task type: ${task.type}`,
          processingTime: 0,
          completedAt: Date.now()
        };
    }

    // Store the result
    await this.storeResult(result);

    return result;
  }

  /**
   * Enqueue batch of tasks
   */
  async enqueueBatch(tasks: CognitiveTask[]): Promise<void> {
    // Group by queue type
    const tasksByQueue = new Map<Queue, CognitiveTask[]>();
    
    for (const task of tasks) {
      const queue = this.selectQueue(task.type);
      if (!tasksByQueue.has(queue)) {
        tasksByQueue.set(queue, []);
      }
      tasksByQueue.get(queue)!.push(task);
    }
    
    // Send batches
    const promises = Array.from(tasksByQueue.entries()).map(([queue, queueTasks]) => 
      queue.sendBatch(queueTasks.map(task => ({
        body: { ...task, enqueuedAt: Date.now() },
        contentType: 'json' as const
      })))
    );
    
    await Promise.all(promises);
  }

  /**
   * Process inference chain task
   */
  async processInferenceChain(task: InferenceChainTask): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      // Get AtomSpace
      const atomSpace = await this.getAtomSpace(task.chainId);
      
      // Execute inference chain step
      const response = await atomSpace.fetch('https://internal/inference/chain', {
        method: 'POST',
        body: JSON.stringify({
          rules: task.rules,
          startAtoms: task.startAtoms,
          maxDepth: task.maxDepth,
          currentDepth: task.currentDepth
        })
      });
      
      const result = await response.json() as { hasMore?: boolean; [key: string]: unknown };

      // If chain continues, enqueue next step
      if (task.currentDepth < task.maxDepth && result.hasMore) {
        await this.enqueueTask({
          id: `${task.chainId}:${task.currentDepth + 1}`,
          type: 'inference',
          priority: 'normal',
          atomSpaceId: task.chainId,
          params: {
            ...task,
            currentDepth: task.currentDepth + 1,
            intermediateResults: [...task.intermediateResults, result]
          },
          createdAt: Date.now()
        });
      }
      
      return {
        taskId: task.chainId,
        status: 'success',
        result,
        processingTime: Date.now() - startTime,
        completedAt: Date.now()
      };
    } catch (error) {
      return {
        taskId: task.chainId,
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        completedAt: Date.now()
      };
    }
  }

  /**
   * Process pattern matching task
   */
  async processPatternMatch(task: PatternMatchTask): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      const atomSpace = await this.getAtomSpace(task.atomSpaceId);
      
      const response = await atomSpace.fetch('https://internal/pattern/match', {
        method: 'POST',
        body: JSON.stringify({
          pattern: task.pattern,
          maxResults: task.maxResults,
          timeout: task.timeout
        })
      });
      
      const result = await response.json() as Record<string, unknown>;

      return {
        taskId: `pattern:${task.atomSpaceId}`,
        status: 'success',
        result,
        processingTime: Date.now() - startTime,
        completedAt: Date.now()
      };
    } catch (error) {
      return {
        taskId: `pattern:${task.atomSpaceId}`,
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        completedAt: Date.now()
      };
    }
  }

  /**
   * Process memory consolidation task
   */
  async processConsolidation(task: ConsolidationTask): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      const atomSpace = await this.getAtomSpace(task.atomSpaceId);
      
      const response = await atomSpace.fetch('https://internal/memory/consolidate', {
        method: 'POST',
        body: JSON.stringify({
          phase: task.phase,
          batchSize: task.batchSize,
          criteria: task.criteria
        })
      });
      
      const result = await response.json() as { hasMore?: boolean; [key: string]: unknown };

      // If more batches needed, enqueue next batch
      if (result.hasMore) {
        await this.enqueueTask({
          id: `consolidation:${task.atomSpaceId}:${Date.now()}`,
          type: 'consolidation',
          priority: 'low',
          atomSpaceId: task.atomSpaceId,
          params: task,
          createdAt: Date.now()
        });
      }
      
      return {
        taskId: `consolidation:${task.atomSpaceId}`,
        status: 'success',
        result,
        processingTime: Date.now() - startTime,
        completedAt: Date.now()
      };
    } catch (error) {
      return {
        taskId: `consolidation:${task.atomSpaceId}`,
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        completedAt: Date.now()
      };
    }
  }

  /**
   * Process distributed coordination task
   */
  async processCoordination(task: CoordinationTask): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      const results: any[] = [];
      
      // Gather data from source nodes
      for (const sourceNodeId of task.sourceNodes) {
        const atomSpace = await this.getAtomSpace(sourceNodeId);
        const response = await atomSpace.fetch('https://internal/export', {
          method: 'GET'
        });
        const data = await response.json() as Record<string, unknown>;
        results.push({ nodeId: sourceNodeId, data });
      }
      
      // Merge or sync to target node
      const targetAtomSpace = await this.getAtomSpace(task.targetNode);
      
      const response = await targetAtomSpace.fetch('https://internal/coordination', {
        method: 'POST',
        body: JSON.stringify({
          operation: task.operation,
          sourceData: results,
          conflictResolution: task.conflictResolution
        })
      });
      
      const result = await response.json() as Record<string, unknown>;

      return {
        taskId: `coordination:${task.targetNode}`,
        status: 'success',
        result,
        processingTime: Date.now() - startTime,
        completedAt: Date.now()
      };
    } catch (error) {
      return {
        taskId: `coordination:${task.targetNode}`,
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        completedAt: Date.now()
      };
    }
  }

  /**
   * Process learning task
   */
  async processLearning(task: LearningTask): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      const atomSpace = await this.getAtomSpace(task.atomSpaceId);
      
      const response = await atomSpace.fetch('https://internal/learning', {
        method: 'POST',
        body: JSON.stringify({
          type: task.type,
          config: task.config
        })
      });
      
      const result = await response.json() as Record<string, unknown>;

      return {
        taskId: `learning:${task.atomSpaceId}`,
        status: 'success',
        result,
        processingTime: Date.now() - startTime,
        completedAt: Date.now()
      };
    } catch (error) {
      return {
        taskId: `learning:${task.atomSpaceId}`,
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        completedAt: Date.now()
      };
    }
  }

  /**
   * Store task result
   */
  async storeResult(result: TaskResult): Promise<void> {
    await this.env.TASK_RESULTS.put(
      `result:${result.taskId}`,
      JSON.stringify(result),
      { expirationTtl: 86400 } // 24 hours
    );
  }

  /**
   * Get task result
   */
  async getResult(taskId: string): Promise<TaskResult | null> {
    const data = await this.env.TASK_RESULTS.get(`result:${taskId}`, 'json');
    return data as TaskResult | null;
  }

  /**
   * Schedule recurring consolidation
   */
  async scheduleRecurringConsolidation(
    atomSpaceId: string,
    intervalMs: number
  ): Promise<void> {
    const phases: ConsolidationTask['phase'][] = [
      'replay',
      'strengthen',
      'prune',
      'generalize',
      'integrate'
    ];
    
    for (let i = 0; i < phases.length; i++) {
      await this.enqueueTask({
        id: `consolidation:${atomSpaceId}:${phases[i]}`,
        type: 'consolidation',
        priority: 'low',
        atomSpaceId,
        params: {
          atomSpaceId,
          phase: phases[i],
          batchSize: 100,
          criteria: {}
        },
        createdAt: Date.now(),
        scheduledFor: Date.now() + (intervalMs * i / phases.length)
      });
    }
  }

  /**
   * Schedule distributed sync
   */
  async scheduleDistributedSync(
    sourceNodes: string[],
    targetNode: string,
    intervalMs: number
  ): Promise<void> {
    await this.enqueueTask({
      id: `sync:${targetNode}:${Date.now()}`,
      type: 'coordination',
      priority: 'normal',
      atomSpaceId: targetNode,
      params: {
        operation: 'sync',
        sourceNodes,
        targetNode,
        conflictResolution: 'highest_confidence'
      },
      createdAt: Date.now(),
      scheduledFor: Date.now() + intervalMs
    });
  }

  /**
   * Handle task retry logic
   */
  async handleTaskRetry(task: CognitiveTask, error: Error): Promise<void> {
    const retryCount = (task.retryCount || 0) + 1;
    const maxRetries = task.maxRetries || 3;
    
    if (retryCount < maxRetries) {
      // Exponential backoff
      const delayMs = Math.pow(2, retryCount) * 1000;
      
      await this.enqueueTask({
        ...task,
        retryCount,
        scheduledFor: Date.now() + delayMs
      });
    } else {
      // Max retries exceeded, store failure
      await this.storeResult({
        taskId: task.id,
        status: 'failure',
        error: `Max retries exceeded: ${error.message}`,
        processingTime: 0,
        completedAt: Date.now()
      });
    }
  }

  /**
   * Select appropriate queue based on task type
   */
  private selectQueue(taskType: CognitiveTask['type']): Queue<unknown> {
    switch (taskType) {
      case 'inference':
        return this.env.INFERENCE_QUEUE;
      case 'consolidation':
        return this.env.CONSOLIDATION_QUEUE;
      case 'coordination':
        return this.env.COORDINATION_QUEUE;
      default:
        return this.env.COGNITIVE_QUEUE;
    }
  }

  /**
   * Get AtomSpace Durable Object stub
   */
  private async getAtomSpace(atomSpaceId: string) {
    const id = this.env.ATOMSPACE_DO.idFromName(atomSpaceId);
    return this.env.ATOMSPACE_DO.get(id);
  }
}

/**
 * Queue Consumer Handler
 * Processes messages from Cloudflare Queues
 */
export async function handleQueueMessage(
  batch: MessageBatch,
  env: any
): Promise<void> {
  const queueIntegration = new CloudflareQueueIntegration(env);
  
  for (const message of batch.messages) {
    try {
      const task = message.body as CognitiveTask;
      let result: TaskResult;
      
      switch (task.type) {
        case 'inference':
          result = await queueIntegration.processInferenceChain(task.params);
          break;
        case 'pattern_match':
          result = await queueIntegration.processPatternMatch(task.params);
          break;
        case 'consolidation':
          result = await queueIntegration.processConsolidation(task.params);
          break;
        case 'coordination':
          result = await queueIntegration.processCoordination(task.params);
          break;
        case 'learning':
          result = await queueIntegration.processLearning(task.params);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      await queueIntegration.storeResult(result);
      message.ack();
    } catch (error) {
      console.error('Error processing queue message:', error);
      
      // Retry logic
      const task = message.body as CognitiveTask;
      await queueIntegration.handleTaskRetry(task, error as Error);
      
      message.retry();
    }
  }
}
