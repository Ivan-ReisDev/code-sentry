import { expect, it } from 'vitest';
import { jwtNoExpirationRule } from '../../src/rules/jwt-no-expiration.rule.js';

it('detects jwt.sign() without an expiration', () => {
      const findings = jwtNoExpirationRule.check('file.js', 'jwt.sign({ user: id }, secret);');

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'jwt-no-expiration',
            file: 'file.js',
            line: 1,
            severity: 'medium',
      });
});

it('does not flag jwt.sign() with expiresIn in the options', () => {
      const findings = jwtNoExpirationRule.check('file.js', "jwt.sign({ user: id }, secret, { expiresIn: '1h' });");

      expect(findings).toHaveLength(0);
});

it('does not flag jwt.sign() when the payload already sets exp', () => {
      const findings = jwtNoExpirationRule.check('file.js', 'jwt.sign({ user: id, exp: someExp }, secret);');

      expect(findings).toHaveLength(0);
});

it('does not flag .sign() calls on an object that is not named jwt', () => {
      const findings = jwtNoExpirationRule.check('file.js', 'otherObj.sign(data, key);');

      expect(findings).toHaveLength(0);
});

it('returns no findings when jwt.sign is not used', () => {
      const findings = jwtNoExpirationRule.check('file.js', 'const x = 1;');

      expect(findings).toHaveLength(0);
});
