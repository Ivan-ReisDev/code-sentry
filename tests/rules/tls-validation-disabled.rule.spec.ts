import { expect, it } from 'vitest';
import { tlsValidationDisabledRule } from '../../src/rules/tls-validation-disabled.rule.js';

it('detects rejectUnauthorized: false in an object literal', () => {
      const findings = tlsValidationDisabledRule.check('file.js', 'https.request({ rejectUnauthorized: false }, cb);');

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'tls-validation-disabled',
            file: 'file.js',
            line: 1,
            severity: 'critical',
      });
});

it('detects rejectUnauthorized: false nested inside another object', () => {
      const content = 'axios.get(url, { httpsAgent: new https.Agent({ rejectUnauthorized: false }) });';

      expect(tlsValidationDisabledRule.check('file.js', content)).toHaveLength(1);
});

it('does not flag rejectUnauthorized: true', () => {
      const findings = tlsValidationDisabledRule.check('file.js', 'https.request({ rejectUnauthorized: true }, cb);');

      expect(findings).toHaveLength(0);
});

it('detects setting NODE_TLS_REJECT_UNAUTHORIZED to "0"', () => {
      const findings = tlsValidationDisabledRule.check('file.js', "process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';");

      expect(findings).toHaveLength(1);
});

it('does not flag setting NODE_TLS_REJECT_UNAUTHORIZED to "1"', () => {
      const findings = tlsValidationDisabledRule.check('file.js', "process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';");

      expect(findings).toHaveLength(0);
});

it('returns no findings when TLS validation is not touched', () => {
      const findings = tlsValidationDisabledRule.check('file.js', 'const x = 1;');

      expect(findings).toHaveLength(0);
});
