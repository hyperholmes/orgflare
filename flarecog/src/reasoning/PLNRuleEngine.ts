/**
 * PLNRuleEngine.ts
 * 
 * Probabilistic Logic Networks (PLN) Rule Engine for CloudFlare Workers.
 * Implements the core PLN inference rules with truth value formulas
 * based on indefinite probabilities.
 * 
 * Key concepts:
 * - Truth Values: (strength, confidence) pairs
 * - Inference Rules: Deduction, induction, abduction, etc.
 * - Attention-guided inference: Focus on high-STI atoms
 * - Backward/Forward chaining
 */

import { Ai } from '@cloudflare/workers-types';

// ==================== Types ====================

/**
 * Truth value with strength and confidence
 */
interface TruthValue {
  strength: number;     // Probability estimate (0-1)
  confidence: number;   // Confidence in the estimate (0-1)
}

/**
 * Atom reference for inference
 */
interface AtomRef {
  id: string;
  type: string;
  name?: string;
  outgoing?: string[];
  truthValue: TruthValue;
  sti?: number;
}

/**
 * Inference rule types
 */
type RuleType = 
  | 'deduction'
  | 'induction'
  | 'abduction'
  | 'modus_ponens'
  | 'modus_tollens'
  | 'and_introduction'
  | 'or_introduction'
  | 'not_introduction'
  | 'implication_introduction'
  | 'equivalence_introduction'
  | 'inheritance_to_member'
  | 'member_to_inheritance'
  | 'similarity_to_inheritance'
  | 'inheritance_to_similarity'
  | 'fuzzy_conjunction'
  | 'fuzzy_disjunction'
  | 'revision';

/**
 * Inference rule definition
 */
interface InferenceRule {
  name: RuleType;
  description: string;
  premises: string[];  // Pattern descriptions
  conclusion: string;  // Conclusion pattern
  formula: (premises: TruthValue[]) => TruthValue;
  applicability: (atoms: AtomRef[]) => boolean;
}

/**
 * Inference step result
 */
interface InferenceStep {
  rule: RuleType;
  premises: AtomRef[];
  conclusion: AtomRef;
  truthValue: TruthValue;
  confidence: number;
  timestamp: number;
}

/**
 * Inference chain
 */
interface InferenceChain {
  id: string;
  goal?: AtomRef;
  steps: InferenceStep[];
  finalConclusion?: AtomRef;
  totalConfidence: number;
  timestamp: number;
}

/**
 * PLN configuration
 */
interface PLNConfig {
  maxChainLength: number;
  minConfidence: number;
  attentionThreshold: number;
  revisionEnabled: boolean;
  lookahead: number;
}

// ==================== Environment ====================

interface Env {
  ATOMSPACE: DurableObjectNamespace;
  AI: Ai;
  PLN_CACHE: KVNamespace;
}

// ==================== PLN Constants ====================

// Default confidence for new atoms
const DEFAULT_CONFIDENCE = 0.9;

// Confidence decay per inference step
const CONFIDENCE_DECAY = 0.95;

// Prior probability (for Bayes-like calculations)
const PRIOR_PROBABILITY = 0.5;

// ==================== Truth Value Formulas ====================

/**
 * Calculate count from confidence (inverse of confidence formula)
 */
function confidenceToCount(confidence: number, k: number = 1): number {
  return k * confidence / (1 - confidence);
}

/**
 * Calculate confidence from count
 */
function countToConfidence(count: number, k: number = 1): number {
  return count / (count + k);
}

/**
 * Revision formula: combine two truth values about the same statement
 */
function revision(tv1: TruthValue, tv2: TruthValue): TruthValue {
  const n1 = confidenceToCount(tv1.confidence);
  const n2 = confidenceToCount(tv2.confidence);
  
  const newCount = n1 + n2;
  const newStrength = (tv1.strength * n1 + tv2.strength * n2) / newCount;
  const newConfidence = countToConfidence(newCount);
  
  return {
    strength: Math.max(0, Math.min(1, newStrength)),
    confidence: Math.max(0, Math.min(1, newConfidence))
  };
}

