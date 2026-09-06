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

it('detects dangerouslySetInnerHTML with untrusted data in a .tsx React component', () => {
  const findings = xssRule.check(
    'Profile.tsx',
    'export function Profile({ bio }: { bio: string }) {\n  return <div dangerouslySetInnerHTML={{ __html: bio }} />;\n}',
  );

  expect(findings.length).toBeGreaterThan(0);
});

it('detects dangerouslySetInnerHTML with untrusted data in a .jsx React component', () => {
  const findings = xssRule.check(
    'Profile.jsx',
    'export function Profile({ bio }) {\n  return <div dangerouslySetInnerHTML={{ __html: bio }} />;\n}',
  );

  expect(findings.length).toBeGreaterThan(0);
});

it('detects an unsafe assignment to innerHTML in a .ts file', () => {
  const findings = xssRule.check(
    'render.ts',
    'function render(el: HTMLElement, userInput: string) {\n  el.innerHTML = userInput;\n}',
  );

  expect(findings.length).toBeGreaterThan(0);
});

it('does not flag dangerouslySetInnerHTML with a static string literal', () => {
  const findings = xssRule.check(
    'Static.tsx',
    'export function Static() { return <div dangerouslySetInnerHTML={{ __html: "<b>static</b>" }} />; }',
  );

  expect(findings.filter((f) => f.ruleId === 'dangerously-set-inner-html')).toHaveLength(0);
});
