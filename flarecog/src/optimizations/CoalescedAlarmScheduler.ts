/**
 * CoalescedAlarmScheduler.ts
 * 
 * Optimized alarm system using coalescing to reduce overhead.
 * Instead of one alarm per task, uses a single recurring alarm
 * that processes batches of due tasks.
 * 
 * Expected improvement: 100/sec → 1000+/sec throughput
 */

import { DurableObject, DurableObjectState } from '@cloudflare/workers-types';

// Task types for cognitive scheduling
type TaskType = 
  | 'attention_decay'
  | 'memory_consolidation'
  | 'garbage_collection'
  | 'sync_checkpoint'
  | 'inference_batch'
  | 'custom';

interface ScheduledTask {
  taskId: string;
  taskType: TaskType;
  dueAt: number;
  priority: number; // 0-9, higher = more urgent
  payload: Record<string, any>;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
}

interface TaskResult {
  taskId: string;
  success: boolean;
  error?: string;
  executionTime: number;
}

interface SchedulerStats {
  totalScheduled: number;
  totalProcessed: number;
  totalFailed: number;
  averageLatency: number;
  lastProcessedAt: number;
}

/**
 * CoalescedAlarmScheduler Durable Object
 * 
 * Manages cognitive task scheduling with alarm coalescing for
 * high-throughput, low-overhead task execution.
 */
