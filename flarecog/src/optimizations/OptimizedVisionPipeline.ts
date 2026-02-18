/**
 * OptimizedVisionPipeline.ts
 * 
 * Optimized visual perception pipeline using task-specific models
 * instead of large general-purpose multimodal models.
 * 
 * Expected improvement: 300ms → <100ms latency
 */

import { Ai } from '@cloudflare/workers-types';

// Vision task types
type VisionTask = 
  | 'object_detection'
  | 'image_classification'
  | 'image_to_text'
  | 'visual_question_answering'
  | 'general_multimodal';

// Model selection based on task
const TASK_MODEL_MAP: Record<VisionTask, string> = {
  object_detection: '@cf/facebook/detr-resnet-50',
  image_classification: '@cf/microsoft/resnet-50',
  image_to_text: '@cf/llava-hf/llava-1.5-7b-hf',
  visual_question_answering: '@cf/llava-hf/llava-1.5-7b-hf',
  general_multimodal: '@cf/meta/llama-4-scout-17b-16e-instruct'
};

// Latency expectations per model (ms)
const MODEL_LATENCY: Record<string, number> = {
  '@cf/facebook/detr-resnet-50': 50,
  '@cf/microsoft/resnet-50': 30,
  '@cf/llava-hf/llava-1.5-7b-hf': 150,
  '@cf/meta/llama-4-scout-17b-16e-instruct': 300
};

// Result types
interface DetectionResult {
  label: string;
  confidence: number;
  box?: { xmin: number; ymin: number; xmax: number; ymax: number };
}

interface ClassificationResult {
  label: string;
  confidence: number;
}

interface VisionResult {
  task: VisionTask;
  model: string;
  latencyMs: number;
  results: DetectionResult[] | ClassificationResult[] | string;
  cached: boolean;
}

// Environment bindings
interface Env {
  AI: Ai;
  VISION_CACHE: KVNamespace;
}

/**
 * OptimizedVisionPipeline
 * 
 * Provides task-specific vision processing with automatic model selection,
 * result caching, and batch processing support.
 */
export class OptimizedVisionPipeline {
  private ai: Ai;
  private cache: KVNamespace;
  private cachePrefix = 'vision:';
  private cacheTTL = 3600; // 1 hour for vision results

  constructor(env: Env) {
    this.ai = env.AI;
    this.cache = env.VISION_CACHE;
  }

  /**
   * Automatically detect the best task type based on the request
   */
  private detectTaskType(options: {
    detectObjects?: boolean;
    classify?: boolean;
    describe?: boolean;
    question?: string;
  }): VisionTask {
    if (options.detectObjects) return 'object_detection';
    if (options.classify) return 'image_classification';
    if (options.question) return 'visual_question_answering';
    if (options.describe) return 'image_to_text';
    return 'general_multimodal';
  }

