/**
 * MOSESEvolutionary.ts
 * 
 * Meta-Optimizing Semantic Evolutionary Search (MOSES) implementation
 * for CloudFlare Workers. MOSES is a program learning algorithm that
 * evolves programs (represented as combo trees) to solve problems.
 * 
 * Key concepts:
 * - Demes: Subpopulations that evolve independently
 * - Combo Trees: Program representations (similar to S-expressions)
 * - Reduction: Simplification of programs to canonical form
 * - Scoring: Fitness evaluation against training data
 * - Crossover/Mutation: Genetic operators for evolution
 */

import { Ai } from '@cloudflare/workers-types';

// ==================== Types ====================

/**
 * Combo tree node types
 */
type ComboNodeType = 
  | 'and' | 'or' | 'not'           // Boolean operators
  | 'plus' | 'minus' | 'times' | 'div'  // Arithmetic operators
  | 'sin' | 'cos' | 'exp' | 'log'  // Math functions
  | 'if' | 'cond'                  // Conditionals
  | 'arg'                          // Input argument reference
  | 'const'                        // Constant value
  | 'impulse'                      // Impulse function
  | 'null';                        // Null/empty

/**
 * Combo tree node
 */
interface ComboNode {
  type: ComboNodeType;
  value?: number | string;
  argIndex?: number;
  children?: ComboNode[];
}

/**
 * Individual in the population (a program)
 */
interface Individual {
  id: string;
  tree: ComboNode;
  score: number;
  complexity: number;
  generation: number;
  parentIds: string[];
  metadata: Record<string, any>;
}

/**
 * Deme (subpopulation)
 */
interface Deme {
  id: string;
  exemplar: ComboNode;
  population: Individual[];
  generation: number;
  bestScore: number;
  stagnationCount: number;
  metadata: Record<string, any>;
}

/**
 * Training example
 */
interface TrainingExample {
  inputs: number[];
  output: number | boolean;
  weight?: number;
}

/**
 * MOSES configuration
 */
interface MOSESConfig {
  populationSize: number;
  maxGenerations: number;
  tournamentSize: number;
  mutationRate: number;
  crossoverRate: number;
  elitismCount: number;
  maxComplexity: number;
  stagnationLimit: number;
  demeCount: number;
  reductionEnabled: boolean;
}

/**
 * Evolution result
 */
interface EvolutionResult {
  bestIndividual: Individual;
  generations: number;
  evaluations: number;
  demeStats: Array<{
    demeId: string;
    bestScore: number;
    avgScore: number;
    diversity: number;
  }>;
  convergenceHistory: Array<{ generation: number; bestScore: number }>;
}

/**
 * Scoring function type
 */
type ScoringFunction = (tree: ComboNode, examples: TrainingExample[]) => number;

// ==================== Environment ====================

interface Env {
  AI: Ai;
  MOSES_STATE: KVNamespace;
  COGNITIVE_QUEUE: Queue;
}

// ==================== MOSES Implementation ====================

/**
 * MOSESEvolutionary
 * 
 * Implements the MOSES algorithm for program learning on CloudFlare Workers.
 */
export class MOSESEvolutionary {
  private env: Env;
  private config: MOSESConfig;
  private statePrefix = 'moses:';

  // Default configuration
  private static readonly DEFAULT_CONFIG: MOSESConfig = {
    populationSize: 100,
    maxGenerations: 50,
    tournamentSize: 5,
    mutationRate: 0.3,
    crossoverRate: 0.7,
    elitismCount: 5,
    maxComplexity: 20,
    stagnationLimit: 10,
    demeCount: 4,
    reductionEnabled: true
  };

  constructor(env: Env, config?: Partial<MOSESConfig>) {
    this.env = env;
    this.config = { ...MOSESEvolutionary.DEFAULT_CONFIG, ...config };
  }

  // ==================== Main Evolution Loop ====================

