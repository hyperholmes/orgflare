/**
 * Relevance Realization Engine
 * 
 * Implements John Vervaeke's concept of Relevance Realization - the core cognitive
 * process that determines what matters in a given context. This is the bridge between
 * OpenCog's symbolic reasoning and CloudFlare AI's neural processing for achieving
 * "Optimal Grip" on cognitive problems.
 * 
 * Relevance Realization is the process by which cognitive systems:
 * 1. Filter vast information spaces to find what's relevant
 * 2. Balance between exploration (novelty) and exploitation (familiarity)
 * 3. Achieve optimal grip - the right level of abstraction and specificity
 * 4. Realize affordances - action possibilities in the environment
 * 5. Maintain cognitive flexibility while avoiding combinatorial explosion
 */

import { Env, Atom, Node, Link, TruthValue, AttentionValue } from "../types/cognitive";

/**
 * Relevance Context - The cognitive situation in which relevance is assessed
 */
export interface RelevanceContext {
	currentGoals: string[];
	attentionFocus: string[];
	recentInferences: Atom[];
	environmentalCues: string[];
	cognitiveLoad: number; // 0-1, higher means more constrained
	explorationBias: number; // 0-1, higher favors novelty over familiarity
}

/**
 * Relevance Assessment for an individual atom
 */
export interface RelevanceAssessment {
	atomId: string;
	relevanceScore: number; // 0-1, overall relevance
	salience: number; // Attention-weighted relevance
	affordances: string[]; // Possible actions
	contextualFit: number; // How well it fits current context
	novelty: number; // How new/unexpected it is
	optimalGrip: number; // Balance between precision and flexibility
}

/**
 * Optimal Grip Assessment - Balance between different cognitive modes
 */
export interface OptimalGripAssessment {
	abstractionLevel: number; // 0 (concrete) to 1 (abstract)
	precisionScore: number; // Symbolic precision
	flexibilityScore: number; // Neural flexibility
	gripQuality: number; // Overall grip quality
	recommendation: string; // Suggested cognitive strategy
}

/**
 * Affordance - Action possibility in the cognitive environment
 */
export interface Affordance {
	action: string;
	atom: Atom;
	feasibility: number;
	expectedUtility: number;
	novelty: number;
}

/**
 * Relevance Realization Engine
 * 
 * Core engine for determining what matters in cognitive processing.
 * Integrates OpenCog's symbolic AtomSpace with CloudFlare AI's neural processing.
 */
export class RelevanceRealizationEngine {
	constructor(private env: Env) {}

	/**
	 * Realize Relevance: Determine what atoms are relevant in the current context
	 * 
	 * This is the core cognitive function that filters the vast space of possible
	 * atoms to focus on what actually matters for current goals and context.
	 */
	async realizeRelevance(
		atoms: Atom[],
		context: RelevanceContext
	): Promise<RelevanceAssessment[]> {
		const assessments: RelevanceAssessment[] = [];

		for (const atom of atoms) {
			// Multi-dimensional relevance assessment
			const symbolicRelevance = this.assessSymbolicRelevance(atom, context);
			const neuralRelevance = await this.assessNeuralRelevance(atom, context);
			const contextualFit = this.assessContextualFit(atom, context);
			const novelty = this.assessNovelty(atom, context);

			// Integrate relevance dimensions
			const relevanceScore = this.integrateRelevanceDimensions(
				symbolicRelevance,
				neuralRelevance,
				contextualFit,
				novelty,
				context
			);

			// Calculate salience (attention-weighted relevance)
			const salience = this.calculateSalience(atom, relevanceScore);

			// Identify affordances
			const affordances = await this.identifyAffordances(atom, context);

			// Assess optimal grip
			const optimalGrip = await this.assessOptimalGrip(
				atom,
				symbolicRelevance,
				neuralRelevance
			);

			assessments.push({
				atomId: atom.id,
				relevanceScore,
				salience,
				affordances: affordances.map((a) => a.action),
				contextualFit,
				novelty,
				optimalGrip,
			});
		}

		// Sort by relevance score
		return assessments.sort((a, b) => b.relevanceScore - a.relevanceScore);
	}

