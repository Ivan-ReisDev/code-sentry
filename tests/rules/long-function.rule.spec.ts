import { expect, it } from 'vitest';
import { longFunctionRule } from '../../src/rules/long-function.rule.js';

const bodyWithLines = (count: number): string => {
      return Array.from({ length: count }, (_, i) => `  const line${i} = ${i};`).join('\n');
};

it('detects a function declaration with more than 30 lines', () => {
      const content = `function longFn() {\n${bodyWithLines(29)}\n}`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('low');
      expect(findings[0].ruleId).toBe('long-function');
      expect(findings[0].line).toBe(1);
      expect(findings[0].message).toContain('"longFn"');
});

it('does not report a function with exactly 30 lines', () => {
      const content = `function exactFn() {\n${bodyWithLines(28)}\n}`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(0);
});

it('does not report a short function', () => {
      const findings = longFunctionRule.check('file.ts', 'function shortFn() {\n  return 1;\n}');

      expect(findings).toHaveLength(0);
});

it('detects an arrow function with a block body over 30 lines', () => {
      const content = `const longArrow = () => {\n${bodyWithLines(29)}\n};`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(1);
      expect(findings[0].message).toContain('"longArrow"');
});

it('detects a function declaration with a TS return type annotation and no arrow', () => {
      const content = `function findLines(content: string): number[] {\n${bodyWithLines(29)}\n}`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('"findLines"');
      expect(findings[0].line).toBe(1);
});

it('does not misreport a TS interface with multiple method signatures as one giant function', () => {
      const content = [
            'interface Thing {',
            '  foo(): void;',
            '  bar(): void;',
            '}',
            '',
            'function realLongFn() {',
            bodyWithLines(29),
            '}',
      ].join('\n');

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('"realLongFn"');
});

it('keeps the real name for an async method, instead of capturing "async"', () => {
      const content = `class Service {\n  async doWork() {\n${bodyWithLines(29)}\n  }\n}`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('"doWork"');
});

it('keeps the real name for a getter, instead of capturing "get"', () => {
      const content = `class Service {\n  get value() {\n${bodyWithLines(29)}\n  }\n}`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('"value"');
});

it('keeps the real name for a setter, instead of capturing "set"', () => {
      const content = `class Service {\n  set value(v) {\n${bodyWithLines(29)}\n  }\n}`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('"value"');
});

it('keeps the real name through multiple TS member modifiers stacked together', () => {
      const content = `class Service {\n  private static async doWork() {\n${bodyWithLines(29)}\n  }\n}`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('"doWork"');
});

it('keeps the variable name for an arrow function with a TS return type annotation', () => {
      const content = `const scanCode = (flag: boolean): void => {\n${bodyWithLines(29)}\n};`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('"scanCode"');
});

it('does not report an expression-bodied arrow function, however long the line', () => {
      const longExpression = Array.from({ length: 40 }, (_, i) => `term${i}`).join(' + ');
      const content = `const total = () => ${longExpression};`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(0);
});

it('detects a class method with more than 30 lines', () => {
      const content = `class Service {\n  run() {\n${bodyWithLines(29)}\n  }\n}`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(2);
      expect(findings[0].message).toContain('"run"');
});

it('falls back to "anônima" when the function has no identifiable name', () => {
      const content = `useCallback(() => {\n${bodyWithLines(29)}\n});`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('anônima');
});

it('keeps the outer function name even when a default parameter has its own arrow function', () => {
      const content = `function outer(cb = () => {}) {\n${bodyWithLines(29)}\n}`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('"outer"');
});

it('does not report a long if-block that is not inside a function', () => {
      const content = `if (condition) {\n${bodyWithLines(29)}\n}`;

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(0);
});

it('reports only the function that exceeds the limit when there are two', () => {
      const content = [
            'function shortFn() {',
            '  return 1;',
            '}',
            '',
            `function longFn() {`,
            bodyWithLines(29),
            '}',
      ].join('\n');

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(5);
});

it('evaluates a nested function independently from its long outer function', () => {
      const content = [
            'function outer() {',
            '  function inner() {',
            '    return 1;',
            '  }',
            bodyWithLines(27),
            '}',
      ].join('\n');

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(1);
});

it('ignores braces inside strings, comments and template literals', () => {
      const content = [
            'function longFn() {',
            '  const s = "{ not a real brace }";',
            '  // { another fake brace }',
            '  const t = `{ template fake brace }`;',
            bodyWithLines(26),
            '}',
      ].join('\n');

      const findings = longFunctionRule.check('file.ts', content);

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(1);
});
