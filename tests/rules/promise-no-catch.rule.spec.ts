import { expect, it } from 'vitest';
import { promiseNoCatchRule } from '../../src/rules/promise-no-catch.rule.js';

it('detects a .then() without a trailing .catch()', () => {
  const findings = promiseNoCatchRule.check('file.js', 'promise.then(handleSuccess);');

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'promise-no-catch',
    file: 'file.js',
    line: 1,
    severity: 'medium',
  });
});

it('does not flag a .then() followed by .catch()', () => {
  const findings = promiseNoCatchRule.check(
    'file.js',
    'promise.then(handleSuccess).catch(handleError);',
  );

  expect(findings).toHaveLength(0);
});

it('does not flag .then() called with a rejection handler as the second argument', () => {
  const findings = promiseNoCatchRule.check(
    'file.js',
    'promise.then(handleSuccess, handleError);',
  );

  expect(findings).toHaveLength(0);
});

it('does not flag a longer chain that eventually reaches .catch()', () => {
  const findings = promiseNoCatchRule.check(
    'file.js',
    'promise.then(a).then(b).catch(c);',
  );

  expect(findings).toHaveLength(0);
});

it('detects a chain of .then() calls that never reaches .catch()', () => {
  const findings = promiseNoCatchRule.check('file.js', 'promise.then(a).then(b);');

  expect(findings).toHaveLength(1);
});

it('returns no findings when .then() is not used', () => {
  const findings = promiseNoCatchRule.check('file.js', 'const x = 1;');

  expect(findings).toHaveLength(0);
});
