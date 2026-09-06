import type { Rule } from './rule.interface.js';
import { deepNestingRule } from './deep-nesting.rule.js';
import { highComplexityRule } from './high-complexity.rule.js';
import { longFunctionRule } from './long-function.rule.js';
import { noEvalRule } from './no-eval.rule.js';
import { noHardcodedSecretRule } from './no-hardcoded-secret.rule.js';
import { tooManyForLoopsRule } from './too-many-for-loops.rule.js';
import { tooManyIfsRule } from './too-many-ifs.rule.js';
import { tooManySwitchCasesRule } from './too-many-switch-cases.rule.js';
import { tooManyTryCatchRule } from './too-many-try-catch.rule.js';
import { tooManyWhileLoopsRule } from './too-many-while-loops.rule.js';
import { unsafeSqlRule } from './unsafe-sql.rule.js';

export const allRules: Rule[] = [
  noEvalRule,
  noHardcodedSecretRule,
  unsafeSqlRule,
  longFunctionRule,
  deepNestingRule,
  highComplexityRule,
  tooManyIfsRule,
  tooManyForLoopsRule,
  tooManyWhileLoopsRule,
  tooManyTryCatchRule,
  tooManySwitchCasesRule,
];
