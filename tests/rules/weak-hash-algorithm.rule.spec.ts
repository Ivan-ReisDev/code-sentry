import { expect, it } from 'vitest';
import { weakHashAlgorithmRule } from '../../src/rules/weak-hash-algorithm.rule.js';

it('detects createHash("md5")', () => {
      const findings = weakHashAlgorithmRule.check('file.js', "crypto.createHash('md5').update(data).digest('hex');");

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'weak-hash-algorithm',
            file: 'file.js',
            line: 1,
            severity: 'medium',
      });
});

it('detects createHash("sha1")', () => {
      const findings = weakHashAlgorithmRule.check('file.js', "crypto.createHash('sha1');");

      expect(findings).toHaveLength(1);
});

it('is case-insensitive on the algorithm name', () => {
      const findings = weakHashAlgorithmRule.check('file.js', "crypto.createHash('MD5');");

      expect(findings).toHaveLength(1);
});

it('does not flag a strong hash algorithm', () => {
      const findings = weakHashAlgorithmRule.check('file.js', "crypto.createHash('sha256');");

      expect(findings).toHaveLength(0);
});

it('does not flag createHash with a dynamic (non-literal) algorithm', () => {
      const findings = weakHashAlgorithmRule.check('file.js', 'crypto.createHash(algorithm);');

      expect(findings).toHaveLength(0);
});

it('returns no findings when createHash is not used', () => {
      const findings = weakHashAlgorithmRule.check('file.js', 'const x = 1;');

      expect(findings).toHaveLength(0);
});