	/**
	 * Achieve Optimal Grip: Find the right balance between precision and flexibility
	 * 
	 * Optimal grip is the cognitive state where we're neither too abstract (losing
	 * precision) nor too concrete (losing flexibility). It's the sweet spot for
	 * effective problem-solving.
	 */
	async achieveOptimalGrip(
		atoms: Atom[],
		context: RelevanceContext
	): Promise<OptimalGripAssessment> {
		// Assess current abstraction level
		const abstractionLevel = this.assessAbstractionLevel(atoms);

		// Assess symbolic precision (OpenCog truth values, logical coherence)
		const precisionScore = this.assessSymbolicPrecision(atoms);

		// Assess neural flexibility (semantic similarity, generalization)
		const flexibilityScore = await this.assessNeuralFlexibility(atoms);

		// Calculate grip quality (balance between precision and flexibility)
		const gripQuality = this.calculateGripQuality(
			precisionScore,
			flexibilityScore,
			context
		);

		// Generate recommendation
		const recommendation = this.generateGripRecommendation(
			abstractionLevel,
			precisionScore,
			flexibilityScore,
			gripQuality,
			context
		);

		return {
			abstractionLevel,
			precisionScore,
			flexibilityScore,
			gripQuality,
			recommendation,
		};
	}

	/**
	 * Discover Affordances: Identify action possibilities
	 * 
	 * Affordances are the action possibilities that the environment (or cognitive
	 * state) offers. This function uses both symbolic reasoning and neural
	 * understanding to identify what can be done.
	 */
	async discoverAffordances(
		atoms: Atom[],
		context: RelevanceContext
	): Promise<Affordance[]> {
		const affordances: Affordance[] = [];

		for (const atom of atoms) {
			const atomAffordances = await this.identifyAffordances(atom, context);
			affordances.push(...atomAffordances);
		}

		// Sort by expected utility
		return affordances.sort((a, b) => b.expectedUtility - a.expectedUtility);
	}

	/**
	 * Assess symbolic relevance using OpenCog attention and truth values
	 */
	private assessSymbolicRelevance(atom: Atom, context: RelevanceContext): number {
		let relevance = 0;

		// Short-term importance (STI) - immediate relevance
		const stiScore = atom.attentionValue.sti / 100;
		relevance += stiScore * 0.4;

		// Long-term importance (LTI) - historical relevance
		const ltiScore = atom.attentionValue.lti / 100;
		relevance += ltiScore * 0.2;

		// Truth value confidence - epistemic certainty
		relevance += atom.truthValue.confidence * 0.2;

		// Goal alignment - teleological relevance
		if ("name" in atom) {
			const goalAlignment = context.currentGoals.some((goal) =>
				atom.name.toLowerCase().includes(goal.toLowerCase())
			);
			if (goalAlignment) relevance += 0.2;
		}

		return Math.min(relevance, 1.0);
	}

	/**
	 * Assess neural relevance using CloudFlare AI embeddings
	 */
	private async assessNeuralRelevance(
		atom: Atom,
		context: RelevanceContext
	): Promise<number> {
		if (context.attentionFocus.length === 0) return 0;

		const atomText = this.atomToText(atom);
		const atomEmbedding = await this.generateEmbedding(atomText);

		// Calculate semantic similarity to attention focus
		let maxSimilarity = 0;
		for (const focus of context.attentionFocus) {
			const focusEmbedding = await this.generateEmbedding(focus);
			const similarity = this.cosineSimilarity(atomEmbedding, focusEmbedding);
			maxSimilarity = Math.max(maxSimilarity, similarity);
		}

		return maxSimilarity;
	}

	/**
	 * Assess contextual fit - how well the atom fits the current cognitive context
	 */
	private assessContextualFit(atom: Atom, context: RelevanceContext): number {
		let fit = 0;

		// Recent inference participation
		const inRecentInferences = context.recentInferences.some((a) => a.id === atom.id);
		if (inRecentInferences) fit += 0.3;

		// Cognitive load compatibility
		// High cognitive load favors familiar, low-complexity atoms
		const complexityScore = this.estimateAtomComplexity(atom);
		const loadCompatibility = 1 - Math.abs(context.cognitiveLoad - complexityScore);
		fit += loadCompatibility * 0.4;

		// Environmental cue alignment
		if ("name" in atom) {
			const cueAlignment = context.environmentalCues.some((cue) =>
				atom.name.toLowerCase().includes(cue.toLowerCase())
			);
			if (cueAlignment) fit += 0.3;
		}

		return Math.min(fit, 1.0);
	}

	/**
	 * Assess novelty - how new or unexpected the atom is
	 */
	private assessNovelty(atom: Atom, context: RelevanceContext): number {
		// Novelty is inversely related to LTI (long-term importance)
		const familiarityScore = atom.attentionValue.lti / 100;
		let noveltyScore = 1 - familiarityScore;

		// Reduce novelty if in recent inferences (recently seen)
		const inRecentInferences = context.recentInferences.some((a) => a.id === atom.id);
		if (inRecentInferences) noveltyScore *= 0.5;

		// Truth value strength affects novelty
		// Low strength = uncertain/novel, high strength = established/familiar
		const uncertaintyBoost = 1 - atom.truthValue.strength;
		noveltyScore += uncertaintyBoost * 0.2;

		return Math.min(noveltyScore, 1.0);
	}

