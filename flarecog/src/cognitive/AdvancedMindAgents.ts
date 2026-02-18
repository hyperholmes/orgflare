import {
	Env,
	MindAgentConfig,
	MindAgentResult,
	Atom,
	Node,
	Link,
	AtomSpaceQuery,
	Goal,
} from "../types/cognitive";
import { AIEnhancedReasoning } from "./AIEnhancedReasoning";
import { PatternMatcher } from "./PatternMatcher";

/**
 * Advanced MindAgent Implementations
 * 
 * Complete implementations of ReasoningAgent, LearningAgent, PlanningAgent,
 * and PerceptionAgent with CloudFlare AI integration.
 */

/**
 * ReasoningAgent - Performs logical inference using PLN and AI
 */
export class ReasoningAgent {
	private aiReasoning: AIEnhancedReasoning;
	private patternMatcher: PatternMatcher;

	constructor(private env: Env) {
		this.aiReasoning = new AIEnhancedReasoning(env);
		this.patternMatcher = new PatternMatcher(env);
	}

	async execute(
		config: MindAgentConfig,
		atomspace: DurableObjectStub
	): Promise<MindAgentResult> {
		const startTime = Date.now();
		let atomsProcessed = 0;
		let atomsCreated = 0;
		let atomsModified = 0;

		try {
			// Get high-attention atoms for reasoning
			const query: AtomSpaceQuery = {
				type: "find_atoms",
				attentionValueMin: { sti: 50, lti: 0, vlti: 0 },
				limit: 20,
			};

			const response = await atomspace.fetch(
				new Request("https://atomspace/query", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(query),
				})
			);

			if (!response.ok) {
				throw new Error("Failed to query atoms");
			}

			const data = await response.json();
			const atoms: Atom[] = data.atoms || [];
			atomsProcessed = atoms.length;

			// Perform deductive inference
			const inferences = await this.performDeductiveInference(atoms, atomspace);
			atomsCreated += inferences.length;

			// Perform abductive inference (hypothesis generation)
			const hypotheses = await this.performAbductiveInference(atoms, atomspace);
			atomsCreated += hypotheses.length;

			// Perform inductive inference (pattern generalization)
			const generalizations = await this.performInductiveInference(
				atoms,
				atomspace
			);
			atomsCreated += generalizations.length;

			// Store inferred atoms
			for (const atom of [...inferences, ...hypotheses, ...generalizations]) {
				await this.storeAtom(atom, atomspace);
			}

			return {
				agentId: config.id,
				executionTime: Date.now() - startTime,
				atomsProcessed,
				atomsCreated,
				atomsModified,
				success: true,
				metrics: {
					inferences: inferences.length,
					hypotheses: hypotheses.length,
					generalizations: generalizations.length,
				},
			};
		} catch (error) {
			return {
				agentId: config.id,
				executionTime: Date.now() - startTime,
				atomsProcessed,
				atomsCreated,
				atomsModified,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Deductive inference: A→B, A ⊢ B
	 */
	private async performDeductiveInference(
		atoms: Atom[],
		atomspace: DurableObjectStub
	): Promise<Atom[]> {
		const inferences: Atom[] = [];

		// Find ImplicationLinks (A → B)
		const implications = atoms.filter(
			(a) => a.type === "ImplicationLink"
		) as Link[];

		for (const implication of implications) {
			if (implication.outgoing.length !== 2) continue;

			const [antecedentId, consequentId] = implication.outgoing;

			// Check if antecedent exists with high truth value
			const antecedent = await this.fetchAtom(antecedentId, atomspace);
			if (
				antecedent &&
				antecedent.truthValue.strength > 0.7 &&
				antecedent.truthValue.confidence > 0.6
			) {
				// Infer consequent with combined truth value
				const consequent = await this.fetchAtom(consequentId, atomspace);
				if (consequent) {
					// Calculate inferred truth value using PLN formulas
					const inferredStrength =
						antecedent.truthValue.strength * implication.truthValue.strength;
					const inferredConfidence = Math.min(
						antecedent.truthValue.confidence,
						implication.truthValue.confidence
					);

					// Create inference if it strengthens the consequent
					if (inferredStrength > consequent.truthValue.strength) {
						const updatedConsequent: Atom = {
							...consequent,
							truthValue: {
								strength: inferredStrength,
								confidence: inferredConfidence,
							},
							attentionValue: {
								...consequent.attentionValue,
								sti: consequent.attentionValue.sti + 20,
							},
							updatedAt: Date.now(),
						};

						inferences.push(updatedConsequent);
					}
				}
			}
		}

		return inferences;
	}

	/**
	 * Abductive inference: B, A→B ⊢ A (hypothesis)
	 */
	private async performAbductiveInference(
		atoms: Atom[],
		atomspace: DurableObjectStub
	): Promise<Atom[]> {
		const hypotheses: Atom[] = [];

		// Find high-confidence observations
		const observations = atoms.filter(
			(a) =>
				a.truthValue.strength > 0.8 &&
				a.truthValue.confidence > 0.7 &&
				a.attentionValue.sti > 60
		);

		for (const observation of observations) {
			// Find implications where observation is the consequent
			const incoming = await this.getIncoming(observation.id, atomspace);

			for (const link of incoming) {
				if (
					link.type === "ImplicationLink" &&
					link.outgoing.length === 2 &&
					link.outgoing[1] === observation.id
				) {
					// The antecedent is a hypothesis that could explain the observation
					const hypothesisId = link.outgoing[0];
					const hypothesis = await this.fetchAtom(hypothesisId, atomspace);

					if (hypothesis) {
						// Calculate hypothesis strength using Bayesian inference
						const hypothesisStrength =
							observation.truthValue.strength * link.truthValue.strength * 0.7; // Abduction is weaker

						const updatedHypothesis: Atom = {
							...hypothesis,
							truthValue: {
								strength: Math.max(
									hypothesis.truthValue.strength,
									hypothesisStrength
								),
								confidence: 0.5, // Hypotheses have lower confidence
							},
							attentionValue: {
								...hypothesis.attentionValue,
								sti: hypothesis.attentionValue.sti + 15,
							},
							updatedAt: Date.now(),
						};

						hypotheses.push(updatedHypothesis);
					}
				}
			}
		}

		return hypotheses;
	}

	/**
	 * Inductive inference: Pattern generalization
	 */
	private async performInductiveInference(
		atoms: Atom[],
		atomspace: DurableObjectStub
	): Promise<Atom[]> {
		const generalizations: Atom[] = [];

		// Find similar patterns using InheritanceLinks
		const inheritanceLinks = atoms.filter(
			(a) => a.type === "InheritanceLink"
		) as Link[];

		// Group by parent concept
		const parentGroups = new Map<string, Link[]>();
		for (const link of inheritanceLinks) {
			if (link.outgoing.length === 2) {
				const parentId = link.outgoing[1];
				if (!parentGroups.has(parentId)) {
					parentGroups.set(parentId, []);
				}
				parentGroups.get(parentId)!.push(link);
			}
		}

		// Generate generalizations for groups with multiple instances
		for (const [parentId, links] of parentGroups) {
			if (links.length >= 3) {
				// Enough instances for generalization
				const parent = await this.fetchAtom(parentId, atomspace);
				if (!parent) continue;

				// Calculate generalized truth value
				const avgStrength =
					links.reduce((sum, l) => sum + l.truthValue.strength, 0) /
					links.length;
				const avgConfidence =
					links.reduce((sum, l) => sum + l.truthValue.confidence, 0) /
					links.length;

				// Create generalization: "Most X are Y" type statement
				const generalization: Node = {
					id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					type: "ConceptNode",
					name: `generalization_${parentId}`,
					truthValue: {
						strength: avgStrength * 0.9, // Slightly weaker than average
						confidence: Math.min(avgConfidence * 1.1, 1.0), // Higher confidence with more data
					},
					attentionValue: { sti: 40, lti: 20, vlti: 0 },
					createdAt: Date.now(),
					updatedAt: Date.now(),
				};

				generalizations.push(generalization);
			}
		}

		return generalizations;
	}

	private async fetchAtom(
		id: string,
		atomspace: DurableObjectStub
	): Promise<Atom | null> {
		const response = await atomspace.fetch(
			new Request(`https://atomspace/atom/${id}`, { method: "GET" })
		);
		if (!response.ok) return null;
		const data = await response.json();
		return data.atom;
	}

	private async getIncoming(
		atomId: string,
		atomspace: DurableObjectStub
	): Promise<Link[]> {
		const response = await atomspace.fetch(
			new Request(`https://atomspace/incoming/${atomId}`, { method: "GET" })
		);
		if (!response.ok) return [];
		const data = await response.json();
		return data.links || [];
	}

	private async storeAtom(
		atom: Atom,
		atomspace: DurableObjectStub
	): Promise<void> {
		const isNode = ["Node", "ConceptNode", "PredicateNode", "VariableNode"].includes(
			atom.type
		);
		const endpoint = isNode ? "node" : "link";

		await atomspace.fetch(
			new Request(`https://atomspace/${endpoint}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(atom),
			})
		);
	}
}

/**
 * LearningAgent - Adapts behavior based on experience
 */
export class LearningAgent {
	private aiReasoning: AIEnhancedReasoning;

	constructor(private env: Env) {
		this.aiReasoning = new AIEnhancedReasoning(env);
	}

	async execute(
		config: MindAgentConfig,
		atomspace: DurableObjectStub
	): Promise<MindAgentResult> {
		const startTime = Date.now();
		let atomsProcessed = 0;
		let atomsModified = 0;

		try {
			// Get recent high-attention atoms (recent experiences)
			const recentAtoms = await this.getRecentAtoms(atomspace);
			atomsProcessed = recentAtoms.length;

			// Identify patterns in recent experiences
			const patterns = await this.identifyPatterns(recentAtoms);

			// Strengthen successful patterns
			const strengthenedCount = await this.strengthenSuccessfulPatterns(
				patterns,
				atomspace
			);
			atomsModified += strengthenedCount;

			// Weaken unsuccessful patterns
			const weakenedCount = await this.weakenUnsuccessfulPatterns(
				patterns,
				atomspace
			);
			atomsModified += weakenedCount;

			// Adapt agent parameters based on performance
			await this.adaptParameters(config, patterns);

			return {
				agentId: config.id,
				executionTime: Date.now() - startTime,
				atomsProcessed,
				atomsCreated: 0,
				atomsModified,
				success: true,
				metrics: {
					patternsIdentified: patterns.length,
					strengthened: strengthenedCount,
					weakened: weakenedCount,
				},
			};
		} catch (error) {
			return {
				agentId: config.id,
				executionTime: Date.now() - startTime,
				atomsProcessed,
				atomsCreated: 0,
				atomsModified,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async getRecentAtoms(atomspace: DurableObjectStub): Promise<Atom[]> {
		const query: AtomSpaceQuery = {
			type: "find_atoms",
			attentionValueMin: { sti: 30, lti: 0, vlti: 0 },
			limit: 30,
		};

		const response = await atomspace.fetch(
			new Request("https://atomspace/query", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(query),
			})
		);

		if (!response.ok) return [];
		const data = await response.json();
		return data.atoms || [];
	}

	private async identifyPatterns(atoms: Atom[]): Promise<Atom[]> {
		// Simple pattern identification: find atoms with similar truth values
		const patterns: Atom[] = [];

		for (let i = 0; i < atoms.length; i++) {
			for (let j = i + 1; j < atoms.length; j++) {
				const atom1 = atoms[i];
				const atom2 = atoms[j];

				// Check if truth values are similar
				const strengthDiff = Math.abs(
					atom1.truthValue.strength - atom2.truthValue.strength
				);
				const confidenceDiff = Math.abs(
					atom1.truthValue.confidence - atom2.truthValue.confidence
				);

				if (strengthDiff < 0.2 && confidenceDiff < 0.2) {
					patterns.push(atom1, atom2);
				}
			}
		}

		return Array.from(new Set(patterns)); // Deduplicate
	}

	private async strengthenSuccessfulPatterns(
		patterns: Atom[],
		atomspace: DurableObjectStub
	): Promise<number> {
		let count = 0;

		for (const atom of patterns) {
			// Successful patterns have high truth value and attention
			if (
				atom.truthValue.strength > 0.7 &&
				atom.attentionValue.sti > 50
			) {
				// Increase confidence and LTI
				await atomspace.fetch(
					new Request(`https://atomspace/atom/${atom.id}`, {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							truthValue: {
								strength: Math.min(atom.truthValue.strength * 1.05, 1.0),
								confidence: Math.min(atom.truthValue.confidence * 1.1, 1.0),
							},
							attentionValue: {
								sti: atom.attentionValue.sti,
								lti: atom.attentionValue.lti + 5,
								vlti: atom.attentionValue.vlti,
							},
						}),
					})
				);
				count++;
			}
		}

		return count;
	}

	private async weakenUnsuccessfulPatterns(
		patterns: Atom[],
		atomspace: DurableObjectStub
	): Promise<number> {
		let count = 0;

		for (const atom of patterns) {
			// Unsuccessful patterns have low truth value but high attention
			if (
				atom.truthValue.strength < 0.3 &&
				atom.attentionValue.sti > 40
			) {
				// Decrease truth value and attention
				await atomspace.fetch(
					new Request(`https://atomspace/atom/${atom.id}`, {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							truthValue: {
								strength: Math.max(atom.truthValue.strength * 0.9, 0.0),
								confidence: Math.max(atom.truthValue.confidence * 0.95, 0.1),
							},
							attentionValue: {
								sti: Math.max(atom.attentionValue.sti - 20, 0),
								lti: atom.attentionValue.lti,
								vlti: atom.attentionValue.vlti,
							},
						}),
					})
				);
				count++;
			}
		}

		return count;
	}

	private async adaptParameters(
		config: MindAgentConfig,
		patterns: Atom[]
	): Promise<void> {
		// Adapt learning rate based on pattern success
		const successRate =
			patterns.filter((p) => p.truthValue.strength > 0.7).length /
			Math.max(patterns.length, 1);

		if (successRate > 0.8) {
			// High success rate: increase learning rate
			config.parameters.learningRate = Math.min(
				(config.parameters.learningRate || 0.05) * 1.1,
				0.2
			);
		} else if (successRate < 0.3) {
			// Low success rate: decrease learning rate
			config.parameters.learningRate = Math.max(
				(config.parameters.learningRate || 0.05) * 0.9,
				0.01
			);
		}
	}
}

