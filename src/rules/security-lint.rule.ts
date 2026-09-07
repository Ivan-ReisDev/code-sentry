// @ts-expect-error -- sem types publicados; ver docs/adr/0002-security-tooling.md
import securityPlugin from 'eslint-plugin-security';
import { runEslintRules } from './lib/eslint-linter.js';
import type { Rule, RuleFinding } from './rule.interface.js';

const RULES = {
      'security/detect-object-injection': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-new-buffer': 'error',
} as const;

const PLUGINS = { security: securityPlugin };

const suppressionMarker = (ruleId: string): string => `codesentry-disable-next-line ${ruleId}`;

const isSuppressed = (contentLines: string[], finding: { ruleId: string; line: number }): boolean =>
      contentLines.at(finding.line - 2)?.includes(suppressionMarker(finding.ruleId)) ?? false;

export const securityLintRule: Rule = {
      id: 'security-lint',
      description:
            'Detecta padrões de segurança genéricos (object injection, regex não literal, fs não literal, etc.) via eslint-plugin-security',
      check(filePath: string, content: string): RuleFinding[] {
            const contentLines = content.split('\n');
            return runEslintRules(filePath, content, RULES, PLUGINS)
                  .filter((finding) => !isSuppressed(contentLines, finding))
                  .map((finding) => ({
                        ruleId: finding.ruleId,
                        message: `Padrão inseguro detectado (${finding.ruleId}): ${finding.message}`,
                        file: filePath,
                        line: finding.line,
                        severity: 'medium',
                  }));
      },
};