/**
 * Deduction formula: A→B, B→C ⊢ A→C
 */
function deduction(tvAB: TruthValue, tvBC: TruthValue, tvB?: TruthValue): TruthValue {
  const sAB = tvAB.strength;
  const sBC = tvBC.strength;
  const sB = tvB?.strength || PRIOR_PROBABILITY;
  
  // Strength: sAC = sAB * sBC + (1 - sAB) * (sC - sB * sBC) / (1 - sB)
  // Simplified: sAC = sAB * sBC
  const strength = sAB * sBC;
  
  // Confidence decreases with chain length
  const confidence = tvAB.confidence * tvBC.confidence * CONFIDENCE_DECAY;
  
  return {
    strength: Math.max(0, Math.min(1, strength)),
    confidence: Math.max(0, Math.min(1, confidence))
  };
}

/**
 * Induction formula: A→B, A→C ⊢ B→C
 */
function induction(tvAB: TruthValue, tvAC: TruthValue, tvA?: TruthValue): TruthValue {
  const sAB = tvAB.strength;
  const sAC = tvAC.strength;
  const sA = tvA?.strength || PRIOR_PROBABILITY;
  
  // Induction is weaker than deduction
  const strength = sAB * sAC * sA;
  const confidence = tvAB.confidence * tvAC.confidence * sA * CONFIDENCE_DECAY;
  
  return {
    strength: Math.max(0, Math.min(1, strength)),
    confidence: Math.max(0, Math.min(1, confidence))
  };
}

/**
 * Abduction formula: A→B, C→B ⊢ A→C
 */
function abduction(tvAB: TruthValue, tvCB: TruthValue, tvB?: TruthValue): TruthValue {
  const sAB = tvAB.strength;
  const sCB = tvCB.strength;
  const sB = tvB?.strength || PRIOR_PROBABILITY;
  
  // Abduction is the weakest inference
  const strength = sAB * sCB / Math.max(0.01, sB);
  const confidence = tvAB.confidence * tvCB.confidence * sB * CONFIDENCE_DECAY * 0.8;
  
  return {
    strength: Math.max(0, Math.min(1, strength)),
    confidence: Math.max(0, Math.min(1, confidence))
  };
}

/**
 * Modus Ponens: A, A→B ⊢ B
 */
function modusPonens(tvA: TruthValue, tvAB: TruthValue): TruthValue {
  const strength = tvA.strength * tvAB.strength;
  const confidence = tvA.confidence * tvAB.confidence * CONFIDENCE_DECAY;
  
  return {
    strength: Math.max(0, Math.min(1, strength)),
    confidence: Math.max(0, Math.min(1, confidence))
  };
}

/**
 * Modus Tollens: ¬B, A→B ⊢ ¬A
 */
function modusTollens(tvNotB: TruthValue, tvAB: TruthValue): TruthValue {
  const strength = tvNotB.strength * tvAB.strength;
  const confidence = tvNotB.confidence * tvAB.confidence * CONFIDENCE_DECAY * 0.9;
  
  return {
    strength: Math.max(0, Math.min(1, strength)),
    confidence: Math.max(0, Math.min(1, confidence))
  };
}

/**
 * AND introduction: A, B ⊢ A∧B
 */
function andIntroduction(tvA: TruthValue, tvB: TruthValue): TruthValue {
  // Fuzzy AND: min(sA, sB)
  const strength = Math.min(tvA.strength, tvB.strength);
  const confidence = tvA.confidence * tvB.confidence;
  
  return { strength, confidence };
}

/**
 * OR introduction: A ⊢ A∨B
 */
