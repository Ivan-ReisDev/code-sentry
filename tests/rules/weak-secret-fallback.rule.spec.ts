import { expect, it } from 'vitest';
import { weakSecretFallbackRule } from '../../src/rules/weak-secret-fallback.rule.js';

it('detects a hardcoded fallback for a JWT secret env var using ||', () => {
      const findings = weakSecretFallbackRule.check(
            'file.js',
            'const JWT_SECRET = process.env.JWT_SECRET || "secret";',
      );

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'weak-secret-fallback',
            file: 'file.js',
            line: 1,
            severity: 'critical',
      });
});

it('detects a hardcoded fallback for an encryption key env var using ??', () => {
      const findings = weakSecretFallbackRule.check(
            'file.js',
            'const SHARE_KEY = Buffer.from(process.env.SHARE_ENCRYPTION_KEY ?? "a1b2c3d4e5f6", "hex");',
      );

      expect(findings).toHaveLength(1);
});

it('does not flag a fallback for an env var unrelated to secrets', () => {
      const findings = weakSecretFallbackRule.check('file.js', 'const PORT = process.env.PORT || "3000";');

      expect(findings).toHaveLength(0);
});

it('does not flag a secret env var without a hardcoded string fallback', () => {
      const findings = weakSecretFallbackRule.check(
            'file.js',
            'const JWT_SECRET = process.env.JWT_SECRET || generateRandomSecret();',
      );

      expect(findings).toHaveLength(0);
});

it('does not flag an empty string fallback', () => {
      const findings = weakSecretFallbackRule.check('file.js', 'const JWT_SECRET = process.env.JWT_SECRET || "";');

      expect(findings).toHaveLength(0);
});

it('returns no findings when there is no fallback pattern', () => {
      const findings = weakSecretFallbackRule.check('file.js', 'const x = 1;');

      expect(findings).toHaveLength(0);
});
