import { parseSourceFile, type SourceNode } from '../parser/source-file.js';
import { walkWithAncestors } from './lib/ast-ancestors.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const memberPropertyName = (member: SourceNode): string | undefined => {
      const property = member.property as SourceNode | undefined;
      return property?.type === 'Identifier' ? (property.name as string) : undefined;
};

const isCallOf = (call: SourceNode | undefined, callee: SourceNode): call is SourceNode => {
      return call !== undefined && call.type === 'CallExpression' && call.callee === callee;
};

const isThenCall = (node: SourceNode): boolean => {
      if (node.type !== 'CallExpression') {
            return false;
      }
      const callee = node.callee as SourceNode | undefined;
      const args = node.arguments as unknown[] | undefined;
      return callee?.type === 'MemberExpression' && memberPropertyName(callee) === 'then' && (args?.length ?? 0) < 2;
};

const chainReachesCatch = (thenCall: SourceNode, ancestors: SourceNode[]): boolean => {
      let currentCall = thenCall;
      let i = 0;

      while (i < ancestors.length) {
            const member = ancestors.at(i);
            const nextCall = ancestors.at(i + 1);
            const isChainMember =
                  member !== undefined &&
                  member.type === 'MemberExpression' &&
                  member.object === currentCall &&
                  isCallOf(nextCall, member);
            const methodName = isChainMember ? memberPropertyName(member) : undefined;
            const continuesChain = methodName === 'then' || methodName === 'finally';

            if (methodName === 'catch') {
                  return true;
            }
            if (!nextCall || !continuesChain) {
                  return false;
            }

            currentCall = nextCall;
            i += 2;
      }

      return false;
};

const findUnhandledThenLines = (filePath: string, content: string): number[] => {
      const lines = new Set<number>();
      const sourceFile = parseSourceFile(filePath, content);

      walkWithAncestors(sourceFile, (node, ancestors) => {
            if (isThenCall(node) && node.loc && !chainReachesCatch(node, ancestors)) {
                  lines.add(node.loc.start.line);
            }
      });
      return [...lines].sort((a, b) => a - b);
};

export const promiseNoCatchRule: Rule = {
      id: 'promise-no-catch',
      description: 'Detecta uma cadeia .then() que nunca chega a um .catch()',
      check(filePath: string, content: string): RuleFinding[] {
            return findUnhandledThenLines(filePath, content).map((line) => ({
                  ruleId: 'promise-no-catch',
                  message: 'Promise com .then() sem .catch() — erros da promise não estão sendo tratados',
                  file: filePath,
                  line,
                  severity: 'medium',
            }));
      },
};
