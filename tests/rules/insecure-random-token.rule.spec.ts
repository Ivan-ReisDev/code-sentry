import { expect, it } from 'vitest';
import { insecureRandomTokenRule } from '../../src/rules/insecure-random-token.rule.js';

it('detects a token generated with Math.random()', () => {
  const findings = insecureRandomTokenRule.check(
    'file.js',
    'const token = Math.random().toString(36);',
  );

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'insecure-random-token',
    file: 'file.js',
    line: 1,
    severity: 'high',
  });
});

it('detects a sessionToken generated with Math.random()', () => {
  const findings = insecureRandomTokenRule.check(
    'file.js',
    'const sessionToken = Math.random().toString(36).substring(2);',
  );

  expect(findings).toHaveLength(1);
});

it('does not flag Math.random() when the variable name is unrelated to tokens', () => {
  const findings = insecureRandomTokenRule.check('file.js', 'const id = Math.random();');

  expect(findings).toHaveLength(0);
});

it('does not flag a token generated with a cryptographically secure source', () => {
  const findings = insecureRandomTokenRule.check(
    'file.js',
    "const token = crypto.randomBytes(32).toString('hex');",
  );

  expect(findings).toHaveLength(0);
});

it('returns no findings when Math.random is not used', () => {
  const findings = insecureRandomTokenRule.check('file.js', 'const x = 1;');

  expect(findings).toHaveLength(0);
});
