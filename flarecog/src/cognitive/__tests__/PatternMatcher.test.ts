/**
 * Unit tests for PatternMatcher and PatternInvertedIndex
 *
 * Tests the pattern matching capabilities for OpenCog-style queries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PatternInvertedIndex, PatternMatcher } from '../PatternMatcher';
import { Atom, Link, Node, TruthValue, AttentionValue } from '../../types/cognitive';

// ==================== Test Fixtures ====================

function createConceptNode(
  id: string,
  name: string,
  strength: number = 0.8,
  confidence: number = 0.9,
  sti: number = 50
): Node {
  return {
    id,
    type: 'ConceptNode',
    name,
    truthValue: { strength, confidence },
    attentionValue: { sti, lti: 10, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createPredicateNode(
  id: string,
  name: string,
  strength: number = 0.8,
  confidence: number = 0.9
): Node {
  return {
    id,
    type: 'PredicateNode',
    name,
    truthValue: { strength, confidence },
    attentionValue: { sti: 50, lti: 10, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createInheritanceLink(
  id: string,
  childId: string,
  parentId: string,
  strength: number = 0.8,
  confidence: number = 0.9
): Link {
  return {
    id,
    type: 'InheritanceLink',
    outgoing: [childId, parentId],
    truthValue: { strength, confidence },
    attentionValue: { sti: 30, lti: 10, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createEvaluationLink(
  id: string,
  predicateId: string,
  listId: string,
  strength: number = 0.8,
  confidence: number = 0.9
): Link {
  return {
    id,
    type: 'EvaluationLink',
    outgoing: [predicateId, listId],
    truthValue: { strength, confidence },
    attentionValue: { sti: 30, lti: 10, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ==================== PatternInvertedIndex Tests ====================

describe('PatternInvertedIndex', () => {
  let index: PatternInvertedIndex;

  beforeEach(() => {
    index = new PatternInvertedIndex();
  });

  describe('indexAtom', () => {
    it('should index a ConceptNode with type and name patterns', () => {
      const node = createConceptNode('id1', 'Cat');
      index.indexAtom(node);

      // Should be findable by type pattern
      const byType = index.findByPattern('type:ConceptNode');
      expect(byType.has('id1')).toBe(true);

      // Should be findable by name pattern
      const byName = index.findByPattern('name:Cat');
      expect(byName.has('id1')).toBe(true);

      // Should be findable by combined type:name pattern
      const byCombined = index.findByPattern('ConceptNode:Cat');
      expect(byCombined.has('id1')).toBe(true);
    });

    it('should index a Link with outgoing patterns', () => {
      const link = createInheritanceLink('link1', 'child1', 'parent1');
      index.indexAtom(link);

      // Should be findable by type
      const byType = index.findByPattern('type:InheritanceLink');
      expect(byType.has('link1')).toBe(true);

      // Should be findable by arity
      const byArity = index.findByPattern('InheritanceLink:2');
      expect(byArity.has('link1')).toBe(true);

      // Should be findable by position patterns
      const byPos0 = index.findByPattern('InheritanceLink:pos0:child1');
      expect(byPos0.has('link1')).toBe(true);

      const byPos1 = index.findByPattern('InheritanceLink:pos1:parent1');
      expect(byPos1.has('link1')).toBe(true);
    });

    it('should index truth value ranges', () => {
      const node = createConceptNode('id1', 'Node1', 0.85, 0.9);
      index.indexAtom(node);

      // 0.85 should be indexed as 0.8 (floor to 1 decimal)
      const byTV = index.findByPattern('tv:0.8');
      expect(byTV.has('id1')).toBe(true);
    });

    it('should index attention value ranges', () => {
      const node = createConceptNode('id1', 'Node1', 0.8, 0.9, 55);
      index.indexAtom(node);

      // 55 should be indexed as 50 (floor to 10s)
      const bySTI = index.findByPattern('sti:50');
      expect(bySTI.has('id1')).toBe(true);
    });

    it('should update frequency counter for same pattern', () => {
      const node1 = createConceptNode('id1', 'Cat');
      const node2 = createConceptNode('id2', 'Dog');

      index.indexAtom(node1);
      index.indexAtom(node2);

      const stats = index.getStats();
      // Both are ConceptNodes so type:ConceptNode pattern frequency should be 2
      expect(stats.totalPatterns).toBeGreaterThan(0);
    });
  });

  describe('findByPattern', () => {
    it('should return empty set for non-existent pattern', () => {
      const result = index.findByPattern('nonexistent:pattern');
      expect(result.size).toBe(0);
    });

    it('should return all atoms matching the pattern', () => {
      const node1 = createConceptNode('id1', 'Cat');
      const node2 = createConceptNode('id2', 'Dog');
      const pred = createPredicateNode('id3', 'likes');

      index.indexAtom(node1);
      index.indexAtom(node2);
      index.indexAtom(pred);

      const concepts = index.findByPattern('type:ConceptNode');
      expect(concepts.size).toBe(2);
      expect(concepts.has('id1')).toBe(true);
      expect(concepts.has('id2')).toBe(true);
      expect(concepts.has('id3')).toBe(false);
    });
  });

  describe('findByPatterns', () => {
    it('should return union of atoms matching any pattern', () => {
      const cat = createConceptNode('cat1', 'Cat');
      const dog = createConceptNode('dog1', 'Dog');
      const likes = createPredicateNode('pred1', 'likes');

      index.indexAtom(cat);
      index.indexAtom(dog);
      index.indexAtom(likes);

      // Find by multiple patterns (union)
      const result = index.findByPatterns(['name:Cat', 'name:likes']);
      expect(result.size).toBe(2);
      expect(result.has('cat1')).toBe(true);
      expect(result.has('pred1')).toBe(true);
      expect(result.has('dog1')).toBe(false);
    });

    it('should handle empty patterns array', () => {
      const node = createConceptNode('id1', 'Cat');
      index.indexAtom(node);

      const result = index.findByPatterns([]);
      expect(result.size).toBe(0);
    });

    it('should handle patterns with no matches', () => {
      const node = createConceptNode('id1', 'Cat');
      index.indexAtom(node);

      const result = index.findByPatterns(['name:Nonexistent', 'type:FakeType']);
      expect(result.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return zeros for empty index', () => {
      const stats = index.getStats();
      expect(stats.totalPatterns).toBe(0);
      expect(stats.totalAtoms).toBe(0);
      expect(stats.averageFrequency).toBe(0);
    });

    it('should return correct statistics after indexing', () => {
      const node1 = createConceptNode('id1', 'Cat');
      const node2 = createConceptNode('id2', 'Dog');

      index.indexAtom(node1);
      index.indexAtom(node2);

      const stats = index.getStats();
      expect(stats.totalPatterns).toBeGreaterThan(0);
      expect(stats.totalAtoms).toBeGreaterThan(0);
      expect(stats.averageFrequency).toBeGreaterThan(0);
    });
  });
});

// ==================== PatternMatcher Tests ====================

describe('PatternMatcher', () => {
  let matcher: PatternMatcher;
  const mockEnv: any = {};

  beforeEach(() => {
    matcher = new PatternMatcher(mockEnv);
  });

  describe('constructor', () => {
    it('should initialize with empty inverted index', () => {
      const stats = matcher.getStats();
      expect(stats.totalPatterns).toBe(0);
      expect(stats.totalAtoms).toBe(0);
    });
  });

  describe('indexAtoms', () => {
    it('should index multiple atoms', () => {
      const atoms: Atom[] = [
        createConceptNode('id1', 'Cat'),
        createConceptNode('id2', 'Dog'),
        createPredicateNode('id3', 'likes'),
      ];

      matcher.indexAtoms(atoms);

      const stats = matcher.getStats();
      expect(stats.totalPatterns).toBeGreaterThan(0);
    });

    it('should handle empty array', () => {
      matcher.indexAtoms([]);
      const stats = matcher.getStats();
      expect(stats.totalPatterns).toBe(0);
    });

    it('should allow indexing additional atoms', () => {
      const atoms1: Atom[] = [createConceptNode('id1', 'Cat')];
      const atoms2: Atom[] = [createConceptNode('id2', 'Dog')];

      matcher.indexAtoms(atoms1);
      const stats1 = matcher.getStats();

      matcher.indexAtoms(atoms2);
      const stats2 = matcher.getStats();

      expect(stats2.totalAtoms).toBeGreaterThan(stats1.totalAtoms);
    });
  });

  describe('getStats', () => {
    it('should return current index statistics', () => {
      const atoms: Atom[] = [
        createConceptNode('id1', 'Cat'),
        createInheritanceLink('link1', 'id1', 'id2'),
      ];

      matcher.indexAtoms(atoms);

      const stats = matcher.getStats();
      expect(stats).toHaveProperty('totalPatterns');
      expect(stats).toHaveProperty('totalAtoms');
      expect(stats).toHaveProperty('averageFrequency');
    });
  });
});

// ==================== Pattern Extraction Tests ====================

describe('Pattern Extraction Behavior', () => {
  let index: PatternInvertedIndex;

  beforeEach(() => {
    index = new PatternInvertedIndex();
  });

  it('should create multiple patterns for a complex atom', () => {
    const link: Link = {
      id: 'eval1',
      type: 'EvaluationLink',
      outgoing: ['pred1', 'list1'],
      truthValue: { strength: 0.75, confidence: 0.85 },
      attentionValue: { sti: 45, lti: 20, vlti: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    index.indexAtom(link);

    // Check type pattern
    expect(index.findByPattern('type:EvaluationLink').has('eval1')).toBe(true);

    // Check arity pattern
    expect(index.findByPattern('EvaluationLink:2').has('eval1')).toBe(true);

    // Check position patterns
    expect(index.findByPattern('EvaluationLink:pos0:pred1').has('eval1')).toBe(true);
    expect(index.findByPattern('EvaluationLink:pos1:list1').has('eval1')).toBe(true);

    // Check truth value pattern (0.75 -> 0.7)
    expect(index.findByPattern('tv:0.7').has('eval1')).toBe(true);

    // Check STI pattern (45 -> 40)
    expect(index.findByPattern('sti:40').has('eval1')).toBe(true);
  });

  it('should handle nodes without names', () => {
    const node: Node = {
      id: 'node1',
      type: 'NumberNode',
      name: '', // Empty name
      truthValue: { strength: 1.0, confidence: 1.0 },
      attentionValue: { sti: 0, lti: 0, vlti: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    index.indexAtom(node);

    // Should still be findable by type
    expect(index.findByPattern('type:NumberNode').has('node1')).toBe(true);
  });

  it('should handle links with many outgoing atoms', () => {
    const link: Link = {
      id: 'list1',
      type: 'ListLink',
      outgoing: ['a', 'b', 'c', 'd', 'e'],
      truthValue: { strength: 1.0, confidence: 1.0 },
      attentionValue: { sti: 0, lti: 0, vlti: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    index.indexAtom(link);

    // Check arity
    expect(index.findByPattern('ListLink:5').has('list1')).toBe(true);

    // Check all positions
    expect(index.findByPattern('ListLink:pos0:a').has('list1')).toBe(true);
    expect(index.findByPattern('ListLink:pos4:e').has('list1')).toBe(true);
  });
});

// ==================== Edge Cases and Error Handling ====================

describe('Edge Cases', () => {
  let index: PatternInvertedIndex;

  beforeEach(() => {
    index = new PatternInvertedIndex();
  });

  it('should handle atoms with zero truth value strength', () => {
    const node = createConceptNode('id1', 'False', 0.0, 0.9);
    index.indexAtom(node);

    expect(index.findByPattern('tv:0').has('id1')).toBe(true);
  });

  it('should handle atoms with perfect truth value', () => {
    const node = createConceptNode('id1', 'True', 1.0, 1.0);
    index.indexAtom(node);

    expect(index.findByPattern('tv:1').has('id1')).toBe(true);
  });

  it('should handle negative STI values', () => {
    const node = createConceptNode('id1', 'Forgotten', 0.5, 0.5, -25);
    index.indexAtom(node);

    expect(index.findByPattern('sti:-30').has('id1')).toBe(true);
  });

  it('should handle very high STI values', () => {
    const node = createConceptNode('id1', 'Important', 0.9, 0.9, 150);
    index.indexAtom(node);

    expect(index.findByPattern('sti:150').has('id1')).toBe(true);
  });

  it('should handle empty outgoing array in links', () => {
    const link: Link = {
      id: 'empty1',
      type: 'ListLink',
      outgoing: [],
      truthValue: { strength: 1.0, confidence: 1.0 },
      attentionValue: { sti: 0, lti: 0, vlti: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    index.indexAtom(link);
    expect(index.findByPattern('ListLink:0').has('empty1')).toBe(true);
  });

  it('should handle special characters in names', () => {
    const node = createConceptNode('id1', 'hello:world');
    index.indexAtom(node);

    expect(index.findByPattern('name:hello:world').has('id1')).toBe(true);
  });

  it('should handle duplicate indexing of same atom', () => {
    const node = createConceptNode('id1', 'Cat');

    index.indexAtom(node);
    index.indexAtom(node);

    // Should still only appear once in results
    const result = index.findByPattern('name:Cat');
    expect(result.size).toBe(1);
  });
});

// ==================== Performance and Scalability ====================

describe('Index Performance', () => {
  let index: PatternInvertedIndex;

  beforeEach(() => {
    index = new PatternInvertedIndex();
  });

  it('should handle indexing many atoms efficiently', () => {
    const atoms: Atom[] = [];

    for (let i = 0; i < 100; i++) {
      atoms.push(createConceptNode(`id${i}`, `Concept${i % 10}`));
    }

    const startTime = Date.now();
    for (const atom of atoms) {
      index.indexAtom(atom);
    }
    const endTime = Date.now();

    // Should complete in reasonable time
    expect(endTime - startTime).toBeLessThan(1000);

    const stats = index.getStats();
    // totalAtoms counts atom occurrences across all patterns (not unique atoms)
    // Each atom generates multiple patterns (type, name, type:name, tv, sti)
    expect(stats.totalAtoms).toBeGreaterThanOrEqual(100);
    expect(stats.totalPatterns).toBeGreaterThan(0);
  });

  it('should efficiently search patterns after bulk indexing', () => {
    // Index many atoms
    for (let i = 0; i < 100; i++) {
      index.indexAtom(createConceptNode(`concept${i}`, `Name${i}`));
    }

    for (let i = 0; i < 50; i++) {
      index.indexAtom(createPredicateNode(`pred${i}`, `Predicate${i}`));
    }

    // Search should be fast
    const startTime = Date.now();
    const concepts = index.findByPattern('type:ConceptNode');
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(100);
    expect(concepts.size).toBe(100);
  });
});
