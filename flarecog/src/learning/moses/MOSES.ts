import { Atom, TruthValue } from "../../types/cognitive";
import { nanoid } from "nanoid";

/**
 * MOSES (Meta-Optimizing Semantic Evolutionary Search)
 *
 * Program synthesis through evolutionary search with meta-optimization
 */

export interface Program {
	id: string;
	code: string;
	representation: ProgramNode;
	fitness: number;
	complexity: number;
	age: number;
	metadata: {
		createdAt: number;
		generation: number;
		parentIds: string[];
	};
}

export interface ProgramNode {
	type: "operator" | "variable" | "constant" | "function";
	value: string | number;
	children: ProgramNode[];
}

export interface LearningTask {
	id: string;
	name: string;
	description: string;
	testCases: TestCase[];
	fitnessFunction?: (output: any, expected: any) => number;
	maxComplexity?: number;
}

export interface TestCase {
	input: any;
	expected: any;
	weight: number;
}

export interface MOSESConfig {
	populationSize: number;
	generations: number;
	mutationRate: number;
	crossoverRate: number;
	elitismRate: number;
	maxComplexity: number;
	tournamentSize: number;
}

export interface EvolutionResult {
	bestProgram: Program;
	population: Program[];
	generations: number;
	convergenceGeneration?: number;
	evolutionHistory: GenerationStats[];
}

export interface GenerationStats {
	generation: number;
	bestFitness: number;
	avgFitness: number;
	diversity: number;
	timestamp: number;
}

export class MOSES {
	private population: Program[] = [];
	private fitnessCache: Map<string, number> = new Map();
	private config: MOSESConfig;
	private ai: Ai;
	private atomSpace: DurableObjectStub;

	constructor(
		ai: Ai,
		atomSpace: DurableObjectStub,
		config?: Partial<MOSESConfig>,
	) {
		this.ai = ai;
		this.atomSpace = atomSpace;
		this.config = {
			populationSize: 100,
			generations: 50,
			mutationRate: 0.1,
			crossoverRate: 0.7,
			elitismRate: 0.1,
			maxComplexity: 20,
			tournamentSize: 5,
			...config,
		};
	}

	/**
	 * Evolve a program to solve the task
	 */
	async evolve(task: LearningTask): Promise<EvolutionResult> {
		const evolutionHistory: GenerationStats[] = [];
		let convergenceGeneration: number | undefined;

		// Initialize population
		this.initializePopulation(task);

		for (let gen = 0; gen < this.config.generations; gen++) {
			// Evaluate fitness
			await this.evaluateFitness(task);

			// Record statistics
			const stats = this.getGenerationStats(gen);
			evolutionHistory.push(stats);

			// Check convergence
			if (this.isConverged() && !convergenceGeneration) {
				convergenceGeneration = gen;
			}

			// Selection
			const parents = this.selectParents();

			// Crossover and mutation
			const offspring = await this.createOffspring(parents);

			// Replacement
			this.population = this.selectSurvivors(offspring);

			// Age population
			this.agePopulation();
		}

		// Final evaluation
		await this.evaluateFitness(task);

		const bestProgram = this.getBestProgram();

		// Store best program in AtomSpace
		await this.storeProgramInAtomSpace(bestProgram, task);

		return {
			bestProgram,
			population: this.population,
			generations: this.config.generations,
			convergenceGeneration,
			evolutionHistory,
		};
	}

	/**
	 * Initialize population with random programs
	 */
	private initializePopulation(task: LearningTask): void {
		this.population = [];

		for (let i = 0; i < this.config.populationSize; i++) {
			const program = this.generateRandomProgram();
			this.population.push(program);
		}
	}

	/**
	 * Generate a random program
	 */
	private generateRandomProgram(): Program {
		const representation = this.generateRandomTree(0, this.config.maxComplexity);

		return {
			id: nanoid(),
			code: this.treeToCode(representation),
			representation,
			fitness: 0,
			complexity: this.calculateComplexity(representation),
			age: 0,
			metadata: {
				createdAt: Date.now(),
				generation: 0,
				parentIds: [],
			},
		};
	}

	/**
	 * Generate random program tree
	 */
	private generateRandomTree(depth: number, maxDepth: number): ProgramNode {
		if (depth >= maxDepth || Math.random() < 0.3) {
			// Terminal node
			return Math.random() < 0.5
				? {
						type: "variable",
						value: `x${Math.floor(Math.random() * 3)}`,
						children: [],
					}
				: {
						type: "constant",
						value: Math.floor(Math.random() * 10),
						children: [],
					};
		}

		// Non-terminal node
		const operators = ["+", "-", "*", "/", "if", "and", "or"];
		const operator = operators[Math.floor(Math.random() * operators.length)];
		const arity = operator === "if" ? 3 : 2;

		return {
			type: "operator",
			value: operator,
			children: Array.from({ length: arity }, () =>
				this.generateRandomTree(depth + 1, maxDepth),
			),
		};
	}

