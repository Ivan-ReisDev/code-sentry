import { expect, it } from 'vitest';
import { highComplexityRule } from '../../src/rules/high-complexity.rule.js';

it('does not report a function with exactly 5 branches (at the limit)', () => {
  const content = [
    'function fn() {',
    '  if (a) { return 1; }',
    '  if (b) { return 2; }',
    '  if (c) { return 3; }',
    '  if (d) { return 4; }',
    '  if (e) { return 5; }',
    '}',
  ].join('\n');

  expect(highComplexityRule.check('file.ts', content)).toHaveLength(0);
});

it('reports a function with 6 sequential ifs', () => {
  const content = [
    'function getFunctionName() {',
    '  if (a) { return 1; }',
    '  if (b) { return 2; }',
    '  if (c) { return 3; }',
    '  if (d) { return 4; }',
    '  if (e) { return 5; }',
    '  if (f) { return 6; }',
    '}',
  ].join('\n');

  const findings = highComplexityRule.check('file.ts', content);

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'high-complexity',
    severity: 'low',
    line: 1,
  });
  expect(findings[0].message).toContain('"getFunctionName"');
  expect(findings[0].message).toContain('6');
});

it('counts nested ifs the same as sequential ones', () => {
  const content = [
    'function fn() {',
    '  if (a) {',
    '    if (b) {',
    '      if (c) {',
    '        if (d) {',
    '          if (e) {',
    '            if (f) { return 1; }',
    '          }',
    '        }',
    '      }',
    '    }',
    '  }',
    '}',
  ].join('\n');

  expect(highComplexityRule.check('file.ts', content)).toHaveLength(1);
});

it('counts each link of an else-if chain as its own branch', () => {
  const content = [
    'function fn() {',
    '  if (a) { return 1; }',
    '  else if (b) { return 2; }',
    '  else if (c) { return 3; }',
    '  else if (d) { return 4; }',
    '  else if (e) { return 5; }',
    '  else if (f) { return 6; }',
    '}',
  ].join('\n');

  expect(highComplexityRule.check('file.ts', content)).toHaveLength(1);
});

it('counts a mix of ifs and loops toward the same total', () => {
  const content = [
    'function fn() {',
    '  if (a) { return 1; }',
    '  if (b) { return 2; }',
    '  for (const x of xs) { doWork(x); }',
    '  while (c) { doWork(); }',
    '  if (d) { return 4; }',
    '  for (const y of ys) { doWork(y); }',
    '}',
  ].join('\n');

  expect(highComplexityRule.check('file.ts', content)).toHaveLength(1);
});

it('counts each switch case as a branch', () => {
  const content = [
    'function fn(x) {',
    '  switch (x) {',
    '    case 1: return 1;',
    '    case 2: return 2;',
    '    case 3: return 3;',
    '    case 4: return 4;',
    '    case 5: return 5;',
    '    case 6: return 6;',
    '  }',
    '}',
  ].join('\n');

  expect(highComplexityRule.check('file.ts', content)).toHaveLength(1);
});

it('evaluates a nested function independently from its complex outer function', () => {
  const content = [
    'function outer() {',
    '  function inner() { if (a) { return 1; } }',
    '  if (w) { return 1; }',
    '  if (x) { return 2; }',
    '  if (y) { return 3; }',
    '  if (z) { return 4; }',
    '  if (v) { return 5; }',
    '  if (u) { return 6; }',
    '}',
  ].join('\n');

  const findings = highComplexityRule.check('file.ts', content);

  expect(findings).toHaveLength(1);
  expect(findings[0].message).toContain('"outer"');
});

it('does not report a simple function with no branches', () => {
  const findings = highComplexityRule.check('file.ts', 'function fn() {\n  return 1;\n}');

  expect(findings).toHaveLength(0);
});
