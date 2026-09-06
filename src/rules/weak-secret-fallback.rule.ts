import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const SECRET_ENV_NAME_PATTERN =
  /password|senha|secret|token|apikey|api_key|private_key|access_key|encryption_key|signing_key|jwt/i;

const isProcessEnvAccess = (node: SourceNode | undefined): node is SourceNode => {
  if (node?.type !== 'MemberExpression') {
    return false;
  }
  const object = node.object as SourceNode | undefined;
  return (
    object?.type === 'MemberExpression' &&
    (object.object as SourceNode | undefined)?.type === 'Identifier' &&
    ((object.object as SourceNode).name as string) === 'process' &&
    (object.property as SourceNode | undefined)?.type === 'Identifier' &&
    ((object.property as SourceNode).name as string) === 'env'
  );
};

const isNonEmptyStringLiteral = (node: SourceNode | undefined): boolean =>
  node?.type === 'StringLiteral' && (node.value as string).trim().length > 0;

const isWeakSecretFallback = (node: SourceNode): boolean => {
  if (node.type !== 'LogicalExpression' || (node.operator !== '||' && node.operator !== '??')) {
    return false;
  }
  const left = node.left as SourceNode | undefined;
  if (!isProcessEnvAccess(left)) {
    return false;
  }
  const envVarName = (left.property as SourceNode).name as string;
  return SECRET_ENV_NAME_PATTERN.test(envVarName) && isNonEmptyStringLiteral(node.right as SourceNode | undefined);
};

const findWeakSecretFallbackLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node) => {
    if (isWeakSecretFallback(node) && node.loc) {
      lines.add(node.loc.start.line);
    }
  });
  return [...lines].sort((a, b) => a - b);
};

export const weakSecretFallbackRule: Rule = {
  id: 'weak-secret-fallback',
  description: 'Detecta uma variável de ambiente de segredo/chave com um valor hardcoded como fallback (|| ou ??)',
  check(filePath: string, content: string): RuleFinding[] {
    return findWeakSecretFallbackLines(filePath, content).map((line) => ({
      ruleId: 'weak-secret-fallback',
      message: 'Segredo/chave com fallback hardcoded — se a variável de ambiente não for definida, um valor previsível é usado',
      file: filePath,
      line,
      severity: 'critical',
    }));
  },
};