	/**
	 * Evaluate fitness of all programs
	 */
	private async evaluateFitness(task: LearningTask): Promise<void> {
		for (const program of this.population) {
			const key = program.code;

			if (!this.fitnessCache.has(key)) {
				const fitness = await this.computeFitness(program, task);
				this.fitnessCache.set(key, fitness);
				program.fitness = fitness;
			} else {
				program.fitness = this.fitnessCache.get(key)!;
			}
		}
	}

	/**
	 * Compute fitness for a program
	 */
	private async computeFitness(
		program: Program,
		task: LearningTask,
	): Promise<number> {
		let totalFitness = 0;
		let totalWeight = 0;

		for (const testCase of task.testCases) {
			try {
				const output = await this.executeProgram(program, testCase.input);

				const caseFitness = task.fitnessFunction
					? task.fitnessFunction(output, testCase.expected)
					: this.defaultFitnessFunction(output, testCase.expected);

				totalFitness += caseFitness * testCase.weight;
				totalWeight += testCase.weight;
			} catch (error) {
				// Execution error, fitness = 0 for this case
				totalWeight += testCase.weight;
			}
		}

		// Normalize by total weight
		const fitness = totalWeight > 0 ? totalFitness / totalWeight : 0;

		// Penalize complexity
		const complexityPenalty =
			program.complexity / this.config.maxComplexity * 0.1;

		return Math.max(0, fitness - complexityPenalty);
	}

	/**
	 * Execute program with given input
	 */
	private async executeProgram(program: Program, input: any): Promise<any> {
		// Use Workers AI to execute program safely
		const prompt = `Execute this program with input ${JSON.stringify(input)}:\n${program.code}\n\nReturn only the output value.`;

		const result = await this.ai.run(
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			{
				prompt,
				max_tokens: 100,
			},
		);

		// Parse result
		try {
			return JSON.parse(result.response);
		} catch {
			return result.response;
		}
	}

	/**
	 * Default fitness function
	 */
	private defaultFitnessFunction(output: any, expected: any): number {
		if (typeof output === "number" && typeof expected === "number") {
			const error = Math.abs(output - expected);
			return 1 / (1 + error);
		}

		return output === expected ? 1 : 0;
	}

	/**
	 * Select parents for reproduction
	 */
	private selectParents(): Program[] {
		const parents: Program[] = [];
		const parentCount = Math.floor(
			this.config.populationSize * this.config.crossoverRate,
		);

		for (let i = 0; i < parentCount; i++) {
			const parent = this.tournamentSelection();
			parents.push(parent);
		}

		return parents;
	}

	/**
	 * Tournament selection
	 */
	private tournamentSelection(): Program {
		const tournament: Program[] = [];

		for (let i = 0; i < this.config.tournamentSize; i++) {
			const randomIndex = Math.floor(Math.random() * this.population.length);
			tournament.push(this.population[randomIndex]);
		}

		return tournament.reduce((best, current) =>
			current.fitness > best.fitness ? current : best,
		);
	}

	/**
	 * Create offspring through crossover and mutation
	 */
	private async createOffspring(parents: Program[]): Promise<Program[]> {
		const offspring: Program[] = [];

		for (let i = 0; i < parents.length; i += 2) {
			if (i + 1 < parents.length) {
				// Crossover
				const [child1, child2] = this.crossover(parents[i], parents[i + 1]);
				offspring.push(child1, child2);
			} else {
				offspring.push(this.clone(parents[i]));
			}
		}

		// Mutation
		for (const child of offspring) {
			if (Math.random() < this.config.mutationRate) {
				this.mutate(child);
			}
		}

		return offspring;
	}

	/**
	 * Crossover two programs
	 */
	private crossover(parent1: Program, parent2: Program): [Program, Program] {
		const tree1 = this.cloneTree(parent1.representation);
		const tree2 = this.cloneTree(parent2.representation);

		// Random crossover point
		const point1 = this.getRandomNode(tree1);
		const point2 = this.getRandomNode(tree2);

		// Swap subtrees
		[point1.node, point2.node] = [point2.node, point1.node];

		const child1: Program = {
			id: nanoid(),
			code: this.treeToCode(tree1),
			representation: tree1,
			fitness: 0,
			complexity: this.calculateComplexity(tree1),
			age: 0,
			metadata: {
				createdAt: Date.now(),
				generation: parent1.metadata.generation + 1,
				parentIds: [parent1.id, parent2.id],
			},
		};

		const child2: Program = {
			id: nanoid(),
			code: this.treeToCode(tree2),
			representation: tree2,
			fitness: 0,
			complexity: this.calculateComplexity(tree2),
			age: 0,
			metadata: {
				createdAt: Date.now(),
				generation: parent2.metadata.generation + 1,
				parentIds: [parent1.id, parent2.id],
			},
		};

		return [child1, child2];
	}

