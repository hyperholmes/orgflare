/**
 * PLN (Probabilistic Logic Networks) Reasoning Unit Tests
 *
 * Comprehensive tests for all PLN inference rules and utility functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PLNReasoning, PLNInferenceResult, PLNRuleType } from '../PLNReasoning';
import { Link, Atom, TruthValue } from '../../types/cognitive';

// ==================== Test Fixtures ====================

function createImplicationLink(
  id: string,
  fromId: string,
  toId: string,
  strength: number,
  confidence: number
): Link {
  return {
    id,
    type: 'ImplicationLink',
    outgoing: [fromId, toId],
    truthValue: { strength, confidence },
    attentionValue: { sti: 50, lti: 25, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function createInheritanceLink(
  id: string,
  fromId: string,
  toId: string,
  strength: number,
  confidence: number
): Link {
  return {
    id,
    type: 'InheritanceLink',
    outgoing: [fromId, toId],
    truthValue: { strength, confidence },
    attentionValue: { sti: 50, lti: 25, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function createConceptNode(
  id: string,
  name: string,
  strength: number,
  confidence: number
): Atom {
  return {
    id,
    type: 'ConceptNode',
    name,
    truthValue: { strength, confidence },
    attentionValue: { sti: 50, lti: 25, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// ==================== Deduction Tests ====================

describe('PLNReasoning.deduction', () => {
  it('should perform valid deduction with matching premises', () => {
    // A -> B with strength 0.8, confidence 0.9
    const premiseAB = createImplicationLink('ab-link', 'A', 'B', 0.8, 0.9);
    // B -> C with strength 0.7, confidence 0.8
    const premiseBC = createImplicationLink('bc-link', 'B', 'C', 0.7, 0.8);

    const result = PLNReasoning.deduction(premiseAB, premiseBC);

    expect(result).not.toBeNull();
    expect(result!.rule).toBe('Deduction');
    expect(result!.conclusion.type).toBe('ImplicationLink');
    expect(result!.conclusion.outgoing).toEqual(['A', 'C']);

    // Verify truth value calculation: sAC = sAB * sBC = 0.8 * 0.7 = 0.56
    expect(result!.truthValue.strength).toBeCloseTo(0.56, 2);
    // cAC = cAB * cBC * sAB = 0.9 * 0.8 * 0.8 = 0.576
    expect(result!.truthValue.confidence).toBeCloseTo(0.576, 2);
  });

  it('should return null when premises do not chain (B mismatch)', () => {
    const premiseAB = createImplicationLink('ab-link', 'A', 'B', 0.8, 0.9);
    const premiseXC = createImplicationLink('xc-link', 'X', 'C', 0.7, 0.8);

    const result = PLNReasoning.deduction(premiseAB, premiseXC);

    expect(result).toBeNull();
  });

  it('should return null for non-ImplicationLink premises', () => {
    const inheritanceLink = createInheritanceLink('ab-link', 'A', 'B', 0.8, 0.9);
    const implicationLink = createImplicationLink('bc-link', 'B', 'C', 0.7, 0.8);

    const result = PLNReasoning.deduction(inheritanceLink, implicationLink);

    expect(result).toBeNull();
  });

  it('should handle low confidence premises', () => {
    const premiseAB = createImplicationLink('ab-link', 'A', 'B', 0.9, 0.1);
    const premiseBC = createImplicationLink('bc-link', 'B', 'C', 0.9, 0.1);

    const result = PLNReasoning.deduction(premiseAB, premiseBC);

    expect(result).not.toBeNull();
    // Low confidence should result in very low conclusion confidence
    expect(result!.confidence).toBeLessThan(0.1);
  });

  it('should handle edge case with strength 0', () => {
    const premiseAB = createImplicationLink('ab-link', 'A', 'B', 0, 0.9);
    const premiseBC = createImplicationLink('bc-link', 'B', 'C', 0.7, 0.8);

    const result = PLNReasoning.deduction(premiseAB, premiseBC);

    expect(result).not.toBeNull();
    expect(result!.truthValue.strength).toBe(0);
    expect(result!.truthValue.confidence).toBe(0);
  });

  it('should handle perfect confidence and strength', () => {
    const premiseAB = createImplicationLink('ab-link', 'A', 'B', 1.0, 1.0);
    const premiseBC = createImplicationLink('bc-link', 'B', 'C', 1.0, 1.0);

    const result = PLNReasoning.deduction(premiseAB, premiseBC);

    expect(result).not.toBeNull();
    expect(result!.truthValue.strength).toBe(1.0);
    expect(result!.truthValue.confidence).toBe(1.0);
  });

  it('should include premise IDs in result', () => {
    const premiseAB = createImplicationLink('premise-ab-id', 'A', 'B', 0.8, 0.9);
    const premiseBC = createImplicationLink('premise-bc-id', 'B', 'C', 0.7, 0.8);

    const result = PLNReasoning.deduction(premiseAB, premiseBC);

    expect(result!.premises).toContain('premise-ab-id');
    expect(result!.premises).toContain('premise-bc-id');
  });
});

// ==================== Induction Tests ====================

describe('PLNReasoning.induction', () => {
  it('should perform valid induction with shared antecedent', () => {
    // A -> B
    const premiseAB = createImplicationLink('ab-link', 'A', 'B', 0.8, 0.9);
    // A -> C
    const premiseAC = createImplicationLink('ac-link', 'A', 'C', 0.7, 0.8);

    const result = PLNReasoning.induction(premiseAB, premiseAC);

    expect(result).not.toBeNull();
    expect(result!.rule).toBe('Induction');
    expect(result!.conclusion.outgoing).toEqual(['B', 'C']);

    // sBC = sAB * sAC = 0.8 * 0.7 = 0.56
    expect(result!.truthValue.strength).toBeCloseTo(0.56, 2);
    // cBC = min(cAB, cAC) * 0.8 = 0.8 * 0.8 = 0.64
    expect(result!.truthValue.confidence).toBeCloseTo(0.64, 2);
  });

  it('should return null when antecedents do not match', () => {
    const premiseAB = createImplicationLink('ab-link', 'A', 'B', 0.8, 0.9);
    const premiseXC = createImplicationLink('xc-link', 'X', 'C', 0.7, 0.8);

    const result = PLNReasoning.induction(premiseAB, premiseXC);

    expect(result).toBeNull();
  });

  it('should return null for non-ImplicationLink premises', () => {
    const inheritanceLink = createInheritanceLink('ab-link', 'A', 'B', 0.8, 0.9);
    const implicationLink = createImplicationLink('ac-link', 'A', 'C', 0.7, 0.8);

    const result = PLNReasoning.induction(inheritanceLink, implicationLink);

    expect(result).toBeNull();
  });

  it('should have lower confidence than deduction (0.8 factor)', () => {
    const premiseAB = createImplicationLink('ab-link', 'A', 'B', 0.9, 1.0);
    const premiseAC = createImplicationLink('ac-link', 'A', 'C', 0.9, 1.0);

    const result = PLNReasoning.induction(premiseAB, premiseAC);

    expect(result).not.toBeNull();
    // Confidence should be 0.8 (min(1.0, 1.0) * 0.8)
    expect(result!.confidence).toBe(0.8);
  });
});

// ==================== Abduction Tests ====================

describe('PLNReasoning.abduction', () => {
  it('should perform valid abduction with shared consequent', () => {
    // B -> C
    const premiseBC = createImplicationLink('bc-link', 'B', 'C', 0.8, 0.9);
    // A -> C
    const premiseAC = createImplicationLink('ac-link', 'A', 'C', 0.7, 0.8);

    const result = PLNReasoning.abduction(premiseBC, premiseAC);

    expect(result).not.toBeNull();
    expect(result!.rule).toBe('Abduction');
    expect(result!.conclusion.outgoing).toEqual(['A', 'B']);

    // sAB = sBC * sAC = 0.8 * 0.7 = 0.56
    expect(result!.truthValue.strength).toBeCloseTo(0.56, 2);
    // cAB = min(cBC, cAC) * 0.6 = 0.8 * 0.6 = 0.48
    expect(result!.truthValue.confidence).toBeCloseTo(0.48, 2);
  });

  it('should return null when consequents do not match', () => {
    const premiseBC = createImplicationLink('bc-link', 'B', 'C', 0.8, 0.9);
    const premiseAX = createImplicationLink('ax-link', 'A', 'X', 0.7, 0.8);

    const result = PLNReasoning.abduction(premiseBC, premiseAX);

    expect(result).toBeNull();
  });

  it('should have lowest confidence among inference rules (0.6 factor)', () => {
    const premiseBC = createImplicationLink('bc-link', 'B', 'C', 0.9, 1.0);
    const premiseAC = createImplicationLink('ac-link', 'A', 'C', 0.9, 1.0);

    const result = PLNReasoning.abduction(premiseBC, premiseAC);

    expect(result).not.toBeNull();
    // Confidence should be 0.6 (min(1.0, 1.0) * 0.6)
    expect(result!.confidence).toBe(0.6);
  });

  it('should return null for non-ImplicationLink premises', () => {
    const inheritanceLink = createInheritanceLink('bc-link', 'B', 'C', 0.8, 0.9);
    const implicationLink = createImplicationLink('ac-link', 'A', 'C', 0.7, 0.8);

    const result = PLNReasoning.abduction(inheritanceLink, implicationLink);

    expect(result).toBeNull();
  });
});

// ==================== Modus Ponens Tests ====================

describe('PLNReasoning.modusPonens', () => {
  it('should perform valid modus ponens', () => {
    // A is true with strength 0.9, confidence 0.8
    const premiseA = createConceptNode('A', 'ConceptA', 0.9, 0.8);
    // A -> B with strength 0.8, confidence 0.9
    const premiseAB = createImplicationLink('ab-link', 'A', 'B', 0.8, 0.9);

    const result = PLNReasoning.modusPonens(premiseA, premiseAB);

    expect(result).not.toBeNull();
    expect(result!.rule).toBe('ModusPonens');
    expect(result!.conclusion.id).toBe('B');

    // sB = sA * sAB = 0.9 * 0.8 = 0.72
    expect(result!.truthValue.strength).toBeCloseTo(0.72, 2);
    // cB = cA * cAB = 0.8 * 0.9 = 0.72
    expect(result!.truthValue.confidence).toBeCloseTo(0.72, 2);
  });

  it('should return null when atom does not match antecedent', () => {
    const premiseX = createConceptNode('X', 'ConceptX', 0.9, 0.8);
    const premiseAB = createImplicationLink('ab-link', 'A', 'B', 0.8, 0.9);

    const result = PLNReasoning.modusPonens(premiseX, premiseAB);

    expect(result).toBeNull();
  });

  it('should return null for non-ImplicationLink', () => {
    const premiseA = createConceptNode('A', 'ConceptA', 0.9, 0.8);
    const inheritanceLink = createInheritanceLink('ab-link', 'A', 'B', 0.8, 0.9);

    const result = PLNReasoning.modusPonens(premiseA, inheritanceLink);

    expect(result).toBeNull();
  });

  it('should handle false premise (low strength)', () => {
    const premiseA = createConceptNode('A', 'ConceptA', 0.1, 0.8);
    const premiseAB = createImplicationLink('ab-link', 'A', 'B', 0.9, 0.9);

    const result = PLNReasoning.modusPonens(premiseA, premiseAB);

    expect(result).not.toBeNull();
    // Low premise strength should result in low conclusion strength
    expect(result!.truthValue.strength).toBeCloseTo(0.09, 2);
  });

  it('should include both premises in result', () => {
    const premiseA = createConceptNode('premise-a-id', 'ConceptA', 0.9, 0.8);
    const premiseAB = createImplicationLink('premise-ab-id', 'premise-a-id', 'B', 0.8, 0.9);

    const result = PLNReasoning.modusPonens(premiseA, premiseAB);

    expect(result!.premises).toContain('premise-a-id');
    expect(result!.premises).toContain('premise-ab-id');
  });
});

// ==================== Revision Tests ====================

describe('PLNReasoning.revision', () => {
  it('should combine two truth values with weighted average', () => {
    const tv1: TruthValue = { strength: 0.8, confidence: 0.6 };
    const tv2: TruthValue = { strength: 0.6, confidence: 0.4 };

    const result = PLNReasoning.revision(tv1, tv2);

    // w1 = 0.6 / (0.6 + 0.4) = 0.6
    // w2 = 0.4 / (0.6 + 0.4) = 0.4
    // sRevised = 0.6 * 0.8 + 0.4 * 0.6 = 0.48 + 0.24 = 0.72
    expect(result.strength).toBeCloseTo(0.72, 2);

    // cRevised = (0.6 + 0.4) / (1 + 0.6 + 0.4) = 1.0 / 2.0 = 0.5
    expect(result.confidence).toBeCloseTo(0.5, 2);
  });

  it('should increase confidence when combining low confidence evidence', () => {
    // The revision formula cRevised = (c1 + c2) / (1 + c1 + c2)
    // increases confidence when combining low-confidence evidence
    const tv1: TruthValue = { strength: 0.8, confidence: 0.3 };
    const tv2: TruthValue = { strength: 0.8, confidence: 0.3 };

    const result = PLNReasoning.revision(tv1, tv2);

    // cRevised = (0.3 + 0.3) / (1 + 0.3 + 0.3) = 0.6 / 1.6 = 0.375
    // This is greater than the original 0.3
    expect(result.confidence).toBeGreaterThan(tv1.confidence);
    expect(result.confidence).toBeCloseTo(0.375, 2);
  });

  it('should cap confidence at 0.99', () => {
    const tv1: TruthValue = { strength: 0.9, confidence: 0.99 };
    const tv2: TruthValue = { strength: 0.9, confidence: 0.99 };

    const result = PLNReasoning.revision(tv1, tv2);

    expect(result.confidence).toBeLessThanOrEqual(0.99);
  });

  it('should weight by confidence correctly', () => {
    const tv1: TruthValue = { strength: 1.0, confidence: 0.9 };
    const tv2: TruthValue = { strength: 0.0, confidence: 0.1 };

    const result = PLNReasoning.revision(tv1, tv2);

    // High confidence should dominate
    expect(result.strength).toBeGreaterThan(0.8);
  });

  it('should handle equal confidences', () => {
    const tv1: TruthValue = { strength: 1.0, confidence: 0.5 };
    const tv2: TruthValue = { strength: 0.0, confidence: 0.5 };

    const result = PLNReasoning.revision(tv1, tv2);

    // Equal weights should average strength
    expect(result.strength).toBeCloseTo(0.5, 2);
  });
});

// ==================== Similarity Tests ====================

describe('PLNReasoning.similarity', () => {
  it('should calculate similarity based on shared properties', () => {
    const conceptA = createConceptNode('A', 'ConceptA', 0.8, 0.9);
    const conceptB = createConceptNode('B', 'ConceptB', 0.7, 0.8);

    // 5 shared properties out of 10 total
    const result = PLNReasoning.similarity(conceptA, conceptB, 5, 10);

    expect(result.strength).toBe(0.5);
    expect(result.confidence).toBeCloseTo(0.1, 2); // 10/100 = 0.1
  });

  it('should return zero for no shared properties', () => {
    const conceptA = createConceptNode('A', 'ConceptA', 0.8, 0.9);
    const conceptB = createConceptNode('B', 'ConceptB', 0.7, 0.8);

    const result = PLNReasoning.similarity(conceptA, conceptB, 0, 10);

    expect(result.strength).toBe(0);
  });

  it('should return perfect similarity for identical properties', () => {
    const conceptA = createConceptNode('A', 'ConceptA', 0.8, 0.9);
    const conceptB = createConceptNode('B', 'ConceptB', 0.7, 0.8);

    const result = PLNReasoning.similarity(conceptA, conceptB, 10, 10);

    expect(result.strength).toBe(1.0);
  });

  it('should handle zero total properties', () => {
    const conceptA = createConceptNode('A', 'ConceptA', 0.8, 0.9);
    const conceptB = createConceptNode('B', 'ConceptB', 0.7, 0.8);

    const result = PLNReasoning.similarity(conceptA, conceptB, 0, 0);

    expect(result.strength).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('should cap confidence at 0.95', () => {
    const conceptA = createConceptNode('A', 'ConceptA', 0.8, 0.9);
    const conceptB = createConceptNode('B', 'ConceptB', 0.7, 0.8);

    // Large sample size
    const result = PLNReasoning.similarity(conceptA, conceptB, 500, 1000);

    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });
});

// ==================== InheritanceToSimilarity Tests ====================

describe('PLNReasoning.inheritanceToSimilarity', () => {
  it('should convert InheritanceLink to SimilarityLink', () => {
    const inheritance = createInheritanceLink('inh-link', 'A', 'B', 0.8, 0.9);

    const result = PLNReasoning.inheritanceToSimilarity(inheritance);

    expect(result).not.toBeNull();
    expect(result!.rule).toBe('InheritanceToSimilarity');
    expect(result!.conclusion.type).toBe('SimilarityLink');
    expect(result!.conclusion.outgoing).toEqual(['A', 'B']);
  });

  it('should reduce strength by 0.8 factor', () => {
    const inheritance = createInheritanceLink('inh-link', 'A', 'B', 1.0, 0.9);

    const result = PLNReasoning.inheritanceToSimilarity(inheritance);

    expect(result!.truthValue.strength).toBeCloseTo(0.8, 2);
  });

  it('should reduce confidence by 0.9 factor', () => {
    const inheritance = createInheritanceLink('inh-link', 'A', 'B', 0.8, 1.0);

    const result = PLNReasoning.inheritanceToSimilarity(inheritance);

    expect(result!.truthValue.confidence).toBeCloseTo(0.9, 2);
  });

  it('should return null for non-InheritanceLink', () => {
    const implication = createImplicationLink('imp-link', 'A', 'B', 0.8, 0.9);

    const result = PLNReasoning.inheritanceToSimilarity(implication);

    expect(result).toBeNull();
  });

  it('should include original link as premise', () => {
    const inheritance = createInheritanceLink('original-inh-id', 'A', 'B', 0.8, 0.9);

    const result = PLNReasoning.inheritanceToSimilarity(inheritance);

    expect(result!.premises).toContain('original-inh-id');
    expect(result!.premises.length).toBe(1);
  });
});

// ==================== Inference Chain Tests ====================

describe('PLNReasoning.inferenceChain', () => {
  it('should apply multiple inference rules', () => {
    const premises: Atom[] = [
      createImplicationLink('ab', 'A', 'B', 0.9, 0.9),
      createImplicationLink('bc', 'B', 'C', 0.8, 0.8),
      createImplicationLink('cd', 'C', 'D', 0.7, 0.7)
    ];

    const results = PLNReasoning.inferenceChain(premises);

    expect(results.length).toBeGreaterThan(0);
  });

  it('should respect maxDepth parameter', () => {
    const premises: Atom[] = [
      createImplicationLink('ab', 'A', 'B', 0.9, 0.9),
      createImplicationLink('bc', 'B', 'C', 0.8, 0.8)
    ];

    const results1 = PLNReasoning.inferenceChain(premises, 1);
    const results2 = PLNReasoning.inferenceChain(premises, 3);

    // More depth should allow more inferences
    expect(results2.length).toBeGreaterThanOrEqual(results1.length);
  });

  it('should filter out low confidence results (< 0.3)', () => {
    const premises: Atom[] = [
      createImplicationLink('ab', 'A', 'B', 0.1, 0.1),
      createImplicationLink('bc', 'B', 'C', 0.1, 0.1)
    ];

    const results = PLNReasoning.inferenceChain(premises);

    // All results should have confidence > 0.3
    for (const result of results) {
      expect(result.confidence).toBeGreaterThan(0.3);
    }
  });

  it('should handle empty premises', () => {
    const results = PLNReasoning.inferenceChain([]);

    expect(results).toEqual([]);
  });

  it('should handle single premise', () => {
    const premises: Atom[] = [
      createImplicationLink('ab', 'A', 'B', 0.9, 0.9)
    ];

    const results = PLNReasoning.inferenceChain(premises);

    // Single premise cannot produce pairwise inferences
    expect(results).toEqual([]);
  });

  it('should apply deduction, induction, and abduction', () => {
    const premises: Atom[] = [
      createImplicationLink('ab', 'A', 'B', 0.9, 0.9),
      createImplicationLink('bc', 'B', 'C', 0.9, 0.9),
      createImplicationLink('ac', 'A', 'C', 0.9, 0.9)
    ];

    const results = PLNReasoning.inferenceChain(premises, 1);
    const rules = results.map(r => r.rule);

    // Should include at least deduction
    expect(rules).toContain('Deduction');
  });
});

// ==================== Evidence Strength Tests ====================

describe('PLNReasoning.evidenceStrength', () => {
  it('should calculate positive evidence for high strength', () => {
    const tv: TruthValue = { strength: 0.9, confidence: 0.8 };

    const result = PLNReasoning.evidenceStrength(tv);

    // 0.8 * (2 * 0.9 - 1) = 0.8 * 0.8 = 0.64
    expect(result).toBeCloseTo(0.64, 2);
  });

  it('should calculate negative evidence for low strength', () => {
    const tv: TruthValue = { strength: 0.1, confidence: 0.8 };

    const result = PLNReasoning.evidenceStrength(tv);

    // 0.8 * (2 * 0.1 - 1) = 0.8 * -0.8 = -0.64
    expect(result).toBeCloseTo(-0.64, 2);
  });

  it('should return zero for neutral strength (0.5)', () => {
    const tv: TruthValue = { strength: 0.5, confidence: 0.9 };

    const result = PLNReasoning.evidenceStrength(tv);

    // 0.9 * (2 * 0.5 - 1) = 0.9 * 0 = 0
    expect(result).toBe(0);
  });

  it('should scale with confidence', () => {
    const tvLow: TruthValue = { strength: 0.9, confidence: 0.2 };
    const tvHigh: TruthValue = { strength: 0.9, confidence: 0.8 };

    const resultLow = PLNReasoning.evidenceStrength(tvLow);
    const resultHigh = PLNReasoning.evidenceStrength(tvHigh);

    expect(resultHigh).toBeGreaterThan(resultLow);
    expect(resultHigh / resultLow).toBeCloseTo(4, 1); // 0.8 / 0.2 = 4
  });
});

// ==================== isTrue Tests ====================

describe('PLNReasoning.isTrue', () => {
  it('should return true for high strength and confidence', () => {
    const tv: TruthValue = { strength: 0.9, confidence: 0.8 };

    expect(PLNReasoning.isTrue(tv)).toBe(true);
  });

  it('should return false for low strength', () => {
    const tv: TruthValue = { strength: 0.3, confidence: 0.8 };

    expect(PLNReasoning.isTrue(tv)).toBe(false);
  });

  it('should return false for low confidence', () => {
    const tv: TruthValue = { strength: 0.9, confidence: 0.3 };

    expect(PLNReasoning.isTrue(tv)).toBe(false);
  });

  it('should respect custom threshold', () => {
    const tv: TruthValue = { strength: 0.6, confidence: 0.8 };

    expect(PLNReasoning.isTrue(tv, 0.7)).toBe(false);
    expect(PLNReasoning.isTrue(tv, 0.5)).toBe(true);
  });

  it('should return false for exactly threshold strength', () => {
    const tv: TruthValue = { strength: 0.7, confidence: 0.8 };

    expect(PLNReasoning.isTrue(tv, 0.7)).toBe(false);
  });
});

// ==================== isFalse Tests ====================

describe('PLNReasoning.isFalse', () => {
  it('should return true for low strength and high confidence', () => {
    const tv: TruthValue = { strength: 0.1, confidence: 0.8 };

    expect(PLNReasoning.isFalse(tv)).toBe(true);
  });

  it('should return false for high strength', () => {
    const tv: TruthValue = { strength: 0.8, confidence: 0.8 };

    expect(PLNReasoning.isFalse(tv)).toBe(false);
  });

  it('should return false for low confidence', () => {
    const tv: TruthValue = { strength: 0.1, confidence: 0.3 };

    expect(PLNReasoning.isFalse(tv)).toBe(false);
  });

  it('should respect custom threshold', () => {
    const tv: TruthValue = { strength: 0.4, confidence: 0.8 };

    expect(PLNReasoning.isFalse(tv, 0.3)).toBe(false);
    expect(PLNReasoning.isFalse(tv, 0.5)).toBe(true);
  });

  it('should return false for exactly threshold strength', () => {
    const tv: TruthValue = { strength: 0.3, confidence: 0.8 };

    expect(PLNReasoning.isFalse(tv, 0.3)).toBe(false);
  });
});

// ==================== isUncertain Tests ====================

describe('PLNReasoning.isUncertain', () => {
  it('should return true for low confidence', () => {
    const tv: TruthValue = { strength: 0.9, confidence: 0.3 };

    expect(PLNReasoning.isUncertain(tv)).toBe(true);
  });

  it('should return true for middle strength', () => {
    const tv: TruthValue = { strength: 0.5, confidence: 0.8 };

    expect(PLNReasoning.isUncertain(tv)).toBe(true);
  });

  it('should return false for definite true', () => {
    const tv: TruthValue = { strength: 0.9, confidence: 0.8 };

    expect(PLNReasoning.isUncertain(tv)).toBe(false);
  });

  it('should return false for definite false', () => {
    const tv: TruthValue = { strength: 0.1, confidence: 0.8 };

    expect(PLNReasoning.isUncertain(tv)).toBe(false);
  });

  it('should return false for exactly 0.5 confidence with extreme strength', () => {
    // isUncertain uses confidence < 0.5 (not <=)
    // So confidence 0.5 with strength 0.9 (outside 0.3-0.7) is NOT uncertain
    const tv: TruthValue = { strength: 0.9, confidence: 0.5 };

    expect(PLNReasoning.isUncertain(tv)).toBe(false);
  });

  it('should return true for just below 0.5 confidence', () => {
    // Confidence just below 0.5 should trigger uncertainty
    const tv: TruthValue = { strength: 0.9, confidence: 0.49 };

    expect(PLNReasoning.isUncertain(tv)).toBe(true);
  });

  it('should handle boundary values correctly', () => {
    // Strength exactly at 0.3 boundary: 0.3 > 0.3 is FALSE, so not uncertain
    expect(PLNReasoning.isUncertain({ strength: 0.3, confidence: 0.8 })).toBe(false);
    // Strength exactly at 0.7 boundary: 0.7 < 0.7 is FALSE, so not uncertain
    expect(PLNReasoning.isUncertain({ strength: 0.7, confidence: 0.8 })).toBe(false);
    // Just above 0.3: 0.31 > 0.3 is TRUE and 0.31 < 0.7 is TRUE, so uncertain
    expect(PLNReasoning.isUncertain({ strength: 0.31, confidence: 0.8 })).toBe(true);
    // Just below 0.7: 0.69 > 0.3 is TRUE and 0.69 < 0.7 is TRUE, so uncertain
    expect(PLNReasoning.isUncertain({ strength: 0.69, confidence: 0.8 })).toBe(true);
  });
});

// ==================== Integration Tests ====================

describe('PLNReasoning Integration', () => {
  it('should chain deductions correctly', () => {
    // A -> B -> C -> D
    const ab = createImplicationLink('ab', 'A', 'B', 0.9, 0.9);
    const bc = createImplicationLink('bc', 'B', 'C', 0.9, 0.9);
    const cd = createImplicationLink('cd', 'C', 'D', 0.9, 0.9);

    // First deduction: A -> C
    const ac = PLNReasoning.deduction(ab, bc);
    expect(ac).not.toBeNull();

    // Create link from result
    const acLink = ac!.conclusion as Link;
    acLink.id = 'ac';

    // Second deduction: A -> D
    const ad = PLNReasoning.deduction(acLink, cd);
    expect(ad).not.toBeNull();
    expect(ad!.conclusion.outgoing).toEqual(['A', 'D']);

    // Strength should decrease with each step
    expect(ad!.truthValue.strength).toBeLessThan(ac!.truthValue.strength);
  });

  it('should combine revision with inference', () => {
    // Two sources of evidence for same proposition
    const tv1: TruthValue = { strength: 0.8, confidence: 0.6 };
    const tv2: TruthValue = { strength: 0.9, confidence: 0.7 };

    const revised = PLNReasoning.revision(tv1, tv2);

    // Use revised truth value in modus ponens
    const premiseA = createConceptNode('A', 'Revised', revised.strength, revised.confidence);
    const premiseAB = createImplicationLink('ab', 'A', 'B', 0.8, 0.9);

    const result = PLNReasoning.modusPonens(premiseA, premiseAB);

    expect(result).not.toBeNull();
    expect(result!.truthValue.confidence).toBeGreaterThan(0);
  });

  it('should correctly classify truth values', () => {
    const definitelyTrue: TruthValue = { strength: 0.95, confidence: 0.9 };
    const definitelyFalse: TruthValue = { strength: 0.05, confidence: 0.9 };
    const uncertain: TruthValue = { strength: 0.5, confidence: 0.5 };

    expect(PLNReasoning.isTrue(definitelyTrue)).toBe(true);
    expect(PLNReasoning.isFalse(definitelyTrue)).toBe(false);
    expect(PLNReasoning.isUncertain(definitelyTrue)).toBe(false);

    expect(PLNReasoning.isTrue(definitelyFalse)).toBe(false);
    expect(PLNReasoning.isFalse(definitelyFalse)).toBe(true);
    expect(PLNReasoning.isUncertain(definitelyFalse)).toBe(false);

    expect(PLNReasoning.isTrue(uncertain)).toBe(false);
    expect(PLNReasoning.isFalse(uncertain)).toBe(false);
    expect(PLNReasoning.isUncertain(uncertain)).toBe(true);
  });
});
