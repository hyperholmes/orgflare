import { Env, Atom, TruthValue, AttentionValue } from "../types/cognitive";
import { nanoid } from "nanoid";

/**
 * Perception Engine - Multi-modal perception using Workers AI
 *
 * Processes sensory input and grounds it in the AtomSpace:
 * - Vision: Image understanding and object detection
 * - Audio: Speech transcription and audio analysis
 * - Text: Semantic understanding and embedding
 * - Multi-modal fusion
 */

export interface PerceptionInput {
	type: "text" | "image" | "audio" | "video";
	data: string | ArrayBuffer; // Text string, base64, or binary data
	metadata?: Record<string, any>;
}

export interface PerceptionResult {
	atoms: Atom[];
	embeddings?: number[];
	confidence: number;
	processingTime: number;
	metadata: Record<string, any>;
}

export class PerceptionEngine {
	private env: Env;
	private atomSpaceStub: DurableObjectStub;

	constructor(env: Env, atomSpaceStub: DurableObjectStub) {
		this.env = env;
		this.atomSpaceStub = atomSpaceStub;
	}

	/**
	 * Process perception input and create grounded atoms
	 */
	async perceive(input: PerceptionInput): Promise<PerceptionResult> {
		const startTime = Date.now();

		switch (input.type) {
			case "text":
				return await this.perceiveText(input, startTime);
			case "image":
				return await this.perceiveImage(input, startTime);
			case "audio":
				return await this.perceiveAudio(input, startTime);
			case "video":
				return await this.perceiveVideo(input, startTime);
			default:
				throw new Error(`Unsupported perception type: ${input.type}`);
		}
	}

