import {
  parseSourceFile,
  type SourceNode,
  visitSourceNodes,
} from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const isNamed = (node: unknown, name: string): boolean => {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    'name' in node &&
    node.type === 'Identifier' &&
    node.name === name
  );
};

const isEvalCall = (node: SourceNode): boolean => {
  if (node.type !== 'CallExpression' && node.type !== 'OptionalCallExpression') {
    return false;
  }
  if (isNamed(node.callee, 'eval')) {
    return true;
  }

  const callee = node.callee;
  return (
    typeof callee === 'object' &&
    callee !== null &&
    'type' in callee &&
    (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') &&
    'property' in callee &&
    isNamed(callee.property, 'eval')
  );
};

const isNewFunctionCall = (node: SourceNode): boolean => {
  return node.type === 'NewExpression' && isNamed(node.callee, 'Function');
};

const findEvalCallLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node) => {
    if ((isEvalCall(node) || isNewFunctionCall(node)) && node.loc) {
      lines.add(node.loc.start.line);
    }
  });
  return [...lines];
};

export const noEvalRule: Rule = {
  id: 'no-eval',
  description: 'Detecta o uso de eval() ou new Function(), que podem executar código arbitrário',
  check(filePath: string, content: string): RuleFinding[] {
    return findEvalCallLines(filePath, content).map((line) => ({
      ruleId: 'no-eval',
      message: 'Uso de eval()/new Function() encontrado — evite executar código arbitrário',
      file: filePath,
      line,
      severity: 'high',
    }));
  },
};
