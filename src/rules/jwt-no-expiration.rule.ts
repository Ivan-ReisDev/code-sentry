import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const objectHasProperty = (object: SourceNode | undefined, propertyName: string): boolean => {
      if (object?.type !== 'ObjectExpression') {
            return false;
      }
      const properties = object.properties as SourceNode[] | undefined;
      return (
            properties?.some((property) => {
                  const key = property.key as SourceNode | undefined;
                  return key?.type === 'Identifier' && key.name === propertyName;
            }) ?? false
      );
};

const isJwtSignWithoutExpiration = (node: SourceNode): boolean => {
      const callee = node.type === 'CallExpression' ? (node.callee as SourceNode | undefined) : undefined;
      const object = callee?.type === 'MemberExpression' ? (callee.object as SourceNode | undefined) : undefined;
      const property = callee?.type === 'MemberExpression' ? (callee.property as SourceNode | undefined) : undefined;
      const isJwtSignCall =
            object?.type === 'Identifier' &&
            object.name === 'jwt' &&
            property?.type === 'Identifier' &&
            property.name === 'sign';

      const args = node.type === 'CallExpression' ? (node.arguments as SourceNode[] | undefined) : undefined;
      const payload = args?.[0];
      const options = args?.[2];
      const hasExpInPayload = objectHasProperty(payload, 'exp');
      const hasExpiresInOption = objectHasProperty(options, 'expiresIn');
      return isJwtSignCall && !hasExpInPayload && !hasExpiresInOption;
};

const findJwtNoExpirationLines = (filePath: string, content: string): number[] => {
      const lines = new Set<number>();
      const sourceFile = parseSourceFile(filePath, content);

      visitSourceNodes(sourceFile, (node) => {
            if (isJwtSignWithoutExpiration(node) && node.loc) {
                  lines.add(node.loc.start.line);
            }
      });
      return [...lines].sort((a, b) => a - b);
};

export const jwtNoExpirationRule: Rule = {
      id: 'jwt-no-expiration',
      description: 'Detecta jwt.sign() sem expiração configurada',
      check(filePath: string, content: string): RuleFinding[] {
            return findJwtNoExpirationLines(filePath, content).map((line) => ({
                  ruleId: 'jwt-no-expiration',
                  message: 'jwt.sign() sem expiração — o token nunca expira',
                  file: filePath,
                  line,
                  severity: 'medium',
            }));
      },
};
