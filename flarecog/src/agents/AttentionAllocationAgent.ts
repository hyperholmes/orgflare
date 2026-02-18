/**
 * AttentionAllocationAgent.ts
 * 
 * Autonomous agent that manages attention allocation in the AtomSpace.
 * Implements the Attention Allocation (AA) component of OpenCog's
 * Economic Attention Network (ECAN).
 * 
 * Key responsibilities:
 * - Monitor and adjust STI/LTI values
 * - Manage attention focus (attentional focus boundary)
 * - Handle importance spreading
 * - Implement forgetting mechanisms
 * - Balance exploration vs exploitation
 */

import { Ai } from '@cloudflare/workers-types';

// ==================== Types ====================

/**
 * Attention value
 */
interface AttentionValue {
  sti: number;   // Short-Term Importance (-100 to 100)
  lti: number;   // Long-Term Importance (0 to 100)
  vlti: boolean; // Very Long-Term Importance flag
}

/**
 * Atom with attention
 */
interface AttentionAtom {
  id: string;
  type: string;
  name?: string;
  attention: AttentionValue;
  lastAccessed: number;
  accessCount: number;
}

/**
 * Agent configuration
 */
interface AAAgentConfig {
  // Attentional focus
  focusThreshold: number;        // STI threshold for attentional focus
  focusSize: number;             // Target size of attentional focus
  
  // Decay parameters
  stiDecayRate: number;          // STI decay per cycle (0-1)
  ltiDecayRate: number;          // LTI decay per cycle (0-1)
  
  // Economic parameters
  rentRate: number;              // STI rent for atoms in focus
  wageRate: number;              // STI wage for useful atoms
  
  // Spreading parameters
  spreadFraction: number;        // Fraction of STI to spread
  maxSpreadDepth: number;        // Max depth for spreading
  
  // Forgetting parameters
  forgetThreshold: number;       // STI below which atoms may be forgotten
  forgetProbability: number;     // Probability of forgetting low-STI atoms
  
  // Cycle timing
  cycleInterval: number;         // Milliseconds between cycles
  
  // Exploration
  explorationRate: number;       // Rate of random attention boosts
}

/**
 * Agent state
 */
interface AAAgentState {
  instanceId: string;
  config: AAAgentConfig;
  cycleCount: number;
  lastCycleTime: number;
  focusBoundary: number;
  totalSTI: number;
  totalLTI: number;
  atomCount: number;
  focusCount: number;
  forgottenCount: number;
  stats: CycleStats;
}

/**
 * Cycle statistics
 */
interface CycleStats {
  decayedAtoms: number;
  spreadEvents: number;
  rentCollected: number;
  wagesPaid: number;
  forgottenAtoms: number;
  explorationBoosts: number;
  cycleTime: number;
}

/**
 * Attention event
 */
interface AttentionEvent {
  type: 'decay' | 'spread' | 'rent' | 'wage' | 'forget' | 'boost' | 'access';
  atomId: string;
  previousSTI: number;
  newSTI: number;
  delta: number;
  timestamp: number;
}

// ==================== Environment ====================

interface Env {
  ATOMSPACE: DurableObjectNamespace;
  AI: Ai;
  ATTENTION_CACHE: KVNamespace;
  COGNITIVE_QUEUE: Queue;
}

// ==================== Attention Allocation Agent ====================

/**
 * AttentionAllocationAgent
 * 
 * Autonomous agent that manages attention allocation in the cognitive system.
 */
export class AttentionAllocationAgent {
  private env: Env;
  private config: AAAgentConfig;
  private state: AAAgentState | null = null;
  private statePrefix = 'aa_agent:';
  private eventLog: AttentionEvent[] = [];

  // Default configuration
  private static readonly DEFAULT_CONFIG: AAAgentConfig = {
    focusThreshold: 50,
    focusSize: 100,
    stiDecayRate: 0.1,
    ltiDecayRate: 0.01,
    rentRate: 0.05,
    wageRate: 0.1,
    spreadFraction: 0.3,
    maxSpreadDepth: 3,
    forgetThreshold: -50,
    forgetProbability: 0.1,
    cycleInterval: 5000,
    explorationRate: 0.05
  };