/**
 * PlanningAgent - Creates action sequences to achieve goals
 */
export class PlanningAgent {
	constructor(private env: Env) {}

	async execute(
		config: MindAgentConfig,
		atomspace: DurableObjectStub,
		goals: Goal[]
	): Promise<MindAgentResult> {
		const startTime = Date.now();
		let atomsCreated = 0;

		try {
			// Get active goals
			const activeGoals = goals.filter((g) => g.status === "active");

			// Create plans for each goal
			for (const goal of activeGoals) {
				const plan = await this.createPlan(goal, atomspace);
				if (plan) {
					atomsCreated += plan.length;
				}
			}

			return {
				agentId: config.id,
				executionTime: Date.now() - startTime,
				atomsProcessed: activeGoals.length,
				atomsCreated,
				atomsModified: 0,
				success: true,
				metrics: {
					plansCreated: activeGoals.length,
					totalSteps: atomsCreated,
				},
			};
		} catch (error) {
			return {
				agentId: config.id,
				executionTime: Date.now() - startTime,
				atomsProcessed: 0,
				atomsCreated,
				atomsModified: 0,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async createPlan(
		goal: Goal,
		atomspace: DurableObjectStub
	): Promise<Atom[]> {
		const plan: Atom[] = [];

		// Simple hierarchical task network (HTN) planning
		// Break down goal into subgoals and actions

		for (let i = 0; i < goal.actions.length; i++) {
			const action = goal.actions[i];

			// Create action node
			const actionNode: Node = {
				id: `action_${Date.now()}_${i}`,
				type: "ConceptNode",
				name: `action_${action.type}_${i}`,
				truthValue: { strength: 0.8, confidence: 0.7 },
				attentionValue: { sti: 60, lti: 10, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			plan.push(actionNode);

			// Store action node
			await atomspace.fetch(
				new Request("https://atomspace/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(actionNode),
				})
			);
		}

		return plan;
	}
}

/**
 * PerceptionAgent - Processes sensory input and creates perceptual atoms
 */
export class PerceptionAgent {
	private aiReasoning: AIEnhancedReasoning;

	constructor(private env: Env) {
		this.aiReasoning = new AIEnhancedReasoning(env);
	}

	async execute(
		config: MindAgentConfig,
		atomspace: DurableObjectStub,
		input?: { type: string; data: any }
	): Promise<MindAgentResult> {
		const startTime = Date.now();
		let atomsCreated = 0;

		try {
			if (!input) {
				return {
					agentId: config.id,
					executionTime: Date.now() - startTime,
					atomsProcessed: 0,
					atomsCreated: 0,
					atomsModified: 0,
					success: true,
				};
			}

			// Process input based on type
			let perceptualAtoms: Atom[] = [];

			switch (input.type) {
				case "text":
					perceptualAtoms = await this.processTextInput(input.data, atomspace);
					break;
				case "structured":
					perceptualAtoms = await this.processStructuredInput(
						input.data,
						atomspace
					);
					break;
				default:
					throw new Error(`Unknown input type: ${input.type}`);
			}

			atomsCreated = perceptualAtoms.length;

			return {
				agentId: config.id,
				executionTime: Date.now() - startTime,
				atomsProcessed: 1,
				atomsCreated,
				atomsModified: 0,
				success: true,
				metrics: {
					inputType: input.type,
					atomsGenerated: atomsCreated,
				},
			};
		} catch (error) {
			return {
				agentId: config.id,
				executionTime: Date.now() - startTime,
				atomsProcessed: 0,
				atomsCreated,
				atomsModified: 0,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async processTextInput(
		text: string,
		atomspace: DurableObjectStub
	): Promise<Atom[]> {
		const atoms: Atom[] = [];

		// Extract concepts using simple NLP (in production, use proper NLP)
		const words = text.split(/\s+/).filter((w) => w.length > 3);

		for (const word of words.slice(0, 5)) {
			// Limit to 5 concepts
			const conceptNode: Node = {
				id: `percept_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				type: "ConceptNode",
				name: word.toLowerCase(),
				truthValue: { strength: 0.7, confidence: 0.6 },
				attentionValue: { sti: 70, lti: 0, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			atoms.push(conceptNode);

			// Store in atomspace
			await atomspace.fetch(
				new Request("https://atomspace/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(conceptNode),
				})
			);
		}

		return atoms;
	}

	private async processStructuredInput(
		data: any,
		atomspace: DurableObjectStub
	): Promise<Atom[]> {
		const atoms: Atom[] = [];

		// Convert structured data to atoms
		for (const [key, value] of Object.entries(data)) {
			const conceptNode: Node = {
				id: `struct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				type: "ConceptNode",
				name: `${key}_${value}`,
				truthValue: { strength: 0.9, confidence: 0.8 },
				attentionValue: { sti: 80, lti: 10, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			atoms.push(conceptNode);

			await atomspace.fetch(
				new Request("https://atomspace/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(conceptNode),
				})
			);
		}

		return atoms;
	}
}