	/**
	 * Mutate a program
	 */
	private mutate(program: Program): void {
		const node = this.getRandomNode(program.representation);

		// Random mutation type
		const mutationType = Math.random();

		if (mutationType < 0.33) {
			// Point mutation: change operator or value
			if (node.node.type === "operator") {
				const operators = ["+", "-", "*", "/"];
				node.node.value =
					operators[Math.floor(Math.random() * operators.length)];
			} else if (node.node.type === "constant") {
				node.node.value = Math.floor(Math.random() * 10);
			}
		} else if (mutationType < 0.66) {
			// Subtree mutation: replace with random subtree
			node.node = this.generateRandomTree(0, 3);
		} else {
			// Grow mutation: add random node
			if (node.node.children.length < 3) {
				node.node.children.push(this.generateRandomTree(0, 2));
			}
		}

		// Update program
		program.code = this.treeToCode(program.representation);
		program.complexity = this.calculateComplexity(program.representation);
	}

	/**
	 * Select survivors for next generation
	 */
	private selectSurvivors(offspring: Program[]): Program[] {
		// Elitism: keep best individuals
		const eliteCount = Math.floor(
			this.config.populationSize * this.config.elitismRate,
		);
		const elite = [...this.population]
			.sort((a, b) => b.fitness - a.fitness)
			.slice(0, eliteCount);

		// Combine elite with offspring
		const combined = [...elite, ...offspring];

		// Select best to fill population
		return combined
			.sort((a, b) => b.fitness - a.fitness)
			.slice(0, this.config.populationSize);
	}

	/**
	 * Age population
	 */
	private agePopulation(): void {
		for (const program of this.population) {
			program.age++;
		}
	}

	/**
	 * Get best program
	 */
	private getBestProgram(): Program {
		return this.population.reduce((best, current) =>
			current.fitness > best.fitness ? current : best,
		);
	}

	/**
	 * Check convergence
	 */
	private isConverged(): boolean {
		const bestFitness = this.getBestProgram().fitness;
		return bestFitness >= 0.99; // 99% fitness threshold
	}

	/**
	 * Get generation statistics
	 */
	private getGenerationStats(generation: number): GenerationStats {
		const fitnesses = this.population.map((p) => p.fitness);
		const bestFitness = Math.max(...fitnesses);
		const avgFitness =
			fitnesses.reduce((sum, f) => sum + f, 0) / fitnesses.length;

		// Calculate diversity (variance in fitness)
		const variance =
			fitnesses.reduce((sum, f) => sum + Math.pow(f - avgFitness, 2), 0) /
			fitnesses.length;
		const diversity = Math.sqrt(variance);

		return {
			generation,
			bestFitness,
			avgFitness,
			diversity,
			timestamp: Date.now(),
		};
	}

	/**
	 * Helper methods
	 */

	private clone(program: Program): Program {
		return {
			...program,
			id: nanoid(),
			representation: this.cloneTree(program.representation),
			age: 0,
		};
	}

	private cloneTree(node: ProgramNode): ProgramNode {
		return {
			...node,
			children: node.children.map((child) => this.cloneTree(child)),
		};
	}

	private getRandomNode(tree: ProgramNode): { node: ProgramNode } {
		const nodes: ProgramNode[] = [];
		this.collectNodes(tree, nodes);
		return { node: nodes[Math.floor(Math.random() * nodes.length)] };
	}

	private collectNodes(node: ProgramNode, nodes: ProgramNode[]): void {
		nodes.push(node);
		for (const child of node.children) {
			this.collectNodes(child, nodes);
		}
	}

	private treeToCode(node: ProgramNode): string {
		if (node.type === "variable" || node.type === "constant") {
			return String(node.value);
		}

		const childrenCode = node.children.map((c) => this.treeToCode(c));

		if (node.value === "if") {
			return `(${childrenCode[0]} ? ${childrenCode[1]} : ${childrenCode[2]})`;
		}

		return `(${childrenCode.join(` ${node.value} `)})`;
	}

	private calculateComplexity(node: ProgramNode): number {
		return (
			1 + node.children.reduce((sum, child) => sum + this.calculateComplexity(child), 0)
		);
	}

	/**
	 * Store program in AtomSpace
	 */
	private async storeProgramInAtomSpace(
		program: Program,
		task: LearningTask,
	): Promise<void> {
		// Create ProgramNode
		await this.atomSpace.fetch(
			new Request("http://dummy/node", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "ProgramNode",
					name: `program_${program.id}`,
					truthValue: {
						strength: program.fitness,
						confidence: 0.9,
					},
				}),
			}),
		);

		// Create link to task
		await this.atomSpace.fetch(
			new Request("http://dummy/link", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "EvaluationLink",
					outgoing: [`program_${program.id}`, `task_${task.id}`],
					truthValue: {
						strength: program.fitness,
						confidence: 0.9,
					},
				}),
			}),
		);
	}
}
