import {
	Env,
	Atom,
	Node,
	Link,
	AtomType,
	TruthValue,
	AttentionValue,
} from "../types/cognitive";

/**
 * AI-Enhanced Reasoning Module
 * 
 * Integrates CloudFlare Workers AI with OpenCog symbolic reasoning
 * for cognitive synergy and relevance realization.
 */

export interface ReasoningContext {
	query: string;
	relevantAtoms: Atom[];
	goalContext?: string;
	maxTokens?: number;
	temperature?: number;
}

export interface ReasoningResult {
	answer: string;
	confidence: number;
	inferredAtoms: Atom[];
	reasoning: string;
	truthValue: TruthValue;
}

export interface SemanticSimilarityRequest {
	atom1: Atom;
	atom2: Atom;
	context?: string;
}

export interface PatternSuggestion {
	pattern: string;
	confidence: number;
	explanation: string;
}

/**
 * AIEnhancedReasoning - Hybrid symbolic-neural cognitive processing
 */
export class AIEnhancedReasoning {
	constructor(private env: Env) {}

	/**
	 * Perform AI-enhanced reasoning on a query with AtomSpace context
	 */
	async reason(context: ReasoningContext): Promise<ReasoningResult> {
		// Build context from atoms
		const atomContext = this.buildAtomContext(context.relevantAtoms);

		// Construct reasoning prompt
		const prompt = this.buildReasoningPrompt(
			context.query,
			atomContext,
			context.goalContext
		);

		// Call Workers AI
		const aiResponse = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content:
						"You are an AI reasoning engine integrated with an OpenCog cognitive architecture. " +
						"Analyze the provided hypergraph knowledge and provide logical inferences. " +
						"Format your response as: ANSWER: <answer> | CONFIDENCE: <0-1> | REASONING: <explanation>",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			max_tokens: context.maxTokens || 512,
			temperature: context.temperature || 0.7,
		});

		// Parse AI response
		const parsed = this.parseReasoningResponse(aiResponse.response);

		// Generate inferred atoms from reasoning
		const inferredAtoms = await this.generateInferredAtoms(
			context.query,
			parsed.answer,
			context.relevantAtoms
		);

		return {
			answer: parsed.answer,
			confidence: parsed.confidence,
			inferredAtoms,
			reasoning: parsed.reasoning,
			truthValue: {
				strength: parsed.confidence,
				confidence: 0.7, // AI-derived inferences have moderate confidence
			},
		};
	}

	/**
	 * Calculate semantic similarity between two atoms using AI embeddings
	 */
	async calculateSemanticSimilarity(
		request: SemanticSimilarityRequest
	): Promise<number> {
		const text1 = this.atomToText(request.atom1);
		const text2 = this.atomToText(request.atom2);

		// Use AI to generate embeddings
		const embedding1 = await this.env.AI.run("@cf/baai/bge-base-en-v1.5", {
			text: text1,
		});

		const embedding2 = await this.env.AI.run("@cf/baai/bge-base-en-v1.5", {
			text: text2,
		});

		// Calculate cosine similarity
		const similarity = this.cosineSimilarity(
			embedding1.data[0],
			embedding2.data[0]
		);

		return similarity;
	}

	/**
	 * Suggest query patterns based on natural language input
	 */
	async suggestPatterns(
		naturalLanguageQuery: string,
		existingAtoms: Atom[]
	): Promise<PatternSuggestion[]> {
		const atomTypes = this.extractAtomTypes(existingAtoms);

		const prompt = `Given the following natural language query and available atom types, suggest OpenCog query patterns:

Query: "${naturalLanguageQuery}"

Available Atom Types: ${atomTypes.join(", ")}

Suggest 3 query patterns in OpenCog format. For each pattern, provide:
1. The pattern syntax
2. Confidence (0-1)
3. Brief explanation

Format: PATTERN: <pattern> | CONFIDENCE: <0-1> | EXPLANATION: <text>`;

		const aiResponse = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content:
						"You are an expert in OpenCog query patterns and hypergraph knowledge representation.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			max_tokens: 512,
		});

		return this.parsePatternSuggestions(aiResponse.response);
	}

	/**
	 * Enhance attention allocation using AI-based relevance scoring
	 */
	async enhanceAttentionAllocation(
		atoms: Atom[],
		currentGoal: string
	): Promise<Map<string, AttentionValue>> {
		const attentionMap = new Map<string, AttentionValue>();

		// Build context for each atom
		const atomDescriptions = atoms.map((atom) => ({
			id: atom.id,
			description: this.atomToText(atom),
		}));

		const prompt = `Given the current cognitive goal and a set of atoms, assign attention values (STI: short-term importance 0-100).

Goal: "${currentGoal}"

Atoms:
${atomDescriptions.map((a, i) => `${i + 1}. ${a.description}`).join("\n")}

For each atom, provide: ATOM_ID: <id> | STI: <0-100>`;

		const aiResponse = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content:
						"You are an attention allocation system for a cognitive architecture. " +
						"Assign importance scores based on relevance to the current goal.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			max_tokens: 512,
		});

		// Parse attention assignments
		const assignments = this.parseAttentionAssignments(aiResponse.response);

		for (const [atomId, sti] of assignments) {
			const atom = atoms.find((a) => a.id === atomId);
			if (atom) {
				attentionMap.set(atomId, {
					sti,
					lti: atom.attentionValue.lti,
					vlti: atom.attentionValue.vlti,
				});
			}
		}

		return attentionMap;
	}

	/**
	 * Generate natural language explanation of cognitive state
	 */
	async explainCognitiveState(
		topAtoms: Atom[],
		activeGoals: string[],
		recentInferences: string[]
	): Promise<string> {
		const atomContext = this.buildAtomContext(topAtoms);

		const prompt = `Explain the current cognitive state in natural language:

Top Active Atoms:
${atomContext}

Active Goals:
${activeGoals.map((g, i) => `${i + 1}. ${g}`).join("\n")}

Recent Inferences:
${recentInferences.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Provide a concise, coherent explanation of what the system is currently thinking about and pursuing.`;

		const aiResponse = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content:
						"You are an introspective cognitive system explaining your own mental state.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			max_tokens: 256,
		});

		return aiResponse.response;
	}

	// Helper methods

	private buildAtomContext(atoms: Atom[]): string {
		return atoms
			.map((atom) => {
				const text = this.atomToText(atom);
				const tv = `[${atom.truthValue.strength.toFixed(2)}, ${atom.truthValue.confidence.toFixed(2)}]`;
				return `- ${text} ${tv}`;
			})
			.join("\n");
	}

	private atomToText(atom: Atom): string {
		if ("name" in atom && atom.name) {
			return `${atom.type}(${atom.name})`;
		} else if ("outgoing" in atom) {
			const link = atom as Link;
			return `${atom.type}(${link.outgoing.join(", ")})`;
		}
		return `${atom.type}(${atom.id})`;
	}

	private buildReasoningPrompt(
		query: string,
		atomContext: string,
		goalContext?: string
	): string {
		let prompt = `Query: ${query}\n\nKnowledge Context:\n${atomContext}`;

		if (goalContext) {
			prompt += `\n\nGoal Context: ${goalContext}`;
		}

		prompt += "\n\nProvide your reasoning and answer.";

		return prompt;
	}

	private parseReasoningResponse(response: string): {
		answer: string;
		confidence: number;
		reasoning: string;
	} {
		// Parse structured response
		const answerMatch = response.match(/ANSWER:\s*(.+?)(?:\||$)/i);
		const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
		const reasoningMatch = response.match(/REASONING:\s*(.+?)$/is);

		return {
			answer: answerMatch ? answerMatch[1].trim() : response,
			confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
			reasoning: reasoningMatch ? reasoningMatch[1].trim() : response,
		};
	}

	private async generateInferredAtoms(
		query: string,
		answer: string,
		context: Atom[]
	): Promise<Atom[]> {
		// Simple heuristic: extract concepts from answer
		// In a full implementation, this would use more sophisticated NLP
		const inferred: Atom[] = [];

		// Extract potential concept names (words in quotes or capitalized phrases)
		const conceptMatches = answer.match(/"([^"]+)"|([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g);

		if (conceptMatches) {
			for (const match of conceptMatches.slice(0, 3)) {
				// Limit to 3 inferred atoms
				const conceptName = match.replace(/"/g, "").trim();

				// Create inferred concept node
				const inferredNode: Node = {
					id: `inferred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					type: "ConceptNode",
					name: conceptName,
					truthValue: { strength: 0.6, confidence: 0.5 },
					attentionValue: { sti: 50, lti: 0, vlti: 0 },
					createdAt: Date.now(),
					updatedAt: Date.now(),
				};

				inferred.push(inferredNode);
			}
		}

		return inferred;
	}

	private extractAtomTypes(atoms: Atom[]): string[] {
		const types = new Set<string>();
		for (const atom of atoms) {
			types.add(atom.type);
		}
		return Array.from(types);
	}

	private parsePatternSuggestions(response: string): PatternSuggestion[] {
		const suggestions: PatternSuggestion[] = [];
		const lines = response.split("\n");

		for (const line of lines) {
			const match = line.match(
				/PATTERN:\s*(.+?)\s*\|\s*CONFIDENCE:\s*([\d.]+)\s*\|\s*EXPLANATION:\s*(.+)/i
			);
			if (match) {
				suggestions.push({
					pattern: match[1].trim(),
					confidence: parseFloat(match[2]),
					explanation: match[3].trim(),
				});
			}
		}

		return suggestions;
	}

	private parseAttentionAssignments(response: string): Map<string, number> {
		const assignments = new Map<string, number>();
		const lines = response.split("\n");

		for (const line of lines) {
			const match = line.match(/ATOM_ID:\s*(\S+)\s*\|\s*STI:\s*(\d+)/i);
			if (match) {
				assignments.set(match[1], parseInt(match[2]));
			}
		}

		return assignments;
	}

	private cosineSimilarity(vec1: number[], vec2: number[]): number {
		if (vec1.length !== vec2.length) {
			throw new Error("Vectors must have same length");
		}

		let dotProduct = 0;
		let norm1 = 0;
		let norm2 = 0;

		for (let i = 0; i < vec1.length; i++) {
			dotProduct += vec1[i] * vec2[i];
			norm1 += vec1[i] * vec1[i];
			norm2 += vec2[i] * vec2[i];
		}

		return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
	}
}
