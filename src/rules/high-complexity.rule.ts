import { parseSourceFile, type SourceNode } from '../parser/source-file.js';
import { FUNCTION_TYPES, getFunctionName, getFunctionStartLine } from './lib/function-info.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const MAX_BRANCHES = 5;

const BRANCH_TYPES = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchCase',
  'CatchClause',
]);

interface FunctionComplexity {
  startLine: number;
  branchCount: number;
  name?: string;
}

const isSourceNode = (value: unknown): value is SourceNode => {
  return typeof value === 'object' && value !== null && 'type' in value;
};

const walkChildren = (node: SourceNode, context: FunctionComplexity | undefined, results: FunctionComplexity[]): void => {
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.filter(isSourceNode).forEach((child) => walk(child, node, context, results));
    } else if (isSourceNode(value)) {
      walk(value, node, context, results);
    }
  }
};

const walk = (
  node: SourceNode,
  parent: SourceNode | undefined,
  context: FunctionComplexity | undefined,
  results: FunctionComplexity[],
): void => {
  if (FUNCTION_TYPES.has(node.type)) {
    const newContext: FunctionComplexity = {
      startLine: getFunctionStartLine(node, parent) ?? node.loc?.start.line ?? 0,
      branchCount: 0,
      name: getFunctionName(node, parent),
    };
    walkChildren(node, newContext, results);
    if (newContext.branchCount > MAX_BRANCHES) {
      results.push(newContext);
    }
    return;
  }

  if (BRANCH_TYPES.has(node.type) && context) {
    context.branchCount += 1;
  }

  walkChildren(node, context, results);
};

const findHighComplexityFunctions = (content: string, filePath: string): FunctionComplexity[] => {
  const results: FunctionComplexity[] = [];
  const sourceFile = parseSourceFile(filePath, content);
  walkChildren(sourceFile, undefined, results);
  return results;
};

export const highComplexityRule: Rule = {
  id: 'high-complexity',
  description: 'Detecta funções com muitos condicionais/loops (complexidade alta)',
  check(filePath: string, content: string): RuleFinding[] {
    return findHighComplexityFunctions(content, filePath).map(({ startLine, branchCount, name }) => {
      const subject = name ? `Função "${name}"` : 'Função anônima';
      return {
        ruleId: 'high-complexity',
        message: `${subject} tem ${branchCount} condicionais/loops — complexidade alta, considere refatorar (limite recomendado: ${MAX_BRANCHES})`,
        file: filePath,
        line: startLine,
        severity: 'low',
      };
    });
  },
};
