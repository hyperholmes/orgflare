/**
 * Workers for Platforms Integration
 * 
 * Multi-tenant AGI-as-a-Service implementation for FlareCog
 * Enables customers to deploy isolated cognitive instances on Cloudflare's edge
 * 
 * Features:
 * - Per-tenant AtomSpace isolation
 * - Shared knowledge base access with permissions
 * - Tenant-specific MindAgent configurations
 * - Usage tracking and quotas
 * - Federated learning across tenant spaces
 */

import { DurableObjectNamespace } from '@cloudflare/workers-types';

export interface TenantConfig {
  tenantId: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  quotas: {
    maxAtoms: number;
    maxQueries: number;
    maxAgentExecutions: number;
    maxStorageMB: number;
  };
  features: {
    distributedQuery: boolean;
    aiEnhancement: boolean;
    customAgents: boolean;
    federatedLearning: boolean;
    sharedKnowledge: boolean;
  };
  isolation: 'strict' | 'shared' | 'federated';
  createdAt: number;
  lastAccessedAt: number;
}

export interface TenantUsage {
  tenantId: string;
  period: string; // YYYY-MM
  atomCount: number;
  queryCount: number;
  agentExecutions: number;
  storageMB: number;
  computeMs: number;
  lastUpdated: number;
}

export interface TenantAtomSpace {
  tenantId: string;
  atomSpaceId: string;
  durableObjectId: string;
  sharedKnowledgeAccess: string[];
  federatedPeers: string[];
}

export interface SharedKnowledgeBase {
  id: string;
  name: string;
  description: string;
  ownerTenantId: string;
  accessControl: {
    public: boolean;
    allowedTenants: string[];
    permissions: Map<string, 'read' | 'write' | 'admin'>;
  };
  atomCount: number;
  lastModified: number;
}

export interface FederatedLearningConfig {
  enabled: boolean;
  participatingTenants: string[];
  sharedPatterns: string[];
  privacyLevel: 'high' | 'medium' | 'low';
  aggregationMethod: 'average' | 'weighted' | 'selective';
}

/**
 * Workers for Platforms Integration Manager
 */
export class WorkersForPlatformsIntegration {
  private tenantConfigs: Map<string, TenantConfig>;
  private tenantUsage: Map<string, TenantUsage>;
  private sharedKnowledgeBases: Map<string, SharedKnowledgeBase>;
  
  constructor(
    private env: {
      TENANT_REGISTRY: KVNamespace;
      USAGE_TRACKER: KVNamespace;
      SHARED_KNOWLEDGE: KVNamespace;
      ATOMSPACE_DO: DurableObjectNamespace;
      TENANT_ATOMSPACE_DO: DurableObjectNamespace;
    }
  ) {
    this.tenantConfigs = new Map();
    this.tenantUsage = new Map();
    this.sharedKnowledgeBases = new Map();
  }

