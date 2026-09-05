import type { Rule } from './rule.interface.js';
import { noEvalRule } from './no-eval.rule.js';
import { noHardcodedSecretRule } from './no-hardcoded-secret.rule.js';
import { unsafeSqlRule } from './unsafe-sql.rule.js';

export const allRules: Rule[] = [noEvalRule, noHardcodedSecretRule, unsafeSqlRule];