	/**
	 * Integrate multiple relevance dimensions into a single score
	 */
	private integrateRelevanceDimensions(
		symbolic: number,
		neural: number,
		contextual: number,
		novelty: number,
		context: RelevanceContext
	): number {
		// Base integration: weighted average
		let relevance = symbolic * 0.3 + neural * 0.3 + contextual * 0.3;

		// Modulate by exploration bias
		// High exploration bias increases weight of novelty
		const noveltyWeight = context.explorationBias * 0.3;
		const familiarityWeight = (1 - context.explorationBias) * 0.1;

		relevance = relevance * (1 - noveltyWeight) + novelty * noveltyWeight;

		return Math.min(relevance, 1.0);
	}

	/**
	 * Calculate salience (attention-weighted relevance)
	 */
	private calculateSalience(atom: Atom, relevanceScore: number): number {
		const attentionWeight = atom.attentionValue.sti / 100;
		return relevanceScore * attentionWeight;
	}

	/**
	 * Identify affordances for an atom
	 */
	private async identifyAffordances(
		atom: Atom,
		context: RelevanceContext
	): Promise<Affordance[]> {
		const atomText = this.atomToText(atom);

		const prompt = `Given the concept "${atomText}" in a cognitive architecture context, identify 3-5 possible actions or affordances (what can be done with this concept).

Context goals: ${context.currentGoals.join(", ")}
Current focus: ${context.attentionFocus.join(", ")}

For each affordance, provide:
1. Action description
2. Feasibility (0-1)
3. Expected utility (0-1)
4. Novelty (0-1)

Respond in JSON format as an array of objects.`;

		try {
			const response = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
				messages: [
					{
						role: "system",
						content: "You are an AGI affordance detection system.",
					},
					{
						role: "user",
						content: prompt,
					},
				],
				temperature: 0.7,
				max_tokens: 400,
			});

			const affordancesData = JSON.parse(response.response || "[]");

