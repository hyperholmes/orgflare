/**
 * PLN (Probabilistic Logic Networks) Reasoning Module
 * 
 * Implements core PLN inference rules for uncertain reasoning in the AtomSpace.
 * Based on OpenCog's PLN framework for handling probabilistic truth values.
 */

import { Atom, Link, TruthValue, AttentionValue } from "../types/cognitive";

/**
 * PLN inference rule types
 */
export type PLNRuleType =
	| "Deduction"
	| "Induction"
	| "Abduction"
	| "ModusPonens"
	| "Revision"
	| "Similarity"
	| "InheritanceToSimilarity"
	| "SimilarityToInheritance";

/**
 * Result of a PLN inference operation
 */
export interface PLNInferenceResult {
	conclusion: Atom;
	rule: PLNRuleType;
	premises: string[]; // IDs of premise atoms
	truthValue: TruthValue;
	confidence: number;
}

/**
 * PLN Reasoning Engine
 */
export class PLNReasoning {
	/**
	 * Deduction Rule: (A->B, B->C) => (A->C)
	 * 
	 * If A implies B with strength sAB and confidence cAB,
	 * and B implies C with strength sBC and confidence cBC,
	 * then A implies C with computed strength and confidence.
	 */
	static deduction(
		premiseAB: Link,
		premiseBC: Link,
	): PLNInferenceResult | null {
		// Validate that premises are ImplicationLinks
		if (
			premiseAB.type !== "ImplicationLink" ||
			premiseBC.type !== "ImplicationLink"
		) {
			return null;
		}

		// Check that B is shared between premises
		const [A, B1] = premiseAB.outgoing;
		const [B2, C] = premiseBC.outgoing;

		if (B1 !== B2) {
			return null;
		}

		// Calculate conclusion truth value using PLN deduction formula
		const sAB = premiseAB.truthValue.strength;
		const cAB = premiseAB.truthValue.confidence;
		const sBC = premiseBC.truthValue.strength;
		const cBC = premiseBC.truthValue.confidence;

		// PLN deduction strength: sAC = sAB * sBC
		const sAC = sAB * sBC;

		// PLN deduction confidence: cAC = cAB * cBC * sAB
		const cAC = cAB * cBC * sAB;

		return {
			conclusion: {
				id: "", // Will be assigned when created
				type: "ImplicationLink",
				outgoing: [A, C],
				truthValue: { strength: sAC, confidence: cAC },
				attentionValue: { sti: 0, lti: 0, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			} as Link,
			rule: "Deduction",
			premises: [premiseAB.id, premiseBC.id],
			truthValue: { strength: sAC, confidence: cAC },
			confidence: cAC,
		};
	}

	/**
	 * Induction Rule: (A->B, A->C) => (B->C)
	 * 
	 * Generalization from specific instances.
	 */
	static induction(premiseAB: Link, premiseAC: Link): PLNInferenceResult | null {
		if (
			premiseAB.type !== "ImplicationLink" ||
			premiseAC.type !== "ImplicationLink"
		) {
			return null;
		}

		const [A1, B] = premiseAB.outgoing;
		const [A2, C] = premiseAC.outgoing;

		if (A1 !== A2) {
			return null;
		}

		const sAB = premiseAB.truthValue.strength;
		const cAB = premiseAB.truthValue.confidence;
		const sAC = premiseAC.truthValue.strength;
		const cAC = premiseAC.truthValue.confidence;

		// Induction strength: sBC = sAB * sAC
		const sBC = sAB * sAC;

		// Induction confidence: lower than deduction due to generalization
		const cBC = Math.min(cAB, cAC) * 0.8;

		return {
			conclusion: {
				id: "",
				type: "ImplicationLink",
				outgoing: [B, C],
				truthValue: { strength: sBC, confidence: cBC },
				attentionValue: { sti: 0, lti: 0, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			} as Link,
			rule: "Induction",
			premises: [premiseAB.id, premiseAC.id],
			truthValue: { strength: sBC, confidence: cBC },
			confidence: cBC,
		};
	}

	/**
	 * Abduction Rule: (B->C, A->C) => (A->B)
	 * 
	 * Hypothesis formation from observations.
	 */
	static abduction(premiseBC: Link, premiseAC: Link): PLNInferenceResult | null {
		if (
			premiseBC.type !== "ImplicationLink" ||
			premiseAC.type !== "ImplicationLink"
		) {
			return null;
		}

		const [B, C1] = premiseBC.outgoing;
		const [A, C2] = premiseAC.outgoing;

		if (C1 !== C2) {
			return null;
		}

		const sBC = premiseBC.truthValue.strength;
		const cBC = premiseBC.truthValue.confidence;
		const sAC = premiseAC.truthValue.strength;
		const cAC = premiseAC.truthValue.confidence;

		// Abduction strength
		const sAB = sBC * sAC;

		// Abduction confidence: lowest due to hypothesis nature
		const cAB = Math.min(cBC, cAC) * 0.6;

		return {
			conclusion: {
				id: "",
				type: "ImplicationLink",
				outgoing: [A, B],
				truthValue: { strength: sAB, confidence: cAB },
				attentionValue: { sti: 0, lti: 0, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			} as Link,
			rule: "Abduction",
			premises: [premiseBC.id, premiseAC.id],
			truthValue: { strength: sAB, confidence: cAB },
			confidence: cAB,
		};
	}

	/**
	 * Modus Ponens: (A, A->B) => B
	 * 
	 * If A is true and A implies B, then B is true.
	 */
	static modusPonens(
		premiseA: Atom,
		premiseAB: Link,
	): PLNInferenceResult | null {
		if (premiseAB.type !== "ImplicationLink") {
			return null;
		}

		const [A, B] = premiseAB.outgoing;

		if (A !== premiseA.id) {
			return null;
		}

		const sA = premiseA.truthValue.strength;
		const cA = premiseA.truthValue.confidence;
		const sAB = premiseAB.truthValue.strength;
		const cAB = premiseAB.truthValue.confidence;

		// Modus Ponens strength: sB = sA * sAB
		const sB = sA * sAB;

		// Modus Ponens confidence
		const cB = cA * cAB;

		return {
			conclusion: {
				id: B,
				type: "ConceptNode",
				name: "inferred_concept",
				truthValue: { strength: sB, confidence: cB },
				attentionValue: { sti: 100, lti: 50, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			},
			rule: "ModusPonens",
			premises: [premiseA.id, premiseAB.id],
			truthValue: { strength: sB, confidence: cB },
			confidence: cB,
		};
	}

	/**
	 * Revision Rule: Combine two truth values for the same atom
	 * 
	 * Used when multiple sources provide evidence for the same proposition.
	 */
	static revision(tv1: TruthValue, tv2: TruthValue): TruthValue {
		const s1 = tv1.strength;
		const c1 = tv1.confidence;
		const s2 = tv2.strength;
		const c2 = tv2.confidence;

		// Weight by confidence
		const w1 = c1 / (c1 + c2);
		const w2 = c2 / (c1 + c2);

		// Revised strength: weighted average
		const sRevised = w1 * s1 + w2 * s2;

		// Revised confidence: increases with more evidence
		const cRevised = (c1 + c2) / (1 + c1 + c2);

		return {
			strength: sRevised,
			confidence: Math.min(cRevised, 0.99), // Cap at 0.99
		};
	}

	/**
	 * Similarity calculation between two concepts
	 * 
	 * Based on shared properties and relationships.
	 */
	static similarity(
		conceptA: Atom,
		conceptB: Atom,
		sharedProperties: number,
		totalProperties: number,
	): TruthValue {
		if (totalProperties === 0) {
			return { strength: 0.0, confidence: 0.0 };
		}

		// Jaccard similarity coefficient
		const strength = sharedProperties / totalProperties;

		// Confidence based on sample size
		const confidence = Math.min(totalProperties / 100, 0.95);

		return { strength, confidence };
	}

	/**
	 * Convert InheritanceLink to SimilarityLink
	 * 
	 * (Inheritance A B) with high strength suggests (Similarity A B)
	 */
	static inheritanceToSimilarity(inheritance: Link): PLNInferenceResult | null {
		if (inheritance.type !== "InheritanceLink") {
			return null;
		}

		const [A, B] = inheritance.outgoing;
		const s = inheritance.truthValue.strength;
		const c = inheritance.truthValue.confidence;

		// Similarity strength is related to inheritance strength
		const sSim = s * 0.8; // Slightly lower due to asymmetry

		// Confidence remains similar
		const cSim = c * 0.9;

		return {
			conclusion: {
				id: "",
				type: "SimilarityLink",
				outgoing: [A, B],
				truthValue: { strength: sSim, confidence: cSim },
				attentionValue: { sti: 0, lti: 0, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			} as Link,
			rule: "InheritanceToSimilarity",
			premises: [inheritance.id],
			truthValue: { strength: sSim, confidence: cSim },
			confidence: cSim,
		};
	}

	/**
	 * Apply a chain of inference rules
	 * 
	 * Attempts to derive new knowledge through multiple inference steps.
	 */
	static inferenceChain(
		premises: Atom[],
		maxDepth: number = 3,
	): PLNInferenceResult[] {
		const results: PLNInferenceResult[] = [];
		const processed = new Set<string>();

		const applyRules = (atoms: Atom[], depth: number) => {
			if (depth >= maxDepth) return;

			// Try all pairwise combinations
			for (let i = 0; i < atoms.length; i++) {
				for (let j = i + 1; j < atoms.length; j++) {
					const a1 = atoms[i];
					const a2 = atoms[j];

					// Skip if already processed this pair
					const pairKey = `${a1.id}-${a2.id}`;
					if (processed.has(pairKey)) continue;
					processed.add(pairKey);

					// Try deduction
					if (
						a1.type === "ImplicationLink" &&
						a2.type === "ImplicationLink"
					) {
						const deductionResult = PLNReasoning.deduction(
							a1 as Link,
							a2 as Link,
						);
						if (
							deductionResult &&
							deductionResult.confidence > 0.3
						) {
							results.push(deductionResult);
							applyRules([...atoms, deductionResult.conclusion], depth + 1);
						}

						// Try induction
						const inductionResult = PLNReasoning.induction(
							a1 as Link,
							a2 as Link,
						);
						if (
							inductionResult &&
							inductionResult.confidence > 0.3
						) {
							results.push(inductionResult);
						}

						// Try abduction
						const abductionResult = PLNReasoning.abduction(
							a1 as Link,
							a2 as Link,
						);
						if (
							abductionResult &&
							abductionResult.confidence > 0.3
						) {
							results.push(abductionResult);
						}
					}
				}
			}
		};

		applyRules(premises, 0);
		return results;
	}

	/**
	 * Calculate the strength of evidence for a truth value
	 */
	static evidenceStrength(tv: TruthValue): number {
		// Weight of evidence formula
		return tv.confidence * (2 * tv.strength - 1);
	}

	/**
	 * Determine if a truth value represents "true" knowledge
	 */
	static isTrue(tv: TruthValue, threshold: number = 0.7): boolean {
		return tv.strength > threshold && tv.confidence > 0.5;
	}

	/**
	 * Determine if a truth value represents "false" knowledge
	 */
	static isFalse(tv: TruthValue, threshold: number = 0.3): boolean {
		return tv.strength < threshold && tv.confidence > 0.5;
	}

	/**
	 * Determine if a truth value is uncertain
	 */
	static isUncertain(tv: TruthValue): boolean {
		return tv.confidence < 0.5 || (tv.strength > 0.3 && tv.strength < 0.7);
	}
}
