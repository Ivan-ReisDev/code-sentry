import { expect, it } from 'vitest';
import { jwtDecodeWithoutVerifyRule } from '../../src/rules/jwt-decode-without-verify.rule.js';

it('detects manual JWT payload decoding via atob without any signature verification', () => {
  const content = [
    'function decodeJWT(token) {',
    '  const parts = token.split(".");',
    '  const payload = JSON.parse(atob(parts[1]));',
    '  return payload;',
    '}',
  ].join('\n');

  const findings = jwtDecodeWithoutVerifyRule.check('file.js', content);

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'jwt-decode-without-verify',
    file: 'file.js',
    severity: 'critical',
  });
});

it('detects manual JWT payload decoding via Buffer.from(..., "base64") without verification', () => {
  const content = [
    'function decodeJWT(token) {',
    '  const parts = token.split(".");',
    '  const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());',
    '  return payload;',
    '}',
  ].join('\n');

  const findings = jwtDecodeWithoutVerifyRule.check('file.js', content);

  expect(findings).toHaveLength(1);
});

it('does not flag decoding when the file also verifies the signature', () => {
  const content = [
    'function decodeJWT(token, secret) {',
    '  const parts = token.split(".");',
    '  const payload = JSON.parse(atob(parts[1]));',
    '  const expectedSig = crypto.createHmac("sha256", secret).update(parts[0] + "." + parts[1]).digest("base64url");',
    '  if (!crypto.verify) { }',
    '  jwt.verify(token, secret);',
    '  return payload;',
    '}',
  ].join('\n');

  const findings = jwtDecodeWithoutVerifyRule.check('file.js', content);

  expect(findings).toHaveLength(0);
});

it('does not flag base64 decoding unrelated to JSON parsing', () => {
  const findings = jwtDecodeWithoutVerifyRule.check(
    'file.js',
    'const decoded = atob(someBase64String);',
  );

  expect(findings).toHaveLength(0);
});

it('returns no findings for unrelated code', () => {
  const findings = jwtDecodeWithoutVerifyRule.check('file.js', 'const x = 1;');

  expect(findings).toHaveLength(0);
});
