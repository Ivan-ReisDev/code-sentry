import type { SourceNode } from '../../parser/source-file.js';

export const FUNCTION_TYPES = new Set([
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression',
      'ObjectMethod',
      'ClassMethod',
      'ClassPrivateMethod',
]);

type NodeRecord = Record<string, unknown>;

const isNodeRecord = (value: unknown): value is NodeRecord => {
      return typeof value === 'object' && value !== null;
};

const nameValue = (node: NodeRecord): string | undefined => {
      return typeof node.name === 'string' ? node.name : undefined;
};

const literalValue = (node: NodeRecord): string | undefined => {
      return typeof node.value === 'string' || typeof node.value === 'number' ? String(node.value) : undefined;
};

export const nodeName = (node: unknown): string | undefined => {
      if (!isNodeRecord(node)) {
            return undefined;
      }
      return nameValue(node) ?? literalValue(node) ?? nodeName(node.id);
};

const PARENT_NAME_KEYS: Record<string, string> = {
      VariableDeclarator: 'id',
      ObjectProperty: 'key',
      AssignmentExpression: 'left',
};

const parentFunctionName = (parent?: SourceNode): string | undefined => {
      const nameKey = parent ? PARENT_NAME_KEYS[parent.type] : undefined;
      return nameKey ? nodeName(parent?.[nameKey]) : undefined;
};

const isConstructor = (node: SourceNode): boolean => {
      return node.type === 'ClassMethod' && node.kind === 'constructor';
};

export const getFunctionName = (node: SourceNode, parent?: SourceNode): string | undefined => {
      const ownName = nodeName(node.id) ?? nodeName(node.key);
      return isConstructor(node) ? 'constructor' : (ownName ?? parentFunctionName(parent));
};

export const getFunctionStartLine = (node: SourceNode, parent?: SourceNode): number | undefined => {
      if (node.type === 'ArrowFunctionExpression' && parent?.type === 'VariableDeclarator') {
            return parent.loc?.start.line;
      }
      return node.loc?.start.line;
};
