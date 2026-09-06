import { expect, it } from 'vitest';
import { publicEnvVarSecretRule } from '../../src/rules/public-env-var-secret.rule.js';

it('detects a secret-named NEXT_PUBLIC_ env var', () => {
  const findings = publicEnvVarSecretRule.check(
    'file.ts',
    'const paymentSecret = process.env.NEXT_PUBLIC_PAYMENT_SECRET ?? "";',
  );

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'public-env-var-secret',
    file: 'file.ts',
    line: 1,
    severity: 'high',
  });
});

it('detects a secret-named VITE_ env var', () => {
  const findings = publicEnvVarSecretRule.check(
    'file.ts',
    'const apiKey = import.meta.env.VITE_API_KEY;',
  );

  expect(findings).toHaveLength(1);
});

it('detects a secret-named REACT_APP_ env var', () => {
  const findings = publicEnvVarSecretRule.check(
    'file.ts',
    'const token = process.env.REACT_APP_AUTH_TOKEN;',
  );

  expect(findings).toHaveLength(1);
});

it('does not flag a public env var without a sensitive name', () => {
  const findings = publicEnvVarSecretRule.check(
    'file.ts',
    'const apiUrl = process.env.NEXT_PUBLIC_API_URL;',
  );

  expect(findings).toHaveLength(0);
});

it('does not flag a server-only (non-public) secret env var', () => {
  const findings = publicEnvVarSecretRule.check('file.ts', 'const secret = process.env.JWT_SECRET;');

  expect(findings).toHaveLength(0);
});

it('returns no findings for unrelated code', () => {
  const findings = publicEnvVarSecretRule.check('file.ts', 'const x = 1;');

  expect(findings).toHaveLength(0);
});