  constructor(env: Env, config?: Partial<AAAgentConfig>) {
    this.env = env;
    this.config = { ...AttentionAllocationAgent.DEFAULT_CONFIG, ...config };
  }

  // ==================== Lifecycle ====================

  /**
   * Initialize the agent
   */
  async initialize(instanceId: string): Promise<AAAgentState> {
    // Load existing state or create new
    const existingState = await this.loadState(instanceId);
    
    if (existingState) {
      this.state = existingState;
    } else {
      this.state = {
        instanceId,
        config: this.config,
        cycleCount: 0,
        lastCycleTime: Date.now(),
        focusBoundary: this.config.focusThreshold,
        totalSTI: 0,
        totalLTI: 0,
        atomCount: 0,
        focusCount: 0,
        forgottenCount: 0,
        stats: this.createEmptyStats()
      };
    }

    await this.saveState();
    return this.state;
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): CycleStats {
    return {
      decayedAtoms: 0,
      spreadEvents: 0,
      rentCollected: 0,
      wagesPaid: 0,
      forgottenAtoms: 0,
      explorationBoosts: 0,
      cycleTime: 0
    };
  }

  // ==================== Main Cycle ====================

  /**
   * Run one attention allocation cycle
   */
  async runCycle(): Promise<CycleStats> {
    if (!this.state) {
      throw new Error('Agent not initialized');
    }

    const cycleStart = Date.now();
    const stats = this.createEmptyStats();

    // Get all atoms with attention values
    const atoms = await this.getAttentionAtoms();
    
    // Update state counts
    this.state.atomCount = atoms.length;
    this.state.totalSTI = atoms.reduce((sum, a) => sum + a.attention.sti, 0);
    this.state.totalLTI = atoms.reduce((sum, a) => sum + a.attention.lti, 0);

    // Phase 1: Decay
    const decayResults = await this.applyDecay(atoms);
    stats.decayedAtoms = decayResults.decayedCount;

    // Phase 2: Rent collection (from atoms in focus)
    const focusAtoms = atoms.filter(a => a.attention.sti >= this.state!.focusBoundary);
    this.state.focusCount = focusAtoms.length;
    const rentResults = await this.collectRent(focusAtoms);
    stats.rentCollected = rentResults.totalRent;

    // Phase 3: Wage payment (to recently accessed atoms)
    const recentlyAccessed = atoms.filter(
      a => Date.now() - a.lastAccessed < this.config.cycleInterval * 2
    );
    const wageResults = await this.payWages(recentlyAccessed);
    stats.wagesPaid = wageResults.totalWages;

    // Phase 4: Importance spreading
    const spreadResults = await this.spreadImportance(focusAtoms);
    stats.spreadEvents = spreadResults.spreadCount;

    // Phase 5: Forgetting
    const lowSTIAtoms = atoms.filter(a => a.attention.sti < this.config.forgetThreshold);
    const forgetResults = await this.applyForgetting(lowSTIAtoms);
    stats.forgottenAtoms = forgetResults.forgottenCount;
    this.state.forgottenCount += forgetResults.forgottenCount;

    // Phase 6: Exploration (random boosts)
    const explorationResults = await this.applyExploration(atoms);
    stats.explorationBoosts = explorationResults.boostCount;

    // Phase 7: Adjust focus boundary
    await this.adjustFocusBoundary(atoms);

    // Update state
    this.state.cycleCount++;
    this.state.lastCycleTime = Date.now();
    this.state.stats = stats;
    stats.cycleTime = Date.now() - cycleStart;

    await this.saveState();

    return stats;
  }

  // ==================== Decay ====================

