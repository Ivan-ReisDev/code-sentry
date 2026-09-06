import { parseSourceFile, type SourceNode, visitSourceNodes } from '../parser/source-file.js';
import { FUNCTION_TYPES, getFunctionName, getFunctionStartLine } from './lib/function-info.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const MAX_LINES = 30;

interface LongFunction {
      startLine: number;
      totalLines: number;
      name?: string;
}

const toLongFunction = (node: SourceNode, parent?: SourceNode): LongFunction | undefined => {
      const startLine = getFunctionStartLine(node, parent);
      const endLine = node.loc?.end.line;
      if (startLine === undefined || endLine === undefined) {
            return undefined;
      }

      const totalLines = endLine - startLine + 1;
      if (totalLines <= MAX_LINES) {
            return undefined;
      }
      return { startLine, totalLines, name: getFunctionName(node, parent) };
};

const findLongFunctions = (filePath: string, content: string): LongFunction[] => {
      const results: LongFunction[] = [];
      const sourceFile = parseSourceFile(filePath, content);

      visitSourceNodes(sourceFile, (node, parent) => {
            if (FUNCTION_TYPES.has(node.type)) {
                  const longFunction = toLongFunction(node, parent);
                  if (longFunction) {
                        results.push(longFunction);
                  }
            }
      });
      return results;
};

const toFinding = (filePath: string, longFunction: LongFunction): RuleFinding => {
      const { startLine, totalLines, name } = longFunction;
      const subject = name ? `Função "${name}"` : 'Função anônima';
      return {
            ruleId: 'long-function',
            message: `${subject} com ${totalLines} linhas — considere dividir em funções menores (limite recomendado: ${MAX_LINES})`,
            file: filePath,
            line: startLine,
            severity: 'low',
      };
};

export const longFunctionRule: Rule = {
      id: 'long-function',
      description: 'Detecta funções com mais de 30 linhas',
      check(filePath: string, content: string): RuleFinding[] {
            return findLongFunctions(filePath, content).map((longFunction) => toFinding(filePath, longFunction));
      },
};
