import { expect, it } from 'vitest';
import { expressMissingBodyLimitRule } from '../../src/rules/express-missing-body-limit.rule.js';

it('detects express.json() called without a limit option', () => {
      const findings = expressMissingBodyLimitRule.check('file.js', 'app.use(express.json());');

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
            ruleId: 'express-missing-body-limit',
            file: 'file.js',
            line: 1,
            severity: 'low',
      });
});

it('does not flag express.json() with a limit option', () => {
      const findings = expressMissingBodyLimitRule.check('file.js', "app.use(express.json({ limit: '100kb' }));");

      expect(findings).toHaveLength(0);
});

it('detects bodyParser.urlencoded() without a limit option', () => {
      const findings = expressMissingBodyLimitRule.check(
            'file.js',
            'app.use(bodyParser.urlencoded({ extended: true }));',
      );

      expect(findings).toHaveLength(1);
});

it('does not flag bodyParser.urlencoded() with a limit option', () => {
      const findings = expressMissingBodyLimitRule.check(
            'file.js',
            "app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));",
      );

      expect(findings).toHaveLength(0);
});

it('does not flag unrelated express methods', () => {
      const findings = expressMissingBodyLimitRule.check('file.js', "app.use(express.static('public'));");

      expect(findings).toHaveLength(0);
});
