import { parseSourceFile, type SourceNode } from '../../parser/source-file.js';
import { FUNCTION_TYPES, getFunctionName, getFunctionStartLine } from './function-info.js';
import type { Rule, RuleFinding } from '../rule.interface.js';

interface FunctionStatementCount {
      startLine: number;
      count: number;
      name?: string;
}

interface StatementCountState {
      config: StatementCountRuleConfig;
      results: FunctionStatementCount[];
}

export interface StatementCountRuleConfig {
      id: string;
      description: string;
      statementTypes: Set<string>;
      maxCount: number;
      unitLabel: string;
}

const isSourceNode = (value: unknown): value is SourceNode => {
      return typeof value === 'object' && value !== null && 'type' in value;
};

const createContext = (node: SourceNode, parent?: SourceNode): FunctionStatementCount => {
      return {
            startLine: getFunctionStartLine(node, parent) ?? node.loc?.start.line ?? 0,
            count: 0,
            name: getFunctionName(node, parent),
      };
};

const appendOverLimitContext = (context: FunctionStatementCount, state: StatementCountState): void => {
      if (context.count > state.config.maxCount) {
            state.results.push(context);
      }
};

const walkChild = (
      value: unknown,
      parent: SourceNode,
      context: FunctionStatementCount | undefined,
      state: StatementCountState,
): void => {
      if (Array.isArray(value)) {
            value.filter(isSourceNode).forEach((child) => walk(child, parent, context, state));
      } else if (isSourceNode(value)) {
            walk(value, parent, context, state);
      }
};

const walkChildren = (
      node: SourceNode,
      context: FunctionStatementCount | undefined,
      state: StatementCountState,
): void => {
      for (const value of Object.values(node)) {
            walkChild(value, node, context, state);
      }
};

const walkFunction = (node: SourceNode, parent: SourceNode | undefined, state: StatementCountState): void => {
      const context = createContext(node, parent);
      walkChildren(node, context, state);
      appendOverLimitContext(context, state);
};

const incrementStatementCount = (
      node: SourceNode,
      context: FunctionStatementCount | undefined,
      state: StatementCountState,
): void => {
      if (context && state.config.statementTypes.has(node.type)) {
            context.count += 1;
      }
};

const walk = (
      node: SourceNode,
      parent: SourceNode | undefined,
      context: FunctionStatementCount | undefined,
      state: StatementCountState,
): void => {
      if (FUNCTION_TYPES.has(node.type)) {
            walkFunction(node, parent, state);
            return;
      }

      incrementStatementCount(node, context, state);
      walkChildren(node, context, state);
};

const findFunctionStatementCounts = (
      filePath: string,
      content: string,
      config: StatementCountRuleConfig,
): FunctionStatementCount[] => {
      const state: StatementCountState = { config, results: [] };
      walkChildren(parseSourceFile(filePath, content), undefined, state);
      return state.results;
};

const toFinding = (filePath: string, config: StatementCountRuleConfig, result: FunctionStatementCount): RuleFinding => {
      const subject = result.name ? `Função "${result.name}"` : 'Função anônima';
      return {
            ruleId: config.id,
            message: `${subject} tem ${result.count} ${config.unitLabel} — complexidade alta, considere refatorar (limite recomendado: ${config.maxCount})`,
            file: filePath,
            line: result.startLine,
            severity: 'low',
      };
};

export const createFunctionStatementCountRule = (config: StatementCountRuleConfig): Rule => ({
      id: config.id,
      description: config.description,
      check(filePath: string, content: string): RuleFinding[] {
            return findFunctionStatementCounts(filePath, content, config).map((result) =>
                  toFinding(filePath, config, result),
            );
      },
});
