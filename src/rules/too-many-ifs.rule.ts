import { createFunctionStatementCountRule } from './lib/statement-count-rule.js';

export const tooManyIfsRule = createFunctionStatementCountRule({
  id: 'too-many-ifs',
  description: 'Detecta funções com muitos "if" (incluindo "else if")',
  statementTypes: new Set(['IfStatement']),
  maxCount: 2,
  unitLabel: 'declarações if (incluindo else if)',
});