			return affordancesData.map((data: any) => ({
				action: data.action || data.description || "unknown",
				atom,
				feasibility: data.feasibility || 0.5,
				expectedUtility: data.utility || data.expectedUtility || 0.5,
				novelty: data.novelty || 0.5,
			}));
		} catch (error) {
			// Fallback: Generate simple affordances based on atom type
			return this.generateFallbackAffordances(atom);
		}
	}

	/**
	 * Generate fallback affordances when AI fails
	 */
	private generateFallbackAffordances(atom: Atom): Affordance[] {
		const affordances: Affordance[] = [];

		if (atom.type === "ConceptNode") {
			affordances.push({
				action: "Reason about concept",
				atom,
				feasibility: 0.8,
				expectedUtility: 0.6,
				novelty: 0.3,
			});
			affordances.push({
				action: "Find similar concepts",
				atom,
				feasibility: 0.7,
				expectedUtility: 0.5,
				novelty: 0.5,
			});
		} else if (atom.type.includes("Link")) {
			affordances.push({
				action: "Traverse relationship",
				atom,
				feasibility: 0.9,
				expectedUtility: 0.7,
				novelty: 0.2,
			});
			affordances.push({
				action: "Infer new relationships",
				atom,
				feasibility: 0.6,
				expectedUtility: 0.8,
				novelty: 0.7,
			});
		}

		return affordances;
	}

	/**
	 * Assess optimal grip for an atom
	 */
	private async assessOptimalGrip(
		atom: Atom,
		symbolicRelevance: number,
		neuralRelevance: number
	): Promise<number> {
		// Optimal grip is achieved when symbolic and neural components are balanced
		const balance = 1 - Math.abs(symbolicRelevance - neuralRelevance);

		// High confidence in both components increases grip
		const confidence = (symbolicRelevance + neuralRelevance) / 2;

		return balance * confidence;
	}

	/**
	 * Assess abstraction level of atoms
	 */
	private assessAbstractionLevel(atoms: Atom[]): number {
		// Higher-order links indicate more abstraction
		const linkCount = atoms.filter((a) => a.type.includes("Link")).length;
		const nodeCount = atoms.filter((a) => a.type.includes("Node")).length;

		if (nodeCount === 0) return 1.0;

		return linkCount / (linkCount + nodeCount);
	}

	/**
	 * Assess symbolic precision
	 */
	private assessSymbolicPrecision(atoms: Atom[]): number {
		// High truth value confidence indicates precision
		const avgConfidence =
			atoms.reduce((sum, a) => sum + a.truthValue.confidence, 0) / atoms.length;

		return avgConfidence;
	}

	/**
	 * Assess neural flexibility
	 */
	private async assessNeuralFlexibility(atoms: Atom[]): Promise<number> {
		if (atoms.length < 2) return 0.5;

		// Generate embeddings for sample atoms
		const sampleAtoms = atoms.slice(0, Math.min(10, atoms.length));
		const embeddings = await Promise.all(
			sampleAtoms.map((a) => this.generateEmbedding(this.atomToText(a)))
		);

		// Calculate average pairwise similarity
		let totalSimilarity = 0;
		let pairCount = 0;

		for (let i = 0; i < embeddings.length; i++) {
			for (let j = i + 1; j < embeddings.length; j++) {
				totalSimilarity += this.cosineSimilarity(embeddings[i], embeddings[j]);
				pairCount++;
			}
		}

		const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0.5;

		// Flexibility is inversely related to similarity (diverse = flexible)
		return 1 - avgSimilarity;
	}

	/**
	 * Calculate grip quality
	 */
	private calculateGripQuality(
		precision: number,
		flexibility: number,
		context: RelevanceContext
	): number {
		// Optimal grip balances precision and flexibility
		const balance = 1 - Math.abs(precision - flexibility);

		// Adjust for cognitive load
		// High load favors precision, low load favors flexibility
		const loadAdjustment = context.cognitiveLoad * precision + (1 - context.cognitiveLoad) * flexibility;

		return (balance + loadAdjustment) / 2;
	}

	/**
	 * Generate grip recommendation
	 */
	private generateGripRecommendation(
		abstraction: number,
		precision: number,
		flexibility: number,
		quality: number,
		context: RelevanceContext
	): string {
		if (quality > 0.7) {
			return "Optimal grip achieved. Continue current cognitive strategy.";
		}

		if (precision > flexibility + 0.3) {
			return "Too much precision, not enough flexibility. Consider more abstract reasoning or neural processing.";
		}

		if (flexibility > precision + 0.3) {
			return "Too much flexibility, not enough precision. Consider more symbolic reasoning or logical constraints.";
		}

		if (abstraction > 0.7 && context.cognitiveLoad > 0.7) {
			return "High abstraction with high cognitive load. Consider grounding in concrete examples.";
		}

		if (abstraction < 0.3 && context.explorationBias > 0.7) {
			return "Low abstraction with high exploration bias. Consider more abstract patterns.";
		}

		return "Grip quality suboptimal. Balance symbolic and neural processing.";
	}

	/**
	 * Estimate atom complexity
	 */
	private estimateAtomComplexity(atom: Atom): number {
		// Links are more complex than nodes
		if (atom.type.includes("Link")) {
			const link = atom as Link;
			const outgoingCount = link.outgoing?.length || 0;
			return Math.min(0.5 + outgoingCount * 0.1, 1.0);
		}

		// Nodes are simpler
		return 0.3;
	}

	/**
	 * Generate embedding for text
	 */
	private async generateEmbedding(text: string): Promise<number[]> {
		try {
			const response = await this.env.AI.run("@cf/baai/bge-base-en-v1.5", {
				text: [text],
			});
			return response.data[0];
		} catch (error) {
			console.error("Embedding generation failed:", error);
			return new Array(768).fill(0);
		}
	}

	/**
	 * Calculate cosine similarity
	 */
	private cosineSimilarity(vec1: number[], vec2: number[]): number {
		if (vec1.length !== vec2.length) return 0;

		let dotProduct = 0;
		let norm1 = 0;
		let norm2 = 0;

		for (let i = 0; i < vec1.length; i++) {
			dotProduct += vec1[i] * vec2[i];
			norm1 += vec1[i] * vec1[i];
			norm2 += vec2[i] * vec2[i];
		}

		norm1 = Math.sqrt(norm1);
		norm2 = Math.sqrt(norm2);

		if (norm1 === 0 || norm2 === 0) return 0;

		return dotProduct / (norm1 * norm2);
	}

	/**
	 * Convert atom to text
	 */
	private atomToText(atom: Atom): string {
		if ("name" in atom) {
			return `${atom.type}(${atom.name})`;
		}
		if ("outgoing" in atom && atom.outgoing) {
			return `${atom.type}(${atom.outgoing.join(", ")})`;
		}
		return `${atom.type}(${atom.id})`;
	}
}
