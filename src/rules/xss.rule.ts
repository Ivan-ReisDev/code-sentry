// @ts-expect-error -- sem types publicados; ver docs/adr/0002-security-tooling.md
import noUnsanitizedPlugin from 'eslint-plugin-no-unsanitized';
import { runEslintRules } from './lib/eslint-linter.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const RULES = {
  'no-unsanitized/property': 'error',
  'no-unsanitized/method': 'error',
} as const;

const PLUGINS = { 'no-unsanitized': noUnsanitizedPlugin };

export const xssRule: Rule = {
  id: 'xss',
  description: 'Detecta sinks perigosos de XSS (innerHTML, document.write, etc.)',
  check(filePath: string, content: string): RuleFinding[] {
    return runEslintRules(filePath, content, RULES, PLUGINS).map((finding) => ({
      ruleId: finding.ruleId,
      message: `Possível XSS: ${finding.message}`,
      file: filePath,
      line: finding.line,
      severity: 'high',
    }));
  },
};
