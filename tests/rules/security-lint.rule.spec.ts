import { expect, it } from 'vitest';
import { securityLintRule } from '../../src/rules/security-lint.rule.js';

it('detects generic object injection via a non-literal key', () => {
      const findings = securityLintRule.check(
            'file.js',
            'function run(obj, userInput, value) {\n  obj[userInput] = value;\n}',
      );

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]).toMatchObject({
            ruleId: 'security/detect-object-injection',
            file: 'file.js',
            severity: 'medium',
      });
});

it('detects a non-literal regular expression', () => {
      const findings = securityLintRule.check(
            'file.js',
            'function run(userInput) {\n  return new RegExp(userInput);\n}',
      );

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some((f) => f.ruleId === 'security/detect-non-literal-regexp')).toBe(true);
});

it('does not flag a write with a literal key', () => {
      const findings = securityLintRule.check('file.js', "obj['fixedKey'] = value;");

      expect(findings).toHaveLength(0);
});

it('does not flag eval (covered by the no-eval rule instead)', () => {
      const findings = securityLintRule.check('file.js', 'eval(userInput);');

      expect(findings).toHaveLength(0);
});

it('does not flag child_process.exec (covered by the command-injection rule instead)', () => {
      const findings = securityLintRule.check('file.js', 'child_process.exec(userInput);');

      expect(findings).toHaveLength(0);
});
