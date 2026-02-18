/**
 * Relevance Realization Engine
 * 
 * Implements John Vervaeke's Relevance Realization framework for FlareCog
 * Provides "optimal grip" on cognitive processing through dynamic attention allocation
 * and multi-scale relevance assessment
 * 
 * Core Principles:
 * - Opponent Processing: Balance exploration vs exploitation
 * - Recursive Relevance: Multi-level relevance assessment
 * - Participatory Knowing: Context-sensitive relevance
 * - Salience Landscaping: Dynamic attention allocation
 */

import { Atom, AttentionValue } from '../types/cognitive-v5';

export interface RelevanceContext {
  currentGoals: string[];
  activePatterns: string[];
  recentActivations: Map<string, number>;
  environmentalFactors: Map<string, number>;
  temporalWindow: number;
}

export interface RelevanceScore {
  overall: number;
  components: {
    goalRelevance: number;
    contextualFit: number;
    novelty: number;
    coherence: number;
    pragmaticValue: number;
  };
  confidence: number;
}

export interface OpponentProcess {
  name: string;
  leftPole: number;  // e.g., exploitation
  rightPole: number; // e.g., exploration
  balance: number;   // -1 to 1
}

export interface SalienceLandscape {
  peaks: Array<{ atomId: string; salience: number }>;
  valleys: Array<{ atomId: string; salience: number }>;
  gradients: Map<string, number>;
  topology: 'smooth' | 'rugged' | 'flat';
}

/**
 * Relevance Realization Engine
 * Implements cognitive grip optimization for FlareCog
 */
export class RelevanceRealizationEngine {
  private context: RelevanceContext;
  private opponentProcesses: Map<string, OpponentProcess>;
  private salienceLandscape: SalienceLandscape;
  private relevanceHistory: Map<string, RelevanceScore[]>;
  
  constructor() {
    this.context = {
      currentGoals: [],
      activePatterns: [],
      recentActivations: new Map(),
      environmentalFactors: new Map(),
      temporalWindow: 10000 // 10 seconds
    };
    
    this.opponentProcesses = new Map([
      ['exploration_exploitation', {
        name: 'Exploration vs Exploitation',
        leftPole: 0.5,
        rightPole: 0.5,
        balance: 0.0
      }],
      ['abstraction_concreteness', {
        name: 'Abstraction vs Concreteness',
        leftPole: 0.5,
        rightPole: 0.5,
        balance: 0.0
      }],
      ['breadth_depth', {
        name: 'Breadth vs Depth',
        leftPole: 0.5,
        rightPole: 0.5,
        balance: 0.0
      }],
      ['stability_plasticity', {
        name: 'Stability vs Plasticity',
        leftPole: 0.5,
        rightPole: 0.5,
        balance: 0.0
      }]
    ]);
    
    this.salienceLandscape = {
      peaks: [],
      valleys: [],
      gradients: new Map(),
      topology: 'smooth'
    };
    
    this.relevanceHistory = new Map();
  }

  /**
   * Calculate relevance realization for an atom
   * Returns multi-dimensional relevance score
   */
  async realizeRelevance(
    atom: Atom,
    context?: Partial<RelevanceContext>
  ): Promise<RelevanceScore> {
    // Update context if provided
    if (context) {
      this.updateContext(context);
    }
    
    // Calculate component scores
    const goalRelevance = this.calculateGoalRelevance(atom);
    const contextualFit = this.calculateContextualFit(atom);
    const novelty = this.calculateNovelty(atom);
    const coherence = this.calculateCoherence(atom);
    const pragmaticValue = this.calculatePragmaticValue(atom);
    
    // Weighted combination based on current opponent processes
    const weights = this.getAdaptiveWeights();
    const overall = 
      goalRelevance * weights.goal +
      contextualFit * weights.context +
      novelty * weights.novelty +
      coherence * weights.coherence +
      pragmaticValue * weights.pragmatic;
    
    // Calculate confidence based on information availability
    const confidence = this.calculateConfidence(atom);
    
    const score: RelevanceScore = {
      overall,
      components: {
        goalRelevance,
        contextualFit,
        novelty,
        coherence,
        pragmaticValue
      },
      confidence
    };
    
    // Store in history
    this.updateRelevanceHistory(atom.id, score);
    
    return score;
  }