  /**
   * Apply STI and LTI decay to all atoms
   */
  private async applyDecay(
    atoms: AttentionAtom[]
  ): Promise<{ decayedCount: number }> {
    let decayedCount = 0;

    for (const atom of atoms) {
      // Skip VLTI atoms for LTI decay
      const stiDecay = atom.attention.sti * this.config.stiDecayRate;
      const ltiDecay = atom.attention.vlti 
        ? 0 
        : atom.attention.lti * this.config.ltiDecayRate;

      if (stiDecay > 0.01 || ltiDecay > 0.01) {
        const newSTI = atom.attention.sti - stiDecay;
        const newLTI = atom.attention.lti - ltiDecay;

        await this.updateAttention(atom.id, {
          sti: Math.max(-100, newSTI),
          lti: Math.max(0, newLTI),
          vlti: atom.attention.vlti
        });

        this.logEvent({
          type: 'decay',
          atomId: atom.id,
          previousSTI: atom.attention.sti,
          newSTI,
          delta: -stiDecay,
          timestamp: Date.now()
        });

        decayedCount++;
      }
    }

    return { decayedCount };
  }

  // ==================== Rent ====================

  /**
   * Collect rent from atoms in attentional focus
   */
  private async collectRent(
    focusAtoms: AttentionAtom[]
  ): Promise<{ totalRent: number }> {
    let totalRent = 0;

    for (const atom of focusAtoms) {
      const rent = atom.attention.sti * this.config.rentRate;
      const newSTI = atom.attention.sti - rent;

      await this.updateAttention(atom.id, {
        sti: Math.max(-100, newSTI),
        lti: atom.attention.lti,
        vlti: atom.attention.vlti
      });

      this.logEvent({
        type: 'rent',
        atomId: atom.id,
        previousSTI: atom.attention.sti,
        newSTI,
        delta: -rent,
        timestamp: Date.now()
      });

      totalRent += rent;
    }

    return { totalRent };
  }

  // ==================== Wages ====================

  /**
   * Pay wages to recently accessed atoms
   */
  private async payWages(
    accessedAtoms: AttentionAtom[]
  ): Promise<{ totalWages: number }> {
    let totalWages = 0;

    for (const atom of accessedAtoms) {
      // Wage proportional to access count and current LTI
      const wage = this.config.wageRate * (1 + atom.accessCount * 0.1);
      const newSTI = Math.min(100, atom.attention.sti + wage);

      await this.updateAttention(atom.id, {
        sti: newSTI,
        lti: atom.attention.lti,
        vlti: atom.attention.vlti
      });

      this.logEvent({
        type: 'wage',
        atomId: atom.id,
        previousSTI: atom.attention.sti,
        newSTI,
        delta: wage,
        timestamp: Date.now()
      });

      totalWages += wage;
    }

    return { totalWages };
  }

  // ==================== Spreading ====================

  /**
   * Spread importance from high-STI atoms to neighbors
   */
  private async spreadImportance(
    sourceAtoms: AttentionAtom[]
  ): Promise<{ spreadCount: number }> {
    let spreadCount = 0;

    for (const source of sourceAtoms) {
      // Get neighbors (atoms connected via links)
      const neighbors = await this.getNeighbors(source.id);
      
      if (neighbors.length === 0) continue;

      // Calculate spread amount
      const spreadAmount = source.attention.sti * this.config.spreadFraction;
      const perNeighbor = spreadAmount / neighbors.length;

      // Reduce source STI
      const newSourceSTI = source.attention.sti - spreadAmount;
      await this.updateAttention(source.id, {
        sti: newSourceSTI,
        lti: source.attention.lti,
        vlti: source.attention.vlti
      });

      // Increase neighbor STI
      for (const neighbor of neighbors) {
        const newNeighborSTI = Math.min(100, neighbor.attention.sti + perNeighbor);
        await this.updateAttention(neighbor.id, {
          sti: newNeighborSTI,
          lti: neighbor.attention.lti,
          vlti: neighbor.attention.vlti
        });

        this.logEvent({
          type: 'spread',
          atomId: neighbor.id,
          previousSTI: neighbor.attention.sti,
          newSTI: newNeighborSTI,
          delta: perNeighbor,
          timestamp: Date.now()
        });

        spreadCount++;
      }
    }

    return { spreadCount };
  }

  // ==================== Forgetting ====================

