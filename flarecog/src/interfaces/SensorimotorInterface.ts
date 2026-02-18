/**
 * SensorimotorInterface.ts
 * 
 * Sensorimotor interface for connecting FlareCog to external APIs and services.
 * Provides perception (input) and action (output) capabilities for the AGI system.
 * 
 * Key concepts:
 * - Sensors: Input channels that perceive the environment
 * - Actuators: Output channels that affect the environment
 * - Grounding: Connecting abstract symbols to real-world entities
 * - Embodiment: The system's presence in the world through APIs
 */

import { Ai } from '@cloudflare/workers-types';

// ==================== Types ====================

/**
 * Sensor types for different input modalities
 */
type SensorType = 
  | 'text'           // Natural language input
  | 'image'          // Visual input
  | 'audio'          // Audio input
  | 'structured'     // JSON/structured data
  | 'time'           // Temporal signals
  | 'location'       // Geospatial data
  | 'social'         // Social media/communication
  | 'financial'      // Market/financial data
  | 'environmental'; // Weather, sensors, IoT

/**
 * Actuator types for different output modalities
 */
type ActuatorType = 
  | 'text'           // Natural language output
  | 'image'          // Image generation
  | 'audio'          // Audio/speech generation
  | 'api_call'       // External API invocation
  | 'database'       // Database operations
  | 'notification'   // Push notifications
  | 'email'          // Email sending
  | 'webhook'        // Webhook triggers
  | 'file';          // File operations

/**
 * Sensor configuration
 */
interface SensorConfig {
  id: string;
  type: SensorType;
  name: string;
  endpoint?: string;
  apiKey?: string;
  pollInterval?: number;
  transform?: string;  // JSONPath or transformation expression
  enabled: boolean;
}

/**
 * Actuator configuration
 */
interface ActuatorConfig {
  id: string;
  type: ActuatorType;
  name: string;
  endpoint?: string;
  apiKey?: string;
  rateLimit?: number;
  transform?: string;
  enabled: boolean;
}

/**
 * Perception (sensor reading)
 */
interface Perception {
  id: string;
  sensorId: string;
  sensorType: SensorType;
  timestamp: number;
  rawData: any;
  processedData: any;
  atoms: AtomCreation[];
  confidence: number;
}

/**
 * Action (actuator command)
 */
interface Action {
  id: string;
  actuatorId: string;
  actuatorType: ActuatorType;
  timestamp: number;
  command: any;
  result?: any;
  success: boolean;
  error?: string;
}

/**
 * Atom creation from perception
 */
interface AtomCreation {
  type: string;
  name?: string;
  outgoing?: string[];
  truthValue: { strength: number; confidence: number };
}

/**
 * Grounding entry (symbol to real-world mapping)
 */
interface GroundingEntry {
  symbolId: string;
  symbolName: string;
  groundingType: 'entity' | 'property' | 'relation' | 'action';
  externalId?: string;
  externalSource?: string;
  lastUpdated: number;
}

/**
 * Sensorimotor state
 */
interface SensorimotorState {
  sensors: Map<string, SensorConfig>;
  actuators: Map<string, ActuatorConfig>;
  groundings: Map<string, GroundingEntry>;
  perceptionHistory: Perception[];
  actionHistory: Action[];
}

// ==================== Environment ====================

interface Env {
  ATOMSPACE: DurableObjectNamespace;
  AI: Ai;
  SENSORIMOTOR_STATE: KVNamespace;
  COGNITIVE_QUEUE: Queue;
}

// ==================== Sensorimotor Interface ====================

/**
 * SensorimotorInterface
 * 
 * Connects the AGI system to the external world through sensors and actuators.
 */
export class SensorimotorInterface {
  private env: Env;
  private statePrefix = 'sensorimotor:';
  private sensors: Map<string, SensorConfig> = new Map();
  private actuators: Map<string, ActuatorConfig> = new Map();
  private groundings: Map<string, GroundingEntry> = new Map();

  constructor(env: Env) {
    this.env = env;
  }

  // ==================== Initialization ====================