function orIntroduction(tvA: TruthValue, tvB: TruthValue): TruthValue {
  // Fuzzy OR: max(sA, sB)
  const strength = Math.max(tvA.strength, tvB.strength);
  const confidence = Math.min(tvA.confidence, tvB.confidence);
  
  return { strength, confidence };
}

/**
 * NOT introduction: A ⊢ ¬A
 */
function notIntroduction(tvA: TruthValue): TruthValue {
  return {
    strength: 1 - tvA.strength,
    confidence: tvA.confidence
  };
}

/**
 * Implication introduction from observations
 */
function implicationIntroduction(
  tvA: TruthValue, 
  tvB: TruthValue, 
  tvAB: TruthValue
): TruthValue {
  // P(B|A) = P(A∧B) / P(A)
  const strength = tvA.strength > 0 ? tvAB.strength / tvA.strength : 0;
  const confidence = tvAB.confidence * tvA.confidence * CONFIDENCE_DECAY;
  
  return {
    strength: Math.max(0, Math.min(1, strength)),
    confidence: Math.max(0, Math.min(1, confidence))
  };
}

// ==================== PLN Rule Engine ====================

/**
 * PLNRuleEngine
 * 
 * Implements probabilistic logic inference on CloudFlare Workers.
 */
export class PLNRuleEngine {
  private env: Env;
  private config: PLNConfig;
  private rules: Map<RuleType, InferenceRule>;

  // Default configuration
  private static readonly DEFAULT_CONFIG: PLNConfig = {
    maxChainLength: 5,
    minConfidence: 0.1,
    attentionThreshold: 0,
    revisionEnabled: true,
    lookahead: 3
  };

  constructor(env: Env, config?: Partial<PLNConfig>) {
    this.env = env;
    this.config = { ...PLNRuleEngine.DEFAULT_CONFIG, ...config };
    this.rules = this.initializeRules();
  }

