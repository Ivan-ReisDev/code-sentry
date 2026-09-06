import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const SECRET_NAME_PATTERN = /password|senha|secret|token|apikey|api_key|private_key|access_key/i;

const isNonEmptyStringLiteral = (node: SourceNode | undefined): boolean => {
  return node?.type === 'StringLiteral' && (node.value as string).trim().length > 0;
};

const nameFromKeyLike = (node: SourceNode | undefined): string | undefined => {
  if (node?.type === 'Identifier') {
    return node.name as string;
  }
  if (node?.type === 'StringLiteral') {
    return node.value as string;
  }
  return undefined;
};

interface AssignmentNodes {
  nameNode?: SourceNode;
  valueNode?: SourceNode;
}

const assignmentNodes = (node: SourceNode): AssignmentNodes => {
  switch (node.type) {
    case 'VariableDeclarator':
      return { nameNode: node.id as SourceNode, valueNode: node.init as SourceNode | undefined };
    case 'ObjectProperty':
      return { nameNode: node.key as SourceNode, valueNode: node.value as SourceNode };
    case 'AssignmentExpression': {
      const left = node.left as SourceNode;
      return {
        nameNode: left.type === 'MemberExpression' ? (left.property as SourceNode) : left,
        valueNode: node.right as SourceNode,
      };
    }
    default:
      return {};
  }
};

const isHardcodedSecretAssignment = (node: SourceNode): boolean => {
  const { nameNode, valueNode } = assignmentNodes(node);
  const name = nameFromKeyLike(nameNode);
  return !!name && SECRET_NAME_PATTERN.test(name) && isNonEmptyStringLiteral(valueNode);
};

const findHardcodedSecretLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node) => {
    if (isHardcodedSecretAssignment(node) && node.loc) {
      lines.add(node.loc.start.line);
    }
  });
  return [...lines].sort((a, b) => a - b);
};

export const noHardcodedSecretRule: Rule = {
  id: 'no-hardcoded-secret',
  description: 'Detecta segredos/credenciais hardcoded no código-fonte',
  check(filePath: string, content: string): RuleFinding[] {
    return findHardcodedSecretLines(filePath, content).map((line) => ({
      ruleId: 'no-hardcoded-secret',
      message: 'Possível segredo/credencial hardcoded no código-fonte',
      file: filePath,
      line,
      severity: 'critical',
    }));
  },
};
