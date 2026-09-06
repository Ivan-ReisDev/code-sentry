import { expect, it } from 'vitest';
import { weakCipherModeRule } from '../../src/rules/weak-cipher-mode.rule.js';

it('detects createCipheriv with a CBC mode algorithm', () => {
      const findings = weakCipherModeRule.check(
            'file.js',
            "const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);",
      );

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'weak-cipher-mode',
            file: 'file.js',
            line: 1,
            severity: 'high',
      });
});

it('detects createDecipheriv with an ECB mode algorithm', () => {
      const findings = weakCipherModeRule.check(
            'file.js',
            "const decipher = crypto.createDecipheriv('aes-256-ecb', key, iv);",
      );

      expect(findings).toHaveLength(1);
});

it('does not flag createCipheriv with an AEAD mode algorithm', () => {
      const findings = weakCipherModeRule.check(
            'file.js',
            "const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);",
      );

      expect(findings).toHaveLength(0);
});

it('does not flag createCipheriv with a dynamic (non-literal) algorithm', () => {
      const findings = weakCipherModeRule.check('file.js', 'const cipher = crypto.createCipheriv(algorithm, key, iv);');

      expect(findings).toHaveLength(0);
});

it('returns no findings for unrelated code', () => {
      const findings = weakCipherModeRule.check('file.js', 'const x = 1;');

      expect(findings).toHaveLength(0);
});
