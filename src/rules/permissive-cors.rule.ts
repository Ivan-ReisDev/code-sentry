import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const HEADER_SETTER_METHODS = new Set(['setHeader', 'header']);

const isWildcardOriginOption = (options: SourceNode | undefined): boolean => {
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
                        key.name === 'origin' &&
                        value?.type === 'StringLiteral' &&
                        value.value === '*'
                  );
            }) ?? false
      );
};

const isPermissiveCorsCall = (node: SourceNode): boolean => {
      if (node.type !== 'CallExpression') {
            return false;
      }
      const callee = node.callee as SourceNode | undefined;
      if (callee?.type !== 'Identifier' || callee.name !== 'cors') {
            return false;
      }
      const args = node.arguments as SourceNode[] | undefined;
      return (args?.length ?? 0) === 0 || isWildcardOriginOption(args?.[0]);
};

const callExpressionParts = (
      node: SourceNode,
): { callee: SourceNode | undefined; args: SourceNode[] | undefined } | undefined => {
      if (node.type !== 'CallExpression') {
            return undefined;
      }
      return {
            callee: node.callee as SourceNode | undefined,
            args: node.arguments as SourceNode[] | undefined,
      };
};

const memberCalleeProperty = (callee: SourceNode | undefined): SourceNode | undefined => {
      if (callee?.type !== 'MemberExpression') {
            return undefined;
      }
      return callee.property as SourceNode | undefined;
};

const isWildcardOriginHeader = (node: SourceNode): boolean => {
      const parts = callExpressionParts(node);
      const property = memberCalleeProperty(parts?.callee);
      const headerName = parts?.args?.[0];
      const headerValue = parts?.args?.[1];
      return (
            property?.type === 'Identifier' &&
            HEADER_SETTER_METHODS.has(property.name as string) &&
            headerName?.type === 'StringLiteral' &&
            headerName.value === 'Access-Control-Allow-Origin' &&
            headerValue?.type === 'StringLiteral' &&
            headerValue.value === '*'
      );
};

const findPermissiveCorsLines = (filePath: string, content: string): number[] => {
      const lines = new Set<number>();
      const sourceFile = parseSourceFile(filePath, content);

      visitSourceNodes(sourceFile, (node) => {
            if ((isPermissiveCorsCall(node) || isWildcardOriginHeader(node)) && node.loc) {
                  lines.add(node.loc.start.line);
            }
      });
      return [...lines].sort((a, b) => a - b);
};

export const permissiveCorsRule: Rule = {
      id: 'permissive-cors',
      description: 'Detecta CORS configurado para permitir qualquer origem',
      check(filePath: string, content: string): RuleFinding[] {
            return findPermissiveCorsLines(filePath, content).map((line) => ({
                  ruleId: 'permissive-cors',
                  message: 'CORS permitindo qualquer origem ("*") — restrinja para as origens confiáveis',
                  file: filePath,
                  line,
                  severity: 'medium',
            }));
      },
};
