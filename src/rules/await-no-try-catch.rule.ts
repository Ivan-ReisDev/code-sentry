import { parseSourceFile, type SourceNode } from '../parser/source-file.js';
import { walkWithAncestors } from './lib/ast-ancestors.js';
import { FUNCTION_TYPES } from './lib/function-info.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const CLASS_TYPES = new Set(['ClassDeclaration', 'ClassExpression']);
const TEST_FILE_PATH = /(^|[\\/])(?:__tests__|tests?)[\\/]|\.(?:spec|test)\.[cm]?[jt]sx?$/;

const isNestedInsideClass = (ancestors: SourceNode[]): boolean => {
  return ancestors.some((ancestor) => CLASS_TYPES.has(ancestor.type));
};

const isInsideTryBlockBeforeFunctionBoundary = (
  awaitNode: SourceNode,
  ancestors: SourceNode[],
): boolean => {
  let child: SourceNode = awaitNode;
  for (const ancestor of ancestors) {
    if (FUNCTION_TYPES.has(ancestor.type)) {
      return false;
    }
    if (ancestor.type === 'TryStatement' && ancestor.block === child) {
      return true;
    }
    child = ancestor;
  }
  return false;
};

const findUnprotectedAwaitLines = (filePath: string, content: string): number[] => {
  if (TEST_FILE_PATH.test(filePath)) {
    return [];
  }

  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  walkWithAncestors(sourceFile, (node, ancestors) => {
    const location = node.loc;
    const isUnprotectedAwait =
      node.type === 'AwaitExpression' &&
      location &&
      !isNestedInsideClass(ancestors) &&
      !isInsideTryBlockBeforeFunctionBoundary(node, ancestors);
    if (isUnprotectedAwait) {
      lines.add(location.start.line);
    }
  });
  return [...lines].sort((a, b) => a - b);
};

export const awaitNoTryCatchRule: Rule = {
  id: 'await-no-try-catch',
  description:
    'Detecta await fora de try/catch em código de produção (arquivos de teste e métodos de classe são ignorados)',
  check(filePath: string, content: string): RuleFinding[] {
    return findUnprotectedAwaitLines(filePath, content).map((line) => ({
      ruleId: 'await-no-try-catch',
      message: 'await fora de um bloco try/catch — uma rejeição da promise não seria tratada',
      file: filePath,
      line,
      severity: 'medium',
    }));
  },
};
