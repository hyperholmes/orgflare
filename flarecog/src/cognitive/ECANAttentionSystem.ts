/**
 * ECANAttentionSystem.ts
 * 
 * Reimagined Economic Attention Network (ECAN) for CloudFlare Workers.
 * 
 * This implementation uses:
 * - Workers KV for Short-Term Importance (STI) cache (sub-5ms access)
 * - Durable Objects for Long-Term Importance (LTI) persistence
 * - Vectorize for attention-based semantic retrieval
 * - Queues for asynchronous attention spreading
 * 
 * Based on OpenCog's ECAN but optimized for distributed edge computing.
 */

import { Ai } from '@cloudflare/workers-types';

// Attention value structure
interface AttentionValue {
  sti: number;  // Short-Term Importance (-100 to 100)
  lti: number;  // Long-Term Importance (0 to 100)
  vlti: boolean; // Very Long-Term Importance flag
}

// Atom with attention
interface AttentiveAtom {
  id: string;
  type: string;
  name: string;
  attention: AttentionValue;
  lastUpdated: number;
}

// Hebbian link for attention spreading
interface HebbianLink {
  sourceId: string;
  targetId: string;
  strength: number;
  timestamp: number;
}

// Attention update result
interface AttentionUpdateResult {
  atomId: string;
  previousAttention: AttentionValue;
  newAttention: AttentionValue;
  delta: { sti: number; lti: number };
}

// Attention spread result
interface AttentionSpreadResult {
  sourceId: string;
  affected: Array<{ atomId: string; stiDelta: number }>;
  totalSpread: number;
}

// Environment bindings
interface Env {
  ATOMSPACE: DurableObjectNamespace;
  ATTENTION_CACHE: KVNamespace;
  COGNITIVE_QUEUE: Queue;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
}

/**
 * ECANAttentionSystem
 * 
 * Manages attention allocation across the AtomSpace using an economic model
 * where attention is a scarce resource that flows between atoms.
 */
export class ECANAttentionSystem {
  private env: Env;
  private cachePrefix = 'attention:';
  private cacheTTL = 300; // 5 minutes for STI cache
  
  // ECAN parameters
  private readonly STI_DECAY_RATE = 0.1;      // 10% decay per cycle
  private readonly LTI_DECAY_RATE = 0.01;     // 1% decay per cycle
  private readonly SPREAD_THRESHOLD = 20;     // Minimum STI to spread
  private readonly SPREAD_FRACTION = 0.3;     // 30% of STI spreads to neighbors
  private readonly ATTENTIONAL_FOCUS_THRESHOLD = 50;
  private readonly RENT_RATE = 0.05;          // 5% rent per cycle
  private readonly WAGE_RATE = 0.1;           // 10% wage for useful atoms

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Get attention value for an atom
   */
  async getAttention(instanceId: string, atomId: string): Promise<AttentionValue | null> {
    const cacheKey = `${this.cachePrefix}${instanceId}:${atomId}`;
    
    // Try KV cache first (sub-5ms)
    const cached = await this.env.ATTENTION_CACHE.get(cacheKey, 'json');
    if (cached) {
      return cached as AttentionValue;
    }

    // Fetch from AtomSpace Durable Object
    const atomSpaceId = this.env.ATOMSPACE.idFromName(instanceId);
    const atomSpaceStub = this.env.ATOMSPACE.get(atomSpaceId);

    const response = await atomSpaceStub.fetch(
      new Request(`http://dummy/atoms/${atomId}`)
    );
    const data = await response.json() as { success: boolean; data?: AttentiveAtom };

    if (!data.success || !data.data) {
      return null;
    }

    const attention = data.data.attention || { sti: 0, lti: 0, vlti: false };

    // Cache the result
    await this.env.ATTENTION_CACHE.put(cacheKey, JSON.stringify(attention), {
      expirationTtl: this.cacheTTL
    });

    return attention;
  }