  /**
   * Initialize inference rules
   */
  private initializeRules(): Map<RuleType, InferenceRule> {
    const rules = new Map<RuleType, InferenceRule>();

    rules.set('deduction', {
      name: 'deduction',
      description: 'A→B, B→C ⊢ A→C',
      premises: ['InheritanceLink A B', 'InheritanceLink B C'],
      conclusion: 'InheritanceLink A C',
      formula: (tvs) => deduction(tvs[0], tvs[1]),
      applicability: (atoms) => 
        atoms.length >= 2 &&
        atoms[0].type === 'InheritanceLink' &&
        atoms[1].type === 'InheritanceLink' &&
        atoms[0].outgoing?.[1] === atoms[1].outgoing?.[0]
    });

    rules.set('induction', {
      name: 'induction',
      description: 'A→B, A→C ⊢ B→C',
      premises: ['InheritanceLink A B', 'InheritanceLink A C'],
      conclusion: 'InheritanceLink B C',
      formula: (tvs) => induction(tvs[0], tvs[1]),
      applicability: (atoms) =>
        atoms.length >= 2 &&
        atoms[0].type === 'InheritanceLink' &&
        atoms[1].type === 'InheritanceLink' &&
        atoms[0].outgoing?.[0] === atoms[1].outgoing?.[0]
    });

    rules.set('abduction', {
      name: 'abduction',
      description: 'A→B, C→B ⊢ A→C',
      premises: ['InheritanceLink A B', 'InheritanceLink C B'],
      conclusion: 'InheritanceLink A C',
      formula: (tvs) => abduction(tvs[0], tvs[1]),
      applicability: (atoms) =>
        atoms.length >= 2 &&
        atoms[0].type === 'InheritanceLink' &&
        atoms[1].type === 'InheritanceLink' &&
        atoms[0].outgoing?.[1] === atoms[1].outgoing?.[1]
    });

    rules.set('modus_ponens', {
      name: 'modus_ponens',
      description: 'A, A→B ⊢ B',
      premises: ['ConceptNode A', 'ImplicationLink A B'],
      conclusion: 'ConceptNode B',
      formula: (tvs) => modusPonens(tvs[0], tvs[1]),
      applicability: (atoms) =>
        atoms.length >= 2 &&
        atoms[1].type === 'ImplicationLink' &&
        atoms[1].outgoing?.[0] === atoms[0].id
    });

    rules.set('modus_tollens', {
      name: 'modus_tollens',
      description: '¬B, A→B ⊢ ¬A',
      premises: ['NotLink B', 'ImplicationLink A B'],
      conclusion: 'NotLink A',
      formula: (tvs) => modusTollens(tvs[0], tvs[1]),
      applicability: (atoms) =>
        atoms.length >= 2 &&
        atoms[0].type === 'NotLink' &&
        atoms[1].type === 'ImplicationLink' &&
        atoms[0].outgoing?.[0] === atoms[1].outgoing?.[1]
    });

    rules.set('and_introduction', {
      name: 'and_introduction',
      description: 'A, B ⊢ A∧B',
      premises: ['Any A', 'Any B'],
      conclusion: 'AndLink A B',
      formula: (tvs) => andIntroduction(tvs[0], tvs[1]),
      applicability: (atoms) => atoms.length >= 2
    });

    rules.set('or_introduction', {
      name: 'or_introduction',
      description: 'A, B ⊢ A∨B',
      premises: ['Any A', 'Any B'],
      conclusion: 'OrLink A B',
      formula: (tvs) => orIntroduction(tvs[0], tvs[1]),
      applicability: (atoms) => atoms.length >= 2
    });

    rules.set('not_introduction', {
      name: 'not_introduction',
      description: 'A ⊢ ¬A',
      premises: ['Any A'],
      conclusion: 'NotLink A',
      formula: (tvs) => notIntroduction(tvs[0]),
      applicability: (atoms) => atoms.length >= 1
    });

    rules.set('revision', {
      name: 'revision',
      description: 'Combine evidence about the same statement',
      premises: ['Statement S (evidence 1)', 'Statement S (evidence 2)'],
      conclusion: 'Statement S (combined)',
      formula: (tvs) => revision(tvs[0], tvs[1]),
      applicability: (atoms) =>
        atoms.length >= 2 &&
        atoms[0].id === atoms[1].id
    });

    rules.set('fuzzy_conjunction', {
      name: 'fuzzy_conjunction',
      description: 'Fuzzy AND: min(A, B)',
      premises: ['Any A', 'Any B'],
      conclusion: 'AndLink A B',
      formula: (tvs) => ({
        strength: Math.min(tvs[0].strength, tvs[1].strength),
        confidence: tvs[0].confidence * tvs[1].confidence
      }),
      applicability: (atoms) => atoms.length >= 2
    });

    rules.set('fuzzy_disjunction', {
      name: 'fuzzy_disjunction',
      description: 'Fuzzy OR: max(A, B)',
      premises: ['Any A', 'Any B'],
      conclusion: 'OrLink A B',
      formula: (tvs) => ({
        strength: Math.max(tvs[0].strength, tvs[1].strength),
        confidence: Math.min(tvs[0].confidence, tvs[1].confidence)
      }),
      applicability: (atoms) => atoms.length >= 2
    });

    return rules;
  }

  // ==================== Forward Chaining ====================