  /**
   * Run MOSES evolution to find a program that fits the training data
   */
  async evolve(
    problemId: string,
    examples: TrainingExample[],
    inputArity: number,
    outputType: 'boolean' | 'numeric'
  ): Promise<EvolutionResult> {
    // Initialize demes with random exemplars
    const demes = await this.initializeDemes(inputArity, outputType);
    
    const convergenceHistory: Array<{ generation: number; bestScore: number }> = [];
    let totalEvaluations = 0;
    let globalBest: Individual | null = null;

    // Main evolution loop
    for (let gen = 0; gen < this.config.maxGenerations; gen++) {
      // Evolve each deme independently
      for (const deme of demes) {
        // Generate offspring
        const offspring = await this.generateOffspring(deme, inputArity, outputType);
        
        // Evaluate offspring
        for (const individual of offspring) {
          individual.score = this.evaluateIndividual(individual.tree, examples, outputType);
          totalEvaluations++;
        }

        // Select survivors
        deme.population = this.selectSurvivors(
          [...deme.population, ...offspring],
          this.config.populationSize
        );

        // Update deme statistics
        const bestInDeme = deme.population.reduce(
          (best, ind) => ind.score > best.score ? ind : best,
          deme.population[0]
        );

        if (bestInDeme.score > deme.bestScore) {
          deme.bestScore = bestInDeme.score;
          deme.stagnationCount = 0;
        } else {
          deme.stagnationCount++;
        }

        deme.generation = gen;

        // Update global best
        if (!globalBest || bestInDeme.score > globalBest.score) {
          globalBest = { ...bestInDeme };
        }
      }

      // Record convergence
      convergenceHistory.push({
        generation: gen,
        bestScore: globalBest?.score || 0
      });

      // Check for early termination (perfect score)
      if (globalBest && globalBest.score >= 0.999) {
        break;
      }

      // Deme migration (exchange best individuals)
      if (gen > 0 && gen % 5 === 0) {
        this.migrateBetweenDemes(demes);
      }

      // Restart stagnant demes
      for (const deme of demes) {
        if (deme.stagnationCount >= this.config.stagnationLimit) {
          await this.restartDeme(deme, inputArity, outputType);
        }
      }
    }

    // Save final state
    await this.saveState(problemId, {
      demes,
      bestIndividual: globalBest,
      convergenceHistory
    });

    // Compute deme statistics
    const demeStats = demes.map(deme => ({
      demeId: deme.id,
      bestScore: deme.bestScore,
      avgScore: deme.population.reduce((sum, ind) => sum + ind.score, 0) / deme.population.length,
      diversity: this.calculateDiversity(deme.population)
    }));

    return {
      bestIndividual: globalBest!,
      generations: convergenceHistory.length,
      evaluations: totalEvaluations,
      demeStats,
      convergenceHistory
    };
  }

  // ==================== Initialization ====================

  /**
   * Initialize demes with random exemplars
   */
  private async initializeDemes(
    inputArity: number,
    outputType: 'boolean' | 'numeric'
  ): Promise<Deme[]> {
    const demes: Deme[] = [];

    for (let i = 0; i < this.config.demeCount; i++) {
      const exemplar = this.generateRandomTree(inputArity, outputType, 3);
      const population: Individual[] = [];

      // Generate initial population around exemplar
      for (let j = 0; j < this.config.populationSize; j++) {
        const tree = j === 0 
          ? exemplar 
          : this.mutate(this.cloneTree(exemplar), inputArity, outputType);
        
        population.push({
          id: crypto.randomUUID(),
          tree,
          score: 0,
          complexity: this.calculateComplexity(tree),
          generation: 0,
          parentIds: [],
          metadata: {}
        });
      }

      demes.push({
        id: `deme-${i}`,
        exemplar,
        population,
        generation: 0,
        bestScore: 0,
        stagnationCount: 0,
        metadata: {}
      });
    }

    return demes;
  }

  /**
   * Restart a stagnant deme
   */
  private async restartDeme(
    deme: Deme,
    inputArity: number,
    outputType: 'boolean' | 'numeric'
  ): Promise<void> {
    // Keep the best individual
    const best = deme.population.reduce(
      (best, ind) => ind.score > best.score ? ind : best,
      deme.population[0]
    );

    // Generate new exemplar
    deme.exemplar = this.generateRandomTree(inputArity, outputType, 3);
    
    // Regenerate population
    deme.population = [best];
    for (let i = 1; i < this.config.populationSize; i++) {
      const tree = this.mutate(this.cloneTree(deme.exemplar), inputArity, outputType);
      deme.population.push({
        id: crypto.randomUUID(),
        tree,
        score: 0,
        complexity: this.calculateComplexity(tree),
        generation: deme.generation,
        parentIds: [],
        metadata: {}
      });
    }

    deme.stagnationCount = 0;
  }

