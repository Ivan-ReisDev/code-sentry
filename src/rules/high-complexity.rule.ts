import { createFunctionStatementCountRule } from './lib/statement-count-rule.js';

export const highComplexityRule = createFunctionStatementCountRule({
      id: 'high-complexity',
      description: 'Detecta funções com muitos condicionais/loops/ternários (complexidade alta)',
      statementTypes: new Set([
            'IfStatement',
            'ConditionalExpression',
            'ForStatement',
            'ForInStatement',
            'ForOfStatement',
            'WhileStatement',
            'DoWhileStatement',
            'SwitchCase',
            'CatchClause',
      ]),
      maxCount: 5,
      unitLabel: 'condicionais/loops/ternários',
});
