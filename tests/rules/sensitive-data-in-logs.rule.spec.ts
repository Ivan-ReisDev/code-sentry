import { expect, it } from 'vitest';
import { sensitiveDataInLogsRule } from '../../src/rules/sensitive-data-in-logs.rule.js';

it('detects a password logged inside an object argument', () => {
      const findings = sensitiveDataInLogsRule.check(
            'file.js',
            'logger.warn({ email, password, action: "login_attempt" }, "login attempt");',
      );

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'sensitive-data-in-logs',
            file: 'file.js',
            line: 1,
            severity: 'high',
      });
});

it('detects a password interpolated into a template literal log message', () => {
      const findings = sensitiveDataInLogsRule.check(
            'file.js',
            'console.log(`login attempt email=${email} password=${password}`);',
      );

      expect(findings).toHaveLength(1);
});

it('detects a secret logged via console.error', () => {
      const findings = sensitiveDataInLogsRule.check('file.js', 'console.error("failed", { secret });');

      expect(findings).toHaveLength(1);
});

it('does not flag a log call without sensitive data', () => {
      const findings = sensitiveDataInLogsRule.check(
            'file.js',
            'logger.warn({ email, action: "login_attempt" }, "login attempt");',
      );

      expect(findings).toHaveLength(0);
});

it('does not flag unrelated function calls', () => {
      const findings = sensitiveDataInLogsRule.check('file.js', 'doSomething({ password });');

      expect(findings).toHaveLength(0);
});

it('returns no findings for unrelated code', () => {
      const findings = sensitiveDataInLogsRule.check('file.js', 'const x = 1;');

      expect(findings).toHaveLength(0);
});
