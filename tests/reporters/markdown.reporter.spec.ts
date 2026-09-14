import { expect, it } from 'vitest';
import { toMarkdownReport } from '../../src/reporters/markdown.reporter.js';
import type { RuleFinding } from '../../src/rules/rule.interface.js';
import { DEPENDENCY_AUDIT_NOTE, ZERO_SEMGREP_COVERAGE_WARNING } from '../../src/scanner/scan-result.js';

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
      expect(md).toContain('| 🔴 Critical | 2 |');
      expect(md).toContain('| 🟠 High | 0 |');
      expect(md).toContain('| 🟡 Medium | 0 |');
      expect(md).toContain('| 🔵 Low | 1 |');
});

it('shows the CodeSentry logo centered at the top of the report', () => {
      const md = toMarkdownReport({ scannedFiles: 1, durationMs: 1, findings: [] }, fixedDate);

      expect(md.indexOf('<p align="center"><img src="https://raw.githubusercontent.com/')).toBe(0);
      expect(md).toContain('docs/assets/logo.png');
      expect(md.indexOf('<p align="center"')).toBeLessThan(md.indexOf('# Relatório CodeSentry'));
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

      expect(md).not.toContain('## 🔴 Critical');
      expect(md).not.toContain('## 🟠 High');
      expect(md).not.toContain('## 🟡 Medium');
      expect(md).toContain('## 🔵 Low');
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
      expect(md).toContain('| 🔴 Critical | 0 |');
      expect(md).not.toMatch(/^## [^\n]*(Critical|High|Medium|Low)/m);
});

it('includes the dependency-audit note in the header when dependencyAudit is false', () => {
      const md = toMarkdownReport(
            { scannedFiles: 2, durationMs: 1, findings: [], engines: { codesentry: 2, dependencyAudit: false } },
            fixedDate,
      );

      expect(md).toContain(DEPENDENCY_AUDIT_NOTE);
});

it('lists the dependencies checked against OSV.dev, with how many of how many', () => {
      const md = toMarkdownReport(
            {
                  scannedFiles: 1,
                  durationMs: 1,
                  findings: [],
                  engines: { dependencyAudit: 3, osv: { checked: 2, total: 3 } },
                  osvCheckedPackages: ['chalk@6.0.0', 'lodash@4.17.15'],
            },
            fixedDate,
      );

      expect(md).toContain('## Dependências verificadas no OSV.dev (2/3)');
      expect(md).toContain('<details>');
      expect(md).toContain('<summary>Ver lista completa</summary>');
      expect(md).toContain('- chalk@6.0.0');
      expect(md).toContain('- lodash@4.17.15');
});

it('omits the OSV.dev checked-dependencies section when there is nothing to list', () => {
      const md = toMarkdownReport({ scannedFiles: 1, durationMs: 1, findings: [] }, fixedDate);

      expect(md).not.toContain('Dependências verificadas no OSV.dev');
});

it('includes a warnings section when the result carries warnings', () => {
      const md = toMarkdownReport(
            {
                  scannedFiles: 2,
                  durationMs: 1,
                  findings: [],
                  engines: { codesentry: 2, semgrep: 0 },
                  warnings: [ZERO_SEMGREP_COVERAGE_WARNING],
            },
            fixedDate,
      );

      expect(md).toContain('## Avisos');
      expect(md).toContain(ZERO_SEMGREP_COVERAGE_WARNING);
});

it('renders dependency findings in a structured OSV and NVD section', () => {
      const md = toMarkdownReport(
            {
                  scannedFiles: 1,
                  durationMs: 1,
                  findings: [
                        finding({
                              ruleId: 'dependency-audit',
                              file: 'package-lock.json',
                              dependency: {
                                    package: { name: 'pkg', installedVersion: '1.0.0', fixedVersions: ['1.0.1'] },
                                    advisory: {
                                          source: 'osv',
                                          id: 'GHSA-aaaa-bbbb-cccc',
                                          aliases: ['CVE-2026-12345'],
                                          summary: 'same description',
                                    },
                                    nvd: [
                                          {
                                                status: 'found',
                                                cveId: 'CVE-2026-12345',
                                                data: {
                                                      id: 'CVE-2026-12345',
                                                      description: 'same description',
                                                      cwes: ['CWE-78'],
                                                      references: [
                                                            {
                                                                  url: 'https://example.com',
                                                                  source: 'vendor',
                                                                  tags: ['Patch'],
                                                            },
                                                      ],
                                                      cisa: {
                                                            kev: {
                                                                  addedAt: '2026-01-01',
                                                                  vulnerabilityName: 'Example vulnerability',
                                                            },
                                                            ssvc: { exploitation: 'active' },
                                                      },
                                                },
                                          },
                                    ],
                              },
                        }),
                  ],
            },
            fixedDate,
      );

      expect(md).toContain('## Dependências vulneráveis');
      expect(md).toContain('| Pacote | Severidade | Advisory | CVE(s) | CVSS | Corrigir para |');
      expect(md).toContain('| pkg@1.0.0 | 🟠 High | GHSA-aaaa-bbbb-cccc | CVE-2026-12345 | — | 1.0.1 |');
      expect(md).toContain('<details>');
      expect(md).toContain('<summary>🟠 High <strong>pkg@1.0.0</strong></summary>');
      expect(md).toContain('#### CVE-2026-12345');
      expect(md).toContain('https://example.com');
      expect(md).toContain('vendor, Patch');
      expect(md).toContain('Nome CISA');
      expect(md).toContain('CISA SSVC');
      expect(md.match(/same description/g)).toHaveLength(1);
      expect(md).not.toContain('| package-lock.json |');
});

it('shows the CVSS score in the dependency summary table when NVD found one', () => {
      const md = toMarkdownReport(
            {
                  scannedFiles: 1,
                  durationMs: 1,
                  findings: [
                        finding({
                              ruleId: 'dependency-audit',
                              file: 'package-lock.json',
                              severity: 'critical',
                              dependency: {
                                    package: { name: 'pkg', installedVersion: '1.0.0', fixedVersions: [] },
                                    advisory: { source: 'osv', id: 'GHSA-aaaa-bbbb-cccc', aliases: ['CVE-2026-12345'] },
                                    nvd: [
                                          {
                                                status: 'found',
                                                cveId: 'CVE-2026-12345',
                                                data: {
                                                      id: 'CVE-2026-12345',
                                                      cwes: [],
                                                      references: [],
                                                      cvss: {
                                                            score: 9.8,
                                                            version: '3.1',
                                                            vectorString: 'CVSS:3.1/AV:N',
                                                      },
                                                },
                                          },
                                    ],
                              },
                        }),
                  ],
            },
            fixedDate,
      );

      expect(md).toContain('| pkg@1.0.0 | 🔴 Critical | GHSA-aaaa-bbbb-cccc | CVE-2026-12345 | 9.8 | — |');
});

it('shows the ecosystem next to the package name only when it is not npm', () => {
      const md = toMarkdownReport(
            {
                  scannedFiles: 1,
                  durationMs: 1,
                  findings: [
                        finding({
                              ruleId: 'dependency-audit',
                              file: 'poetry.lock',
                              dependency: {
                                    package: {
                                          name: 'requests',
                                          installedVersion: '2.28.0',
                                          fixedVersions: [],
                                          ecosystem: 'PyPI',
                                    },
                                    advisory: { source: 'osv', id: 'GHSA-x', aliases: [] },
                              },
                        }),
                        finding({
                              ruleId: 'dependency-audit',
                              file: 'package-lock.json',
                              dependency: {
                                    package: {
                                          name: 'chalk',
                                          installedVersion: '5.3.0',
                                          fixedVersions: [],
                                          ecosystem: 'npm',
                                    },
                                    advisory: { source: 'osv', id: 'GHSA-y', aliases: [] },
                              },
                        }),
                  ],
            },
            fixedDate,
      );

      expect(md).toContain('| requests@2.28.0 (PyPI) |');
      expect(md).toContain('<summary>🟠 High <strong>requests@2.28.0 (PyPI)</strong></summary>');
      expect(md).toContain('| chalk@5.3.0 |');
      expect(md).not.toContain('chalk@5.3.0 (npm)');
});

it('includes dependency and NVD coverage in the report header', () => {
      const md = toMarkdownReport(
            {
                  scannedFiles: 1,
                  durationMs: 1,
                  findings: [],
                  engines: {
                        dependencyAudit: 3,
                        nvd: { total: 2, enriched: 1, notFound: 1, failed: 0, cacheHits: 1 },
                  },
            },
            fixedDate,
      );

      expect(md).toContain('**Dependências consideradas:** 3');
      expect(md).toContain('**Cobertura NVD:** 1/2 enriquecidos; 1 sem resultado; 0 falhas; 1 cache hits');
});
