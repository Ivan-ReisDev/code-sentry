import { expect, it } from 'vitest';
import { noEvalRule } from '../../src/rules/no-eval.rule.js';

it('detects a call to eval()', () => {
  const findings = noEvalRule.check('file.js', 'eval("2 + 2");');

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'no-eval',
    file: 'file.js',
    line: 1,
    severity: 'high',
  });
});

it('reports the correct line number for a multi-line file', () => {
  const content = ['const x = 1;', 'const y = 2;', 'eval("x + y");'].join('\n');

  const findings = noEvalRule.check('file.js', content);

  expect(findings).toHaveLength(1);
  expect(findings[0].line).toBe(3);
});

it('returns no findings when eval is not used', () => {
  const findings = noEvalRule.check('file.js', 'const x = 1;');

  expect(findings).toHaveLength(0);
});

it('ignores eval-like text inside strings, comments, templates and regular expressions', () => {
  const content = [
    'const singleQuoted = \'eval("2 + 2")\';',
    'const doubleQuoted = "eval(\\\"2 + 2\\\")";',
    'const template = `eval("2 + 2")`;',
    '// eval("2 + 2");',
    '/* eval("2 + 2"); */',
    'const pattern = /eval\\s*\\(/;',
  ].join('\n');

  expect(noEvalRule.check('file.js', content)).toHaveLength(0);
});

it('detects eval inside a template expression', () => {
  const findings = noEvalRule.check('file.js', 'const value = `result: ${eval("2 + 2")}`;');

  expect(findings).toHaveLength(1);
  expect(findings[0].line).toBe(1);
});

it('detects eval after a division expression', () => {
  const findings = noEvalRule.check('file.js', 'const value = total / eval("count");');

  expect(findings).toHaveLength(1);
});

it('detects new Function(...)', () => {
  const findings = noEvalRule.check('file.js', "new Function('return 1');");

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'no-eval',
    file: 'file.js',
    line: 1,
    severity: 'high',
  });
});

it('detects new Function(...) with multiple arguments', () => {
  const findings = noEvalRule.check('file.js', "new Function('a', 'b', 'return a + b');");

  expect(findings).toHaveLength(1);
});

it('does not flag constructing an unrelated class', () => {
  const findings = noEvalRule.check('file.js', 'new Foo();');

  expect(findings).toHaveLength(0);
});
