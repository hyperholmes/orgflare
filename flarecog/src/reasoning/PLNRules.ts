import { TruthValue, Atom, Link } from "../types/cognitive";

/**
 * Probabilistic Logic Networks (PLN) - Inference rules and truth value revision
 *
 * Implements core PLN inference rules for uncertain reasoning:
 * - Deduction
 * - Induction
 * - Abduction
 * - Modus Ponens
 * - Truth value revision
 */

export class PLNRules {
	/**
	 * Deduction Rule: From A->B and B->C, infer A->C
	 *
	 * sAC = sAB * sBC
	 * cAC = cAB * cBC * sBC
	 */
	static deduction(
		tvAB: TruthValue,
		tvBC: TruthValue,
	): TruthValue {
		return {
			strength: tvAB.strength * tvBC.strength,
			confidence: tvAB.confidence * tvBC.confidence * tvBC.strength,
		};
	}

	/**
	 * Induction Rule: From A->B and A->C, infer B->C
	 *
	 * sBC = (sAB * sAC) / sA
	 * cBC = cAB * cAC * sA
	 *
	 * Note: Requires strength of A (sA), using simplified version
	 */
	static induction(
		tvAB: TruthValue,
		tvAC: TruthValue,
		sA: number = 0.8,
	): TruthValue {
		const strength = (tvAB.strength * tvAC.strength) / sA;
		const confidence = tvAB.confidence * tvAC.confidence * sA;

		return {
			strength: Math.min(1.0, Math.max(0.0, strength)),
			confidence: Math.min(1.0, Math.max(0.0, confidence)),
		};
	}

	/**
	 * Abduction Rule: From A->C and B->C, infer A->B
	 *
	 * Similar to induction but reversed
	 * sAB = (sAC * sBC) / sC
	 * cAB = cAC * cBC * sC
	 */
	static abduction(
		tvAC: TruthValue,
		tvBC: TruthValue,
		sC: number = 0.8,
	): TruthValue {
		const strength = (tvAC.strength * tvBC.strength) / sC;
		const confidence = tvAC.confidence * tvBC.confidence * sC;

		return {
			strength: Math.min(1.0, Math.max(0.0, strength)),
			confidence: Math.min(1.0, Math.max(0.0, confidence)),
		};
	}

	/**
	 * Modus Ponens: From A and A->B, infer B
	 *
	 * sB = sA * sAB
	 * cB = cA * cAB * sAB
	 */
	static modusPonens(
		tvA: TruthValue,
		tvAB: TruthValue,
	): TruthValue {
		return {
			strength: tvA.strength * tvAB.strength,
			confidence: tvA.confidence * tvAB.confidence * tvAB.strength,
		};
	}

	/**
	 * Revision Rule: Combine two independent truth value estimates
	 *
	 * Used when multiple sources provide evidence for the same proposition
	 *
	 * w1 = c1 / (1 - c1)
	 * w2 = c2 / (1 - c2)
	 * w = w1 + w2
	 * sR = (w1*s1 + w2*s2) / w
	 * cR = w / (w + 1)
	 */
	static revision(
		tv1: TruthValue,
		tv2: TruthValue,
	): TruthValue {
		// Avoid division by zero
		const epsilon = 0.0001;

		const w1 = tv1.confidence / (1 - tv1.confidence + epsilon);
		const w2 = tv2.confidence / (1 - tv2.confidence + epsilon);
		const w = w1 + w2;

		if (w < epsilon) {
			// If both confidences are near zero, return average
			return {
				strength: (tv1.strength + tv2.strength) / 2,
				confidence: epsilon,
			};
		}

		const strength = (w1 * tv1.strength + w2 * tv2.strength) / w;
		const confidence = w / (w + 1);

		return {
			strength: Math.min(1.0, Math.max(0.0, strength)),
			confidence: Math.min(1.0, Math.max(0.0, confidence)),
		};
	}

