import { parseSourceFile, type SourceNode } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const MAX_NESTING_DEPTH = 3;

const NESTING_TYPES = new Set([
      'ForStatement',
      'ForInStatement',
      'ForOfStatement',
      'WhileStatement',
      'DoWhileStatement',
      'SwitchStatement',
      'TryStatement',
]);

const FUNCTION_TYPES = new Set([
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression',
      'ObjectMethod',
      'ClassMethod',
      'ClassPrivateMethod',
]);

interface DeepNestingFinding {
      line: number;
      depth: number;
}

const isSourceNode = (value: unknown): value is SourceNode => {
      return typeof value === 'object' && value !== null && 'type' in value;
};

const walkChildren = (node: SourceNode, depth: number, results: DeepNestingFinding[]): void => {
      for (const value of Object.values(node)) {
            if (Array.isArray(value)) {
                  value.filter(isSourceNode).forEach((child) => walk(child, depth, results));
            } else if (isSourceNode(value)) {
                  walk(value, depth, results);
            }
      }
};

const checkDepth = (newDepth: number, line: number | undefined, results: DeepNestingFinding[]): void => {
      if (newDepth > MAX_NESTING_DEPTH && line !== undefined) {
            results.push({ line, depth: newDepth });
      }
};

const walkIfChild = (value: unknown, depth: number, results: DeepNestingFinding[]): void => {
      if (isSourceNode(value)) {
            walk(value, depth, results);
      }
};

const walkIfAlternate = (alternate: unknown, depth: number, results: DeepNestingFinding[]): void => {
      if (!isSourceNode(alternate)) {
            return;
      }
      if (alternate.type === 'IfStatement') {
            walkIfChain(alternate, depth, results);
            return;
      }
      walk(alternate, depth + 1, results);
};

const walkIfChain = (node: SourceNode, depth: number, results: DeepNestingFinding[]): void => {
      const chainDepth = depth + 1;
      checkDepth(chainDepth, node.loc?.start.line, results);
      walkIfChild(node.test, chainDepth, results);
      walkIfChild(node.consequent, chainDepth, results);
      walkIfAlternate(node.alternate, depth, results);
};

type NodeWalker = (node: SourceNode, depth: number, results: DeepNestingFinding[]) => void;

const walkFunction: NodeWalker = (node, _depth, results) => {
      walkChildren(node, 0, results);
};

const walkNestingBlock: NodeWalker = (node, depth, results) => {
      const newDepth = depth + 1;
      checkDepth(newDepth, node.loc?.start.line, results);
      walkChildren(node, newDepth, results);
};

const selectWalker = (node: SourceNode): NodeWalker => {
      return FUNCTION_TYPES.has(node.type)
            ? walkFunction
            : node.type === 'IfStatement'
              ? walkIfChain
              : NESTING_TYPES.has(node.type)
                ? walkNestingBlock
                : walkChildren;
};

const walk: NodeWalker = (node, depth, results) => {
      selectWalker(node)(node, depth, results);
};

const findDeepNesting = (filePath: string, content: string): DeepNestingFinding[] => {
      const results: DeepNestingFinding[] = [];
      const sourceFile = parseSourceFile(filePath, content);
      walk(sourceFile, 0, results);
      return results;
};

export const deepNestingRule: Rule = {
      id: 'deep-nesting',
      description: 'Detecta blocos aninhados além do limite recomendado',
      check(filePath: string, content: string): RuleFinding[] {
            return findDeepNesting(filePath, content).map(({ line, depth }) => ({
                  ruleId: 'deep-nesting',
                  message: `Bloco aninhado em profundidade ${depth} (limite recomendado: ${MAX_NESTING_DEPTH}) — considere extrair para uma função ou simplificar a condição.`,
                  file: filePath,
                  line,
                  severity: 'low',
            }));
      },
};
