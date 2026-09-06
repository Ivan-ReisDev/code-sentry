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
