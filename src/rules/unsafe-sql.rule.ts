import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const SQL_KEYWORD_PREFIX = /^(select|insert|update|delete)\b/i;

const leftmostStringLiteral = (node: SourceNode | undefined): SourceNode | undefined => {
  if (node?.type === 'StringLiteral') {
    return node;
  }
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    return leftmostStringLiteral(node.left as SourceNode | undefined);
  }
  return undefined;
};

const isUnsafeConcatenatedSql = (node: SourceNode): boolean => {
  if (node.type !== 'BinaryExpression' || node.operator !== '+') {
    return false;
  }
  const literal = leftmostStringLiteral(node);
  return !!literal && SQL_KEYWORD_PREFIX.test((literal.value as string).trim());
};

const isUnsafeSqlTemplateLiteral = (node: SourceNode): boolean => {
  if (node.type !== 'TemplateLiteral') {
    return false;
  }
  const expressions = node.expressions as unknown[] | undefined;
  if ((expressions?.length ?? 0) === 0) {
    return false;
  }
  const quasis = node.quasis as SourceNode[] | undefined;
  const firstQuasi = quasis?.[0];
  const rawText = (firstQuasi?.value as { raw?: string } | undefined)?.raw ?? '';
  return SQL_KEYWORD_PREFIX.test(rawText.trim());
};

const findUnsafeSqlLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node) => {
    if ((isUnsafeConcatenatedSql(node) || isUnsafeSqlTemplateLiteral(node)) && node.loc) {
      lines.add(node.loc.start.line);
    }
  });
  return [...lines].sort((a, b) => a - b);
};

export const unsafeSqlRule: Rule = {
  id: 'unsafe-sql',
  description: 'Detecta concatenação insegura de SQL (risco de SQL injection)',
  check(filePath: string, content: string): RuleFinding[] {
    return findUnsafeSqlLines(filePath, content).map((line) => ({
      ruleId: 'unsafe-sql',
      message: 'Consulta SQL montada por concatenação — use queries parametrizadas',
      file: filePath,
      line,
      severity: 'high',
    }));
  },
};
