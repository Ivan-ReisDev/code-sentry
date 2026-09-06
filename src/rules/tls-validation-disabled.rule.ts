import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const isRejectUnauthorizedFalse = (node: SourceNode): boolean => {
  if (node.type !== 'ObjectProperty') {
    return false;
  }
  const key = node.key as SourceNode | undefined;
  const value = node.value as SourceNode | undefined;
  return (
    key?.type === 'Identifier' &&
    key.name === 'rejectUnauthorized' &&
    value?.type === 'BooleanLiteral' &&
    value.value === false
  );
};

const isNodeTlsRejectUnauthorizedDisabled = (node: SourceNode): boolean => {
  if (node.type !== 'AssignmentExpression') {
    return false;
  }
  const left = node.left as SourceNode | undefined;
  const right = node.right as SourceNode | undefined;
  if (left?.type !== 'MemberExpression') {
    return false;
  }
  const property = left.property as SourceNode | undefined;
  const object = left.object as SourceNode | undefined;
  const isEnvVar =
    property?.type === 'Identifier' &&
    property.name === 'NODE_TLS_REJECT_UNAUTHORIZED' &&
    object?.type === 'MemberExpression' &&
    (object.property as SourceNode | undefined)?.type === 'Identifier' &&
    ((object.property as SourceNode).name as string) === 'env';
  return isEnvVar && right?.type === 'StringLiteral' && right.value === '0';
};

const findDisabledTlsValidationLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node) => {
    if (
      (isRejectUnauthorizedFalse(node) || isNodeTlsRejectUnauthorizedDisabled(node)) &&
      node.loc
    ) {
      lines.add(node.loc.start.line);
    }
  });
  return [...lines].sort((a, b) => a - b);
};

export const tlsValidationDisabledRule: Rule = {
  id: 'tls-validation-disabled',
  description: 'Detecta a desativação da validação de certificados TLS',
  check(filePath: string, content: string): RuleFinding[] {
    return findDisabledTlsValidationLines(filePath, content).map((line) => ({
      ruleId: 'tls-validation-disabled',
      message: 'Validação de certificado TLS desativada — risco de ataque man-in-the-middle',
      file: filePath,
      line,
      severity: 'critical',
    }));
  },
};