  /**
   * Calculate goal relevance - how well atom serves current goals
   */
  private calculateGoalRelevance(atom: Atom): number {
    if (this.context.currentGoals.length === 0) {
      return 0.5; // Neutral when no goals
    }
    
    let maxRelevance = 0.0;
    
    for (const goal of this.context.currentGoals) {
      // Check if atom type or name relates to goal
      const typeMatch = this.semanticSimilarity(atom.type, goal);
      const nameMatch = atom.name ? this.semanticSimilarity(atom.name, goal) : 0;
      
      const goalScore = Math.max(typeMatch, nameMatch);
      maxRelevance = Math.max(maxRelevance, goalScore);
    }
    
    return maxRelevance;
  }

  /**
   * Calculate contextual fit - how well atom fits current cognitive context
   */
  private calculateContextualFit(atom: Atom): number {
    let fit = 0.0;
    let factors = 0;
    
    // Active pattern matching
    if (this.context.activePatterns.length > 0) {
      const patternFit = this.matchActivePatterns(atom);
      fit += patternFit;
      factors++;
    }
    
    // Recent activation correlation
    if (this.context.recentActivations.size > 0) {
      const activationFit = this.correlateWithRecentActivations(atom);
      fit += activationFit;
      factors++;
    }
    
    // Environmental factor alignment
    if (this.context.environmentalFactors.size > 0) {
      const environmentFit = this.alignWithEnvironment(atom);
      fit += environmentFit;
      factors++;
    }
    
    return factors > 0 ? fit / factors : 0.5;
  }

  /**
   * Calculate novelty - how new or surprising the atom is
   */
  private calculateNovelty(atom: Atom): number {
    const history = this.relevanceHistory.get(atom.id);
    
    if (!history || history.length === 0) {
      return 1.0; // Maximum novelty for new atoms
    }
    
    // Novelty decreases with repeated access
    const accessCount = history.length;
    const recency = Date.now() - (atom.lastAccessedAt || atom.createdAt || 0);
    
    // Decay function: novelty decreases with access count and increases with time
    const accessDecay = Math.exp(-accessCount / 10);
    const recencyBoost = Math.min(recency / (24 * 60 * 60 * 1000), 1.0); // Days
    
    return (accessDecay + recencyBoost) / 2;
  }

  /**
   * Calculate coherence - how well atom fits with existing knowledge
   */
  private calculateCoherence(atom: Atom): number {
    // Truth value strength indicates coherence with existing beliefs
    const truthCoherence = atom.truthValue?.strength || 0.5;
    
    // Attention LTI indicates long-term coherence
    const attentionCoherence = atom.attentionValue?.lti 
      ? Math.min(atom.attentionValue.lti / 100, 1.0)
      : 0.5;
    
    // Combine measures
    return (truthCoherence * 0.6 + attentionCoherence * 0.4);
  }

  /**
   * Calculate pragmatic value - usefulness for action
   */
  private calculatePragmaticValue(atom: Atom): number {
    // Atoms with high STI are currently pragmatically valuable
    const stiValue = atom.attentionValue?.sti 
      ? Math.min(atom.attentionValue.sti / 100, 1.0)
      : 0.5;
    
    // Truth confidence indicates reliability for action
    const confidence = atom.truthValue?.confidence || 0.5;
    
    // Action-oriented types have higher pragmatic value
    const actionBonus = this.isActionOriented(atom) ? 0.2 : 0.0;
    
    return Math.min(stiValue * 0.5 + confidence * 0.3 + actionBonus, 1.0);
  }

  /**
   * Get adaptive weights based on opponent processes
   */
  private getAdaptiveWeights(): {
    goal: number;
    context: number;
    novelty: number;
    coherence: number;
    pragmatic: number;
  } {
    const exploration = this.opponentProcesses.get('exploration_exploitation')!;
    const abstraction = this.opponentProcesses.get('abstraction_concreteness')!;
    const breadth = this.opponentProcesses.get('breadth_depth')!;
    
    // Exploration favors novelty, exploitation favors goal relevance
    const noveltyWeight = 0.1 + (exploration.balance + 1) * 0.1; // 0.1 to 0.3
    const goalWeight = 0.3 - (exploration.balance + 1) * 0.05; // 0.2 to 0.3
    
    // Abstraction favors coherence, concreteness favors pragmatic value
    const coherenceWeight = 0.2 + (abstraction.balance + 1) * 0.05; // 0.2 to 0.3
    const pragmaticWeight = 0.2 - (abstraction.balance + 1) * 0.05; // 0.1 to 0.2
    
    // Breadth favors context, depth favors goal
    const contextWeight = 0.2 + (breadth.balance + 1) * 0.05; // 0.2 to 0.3
    
    // Normalize to sum to 1.0
    const total = goalWeight + contextWeight + noveltyWeight + coherenceWeight + pragmaticWeight;
    
    return {
      goal: goalWeight / total,
      context: contextWeight / total,
      novelty: noveltyWeight / total,
      coherence: coherenceWeight / total,
      pragmatic: pragmaticWeight / total
    };
  }

