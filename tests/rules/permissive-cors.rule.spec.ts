import { expect, it } from 'vitest';
import { permissiveCorsRule } from '../../src/rules/permissive-cors.rule.js';

it('detects cors() called with no arguments', () => {
  const findings = permissiveCorsRule.check('file.js', 'app.use(cors());');

  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    ruleId: 'permissive-cors',
    file: 'file.js',
    line: 1,
    severity: 'medium',
  });
});

it('detects cors({ origin: "*" })', () => {
  const findings = permissiveCorsRule.check('file.js', "app.use(cors({ origin: '*' }));");

  expect(findings).toHaveLength(1);
});

it('does not flag cors() with a specific origin', () => {
  const findings = permissiveCorsRule.check(
    'file.js',
    "app.use(cors({ origin: 'https://example.com' }));",
  );

  expect(findings).toHaveLength(0);
});

it('detects setting the Access-Control-Allow-Origin header to "*"', () => {
  const findings = permissiveCorsRule.check(
    'file.js',
    "res.setHeader('Access-Control-Allow-Origin', '*');",
  );

  expect(findings).toHaveLength(1);
});

it('does not flag setting the Access-Control-Allow-Origin header to a specific origin', () => {
  const findings = permissiveCorsRule.check(
    'file.js',
    "res.setHeader('Access-Control-Allow-Origin', 'https://example.com');",
  );

  expect(findings).toHaveLength(0);
});

it('returns no findings when CORS is not configured', () => {
  const findings = permissiveCorsRule.check('file.js', 'const x = 1;');

  expect(findings).toHaveLength(0);
});
