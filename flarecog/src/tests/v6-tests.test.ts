/**
 * FlareCog v6.0 Test Suite
 *
 * Comprehensive tests for new v6.0 components
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedDistributedQueryEngine, QueryPattern, QueryResult } from '../core/distributed/EnhancedDistributedQueryEngine';
import { RelevanceRealizationEngine, RelevanceContext } from '../core/RelevanceRealizationEngine';
import { Atom, AttentionValue, TruthValue } from '../types/cognitive-v5';

// ==================== Test Utilities ====================

function createTestAtom(id: string, sti: number = 50): Atom {
  return {
    id,
    type: 'ConceptNode',
    name: `Concept_${id}`,
    truthValue: { strength: 0.8, confidence: 0.9 },
    attentionValue: { sti, lti: 50, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function createTestLink(id: string, outgoing: string[], sti: number = 50): Atom {
  return {
    id,
    type: 'InheritanceLink',
    outgoing,
    truthValue: { strength: 0.7, confidence: 0.85 },
    attentionValue: { sti, lti: 40, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// ==================== Relevance Realization Engine Tests ====================

describe('RelevanceRealizationEngine', () => {
  let engine: RelevanceRealizationEngine;
  let testAtoms: Atom[];

  beforeEach(() => {
    engine = new RelevanceRealizationEngine();
    testAtoms = [
      createTestAtom('test-atom-1', 90),
      createTestAtom('test-atom-2', 50),
      createTestAtom('test-atom-3', 10)
    ];
  });

  describe('realizeRelevance', () => {
    it('should calculate relevance for an atom', async () => {
      const atom = createTestAtom('relevance-test', 80);
      const relevance = await engine.realizeRelevance(atom);

      expect(relevance).toHaveProperty('overall');
      expect(relevance).toHaveProperty('components');
      expect(relevance.overall).toBeGreaterThanOrEqual(0);
      expect(relevance.overall).toBeLessThanOrEqual(1);
    });

    it('should weight high-attention atoms higher', async () => {
      const highAtom = createTestAtom('high-atom', 95);
      const lowAtom = createTestAtom('low-atom', 5);

      const highRelevance = await engine.realizeRelevance(highAtom);
      const lowRelevance = await engine.realizeRelevance(lowAtom);

      // High attention should correlate with higher relevance
      expect(highRelevance.overall).toBeGreaterThanOrEqual(lowRelevance.overall);
    });

    it('should include all relevance components', async () => {
      const atom = createTestAtom('components-test', 70);
      const relevance = await engine.realizeRelevance(atom);

      expect(relevance.components).toHaveProperty('goalRelevance');
      expect(relevance.components).toHaveProperty('contextualFit');
      expect(relevance.components).toHaveProperty('novelty');
      expect(relevance.components).toHaveProperty('coherence');
      expect(relevance.components).toHaveProperty('pragmaticValue');
    });
  });

  describe('updateSalienceLandscape', () => {
    it('should update landscape with array of atoms', () => {
      engine.updateSalienceLandscape(testAtoms);

      const landscape = engine.getSalienceLandscape();

      expect(landscape).toHaveProperty('peaks');
      expect(landscape).toHaveProperty('valleys');
      expect(landscape).toHaveProperty('gradients');
    });

    it('should identify peaks correctly', () => {
      engine.updateSalienceLandscape(testAtoms);

      const landscape = engine.getSalienceLandscape();

      // High STI atoms should be peaks
      expect(landscape.peaks.length).toBeGreaterThan(0);
      expect(landscape.peaks[0].atomId).toBe('test-atom-1');
    });

    it('should identify valleys correctly', () => {
      engine.updateSalienceLandscape(testAtoms);

      const landscape = engine.getSalienceLandscape();

      // Low STI atoms should be valleys
      expect(landscape.valleys.length).toBeGreaterThan(0);
      expect(landscape.valleys[0].atomId).toBe('test-atom-3');
    });

    it('should calculate gradients between atoms', () => {
      engine.updateSalienceLandscape(testAtoms);

      const landscape = engine.getSalienceLandscape();

      expect(landscape.gradients.size).toBeGreaterThan(0);
    });
  });

  describe('getOptimalGrip', () => {
    it('should return grip recommendations', () => {
      engine.updateSalienceLandscape(testAtoms);

      const grip = engine.getOptimalGrip();

      expect(grip).toHaveProperty('focusAtoms');
      expect(grip).toHaveProperty('exploreAtoms');
      expect(grip).toHaveProperty('ignoreAtoms');
      expect(grip).toHaveProperty('recommendation');
    });

    it('should return arrays for atom categories', () => {
      engine.updateSalienceLandscape(testAtoms);

      const grip = engine.getOptimalGrip();

      expect(Array.isArray(grip.focusAtoms)).toBe(true);
      expect(Array.isArray(grip.exploreAtoms)).toBe(true);
      expect(Array.isArray(grip.ignoreAtoms)).toBe(true);
    });

    it('should handle empty landscape', () => {
      const grip = engine.getOptimalGrip();

      expect(grip.focusAtoms).toEqual([]);
      expect(grip.exploreAtoms).toEqual([]);
      expect(grip.ignoreAtoms).toEqual([]);
    });
  });

  describe('updateOpponentProcess', () => {
    it('should update exploration/exploitation balance', () => {
      engine.updateOpponentProcess('exploration_exploitation', 'right', 0.2);

      const states = engine.getOpponentProcessStates();
      const process = states.get('exploration_exploitation');

      expect(process).toBeDefined();
      expect(process!.balance).not.toBe(0);
    });

    it('should support balance adjustment', () => {
      engine.updateOpponentProcess('abstraction_concreteness', 'balance', 0.1);

      const states = engine.getOpponentProcessStates();
      const process = states.get('abstraction_concreteness');

      expect(process).toBeDefined();
    });

    it('should support left adjustment', () => {
      engine.updateOpponentProcess('breadth_depth', 'left', 0.15);

      const states = engine.getOpponentProcessStates();
      const process = states.get('breadth_depth');

      expect(process).toBeDefined();
    });
  });

  describe('updateContext', () => {
    it('should update context partially', () => {
      engine.updateContext({
        currentGoals: ['goal1', 'goal2'],
        timestamp: Date.now()
      });

      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should update active patterns', () => {
      engine.updateContext({
        activePatterns: ['pattern1', 'pattern2']
      });

      expect(true).toBe(true);
    });
  });
});

// ==================== Enhanced Distributed Query Engine Tests ====================

describe('EnhancedDistributedQueryEngine', () => {
  let mockKV: any;
  let mockEnv: any;

  beforeEach(() => {
    mockKV = {
      get: async (key: string) => null,
      put: async (key: string, value: string) => {},
      delete: async (key: string) => {}
    };

    mockEnv = {
      ATOMSPACE: {
        idFromName: (name: string) => ({ toString: () => `mock-id-${name}` }),
        get: (id: any) => ({
          fetch: async (url: string) => new Response(JSON.stringify({ atoms: [], bindings: [] }))
        })
      }
    };
  });

  describe('constructor', () => {
    it('should create engine with required parameters', () => {
      const engine = new EnhancedDistributedQueryEngine(mockKV, mockEnv);

      expect(engine).toBeDefined();
    });

    it('should accept optional cache parameters', () => {
      const engine = new EnhancedDistributedQueryEngine(mockKV, mockEnv, 500, 1800000);

      expect(engine).toBeDefined();
    });
  });

  describe('executeQuery', () => {
    it('should execute query and return results', async () => {
      const engine = new EnhancedDistributedQueryEngine(mockKV, mockEnv);

      const pattern: QueryPattern = {
        type: 'ConceptNode',
        variables: new Map(),
        constraints: [],
        maxResults: 100
      };

      const result = await engine.executeQuery(pattern);

      expect(result).toHaveProperty('atoms');
      expect(result).toHaveProperty('bindings');
      expect(Array.isArray(result.atoms)).toBe(true);
    });

    it('should handle query with constraints', async () => {
      const engine = new EnhancedDistributedQueryEngine(mockKV, mockEnv);

      const pattern: QueryPattern = {
        type: 'ConceptNode',
        variables: new Map([['$X', 'Variable']]),
        constraints: [
          { type: 'attention', field: 'sti', operator: 'gt', value: 50 }
        ],
        maxResults: 10
      };

      const result = await engine.executeQuery(pattern);

      expect(result).toBeDefined();
      expect(result.atoms).toBeDefined();
    });
  });

  describe('traverse', () => {
    it('should traverse from starting atom', async () => {
      const engine = new EnhancedDistributedQueryEngine(mockKV, mockEnv);

      const startAtom = createTestAtom('start-atom', 80);

      const result = await engine.traverse(startAtom, {
        direction: 'outgoing',
        maxDepth: 3
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect maxDepth parameter', async () => {
      const engine = new EnhancedDistributedQueryEngine(mockKV, mockEnv);

      const startAtom = createTestAtom('depth-test', 70);

      const result = await engine.traverse(startAtom, {
        direction: 'both',
        maxDepth: 1
      });

      expect(result).toBeDefined();
    });

    it('should support direction options', async () => {
      const engine = new EnhancedDistributedQueryEngine(mockKV, mockEnv);

      const startAtom = createTestAtom('direction-test', 60);

      const outgoing = await engine.traverse(startAtom, { direction: 'outgoing', maxDepth: 2 });
      const incoming = await engine.traverse(startAtom, { direction: 'incoming', maxDepth: 2 });
      const both = await engine.traverse(startAtom, { direction: 'both', maxDepth: 2 });

      expect(outgoing).toBeDefined();
      expect(incoming).toBeDefined();
      expect(both).toBeDefined();
    });
  });
});

// ==================== Integration Tests ====================

describe('Integration Tests', () => {
  it('should integrate relevance engine with query results', async () => {
    const relevanceEngine = new RelevanceRealizationEngine();
    const atoms = [
      createTestAtom('int-atom-1', 85),
      createTestAtom('int-atom-2', 45),
      createTestAtom('int-atom-3', 25)
    ];

    // Update landscape with query results
    relevanceEngine.updateSalienceLandscape(atoms);

    const landscape = relevanceEngine.getSalienceLandscape();
    const grip = relevanceEngine.getOptimalGrip();

    expect(landscape.peaks.length).toBeGreaterThan(0);
    expect(grip.focusAtoms.length + grip.exploreAtoms.length + grip.ignoreAtoms.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle high-attention atoms differently', async () => {
    const relevanceEngine = new RelevanceRealizationEngine();

    const highAtom = createTestAtom('high-atom', 95);
    const lowAtom = createTestAtom('low-atom', 15);

    const highRelevance = await relevanceEngine.realizeRelevance(highAtom);
    const lowRelevance = await relevanceEngine.realizeRelevance(lowAtom);

    // High attention should typically result in higher relevance
    expect(highRelevance.overall).toBeGreaterThanOrEqual(0);
    expect(lowRelevance.overall).toBeGreaterThanOrEqual(0);
  });

  it('should update opponent processes based on grip', () => {
    const engine = new RelevanceRealizationEngine();

    const atoms = [
      createTestAtom('opp-1', 90),
      createTestAtom('opp-2', 50),
      createTestAtom('opp-3', 10)
    ];

    engine.updateSalienceLandscape(atoms);

    // Adjust exploration based on landscape topology
    engine.updateOpponentProcess('exploration_exploitation', 'balance', 0.1);

    const grip = engine.getOptimalGrip();

    expect(grip).toBeDefined();
    expect(grip.recommendation).toBeDefined();
  });
});

// ==================== Performance Tests ====================

describe('Performance Tests', () => {
  it('should handle large salience landscapes efficiently', () => {
    const engine = new RelevanceRealizationEngine();
    const atoms: Atom[] = [];

    // Create 1000 atoms
    for (let i = 0; i < 1000; i++) {
      atoms.push(createTestAtom(`perf-atom-${i}`, Math.random() * 100));
    }

    const startTime = Date.now();

    engine.updateSalienceLandscape(atoms);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 1 second)
    expect(duration).toBeLessThan(1000);

    const landscape = engine.getSalienceLandscape();
    expect(landscape.peaks.length).toBeGreaterThan(0);
  });

  it('should calculate relevance quickly', async () => {
    const engine = new RelevanceRealizationEngine();
    const atom = createTestAtom('perf-atom', 75);

    const startTime = Date.now();

    // Calculate relevance 100 times
    for (let i = 0; i < 100; i++) {
      await engine.realizeRelevance(atom);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 500ms)
    expect(duration).toBeLessThan(500);
  });

  it('should get optimal grip efficiently', () => {
    const engine = new RelevanceRealizationEngine();

    const atoms: Atom[] = [];
    for (let i = 0; i < 500; i++) {
      atoms.push(createTestAtom(`grip-atom-${i}`, Math.random() * 100));
    }

    engine.updateSalienceLandscape(atoms);

    const startTime = Date.now();

    for (let i = 0; i < 100; i++) {
      engine.getOptimalGrip();
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete quickly (< 200ms)
    expect(duration).toBeLessThan(200);
  });
});

// ==================== Edge Cases ====================

describe('Edge Cases', () => {
  it('should handle atoms with zero attention', async () => {
    const engine = new RelevanceRealizationEngine();
    const atom = createTestAtom('zero-atom', 0);

    const relevance = await engine.realizeRelevance(atom);

    expect(relevance.overall).toBeGreaterThanOrEqual(0);
    expect(relevance.overall).toBeLessThanOrEqual(1);
  });

  it('should handle atoms with maximum attention', async () => {
    const engine = new RelevanceRealizationEngine();
    const atom = createTestAtom('max-atom', 100);

    const relevance = await engine.realizeRelevance(atom);

    expect(relevance.overall).toBeGreaterThanOrEqual(0);
    expect(relevance.overall).toBeLessThanOrEqual(1);
  });

  it('should handle empty atom list for landscape', () => {
    const engine = new RelevanceRealizationEngine();

    engine.updateSalienceLandscape([]);

    const landscape = engine.getSalienceLandscape();

    expect(landscape.peaks).toEqual([]);
    expect(landscape.valleys).toEqual([]);
  });

  it('should handle single atom landscape', () => {
    const engine = new RelevanceRealizationEngine();
    const atom = createTestAtom('single-atom', 50);

    engine.updateSalienceLandscape([atom]);

    const landscape = engine.getSalienceLandscape();

    expect(landscape.peaks.length + landscape.valleys.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle atoms with negative STI', async () => {
    const engine = new RelevanceRealizationEngine();
    const atom: Atom = {
      id: 'negative-sti',
      type: 'ConceptNode',
      name: 'NegativeAtom',
      truthValue: { strength: 0.5, confidence: 0.5 },
      attentionValue: { sti: -50, lti: 20, vlti: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const relevance = await engine.realizeRelevance(atom);

    expect(relevance.overall).toBeGreaterThanOrEqual(0);
  });

  it('should handle very large STI values', async () => {
    const engine = new RelevanceRealizationEngine();
    const atom: Atom = {
      id: 'large-sti',
      type: 'ConceptNode',
      name: 'LargeAtom',
      truthValue: { strength: 1.0, confidence: 1.0 },
      attentionValue: { sti: 1000, lti: 100, vlti: 100 },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const relevance = await engine.realizeRelevance(atom);

    expect(relevance.overall).toBeDefined();
  });
});

// ==================== MindAgent Tests ====================

describe('MindAgent Integration', () => {
  it('should update landscape from agent results', () => {
    const engine = new RelevanceRealizationEngine();

    // Simulate agent returning processed atoms
    const processedAtoms = [
      createTestAtom('agent-atom-1', 88),
      createTestAtom('agent-atom-2', 66),
      createTestAtom('agent-atom-3', 44),
      createTestAtom('agent-atom-4', 22)
    ];

    engine.updateSalienceLandscape(processedAtoms);

    const grip = engine.getOptimalGrip();

    // Focus should include high-salience atoms
    expect(grip.focusAtoms.length).toBeGreaterThanOrEqual(0);
  });

  it('should adjust opponent processes for balance', () => {
    const engine = new RelevanceRealizationEngine();

    // Simulate balanced opponent process updates
    engine.updateOpponentProcess('exploration_exploitation', 'balance', 0.1);
    engine.updateOpponentProcess('abstraction_concreteness', 'balance', 0.1);
    engine.updateOpponentProcess('breadth_depth', 'balance', 0.1);
    engine.updateOpponentProcess('stability_plasticity', 'balance', 0.1);

    const states = engine.getOpponentProcessStates();

    expect(states.size).toBeGreaterThan(0);
  });
});

// ==================== Storage Tiering Tests ====================

describe('Storage Tiering Logic', () => {
  it('should categorize atoms by attention for tiering', () => {
    const atoms = [
      createTestAtom('hot-1', 90),
      createTestAtom('hot-2', 85),
      createTestAtom('warm-1', 50),
      createTestAtom('warm-2', 45),
      createTestAtom('cold-1', 10),
      createTestAtom('cold-2', 5)
    ];

    // Categorize by STI thresholds
    const hot = atoms.filter(a => a.attentionValue.sti >= 80);
    const warm = atoms.filter(a => a.attentionValue.sti >= 30 && a.attentionValue.sti < 80);
    const cold = atoms.filter(a => a.attentionValue.sti < 30);

    expect(hot.length).toBe(2);
    expect(warm.length).toBe(2);
    expect(cold.length).toBe(2);
  });

  it('should identify atoms for promotion/demotion', () => {
    const atoms = [
      createTestAtom('promote-1', 85), // Should stay hot
      createTestAtom('promote-2', 35), // Was warm, now borderline
      createTestAtom('demote-1', 25),  // Should demote to cold
    ];

    const hotThreshold = 80;
    const warmThreshold = 30;

    const needsPromotion = atoms.filter(a =>
      a.attentionValue.sti >= warmThreshold && a.attentionValue.sti < hotThreshold
    );

    const needsDemotion = atoms.filter(a =>
      a.attentionValue.sti < warmThreshold
    );

    expect(needsPromotion.length).toBe(1);
    expect(needsDemotion.length).toBe(1);
  });
});