  /**
   * Forward chaining: derive new conclusions from existing atoms
   */
  async forwardChain(
    atomspaceId: string,
    maxSteps: number = 10
  ): Promise<InferenceChain> {
    const chain: InferenceChain = {
      id: crypto.randomUUID(),
      steps: [],
      totalConfidence: 1,
      timestamp: Date.now()
    };

    // Get high-attention atoms from AtomSpace
    const atoms = await this.getHighAttentionAtoms(atomspaceId);
    
    for (let step = 0; step < maxSteps && atoms.length > 0; step++) {
      // Find applicable rules
      const applicableRules = this.findApplicableRules(atoms);
      
      if (applicableRules.length === 0) break;

      // Select best rule (highest expected confidence gain)
      const { rule, premises } = this.selectBestRule(applicableRules);
      
      // Apply rule
      const truthValues = premises.map(p => p.truthValue);
      const conclusionTV = rule.formula(truthValues);
      
      // Skip if confidence too low
      if (conclusionTV.confidence < this.config.minConfidence) continue;

      // Create conclusion atom
      const conclusion = await this.createConclusion(
        atomspaceId,
        rule,
        premises,
        conclusionTV
      );

      // Record step
      chain.steps.push({
        rule: rule.name,
        premises,
        conclusion,
        truthValue: conclusionTV,
        confidence: conclusionTV.confidence,
        timestamp: Date.now()
      });

      // Update chain confidence
      chain.totalConfidence *= conclusionTV.confidence;

      // Add conclusion to atoms for further inference
      atoms.push(conclusion);

      // Stop if chain confidence too low
      if (chain.totalConfidence < this.config.minConfidence) break;
    }

    if (chain.steps.length > 0) {
      chain.finalConclusion = chain.steps[chain.steps.length - 1].conclusion;
    }

    // Cache the chain
    await this.cacheChain(chain);

    return chain;
  }

  // ==================== Backward Chaining ====================

  /**
   * Backward chaining: prove a goal by finding supporting premises
   */
  async backwardChain(
    atomspaceId: string,
    goal: AtomRef,
    maxDepth: number = 5
  ): Promise<InferenceChain> {
    const chain: InferenceChain = {
      id: crypto.randomUUID(),
      goal,
      steps: [],
      totalConfidence: 1,
      timestamp: Date.now()
    };

    // Check if goal already exists with sufficient confidence
    const existing = await this.findAtom(atomspaceId, goal);
    if (existing && existing.truthValue.confidence >= this.config.minConfidence) {
      chain.finalConclusion = existing;
      chain.totalConfidence = existing.truthValue.confidence;
      return chain;
    }

    // Find rules that can conclude the goal
    const conclusionRules = this.findRulesForConclusion(goal);
    
    for (const rule of conclusionRules) {
      // Find premises that would satisfy this rule
      const premiseSets = await this.findPremises(atomspaceId, rule, goal, maxDepth - 1);
      
      for (const premises of premiseSets) {
        // Check if all premises are satisfied
        const allSatisfied = premises.every(
          p => p.truthValue.confidence >= this.config.minConfidence
        );
        
        if (allSatisfied) {
          // Apply rule
          const truthValues = premises.map(p => p.truthValue);
          const conclusionTV = rule.formula(truthValues);
          
          if (conclusionTV.confidence >= this.config.minConfidence) {
            // Create conclusion
            const conclusion = await this.createConclusion(
              atomspaceId,
              rule,
              premises,
              conclusionTV
            );

            chain.steps.push({
              rule: rule.name,
              premises,
              conclusion,
              truthValue: conclusionTV,
              confidence: conclusionTV.confidence,
              timestamp: Date.now()
            });

            chain.finalConclusion = conclusion;
            chain.totalConfidence = conclusionTV.confidence;
            
            await this.cacheChain(chain);
            return chain;
          }
        }
      }
    }

    // Goal could not be proven
    await this.cacheChain(chain);
    return chain;
  }

  // ==================== Rule Application ====================

