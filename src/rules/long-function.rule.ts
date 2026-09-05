import {
  parseSourceFile,
  type SourceNode,
  visitSourceNodes,
} from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const MAX_LINES = 30;
const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
]);

interface LongFunction {
  startLine: number;
  totalLines: number;
  name?: string;
}

const nodeName = (node: unknown): string | undefined => {
  if (typeof node !== 'object' || node === null) {
    return undefined;
  }
  if ('name' in node && typeof node.name === 'string') {
    return node.name;
  }
  if ('value' in node && (typeof node.value === 'string' || typeof node.value === 'number')) {
    return String(node.value);
  }
  if ('id' in node) {
    return nodeName(node.id);
  }
  return undefined;
};

const getFunctionName = (node: SourceNode, parent?: SourceNode): string | undefined => {
  if (node.type === 'ClassMethod' && node.kind === 'constructor') {
    return 'constructor';
  }
  const ownName = nodeName(node.id) ?? nodeName(node.key);
  if (ownName) {
    return ownName;
  }
  if (parent?.type === 'VariableDeclarator') {
    return nodeName(parent.id);
  }
  if (parent?.type === 'ObjectProperty') {
    return nodeName(parent.key);
  }
  if (parent?.type === 'AssignmentExpression') {
    return nodeName(parent.left);
  }
  return undefined;
};

const getStartLine = (node: SourceNode, parent?: SourceNode): number | undefined => {
  if (node.type === 'ArrowFunctionExpression' && parent?.type === 'VariableDeclarator') {
    return parent.loc?.start.line;
  }
  return node.loc?.start.line;
};

const toLongFunction = (node: SourceNode, parent?: SourceNode): LongFunction | undefined => {
  const startLine = getStartLine(node, parent);
  const endLine = node.loc?.end.line;
  if (startLine === undefined || endLine === undefined) {
    return undefined;
  }

  const totalLines = endLine - startLine + 1;
  if (totalLines <= MAX_LINES) {
    return undefined;
  }
  return { startLine, totalLines, name: getFunctionName(node, parent) };
};

const findLongFunctions = (filePath: string, content: string): LongFunction[] => {
  const results: LongFunction[] = [];
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node, parent) => {
    if (FUNCTION_TYPES.has(node.type)) {
      const longFunction = toLongFunction(node, parent);
      if (longFunction) {
        results.push(longFunction);
      }
    }
  });
  return results;
};

const toFinding = (filePath: string, longFunction: LongFunction): RuleFinding => {
  const { startLine, totalLines, name } = longFunction;
  const subject = name ? `Função "${name}"` : 'Função anônima';
  return {
    ruleId: 'long-function',
    message: `${subject} com ${totalLines} linhas — considere dividir em funções menores (limite recomendado: ${MAX_LINES})`,
    file: filePath,
    line: startLine,
    severity: 'low',
  };
};

export const longFunctionRule: Rule = {
  id: 'long-function',
  description: 'Detecta funções com mais de 30 linhas',
  check(filePath: string, content: string): RuleFinding[] {
    return findLongFunctions(filePath, content).map((longFunction) =>
      toFinding(filePath, longFunction),
    );
  },
};
