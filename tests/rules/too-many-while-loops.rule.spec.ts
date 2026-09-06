import { expect, it } from 'vitest';
import { tooManyWhileLoopsRule } from '../../src/rules/too-many-while-loops.rule.js';

it('does not report a function with exactly 1 while loop (at the limit)', () => {
      const content = 'function fn() {\n  while (a) { doWork(); }\n}';

      expect(tooManyWhileLoopsRule.check('file.ts', content)).toHaveLength(0);
});

it('reports a function with 2 while loops', () => {
      const content = ['function fn() {', '  while (a) { doWork(); }', '  while (b) { doWork(); }', '}'].join('\n');

      const findings = tooManyWhileLoopsRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ ruleId: 'too-many-while-loops', severity: 'low', line: 1 });
      expect(findings[0].message).toContain('2');
});

it('counts while and do-while together', () => {
      const content = ['function fn() {', '  while (a) { doWork(); }', '  do { doWork(); } while (b);', '}'].join('\n');

      expect(tooManyWhileLoopsRule.check('file.ts', content)).toHaveLength(1);
});

it('does not report if/for/switch statements', () => {
      const content = ['function fn() {', '  if (a) { return 1; }', '  for (const x of xs) { doWork(x); }', '}'].join(
            '\n',
      );

      expect(tooManyWhileLoopsRule.check('file.ts', content)).toHaveLength(0);
});
