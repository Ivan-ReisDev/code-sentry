import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const HEADER_OR_COOKIE_NAME_PATTERN = /headers|cookies?/i;

const accessObjectName = (object: SourceNode | undefined): string | undefined => {
      const objectProperty = object?.type === 'MemberExpression' ? (object.property as SourceNode | undefined) : object;
      return objectProperty?.type === 'Identifier' ? (objectProperty.name as string) : undefined;
};

const isHeaderOrCookieAccessCall = (node: SourceNode | undefined): boolean => {
      const callee = node?.callee as SourceNode | undefined;
      const property = callee?.property as SourceNode | undefined;
      const object = callee?.object as SourceNode | undefined;
      return (
            node?.type === 'CallExpression' &&
            callee?.type === 'MemberExpression' &&
            property?.type === 'Identifier' &&
            property.name === 'get' &&
            HEADER_OR_COOKIE_NAME_PATTERN.test(accessObjectName(object) ?? '')
      );
};

const collectStringConstants = (sourceFile: SourceNode): Map<string, string> => {
      const constants = new Map<string, string>();
      visitSourceNodes(sourceFile, (node) => {
            if (node.type !== 'VariableDeclarator') {
                  return;
            }
            const id = node.id as SourceNode | undefined;
            const init = node.init as SourceNode | undefined;
            if (id?.type === 'Identifier' && init?.type === 'StringLiteral') {
                  constants.set(id.name as string, init.value as string);
            }
      });
      return constants;
};

const isConstantStringSide = (node: SourceNode | undefined, constants: Map<string, string>): boolean => {
      if (node?.type === 'StringLiteral') {
            return true;
      }
      return node?.type === 'Identifier' && constants.has(node.name as string);
};

const isHardcodedAuthorizationComparison = (node: SourceNode, constants: Map<string, string>): boolean => {
      const left = node.left as SourceNode | undefined;
      const right = node.right as SourceNode | undefined;
      const isEquality = node.operator === '===' || node.operator === '==';
      return (
            node.type === 'BinaryExpression' &&
            isEquality &&
            ((isHeaderOrCookieAccessCall(left) && isConstantStringSide(right, constants)) ||
                  (isHeaderOrCookieAccessCall(right) && isConstantStringSide(left, constants)))
      );
};

const findHardcodedAuthorizationLines = (filePath: string, content: string): number[] => {
      const lines = new Set<number>();
      const sourceFile = parseSourceFile(filePath, content);
      const constants = collectStringConstants(sourceFile);

      visitSourceNodes(sourceFile, (node) => {
            if (isHardcodedAuthorizationComparison(node, constants) && node.loc) {
                  lines.add(node.loc.start.line);
            }
      });
      return [...lines].sort((a, b) => a - b);
};

export const hardcodedAuthorizationValueRule: Rule = {
      id: 'hardcoded-authorization-value',
      description: 'Detecta um header/cookie de requisição comparado com um valor fixo no código para conceder acesso',
      check(filePath: string, content: string): RuleFinding[] {
            return findHardcodedAuthorizationLines(filePath, content).map((line) => ({
                  ruleId: 'hardcoded-authorization-value',
                  message: 'Autorização baseada em comparação de header/cookie com valor fixo no código-fonte',
                  file: filePath,
                  line,
                  severity: 'critical',
            }));
      },
};