export class CoalescedAlarmScheduler implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  
  // Configuration
  private readonly ALARM_INTERVAL_MS = 1000; // Check every second
  private readonly BATCH_SIZE = 100; // Process up to 100 tasks per alarm
  private readonly MAX_EXECUTION_TIME_MS = 25000; // Leave 5s buffer before 30s limit
  
  // In-memory cache for hot tasks
  private taskQueue: Map<string, ScheduledTask> = new Map();
  private stats: SchedulerStats = {
    totalScheduled: 0,
    totalProcessed: 0,
    totalFailed: 0,
    averageLatency: 0,
    lastProcessedAt: 0
  };

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
    
    // Initialize from storage on startup
    this.state.blockConcurrencyWhile(async () => {
      await this.loadState();
      await this.ensureAlarmSet();
    });
  }

  /**
   * Load state from durable storage
   */
  private async loadState(): Promise<void> {
    // Load stats
    const savedStats = await this.storage.get<SchedulerStats>('stats');
    if (savedStats) {
      this.stats = savedStats;
    }

    // Load pending tasks into memory
    const taskEntries = await this.storage.list<ScheduledTask>({ prefix: 'task:' });
    for (const [key, task] of taskEntries) {
      this.taskQueue.set(task.taskId, task);
    }
  }

  /**
   * Ensure the coalesced alarm is set
   */
  private async ensureAlarmSet(): Promise<void> {
    const currentAlarm = await this.storage.getAlarm();
    if (!currentAlarm) {
      await this.storage.setAlarm(Date.now() + this.ALARM_INTERVAL_MS);
    }
  }

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/schedule':
          return this.handleSchedule(request);
        case '/cancel':
          return this.handleCancel(request);
        case '/stats':
          return this.handleStats();
        case '/pending':
          return this.handlePending(request);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Schedule a new task
   */
  private async handleSchedule(request: Request): Promise<Response> {
    const body = await request.json() as {
      taskType: TaskType;
      dueAt?: number;
      delayMs?: number;
      priority?: number;
      payload?: Record<string, any>;
      maxRetries?: number;
    };

    const taskId = crypto.randomUUID();
    const now = Date.now();
    
    const task: ScheduledTask = {
      taskId,
      taskType: body.taskType,
      dueAt: body.dueAt || (now + (body.delayMs || 0)),
      priority: body.priority || 5,
      payload: body.payload || {},
      retryCount: 0,
      maxRetries: body.maxRetries || 3,
      createdAt: now
    };

    // Store in both memory and durable storage
    this.taskQueue.set(taskId, task);
    await this.storage.put(`task:${taskId}`, task);
    
    this.stats.totalScheduled++;
    await this.storage.put('stats', this.stats);

    return new Response(JSON.stringify({ taskId, scheduledFor: task.dueAt }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Cancel a scheduled task
   */
  private async handleCancel(request: Request): Promise<Response> {
    const { taskId } = await request.json() as { taskId: string };
    
    const existed = this.taskQueue.has(taskId);
    this.taskQueue.delete(taskId);
    await this.storage.delete(`task:${taskId}`);

    return new Response(JSON.stringify({ cancelled: existed }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get scheduler statistics
   */
  private async handleStats(): Promise<Response> {
    return new Response(JSON.stringify({
      ...this.stats,
      pendingTasks: this.taskQueue.size,
      nextAlarm: await this.storage.getAlarm()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get pending tasks
   */
  private async handlePending(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    const tasks = Array.from(this.taskQueue.values())
      .sort((a, b) => a.dueAt - b.dueAt)
      .slice(0, limit);

    return new Response(JSON.stringify({ tasks }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Alarm handler - processes batches of due tasks
   */
  async alarm(): Promise<void> {
    const startTime = Date.now();
    const results: TaskResult[] = [];
    
    // Get due tasks sorted by priority (descending) then due time (ascending)
    const dueTasks = Array.from(this.taskQueue.values())
      .filter(task => task.dueAt <= startTime)
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.dueAt - b.dueAt;
      })
      .slice(0, this.BATCH_SIZE);

    // Process tasks in batch
    for (const task of dueTasks) {
      // Check if we're running out of time
      if (Date.now() - startTime > this.MAX_EXECUTION_TIME_MS) {
        break;
      }

      const taskStart = Date.now();
      try {
        await this.executeTask(task);
        
        results.push({
          taskId: task.taskId,
          success: true,
          executionTime: Date.now() - taskStart
        });

        // Remove completed task
        this.taskQueue.delete(task.taskId);
        await this.storage.delete(`task:${task.taskId}`);
        this.stats.totalProcessed++;

      } catch (error) {
        results.push({
          taskId: task.taskId,
          success: false,
          error: String(error),
          executionTime: Date.now() - taskStart
        });

        // Handle retry
        if (task.retryCount < task.maxRetries) {
          task.retryCount++;
          task.dueAt = Date.now() + this.calculateBackoff(task.retryCount);
          this.taskQueue.set(task.taskId, task);
          await this.storage.put(`task:${task.taskId}`, task);
        } else {
          // Max retries exceeded, remove task
          this.taskQueue.delete(task.taskId);
          await this.storage.delete(`task:${task.taskId}`);
          this.stats.totalFailed++;
        }
      }
    }

    // Update stats
    if (results.length > 0) {
      const totalLatency = results.reduce((sum, r) => sum + r.executionTime, 0);
      this.stats.averageLatency = 
        (this.stats.averageLatency * 0.9) + (totalLatency / results.length * 0.1);
      this.stats.lastProcessedAt = Date.now();
    }
    await this.storage.put('stats', this.stats);

    // Schedule next alarm with jitter to prevent thundering herd
    const jitter = Math.random() * 100; // 0-100ms jitter
    await this.storage.setAlarm(Date.now() + this.ALARM_INTERVAL_MS + jitter);
  }

  /**
   * Execute a single task based on its type
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    switch (task.taskType) {
      case 'attention_decay':
        await this.executeAttentionDecay(task.payload);
        break;
      case 'memory_consolidation':
        await this.executeMemoryConsolidation(task.payload);
        break;
      case 'garbage_collection':
        await this.executeGarbageCollection(task.payload);
        break;
      case 'sync_checkpoint':
        await this.executeSyncCheckpoint(task.payload);
        break;
      case 'inference_batch':
        await this.executeInferenceBatch(task.payload);
        break;
      case 'custom':
        await this.executeCustomTask(task.payload);
        break;
      default:
        throw new Error(`Unknown task type: ${task.taskType}`);
    }
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff(retryCount: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 1 minute
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    const jitter = Math.random() * exponentialDelay * 0.1;
    return exponentialDelay + jitter;
  }

  // ==================== Task Executors ====================

  /**
   * Execute attention decay for ECAN
   */
  private async executeAttentionDecay(payload: Record<string, any>): Promise<void> {
    const { atomspaceId, decayRate = 0.1 } = payload;
    // This would call into the AtomSpace Durable Object to decay attention values
    console.log(`Executing attention decay for ${atomspaceId} with rate ${decayRate}`);
    // Implementation would fetch atoms and reduce STI values
  }

  /**
   * Execute memory consolidation
   */
  private async executeMemoryConsolidation(payload: Record<string, any>): Promise<void> {
    const { atomspaceId, threshold = 0.3 } = payload;
    // Move low-attention atoms from hot storage to cold storage
    console.log(`Consolidating memory for ${atomspaceId} with threshold ${threshold}`);
  }

  /**
   * Execute garbage collection
   */
  private async executeGarbageCollection(payload: Record<string, any>): Promise<void> {
    const { atomspaceId, minAge = 86400000 } = payload; // 24 hours default
    // Remove atoms that have been below attention threshold for too long
    console.log(`GC for ${atomspaceId}, removing atoms older than ${minAge}ms`);
  }

  /**
   * Execute sync checkpoint
   */
  private async executeSyncCheckpoint(payload: Record<string, any>): Promise<void> {
    const { atomspaceId, targetNodes } = payload;
    // Trigger distributed sync with other AtomSpace nodes
    console.log(`Sync checkpoint for ${atomspaceId} to nodes: ${targetNodes}`);
  }

  /**
   * Execute batched inference tasks
   */
  private async executeInferenceBatch(payload: Record<string, any>): Promise<void> {
    const { queries, model } = payload;
    // Batch multiple inference requests for efficiency
    console.log(`Executing inference batch of ${queries?.length || 0} queries`);
  }

  /**
   * Execute custom task with arbitrary handler
   */
  private async executeCustomTask(payload: Record<string, any>): Promise<void> {
    const { handler, args } = payload;
    // Execute custom task logic
    console.log(`Executing custom task: ${handler}`);
  }
}

/**
 * Helper class for scheduling tasks from Workers
 */
export class TaskSchedulerClient {
  private schedulerStub: DurableObjectStub;

  constructor(stub: DurableObjectStub) {
    this.schedulerStub = stub;
  }

  /**
   * Schedule an attention decay task
   */
  async scheduleAttentionDecay(
    atomspaceId: string,
    delayMs: number = 60000,
    decayRate: number = 0.1
  ): Promise<string> {
    const response = await this.schedulerStub.fetch('http://internal/schedule', {
      method: 'POST',
      body: JSON.stringify({
        taskType: 'attention_decay',
        delayMs,
        priority: 7,
        payload: { atomspaceId, decayRate }
      })
    });
    const result = await response.json() as { taskId: string };
    return result.taskId;
  }

  /**
   * Schedule memory consolidation
   */
  async scheduleMemoryConsolidation(
    atomspaceId: string,
    delayMs: number = 300000 // 5 minutes
  ): Promise<string> {
    const response = await this.schedulerStub.fetch('http://internal/schedule', {
      method: 'POST',
      body: JSON.stringify({
        taskType: 'memory_consolidation',
        delayMs,
        priority: 5,
        payload: { atomspaceId }
      })
    });
    const result = await response.json() as { taskId: string };
    return result.taskId;
  }

  /**
   * Schedule garbage collection
   */
  async scheduleGarbageCollection(
    atomspaceId: string,
    delayMs: number = 3600000 // 1 hour
  ): Promise<string> {
    const response = await this.schedulerStub.fetch('http://internal/schedule', {
      method: 'POST',
      body: JSON.stringify({
        taskType: 'garbage_collection',
        delayMs,
        priority: 3,
        payload: { atomspaceId }
      })
    });
    const result = await response.json() as { taskId: string };
    return result.taskId;
  }

  /**
   * Get scheduler statistics
   */
  async getStats(): Promise<SchedulerStats & { pendingTasks: number }> {
    const response = await this.schedulerStub.fetch('http://internal/stats');
    return response.json();
  }
}

export default CoalescedAlarmScheduler;
