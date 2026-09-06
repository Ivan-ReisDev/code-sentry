import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const PUBLIC_ENV_PREFIX_PATTERN = /^(NEXT_PUBLIC_|VITE_|REACT_APP_)/;
const SENSITIVE_NAME_PATTERN = /secret|key|token|password|senha/i;

const isPublicSecretEnvAccess = (node: SourceNode): boolean => {
  if (node.type !== 'MemberExpression') {
    return false;
  }
  const property = node.property as SourceNode | undefined;
  if (property?.type !== 'Identifier') {
    return false;
  }
  const name = property.name as string;
  return PUBLIC_ENV_PREFIX_PATTERN.test(name) && SENSITIVE_NAME_PATTERN.test(name);
};

const findPublicEnvVarSecretLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node) => {
    if (isPublicSecretEnvAccess(node) && node.loc) {
      lines.add(node.loc.start.line);
    }
  });
  return [...lines].sort((a, b) => a - b);
};

export const publicEnvVarSecretRule: Rule = {
  id: 'public-env-var-secret',
  description: 'Detecta uma variável de ambiente pública (NEXT_PUBLIC_/VITE_/REACT_APP_) com nome de segredo',
  check(filePath: string, content: string): RuleFinding[] {
    return findPublicEnvVarSecretLines(filePath, content).map((line) => ({
      ruleId: 'public-env-var-secret',
      message: 'Variável de ambiente pública com nome de segredo — o prefixo faz o valor ser incluído no bundle enviado ao navegador, nunca pode ser secreto',
      file: filePath,
      line,
      severity: 'high',
    }));
  },
};
