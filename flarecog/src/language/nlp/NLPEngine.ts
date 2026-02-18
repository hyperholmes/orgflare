import { Atom, Link } from "../../types/cognitive";
import { nanoid } from "nanoid";

/**
 * NLP Engine - Natural Language Processing
 *
 * Converts natural language to/from AtomSpace representation
 */

export interface DependencyParse {
	words: Word[];
	dependencies: Dependency[];
}

export interface Word {
	id: string;
	text: string;
	lemma: string;
	pos: string; // Part of speech
	index: number;
}

export interface Dependency {
	relation: string;
	head: string; // Word ID
	dependent: string; // Word ID
}

export interface SemanticFrame {
	frame: string;
	elements: FrameElement[];
}

export interface FrameElement {
	role: string;
	filler: string;
}

export interface DialogueState {
	context: string[];
	entities: Map<string, string>;
	intent?: string;
	slots: Map<string, any>;
}

export class NLPEngine {
	private ai: Ai;
	private atomSpace: DurableObjectStub;
	private dialogueState: DialogueState;

	constructor(ai: Ai, atomSpace: DurableObjectStub) {
		this.ai = ai;
		this.atomSpace = atomSpace;
		this.dialogueState = {
			context: [],
			entities: new Map(),
			slots: new Map(),
		};
	}

	/**
	 * Parse text to AtomSpace representation
	 */
	async parseToAtoms(text: string): Promise<Atom[]> {
		// Get dependency parse
		const parse = await this.dependencyParse(text);

		// Convert to atoms
		const atoms = await this.convertParseToAtoms(parse);

		// Extract semantic frames
		const frames = await this.extractSemanticFrames(text);

		// Add frame atoms
		const frameAtoms = await this.convertFramesToAtoms(frames);

		return [...atoms, ...frameAtoms];
	}

	/**
	 * Dependency parsing using Workers AI
	 */
	private async dependencyParse(text: string): Promise<DependencyParse> {
		const prompt = `Parse this sentence into dependency structure. Return JSON with words and dependencies.
Sentence: "${text}"

Format:
{
  "words": [{"text": "...", "lemma": "...", "pos": "...", "index": 0}],
  "dependencies": [{"relation": "...", "head": 0, "dependent": 1}]
}`;

		const result = await this.ai.run(
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			{
				prompt,
				max_tokens: 500,
			},
		);

		try {
			const parsed = JSON.parse(result.response);

			// Convert to proper format
			const words: Word[] = parsed.words.map((w: any, i: number) => ({
				id: nanoid(),
				text: w.text,
				lemma: w.lemma || w.text.toLowerCase(),
				pos: w.pos || "NOUN",
				index: i,
			}));

			const dependencies: Dependency[] = parsed.dependencies.map((d: any) => ({
				relation: d.relation,
				head: words[d.head]?.id || words[0].id,
				dependent: words[d.dependent]?.id || words[0].id,
			}));

			return { words, dependencies };
		} catch (error) {
			// Fallback: simple tokenization
			const words = text.split(/\s+/).map((word, i) => ({
				id: nanoid(),
				text: word,
				lemma: word.toLowerCase(),
				pos: "NOUN",
				index: i,
			}));

			return { words, dependencies: [] };
		}
	}

	/**
	 * Convert dependency parse to atoms
	 */
	private async convertParseToAtoms(parse: DependencyParse): Promise<Atom[]> {
		const atoms: Atom[] = [];

		// Create word nodes
		for (const word of parse.words) {
			const wordAtom: Atom = {
				id: word.id,
				type: "ConceptNode",
				name: word.lemma,
				truthValue: { strength: 1.0, confidence: 0.9 },
				attentionValue: { sti: 50, lti: 0, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			atoms.push(wordAtom);

			// Store in AtomSpace
			await this.atomSpace.fetch(
				new Request("http://dummy/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: wordAtom.type,
						name: wordAtom.name,
						truthValue: wordAtom.truthValue,
					}),
				}),
			);
		}