  // ==================== Genetic Operators ====================

  /**
   * Generate offspring through crossover and mutation
   */
  private async generateOffspring(
    deme: Deme,
    inputArity: number,
    outputType: 'boolean' | 'numeric'
  ): Promise<Individual[]> {
    const offspring: Individual[] = [];
    const targetCount = this.config.populationSize - this.config.elitismCount;

    while (offspring.length < targetCount) {
      if (Math.random() < this.config.crossoverRate && deme.population.length >= 2) {
        // Crossover
        const parent1 = this.tournamentSelect(deme.population);
        const parent2 = this.tournamentSelect(deme.population);
        const [child1, child2] = this.crossover(parent1.tree, parent2.tree);

        offspring.push(
          this.createIndividual(child1, deme.generation + 1, [parent1.id, parent2.id]),
          this.createIndividual(child2, deme.generation + 1, [parent1.id, parent2.id])
        );
      } else {
        // Mutation only
        const parent = this.tournamentSelect(deme.population);
        const child = this.mutate(this.cloneTree(parent.tree), inputArity, outputType);
        offspring.push(
          this.createIndividual(child, deme.generation + 1, [parent.id])
        );
      }
    }

    // Apply reduction if enabled
    if (this.config.reductionEnabled) {
      for (const ind of offspring) {
        ind.tree = this.reduce(ind.tree);
        ind.complexity = this.calculateComplexity(ind.tree);
      }
    }

    return offspring.slice(0, targetCount);
  }

  /**
   * Tournament selection
   */
  private tournamentSelect(population: Individual[]): Individual {
    let best: Individual | null = null;

    for (let i = 0; i < this.config.tournamentSize; i++) {
      const candidate = population[Math.floor(Math.random() * population.length)];
      if (!best || candidate.score > best.score) {
        best = candidate;
      }
    }

    return best!;
  }

  /**
   * Crossover two trees
   */
  private crossover(tree1: ComboNode, tree2: ComboNode): [ComboNode, ComboNode] {
    const clone1 = this.cloneTree(tree1);
    const clone2 = this.cloneTree(tree2);

    // Get random subtrees
    const nodes1 = this.collectNodes(clone1);
    const nodes2 = this.collectNodes(clone2);

    if (nodes1.length > 1 && nodes2.length > 1) {
      const idx1 = Math.floor(Math.random() * (nodes1.length - 1)) + 1;
      const idx2 = Math.floor(Math.random() * (nodes2.length - 1)) + 1;

      // Swap subtrees
      const temp = nodes1[idx1].node;
      this.replaceNode(clone1, nodes1[idx1].path, this.cloneTree(nodes2[idx2].node));
      this.replaceNode(clone2, nodes2[idx2].path, this.cloneTree(temp));
    }

    return [clone1, clone2];
  }

