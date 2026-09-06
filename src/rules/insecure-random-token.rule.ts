import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const TOKEN_NAME_PATTERN = /token|secret|password|senha|session|csrf|nonce|otp/i;

const isMathRandomCall = (node: SourceNode): boolean => {
  if (node.type !== 'CallExpression') {
    return false;
  }
  const callee = node.callee as SourceNode | undefined;
  if (callee?.type !== 'MemberExpression') {
    return false;
  }
  const object = callee.object as SourceNode | undefined;
  const property = callee.property as SourceNode | undefined;
  return (
    object?.type === 'Identifier' &&
    object.name === 'Math' &&
    property?.type === 'Identifier' &&
    property.name === 'random'
  );
};

const containsMathRandomCall = (node: SourceNode | undefined): boolean => {
  if (!node) {
    return false;
  }
  let found = false;
  visitSourceNodes(node, (child) => {
    if (isMathRandomCall(child)) {
      found = true;
    }
  });
  return found;
};

const findInsecureRandomTokenLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node) => {
    if (node.type !== 'VariableDeclarator') {
      return;
    }
    const id = node.id as SourceNode | undefined;
    const init = node.init as SourceNode | undefined;
    if (
      id?.type === 'Identifier' &&
      TOKEN_NAME_PATTERN.test(id.name as string) &&
      containsMathRandomCall(init) &&
      node.loc
    ) {
      lines.add(node.loc.start.line);
    }
  });
  return [...lines].sort((a, b) => a - b);
};

export const insecureRandomTokenRule: Rule = {
  id: 'insecure-random-token',
  description: 'Detecta o uso de Math.random() para gerar tokens/segredos previsíveis',
  check(filePath: string, content: string): RuleFinding[] {
    return findInsecureRandomTokenLines(filePath, content).map((line) => ({
      ruleId: 'insecure-random-token',
      message: 'Math.random() não é seguro para gerar tokens — use crypto.randomBytes()',
      file: filePath,
      line,
      severity: 'high',
    }));
  },
};
