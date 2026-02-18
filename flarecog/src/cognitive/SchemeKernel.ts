/**
 * Scheme-based Cognitive Grammar Kernel
 * 
 * Implements a minimal Scheme interpreter for symbolic reasoning and
 * cognitive grammar processing within the AtomSpace. This provides
 * a foundational layer for meta-cognitive operations and self-modification.
 * 
 * Based on the bootstrapping Lisp principles from pure parentheses.
 */

import { Atom, Link, Node } from "../types/cognitive";

/**
 * Scheme value types
 */
export type SchemeValue =
	| number
	| string
	| boolean
	| symbol
	| SchemePair
	| SchemeFunction
	| null;

export type symbol = { type: "symbol"; name: string };
export type SchemePair = { type: "pair"; car: SchemeValue; cdr: SchemeValue };
export type SchemeFunction = {
	type: "function";
	params: string[];
	body: SchemeValue;
	env: SchemeEnvironment;
};

/**
 * Scheme environment for variable bindings
 */
export class SchemeEnvironment {
	private bindings: Map<string, SchemeValue> = new Map();
	private parent: SchemeEnvironment | null = null;

	constructor(parent?: SchemeEnvironment) {
		this.parent = parent || null;
	}

	define(name: string, value: SchemeValue): void {
		this.bindings.set(name, value);
	}

	set(name: string, value: SchemeValue): void {
		if (this.bindings.has(name)) {
			this.bindings.set(name, value);
		} else if (this.parent) {
			this.parent.set(name, value);
		} else {
			throw new Error(`Undefined variable: ${name}`);
		}
	}

	get(name: string): SchemeValue {
		if (this.bindings.has(name)) {
			return this.bindings.get(name)!;
		} else if (this.parent) {
			return this.parent.get(name);
		} else {
			throw new Error(`Undefined variable: ${name}`);
		}
	}

	has(name: string): boolean {
		return this.bindings.has(name) || (this.parent?.has(name) ?? false);
	}
}

/**
 * Scheme Kernel - Minimal Scheme interpreter
 */
export class SchemeKernel {
	private globalEnv: SchemeEnvironment;

	constructor() {
		this.globalEnv = this.createGlobalEnvironment();
	}

	/**
	 * Create global environment with primitive operations
	 */
	private createGlobalEnvironment(): SchemeEnvironment {
		const env = new SchemeEnvironment();

		// Arithmetic primitives
		env.define("+", this.makePrimitive((args: number[]) => args.reduce((a, b) => a + b, 0)));
		env.define("-", this.makePrimitive((args: number[]) => args.reduce((a, b) => a - b)));
		env.define("*", this.makePrimitive((args: number[]) => args.reduce((a, b) => a * b, 1)));
		env.define("/", this.makePrimitive((args: number[]) => args.reduce((a, b) => a / b)));

		// Comparison primitives
		env.define("=", this.makePrimitive((args: number[]) => args[0] === args[1]));
		env.define("<", this.makePrimitive((args: number[]) => args[0] < args[1]));
		env.define(">", this.makePrimitive((args: number[]) => args[0] > args[1]));

		// List primitives
		env.define("cons", this.makePrimitive((args: SchemeValue[]) => 
			this.cons(args[0], args[1])
		));
		env.define("car", this.makePrimitive((args: SchemePair[]) => 
			this.car(args[0])
		));
		env.define("cdr", this.makePrimitive((args: SchemePair[]) => 
			this.cdr(args[0])
		));
		env.define("null?", this.makePrimitive((args: SchemeValue[]) => 
			args[0] === null
		));

		// Type predicates
		env.define("number?", this.makePrimitive((args: SchemeValue[]) => 
			typeof args[0] === "number"
		));
		env.define("symbol?", this.makePrimitive((args: SchemeValue[]) => 
			typeof args[0] === "object" && args[0] !== null && 
			(args[0] as any).type === "symbol"
		));
		env.define("pair?", this.makePrimitive((args: SchemeValue[]) => 
			typeof args[0] === "object" && args[0] !== null && 
			(args[0] as any).type === "pair"
		));

		// Boolean primitives
		env.define("not", this.makePrimitive((args: boolean[]) => !args[0]));

		return env;
	}

	/**
	 * Create a primitive function wrapper
	 */
	private makePrimitive(fn: (args: any[]) => any): any {
		return { type: "primitive", fn };
	}

	/**
	 * Parse Scheme expression from string
	 */
	parse(input: string): SchemeValue {
		const tokens = this.tokenize(input);
		const [expr] = this.readFromTokens(tokens);
		return expr;
	}