  /**
   * Initialize the sensorimotor interface
   */
  async initialize(instanceId: string): Promise<void> {
    // Load saved state
    await this.loadState(instanceId);

    // Register default sensors
    await this.registerDefaultSensors();

    // Register default actuators
    await this.registerDefaultActuators();

    // Save state
    await this.saveState(instanceId);
  }

  /**
   * Register default sensors
   */
  private async registerDefaultSensors(): Promise<void> {
    // Time sensor
    this.sensors.set('time', {
      id: 'time',
      type: 'time',
      name: 'System Clock',
      pollInterval: 60000, // 1 minute
      enabled: true
    });

    // Text input sensor
    this.sensors.set('text_input', {
      id: 'text_input',
      type: 'text',
      name: 'Text Input',
      enabled: true
    });

    // Structured data sensor
    this.sensors.set('structured_input', {
      id: 'structured_input',
      type: 'structured',
      name: 'Structured Data Input',
      enabled: true
    });
  }

  /**
   * Register default actuators
   */
  private async registerDefaultActuators(): Promise<void> {
    // Text output actuator
    this.actuators.set('text_output', {
      id: 'text_output',
      type: 'text',
      name: 'Text Output',
      enabled: true
    });

    // API call actuator
    this.actuators.set('api_call', {
      id: 'api_call',
      type: 'api_call',
      name: 'External API',
      rateLimit: 100, // per minute
      enabled: true
    });

    // Webhook actuator
    this.actuators.set('webhook', {
      id: 'webhook',
      type: 'webhook',
      name: 'Webhook Trigger',
      enabled: true
    });
  }

  // ==================== Sensor Registration ====================

  /**
   * Register a custom sensor
   */
  async registerSensor(
    instanceId: string,
    config: SensorConfig
  ): Promise<{ success: boolean; sensorId: string }> {
    this.sensors.set(config.id, config);
    await this.saveState(instanceId);
    
    return { success: true, sensorId: config.id };
  }

  /**
   * Register an external API as a sensor
   */
  async registerAPISensor(
    instanceId: string,
    name: string,
    endpoint: string,
    apiKey?: string,
    pollInterval?: number
  ): Promise<{ success: boolean; sensorId: string }> {
    const sensorId = `api_${crypto.randomUUID().slice(0, 8)}`;
    
    const config: SensorConfig = {
      id: sensorId,
      type: 'structured',
      name,
      endpoint,
      apiKey,
      pollInterval,
      enabled: true
    };

    return this.registerSensor(instanceId, config);
  }

  /**
   * Unregister a sensor
   */
  async unregisterSensor(instanceId: string, sensorId: string): Promise<boolean> {
    const deleted = this.sensors.delete(sensorId);
    if (deleted) {
      await this.saveState(instanceId);
    }
    return deleted;
  }

  // ==================== Actuator Registration ====================

  /**
   * Register a custom actuator
   */
  async registerActuator(
    instanceId: string,
    config: ActuatorConfig
  ): Promise<{ success: boolean; actuatorId: string }> {
    this.actuators.set(config.id, config);
    await this.saveState(instanceId);
    
    return { success: true, actuatorId: config.id };
  }

  /**
   * Register an external API as an actuator
   */
  async registerAPIActuator(
    instanceId: string,
    name: string,
    endpoint: string,
    apiKey?: string,
    rateLimit?: number
  ): Promise<{ success: boolean; actuatorId: string }> {
    const actuatorId = `api_${crypto.randomUUID().slice(0, 8)}`;
    
    const config: ActuatorConfig = {
      id: actuatorId,
      type: 'api_call',
      name,
      endpoint,
      apiKey,
      rateLimit,
      enabled: true
    };

    return this.registerActuator(instanceId, config);
  }

  // ==================== Perception ====================