  /**
   * Apply forgetting to low-STI atoms
   */
  private async applyForgetting(
    lowSTIAtoms: AttentionAtom[]
  ): Promise<{ forgottenCount: number }> {
    let forgottenCount = 0;

    for (const atom of lowSTIAtoms) {
      // Skip VLTI atoms
      if (atom.attention.vlti) continue;

      // Probabilistic forgetting
      if (Math.random() < this.config.forgetProbability) {
        await this.forgetAtom(atom.id);
        
        this.logEvent({
          type: 'forget',
          atomId: atom.id,
          previousSTI: atom.attention.sti,
          newSTI: 0,
          delta: -atom.attention.sti,
          timestamp: Date.now()
        });

        forgottenCount++;
      }
    }

    return { forgottenCount };
  }

  // ==================== Exploration ====================

  /**
   * Apply random exploration boosts
   */
  private async applyExploration(
    atoms: AttentionAtom[]
  ): Promise<{ boostCount: number }> {
    let boostCount = 0;

    // Select random atoms for exploration
    const explorationCount = Math.ceil(atoms.length * this.config.explorationRate);
    const shuffled = atoms.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, explorationCount);

    for (const atom of selected) {
      // Random boost between 5 and 20
      const boost = 5 + Math.random() * 15;
      const newSTI = Math.min(100, atom.attention.sti + boost);

      await this.updateAttention(atom.id, {
        sti: newSTI,
        lti: atom.attention.lti,
        vlti: atom.attention.vlti
      });

      this.logEvent({
        type: 'boost',
        atomId: atom.id,
        previousSTI: atom.attention.sti,
        newSTI,
        delta: boost,
        timestamp: Date.now()
      });

      boostCount++;
    }