	/**
	 * Tokenize input string
	 */
	private tokenize(input: string): string[] {
		return input
			.replace(/\(/g, " ( ")
			.replace(/\)/g, " ) ")
			.trim()
			.split(/\s+/)
			.filter((t) => t.length > 0);
	}

	/**
	 * Read expression from tokens
	 */
	private readFromTokens(tokens: string[]): [SchemeValue, string[]] {
		if (tokens.length === 0) {
			throw new Error("Unexpected EOF");
		}

		const token = tokens.shift()!;

		if (token === "(") {
			const list: SchemeValue[] = [];
			while (tokens[0] !== ")") {
				const [expr, remaining] = this.readFromTokens(tokens);
				list.push(expr);
			}
			tokens.shift(); // Remove ')'
			return [this.listToScheme(list), tokens];
		} else if (token === ")") {
			throw new Error("Unexpected )");
		} else {
			return [this.atom(token), tokens];
		}
	}

	/**
	 * Convert token to atomic value
	 */
	private atom(token: string): SchemeValue {
		// Number
		if (/^-?\d+(\.\d+)?$/.test(token)) {
			return parseFloat(token);
		}
		// Boolean
		if (token === "#t") return true;
		if (token === "#f") return false;
		// String
		if (token.startsWith('"') && token.endsWith('"')) {
			return token.slice(1, -1);
		}
		// Symbol
		return { type: "symbol", name: token } as symbol;
	}

	/**
	 * Convert JavaScript array to Scheme list
	 */
	private listToScheme(list: SchemeValue[]): SchemeValue {
		if (list.length === 0) return null;
		return this.cons(list[0], this.listToScheme(list.slice(1)));
	}

	/**
	 * Convert Scheme list to JavaScript array
	 */
	private schemeToList(value: SchemeValue): SchemeValue[] {
		if (value === null) return [];
		if (typeof value === "object" && (value as any).type === "pair") {
			const pair = value as SchemePair;
			return [pair.car, ...this.schemeToList(pair.cdr)];
		}
		return [value];
	}

	/**
	 * Cons - construct pair
	 */
	private cons(car: SchemeValue, cdr: SchemeValue): SchemePair {
		return { type: "pair", car, cdr };
	}

	/**
	 * Car - first element of pair
	 */
	private car(pair: SchemePair): SchemeValue {
		if (typeof pair !== "object" || pair.type !== "pair") {
			throw new Error("car: argument must be a pair");
		}
		return pair.car;
	}

	/**
	 * Cdr - rest of pair
	 */
	private cdr(pair: SchemePair): SchemeValue {
		if (typeof pair !== "object" || pair.type !== "pair") {
			throw new Error("cdr: argument must be a pair");
		}
		return pair.cdr;
	}

	/**
	 * Evaluate Scheme expression
	 */
	eval(expr: SchemeValue, env?: SchemeEnvironment): SchemeValue {
		env = env || this.globalEnv;

		// Self-evaluating expressions
		if (typeof expr === "number" || typeof expr === "string" || typeof expr === "boolean") {
			return expr;
		}

		// Null
		if (expr === null) {
			return null;
		}

		// Symbol - variable reference
		if (typeof expr === "object" && (expr as any).type === "symbol") {
			const sym = expr as symbol;
			return env.get(sym.name);
		}

		// List - special forms or function application
		if (typeof expr === "object" && (expr as any).type === "pair") {
			const list = this.schemeToList(expr);
			if (list.length === 0) return null;

			const first = list[0];

			// Special form: quote
			if (this.isSymbol(first, "quote")) {
				return list[1];
			}

			// Special form: if
			if (this.isSymbol(first, "if")) {
				const test = this.eval(list[1], env);
				return test ? this.eval(list[2], env) : this.eval(list[3], env);
			}

			// Special form: define
			if (this.isSymbol(first, "define")) {
				const name = (list[1] as symbol).name;
				const value = this.eval(list[2], env);
				env.define(name, value);
				return value;
			}

			// Special form: lambda
			if (this.isSymbol(first, "lambda")) {
				const params = this.schemeToList(list[1]).map((p) => (p as symbol).name);
				const body = list[2];
				return {
					type: "function",
					params,
					body,
					env,
				} as SchemeFunction;
			}

			// Special form: begin
			if (this.isSymbol(first, "begin")) {
				let result: SchemeValue = null;
				for (let i = 1; i < list.length; i++) {
					result = this.eval(list[i], env);
				}
				return result;
			}

			// Function application
			const fn = this.eval(first, env);
			const args = list.slice(1).map((arg) => this.eval(arg, env));

			// Primitive function
			if (typeof fn === "object" && (fn as any).type === "primitive") {
				return (fn as any).fn(args);
			}

			// User-defined function
			if (typeof fn === "object" && (fn as any).type === "function") {
				const func = fn as SchemeFunction;
				const newEnv = new SchemeEnvironment(func.env);
				for (let i = 0; i < func.params.length; i++) {
					newEnv.define(func.params[i], args[i]);
				}
				return this.eval(func.body, newEnv);
			}

			throw new Error(`Not a function: ${JSON.stringify(first)}`);
		}

		throw new Error(`Cannot evaluate: ${JSON.stringify(expr)}`);
	}