  /**
   * Mutate a tree
   */
  private mutate(
    tree: ComboNode,
    inputArity: number,
    outputType: 'boolean' | 'numeric'
  ): ComboNode {
    const nodes = this.collectNodes(tree);
    
    if (nodes.length === 0) {
      return this.generateRandomTree(inputArity, outputType, 2);
    }

    const mutationType = Math.random();

    if (mutationType < 0.3) {
      // Point mutation: change node type or value
      const idx = Math.floor(Math.random() * nodes.length);
      const node = nodes[idx].node;
      
      if (node.type === 'const') {
        node.value = (node.value as number) + (Math.random() - 0.5) * 2;
      } else if (node.type === 'arg') {
        node.argIndex = Math.floor(Math.random() * inputArity);
      } else if (node.children) {
        // Change operator
        const operators = outputType === 'boolean' 
          ? ['and', 'or', 'not'] 
          : ['plus', 'minus', 'times', 'div'];
        node.type = operators[Math.floor(Math.random() * operators.length)] as ComboNodeType;
      }
    } else if (mutationType < 0.6) {
      // Subtree replacement
      const idx = Math.floor(Math.random() * nodes.length);
      const newSubtree = this.generateRandomTree(inputArity, outputType, 2);
      this.replaceNode(tree, nodes[idx].path, newSubtree);
    } else if (mutationType < 0.8 && nodes.length > 1) {
      // Subtree deletion (replace with terminal)
      const idx = Math.floor(Math.random() * (nodes.length - 1)) + 1;
      const terminal: ComboNode = Math.random() < 0.5
        ? { type: 'arg', argIndex: Math.floor(Math.random() * inputArity) }
        : { type: 'const', value: Math.random() * 2 - 1 };
      this.replaceNode(tree, nodes[idx].path, terminal);
    } else {
      // Subtree insertion (wrap a node)
      const idx = Math.floor(Math.random() * nodes.length);
      const node = nodes[idx].node;
      const wrapper: ComboNode = {
        type: outputType === 'boolean' ? 'and' : 'plus',
        children: [
          this.cloneTree(node),
          this.generateRandomTree(inputArity, outputType, 1)
        ]
      };
      this.replaceNode(tree, nodes[idx].path, wrapper);
    }

    return tree;
  }

  // ==================== Selection ====================

