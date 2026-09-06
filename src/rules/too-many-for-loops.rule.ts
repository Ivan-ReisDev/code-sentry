import { createFunctionStatementCountRule } from './lib/statement-count-rule.js';

export const tooManyForLoopsRule = createFunctionStatementCountRule({
  id: 'too-many-for-loops',
  description: 'Detecta funções com muitos loops "for"/"for-in"/"for-of"',
  statementTypes: new Set(['ForStatement', 'ForInStatement', 'ForOfStatement']),
  maxCount: 1,
  unitLabel: 'loops for',
});
