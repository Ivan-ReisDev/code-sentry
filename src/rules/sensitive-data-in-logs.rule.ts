import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const LOG_METHOD_NAMES = new Set(['log', 'warn', 'error', 'info', 'debug']);
const SENSITIVE_NAME_PATTERN = /password|senha|secret|token|apikey|api_key|private_key|access_key/i;

const looksLikeLoggerObject = (object: SourceNode | undefined): boolean =>
      object?.type === 'Identifier' && (object.name === 'console' || /log/i.test(object.name as string));

const isLogCall = (node: SourceNode): boolean => {
      if (node.type !== 'CallExpression') {
            return false;
      }
      const callee = node.callee as SourceNode | undefined;
      if (callee?.type !== 'MemberExpression') {
            return false;
      }
      const property = callee.property as SourceNode | undefined;
      return (
            looksLikeLoggerObject(callee.object as SourceNode | undefined) &&
            property?.type === 'Identifier' &&
            LOG_METHOD_NAMES.has(property.name as string)
      );
};

const propertyKeyName = (property: SourceNode): string | undefined => {
      const key = property.key as SourceNode | undefined;
      if (key?.type === 'Identifier') {
            return key.name as string;
      }
      if (key?.type === 'StringLiteral') {
            return key.value as string;
      }
      return undefined;
};

const argumentContainsSensitiveData = (argument: SourceNode): boolean => {
      let found = false;
      visitSourceNodes(argument, (node) => {
            if (node.type === 'Identifier' && SENSITIVE_NAME_PATTERN.test(node.name as string)) {
                  found = true;
            } else if (node.type === 'ObjectProperty') {
                  const keyName = propertyKeyName(node);
                  if (keyName && SENSITIVE_NAME_PATTERN.test(keyName)) {
                        found = true;
                  }
            }
      });
      return found;
};

const isSensitiveLogCall = (node: SourceNode): boolean => {
      if (!isLogCall(node)) {
            return false;
      }
      const args = (node.arguments as SourceNode[] | undefined) ?? [];
      return args.some((argument) => argumentContainsSensitiveData(argument));
};

const findSensitiveLogLines = (filePath: string, content: string): number[] => {
      const lines = new Set<number>();
      const sourceFile = parseSourceFile(filePath, content);

      visitSourceNodes(sourceFile, (node) => {
            if (isSensitiveLogCall(node) && node.loc) {
                  lines.add(node.loc.start.line);
            }
      });
      return [...lines].sort((a, b) => a - b);
};

export const sensitiveDataInLogsRule: Rule = {
      id: 'sensitive-data-in-logs',
      description: 'Detecta senhas/segredos/tokens sendo passados para chamadas de log',
      check(filePath: string, content: string): RuleFinding[] {
            return findSensitiveLogLines(filePath, content).map((line) => ({
                  ruleId: 'sensitive-data-in-logs',
                  message: 'Dado sensível (senha/segredo/token) sendo registrado em log',
                  file: filePath,
                  line,
                  severity: 'high',
            }));
      },
};
