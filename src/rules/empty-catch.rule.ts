import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const isEmptyCatchClause = (node: SourceNode): boolean => {
  if (node.type !== 'CatchClause') {
    return false;
  }

  const body = node.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'type' in body &&
    body.type === 'BlockStatement' &&
    Array.isArray((body as SourceNode).body) &&
    ((body as SourceNode).body as unknown[]).length === 0
  );
};

const findEmptyCatchLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node) => {
    if (isEmptyCatchClause(node) && node.loc) {
      lines.add(node.loc.start.line);
    }
  });
  return [...lines];
};

export const emptyCatchRule: Rule = {
  id: 'empty-catch',
  description: 'Detecta blocos catch vazios, que escondem erros silenciosamente',
  check(filePath: string, content: string): RuleFinding[] {
    return findEmptyCatchLines(filePath, content).map((line) => ({
      ruleId: 'empty-catch',
      message: 'Bloco catch vazio — o erro está sendo engolido silenciosamente',
      file: filePath,
      line,
      severity: 'medium',
    }));
  },
};
