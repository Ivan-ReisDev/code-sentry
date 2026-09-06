import { expect, it } from 'vitest';
import { noAnyRule } from '../../src/rules/no-any.rule.js';

it('detects a parameter typed as any', () => {
      const findings = noAnyRule.check('file.ts', 'function greet(name: any) {}');

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'no-any',
            file: 'file.ts',
            line: 1,
            severity: 'low',
      });
});

it('detects a variable typed as any', () => {
      const findings = noAnyRule.check('file.ts', 'const value: any = 1;');

      expect(findings).toHaveLength(1);
});

it('detects a function return type of any', () => {
      const findings = noAnyRule.check('file.ts', 'function getValue(): any {\n  return 1;\n}');

      expect(findings).toHaveLength(1);
});

it('detects an "as any" cast', () => {
      const findings = noAnyRule.check('file.ts', 'const value = (input as any).field;');

      expect(findings).toHaveLength(1);
});

it('detects any used as a generic type argument', () => {
      const findings = noAnyRule.check('file.ts', 'const list: Array<any> = [];');

      expect(findings).toHaveLength(1);
});

it('reports one finding per occurrence on different lines', () => {
      const content = ['const a: any = 1;', 'const b: any = 2;'].join('\n');

      const findings = noAnyRule.check('file.ts', content);

      expect(findings).toHaveLength(2);
      expect(findings.map((f) => f.line)).toEqual([1, 2]);
});

it('does not flag an identifier literally named "any" used as a value', () => {
      const findings = noAnyRule.check('file.ts', 'const any = 1;\nconsole.log(any);');

      expect(findings).toHaveLength(0);
});

it('returns no findings when any is not used', () => {
      const findings = noAnyRule.check('file.ts', 'const value: unknown = 1;');

      expect(findings).toHaveLength(0);
});
