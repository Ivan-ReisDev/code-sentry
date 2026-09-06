import { expect, it } from 'vitest';
import { tooManySwitchCasesRule } from '../../src/rules/too-many-switch-cases.rule.js';

it('does not report a switch with exactly 4 cases (at the limit)', () => {
  const content = [
    'function fn(x) {',
    '  switch (x) {',
    '    case 1: return 1;',
    '    case 2: return 2;',
    '    case 3: return 3;',
    '    case 4: return 4;',
    '  }',
    '}',
  ].join('\n');

  expect(tooManySwitchCasesRule.check('file.ts', content)).toHaveLength(0);
});

it('reports a switch with 5 cases', () => {
  const content = [
    'function fn(x) {',
    '  switch (x) {',
    '    case 1: return 1;',
    '    case 2: return 2;',
    '    case 3: return 3;',
    '    case 4: return 4;',
    '    case 5: return 5;',
    '  }',
    '}',
  ].join('\n');

  const findings = tooManySwitchCasesRule.check('file.ts', content);

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({ ruleId: 'too-many-switch-cases', severity: 'low', line: 2 });
  expect(findings[0].message).toContain('5');
});

it('reports each over-limit switch independently when there are two', () => {
  const content = [
    'function fn(x) {',
    '  switch (x) {',
    '    case 1: return 1;',
    '    case 2: return 2;',
    '  }',
    '}',
    '',
    'function gn(y) {',
    '  switch (y) {',
    '    case 1: return 1;',
    '    case 2: return 2;',
    '    case 3: return 3;',
    '    case 4: return 4;',
    '    case 5: return 5;',
    '  }',
    '}',
  ].join('\n');

  const findings = tooManySwitchCasesRule.check('file.ts', content);

  expect(findings).toHaveLength(1);
  expect(findings[0].line).toBe(9);
});

it('does not report if/for/while statements', () => {
  const content = [
    'function fn() {',
    '  if (a) { return 1; }',
    '  for (const x of xs) { doWork(x); }',
    '}',
  ].join('\n');

  expect(tooManySwitchCasesRule.check('file.ts', content)).toHaveLength(0);
});