  /**
   * Calculate confidence in relevance assessment
   */
  private calculateConfidence(atom: Atom): number {
    let confidence = 0.0;
    let factors = 0;
    
    // Truth value confidence
    if (atom.truthValue) {
      confidence += atom.truthValue.confidence;
      factors++;
    }
    
    // Attention VLTI (very long-term importance) indicates stable assessment
    if (atom.attentionValue?.vlti) {
      confidence += Math.min(atom.attentionValue.vlti / 100, 1.0);
      factors++;
    }
    
    // History depth increases confidence
    const history = this.relevanceHistory.get(atom.id);
    if (history && history.length > 0) {
      const historyConfidence = Math.min(history.length / 10, 1.0);
      confidence += historyConfidence;
      factors++;
    }
    
    return factors > 0 ? confidence / factors : 0.5;
  }

  /**
   * Update opponent process based on feedback
   */
  updateOpponentProcess(
    processName: string,
    feedback: 'left' | 'right' | 'balance',
    strength: number = 0.1
  ): void {
    const process = this.opponentProcesses.get(processName);
    if (!process) return;
    
    switch (feedback) {
      case 'left':
        process.leftPole = Math.min(process.leftPole + strength, 1.0);
        process.rightPole = Math.max(process.rightPole - strength, 0.0);
        break;
      case 'right':
        process.rightPole = Math.min(process.rightPole + strength, 1.0);
        process.leftPole = Math.max(process.leftPole - strength, 0.0);
        break;
      case 'balance':
        const target = 0.5;
        process.leftPole += (target - process.leftPole) * strength;
        process.rightPole += (target - process.rightPole) * strength;
        break;
    }
    
    // Update balance (-1 to 1)
    process.balance = process.rightPole - process.leftPole;
  }

  /**
   * Update salience landscape based on current atom activations
   */
  updateSalienceLandscape(atoms: Atom[]): void {
    const saliences = atoms.map(atom => ({
      atomId: atom.id,
      salience: atom.attentionValue?.sti || 0
    }));
    
    // Sort by salience
    saliences.sort((a, b) => b.salience - a.salience);
    
    // Identify peaks (top 10%)
    const peakCount = Math.max(Math.floor(saliences.length * 0.1), 1);
    this.salienceLandscape.peaks = saliences.slice(0, peakCount);
    
    // Identify valleys (bottom 10%)
    const valleyCount = Math.max(Math.floor(saliences.length * 0.1), 1);
    this.salienceLandscape.valleys = saliences.slice(-valleyCount);
    
    // Calculate gradients (rate of change in salience)
    this.salienceLandscape.gradients.clear();
    for (let i = 1; i < saliences.length; i++) {
      const gradient = saliences[i - 1].salience - saliences[i].salience;
      this.salienceLandscape.gradients.set(saliences[i].atomId, gradient);
    }
    
    // Determine topology
    const avgGradient = Array.from(this.salienceLandscape.gradients.values())
      .reduce((sum, g) => sum + Math.abs(g), 0) / this.salienceLandscape.gradients.size;
    
    if (avgGradient < 5) {
      this.salienceLandscape.topology = 'flat';
    } else if (avgGradient > 20) {
      this.salienceLandscape.topology = 'rugged';
    } else {
      this.salienceLandscape.topology = 'smooth';
    }
  }

