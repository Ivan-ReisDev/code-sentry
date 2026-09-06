import { createFunctionStatementCountRule } from './lib/statement-count-rule.js';

export const tooManyTryCatchRule = createFunctionStatementCountRule({
      id: 'too-many-try-catch',
      description: 'Detecta funções com muitos blocos "try/catch"',
      statementTypes: new Set(['TryStatement']),
      maxCount: 1,
      unitLabel: 'blocos try/catch',
});
