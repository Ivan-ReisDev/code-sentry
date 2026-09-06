import { expect, it } from 'vitest';
import { noHardcodedSecretRule } from '../../src/rules/no-hardcoded-secret.rule.js';

it('detects a hardcoded password', () => {
  const findings = noHardcodedSecretRule.check('file.js', 'const password = "hunter2";');

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'no-hardcoded-secret',
    file: 'file.js',
    line: 1,
    severity: 'critical',
  });
});

it('detects a hardcoded apiKey', () => {
  const findings = noHardcodedSecretRule.check('file.js', 'const apiKey = "sk_live_abc123";');

  expect(findings).toHaveLength(1);
});

it('detects a secret inside an object literal', () => {
  const findings = noHardcodedSecretRule.check('file.js', 'const config = { secret: "xyz" };');

  expect(findings).toHaveLength(1);
});

it('does not flag a secret read from an environment variable', () => {
  const findings = noHardcodedSecretRule.check('file.js', 'const password = process.env.PASSWORD;');

  expect(findings).toHaveLength(0);
});

it('does not flag an empty string value', () => {
  const findings = noHardcodedSecretRule.check('file.js', 'const password = "";');

  expect(findings).toHaveLength(0);
});

it('does not flag a variable whose name is not secret-like', () => {
  const findings = noHardcodedSecretRule.check('file.js', 'const username = "admin";');

  expect(findings).toHaveLength(0);
});
