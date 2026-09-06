import { expect, it } from 'vitest';
import { toMarkdownReport } from '../../src/reporters/markdown.reporter.js';
import type { RuleFinding } from '../../src/rules/rule.interface.js';

const finding = (overrides: Partial<RuleFinding> = {}): RuleFinding => ({
      ruleId: 'no-eval',
      message: 'msg',
      file: 'a.ts',
      line: 1,
      severity: 'high',
      ...overrides,
});

const fixedDate = new Date('2026-09-06T10:00:00.000Z');

it('includes header info and summary counts per severity', () => {
      const md = toMarkdownReport(
            {
                  scannedFiles: 5,
                  durationMs: 100,
                  findings: [
                        finding({ severity: 'critical' }),
                        finding({ severity: 'critical' }),
                        finding({ severity: 'low' }),
                  ],
            },
            fixedDate,
      );

      expect(md).toContain('# Relatório CodeSentry');
      expect(md).toContain('**Gerado em:** 2026-09-06T10:00:00.000Z');
      expect(md).toContain('**Arquivos analisados:** 5');
      expect(md).toContain('**Duração:** 100ms');
      expect(md).toContain('**Total de problemas:** 3');
      expect(md).toContain('| Critical | 2 |');
      expect(md).toContain('| High | 0 |');
      expect(md).toContain('| Medium | 0 |');
      expect(md).toContain('| Low | 1 |');
});

it('groups findings by severity then by rule, sorted alphabetically', () => {
      const md = toMarkdownReport(
            {
                  scannedFiles: 2,
                  durationMs: 1,
                  findings: [
                        finding({ ruleId: 'xss', severity: 'high', file: 'b.ts', line: 5 }),
                        finding({ ruleId: 'no-eval', severity: 'high', file: 'a.ts', line: 2 }),
                  ],
            },
            fixedDate,
      );

      const noEvalIndex = md.indexOf('### no-eval');
      const xssIndex = md.indexOf('### xss');
      expect(noEvalIndex).toBeGreaterThan(-1);
      expect(xssIndex).toBeGreaterThan(-1);
      expect(noEvalIndex).toBeLessThan(xssIndex);
});

it('sorts findings of the same rule by file then by line', () => {
      const md = toMarkdownReport(
            {
                  scannedFiles: 2,
                  durationMs: 1,
                  findings: [
                        finding({ file: 'b.ts', line: 1, message: 'second' }),
                        finding({ file: 'a.ts', line: 2, message: 'third' }),
                        finding({ file: 'a.ts', line: 1, message: 'first' }),
                  ],
            },
            fixedDate,
      );

      const firstIndex = md.indexOf('first');
      const secondIndex = md.indexOf('second');
      const thirdIndex = md.indexOf('third');
      expect(firstIndex).toBeLessThan(thirdIndex);
      expect(thirdIndex).toBeLessThan(secondIndex);
});

it('omits severity sections with no findings', () => {
      const md = toMarkdownReport(
            { scannedFiles: 1, durationMs: 1, findings: [finding({ severity: 'low' })] },
            fixedDate,
      );

      expect(md).not.toContain('## Critical');
      expect(md).not.toContain('## High');
      expect(md).not.toContain('## Medium');
      expect(md).toContain('## Low');
});

it('escapes pipe characters inside table cells', () => {
      const md = toMarkdownReport(
            {
                  scannedFiles: 1,
                  durationMs: 1,
                  findings: [finding({ message: 'a | b', file: 'x | y.ts' })],
            },
            fixedDate,
      );

      expect(md).toContain('a \\| b');
      expect(md).toContain('x \\| y.ts');
});

it('returns a report with all-zero summary and no severity sections when there are no findings', () => {
      const md = toMarkdownReport({ scannedFiles: 3, durationMs: 1, findings: [] }, fixedDate);

      expect(md).toContain('**Total de problemas:** 0');
      expect(md).toContain('| Critical | 0 |');
      expect(md).not.toMatch(/^## (Critical|High|Medium|Low)/m);
});
