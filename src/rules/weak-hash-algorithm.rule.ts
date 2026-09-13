import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const WEAK_ALGORITHMS = /^(md5|sha1)$/i;

const getCallExpressionCallee = (node: SourceNode): SourceNode | undefined => {
      return node.type === 'CallExpression' ? (node.callee as SourceNode | undefined) : undefined;
};

const getCallExpressionArgs = (node: SourceNode): SourceNode[] | undefined => {
      return node.type === 'CallExpression' ? (node.arguments as SourceNode[] | undefined) : undefined;
};

const getCreateHashProperty = (callee: SourceNode | undefined): SourceNode | undefined => {
      return callee?.type === 'MemberExpression' ? (callee.property as SourceNode | undefined) : undefined;
};

const isCreateHashProperty = (property: SourceNode | undefined): boolean => {
      return property?.type === 'Identifier' && property.name === 'createHash';
};

const isWeakAlgorithmLiteral = (algorithm: SourceNode | undefined): boolean => {
      return algorithm?.type === 'StringLiteral' && WEAK_ALGORITHMS.test(algorithm.value as string);
};

const isWeakCreateHashCall = (node: SourceNode): boolean => {
      const property = getCreateHashProperty(getCallExpressionCallee(node));
      const algorithm = getCallExpressionArgs(node)?.[0];
      return isCreateHashProperty(property) && isWeakAlgorithmLiteral(algorithm);
};

const findWeakHashLines = (filePath: string, content: string): number[] => {
      const lines = new Set<number>();
      const sourceFile = parseSourceFile(filePath, content);

      visitSourceNodes(sourceFile, (node) => {
            if (isWeakCreateHashCall(node) && node.loc) {
                  lines.add(node.loc.start.line);
            }
      });
      return [...lines].sort((a, b) => a - b);
};

export const weakHashAlgorithmRule: Rule = {
      id: 'weak-hash-algorithm',
      description: 'Detecta o uso de algoritmos de hash fracos (MD5, SHA-1)',
      check(filePath: string, content: string): RuleFinding[] {
            return findWeakHashLines(filePath, content).map((line) => ({
                  ruleId: 'weak-hash-algorithm',
                  message: 'Algoritmo de hash fraco (MD5/SHA-1) — considere SHA-256 ou superior',
                  file: filePath,
                  line,
                  severity: 'medium',
            }));
      },
};
