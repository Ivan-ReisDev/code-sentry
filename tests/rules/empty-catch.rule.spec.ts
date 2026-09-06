import { expect, it } from 'vitest';
import { emptyCatchRule } from '../../src/rules/empty-catch.rule.js';

it('detects an empty catch block', () => {
  const content = ['try {', '  doSomething();', '} catch (e) {}'].join('\n');

  const findings = emptyCatchRule.check('file.js', content);

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'empty-catch',
    file: 'file.js',
    line: 3,
    severity: 'medium',
  });
});

it('does not flag a catch block that handles the error', () => {
  const content = ['try {', '  doSomething();', '} catch (e) {', '  console.log(e);', '}'].join(
    '\n',
  );

  expect(emptyCatchRule.check('file.js', content)).toHaveLength(0);
});

it('detects an empty catch block without a binding parameter', () => {
  const content = ['try {', '  doSomething();', '} catch {}'].join('\n');

  const findings = emptyCatchRule.check('file.js', content);

  expect(findings).toHaveLength(1);
  expect(findings[0].line).toBe(3);
});

it('treats a catch block containing only a comment as empty', () => {
  const content = ['try {', '  doSomething();', '} catch (e) {', '  // ignored on purpose', '}'].join(
    '\n',
  );

  expect(emptyCatchRule.check('file.js', content)).toHaveLength(1);
});

it('returns no findings when there is no try/catch', () => {
  const findings = emptyCatchRule.check('file.js', 'const x = 1;');

  expect(findings).toHaveLength(0);
});
