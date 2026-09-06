import { parse } from '@babel/parser';

export interface SourceLocation {
  start: { line: number };
  end: { line: number };
}

export interface SourceNode {
  type: string;
  start?: number | null;
  end?: number | null;
  loc?: SourceLocation | null;
  [key: string]: unknown;
}

export type SourceVisitor = (node: SourceNode, parent?: SourceNode) => void;

const isJsxFile = (filePath: string): boolean => /\.(tsx|jsx)$/.test(filePath);

export const parseSourceFile = (filePath: string, content: string): SourceNode => {
  return parse(content, {
    sourceFilename: filePath,
    sourceType: 'unambiguous',
    plugins: isJsxFile(filePath)
      ? ['jsx', 'typescript', 'decorators-legacy']
      : ['typescript', 'decorators-legacy'],
    errorRecovery: true,
  }) as unknown as SourceNode;
};

const isSourceNode = (value: unknown): value is SourceNode => {
  return typeof value === 'object' && value !== null && 'type' in value;
};

export const visitSourceNodes = (
  node: SourceNode,
  visitor: SourceVisitor,
  parent?: SourceNode,
): void => {
  visitor(node, parent);

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.filter(isSourceNode).forEach((child) => visitSourceNodes(child, visitor, node));
    } else if (isSourceNode(value)) {
      visitSourceNodes(value, visitor, node);
    }
  }
};