  /**
   * Generate cache key from image hash and task
   */
  private async generateCacheKey(
    imageData: ArrayBuffer | Uint8Array,
    task: VisionTask,
    additionalContext?: string
  ): Promise<string> {
    // Create a simple hash of the image data
    const hashBuffer = await crypto.subtle.digest('SHA-256', imageData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const contextHash = additionalContext 
      ? await this.hashString(additionalContext)
      : '';
    
    return `${this.cachePrefix}${task}:${hashHex.slice(0, 16)}:${contextHash.slice(0, 8)}`;
  }

  private async hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Process image with automatic task detection and model selection
   */
  async processImage(
    imageData: ArrayBuffer | Uint8Array,
    options: {
      detectObjects?: boolean;
      classify?: boolean;
      describe?: boolean;
      question?: string;
      useCache?: boolean;
      forceModel?: string;
    } = {}
  ): Promise<VisionResult> {
    const startTime = Date.now();
    const task = this.detectTaskType(options);
    const model = options.forceModel || TASK_MODEL_MAP[task];
    const useCache = options.useCache !== false;

    // Check cache first
    if (useCache) {
      const cacheKey = await this.generateCacheKey(imageData, task, options.question);
      const cached = await this.cache.get(cacheKey, 'json');
      if (cached) {
        return {
          ...(cached as VisionResult),
          cached: true,
          latencyMs: Date.now() - startTime
        };
      }
    }

    // Process based on task type
    let results: DetectionResult[] | ClassificationResult[] | string;

    switch (task) {
      case 'object_detection':
        results = await this.detectObjects(imageData, model);
        break;
      case 'image_classification':
        results = await this.classifyImage(imageData, model);
        break;
      case 'image_to_text':
        results = await this.describeImage(imageData, model);
        break;
      case 'visual_question_answering':
        results = await this.answerQuestion(imageData, options.question!, model);
        break;
      default:
        results = await this.generalMultimodal(imageData, options.question || 'Describe this image.', model);
    }

    const latencyMs = Date.now() - startTime;

    const result: VisionResult = {
      task,
      model,
      latencyMs,
      results,
      cached: false
    };

    // Cache the result
    if (useCache) {
      const cacheKey = await this.generateCacheKey(imageData, task, options.question);
      await this.cache.put(cacheKey, JSON.stringify(result), {
        expirationTtl: this.cacheTTL
      });
    }

    return result;
  }

  /**
   * Object detection using DETR (fast, specialized)
   */
  private async detectObjects(
    imageData: ArrayBuffer | Uint8Array,
    model: string
  ): Promise<DetectionResult[]> {
    const response = await this.ai.run(model as any, {
      image: [...new Uint8Array(imageData)]
    });

    // Transform response to standard format
    if (Array.isArray(response)) {
      return response.map((item: any) => ({
        label: item.label || item.class,
        confidence: item.score || item.confidence,
        box: item.box
      }));
    }

    return [];
  }

  /**
   * Image classification using ResNet (very fast)
   */
  private async classifyImage(
    imageData: ArrayBuffer | Uint8Array,
    model: string
  ): Promise<ClassificationResult[]> {
    const response = await this.ai.run(model as any, {
      image: [...new Uint8Array(imageData)]
    });

    if (Array.isArray(response)) {
      return response.map((item: any) => ({
        label: item.label,
        confidence: item.score
      }));
    }

    return [];
  }

  /**
   * Image description using LLaVA
   */
  private async describeImage(
    imageData: ArrayBuffer | Uint8Array,
    model: string
  ): Promise<string> {
    const response = await this.ai.run(model as any, {
      image: [...new Uint8Array(imageData)],
      prompt: 'Describe this image in detail.',
      max_tokens: 256
    });

    return (response as any).response || (response as any).description || '';
  }

  /**
   * Visual question answering
   */
  private async answerQuestion(
    imageData: ArrayBuffer | Uint8Array,
    question: string,
    model: string
  ): Promise<string> {
    const response = await this.ai.run(model as any, {
      image: [...new Uint8Array(imageData)],
      prompt: question,
      max_tokens: 256
    });

    return (response as any).response || '';
  }

  /**
   * General multimodal processing (fallback for complex tasks)
   */
  private async generalMultimodal(
    imageData: ArrayBuffer | Uint8Array,
    prompt: string,
    model: string
  ): Promise<string> {
    const response = await this.ai.run(model as any, {
      image: [...new Uint8Array(imageData)],
      prompt,
      max_tokens: 512
    });

    return (response as any).response || '';
  }

  /**
   * Batch process multiple images (for non-real-time analysis)
   */
  async batchProcess(
    images: Array<{
      id: string;
      data: ArrayBuffer | Uint8Array;
      options?: {
        detectObjects?: boolean;
        classify?: boolean;
        describe?: boolean;
        question?: string;
      };
    }>
  ): Promise<Map<string, VisionResult>> {
    const results = new Map<string, VisionResult>();

    // Process in parallel batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (img) => {
          const result = await this.processImage(img.data, img.options || {});
          return { id: img.id, result };
        })
      );

      for (const { id, result } of batchResults) {
        results.set(id, result);
      }
    }

    return results;
  }

  /**
   * Get recommended model for a specific use case
   */
  getRecommendedModel(useCase: string): { model: string; expectedLatency: number } {
    const useCaseLower = useCase.toLowerCase();

    if (useCaseLower.includes('detect') || useCaseLower.includes('find') || useCaseLower.includes('locate')) {
      return {
        model: TASK_MODEL_MAP.object_detection,
        expectedLatency: MODEL_LATENCY[TASK_MODEL_MAP.object_detection]
      };
    }

    if (useCaseLower.includes('classify') || useCaseLower.includes('categorize') || useCaseLower.includes('identify')) {
      return {
        model: TASK_MODEL_MAP.image_classification,
        expectedLatency: MODEL_LATENCY[TASK_MODEL_MAP.image_classification]
      };
    }

    if (useCaseLower.includes('describe') || useCaseLower.includes('caption')) {
      return {
        model: TASK_MODEL_MAP.image_to_text,
        expectedLatency: MODEL_LATENCY[TASK_MODEL_MAP.image_to_text]
      };
    }

    // Default to general multimodal for complex queries
    return {
      model: TASK_MODEL_MAP.general_multimodal,
      expectedLatency: MODEL_LATENCY[TASK_MODEL_MAP.general_multimodal]
    };
  }
}

/**
 * Vision perception adapter for AtomSpace integration
 * Converts vision results to Atoms for cognitive processing
 */
export class VisionToAtomAdapter {
  /**
   * Convert detection results to AtomSpace-compatible format
   */
  static detectionsToAtoms(results: DetectionResult[]): Array<{
    type: string;
    name: string;
    truthValue: { strength: number; confidence: number };
    metadata: Record<string, any>;
  }> {
    return results.map(detection => ({
      type: 'ConceptNode',
      name: `detected:${detection.label}`,
      truthValue: {
        strength: detection.confidence,
        confidence: 0.9 // High confidence in detection model
      },
      metadata: {
        source: 'vision_pipeline',
        boundingBox: detection.box,
        timestamp: Date.now()
      }
    }));
  }

  /**
   * Convert classifications to AtomSpace-compatible format
   */
  static classificationsToAtoms(results: ClassificationResult[]): Array<{
    type: string;
    name: string;
    truthValue: { strength: number; confidence: number };
  }> {
    return results.map(classification => ({
      type: 'ConceptNode',
      name: `class:${classification.label}`,
      truthValue: {
        strength: classification.confidence,
        confidence: 0.85
      }
    }));
  }
}

export default OptimizedVisionPipeline;
