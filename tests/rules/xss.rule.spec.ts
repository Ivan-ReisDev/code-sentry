import { expect, it } from 'vitest';
import { xssRule } from '../../src/rules/xss.rule.js';

it('detects an unsafe assignment to innerHTML', () => {
  const findings = xssRule.check(
    'file.js',
    'function render(el, userInput) {\n  el.innerHTML = userInput;\n}',
  );

  expect(findings.length).toBeGreaterThan(0);
  expect(findings[0]).toMatchObject({
    ruleId: 'no-unsanitized/property',
    file: 'file.js',
    severity: 'high',
  });
});

it('does not flag assigning a string literal to innerHTML', () => {
  const findings = xssRule.check('file.js', "el.innerHTML = '<b>static</b>';");

  expect(findings).toHaveLength(0);
});

it('detects an unsafe call to document.write', () => {
  const findings = xssRule.check(
    'file.js',
    'function render(userInput) {\n  document.write(userInput);\n}',
  );

  expect(findings.length).toBeGreaterThan(0);
  expect(findings[0].ruleId).toBe('no-unsanitized/method');
});

it('does not flag unrelated code', () => {
  const findings = xssRule.check('file.js', 'console.log(userInput);');

  expect(findings).toHaveLength(0);
});