  /**
   * Process perception from a sensor
   */
  async perceive(
    instanceId: string,
    sensorId: string,
    rawData: any
  ): Promise<Perception> {
    const sensor = this.sensors.get(sensorId);
    if (!sensor) {
      throw new Error(`Sensor not found: ${sensorId}`);
    }

    if (!sensor.enabled) {
      throw new Error(`Sensor disabled: ${sensorId}`);
    }

    // Process raw data based on sensor type
    const processedData = await this.processPerception(sensor.type, rawData);

    // Convert to atoms
    const atoms = await this.perceptionToAtoms(sensor.type, processedData);

    const perception: Perception = {
      id: crypto.randomUUID(),
      sensorId,
      sensorType: sensor.type,
      timestamp: Date.now(),
      rawData,
      processedData,
      atoms,
      confidence: this.calculatePerceptionConfidence(sensor.type, processedData)
    };

    // Store atoms in AtomSpace
    await this.storePerceptionAtoms(instanceId, perception);

    return perception;
  }

  /**
   * Process perception based on sensor type
   */
  private async processPerception(
    sensorType: SensorType,
    rawData: any
  ): Promise<any> {
    switch (sensorType) {
      case 'text':
        return this.processTextPerception(rawData);
      
      case 'image':
        return this.processImagePerception(rawData);
      
      case 'structured':
        return this.processStructuredPerception(rawData);
      
      case 'time':
        return this.processTimePerception(rawData);
      
      default:
        return rawData;
    }
  }

  /**
   * Process text perception using AI
   */
  private async processTextPerception(text: string): Promise<any> {
    // Extract entities, intents, and sentiment
    const response = await this.env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct-fast' as any,
      {
        prompt: `Analyze this text and extract:
1. Entities (people, places, things)
2. Intent (what the user wants)
3. Sentiment (positive/negative/neutral)
4. Key concepts

Text: "${text}"

Return as JSON with keys: entities, intent, sentiment, concepts`,
        max_tokens: 500
      }
    );

