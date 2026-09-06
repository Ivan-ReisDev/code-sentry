import { expect, it } from 'vitest';
import { tooManyForLoopsRule } from '../../src/rules/too-many-for-loops.rule.js';

it('does not report a function with exactly 1 for loop (at the limit)', () => {
      const content = 'function fn() {\n  for (const x of xs) { doWork(x); }\n}';

      expect(tooManyForLoopsRule.check('file.ts', content)).toHaveLength(0);
});

it('reports a function with 2 for loops', () => {
      const content = [
            'function fn() {',
            '  for (const x of xs) { doWork(x); }',
            '  for (const y of ys) { doWork(y); }',
            '}',
      ].join('\n');

      const findings = tooManyForLoopsRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ ruleId: 'too-many-for-loops', severity: 'low', line: 1 });
      expect(findings[0].message).toContain('2');
});

it('counts for/for-in/for-of together', () => {
      const content = [
            'function fn() {',
            '  for (let i = 0; i < 10; i++) { doWork(i); }',
            '  for (const key in obj) { doWork(key); }',
            '}',
      ].join('\n');

      expect(tooManyForLoopsRule.check('file.ts', content)).toHaveLength(1);
});

it('does not report if/while/switch statements', () => {
      const content = ['function fn() {', '  if (a) { return 1; }', '  while (b) { doWork(); }', '}'].join('\n');

      expect(tooManyForLoopsRule.check('file.ts', content)).toHaveLength(0);
});