  /**
   * Update attention value for an atom
   */
  async updateAttention(
    instanceId: string,
    atomId: string,
    stiDelta: number,
    ltiDelta: number
  ): Promise<AttentionUpdateResult> {
    const cacheKey = `${this.cachePrefix}${instanceId}:${atomId}`;
    
    // Get current attention
    const current = await this.getAttention(instanceId, atomId);
    const previousAttention = current || { sti: 0, lti: 0, vlti: false };

    // Calculate new values with bounds
    const newAttention: AttentionValue = {
      sti: Math.max(-100, Math.min(100, previousAttention.sti + stiDelta)),
      lti: Math.max(0, Math.min(100, previousAttention.lti + ltiDelta)),
      vlti: previousAttention.vlti || previousAttention.lti > 80
    };

    // Update in AtomSpace
    const atomSpaceId = this.env.ATOMSPACE.idFromName(instanceId);
    const atomSpaceStub = this.env.ATOMSPACE.get(atomSpaceId);

    await atomSpaceStub.fetch(
      new Request(`http://dummy/atoms/${atomId}/attention`, {
        method: 'PUT',
        body: JSON.stringify(newAttention)
      })
    );

    // Update cache
    await this.env.ATTENTION_CACHE.put(cacheKey, JSON.stringify(newAttention), {
      expirationTtl: this.cacheTTL
    });

    // If STI is high enough, queue attention spreading
    if (newAttention.sti >= this.SPREAD_THRESHOLD) {
      await this.env.COGNITIVE_QUEUE.send({
        type: 'attention_spread',
        instanceId,
        atomId,
        sti: newAttention.sti
      });
    }

    return {
      atomId,
      previousAttention,
      newAttention,
      delta: { sti: stiDelta, lti: ltiDelta }
    };
  }

  /**
   * Get atoms in the attentional focus (high STI)
   */
  async getAttentionalFocus(
    instanceId: string,
    threshold?: number
  ): Promise<AttentiveAtom[]> {
    const focusThreshold = threshold || this.ATTENTIONAL_FOCUS_THRESHOLD;
    
    // Get all atoms from AtomSpace
    const atomSpaceId = this.env.ATOMSPACE.idFromName(instanceId);
    const atomSpaceStub = this.env.ATOMSPACE.get(atomSpaceId);

    const response = await atomSpaceStub.fetch(new Request('http://dummy/atoms'));
    const data = await response.json() as { data: AttentiveAtom[] };

    // Filter by attention threshold
    const focusAtoms = data.data.filter(atom => 
      atom.attention && atom.attention.sti >= focusThreshold
    );

    // Sort by STI descending
    focusAtoms.sort((a, b) => 
      (b.attention?.sti || 0) - (a.attention?.sti || 0)
    );

    return focusAtoms;
  }

  /**
   * Spread attention from a source atom to connected atoms
   */
  async spreadAttention(
    instanceId: string,
    sourceAtomId: string
  ): Promise<AttentionSpreadResult> {
    const sourceAttention = await this.getAttention(instanceId, sourceAtomId);
    
    if (!sourceAttention || sourceAttention.sti < this.SPREAD_THRESHOLD) {
      return {
        sourceId: sourceAtomId,
        affected: [],
        totalSpread: 0
      };
    }

    // Get connected atoms via HebbianLinks
    const hebbianLinks = await this.getHebbianLinks(instanceId, sourceAtomId);
    
    if (hebbianLinks.length === 0) {
      return {
        sourceId: sourceAtomId,
        affected: [],
        totalSpread: 0
      };
    }

    // Calculate attention to spread
    const totalSpread = sourceAttention.sti * this.SPREAD_FRACTION;
    const spreadPerLink = totalSpread / hebbianLinks.length;

    const affected: Array<{ atomId: string; stiDelta: number }> = [];

    // Spread attention to each connected atom
    for (const link of hebbianLinks) {
      const targetId = link.sourceId === sourceAtomId ? link.targetId : link.sourceId;
      const stiDelta = spreadPerLink * link.strength;

      await this.updateAttention(instanceId, targetId, stiDelta, 0);
      affected.push({ atomId: targetId, stiDelta });
    }

    // Reduce source atom's STI
    await this.updateAttention(instanceId, sourceAtomId, -totalSpread, 0);

    return {
      sourceId: sourceAtomId,
      affected,
      totalSpread
    };
  }

  /**
   * Get HebbianLinks connected to an atom
   */
  private async getHebbianLinks(
    instanceId: string,
    atomId: string
  ): Promise<HebbianLink[]> {
    const atomSpaceId = this.env.ATOMSPACE.idFromName(instanceId);
    const atomSpaceStub = this.env.ATOMSPACE.get(atomSpaceId);

    const response = await atomSpaceStub.fetch(
      new Request(`http://dummy/links/hebbian/${atomId}`)
    );
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { links: HebbianLink[] };
    return data.links || [];
  }