  /**
   * Apply a specific rule to given premises
   */
  async applyRule(
    atomspaceId: string,
    ruleName: RuleType,
    premiseIds: string[]
  ): Promise<InferenceStep | null> {
    const rule = this.rules.get(ruleName);
    if (!rule) {
      throw new Error(`Unknown rule: ${ruleName}`);
    }

    // Fetch premises
    const premises = await Promise.all(
      premiseIds.map(id => this.getAtom(atomspaceId, id))
    );

    // Check applicability
    if (!rule.applicability(premises.filter(p => p !== null) as AtomRef[])) {
      return null;
    }

    // Apply formula
    const truthValues = premises.map(p => p!.truthValue);
    const conclusionTV = rule.formula(truthValues);

    // Create conclusion
    const conclusion = await this.createConclusion(
      atomspaceId,
      rule,
      premises as AtomRef[],
      conclusionTV
    );

    return {
      rule: ruleName,
      premises: premises as AtomRef[],
      conclusion,
      truthValue: conclusionTV,
      confidence: conclusionTV.confidence,
      timestamp: Date.now()
    };
  }

  // ==================== Helper Methods ====================

  /**
   * Get high-attention atoms from AtomSpace
   */
  private async getHighAttentionAtoms(atomspaceId: string): Promise<AtomRef[]> {
    const id = this.env.ATOMSPACE.idFromName(atomspaceId);
    const stub = this.env.ATOMSPACE.get(id);

    const response = await stub.fetch(
      new Request('http://dummy/query', {
        method: 'POST',
        body: JSON.stringify({
          type: 'find_atoms',
          minSTI: this.config.attentionThreshold,
          limit: 100
        })
      })
    );

    const data = await response.json() as { data?: AtomRef[] };
    return data.data || [];
  }

  /**
   * Find applicable rules for given atoms
   */
  private findApplicableRules(
    atoms: AtomRef[]
  ): Array<{ rule: InferenceRule; premises: AtomRef[] }> {
    const results: Array<{ rule: InferenceRule; premises: AtomRef[] }> = [];

    for (const [_, rule] of this.rules) {
      // Try all combinations of atoms as premises
      const combinations = this.getCombinations(atoms, rule.premises.length);
      
      for (const combo of combinations) {
        if (rule.applicability(combo)) {
          results.push({ rule, premises: combo });
        }
      }
    }

    return results;
  }

  /**
   * Select the best rule based on expected confidence
   */
  private selectBestRule(
    applicableRules: Array<{ rule: InferenceRule; premises: AtomRef[] }>
  ): { rule: InferenceRule; premises: AtomRef[] } {
    // Score by expected confidence of conclusion
    let best = applicableRules[0];
    let bestScore = 0;

    for (const { rule, premises } of applicableRules) {
      const tvs = premises.map(p => p.truthValue);
      const expectedTV = rule.formula(tvs);
      const score = expectedTV.strength * expectedTV.confidence;
      
      if (score > bestScore) {
        bestScore = score;
        best = { rule, premises };
      }
    }

    return best;
  }

  /**
   * Find rules that can conclude a given goal
   */
  private findRulesForConclusion(goal: AtomRef): InferenceRule[] {
    const results: InferenceRule[] = [];

    for (const [_, rule] of this.rules) {
      // Check if rule conclusion matches goal type
      if (rule.conclusion.includes(goal.type)) {
        results.push(rule);
      }
    }

    return results;
  }

  /**
   * Find premises that would satisfy a rule for a given goal
   */
  private async findPremises(
    atomspaceId: string,
    rule: InferenceRule,
    goal: AtomRef,
    depth: number
  ): Promise<AtomRef[][]> {
    if (depth <= 0) return [];

    // Get atoms that could serve as premises
    const atoms = await this.getHighAttentionAtoms(atomspaceId);
    
    // Find combinations that satisfy the rule
    const combinations = this.getCombinations(atoms, rule.premises.length);
    
    return combinations.filter(combo => rule.applicability(combo));
  }

