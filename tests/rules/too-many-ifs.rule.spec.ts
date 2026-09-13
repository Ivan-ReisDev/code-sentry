import { expect, it } from 'vitest';
import { tooManyIfsRule } from '../../src/rules/too-many-ifs.rule.js';

it('does not report a function with exactly 2 ifs (at the limit)', () => {
      const content = ['function fn() {', '  if (a) { return 1; }', '  if (b) { return 2; }', '}'].join('\n');

      expect(tooManyIfsRule.check('file.ts', content)).toHaveLength(0);
});

it('reports a function with 3 ifs', () => {
      const content = [
            'function fn() {',
            '  if (a) { return 1; }',
            '  if (b) { return 2; }',
            '  if (c) { return 3; }',
            '}',
      ].join('\n');

      const findings = tooManyIfsRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ ruleId: 'too-many-ifs', severity: 'low', line: 1 });
      expect(findings[0].message).toContain('3');
});

it('counts nested ifs the same as sequential ones', () => {
      const content = [
            'function fn() {',
            '  if (a) {',
            '    if (b) {',
            '      if (c) { return 1; }',
            '    }',
            '  }',
            '}',
      ].join('\n');

      expect(tooManyIfsRule.check('file.ts', content)).toHaveLength(1);
});

it('counts each link of an else-if chain', () => {
      const content = [
            'function fn() {',
            '  if (a) { return 1; }',
            '  else if (b) { return 2; }',
            '  else if (c) { return 3; }',
            '}',
      ].join('\n');

      expect(tooManyIfsRule.check('file.ts', content)).toHaveLength(1);
});

it('does not report for/while/switch statements', () => {
      const content = [
            'function fn() {',
            '  for (const x of xs) { doWork(x); }',
            '  while (a) { doWork(); }',
            '  switch (b) {',
            '    case 1: break;',
            '    case 2: break;',
            '  }',
            '}',
      ].join('\n');

      expect(tooManyIfsRule.check('file.ts', content)).toHaveLength(0);
});

it('does not report a function with exactly 2 ternaries (at the limit)', () => {
      const content = [
            'const fn = (node) => {',
            '  const a = node.type === "A" ? node.a : undefined;',
            '  const b = node.type === "B" ? node.b : undefined;',
            '  return a ?? b;',
            '};',
      ].join('\n');

      expect(tooManyIfsRule.check('file.ts', content)).toHaveLength(0);
});

it('reports a function with 3 chained ternaries and no if statements', () => {
      const content = [
            'const isBodyParserWithoutLimit = (node) => {',
            '  const callee = node.type === "CallExpression" ? node.callee : undefined;',
            '  const object = callee?.type === "MemberExpression" ? callee.object : undefined;',
            '  const property = callee?.type === "MemberExpression" ? callee.property : undefined;',
            '  return object && property;',
            '};',
      ].join('\n');

      const findings = tooManyIfsRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ ruleId: 'too-many-ifs', severity: 'low' });
      expect(findings[0].message).toContain('3');
});

it('sums if statements and ternaries toward the same total', () => {
      const content = [
            'function fn(node) {',
            '  if (node.skip) { return undefined; }',
            '  const a = node.type === "A" ? node.a : undefined;',
            '  const b = node.type === "B" ? node.b : undefined;',
            '  return a ?? b;',
            '}',
      ].join('\n');

      const findings = tooManyIfsRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('3');
});
