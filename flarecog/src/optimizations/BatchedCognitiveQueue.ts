/**
 * BatchedCognitiveQueue.ts
 * 
 * Optimized queue system with message batching for high-throughput
 * cognitive task processing.
 * 
 * Expected improvement: 1000/sec → 5000+/sec throughput
 */

import { Queue, MessageBatch, Message } from '@cloudflare/workers-types';

// Task categories for cognitive processing
type CognitiveTaskCategory = 
  | 'inference'      // AI inference requests
  | 'reasoning'      // PLN reasoning tasks
  | 'attention'      // ECAN attention updates
  | 'memory'         // Memory operations
  | 'sync'           // Distributed sync
  | 'perception'     // Sensory processing
  | 'action';        // Motor/action execution

// Individual task within a batch
interface CognitiveTask {
  taskId: string;
  category: CognitiveTaskCategory;
  priority: number; // 0-9
  payload: Record<string, any>;
  createdAt: number;
  deadline?: number; // Optional deadline for time-sensitive tasks
}

// Batched message containing multiple tasks
interface BatchedMessage {
  batchId: string;
  category: CognitiveTaskCategory;
  tasks: CognitiveTask[];
  createdAt: number;
  totalTasks: number;
}

// Processing result
interface BatchResult {
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

// Queue statistics
interface QueueStats {
  totalEnqueued: number;
  totalProcessed: number;
  totalFailed: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  throughputPerSecond: number;
}

// Environment bindings
interface Env {
  COGNITIVE_QUEUE: Queue;
  PRIORITY_QUEUE: Queue;
  QUEUE_STATS: KVNamespace;
}

/**
 * BatchedCognitiveQueue
 * 
 * High-throughput queue manager that batches multiple cognitive tasks
 * into single messages to reduce queue operation overhead.
 */
export class BatchedCognitiveQueue {
  private queue: Queue;
  private priorityQueue: Queue;
  private statsStore: KVNamespace;
  
  // Batching configuration
  private readonly MAX_BATCH_SIZE = 50;
  private readonly BATCH_TIMEOUT_MS = 100; // Flush batch after 100ms
  private readonly PRIORITY_THRESHOLD = 7; // Tasks with priority >= 7 go to priority queue
  
  // In-memory batch buffers (per category)
  private batchBuffers: Map<CognitiveTaskCategory, CognitiveTask[]> = new Map();
  private batchTimers: Map<CognitiveTaskCategory, number> = new Map();
  
  // Stats tracking
  private stats: QueueStats = {
    totalEnqueued: 0,
    totalProcessed: 0,
    totalFailed: 0,
    averageBatchSize: 0,
    averageProcessingTime: 0,
    throughputPerSecond: 0
  };

  constructor(env: Env) {
    this.queue = env.COGNITIVE_QUEUE;
    this.priorityQueue = env.PRIORITY_QUEUE;
    this.statsStore = env.QUEUE_STATS;
    
    // Initialize buffers for each category
    const categories: CognitiveTaskCategory[] = [
      'inference', 'reasoning', 'attention', 'memory', 'sync', 'perception', 'action'
    ];
    for (const category of categories) {
      this.batchBuffers.set(category, []);
    }
  }

  /**
   * Enqueue a cognitive task with automatic batching
   */
  async enqueue(task: Omit<CognitiveTask, 'taskId' | 'createdAt'>): Promise<string> {
    const taskId = crypto.randomUUID();
    const fullTask: CognitiveTask = {
      ...task,
      taskId,
      createdAt: Date.now()
    };

    // High priority tasks go directly to priority queue
    if (task.priority >= this.PRIORITY_THRESHOLD) {
      await this.sendToPriorityQueue(fullTask);
      return taskId;
    }

    // Add to batch buffer
    const buffer = this.batchBuffers.get(task.category) || [];
    buffer.push(fullTask);
    this.batchBuffers.set(task.category, buffer);

    // Check if batch is full
    if (buffer.length >= this.MAX_BATCH_SIZE) {
      await this.flushBatch(task.category);
    } else {
      // Set/reset batch timer
      this.scheduleBatchFlush(task.category);
    }

    this.stats.totalEnqueued++;
    return taskId;
  }