  /**
   * Create a conclusion atom in the AtomSpace
   */
  private async createConclusion(
    atomspaceId: string,
    rule: InferenceRule,
    premises: AtomRef[],
    truthValue: TruthValue
  ): Promise<AtomRef> {
    const id = this.env.ATOMSPACE.idFromName(atomspaceId);
    const stub = this.env.ATOMSPACE.get(id);

    // Determine conclusion type from rule
    const conclusionType = this.extractConclusionType(rule.conclusion);
    
    // Create the conclusion atom
    const conclusionAtom: AtomRef = {
      id: crypto.randomUUID(),
      type: conclusionType,
      outgoing: premises.map(p => p.id),
      truthValue,
      sti: Math.max(...premises.map(p => p.sti || 0)) * 0.9
    };

    // Store in AtomSpace
    await stub.fetch(
      new Request('http://dummy/atoms', {
        method: 'POST',
        body: JSON.stringify(conclusionAtom)
      })
    );

    return conclusionAtom;
  }

  /**
   * Extract conclusion type from rule pattern
   */
  private extractConclusionType(pattern: string): string {
    const match = pattern.match(/^(\w+)/);
    return match ? match[1] : 'ConceptNode';
  }

  /**
   * Get atom from AtomSpace
   */
  private async getAtom(atomspaceId: string, atomId: string): Promise<AtomRef | null> {
    const id = this.env.ATOMSPACE.idFromName(atomspaceId);
    const stub = this.env.ATOMSPACE.get(id);

    const response = await stub.fetch(
      new Request(`http://dummy/atoms/${atomId}`, { method: 'GET' })
    );

    if (!response.ok) return null;

    const data = await response.json() as { data?: AtomRef };
    return data.data || null;
  }

  /**
   * Find an atom matching a pattern
   */
  private async findAtom(atomspaceId: string, pattern: AtomRef): Promise<AtomRef | null> {
    const id = this.env.ATOMSPACE.idFromName(atomspaceId);
    const stub = this.env.ATOMSPACE.get(id);

    const response = await stub.fetch(
      new Request('http://dummy/query', {
        method: 'POST',
        body: JSON.stringify({
          type: 'find_atoms',
          atomType: pattern.type,
          name: pattern.name,
          limit: 1
        })
      })
    );

    const data = await response.json() as { data?: AtomRef[] };
    return data.data?.[0] || null;
  }

  /**
   * Get all combinations of k elements from array
   */
  private getCombinations<T>(array: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (array.length < k) return [];

    const results: T[][] = [];
    
    for (let i = 0; i <= array.length - k; i++) {
      const rest = this.getCombinations(array.slice(i + 1), k - 1);
      for (const combo of rest) {
        results.push([array[i], ...combo]);
      }
    }

    return results;
  }

  /**
   * Cache an inference chain
   */
  private async cacheChain(chain: InferenceChain): Promise<void> {
    const key = `pln:chain:${chain.id}`;
    await this.env.PLN_CACHE.put(key, JSON.stringify(chain), {
      expirationTtl: 3600 // 1 hour
    });
  }

  /**
   * Get cached inference chain
   */
  async getChain(chainId: string): Promise<InferenceChain | null> {
    const key = `pln:chain:${chainId}`;
    return await this.env.PLN_CACHE.get(key, 'json');
  }

  /**
   * Get all available rules
   */
  getRules(): Array<{ name: RuleType; description: string }> {
    return Array.from(this.rules.values()).map(r => ({
      name: r.name,
      description: r.description
    }));
  }

  /**
   * Explain an inference chain in natural language
   */
  async explainChain(chain: InferenceChain): Promise<string> {
    if (chain.steps.length === 0) {
      return 'No inference steps were performed.';
    }

    const explanations: string[] = [];
    
    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i];
      const rule = this.rules.get(step.rule);
      
      explanations.push(
        `Step ${i + 1}: Applied ${rule?.description || step.rule}\n` +
        `  Premises: ${step.premises.map(p => p.name || p.id).join(', ')}\n` +
        `  Conclusion: ${step.conclusion.name || step.conclusion.id}\n` +
        `  Truth Value: (${step.truthValue.strength.toFixed(3)}, ${step.truthValue.confidence.toFixed(3)})`
      );
    }

    return explanations.join('\n\n');
  }
}

export default PLNRuleEngine;
