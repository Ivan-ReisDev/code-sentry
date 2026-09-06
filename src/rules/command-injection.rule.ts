import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const EXEC_METHOD_NAMES = new Set(['exec', 'execSync']);
const CHILD_PROCESS_MODULE_NAMES = new Set(['child_process', 'node:child_process']);

interface ChildProcessBindings {
      // Identificadores vinculados diretamente a exec/execSync (import nomeado
      // ou desestruturação de require), que podem ser chamados como exec(...).
      directCalls: Set<string>;
      // Identificadores vinculados ao módulo inteiro (import default/namespace
      // ou `const x = require(...)`), que podem ser chamados como x.exec(...).
      namespaces: Set<string>;
}

const isChildProcessModuleSpecifier = (node: SourceNode | undefined): boolean =>
      node?.type === 'StringLiteral' && CHILD_PROCESS_MODULE_NAMES.has(node.value as string);

const collectFromImportDeclaration = (node: SourceNode, bindings: ChildProcessBindings): void => {
      if (!isChildProcessModuleSpecifier(node.source as SourceNode | undefined)) {
            return;
      }
      for (const specifier of (node.specifiers as SourceNode[] | undefined) ?? []) {
            const local = specifier.local as SourceNode | undefined;
            if (local?.type !== 'Identifier') {
                  continue;
            }
            if (specifier.type === 'ImportSpecifier') {
                  const imported = specifier.imported as SourceNode | undefined;
                  if (imported?.type === 'Identifier' && EXEC_METHOD_NAMES.has(imported.name as string)) {
                        bindings.directCalls.add(local.name as string);
                  }
            } else if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
                  bindings.namespaces.add(local.name as string);
            }
      }
};

const isRequireCall = (node: SourceNode | undefined): boolean =>
      node?.type === 'CallExpression' &&
      (node.callee as SourceNode | undefined)?.type === 'Identifier' &&
      ((node.callee as SourceNode).name as string) === 'require' &&
      isChildProcessModuleSpecifier((node.arguments as SourceNode[] | undefined)?.[0]);

const collectFromVariableDeclarator = (node: SourceNode, bindings: ChildProcessBindings): void => {
      if (!isRequireCall(node.init as SourceNode | undefined)) {
            return;
      }
      const id = node.id as SourceNode | undefined;
      if (id?.type === 'Identifier') {
            bindings.namespaces.add(id.name as string);
            return;
      }
      if (id?.type !== 'ObjectPattern') {
            return;
      }
      for (const property of (id.properties as SourceNode[] | undefined) ?? []) {
            const key = property.key as SourceNode | undefined;
            const value = property.value as SourceNode | undefined;
            if (
                  key?.type === 'Identifier' &&
                  EXEC_METHOD_NAMES.has(key.name as string) &&
                  value?.type === 'Identifier'
            ) {
                  bindings.directCalls.add(value.name as string);
            }
      }
};

const collectChildProcessBindings = (sourceFile: SourceNode): ChildProcessBindings => {
      const bindings: ChildProcessBindings = { directCalls: new Set(), namespaces: new Set() };

      visitSourceNodes(sourceFile, (node) => {
            if (node.type === 'ImportDeclaration') {
                  collectFromImportDeclaration(node, bindings);
            } else if (node.type === 'VariableDeclarator') {
                  collectFromVariableDeclarator(node, bindings);
            }
      });

      return bindings;
};

const isKnownChildProcessCallee = (callee: SourceNode | undefined, bindings: ChildProcessBindings): boolean => {
      if (callee?.type === 'Identifier') {
            return bindings.directCalls.has(callee.name as string);
      }
      if (callee?.type !== 'MemberExpression') {
            return false;
      }
      const object = callee.object as SourceNode | undefined;
      const property = callee.property as SourceNode | undefined;
      const methodName = property?.type === 'Identifier' ? (property.name as string) : undefined;
      return (
            !!methodName &&
            EXEC_METHOD_NAMES.has(methodName) &&
            object?.type === 'Identifier' &&
            bindings.namespaces.has(object.name as string)
      );
};

const isDynamicCommandArgument = (argument: SourceNode | undefined): boolean =>
      argument?.type === 'StringLiteral'
            ? false
            : argument?.type === 'TemplateLiteral'
              ? ((argument.expressions as unknown[] | undefined)?.length ?? 0) > 0
              : argument !== undefined;

const isCommandInjectionCall = (node: SourceNode, bindings: ChildProcessBindings): boolean => {
      if (node.type !== 'CallExpression') {
            return false;
      }
      const callee = node.callee as SourceNode | undefined;
      if (!isKnownChildProcessCallee(callee, bindings)) {
            return false;
      }
      const args = node.arguments as SourceNode[] | undefined;
      return isDynamicCommandArgument(args?.[0]);
};

const findCommandInjectionLines = (filePath: string, content: string): number[] => {
      const lines = new Set<number>();
      const sourceFile = parseSourceFile(filePath, content);
      const bindings = collectChildProcessBindings(sourceFile);

      visitSourceNodes(sourceFile, (node) => {
            if (isCommandInjectionCall(node, bindings) && node.loc) {
                  lines.add(node.loc.start.line);
            }
      });
      return [...lines].sort((a, b) => a - b);
};

export const commandInjectionRule: Rule = {
      id: 'command-injection',
      description:
            'Detecta child_process.exec()/execSync() (confirmado via import/require do módulo) recebendo um comando construído dinamicamente',
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