  /**
   * Enqueue multiple tasks at once (bulk operation)
   */
  async enqueueBulk(tasks: Array<Omit<CognitiveTask, 'taskId' | 'createdAt'>>): Promise<string[]> {
    const taskIds: string[] = [];
    
    // Group tasks by category
    const grouped = new Map<CognitiveTaskCategory, CognitiveTask[]>();
    
    for (const task of tasks) {
      const taskId = crypto.randomUUID();
      taskIds.push(taskId);
      
      const fullTask: CognitiveTask = {
        ...task,
        taskId,
        createdAt: Date.now()
      };

      // High priority goes directly
      if (task.priority >= this.PRIORITY_THRESHOLD) {
        await this.sendToPriorityQueue(fullTask);
        continue;
      }

      const categoryTasks = grouped.get(task.category) || [];
      categoryTasks.push(fullTask);
      grouped.set(task.category, categoryTasks);
    }

    // Send batches for each category
    for (const [category, categoryTasks] of grouped) {
      // Split into batch-sized chunks
      for (let i = 0; i < categoryTasks.length; i += this.MAX_BATCH_SIZE) {
        const batch = categoryTasks.slice(i, i + this.MAX_BATCH_SIZE);
        await this.sendBatch(category, batch);
      }
    }

    this.stats.totalEnqueued += tasks.length;
    return taskIds;
  }

  /**
   * Send high-priority task directly
   */
  private async sendToPriorityQueue(task: CognitiveTask): Promise<void> {
    const message: BatchedMessage = {
      batchId: crypto.randomUUID(),
      category: task.category,
      tasks: [task],
      createdAt: Date.now(),
      totalTasks: 1
    };

    await this.priorityQueue.send(message);
  }

  /**
   * Schedule batch flush with timeout
   */
  private scheduleBatchFlush(category: CognitiveTaskCategory): void {
    // Clear existing timer
    const existingTimer = this.batchTimers.get(category);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.flushBatch(category);
    }, this.BATCH_TIMEOUT_MS) as unknown as number;
    
    this.batchTimers.set(category, timer);
  }

  /**
   * Flush a category's batch buffer
   */
  private async flushBatch(category: CognitiveTaskCategory): Promise<void> {
    const buffer = this.batchBuffers.get(category) || [];
    if (buffer.length === 0) return;

    // Clear buffer and timer
    this.batchBuffers.set(category, []);
    const timer = this.batchTimers.get(category);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(category);
    }

    // Send batch
    await this.sendBatch(category, buffer);
  }

  /**
   * Send a batch of tasks to the queue
   */
  private async sendBatch(
    category: CognitiveTaskCategory,
    tasks: CognitiveTask[]
  ): Promise<void> {
    const message: BatchedMessage = {
      batchId: crypto.randomUUID(),
      category,
      tasks,
      createdAt: Date.now(),
      totalTasks: tasks.length
    };

    await this.queue.send(message);
    
    // Update average batch size
    this.stats.averageBatchSize = 
      (this.stats.averageBatchSize * 0.9) + (tasks.length * 0.1);
  }

  /**
   * Flush all pending batches (call before worker shutdown)
   */
  async flushAll(): Promise<void> {
    const categories: CognitiveTaskCategory[] = [
      'inference', 'reasoning', 'attention', 'memory', 'sync', 'perception', 'action'
    ];
    
    await Promise.all(categories.map(cat => this.flushBatch(cat)));
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    // Load persisted stats
    const persisted = await this.statsStore.get('queue_stats', 'json');
    if (persisted) {
      return { ...this.stats, ...(persisted as Partial<QueueStats>) };
    }
    return this.stats;
  }

  /**
   * Update stats after processing
   */
  async updateStats(result: BatchResult): Promise<void> {
    this.stats.totalProcessed += result.successCount;
    this.stats.totalFailed += result.failedCount;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * 0.9) + (result.processingTime * 0.1);
    
    // Calculate throughput
    const elapsed = (Date.now() - result.processingTime) / 1000;
    if (elapsed > 0) {
      this.stats.throughputPerSecond = result.processedCount / elapsed;
    }

    // Persist stats periodically
    await this.statsStore.put('queue_stats', JSON.stringify(this.stats));
  }
}

