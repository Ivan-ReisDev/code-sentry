import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const EXEC_METHOD_NAMES = new Set(['exec', 'execSync']);

const isExecCallee = (callee: SourceNode | undefined): boolean =>
  callee?.type === 'Identifier'
    ? EXEC_METHOD_NAMES.has(callee.name as string)
    : callee?.type === 'MemberExpression' &&
        (callee.property as SourceNode | undefined)?.type === 'Identifier' &&
        EXEC_METHOD_NAMES.has(((callee.property as SourceNode).name as string));

const isDynamicCommandArgument = (argument: SourceNode | undefined): boolean =>
  argument?.type === 'StringLiteral'
    ? false
    : argument?.type === 'TemplateLiteral'
      ? ((argument.expressions as unknown[] | undefined)?.length ?? 0) > 0
      : argument !== undefined;

const isCommandInjectionCall = (node: SourceNode): boolean => {
  if (node.type !== 'CallExpression') {
    return false;
  }
  const callee = node.callee as SourceNode | undefined;
  if (!isExecCallee(callee)) {
    return false;
  }
  const args = node.arguments as SourceNode[] | undefined;
  return isDynamicCommandArgument(args?.[0]);
};

const findCommandInjectionLines = (filePath: string, content: string): number[] => {
  const lines = new Set<number>();
  const sourceFile = parseSourceFile(filePath, content);

  visitSourceNodes(sourceFile, (node) => {
    if (isCommandInjectionCall(node) && node.loc) {
      lines.add(node.loc.start.line);
    }
  });
  return [...lines].sort((a, b) => a - b);
};

export const commandInjectionRule: Rule = {
  id: 'command-injection',
  description: 'Detecta child_process.exec()/execSync() recebendo um comando construído dinamicamente',
  check(filePath: string, content: string): RuleFinding[] {
    return findCommandInjectionLines(filePath, content).map((line) => ({
      ruleId: 'command-injection',
      message: 'Comando de shell construído dinamicamente — risco de command injection',
      file: filePath,
      line,
      severity: 'critical',
    }));
  },
};
