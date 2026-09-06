import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const XML_PARSE_METHOD_NAMES = new Set(['parseXmlString', 'parseXml']);
const RISKY_OPTION_NAMES = new Set(['noent', 'dtdload']);

const hasRiskyOptionEnabled = (options: SourceNode | undefined): boolean => {
  if (options?.type !== 'ObjectExpression') {
    return false;
  }
  const properties = options.properties as SourceNode[] | undefined;
  return (
    properties?.some((property) => {
      const key = property.key as SourceNode | undefined;
      const value = property.value as SourceNode | undefined;
      return (
        key?.type === 'Identifier' &&
        RISKY_OPTION_NAMES.has(key.name as string) &&
        value?.type === 'BooleanLiteral' &&
        value.value === true
      );
    }) ?? false
  );
};

const isUnsafeXmlParseCall = (node: SourceNode): boolean => {
  if (node.type !== 'CallExpression') {
    return false;
  }
  const callee = node.callee as SourceNode | undefined;
  if (callee?.type !== 'MemberExpression') {
    return false;
  }
  const property = callee.property as SourceNode | undefined;
  if (property?.type !== 'Identifier' || !XML_PARSE_METHOD_NAMES.has(property.name as string)) {
    return false;
  }
  const args = node.arguments as SourceNode[] | undefined;
  return hasRiskyOptionEnabled(args?.[1]);
};

const findUnsafeXmlParsingLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node) => {
    if (isUnsafeXmlParseCall(node) && node.loc) {
      lines.add(node.loc.start.line);
    }
  });
  return [...lines].sort((a, b) => a - b);
};

export const xxeUnsafeXmlParsingRule: Rule = {
  id: 'xxe-unsafe-xml-parsing',
  description: 'Detecta parsing de XML com substituição de entidades e/ou carregamento de DTD externo habilitados (risco de XXE)',
  check(filePath: string, content: string): RuleFinding[] {
    return findUnsafeXmlParsingLines(filePath, content).map((line) => ({
      ruleId: 'xxe-unsafe-xml-parsing',
      message: 'Parser XML com noent/dtdload habilitado — risco de XML External Entity (XXE)',
      file: filePath,
      line,
      severity: 'critical',
    }));
  },
};
