import { createFunctionStatementCountRule } from './lib/statement-count-rule.js';

export const tooManyIfsRule = createFunctionStatementCountRule({
      id: 'too-many-ifs',
      description: 'Detecta funções com muitos "if" ou ternários (incluindo "else if")',
      statementTypes: new Set(['IfStatement', 'ConditionalExpression']),
      maxCount: 2,
      unitLabel: 'declarações if e expressões ternárias (incluindo else if)',
});