		// Create dependency links
		for (const dep of parse.dependencies) {
			const depLink: Link = {
				id: nanoid(),
				type: `${dep.relation}Link`,
				outgoing: [dep.head, dep.dependent],
				truthValue: { strength: 1.0, confidence: 0.9 },
				attentionValue: { sti: 50, lti: 0, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			atoms.push(depLink);

			// Store in AtomSpace
			await this.atomSpace.fetch(
				new Request("http://dummy/link", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: depLink.type,
						outgoing: depLink.outgoing,
						truthValue: depLink.truthValue,
					}),
				}),
			);
		}

		return atoms;
	}

	/**
	 * Extract semantic frames
	 */
	private async extractSemanticFrames(text: string): Promise<SemanticFrame[]> {
		const prompt = `Extract semantic frames from this sentence. Return JSON array.
Sentence: "${text}"

Format:
[
  {
    "frame": "Transfer",
    "elements": [
      {"role": "Agent", "filler": "John"},
      {"role": "Theme", "filler": "book"},
      {"role": "Recipient", "filler": "Mary"}
    ]
  }
]`;

		const result = await this.ai.run(
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			{
				prompt,
				max_tokens: 300,
			},
		);

		try {
			return JSON.parse(result.response);
		} catch {
			return [];
		}
	}

	/**
	 * Convert semantic frames to atoms
	 */
	private async convertFramesToAtoms(
		frames: SemanticFrame[],
	): Promise<Atom[]> {
		const atoms: Atom[] = [];

		for (const frame of frames) {
			// Create frame node
			const frameNode: Atom = {
				id: nanoid(),
				type: "ConceptNode",
				name: `frame_${frame.frame}`,
				truthValue: { strength: 1.0, confidence: 0.8 },
				attentionValue: { sti: 60, lti: 0, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			atoms.push(frameNode);

			// Create element links
			for (const element of frame.elements) {
				const roleLink: Link = {
					id: nanoid(),
					type: "FrameElementLink",
					outgoing: [frameNode.id, element.filler],
					truthValue: { strength: 1.0, confidence: 0.8 },
					attentionValue: { sti: 50, lti: 0, vlti: 0 },
					createdAt: Date.now(),
					updatedAt: Date.now(),
				};

				atoms.push(roleLink);
			}
		}

		return atoms;
	}

	/**
	 * Generate text from atoms
	 */
	async generateFromAtoms(atoms: Atom[]): Promise<string> {
		// Convert atoms to semantic representation
		const semantics = this.atomsToSemantics(atoms);

		// Use Workers AI for generation
		const prompt = `Generate natural language from this semantic structure:
${JSON.stringify(semantics, null, 2)}

Generate a fluent, grammatical sentence.`;

		const result = await this.ai.run(
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			{
				prompt,
				max_tokens: 200,
			},
		);

		return result.response.trim();
	}

	/**
	 * Convert atoms to semantic structure
	 */
	private atomsToSemantics(atoms: Atom[]): any {
		const semantics: any = {
			concepts: [],
			relations: [],
		};

		for (const atom of atoms) {
			if (atom.type === "ConceptNode") {
				semantics.concepts.push({
					name: atom.name,
					strength: atom.truthValue.strength,
				});
			} else if ("outgoing" in atom) {
				semantics.relations.push({
					type: atom.type,
					from: atom.outgoing[0],
					to: atom.outgoing[1],
					strength: atom.truthValue.strength,
				});
			}
		}

		return semantics;
	}

	/**
	 * Process dialogue turn
	 */
	async processDialogue(userInput: string): Promise<string> {
		// Add to context
		this.dialogueState.context.push(userInput);

		// Extract intent
		const intent = await this.extractIntent(userInput);
		this.dialogueState.intent = intent;

		// Extract entities
		const entities = await this.extractEntities(userInput);
		for (const [key, value] of entities) {
			this.dialogueState.entities.set(key, value);
		}

		// Generate response
		const response = await this.generateResponse(this.dialogueState);

		// Add response to context
		this.dialogueState.context.push(response);

		return response;
	}

	/**
	 * Extract intent from user input
	 */
	private async extractIntent(text: string): Promise<string> {
		const prompt = `What is the intent of this user message? Return one word: question, command, statement, greeting, or farewell.
Message: "${text}"`;

		const result = await this.ai.run(
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			{
				prompt,
				max_tokens: 10,
			},
		);

		return result.response.trim().toLowerCase();
	}

	/**
	 * Extract entities from text
	 */
	private async extractEntities(text: string): Promise<Map<string, string>> {
		const prompt = `Extract named entities from this text. Return JSON object with entity types as keys.
Text: "${text}"

Format: {"person": "...", "location": "...", "time": "..."}`;

		const result = await this.ai.run(
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			{
				prompt,
				max_tokens: 100,
			},
		);

		try {
			const entities = JSON.parse(result.response);
			return new Map(Object.entries(entities));
		} catch {
			return new Map();
		}
	}

	/**
	 * Generate response based on dialogue state
	 */
	private async generateResponse(state: DialogueState): Promise<string> {
		const contextStr = state.context.slice(-3).join("\n");

		const prompt = `Generate a response to this conversation:
${contextStr}

Intent: ${state.intent || "unknown"}
Entities: ${JSON.stringify(Array.from(state.entities.entries()))}

Generate a helpful, contextual response.`;

		const result = await this.ai.run(
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			{
				prompt,
				max_tokens: 150,
			},
		);

		return result.response.trim();
	}

	/**
	 * Reference resolution
	 */
	async resolveReferences(text: string, context: Atom[]): Promise<Map<string, string>> {
		const prompt = `Resolve pronouns and references in this text using the context.
Text: "${text}"
Context: ${JSON.stringify(context.map((a) => a.name))}

Return JSON mapping references to their antecedents.
Format: {"he": "John", "it": "book"}`;

		const result = await this.ai.run(
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			{
				prompt,
				max_tokens: 100,
			},
		);

		try {
			const resolutions = JSON.parse(result.response);
			return new Map(Object.entries(resolutions));
		} catch {
			return new Map();
		}
	}

	/**
	 * Get dialogue state
	 */
	getDialogueState(): DialogueState {
		return this.dialogueState;
	}

	/**
	 * Reset dialogue state
	 */
	resetDialogueState(): void {
		this.dialogueState = {
			context: [],
			entities: new Map(),
			slots: new Map(),
		};
	}
}
