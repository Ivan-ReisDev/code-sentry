import type { Rule } from './rule.interface.js';
import { awaitNoTryCatchRule } from './await-no-try-catch.rule.js';
import { commandInjectionRule } from './command-injection.rule.js';
import { deepNestingRule } from './deep-nesting.rule.js';
import { emptyCatchRule } from './empty-catch.rule.js';
import { expressMissingBodyLimitRule } from './express-missing-body-limit.rule.js';
import { floatingPromiseRule } from './floating-promise.rule.js';
import { highComplexityRule } from './high-complexity.rule.js';
import { insecureRandomTokenRule } from './insecure-random-token.rule.js';
import { jwtDecodeWithoutVerifyRule } from './jwt-decode-without-verify.rule.js';
import { jwtNoExpirationRule } from './jwt-no-expiration.rule.js';
import { longFunctionRule } from './long-function.rule.js';
import { noAnyRule } from './no-any.rule.js';
import { noEvalRule } from './no-eval.rule.js';
import { noHardcodedSecretRule } from './no-hardcoded-secret.rule.js';
import { permissiveCorsRule } from './permissive-cors.rule.js';
import { promiseNoCatchRule } from './promise-no-catch.rule.js';
import { publicEnvVarSecretRule } from './public-env-var-secret.rule.js';
import { securityLintRule } from './security-lint.rule.js';
import { sensitiveDataInLogsRule } from './sensitive-data-in-logs.rule.js';
import { tlsValidationDisabledRule } from './tls-validation-disabled.rule.js';
import { tooManyForLoopsRule } from './too-many-for-loops.rule.js';
import { tooManyIfsRule } from './too-many-ifs.rule.js';
import { tooManySwitchCasesRule } from './too-many-switch-cases.rule.js';
import { tooManyTryCatchRule } from './too-many-try-catch.rule.js';
import { tooManyWhileLoopsRule } from './too-many-while-loops.rule.js';
import { unsafeSqlRule } from './unsafe-sql.rule.js';
import { weakHashAlgorithmRule } from './weak-hash-algorithm.rule.js';
import { weakSecretFallbackRule } from './weak-secret-fallback.rule.js';
import { xssRule } from './xss.rule.js';
import { xxeUnsafeXmlParsingRule } from './xxe-unsafe-xml-parsing.rule.js';

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
      promiseNoCatchRule,
      awaitNoTryCatchRule,
      floatingPromiseRule,
      noAnyRule,
      emptyCatchRule,
      commandInjectionRule,
      jwtNoExpirationRule,
      permissiveCorsRule,
      insecureRandomTokenRule,
      weakHashAlgorithmRule,
      tlsValidationDisabledRule,
      expressMissingBodyLimitRule,
      xssRule,
      securityLintRule,
      weakSecretFallbackRule,
      jwtDecodeWithoutVerifyRule,
      xxeUnsafeXmlParsingRule,
      sensitiveDataInLogsRule,
      publicEnvVarSecretRule,
];
