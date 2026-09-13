import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const BODY_PARSER_OBJECTS = new Set(['express', 'bodyParser']);
const BODY_PARSER_METHODS = new Set(['json', 'urlencoded']);

const hasLimitOption = (options: SourceNode | undefined): boolean => {
      if (options?.type !== 'ObjectExpression') {
            return false;
      }
      const properties = options.properties as SourceNode[] | undefined;
      return (
            properties?.some((property) => {
                  const key = property.key as SourceNode | undefined;
                  return key?.type === 'Identifier' && key.name === 'limit';
            }) ?? false
      );
};

type MemberCallParts = {
      object: SourceNode | undefined;
      property: SourceNode | undefined;
      args: SourceNode[] | undefined;
};

const getMemberCallParts = (node: SourceNode): MemberCallParts => {
      if (node.type !== 'CallExpression') {
            return { object: undefined, property: undefined, args: undefined };
      }
      const callee = node.callee as SourceNode | undefined;
      const args = node.arguments as SourceNode[] | undefined;
      if (callee?.type !== 'MemberExpression') {
            return { object: undefined, property: undefined, args };
      }
      return {
            object: callee.object as SourceNode | undefined,
            property: callee.property as SourceNode | undefined,
            args,
      };
};

const isBodyParserWithoutLimit = (node: SourceNode): boolean => {
      const { object, property, args } = getMemberCallParts(node);
      const isBodyParserCall =
            object?.type === 'Identifier' &&
            BODY_PARSER_OBJECTS.has(object.name as string) &&
            property?.type === 'Identifier' &&
            BODY_PARSER_METHODS.has(property.name as string);
      return isBodyParserCall && !hasLimitOption(args?.[0]);
};

const findMissingBodyLimitLines = (filePath: string, content: string): number[] => {
      const lines = new Set<number>();
      const sourceFile = parseSourceFile(filePath, content);

      visitSourceNodes(sourceFile, (node) => {
            if (isBodyParserWithoutLimit(node) && node.loc) {
                  lines.add(node.loc.start.line);
            }
      });
      return [...lines].sort((a, b) => a - b);
};

export const expressMissingBodyLimitRule: Rule = {
      id: 'express-missing-body-limit',
      description: 'Detecta middlewares de body parsing do Express sem limite de tamanho de requisição',
      check(filePath: string, content: string): RuleFinding[] {
            return findMissingBodyLimitLines(filePath, content).map((line) => ({
                  ruleId: 'express-missing-body-limit',
                  message: 'Body parser sem "limit" configurado — risco de negação de serviço por payload grande',
                  file: filePath,
                  line,
                  severity: 'low',
            }));
      },
};