	/**
	 * Conjunction: Combine truth values for AND
	 *
	 * sAND = sA * sB
	 * cAND = cA * cB
	 */
	static conjunction(
		tvA: TruthValue,
		tvB: TruthValue,
	): TruthValue {
		return {
			strength: tvA.strength * tvB.strength,
			confidence: tvA.confidence * tvB.confidence,
		};
	}

	/**
	 * Disjunction: Combine truth values for OR
	 *
	 * sOR = sA + sB - sA*sB
	 * cOR = cA * cB
	 */
	static disjunction(
		tvA: TruthValue,
		tvB: TruthValue,
	): TruthValue {
		return {
			strength: tvA.strength + tvB.strength - tvA.strength * tvB.strength,
			confidence: tvA.confidence * tvB.confidence,
		};
	}

	/**
	 * Negation: Invert truth value
	 *
	 * sNOT = 1 - s
	 * cNOT = c
	 */
	static negation(tv: TruthValue): TruthValue {
		return {
			strength: 1 - tv.strength,
			confidence: tv.confidence,
		};
	}

	/**
	 * Similarity: Measure similarity between two concepts
	 *
	 * Based on shared properties and inheritance
	 * sSIM = (shared / (total_A + total_B - shared))
	 */
	static similarity(
		tvAB: TruthValue,
		tvBA: TruthValue,
	): TruthValue {
		// Geometric mean of bidirectional implications
		const strength = Math.sqrt(tvAB.strength * tvBA.strength);
		const confidence = Math.min(tvAB.confidence, tvBA.confidence);

		return { strength, confidence };
	}

	/**
	 * Intensional Inheritance: A inherits from B based on properties
	 *
	 * More sophisticated than simple inheritance
	 */
	static intensionalInheritance(
		sharedProperties: number,
		totalPropertiesA: number,
		totalPropertiesB: number,
		confidence: number,
	): TruthValue {
		if (totalPropertiesA === 0) {
			return { strength: 0, confidence: 0 };
		}

		const strength = sharedProperties / totalPropertiesA;

		return {
			strength: Math.min(1.0, Math.max(0.0, strength)),
			confidence: Math.min(1.0, Math.max(0.0, confidence)),
		};
	}

	/**
	 * Extensional Inheritance: A inherits from B based on instances
	 *
	 * Based on set membership
	 */
	static extensionalInheritance(
		instancesA: number,
		instancesB: number,
		sharedInstances: number,
		confidence: number,
	): TruthValue {
		if (instancesA === 0) {
			return { strength: 0, confidence: 0 };
		}

		const strength = sharedInstances / instancesA;

		return {
			strength: Math.min(1.0, Math.max(0.0, strength)),
			confidence: Math.min(1.0, Math.max(0.0, confidence)),
		};
	}

	/**
	 * Bayes Rule: Update belief based on evidence
	 *
	 * P(H|E) = P(E|H) * P(H) / P(E)
	 */
	static bayes(
		priorH: TruthValue,
		likelihoodEgivenH: TruthValue,
		priorE: TruthValue,
	): TruthValue {
		const epsilon = 0.0001;

		if (priorE.strength < epsilon) {
			return priorH;
		}

		const posteriorStrength =
			(likelihoodEgivenH.strength * priorH.strength) / priorE.strength;

		// Confidence increases with evidence
		const posteriorConfidence = Math.min(
			1.0,
			priorH.confidence + likelihoodEgivenH.confidence * 0.1,
		);

		return {
			strength: Math.min(1.0, Math.max(0.0, posteriorStrength)),
			confidence: posteriorConfidence,
		};
	}

	/**
	 * Temporal Decay: Reduce confidence over time
	 *
	 * Used for forgetting and attention decay
	 */
	static temporalDecay(
		tv: TruthValue,
		timeElapsed: number,
		decayRate: number = 0.001,
	): TruthValue {
		const decayFactor = Math.exp(-decayRate * timeElapsed);

		return {
			strength: tv.strength,
			confidence: tv.confidence * decayFactor,
		};
	}

