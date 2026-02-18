/**
 * Unit tests for SchemeKernel, SchemeEnvironment, and CognitiveGrammar
 *
 * Tests the Scheme interpreter for symbolic reasoning and cognitive grammar
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SchemeKernel,
  SchemeEnvironment,
  CognitiveGrammar,
  SchemeValue,
  SchemePair,
  symbol,
} from '../SchemeKernel';
import { Atom, Link, Node } from '../../types/cognitive';

// ==================== Helper Functions ====================

function createConceptNode(name: string): Node {
  return {
    id: `concept-${name}`,
    type: 'ConceptNode',
    name,
    truthValue: { strength: 0.8, confidence: 0.9 },
    attentionValue: { sti: 50, lti: 10, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createLink(type: string, outgoing: string[]): Link {
  return {
    id: `link-${type}-${outgoing.join('-')}`,
    type: type as any,
    outgoing,
    truthValue: { strength: 0.8, confidence: 0.9 },
    attentionValue: { sti: 30, lti: 10, vlti: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function isPair(value: SchemeValue): value is SchemePair {
  return typeof value === 'object' && value !== null && (value as any).type === 'pair';
}

function isSymbol(value: SchemeValue): value is symbol {
  return typeof value === 'object' && value !== null && (value as any).type === 'symbol';
}

// ==================== SchemeEnvironment Tests ====================

describe('SchemeEnvironment', () => {
  describe('constructor', () => {
    it('should create environment without parent', () => {
      const env = new SchemeEnvironment();
      expect(env.has('x')).toBe(false);
    });

    it('should create environment with parent', () => {
      const parent = new SchemeEnvironment();
      parent.define('x', 42);

      const child = new SchemeEnvironment(parent);
      expect(child.has('x')).toBe(true);
    });
  });

  describe('define', () => {
    it('should define a new variable', () => {
      const env = new SchemeEnvironment();
      env.define('x', 42);

      expect(env.has('x')).toBe(true);
      expect(env.get('x')).toBe(42);
    });

    it('should overwrite existing variable', () => {
      const env = new SchemeEnvironment();
      env.define('x', 42);
      env.define('x', 100);

      expect(env.get('x')).toBe(100);
    });

    it('should define various types', () => {
      const env = new SchemeEnvironment();

      env.define('num', 3.14);
      env.define('str', 'hello');
      env.define('bool', true);
      env.define('nil', null);

      expect(env.get('num')).toBe(3.14);
      expect(env.get('str')).toBe('hello');
      expect(env.get('bool')).toBe(true);
      expect(env.get('nil')).toBe(null);
    });
  });

  describe('set', () => {
    it('should update existing variable in current environment', () => {
      const env = new SchemeEnvironment();
      env.define('x', 42);
      env.set('x', 100);

      expect(env.get('x')).toBe(100);
    });

    it('should update variable in parent environment', () => {
      const parent = new SchemeEnvironment();
      parent.define('x', 42);

      const child = new SchemeEnvironment(parent);
      child.set('x', 100);

      expect(parent.get('x')).toBe(100);
    });

    it('should throw error for undefined variable', () => {
      const env = new SchemeEnvironment();

      expect(() => env.set('undefined', 1)).toThrow('Undefined variable: undefined');
    });
  });

  describe('get', () => {
    it('should retrieve variable from current environment', () => {
      const env = new SchemeEnvironment();
      env.define('x', 42);

      expect(env.get('x')).toBe(42);
    });

    it('should retrieve variable from parent environment', () => {
      const parent = new SchemeEnvironment();
      parent.define('x', 42);

      const child = new SchemeEnvironment(parent);

      expect(child.get('x')).toBe(42);
    });

    it('should shadow parent variable with child variable', () => {
      const parent = new SchemeEnvironment();
      parent.define('x', 42);

      const child = new SchemeEnvironment(parent);
      child.define('x', 100);

      expect(child.get('x')).toBe(100);
      expect(parent.get('x')).toBe(42);
    });

    it('should throw error for undefined variable', () => {
      const env = new SchemeEnvironment();

      expect(() => env.get('undefined')).toThrow('Undefined variable: undefined');
    });
  });

  describe('has', () => {
    it('should return true for existing variable', () => {
      const env = new SchemeEnvironment();
      env.define('x', 42);

      expect(env.has('x')).toBe(true);
    });

    it('should return true for variable in parent', () => {
      const parent = new SchemeEnvironment();
      parent.define('x', 42);

      const child = new SchemeEnvironment(parent);

      expect(child.has('x')).toBe(true);
    });

    it('should return false for undefined variable', () => {
      const env = new SchemeEnvironment();

      expect(env.has('undefined')).toBe(false);
    });
  });
});

// ==================== SchemeKernel Parse Tests ====================

describe('SchemeKernel.parse', () => {
  let kernel: SchemeKernel;

  beforeEach(() => {
    kernel = new SchemeKernel();
  });

  describe('numbers', () => {
    it('should parse integers', () => {
      expect(kernel.parse('42')).toBe(42);
      expect(kernel.parse('0')).toBe(0);
      expect(kernel.parse('-17')).toBe(-17);
    });

    it('should parse floating point numbers', () => {
      expect(kernel.parse('3.14')).toBeCloseTo(3.14);
      expect(kernel.parse('-2.5')).toBeCloseTo(-2.5);
    });
  });

  describe('booleans', () => {
    it('should parse true', () => {
      expect(kernel.parse('#t')).toBe(true);
    });

    it('should parse false', () => {
      expect(kernel.parse('#f')).toBe(false);
    });
  });

  describe('strings', () => {
    it('should parse quoted strings', () => {
      expect(kernel.parse('"hello"')).toBe('hello');
      expect(kernel.parse('"world"')).toBe('world');
    });
  });

  describe('symbols', () => {
    it('should parse symbols', () => {
      const result = kernel.parse('foo');
      expect(isSymbol(result)).toBe(true);
      expect((result as symbol).name).toBe('foo');
    });

    it('should parse multi-character symbols', () => {
      const result = kernel.parse('hello-world');
      expect(isSymbol(result)).toBe(true);
      expect((result as symbol).name).toBe('hello-world');
    });
  });

  describe('lists', () => {
    it('should parse empty list as null', () => {
      expect(kernel.parse('()')).toBe(null);
    });

    it('should parse simple list', () => {
      const result = kernel.parse('(1 2 3)');
      expect(isPair(result)).toBe(true);

      const pair = result as SchemePair;
      expect(pair.car).toBe(1);
    });

    it('should parse nested lists', () => {
      const result = kernel.parse('((1 2) (3 4))');
      expect(isPair(result)).toBe(true);
    });

    it('should parse mixed types in list', () => {
      const result = kernel.parse('(+ 1 2)');
      expect(isPair(result)).toBe(true);

      const pair = result as SchemePair;
      expect(isSymbol(pair.car)).toBe(true);
      expect((pair.car as symbol).name).toBe('+');
    });
  });

  describe('error handling', () => {
    it('should throw on unexpected )', () => {
      expect(() => kernel.parse(')')).toThrow('Unexpected )');
    });

    it('should throw on EOF', () => {
      expect(() => kernel.parse('')).toThrow('Unexpected EOF');
    });
  });
});

// ==================== SchemeKernel Eval Tests ====================

describe('SchemeKernel.eval', () => {
  let kernel: SchemeKernel;

  beforeEach(() => {
    kernel = new SchemeKernel();
  });

  describe('self-evaluating expressions', () => {
    it('should return numbers as-is', () => {
      expect(kernel.eval(42)).toBe(42);
      expect(kernel.eval(3.14)).toBeCloseTo(3.14);
    });

    it('should return strings as-is', () => {
      expect(kernel.eval('hello')).toBe('hello');
    });

    it('should return booleans as-is', () => {
      expect(kernel.eval(true)).toBe(true);
      expect(kernel.eval(false)).toBe(false);
    });

    it('should return null as-is', () => {
      expect(kernel.eval(null)).toBe(null);
    });
  });

  describe('arithmetic primitives', () => {
    it('should add numbers', () => {
      expect(kernel.execute('(+ 1 2 3)')).toBe(6);
      expect(kernel.execute('(+ 10 -5)')).toBe(5);
    });

    it('should subtract numbers', () => {
      expect(kernel.execute('(- 10 3)')).toBe(7);
      expect(kernel.execute('(- 5 2 1)')).toBe(2);
    });

    it('should multiply numbers', () => {
      expect(kernel.execute('(* 2 3 4)')).toBe(24);
      expect(kernel.execute('(* 5 -2)')).toBe(-10);
    });

    it('should divide numbers', () => {
      expect(kernel.execute('(/ 10 2)')).toBe(5);
      expect(kernel.execute('(/ 100 5 2)')).toBe(10);
    });
  });

  describe('comparison primitives', () => {
    it('should compare equality', () => {
      expect(kernel.execute('(= 5 5)')).toBe(true);
      expect(kernel.execute('(= 5 6)')).toBe(false);
    });

    it('should compare less than', () => {
      expect(kernel.execute('(< 3 5)')).toBe(true);
      expect(kernel.execute('(< 5 3)')).toBe(false);
    });

    it('should compare greater than', () => {
      expect(kernel.execute('(> 5 3)')).toBe(true);
      expect(kernel.execute('(> 3 5)')).toBe(false);
    });
  });

  describe('list primitives', () => {
    it('should construct pairs with cons', () => {
      const result = kernel.execute('(cons 1 2)');
      expect(isPair(result)).toBe(true);
      expect((result as SchemePair).car).toBe(1);
      expect((result as SchemePair).cdr).toBe(2);
    });

    it('should get first element with car', () => {
      expect(kernel.execute('(car (cons 1 2))')).toBe(1);
    });

    it('should get rest with cdr', () => {
      expect(kernel.execute('(cdr (cons 1 2))')).toBe(2);
    });

    it('should check null with null?', () => {
      expect(kernel.execute('(null? ())')).toBe(true);
      expect(kernel.execute('(null? (cons 1 2))')).toBe(false);
    });
  });

  describe('type predicates', () => {
    it('should check numbers', () => {
      expect(kernel.execute('(number? 42)')).toBe(true);
      expect(kernel.execute('(number? "hello")')).toBe(false);
    });

    it('should check symbols', () => {
      expect(kernel.execute('(symbol? (quote foo))')).toBe(true);
      expect(kernel.execute('(symbol? 42)')).toBe(false);
    });

    it('should check pairs', () => {
      expect(kernel.execute('(pair? (cons 1 2))')).toBe(true);
      expect(kernel.execute('(pair? 42)')).toBe(false);
    });
  });

  describe('boolean primitives', () => {
    it('should negate with not', () => {
      expect(kernel.execute('(not #t)')).toBe(false);
      expect(kernel.execute('(not #f)')).toBe(true);
    });
  });
});

// ==================== SchemeKernel Special Forms ====================

describe('SchemeKernel special forms', () => {
  let kernel: SchemeKernel;

  beforeEach(() => {
    kernel = new SchemeKernel();
  });

  describe('quote', () => {
    it('should return symbol without evaluating', () => {
      const result = kernel.execute('(quote foo)');
      expect(isSymbol(result)).toBe(true);
      expect((result as symbol).name).toBe('foo');
    });

    it('should return list without evaluating', () => {
      const result = kernel.execute('(quote (1 2 3))');
      expect(isPair(result)).toBe(true);
    });
  });

  describe('if', () => {
    it('should evaluate then branch when true', () => {
      expect(kernel.execute('(if #t 1 2)')).toBe(1);
    });

    it('should evaluate else branch when false', () => {
      expect(kernel.execute('(if #f 1 2)')).toBe(2);
    });

    it('should evaluate condition', () => {
      expect(kernel.execute('(if (> 5 3) 1 2)')).toBe(1);
      expect(kernel.execute('(if (< 5 3) 1 2)')).toBe(2);
    });

    it('should work with truthy values', () => {
      expect(kernel.execute('(if 1 "yes" "no")')).toBe('yes');
      expect(kernel.execute('(if () "yes" "no")')).toBe('no');
    });
  });

  describe('define', () => {
    it('should define variable', () => {
      kernel.execute('(define x 42)');
      expect(kernel.execute('x')).toBe(42);
    });

    it('should define computed value', () => {
      kernel.execute('(define x (+ 1 2 3))');
      expect(kernel.execute('x')).toBe(6);
    });

    it('should allow redefining', () => {
      kernel.execute('(define x 42)');
      kernel.execute('(define x 100)');
      expect(kernel.execute('x')).toBe(100);
    });
  });

  describe('lambda', () => {
    it('should create function', () => {
      const fn = kernel.execute('(lambda (x) x)');
      expect(typeof fn).toBe('object');
      expect((fn as any).type).toBe('function');
    });

    it('should execute function', () => {
      kernel.execute('(define identity (lambda (x) x))');
      expect(kernel.execute('(identity 42)')).toBe(42);
    });

    it('should support multiple parameters', () => {
      kernel.execute('(define add (lambda (a b) (+ a b)))');
      expect(kernel.execute('(add 3 4)')).toBe(7);
    });

    it('should support closures', () => {
      kernel.execute('(define make-adder (lambda (n) (lambda (x) (+ x n))))');
      kernel.execute('(define add5 (make-adder 5))');
      expect(kernel.execute('(add5 10)')).toBe(15);
    });

    it('should support lexical scoping', () => {
      kernel.execute('(define x 10)');
      kernel.execute('(define get-x (lambda () x))');
      kernel.execute('(define x 20)');
      // Closure captures environment at definition time
      // But since we redefine x in global, it affects the closure's parent env
      expect(kernel.execute('(get-x)')).toBe(20);
    });
  });

  describe('begin', () => {
    it('should execute sequence and return last', () => {
      expect(kernel.execute('(begin 1 2 3)')).toBe(3);
    });

    it('should execute side effects', () => {
      kernel.execute('(begin (define x 1) (define y 2))');
      expect(kernel.execute('x')).toBe(1);
      expect(kernel.execute('y')).toBe(2);
    });

    it('should return null for empty begin', () => {
      expect(kernel.execute('(begin)')).toBe(null);
    });
  });
});

// ==================== SchemeKernel Execute Tests ====================

describe('SchemeKernel.execute', () => {
  let kernel: SchemeKernel;

  beforeEach(() => {
    kernel = new SchemeKernel();
  });

  it('should execute complex expressions', () => {
    // Factorial function
    kernel.execute(`
      (define factorial
        (lambda (n)
          (if (= n 0)
              1
              (* n (factorial (- n 1))))))
    `);

    expect(kernel.execute('(factorial 5)')).toBe(120);
    expect(kernel.execute('(factorial 0)')).toBe(1);
  });

  it('should execute nested function calls', () => {
    expect(kernel.execute('(+ (* 2 3) (* 4 5))')).toBe(26);
  });

  it('should handle deeply nested expressions', () => {
    expect(kernel.execute('(+ 1 (+ 2 (+ 3 (+ 4 5))))')).toBe(15);
  });
});

// ==================== Atom Conversion Tests ====================

describe('SchemeKernel atom conversion', () => {
  let kernel: SchemeKernel;

  beforeEach(() => {
    kernel = new SchemeKernel();
  });

  describe('atomToScheme', () => {
    it('should convert ConceptNode to Scheme list', () => {
      const node = createConceptNode('Cat');
      const result = kernel.atomToScheme(node);

      expect(isPair(result)).toBe(true);
      const pair = result as SchemePair;
      expect(isSymbol(pair.car)).toBe(true);
      expect((pair.car as symbol).name).toBe('ConceptNode');
    });

    it('should convert Link to Scheme list', () => {
      const link = createLink('InheritanceLink', ['child', 'parent']);
      const result = kernel.atomToScheme(link);

      expect(isPair(result)).toBe(true);
      const pair = result as SchemePair;
      expect(isSymbol(pair.car)).toBe(true);
      expect((pair.car as symbol).name).toBe('InheritanceLink');
    });

    it('should handle node without name', () => {
      const node: Node = {
        id: 'num1',
        type: 'NumberNode',
        name: '',
        truthValue: { strength: 1, confidence: 1 },
        attentionValue: { sti: 0, lti: 0, vlti: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Node without name should return null (no name property matches)
      const result = kernel.atomToScheme(node);
      expect(result).toBe(null);
    });
  });

  describe('schemeToAtom', () => {
    it('should convert Scheme ConceptNode to partial atom', () => {
      const expr = kernel.parse('(ConceptNode "Cat")');
      const result = kernel.schemeToAtom(expr);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('ConceptNode');
      expect((result as any).name).toBe('Cat');
    });

    it('should convert Scheme InheritanceLink to partial atom', () => {
      const expr = kernel.parse('(InheritanceLink child parent)');
      const result = kernel.schemeToAtom(expr);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('InheritanceLink');
      expect((result as any).outgoing).toEqual(['child', 'parent']);
    });

    it('should return null for non-pair input', () => {
      expect(kernel.schemeToAtom(42)).toBe(null);
      expect(kernel.schemeToAtom('string')).toBe(null);
      expect(kernel.schemeToAtom(null)).toBe(null);
    });

    it('should return null for too short list', () => {
      const expr = kernel.parse('(ConceptNode)');
      expect(kernel.schemeToAtom(expr)).toBe(null);
    });

    it('should return null for unknown type', () => {
      const expr = kernel.parse('(UnknownType "name")');
      expect(kernel.schemeToAtom(expr)).toBe(null);
    });
  });
});

// ==================== CognitiveGrammar Tests ====================

describe('CognitiveGrammar', () => {
  // Note: CognitiveGrammar uses (define (f x) body) syntax which SchemeKernel
  // doesn't support. The SchemeKernel only supports (define name value).
  // These tests document the current limitation.

  describe('constructor', () => {
    it('should throw error due to unsupported define syntax', () => {
      // CognitiveGrammar's initializeCognitiveOperations uses (define (f x) body)
      // which is not supported by the basic SchemeKernel implementation
      expect(() => new CognitiveGrammar()).toThrow('Undefined variable');
    });
  });

  describe('SchemeKernel workaround for cognitive operations', () => {
    // Using SchemeKernel directly with supported syntax
    let kernel: SchemeKernel;

    beforeEach(() => {
      kernel = new SchemeKernel();
    });

    it('should support lambda-based function definition', () => {
      // This is the supported way to define functions
      kernel.execute(`
        (define match-pattern
          (lambda (pattern atom)
            (if (symbol? pattern)
                #t
                (= pattern atom))))
      `);

      // Should work with symbol patterns
      const result = kernel.execute('(match-pattern (quote x) 42)');
      expect(result).toBe(true);
    });

    it('should support compose-concepts as lambda', () => {
      kernel.execute(`
        (define compose-concepts
          (lambda (c1 c2)
            (cons (quote ComposedConcept) (cons c1 (cons c2 ())))))
      `);

      const result = kernel.execute('(compose-concepts (quote cat) (quote animal))');
      expect(isPair(result)).toBe(true);

      const pair = result as SchemePair;
      expect(isSymbol(pair.car)).toBe(true);
      expect((pair.car as symbol).name).toBe('ComposedConcept');
    });
  });
});

// ==================== Error Handling Tests ====================

describe('Error Handling', () => {
  let kernel: SchemeKernel;

  beforeEach(() => {
    kernel = new SchemeKernel();
  });

  it('should throw on undefined variable', () => {
    expect(() => kernel.execute('undefined-var')).toThrow('Undefined variable: undefined-var');
  });

  it('should throw on non-function application', () => {
    expect(() => kernel.execute('(42 1 2)')).toThrow('Not a function');
  });

  it('should throw on car of non-pair', () => {
    expect(() => kernel.execute('(car 42)')).toThrow('car: argument must be a pair');
  });

  it('should throw on cdr of non-pair', () => {
    expect(() => kernel.execute('(cdr 42)')).toThrow('cdr: argument must be a pair');
  });
});

// ==================== Integration Tests ====================

describe('Integration', () => {
  let kernel: SchemeKernel;

  beforeEach(() => {
    kernel = new SchemeKernel();
  });

  it('should implement map function', () => {
    kernel.execute(`
      (define map
        (lambda (f lst)
          (if (null? lst)
              ()
              (cons (f (car lst)) (map f (cdr lst))))))
    `);

    kernel.execute('(define double (lambda (x) (* x 2)))');

    const result = kernel.execute('(map double (quote (1 2 3)))');
    expect(isPair(result)).toBe(true);

    // First element should be 2 (1 * 2)
    expect((result as SchemePair).car).toBe(2);
  });

  it('should implement filter function', () => {
    kernel.execute(`
      (define filter
        (lambda (pred lst)
          (if (null? lst)
              ()
              (if (pred (car lst))
                  (cons (car lst) (filter pred (cdr lst)))
                  (filter pred (cdr lst))))))
    `);

    kernel.execute('(define positive? (lambda (x) (> x 0)))');

    const result = kernel.execute('(filter positive? (quote (1 -2 3 -4 5)))');
    expect(isPair(result)).toBe(true);

    // First element should be 1
    expect((result as SchemePair).car).toBe(1);
  });

  it('should implement reduce/fold function', () => {
    kernel.execute(`
      (define reduce
        (lambda (f init lst)
          (if (null? lst)
              init
              (reduce f (f init (car lst)) (cdr lst)))))
    `);

    // Sum of list
    const sum = kernel.execute('(reduce + 0 (quote (1 2 3 4 5)))');
    expect(sum).toBe(15);

    // Product of list
    const product = kernel.execute('(reduce * 1 (quote (1 2 3 4 5)))');
    expect(product).toBe(120);
  });

  it('should handle recursive data structures', () => {
    // Build a tree: (node value left right)
    kernel.execute(`
      (define make-node
        (lambda (value left right)
          (cons value (cons left (cons right ())))))
    `);

    kernel.execute(`
      (define node-value (lambda (node) (car node)))
    `);

    kernel.execute(`
      (define node-left (lambda (node) (car (cdr node))))
    `);

    kernel.execute(`
      (define node-right (lambda (node) (car (cdr (cdr node)))))
    `);

    kernel.execute('(define leaf (make-node 1 () ()))');
    expect(kernel.execute('(node-value leaf)')).toBe(1);
    expect(kernel.execute('(node-left leaf)')).toBe(null);
  });
});
