import { createFunctionStatementCountRule } from './lib/statement-count-rule.js';

export const tooManyWhileLoopsRule = createFunctionStatementCountRule({
  id: 'too-many-while-loops',
  description: 'Detecta funções com muitos loops "while"/"do-while"',
  statementTypes: new Set(['WhileStatement', 'DoWhileStatement']),
  maxCount: 1,
  unitLabel: 'loops while/do-while',
});
