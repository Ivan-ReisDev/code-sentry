import { expect, it } from 'vitest';
import { tooManyTryCatchRule } from '../../src/rules/too-many-try-catch.rule.js';

it('does not report a function with exactly 1 try/catch (at the limit)', () => {
      const content = 'function fn() {\n  try { doWork(); } catch (e) { handle(e); }\n}';

      expect(tooManyTryCatchRule.check('file.ts', content)).toHaveLength(0);
});

it('reports a function with 2 try/catch blocks', () => {
      const content = [
            'function fn() {',
            '  try { doWork(); } catch (e) { handle(e); }',
            '  try { doMore(); } catch (e) { handle(e); }',
            '}',
      ].join('\n');

      const findings = tooManyTryCatchRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ ruleId: 'too-many-try-catch', severity: 'low', line: 1 });
      expect(findings[0].message).toContain('2');
});

it('counts a try/catch as a single occurrence, not one for try and one for catch', () => {
      const content = 'function fn() {\n  try { doWork(); } catch (e) { handle(e); }\n}';

      expect(tooManyTryCatchRule.check('file.ts', content)).toHaveLength(0);
});

it('does not report if/for/while statements', () => {
      const content = ['function fn() {', '  if (a) { return 1; }', '  for (const x of xs) { doWork(x); }', '}'].join(
            '\n',
      );

      expect(tooManyTryCatchRule.check('file.ts', content)).toHaveLength(0);
});