  /**
   * Create or strengthen a HebbianLink between atoms
   */
  async createHebbianLink(
    instanceId: string,
    sourceId: string,
    targetId: string,
    strength: number = 0.5
  ): Promise<HebbianLink> {
    const atomSpaceId = this.env.ATOMSPACE.idFromName(instanceId);
    const atomSpaceStub = this.env.ATOMSPACE.get(atomSpaceId);

    const link: HebbianLink = {
      sourceId,
      targetId,
      strength: Math.max(0, Math.min(1, strength)),
      timestamp: Date.now()
    };

    await atomSpaceStub.fetch(
      new Request('http://dummy/links/hebbian', {
        method: 'POST',
        body: JSON.stringify(link)
      })
    );

    return link;
  }

  /**
   * Run attention decay cycle
   */
  async runDecayCycle(instanceId: string): Promise<{
    decayed: number;
    forgotten: number;
  }> {
    const atomSpaceId = this.env.ATOMSPACE.idFromName(instanceId);
    const atomSpaceStub = this.env.ATOMSPACE.get(atomSpaceId);

    const response = await atomSpaceStub.fetch(new Request('http://dummy/atoms'));
    const data = await response.json() as { data: AttentiveAtom[] };

    let decayed = 0;
    let forgotten = 0;

    for (const atom of data.data) {
      if (!atom.attention) continue;

      // Skip VLTI atoms
      if (atom.attention.vlti) continue;

      // Calculate decay
      const stiDecay = -atom.attention.sti * this.STI_DECAY_RATE;
      const ltiDecay = -atom.attention.lti * this.LTI_DECAY_RATE;

      // Apply decay
      const result = await this.updateAttention(
        instanceId,
        atom.id,
        stiDecay,
        ltiDecay
      );

      decayed++;

      // Check if atom should be forgotten (very low attention)
      if (result.newAttention.sti < -90 && result.newAttention.lti < 5) {
        // Queue for garbage collection
        await this.env.COGNITIVE_QUEUE.send({
          type: 'forget_atom',
          instanceId,
          atomId: atom.id
        });
        forgotten++;
      }
    }

    return { decayed, forgotten };
  }

  /**
   * Run economic rent cycle (charge atoms for attention)
   */
  async runRentCycle(instanceId: string): Promise<{
    charged: number;
    totalRent: number;
  }> {
    const focusAtoms = await this.getAttentionalFocus(instanceId, 0);
    
    let charged = 0;
    let totalRent = 0;

    for (const atom of focusAtoms) {
      if (!atom.attention || atom.attention.vlti) continue;

      // Rent is proportional to STI
      const rent = Math.abs(atom.attention.sti) * this.RENT_RATE;
      
      await this.updateAttention(instanceId, atom.id, -rent, 0);
      
      charged++;
      totalRent += rent;
    }

    return { charged, totalRent };
  }

  /**
   * Pay wage to atoms that contributed to successful reasoning
   */
  async payWage(
    instanceId: string,
    atomIds: string[],
    successValue: number
  ): Promise<void> {
    const wagePerAtom = (successValue * this.WAGE_RATE) / atomIds.length;

    for (const atomId of atomIds) {
      await this.updateAttention(instanceId, atomId, wagePerAtom, wagePerAtom * 0.1);
    }
  }

  /**
   * Get attention statistics
   */
  async getStats(instanceId: string): Promise<{
    totalAtoms: number;
    inFocus: number;
    averageSTI: number;
    averageLTI: number;
    vltiCount: number;
  }> {
    const atomSpaceId = this.env.ATOMSPACE.idFromName(instanceId);
    const atomSpaceStub = this.env.ATOMSPACE.get(atomSpaceId);

    const response = await atomSpaceStub.fetch(new Request('http://dummy/atoms'));
    const data = await response.json() as { data: AttentiveAtom[] };

    const atoms = data.data.filter(a => a.attention);
    const totalAtoms = atoms.length;

    if (totalAtoms === 0) {
      return {
        totalAtoms: 0,
        inFocus: 0,
        averageSTI: 0,
        averageLTI: 0,
        vltiCount: 0
      };
    }

    const inFocus = atoms.filter(a => a.attention.sti >= this.ATTENTIONAL_FOCUS_THRESHOLD).length;
    const totalSTI = atoms.reduce((sum, a) => sum + a.attention.sti, 0);
    const totalLTI = atoms.reduce((sum, a) => sum + a.attention.lti, 0);
    const vltiCount = atoms.filter(a => a.attention.vlti).length;

    return {
      totalAtoms,
      inFocus,
      averageSTI: totalSTI / totalAtoms,
      averageLTI: totalLTI / totalAtoms,
      vltiCount
    };
  }
}

export default ECANAttentionSystem;