    try {
      return JSON.parse((response as any).response);
    } catch {
      return {
        raw: text,
        entities: [],
        intent: 'unknown',
        sentiment: 'neutral',
        concepts: []
      };
    }
  }

  /**
   * Process image perception using AI
   */
  private async processImagePerception(imageData: any): Promise<any> {
    // Use vision model to describe image
    const response = await this.env.AI.run(
      '@cf/llava-hf/llava-1.5-7b-hf' as any,
      {
        image: imageData,
        prompt: 'Describe this image in detail, including objects, people, actions, and context.',
        max_tokens: 300
      }
    );

    return {
      description: (response as any).response,
      objects: [],
      timestamp: Date.now()
    };
  }

  /**
   * Process structured data perception
   */
  private async processStructuredPerception(data: any): Promise<any> {
    // Validate and normalize structured data
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return { raw: data, type: 'string' };
      }
    }

    return {
      type: Array.isArray(data) ? 'array' : 'object',
      keys: Object.keys(data),
      data
    };
  }

  /**
   * Process time perception
   */
  private async processTimePerception(timestamp?: number): Promise<any> {
    const now = timestamp || Date.now();
    const date = new Date(now);

    return {
      timestamp: now,
      iso: date.toISOString(),
      dayOfWeek: date.getDay(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      timeOfDay: date.getHours() < 12 ? 'morning' : date.getHours() < 17 ? 'afternoon' : 'evening'
    };
  }

  /**
   * Convert perception to atoms
   */
  private async perceptionToAtoms(
    sensorType: SensorType,
    processedData: any
  ): Promise<AtomCreation[]> {
    const atoms: AtomCreation[] = [];

    switch (sensorType) {
      case 'text':
        // Create concept nodes for entities
        for (const entity of processedData.entities || []) {
          atoms.push({
            type: 'ConceptNode',
            name: entity,
            truthValue: { strength: 0.9, confidence: 0.8 }
          });
        }
        
        // Create intent node
        if (processedData.intent) {
          atoms.push({
            type: 'PredicateNode',
            name: `intent:${processedData.intent}`,
            truthValue: { strength: 0.8, confidence: 0.7 }
          });
        }
        break;

      case 'structured':
        // Create nodes for each key-value pair
        for (const key of processedData.keys || []) {
          atoms.push({
            type: 'ConceptNode',
            name: key,
            truthValue: { strength: 1.0, confidence: 0.9 }
          });
        }
        break;

      case 'time':
        // Create time-related nodes
        atoms.push({
          type: 'TimeNode',
          name: processedData.iso,
          truthValue: { strength: 1.0, confidence: 1.0 }
        });
        atoms.push({
          type: 'ConceptNode',
          name: processedData.timeOfDay,
          truthValue: { strength: 1.0, confidence: 1.0 }
        });
        break;
    }

    return atoms;
  }

  /**
   * Calculate perception confidence
   */
  private calculatePerceptionConfidence(
    sensorType: SensorType,
    processedData: any
  ): number {
    // Base confidence varies by sensor type
    const baseConfidence: Record<SensorType, number> = {
      text: 0.7,
      image: 0.6,
      audio: 0.6,
      structured: 0.9,
      time: 1.0,
      location: 0.8,
      social: 0.5,
      financial: 0.8,
      environmental: 0.7
    };

    return baseConfidence[sensorType] || 0.5;
  }

  /**
   * Store perception atoms in AtomSpace
   */
  private async storePerceptionAtoms(
    instanceId: string,
    perception: Perception
  ): Promise<void> {
    const id = this.env.ATOMSPACE.idFromName(instanceId);
    const stub = this.env.ATOMSPACE.get(id);

    for (const atom of perception.atoms) {
      await stub.fetch(
        new Request('http://dummy/atoms', {
          method: 'POST',
          body: JSON.stringify({
            ...atom,
            metadata: {
              source: 'perception',
              sensorId: perception.sensorId,
              perceptionId: perception.id,
              timestamp: perception.timestamp
            }
          })
        })
      );
    }
  }

  // ==================== Action ====================

  /**
   * Execute an action through an actuator
   */
  async act(
    instanceId: string,
    actuatorId: string,
    command: any
  ): Promise<Action> {
    const actuator = this.actuators.get(actuatorId);
    if (!actuator) {
      throw new Error(`Actuator not found: ${actuatorId}`);
    }

    if (!actuator.enabled) {
      throw new Error(`Actuator disabled: ${actuatorId}`);
    }

    const action: Action = {
      id: crypto.randomUUID(),
      actuatorId,
      actuatorType: actuator.type,
      timestamp: Date.now(),
      command,
      success: false
    };

    try {
      // Execute action based on actuator type
      action.result = await this.executeAction(actuator, command);
      action.success = true;
    } catch (error) {
      action.error = error instanceof Error ? error.message : 'Unknown error';
      action.success = false;
    }

    return action;
  }

  /**
   * Execute action based on actuator type
   */
  private async executeAction(
    actuator: ActuatorConfig,
    command: any
  ): Promise<any> {
    switch (actuator.type) {
      case 'text':
        return this.executeTextAction(command);
      
      case 'api_call':
        return this.executeAPIAction(actuator, command);
      
      case 'webhook':
        return this.executeWebhookAction(actuator, command);
      
      case 'notification':
        return this.executeNotificationAction(command);
      
      default:
        throw new Error(`Unsupported actuator type: ${actuator.type}`);
    }
  }

  /**
   * Execute text generation action
   */
  private async executeTextAction(command: any): Promise<any> {
    const { prompt, maxTokens = 500 } = command;

    const response = await this.env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct-fast' as any,
      {
        prompt,
        max_tokens: maxTokens
      }
    );

    return { text: (response as any).response };
  }

  /**
   * Execute external API call action
   */
  private async executeAPIAction(
    actuator: ActuatorConfig,
    command: any
  ): Promise<any> {
    const { method = 'GET', path = '', body, headers = {} } = command;
    
    const url = actuator.endpoint 
      ? `${actuator.endpoint}${path}`
      : command.url;

    if (!url) {
      throw new Error('No URL specified for API call');
    }

    const requestHeaders: Record<string, string> = { ...headers };
    if (actuator.apiKey) {
      requestHeaders['Authorization'] = `Bearer ${actuator.apiKey}`;
    }
    if (body) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined
    });

    const responseData = await response.json();
    
    return {
      status: response.status,
      data: responseData
    };
  }

  /**
   * Execute webhook action
   */
  private async executeWebhookAction(
    actuator: ActuatorConfig,
    command: any
  ): Promise<any> {
    const { url, payload } = command;
    const webhookUrl = url || actuator.endpoint;

    if (!webhookUrl) {
      throw new Error('No webhook URL specified');
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return {
      status: response.status,
      success: response.ok
    };
  }

  /**
   * Execute notification action
   */
  private async executeNotificationAction(command: any): Promise<any> {
    // Queue notification for delivery
    await this.env.COGNITIVE_QUEUE.send({
      type: 'notification',
      ...command
    });

    return { queued: true };
  }

  // ==================== Grounding ====================

  /**
   * Ground a symbol to a real-world entity
   */
  async ground(
    instanceId: string,
    symbolId: string,
    symbolName: string,
    groundingType: 'entity' | 'property' | 'relation' | 'action',
    externalId?: string,
    externalSource?: string
  ): Promise<GroundingEntry> {
    const entry: GroundingEntry = {
      symbolId,
      symbolName,
      groundingType,
      externalId,
      externalSource,
      lastUpdated: Date.now()
    };

    this.groundings.set(symbolId, entry);
    await this.saveState(instanceId);

    return entry;
  }

  /**
   * Get grounding for a symbol
   */
  getGrounding(symbolId: string): GroundingEntry | undefined {
    return this.groundings.get(symbolId);
  }

  /**
   * Find symbols grounded to an external entity
   */
  findGroundedSymbols(externalId: string): GroundingEntry[] {
    const results: GroundingEntry[] = [];
    for (const entry of this.groundings.values()) {
      if (entry.externalId === externalId) {
        results.push(entry);
      }
    }
    return results;
  }

  // ==================== Polling ====================

  /**
   * Poll all sensors with poll intervals
   */
  async pollSensors(instanceId: string): Promise<Perception[]> {
    const perceptions: Perception[] = [];
    const now = Date.now();

    for (const sensor of this.sensors.values()) {
      if (!sensor.enabled || !sensor.pollInterval || !sensor.endpoint) {
        continue;
      }

      try {
        // Fetch data from sensor endpoint
        const headers: Record<string, string> = {};
        if (sensor.apiKey) {
          headers['Authorization'] = `Bearer ${sensor.apiKey}`;
        }

        const response = await fetch(sensor.endpoint, { headers });
        const data = await response.json();

        // Process perception
        const perception = await this.perceive(instanceId, sensor.id, data);
        perceptions.push(perception);
      } catch (error) {
        console.error(`Error polling sensor ${sensor.id}:`, error);
      }
    }

    return perceptions;
  }

  // ==================== State Management ====================

  /**
   * Save state to KV
   */
  private async saveState(instanceId: string): Promise<void> {
    const state = {
      sensors: Array.from(this.sensors.entries()),
      actuators: Array.from(this.actuators.entries()),
      groundings: Array.from(this.groundings.entries())
    };

    await this.env.SENSORIMOTOR_STATE.put(
      `${this.statePrefix}${instanceId}`,
      JSON.stringify(state)
    );
  }

  /**
   * Load state from KV
   */
  private async loadState(instanceId: string): Promise<void> {
    const data = await this.env.SENSORIMOTOR_STATE.get(
      `${this.statePrefix}${instanceId}`,
      'json'
    ) as any;

    if (data) {
      this.sensors = new Map(data.sensors || []);
      this.actuators = new Map(data.actuators || []);
      this.groundings = new Map(data.groundings || []);
    }
  }

  /**
   * Get current state summary
   */
  getStateSummary(): {
    sensorCount: number;
    actuatorCount: number;
    groundingCount: number;
    sensors: Array<{ id: string; type: SensorType; enabled: boolean }>;
    actuators: Array<{ id: string; type: ActuatorType; enabled: boolean }>;
  } {
    return {
      sensorCount: this.sensors.size,
      actuatorCount: this.actuators.size,
      groundingCount: this.groundings.size,
      sensors: Array.from(this.sensors.values()).map(s => ({
        id: s.id,
        type: s.type,
        enabled: s.enabled
      })),
      actuators: Array.from(this.actuators.values()).map(a => ({
        id: a.id,
        type: a.type,
        enabled: a.enabled
      }))
    };
  }
}

export default SensorimotorInterface;
