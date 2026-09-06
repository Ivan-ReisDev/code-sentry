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

const HASH_LIKE_NAME_PATTERN = /hash|md5|sha1/i;

const calleeName = (callee: SourceNode | undefined): string | undefined => {
      if (callee?.type === 'Identifier') {
            return callee.name as string;
      }
      if (callee?.type === 'MemberExpression') {
            const property = callee.property as SourceNode | undefined;
            return property?.type === 'Identifier' ? (property.name as string) : undefined;
      }
      return undefined;
};

const isDateNowOrGetTimeCall = (node: SourceNode): boolean => {
      if (node.type !== 'CallExpression') {
            return false;
      }
      const callee = node.callee as SourceNode | undefined;
      if (callee?.type !== 'MemberExpression') {
            return false;
      }
      const property = callee.property as SourceNode | undefined;
      const propertyName = property?.type === 'Identifier' ? (property.name as string) : undefined;
      if (propertyName === 'getTime') {
            return true;
      }
      const object = callee.object as SourceNode | undefined;
      return object?.type === 'Identifier' && object.name === 'Date' && propertyName === 'now';
};

const TIMESTAMP_NAME_PATTERN = /timestamp|^now$/i;

const containsPredictableTimestamp = (node: SourceNode | undefined): boolean => {
      if (!node) {
            return false;
      }
      let found = false;
      visitSourceNodes(node, (child) => {
            if (isDateNowOrGetTimeCall(child)) {
                  found = true;
            } else if (child.type === 'Identifier' && TIMESTAMP_NAME_PATTERN.test(child.name as string)) {
                  found = true;
            }
      });
      return found;
};

const isPredictableHashCall = (node: SourceNode): boolean => {
      if (node.type !== 'CallExpression') {
            return false;
      }
      const name = calleeName(node.callee as SourceNode | undefined);
      if (!name || !HASH_LIKE_NAME_PATTERN.test(name)) {
            return false;
      }
      const args = node.arguments as SourceNode[] | undefined;
      return containsPredictableTimestamp(args?.[0]);
};

const containsInsecureValueGeneration = (node: SourceNode | undefined): boolean => {
      if (!node) {
            return false;
      }
      let found = false;
      visitSourceNodes(node, (child) => {
            if (isMathRandomCall(child) || isPredictableHashCall(child)) {
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
                  containsInsecureValueGeneration(init) &&
                  node.loc
            ) {
                  lines.add(node.loc.start.line);
            }
      });
      return [...lines].sort((a, b) => a - b);
};

export const insecureRandomTokenRule: Rule = {
      id: 'insecure-random-token',
      description:
            'Detecta tokens/segredos gerados de forma previsível (Math.random(), ou hash de um valor previsível como um timestamp)',
      check(filePath: string, content: string): RuleFinding[] {
            return findInsecureRandomTokenLines(filePath, content).map((line) => ({
                  ruleId: 'insecure-random-token',
                  message: 'Token gerado de forma previsível — use crypto.randomBytes()/randomUUID() em vez de Math.random() ou hash de um timestamp',
                  file: filePath,
                  line,
                  severity: 'high',
            }));
      },
};