	/**
	 * Perceive text input with semantic understanding
	 */
	private async perceiveText(
		input: PerceptionInput,
		startTime: number,
	): Promise<PerceptionResult> {
		const text = input.data as string;
		const atoms: Atom[] = [];

		// Extract key concepts using AI
		const conceptsResponse = await this.env.AI.run(
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			{
				messages: [
					{
						role: "system",
						content:
							"Extract key concepts from the text. Return a JSON array of concept names.",
					},
					{
						role: "user",
						content: text,
					},
				],
			},
		);

		// Parse concepts (simplified - would need better parsing)
		let concepts: string[] = [];
		try {
			if (
				typeof conceptsResponse === "object" &&
				conceptsResponse !== null &&
				"response" in conceptsResponse
			) {
				const responseText = conceptsResponse.response as string;
				// Try to extract JSON array from response
				const match = responseText.match(/\[.*\]/s);
				if (match) {
					concepts = JSON.parse(match[0]);
				}
			}
		} catch (e) {
			// Fallback: extract words
			concepts = text
				.split(/\s+/)
				.filter((word) => word.length > 3)
				.slice(0, 5);
		}

		// Create ConceptNodes for each concept
		for (const concept of concepts) {
			const nodeResponse = await this.atomSpaceStub.fetch(
				new Request("http://dummy/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "ConceptNode",
						name: concept.toLowerCase().trim(),
						truthValue: { strength: 0.8, confidence: 0.7 },
						attentionValue: { sti: 80, lti: 10, vlti: 0 },
					}),
				}),
			);

			const nodeData = await nodeResponse.json();
			if (nodeData.success && nodeData.data) {
				atoms.push(nodeData.data);
			}
		}

		// Create a perception node for the input
		const perceptionNodeResponse = await this.atomSpaceStub.fetch(
			new Request("http://dummy/node", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "ConceptNode",
					name: `perception_text_${Date.now()}`,
					truthValue: { strength: 0.9, confidence: 0.9 },
					attentionValue: { sti: 100, lti: 20, vlti: 0 },
				}),
			}),
		);

		const perceptionNodeData = await perceptionNodeResponse.json();
		if (perceptionNodeData.success && perceptionNodeData.data) {
			atoms.push(perceptionNodeData.data);

			// Link concepts to perception
			for (const atom of atoms.slice(0, -1)) {
				await this.atomSpaceStub.fetch(
					new Request("http://dummy/link", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							type: "EvaluationLink",
							outgoing: [perceptionNodeData.data.id, atom.id],
							truthValue: { strength: 0.8, confidence: 0.7 },
							attentionValue: { sti: 60, lti: 5, vlti: 0 },
						}),
					}),
				);
			}
		}

		return {
			atoms,
			confidence: 0.8,
			processingTime: Date.now() - startTime,
			metadata: {
				textLength: text.length,
				conceptCount: concepts.length,
			},
		};
	}

	/**
	 * Perceive image input with vision understanding
	 */
	private async perceiveImage(
		input: PerceptionInput,
		startTime: number,
	): Promise<PerceptionResult> {
		const atoms: Atom[] = [];

		// Use Workers AI vision model
		try {
			const visionResponse = await this.env.AI.run(
				"@cf/meta/llama-3.2-11b-vision-instruct",
				{
					image: input.data as any,
					prompt: "Describe what you see in this image. List the main objects.",
					max_tokens: 512,
				},
			);

			let description = "";
			if (
				typeof visionResponse === "object" &&
				visionResponse !== null &&
				"description" in visionResponse
			) {
				description = visionResponse.description as string;
			}

			// Extract objects from description
			const objects = this.extractObjectsFromDescription(description);

			// Create ConceptNodes for detected objects
			for (const obj of objects) {
				const nodeResponse = await this.atomSpaceStub.fetch(
					new Request("http://dummy/node", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							type: "ConceptNode",
							name: `visual_${obj.toLowerCase()}`,
							truthValue: { strength: 0.7, confidence: 0.6 },
							attentionValue: { sti: 70, lti: 15, vlti: 0 },
						}),
					}),
				);

				const nodeData = await nodeResponse.json();
				if (nodeData.success && nodeData.data) {
					atoms.push(nodeData.data);
				}
			}

			// Create perception node
			const perceptionNodeResponse = await this.atomSpaceStub.fetch(
				new Request("http://dummy/node", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "ConceptNode",
						name: `perception_image_${Date.now()}`,
						truthValue: { strength: 0.8, confidence: 0.7 },
						attentionValue: { sti: 90, lti: 20, vlti: 0 },
					}),
				}),
			);

			const perceptionNodeData = await perceptionNodeResponse.json();
			if (perceptionNodeData.success && perceptionNodeData.data) {
				atoms.push(perceptionNodeData.data);
			}

			return {
				atoms,
				confidence: 0.7,
				processingTime: Date.now() - startTime,
				metadata: {
					objectCount: objects.length,
					description,
				},
			};
		} catch (error) {
			console.error("Image perception error:", error);
			return {
				atoms: [],
				confidence: 0,
				processingTime: Date.now() - startTime,
				metadata: {
					error: error instanceof Error ? error.message : "Unknown error",
				},
			};
		}
	}

	/**
	 * Perceive audio input with speech recognition
	 */
	private async perceiveAudio(
		input: PerceptionInput,
		startTime: number,
	): Promise<PerceptionResult> {
		const atoms: Atom[] = [];

		try {
			// Use Workers AI for speech-to-text
			const transcriptionResponse = await this.env.AI.run(
				"@cf/openai/whisper",
				{
					audio: input.data as any,
				},
			);

			let transcription = "";
			if (
				typeof transcriptionResponse === "object" &&
				transcriptionResponse !== null &&
				"text" in transcriptionResponse
			) {
				transcription = transcriptionResponse.text as string;
			}

			// Process transcription as text
			const textResult = await this.perceiveText(
				{
					type: "text",
					data: transcription,
					metadata: { ...input.metadata, source: "audio" },
				},
				startTime,
			);

			// Add audio-specific metadata
			return {
				...textResult,
				metadata: {
					...textResult.metadata,
					transcription,
					audioSource: true,
				},
			};
		} catch (error) {
			console.error("Audio perception error:", error);
			return {
				atoms: [],
				confidence: 0,
				processingTime: Date.now() - startTime,
				metadata: {
					error: error instanceof Error ? error.message : "Unknown error",
				},
			};
		}
	}

	/**
	 * Perceive video input (frame-by-frame analysis)
	 */
	private async perceiveVideo(
		input: PerceptionInput,
		startTime: number,
	): Promise<PerceptionResult> {
		// Video perception would involve:
		// 1. Extract key frames
		// 2. Analyze each frame as image
		// 3. Extract audio track
		// 4. Combine visual and audio perception
		// 5. Add temporal relationships

		// Simplified implementation
		return {
			atoms: [],
			confidence: 0.5,
			processingTime: Date.now() - startTime,
			metadata: {
				note: "Video perception not fully implemented",
			},
		};
	}

	/**
	 * Extract objects from vision model description
	 */
	private extractObjectsFromDescription(description: string): string[] {
		// Simple extraction - would be more sophisticated in production
		const commonObjects = [
			"person",
			"car",
			"building",
			"tree",
			"sky",
			"road",
			"animal",
			"furniture",
			"food",
			"device",
		];

		const found: string[] = [];
		const lowerDesc = description.toLowerCase();

		for (const obj of commonObjects) {
			if (lowerDesc.includes(obj)) {
				found.push(obj);
			}
		}

		return found;
	}

	/**
	 * Create multi-modal fusion atoms
	 */
	async fusePerceptions(
		perceptions: PerceptionResult[],
	): Promise<PerceptionResult> {
		const startTime = Date.now();
		const allAtoms: Atom[] = [];

		// Collect all atoms from perceptions
		for (const perception of perceptions) {
			allAtoms.push(...perception.atoms);
		}

		// Create fusion node
		const fusionNodeResponse = await this.atomSpaceStub.fetch(
			new Request("http://dummy/node", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "ConceptNode",
					name: `perception_fusion_${Date.now()}`,
					truthValue: { strength: 0.85, confidence: 0.8 },
					attentionValue: { sti: 100, lti: 30, vlti: 0 },
				}),
			}),
		);

		const fusionNodeData = await fusionNodeResponse.json();
		if (fusionNodeData.success && fusionNodeData.data) {
			allAtoms.push(fusionNodeData.data);

			// Link all perception atoms to fusion node
			for (const atom of allAtoms.slice(0, -1)) {
				await this.atomSpaceStub.fetch(
					new Request("http://dummy/link", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							type: "EvaluationLink",
							outgoing: [fusionNodeData.data.id, atom.id],
							truthValue: { strength: 0.75, confidence: 0.7 },
							attentionValue: { sti: 50, lti: 10, vlti: 0 },
						}),
					}),
				);
			}
		}

		// Calculate average confidence
		const avgConfidence =
			perceptions.reduce((sum, p) => sum + p.confidence, 0) /
			perceptions.length;

		return {
			atoms: allAtoms,
			confidence: avgConfidence,
			processingTime: Date.now() - startTime,
			metadata: {
				perceptionCount: perceptions.length,
				totalAtoms: allAtoms.length,
			},
		};
	}
}