  /**
   * Get optimal grip recommendation for attention allocation
   */
  getOptimalGrip(): {
    focusAtoms: string[];
    exploreAtoms: string[];
    ignoreAtoms: string[];
    recommendation: string;
  } {
    const exploration = this.opponentProcesses.get('exploration_exploitation')!;
    
    // Focus on peaks for exploitation
    const focusAtoms = this.salienceLandscape.peaks
      .slice(0, Math.ceil(this.salienceLandscape.peaks.length * (1 - exploration.balance)))
      .map(p => p.atomId);
    
    // Explore valleys and gradients for exploration
    const exploreAtoms: string[] = [
      ...this.salienceLandscape.valleys.slice(0, 3).map(v => v.atomId),
      ...Array.from(this.salienceLandscape.gradients.entries())
        .filter(([_, g]) => g > 10)
        .slice(0, 3)
        .map(([id, _]) => id)
    ];
    
    // Ignore flat regions
    const ignoreAtoms = Array.from(this.salienceLandscape.gradients.entries())
      .filter(([_, g]) => Math.abs(g) < 2)
      .map(([id, _]) => id);
    
    // Generate recommendation
    let recommendation = '';
    if (this.salienceLandscape.topology === 'flat') {
      recommendation = 'Landscape is flat - increase exploration to find new peaks';
    } else if (this.salienceLandscape.topology === 'rugged') {
      recommendation = 'Landscape is rugged - balance exploration and exploitation';
    } else {
      recommendation = 'Landscape is smooth - exploit current peaks while monitoring gradients';
    }
    
    return { focusAtoms, exploreAtoms, ignoreAtoms, recommendation };
  }

  /**
   * Update context with new information
   */
  updateContext(partial: Partial<RelevanceContext>): void {
    this.context = { ...this.context, ...partial };
    
    // Clean up old recent activations
    const cutoff = Date.now() - this.context.temporalWindow;
    for (const [atomId, timestamp] of this.context.recentActivations.entries()) {
      if (timestamp < cutoff) {
        this.context.recentActivations.delete(atomId);
      }
    }
  }

  /**
   * Record atom activation in context
   */
  recordActivation(atomId: string): void {
    this.context.recentActivations.set(atomId, Date.now());
  }

  // Helper methods

  private semanticSimilarity(str1: string, str2: string): number {
    // Simple string similarity (could be enhanced with embeddings)
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.7;
    
    // Jaccard similarity on words
    const words1 = new Set(s1.split(/\W+/));
    const words2 = new Set(s2.split(/\W+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private matchActivePatterns(atom: Atom): number {
    let maxMatch = 0.0;
    
    for (const pattern of this.context.activePatterns) {
      const match = this.semanticSimilarity(atom.type, pattern);
      maxMatch = Math.max(maxMatch, match);
    }
    
    return maxMatch;
  }

  private correlateWithRecentActivations(atom: Atom): number {
    // Check if atom was recently activated
    const lastActivation = this.context.recentActivations.get(atom.id);
    
    if (!lastActivation) return 0.3; // Low correlation for never-activated
    
    const timeSince = Date.now() - lastActivation;
    const recencyScore = Math.exp(-timeSince / this.context.temporalWindow);
    
    return recencyScore;
  }

  private alignWithEnvironment(atom: Atom): number {
    // Check alignment with environmental factors
    let alignment = 0.5;
    
    // Example: if environment has "urgency" factor, action-oriented atoms score higher
    if (this.context.environmentalFactors.has('urgency')) {
      const urgency = this.context.environmentalFactors.get('urgency')!;
      if (this.isActionOriented(atom)) {
        alignment += urgency * 0.3;
      }
    }
    
    return Math.min(alignment, 1.0);
  }

  private isActionOriented(atom: Atom): boolean {
    const actionTypes = ['ExecutionLink', 'ActionNode', 'ProcedureNode', 'GroundedSchemaNode'];
    return actionTypes.includes(atom.type);
  }

  private updateRelevanceHistory(atomId: string, score: RelevanceScore): void {
    if (!this.relevanceHistory.has(atomId)) {
      this.relevanceHistory.set(atomId, []);
    }
    
    const history = this.relevanceHistory.get(atomId)!;
    history.push(score);
    
    // Keep only last 100 scores
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get current opponent process states
   */
  getOpponentProcessStates(): Map<string, OpponentProcess> {
    return new Map(this.opponentProcesses);
  }

  /**
   * Get current salience landscape
   */
  getSalienceLandscape(): SalienceLandscape {
    return { ...this.salienceLandscape };
  }
}
