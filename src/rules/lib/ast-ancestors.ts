import type { SourceNode } from '../../parser/source-file.js';

export type AncestorVisitor = (node: SourceNode, ancestors: SourceNode[]) => void;

const isSourceNode = (value: unknown): value is SourceNode => {
      return typeof value === 'object' && value !== null && 'type' in value;
};

export const walkWithAncestors = (node: SourceNode, visitor: AncestorVisitor, ancestors: SourceNode[] = []): void => {
      visitor(node, ancestors);

      const nextAncestors = [node, ...ancestors];
      for (const value of Object.values(node)) {
            if (Array.isArray(value)) {
                  value.filter(isSourceNode).forEach((child) => walkWithAncestors(child, visitor, nextAncestors));
            } else if (isSourceNode(value)) {
                  walkWithAncestors(value, visitor, nextAncestors);
            }
      }
};
