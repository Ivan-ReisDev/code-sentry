import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const findAnyUsageLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node: SourceNode) => {
    if (node.type === 'TSAnyKeyword' && node.loc) {
      lines.add(node.loc.start.line);
    }
  });
  return [...lines].sort((a, b) => a - b);
};

export const noAnyRule: Rule = {
  id: 'no-any',
  description: 'Detecta o uso do tipo "any", que enfraquece a segurança de tipos do TypeScript',
  check(filePath: string, content: string): RuleFinding[] {
    return findAnyUsageLines(filePath, content).map((line) => ({
      ruleId: 'no-any',
      message: 'Uso do tipo "any" encontrado — considere um tipo mais específico',
      file: filePath,
      line,
      severity: 'low',
    }));
  },
};
