import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const PROMISE_STATIC_METHODS = new Set(['all', 'race', 'allSettled', 'any']);

const asyncFunctionName = (node: SourceNode): string | undefined => {
  const declarationId = node.type === 'FunctionDeclaration' ? (node.id as SourceNode) : undefined;
  const declarationName = declarationId?.type === 'Identifier' ? (declarationId.name as string) : undefined;
  const id = node.type === 'VariableDeclarator' ? (node.id as SourceNode | undefined) : undefined;
  const init = node.type === 'VariableDeclarator' ? (node.init as SourceNode | undefined) : undefined;
  const hasAsyncFunctionValue =
    (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') && init.async;

  return declarationName ?? (id?.type === 'Identifier' && hasAsyncFunctionValue ? (id.name as string) : undefined);
};

const collectAsyncFunctionNames = (sourceFile: SourceNode): Set<string> => {
  const names = new Set<string>();

  visitSourceNodes(sourceFile, (node) => {
    const name = asyncFunctionName(node);
    if (name && (node.type !== 'FunctionDeclaration' || node.async)) {
      names.add(name);
    }
  });

  return names;
};

const isKnownPromiseReturningCall = (call: SourceNode, asyncFunctionNames: Set<string>): boolean => {
  const callee = call.callee as SourceNode | undefined;
  if (!callee) {
    return false;
  }

  const isKnownFunction =
    callee.type === 'Identifier' &&
    (callee.name === 'fetch' || asyncFunctionNames.has(callee.name as string));
  const object = callee.type === 'MemberExpression' ? (callee.object as SourceNode | undefined) : undefined;
  const property = callee.type === 'MemberExpression' ? (callee.property as SourceNode | undefined) : undefined;
  const isPromiseStaticMethod =
    object?.type === 'Identifier' &&
    object.name === 'Promise' &&
    property?.type === 'Identifier' &&
    PROMISE_STATIC_METHODS.has(property.name as string);

  return isKnownFunction || isPromiseStaticMethod;
};

const findFloatingPromiseLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);
  const asyncFunctionNames = collectAsyncFunctionNames(sourceFile);

  visitSourceNodes(sourceFile, (node) => {
    const expression = node.type === 'ExpressionStatement' ? (node.expression as SourceNode) : undefined;
    const isFloatingPromise = expression?.type === 'CallExpression' && isKnownPromiseReturningCall(expression, asyncFunctionNames);
    if (isFloatingPromise && expression.loc) {
      lines.add(expression.loc.start.line);
    }
  });

  return [...lines].sort((a, b) => a - b);
};

export const floatingPromiseRule: Rule = {
  id: 'floating-promise',
  description: 'Detecta uma promise "solta", chamada sem await, .then/.catch, atribuição ou return',
  check(filePath: string, content: string): RuleFinding[] {
    return findFloatingPromiseLines(filePath, content).map((line) => ({
      ruleId: 'floating-promise',
      message: 'Promise não tratada — nem await, .then/.catch, atribuição ou return foram usados',
      file: filePath,
      line,
      severity: 'medium',
    }));
  },
};