/**
 * Queue consumer for processing batched cognitive tasks
 */
export class CognitiveQueueConsumer {
  private handlers: Map<CognitiveTaskCategory, (task: CognitiveTask) => Promise<any>>;

  constructor() {
    this.handlers = new Map();
  }

  /**
   * Register a handler for a task category
   */
  registerHandler(
    category: CognitiveTaskCategory,
    handler: (task: CognitiveTask) => Promise<any>
  ): void {
    this.handlers.set(category, handler);
  }

  /**
   * Process a batch of messages from the queue
   */
  async processBatch(batch: MessageBatch<BatchedMessage>): Promise<void> {
    for (const message of batch.messages) {
      const batchedMessage = message.body;
      const startTime = Date.now();
      
      try {
        const result = await this.processBatchedMessage(batchedMessage);
        
        // Log result
        console.log(`Processed batch ${batchedMessage.batchId}: ` +
          `${result.successCount}/${result.processedCount} succeeded in ${result.processingTime}ms`);
        
        // Acknowledge message
        message.ack();
        
      } catch (error) {
        console.error(`Failed to process batch ${batchedMessage.batchId}:`, error);
        // Retry the message
        message.retry();
      }
    }
  }

  /**
   * Process a single batched message containing multiple tasks
   */
  private async processBatchedMessage(message: BatchedMessage): Promise<BatchResult> {
    const startTime = Date.now();
    const results: BatchResult['results'] = [];
    
    const handler = this.handlers.get(message.category);
    if (!handler) {
      throw new Error(`No handler registered for category: ${message.category}`);
    }

    // Process tasks in parallel with concurrency limit
    const CONCURRENCY = 10;
    for (let i = 0; i < message.tasks.length; i += CONCURRENCY) {
      const chunk = message.tasks.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.allSettled(
        chunk.map(async (task) => {
          // Check deadline
          if (task.deadline && Date.now() > task.deadline) {
            return {
              taskId: task.taskId,
              success: false,
              error: 'Task deadline exceeded'
            };
          }

          try {
            const result = await handler(task);
            return {
              taskId: task.taskId,
              success: true,
              result
            };
          } catch (error) {
            return {
              taskId: task.taskId,
              success: false,
              error: String(error)
            };
          }
        })
      );

      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            taskId: 'unknown',
            success: false,
            error: result.reason
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return {
      batchId: message.batchId,
      processedCount: results.length,
      successCount,
      failedCount: results.length - successCount,
      processingTime: Date.now() - startTime,
      results
    };
  }
}

/**
 * Pre-built handlers for common cognitive tasks
 */
export const CognitiveTaskHandlers = {
  /**
   * Inference task handler
   */
  inference: async (task: CognitiveTask, ai: any): Promise<any> => {
    const { prompt, model, maxTokens } = task.payload;
    return ai.run(model, { prompt, max_tokens: maxTokens });
  },

  /**
   * Attention update handler
   */
  attention: async (task: CognitiveTask, atomspace: any): Promise<void> => {
    const { atomId, stiDelta, ltiDelta } = task.payload;
    await atomspace.updateAttention(atomId, stiDelta, ltiDelta);
  },

  /**
   * Memory operation handler
   */
  memory: async (task: CognitiveTask, storage: any): Promise<any> => {
    const { operation, key, value } = task.payload;
    switch (operation) {
      case 'store':
        return storage.put(key, value);
      case 'retrieve':
        return storage.get(key);
      case 'delete':
        return storage.delete(key);
      default:
        throw new Error(`Unknown memory operation: ${operation}`);
    }
  },

  /**
   * Sync operation handler
   */
  sync: async (task: CognitiveTask, coordinator: any): Promise<void> => {
    const { sourceNode, targetNode, atoms } = task.payload;
    await coordinator.syncAtoms(sourceNode, targetNode, atoms);
  }
};

export default BatchedCognitiveQueue;