    return { boostCount };
  }

  // ==================== Focus Boundary ====================

  /**
   * Adjust the attentional focus boundary
   */
  private async adjustFocusBoundary(atoms: AttentionAtom[]): Promise<void> {
    if (!this.state) return;

    // Sort atoms by STI
    const sorted = atoms.sort((a, b) => b.attention.sti - a.attention.sti);
    
    // Find the STI value at the target focus size
    if (sorted.length >= this.config.focusSize) {
      const targetAtom = sorted[this.config.focusSize - 1];
      
      // Smooth adjustment toward target
      const targetBoundary = targetAtom.attention.sti;
      this.state.focusBoundary = 
        this.state.focusBoundary * 0.9 + targetBoundary * 0.1;
    }
  }

  // ==================== Atom Access ====================

  /**
   * Record atom access (increases STI)
   */
  async recordAccess(atomId: string): Promise<void> {
    const atom = await this.getAtom(atomId);
    if (!atom) return;

    // Boost STI on access
    const accessBoost = 5;
    const newSTI = Math.min(100, atom.attention.sti + accessBoost);

    await this.updateAttention(atomId, {
      sti: newSTI,
      lti: atom.attention.lti,
      vlti: atom.attention.vlti
    });

    this.logEvent({
      type: 'access',
      atomId,
      previousSTI: atom.attention.sti,
      newSTI,
      delta: accessBoost,
      timestamp: Date.now()
    });
  }

  /**
   * Stimulate an atom (manual STI boost)
   */
  async stimulate(atomId: string, amount: number): Promise<AttentionValue> {
    const atom = await this.getAtom(atomId);
    if (!atom) {
      throw new Error(`Atom not found: ${atomId}`);
    }

    const newSTI = Math.max(-100, Math.min(100, atom.attention.sti + amount));

    await this.updateAttention(atomId, {
      sti: newSTI,
      lti: atom.attention.lti,
      vlti: atom.attention.vlti
    });

    return { sti: newSTI, lti: atom.attention.lti, vlti: atom.attention.vlti };
  }

  // ==================== AtomSpace Integration ====================

  /**
   * Get all atoms with attention values
   */
  private async getAttentionAtoms(): Promise<AttentionAtom[]> {
    if (!this.state) return [];

    const id = this.env.ATOMSPACE.idFromName(this.state.instanceId);
    const stub = this.env.ATOMSPACE.get(id);

    const response = await stub.fetch(
      new Request('http://dummy/query', {
        method: 'POST',
        body: JSON.stringify({
          type: 'find_atoms',
          hasAttention: true,
          limit: 10000
        })
      })
    );

    const data = await response.json() as { data?: AttentionAtom[] };
    return data.data || [];
  }

  /**
   * Get a single atom
   */
  private async getAtom(atomId: string): Promise<AttentionAtom | null> {
    if (!this.state) return null;

    const id = this.env.ATOMSPACE.idFromName(this.state.instanceId);
    const stub = this.env.ATOMSPACE.get(id);

    const response = await stub.fetch(
      new Request(`http://dummy/atoms/${atomId}`, { method: 'GET' })
    );

    if (!response.ok) return null;

    const data = await response.json() as { data?: AttentionAtom };
    return data.data || null;
  }

  /**
   * Get neighbors of an atom
   */
  private async getNeighbors(atomId: string): Promise<AttentionAtom[]> {
    if (!this.state) return [];

    const id = this.env.ATOMSPACE.idFromName(this.state.instanceId);
    const stub = this.env.ATOMSPACE.get(id);

    const response = await stub.fetch(
      new Request('http://dummy/query', {
        method: 'POST',
        body: JSON.stringify({
          type: 'get_neighbors',
          atomId,
          limit: 50
        })
      })
    );

    const data = await response.json() as { data?: AttentionAtom[] };
    return data.data || [];
  }

  /**
   * Update attention value for an atom
   */
  private async updateAttention(
    atomId: string,
    attention: AttentionValue
  ): Promise<void> {
    if (!this.state) return;

    const id = this.env.ATOMSPACE.idFromName(this.state.instanceId);
    const stub = this.env.ATOMSPACE.get(id);

    await stub.fetch(
      new Request(`http://dummy/atoms/${atomId}/attention`, {
        method: 'PUT',
        body: JSON.stringify(attention)
      })
    );

    // Also update cache
    await this.env.ATTENTION_CACHE.put(
      `attention:${atomId}`,
      JSON.stringify(attention),
      { expirationTtl: 300 }
    );
  }

  /**
   * Forget (remove) an atom
   */
  private async forgetAtom(atomId: string): Promise<void> {
    if (!this.state) return;

    const id = this.env.ATOMSPACE.idFromName(this.state.instanceId);
    const stub = this.env.ATOMSPACE.get(id);

    await stub.fetch(
      new Request(`http://dummy/atoms/${atomId}`, { method: 'DELETE' })
    );

    // Remove from cache
    await this.env.ATTENTION_CACHE.delete(`attention:${atomId}`);
  }

  // ==================== State Management ====================

  /**
   * Save agent state
   */
  private async saveState(): Promise<void> {
    if (!this.state) return;

    await this.env.ATTENTION_CACHE.put(
      `${this.statePrefix}${this.state.instanceId}`,
      JSON.stringify(this.state)
    );
  }

  /**
   * Load agent state
   */
  private async loadState(instanceId: string): Promise<AAAgentState | null> {
    const data = await this.env.ATTENTION_CACHE.get(
      `${this.statePrefix}${instanceId}`,
      'json'
    );
    return data as AAAgentState | null;
  }

  /**
   * Get current state
   */
  getState(): AAAgentState | null {
    return this.state;
  }

  /**
   * Get attentional focus (high-STI atoms)
   */
  async getAttentionalFocus(): Promise<AttentionAtom[]> {
    const atoms = await this.getAttentionAtoms();
    return atoms
      .filter(a => a.attention.sti >= (this.state?.focusBoundary || this.config.focusThreshold))
      .sort((a, b) => b.attention.sti - a.attention.sti);
  }

  /**
   * Log an attention event
   */
  private logEvent(event: AttentionEvent): void {
    this.eventLog.push(event);
    
    // Keep only last 1000 events
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-1000);
    }
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number = 100): AttentionEvent[] {
    return this.eventLog.slice(-count);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AAAgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (this.state) {
      this.state.config = this.config;
    }
  }
}

export default AttentionAllocationAgent;