  /**
   * Select survivors using NSGA-II-like approach (score + complexity)
   */
  private selectSurvivors(population: Individual[], targetSize: number): Individual[] {
    // Sort by score (descending), then by complexity (ascending)
    const sorted = population.sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.001) {
        return b.score - a.score;
      }
      return a.complexity - b.complexity;
    });

    // Keep elites
    const survivors = sorted.slice(0, this.config.elitismCount);

    // Fill remaining with diverse selection
    const remaining = sorted.slice(this.config.elitismCount);
    while (survivors.length < targetSize && remaining.length > 0) {
      // Prefer diverse individuals
      const idx = Math.floor(Math.random() * Math.min(remaining.length, 10));
      survivors.push(remaining.splice(idx, 1)[0]);
    }

    return survivors;
  }

  /**
   * Migrate best individuals between demes
   */
  private migrateBetweenDemes(demes: Deme[]): void {
    if (demes.length < 2) return;

    // Ring topology migration
    for (let i = 0; i < demes.length; i++) {
      const source = demes[i];
      const target = demes[(i + 1) % demes.length];

      // Find best in source
      const best = source.population.reduce(
        (best, ind) => ind.score > best.score ? ind : best,
        source.population[0]
      );

      // Add copy to target (replacing worst)
      const worstIdx = target.population.reduce(
        (worstIdx, ind, idx, arr) => ind.score < arr[worstIdx].score ? idx : worstIdx,
        0
      );

      target.population[worstIdx] = {
        ...best,
        id: crypto.randomUUID(),
        tree: this.cloneTree(best.tree)
      };
    }
  }

  // ==================== Evaluation ====================

  /**
   * Evaluate an individual against training examples
   */
  private evaluateIndividual(
    tree: ComboNode,
    examples: TrainingExample[],
    outputType: 'boolean' | 'numeric'
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const example of examples) {
      const weight = example.weight || 1;
      const predicted = this.executeTree(tree, example.inputs);
      
      if (outputType === 'boolean') {
        const correct = (predicted > 0.5) === example.output;
        totalScore += correct ? weight : 0;
      } else {
        // Numeric: use inverse squared error
        const error = Math.abs(predicted - (example.output as number));
        totalScore += weight / (1 + error * error);
      }
      
      totalWeight += weight;
    }

    // Penalize complexity
    const complexityPenalty = 0.001 * this.calculateComplexity(tree);
    
    return Math.max(0, (totalScore / totalWeight) - complexityPenalty);
  }

  /**
   * Execute a combo tree on inputs
   */
  private executeTree(tree: ComboNode, inputs: number[]): number {
    switch (tree.type) {
      case 'const':
        return tree.value as number;
      
      case 'arg':
        return inputs[tree.argIndex!] || 0;
      
      case 'and':
        return tree.children!.every(c => this.executeTree(c, inputs) > 0.5) ? 1 : 0;
      
      case 'or':
        return tree.children!.some(c => this.executeTree(c, inputs) > 0.5) ? 1 : 0;
      
      case 'not':
        return this.executeTree(tree.children![0], inputs) > 0.5 ? 0 : 1;
      
      case 'plus':
        return tree.children!.reduce((sum, c) => sum + this.executeTree(c, inputs), 0);
      
      case 'minus':
        return tree.children!.reduce((diff, c, i) => 
          i === 0 ? this.executeTree(c, inputs) : diff - this.executeTree(c, inputs), 0);
      
      case 'times':
        return tree.children!.reduce((prod, c) => prod * this.executeTree(c, inputs), 1);
      
      case 'div': {
        const num = this.executeTree(tree.children![0], inputs);
        const den = this.executeTree(tree.children![1], inputs);
        return den !== 0 ? num / den : 0;
      }
      
      case 'sin':
        return Math.sin(this.executeTree(tree.children![0], inputs));
      
      case 'cos':
        return Math.cos(this.executeTree(tree.children![0], inputs));
      
      case 'exp':
        return Math.exp(Math.min(10, this.executeTree(tree.children![0], inputs)));
      
      case 'log': {
        const val = this.executeTree(tree.children![0], inputs);
        return val > 0 ? Math.log(val) : 0;
      }
      
      case 'if': {
        const cond = this.executeTree(tree.children![0], inputs);
        return cond > 0.5 
          ? this.executeTree(tree.children![1], inputs)
          : this.executeTree(tree.children![2], inputs);
      }
      
      case 'impulse':
        return this.executeTree(tree.children![0], inputs) > 0.5 ? 1 : 0;
      
      default:
        return 0;
    }
  }

  // ==================== Tree Operations ====================

  /**
   * Generate a random tree
   */
  private generateRandomTree(
    inputArity: number,
    outputType: 'boolean' | 'numeric',
    maxDepth: number
  ): ComboNode {
    if (maxDepth <= 0 || Math.random() < 0.3) {
      // Terminal
      return Math.random() < 0.5
        ? { type: 'arg', argIndex: Math.floor(Math.random() * inputArity) }
        : { type: 'const', value: Math.random() * 2 - 1 };
    }

    // Non-terminal
    const operators = outputType === 'boolean'
      ? ['and', 'or', 'not', 'if']
      : ['plus', 'minus', 'times', 'div', 'sin', 'cos', 'if'];
    
    const op = operators[Math.floor(Math.random() * operators.length)] as ComboNodeType;
    const arity = op === 'not' ? 1 : (op === 'if' ? 3 : 2);

    return {
      type: op,
      children: Array.from({ length: arity }, () => 
        this.generateRandomTree(inputArity, outputType, maxDepth - 1)
      )
    };
  }

  /**
   * Clone a tree
   */
  private cloneTree(tree: ComboNode): ComboNode {
    return JSON.parse(JSON.stringify(tree));
  }

  /**
   * Collect all nodes with their paths
   */
  private collectNodes(
    tree: ComboNode,
    path: number[] = []
  ): Array<{ node: ComboNode; path: number[] }> {
    const result: Array<{ node: ComboNode; path: number[] }> = [{ node: tree, path }];

    if (tree.children) {
      for (let i = 0; i < tree.children.length; i++) {
        result.push(...this.collectNodes(tree.children[i], [...path, i]));
      }
    }

    return result;
  }

  /**
   * Replace a node at a given path
   */
  private replaceNode(tree: ComboNode, path: number[], newNode: ComboNode): void {
    if (path.length === 0) {
      Object.assign(tree, newNode);
      return;
    }

    let current = tree;
    for (let i = 0; i < path.length - 1; i++) {
      current = current.children![path[i]];
    }
    current.children![path[path.length - 1]] = newNode;
  }

  /**
   * Calculate tree complexity (number of nodes)
   */
  private calculateComplexity(tree: ComboNode): number {
    let count = 1;
    if (tree.children) {
      for (const child of tree.children) {
        count += this.calculateComplexity(child);
      }
    }
    return count;
  }

  /**
   * Reduce (simplify) a tree
   */
  private reduce(tree: ComboNode): ComboNode {
    // First, reduce children
    if (tree.children) {
      tree.children = tree.children.map(c => this.reduce(c));
    }

    // Apply reduction rules
    switch (tree.type) {
      case 'plus':
        // x + 0 = x
        if (tree.children!.length === 2) {
          if (tree.children![0].type === 'const' && tree.children![0].value === 0) {
            return tree.children![1];
          }
          if (tree.children![1].type === 'const' && tree.children![1].value === 0) {
            return tree.children![0];
          }
          // const + const = const
          if (tree.children![0].type === 'const' && tree.children![1].type === 'const') {
            return { 
              type: 'const', 
              value: (tree.children![0].value as number) + (tree.children![1].value as number) 
            };
          }
        }
        break;

      case 'times':
        // x * 1 = x, x * 0 = 0
        if (tree.children!.length === 2) {
          if (tree.children![0].type === 'const' && tree.children![0].value === 1) {
            return tree.children![1];
          }
          if (tree.children![1].type === 'const' && tree.children![1].value === 1) {
            return tree.children![0];
          }
          if (tree.children![0].type === 'const' && tree.children![0].value === 0) {
            return { type: 'const', value: 0 };
          }
          if (tree.children![1].type === 'const' && tree.children![1].value === 0) {
            return { type: 'const', value: 0 };
          }
        }
        break;

      case 'not':
        // not(not(x)) = x
        if (tree.children![0].type === 'not') {
          return tree.children![0].children![0];
        }
        break;

      case 'and':
        // x and true = x, x and false = false
        if (tree.children!.some(c => c.type === 'const' && c.value === 0)) {
          return { type: 'const', value: 0 };
        }
        tree.children = tree.children!.filter(c => !(c.type === 'const' && c.value !== 0));
        if (tree.children!.length === 0) {
          return { type: 'const', value: 1 };
        }
        if (tree.children!.length === 1) {
          return tree.children![0];
        }
        break;

      case 'or':
        // x or true = true, x or false = x
        if (tree.children!.some(c => c.type === 'const' && c.value !== 0)) {
          return { type: 'const', value: 1 };
        }
        tree.children = tree.children!.filter(c => !(c.type === 'const' && c.value === 0));
        if (tree.children!.length === 0) {
          return { type: 'const', value: 0 };
        }
        if (tree.children!.length === 1) {
          return tree.children![0];
        }
        break;
    }

    return tree;
  }

  /**
   * Calculate population diversity
   */
  private calculateDiversity(population: Individual[]): number {
    if (population.length < 2) return 0;

    // Use tree structure diversity
    const structures = new Set<string>();
    for (const ind of population) {
      structures.add(this.treeToString(ind.tree));
    }

    return structures.size / population.length;
  }

  /**
   * Convert tree to string representation
   */
  private treeToString(tree: ComboNode): string {
    if (tree.type === 'const') {
      return `C${(tree.value as number).toFixed(2)}`;
    }
    if (tree.type === 'arg') {
      return `$${tree.argIndex}`;
    }
    if (tree.children) {
      return `(${tree.type} ${tree.children.map(c => this.treeToString(c)).join(' ')})`;
    }
    return tree.type;
  }

  /**
   * Create an individual from a tree
   */
  private createIndividual(
    tree: ComboNode,
    generation: number,
    parentIds: string[]
  ): Individual {
    return {
      id: crypto.randomUUID(),
      tree,
      score: 0,
      complexity: this.calculateComplexity(tree),
      generation,
      parentIds,
      metadata: {}
    };
  }

  // ==================== State Management ====================

  /**
   * Save evolution state
   */
  private async saveState(problemId: string, state: any): Promise<void> {
    const key = `${this.statePrefix}${problemId}`;
    await this.env.MOSES_STATE.put(key, JSON.stringify(state));
  }

  /**
   * Load evolution state
   */
  async loadState(problemId: string): Promise<any> {
    const key = `${this.statePrefix}${problemId}`;
    return await this.env.MOSES_STATE.get(key, 'json');
  }

  /**
   * Convert best individual to human-readable program
   */
  treeToProgram(tree: ComboNode): string {
    return this.treeToString(tree);
  }
}

export default MOSESEvolutionary;