	/**
	 * Evidence Weight: Calculate weight of evidence
	 *
	 * Used in revision and other combining operations
	 */
	static evidenceWeight(tv: TruthValue): number {
		const epsilon = 0.0001;
		return tv.confidence / (1 - tv.confidence + epsilon);
	}

	/**
	 * Confidence to Count: Convert confidence to evidence count
	 *
	 * Useful for understanding how much evidence supports a belief
	 */
	static confidenceToCount(
		confidence: number,
		k: number = 1.0,
	): number {
		const epsilon = 0.0001;
		return (k * confidence) / (1 - confidence + epsilon);
	}

	/**
	 * Count to Confidence: Convert evidence count to confidence
	 *
	 * Inverse of confidenceToCount
	 */
	static countToConfidence(
		count: number,
		k: number = 1.0,
	): number {
		return count / (count + k);
	}

	/**
	 * Simple Truth Value: Create a simple truth value
	 *
	 * Convenience method for common cases
	 */
	static simpleTruthValue(
		strength: number,
		count: number,
		k: number = 1.0,
	): TruthValue {
		return {
			strength: Math.min(1.0, Math.max(0.0, strength)),
			confidence: this.countToConfidence(count, k),
		};
	}

	/**
	 * Expectation: Calculate expected value
	 *
	 * E = s * c + (1 - c) * 0.5
	 *
	 * Represents the expected probability considering uncertainty
	 */
	static expectation(tv: TruthValue): number {
		return tv.strength * tv.confidence + (1 - tv.confidence) * 0.5;
	}

	/**
	 * Compare truth values for decision making
	 *
	 * Returns -1 if tv1 < tv2, 0 if equal, 1 if tv1 > tv2
	 */
	static compare(tv1: TruthValue, tv2: TruthValue): number {
		const exp1 = this.expectation(tv1);
		const exp2 = this.expectation(tv2);

		if (Math.abs(exp1 - exp2) < 0.001) {
			// If expectations are similar, prefer higher confidence
			if (tv1.confidence > tv2.confidence) return 1;
			if (tv1.confidence < tv2.confidence) return -1;
			return 0;
		}

		return exp1 > exp2 ? 1 : -1;
	}

	/**
	 * Is truth value significant?
	 *
	 * Checks if the truth value has enough strength and confidence
	 * to be considered meaningful
	 */
	static isSignificant(
		tv: TruthValue,
		minStrength: number = 0.5,
		minConfidence: number = 0.3,
	): boolean {
		return tv.strength >= minStrength && tv.confidence >= minConfidence;
	}

	/**
	 * Normalize truth value
	 *
	 * Ensures values are within valid range [0, 1]
	 */
	static normalize(tv: TruthValue): TruthValue {
		return {
			strength: Math.min(1.0, Math.max(0.0, tv.strength)),
			confidence: Math.min(1.0, Math.max(0.0, tv.confidence)),
		};
	}
}

/**
 * Inference Chain - Sequence of inference rules
 */
export interface InferenceStep {
	rule: string;
	premises: string[]; // Atom IDs
	conclusion: string; // Atom ID
	truthValue: TruthValue;
	timestamp: number;
}

export class InferenceChain {
	steps: InferenceStep[] = [];

	addStep(step: InferenceStep): void {
		this.steps.push(step);
	}

	getConclusion(): InferenceStep | undefined {
		return this.steps[this.steps.length - 1];
	}

	getTruthValue(): TruthValue | undefined {
		return this.getConclusion()?.truthValue;
	}

	getLength(): number {
		return this.steps.length;
	}

	/**
	 * Calculate overall confidence of the chain
	 * Confidence decreases with chain length
	 */
	getChainConfidence(): number {
		if (this.steps.length === 0) return 0;

		// Multiply confidences of all steps
		let confidence = 1.0;
		for (const step of this.steps) {
			confidence *= step.truthValue.confidence;
		}

		return confidence;
	}
}