  /**
   * Initialize tenant with isolated AtomSpace
   */
  async initializeTenant(config: Omit<TenantConfig, 'createdAt' | 'lastAccessedAt'>): Promise<TenantAtomSpace> {
    const now = Date.now();
    const fullConfig: TenantConfig = {
      ...config,
      createdAt: now,
      lastAccessedAt: now
    };
    
    // Store tenant configuration
    await this.env.TENANT_REGISTRY.put(
      `tenant:${config.tenantId}`,
      JSON.stringify(fullConfig)
    );
    
    this.tenantConfigs.set(config.tenantId, fullConfig);
    
    // Create isolated Durable Object for tenant's AtomSpace
    const atomSpaceId = `atomspace:${config.tenantId}`;
    const durableObjectId = this.env.TENANT_ATOMSPACE_DO.idFromName(atomSpaceId);
    
    // Initialize tenant's AtomSpace
    const stub = this.env.TENANT_ATOMSPACE_DO.get(durableObjectId);
    await stub.fetch('https://internal/initialize', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: config.tenantId,
        isolation: config.isolation,
        quotas: config.quotas
      })
    });
    
    const tenantAtomSpace: TenantAtomSpace = {
      tenantId: config.tenantId,
      atomSpaceId,
      durableObjectId: durableObjectId.toString(),
      sharedKnowledgeAccess: [],
      federatedPeers: []
    };
    
    // Store AtomSpace mapping
    await this.env.TENANT_REGISTRY.put(
      `atomspace:${config.tenantId}`,
      JSON.stringify(tenantAtomSpace)
    );
    
    // Initialize usage tracking
    const usage: TenantUsage = {
      tenantId: config.tenantId,
      period: this.getCurrentPeriod(),
      atomCount: 0,
      queryCount: 0,
      agentExecutions: 0,
      storageMB: 0,
      computeMs: 0,
      lastUpdated: now
    };
    
    await this.updateUsage(usage);
    
    return tenantAtomSpace;
  }

  /**
   * Get tenant's AtomSpace stub
   */
  async getTenantAtomSpace(tenantId: string): Promise<DurableObjectStub> {
    const atomSpaceData = await this.env.TENANT_REGISTRY.get(`atomspace:${tenantId}`, 'json');
    
    if (!atomSpaceData) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    
    const { atomSpaceId } = atomSpaceData as TenantAtomSpace;
    const durableObjectId = this.env.TENANT_ATOMSPACE_DO.idFromName(atomSpaceId);
    
    return this.env.TENANT_ATOMSPACE_DO.get(durableObjectId);
  }

  /**
   * Execute query on tenant's AtomSpace with quota checking
   */
  async executeQuery(
    tenantId: string,
    query: any
  ): Promise<any> {
    // Check quotas
    await this.checkQuota(tenantId, 'query');
    
    // Get tenant's AtomSpace
    const atomSpace = await this.getTenantAtomSpace(tenantId);
    
    // Track compute time
    const startTime = Date.now();
    
    // Execute query
    const response = await atomSpace.fetch('https://internal/query', {
      method: 'POST',
      body: JSON.stringify(query)
    });
    
    const result = await response.json();
    
    const computeMs = Date.now() - startTime;
    
    // Update usage
    await this.incrementUsage(tenantId, {
      queryCount: 1,
      computeMs
    });
    
    return result;
  }

  /**
   * Add atom to tenant's AtomSpace with quota checking
   */
  async addAtom(
    tenantId: string,
    atom: any
  ): Promise<any> {
    // Check quotas
    await this.checkQuota(tenantId, 'atom');
    
    // Get tenant's AtomSpace
    const atomSpace = await this.getTenantAtomSpace(tenantId);
    
    // Add atom
    const response = await atomSpace.fetch('https://internal/atom', {
      method: 'POST',
      body: JSON.stringify(atom)
    });
    
    const result = await response.json();
    
    // Update usage
    await this.incrementUsage(tenantId, {
      atomCount: 1,
      storageMB: this.estimateAtomSize(atom)
    });
    
    return result;
  }

  /**
   * Execute MindAgent for tenant
   */
  async executeMindAgent(
    tenantId: string,
    agentType: string,
    params: any
  ): Promise<any> {
    // Check quotas
    await this.checkQuota(tenantId, 'agent');
    
    // Get tenant's AtomSpace
    const atomSpace = await this.getTenantAtomSpace(tenantId);
    
    // Track compute time
    const startTime = Date.now();
    
    // Execute agent
    const response = await atomSpace.fetch('https://internal/agent/execute', {
      method: 'POST',
      body: JSON.stringify({ agentType, params })
    });
    
    const result = await response.json();
    
    const computeMs = Date.now() - startTime;
    
    // Update usage
    await this.incrementUsage(tenantId, {
      agentExecutions: 1,
      computeMs
    });
    
    return result;
  }

  /**
   * Create shared knowledge base
   */
  async createSharedKnowledgeBase(
    ownerTenantId: string,
    name: string,
    description: string,
    isPublic: boolean = false
  ): Promise<SharedKnowledgeBase> {
    const id = `kb:${ownerTenantId}:${Date.now()}`;
    
    const knowledgeBase: SharedKnowledgeBase = {
      id,
      name,
      description,
      ownerTenantId,
      accessControl: {
        public: isPublic,
        allowedTenants: [],
        permissions: new Map([[ownerTenantId, 'admin']])
      },
      atomCount: 0,
      lastModified: Date.now()
    };
    
    await this.env.SHARED_KNOWLEDGE.put(
      `kb:${id}`,
      JSON.stringify(knowledgeBase)
    );
    
    this.sharedKnowledgeBases.set(id, knowledgeBase);
    
    return knowledgeBase;
  }

  /**
   * Grant access to shared knowledge base
   */
  async grantKnowledgeBaseAccess(
    knowledgeBaseId: string,
    tenantId: string,
    permission: 'read' | 'write' | 'admin'
  ): Promise<void> {
    const kb = await this.getSharedKnowledgeBase(knowledgeBaseId);
    
    if (!kb) {
      throw new Error(`Knowledge base ${knowledgeBaseId} not found`);
    }
    
    // Check if requester has admin permission
    // (In production, this would check the requesting tenant's permissions)
    
    kb.accessControl.allowedTenants.push(tenantId);
    kb.accessControl.permissions.set(tenantId, permission);
    
    await this.env.SHARED_KNOWLEDGE.put(
      `kb:${knowledgeBaseId}`,
      JSON.stringify(kb)
    );
    
    // Update tenant's AtomSpace to include shared knowledge access
    const tenantAtomSpace = await this.env.TENANT_REGISTRY.get(
      `atomspace:${tenantId}`,
      'json'
    ) as TenantAtomSpace;
    
    if (tenantAtomSpace) {
      tenantAtomSpace.sharedKnowledgeAccess.push(knowledgeBaseId);
      await this.env.TENANT_REGISTRY.put(
        `atomspace:${tenantId}`,
        JSON.stringify(tenantAtomSpace)
      );
    }
  }

  /**
   * Query shared knowledge base
   */
  async querySharedKnowledge(
    tenantId: string,
    knowledgeBaseId: string,
    query: any
  ): Promise<any> {
    // Check access permissions
    const hasAccess = await this.checkKnowledgeBaseAccess(tenantId, knowledgeBaseId);
    
    if (!hasAccess) {
      throw new Error(`Tenant ${tenantId} does not have access to knowledge base ${knowledgeBaseId}`);
    }
    
    // Query the shared knowledge base
    const kbData = await this.env.SHARED_KNOWLEDGE.get(`kb:${knowledgeBaseId}:data`, 'json');
    
    // Apply query (simplified - in production would use full query engine)
    return kbData;
  }

  /**
   * Setup federated learning between tenants
   */
  async setupFederatedLearning(
    config: FederatedLearningConfig
  ): Promise<void> {
    // Verify all participating tenants have federated learning enabled
    for (const tenantId of config.participatingTenants) {
      const tenantConfig = await this.getTenantConfig(tenantId);
      if (!tenantConfig.features.federatedLearning) {
        throw new Error(`Tenant ${tenantId} does not have federated learning enabled`);
      }
    }
    
    // Store federated learning configuration
    const configId = `federated:${Date.now()}`;
    await this.env.SHARED_KNOWLEDGE.put(
      `federated:${configId}`,
      JSON.stringify(config)
    );
    
    // Update each tenant's AtomSpace with federated peers
    for (const tenantId of config.participatingTenants) {
      const tenantAtomSpace = await this.env.TENANT_REGISTRY.get(
        `atomspace:${tenantId}`,
        'json'
      ) as TenantAtomSpace;
      
      if (tenantAtomSpace) {
        tenantAtomSpace.federatedPeers = config.participatingTenants.filter(
          id => id !== tenantId
        );
        
        await this.env.TENANT_REGISTRY.put(
          `atomspace:${tenantId}`,
          JSON.stringify(tenantAtomSpace)
        );
      }
    }
  }

  /**
   * Aggregate federated learning results
   */
  async aggregateFederatedLearning(
    configId: string,
    localResults: Map<string, any>
  ): Promise<any> {
    const config = await this.env.SHARED_KNOWLEDGE.get(
      `federated:${configId}`,
      'json'
    ) as FederatedLearningConfig;
    
    if (!config) {
      throw new Error(`Federated learning config ${configId} not found`);
    }
    
    // Aggregate based on method
    switch (config.aggregationMethod) {
      case 'average':
        return this.averageAggregation(localResults);
      case 'weighted':
        return this.weightedAggregation(localResults);
      case 'selective':
        return this.selectiveAggregation(localResults, config);
      default:
        throw new Error(`Unknown aggregation method: ${config.aggregationMethod}`);
    }
  }

  /**
   * Check quota for tenant
   */
  private async checkQuota(
    tenantId: string,
    resource: 'atom' | 'query' | 'agent'
  ): Promise<void> {
    const config = await this.getTenantConfig(tenantId);
    const usage = await this.getUsage(tenantId);
    
    switch (resource) {
      case 'atom':
        if (usage.atomCount >= config.quotas.maxAtoms) {
          throw new Error(`Tenant ${tenantId} has exceeded atom quota`);
        }
        break;
      case 'query':
        if (usage.queryCount >= config.quotas.maxQueries) {
          throw new Error(`Tenant ${tenantId} has exceeded query quota`);
        }
        break;
      case 'agent':
        if (usage.agentExecutions >= config.quotas.maxAgentExecutions) {
          throw new Error(`Tenant ${tenantId} has exceeded agent execution quota`);
        }
        break;
    }
  }

  /**
   * Get tenant configuration
   */
  private async getTenantConfig(tenantId: string): Promise<TenantConfig> {
    let config = this.tenantConfigs.get(tenantId);
    
    if (!config) {
      const data = await this.env.TENANT_REGISTRY.get(`tenant:${tenantId}`, 'json');
      if (!data) {
        throw new Error(`Tenant ${tenantId} not found`);
      }
      config = data as TenantConfig;
      this.tenantConfigs.set(tenantId, config);
    }
    
    return config;
  }

  /**
   * Get tenant usage
   */
  private async getUsage(tenantId: string): Promise<TenantUsage> {
    const period = this.getCurrentPeriod();
    const key = `usage:${tenantId}:${period}`;
    
    let usage = this.tenantUsage.get(key);
    
    if (!usage) {
      const data = await this.env.USAGE_TRACKER.get(key, 'json');
      if (data) {
        usage = data as TenantUsage;
        this.tenantUsage.set(key, usage);
      } else {
        usage = {
          tenantId,
          period,
          atomCount: 0,
          queryCount: 0,
          agentExecutions: 0,
          storageMB: 0,
          computeMs: 0,
          lastUpdated: Date.now()
        };
      }
    }
    
    return usage;
  }

  /**
   * Update tenant usage
   */
  private async updateUsage(usage: TenantUsage): Promise<void> {
    const key = `usage:${usage.tenantId}:${usage.period}`;
    
    await this.env.USAGE_TRACKER.put(key, JSON.stringify(usage));
    this.tenantUsage.set(key, usage);
  }

  /**
   * Increment tenant usage
   */
  private async incrementUsage(
    tenantId: string,
    increments: Partial<Omit<TenantUsage, 'tenantId' | 'period' | 'lastUpdated'>>
  ): Promise<void> {
    const usage = await this.getUsage(tenantId);
    
    if (increments.atomCount) usage.atomCount += increments.atomCount;
    if (increments.queryCount) usage.queryCount += increments.queryCount;
    if (increments.agentExecutions) usage.agentExecutions += increments.agentExecutions;
    if (increments.storageMB) usage.storageMB += increments.storageMB;
    if (increments.computeMs) usage.computeMs += increments.computeMs;
    
    usage.lastUpdated = Date.now();
    
    await this.updateUsage(usage);
  }

  /**
   * Get shared knowledge base
   */
  private async getSharedKnowledgeBase(id: string): Promise<SharedKnowledgeBase | null> {
    let kb = this.sharedKnowledgeBases.get(id);
    
    if (!kb) {
      const data = await this.env.SHARED_KNOWLEDGE.get(`kb:${id}`, 'json');
      if (data) {
        kb = data as SharedKnowledgeBase;
        this.sharedKnowledgeBases.set(id, kb);
      }
    }
    
    return kb || null;
  }

  /**
   * Check if tenant has access to knowledge base
   */
  private async checkKnowledgeBaseAccess(
    tenantId: string,
    knowledgeBaseId: string
  ): Promise<boolean> {
    const kb = await this.getSharedKnowledgeBase(knowledgeBaseId);
    
    if (!kb) return false;
    if (kb.ownerTenantId === tenantId) return true;
    if (kb.accessControl.public) return true;
    if (kb.accessControl.allowedTenants.includes(tenantId)) return true;
    
    return false;
  }

  /**
   * Estimate atom size in MB
   */
  private estimateAtomSize(atom: any): number {
    const json = JSON.stringify(atom);
    return json.length / (1024 * 1024);
  }

  /**
   * Get current period (YYYY-MM)
   */
  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // Aggregation methods for federated learning

  private averageAggregation(results: Map<string, any>): any {
    // Simple averaging of results
    const values = Array.from(results.values());
    // Implementation depends on result structure
    return values[0]; // Stub
  }

  private weightedAggregation(results: Map<string, any>): any {
    // Weighted averaging based on tenant tier or data quality
    return results.values().next().value; // Stub
  }

  private selectiveAggregation(results: Map<string, any>, config: FederatedLearningConfig): any {
    // Select best results based on criteria
    return results.values().next().value; // Stub
  }
}

// Type stub for DurableObjectStub
interface DurableObjectStub {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}