	/**
	 * Check if value is a symbol with given name
	 */
	private isSymbol(value: SchemeValue, name: string): boolean {
		return (
			typeof value === "object" &&
			value !== null &&
			(value as any).type === "symbol" &&
			(value as symbol).name === name
		);
	}

	/**
	 * Execute Scheme code from string
	 */
	execute(code: string): SchemeValue {
		const expr = this.parse(code);
		return this.eval(expr);
	}

	/**
	 * Convert AtomSpace atom to Scheme representation
	 */
	atomToScheme(atom: Atom): SchemeValue {
		if ("name" in atom && atom.name) {
			// Node
			return this.listToScheme([
				{ type: "symbol", name: atom.type } as symbol,
				atom.name,
			]);
		} else if ("outgoing" in atom) {
			// Link
			const link = atom as Link;
			return this.listToScheme([
				{ type: "symbol", name: atom.type } as symbol,
				...link.outgoing.map((id) => ({ type: "symbol", name: id } as symbol)),
			]);
		}
		return null;
	}

	/**
	 * Convert Scheme representation to AtomSpace atom structure
	 */
	schemeToAtom(expr: SchemeValue): Partial<Atom> | null {
		if (typeof expr !== "object" || expr === null || (expr as any).type !== "pair") {
			return null;
		}

		const list = this.schemeToList(expr);
		if (list.length < 2) return null;

		const type = (list[0] as symbol).name;
		
		// Node types
		if (["ConceptNode", "PredicateNode", "VariableNode"].includes(type)) {
			return {
				type: type as any,
				name: list[1] as string,
			};
		}

		// Link types
		if (["EvaluationLink", "InheritanceLink", "ImplicationLink"].includes(type)) {
			return {
				type: type as any,
				outgoing: list.slice(1).map((v) => (v as symbol).name),
			} as Partial<Link>;
		}

		return null;
	}

	/**
	 * Execute cognitive operation in Scheme
	 */
	cognitiveOperation(operation: string, atoms: Atom[]): SchemeValue {
		// Convert atoms to Scheme
		const schemeAtoms = atoms.map((a) => this.atomToScheme(a));
		
		// Build operation expression
		const operationExpr = this.listToScheme([
			{ type: "symbol", name: operation } as symbol,
			...schemeAtoms,
		]);

		// Evaluate
		return this.eval(operationExpr);
	}
}

/**
 * Cognitive Grammar - High-level cognitive operations using Scheme
 */
export class CognitiveGrammar {
	private kernel: SchemeKernel;

	constructor() {
		this.kernel = new SchemeKernel();
		this.initializeCognitiveOperations();
	}

	/**
	 * Initialize cognitive operation definitions
	 */
	private initializeCognitiveOperations(): void {
		// Define cognitive primitives in Scheme
		
		// Pattern matching
		this.kernel.execute(`
			(define (match-pattern pattern atom)
				(if (symbol? pattern)
					#t
					(if (pair? pattern)
						(if (pair? atom)
							(if (match-pattern (car pattern) (car atom))
								(match-pattern (cdr pattern) (cdr atom))
								#f)
							#f)
						(= pattern atom))))
		`);

		// Concept composition
		this.kernel.execute(`
			(define (compose-concepts c1 c2)
				(cons 'ComposedConcept (cons c1 (cons c2 '()))))
		`);
	}

	/**
	 * Execute cognitive grammar operation
	 */
	execute(code: string): SchemeValue {
		return this.kernel.execute(code);
	}

	/**
	 * Get the underlying Scheme kernel
	 */
	getKernel(): SchemeKernel {
		return this.kernel;
	}
}
