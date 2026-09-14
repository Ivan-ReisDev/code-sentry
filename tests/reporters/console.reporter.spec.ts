import { afterEach, expect, it, vi } from 'vitest';
import { printConsoleReport } from '../../src/reporters/console.reporter.js';
import {
      DEPENDENCY_AUDIT_NOTE,
      ZERO_SEMGREP_COVERAGE_WARNING,
      type ScanResult,
} from '../../src/scanner/scan-result.js';

afterEach(() => {
      vi.restoreAllMocks();
});

it('prints the dependency-audit note on a clean report when dependencyAudit is false', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result: ScanResult = {
            scannedFiles: 2,
            findings: [],
            durationMs: 10,
            engines: { codesentry: 2, dependencyAudit: false },
      };
      printConsoleReport(result);

      expect(logSpy.mock.calls.flat().join('\n')).toContain(DEPENDENCY_AUDIT_NOTE);
});

it('prints the dependency-audit note on a report with findings', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result: ScanResult = {
            scannedFiles: 1,
            durationMs: 5,
            engines: { codesentry: 1, dependencyAudit: false },
            findings: [{ ruleId: 'no-eval', message: 'msg', file: 'a.ts', line: 1, severity: 'high' }],
      };
      printConsoleReport(result);

      expect(logSpy.mock.calls.flat().join('\n')).toContain(DEPENDENCY_AUDIT_NOTE);
});

it('prints how many dependency packages were considered on a clean report', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result: ScanResult = {
            scannedFiles: 100,
            findings: [],
            durationMs: 10,
            engines: { codesentry: 100, semgrep: 0, dependencyAudit: 363 },
      };
      printConsoleReport(result);

      expect(logSpy.mock.calls.flat().join('\n')).toContain('Dependency audit: 363 pacote(s) considerado(s)');
});

it('prints how many dependency packages were considered on a report with findings', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result: ScanResult = {
            scannedFiles: 1,
            durationMs: 5,
            engines: { codesentry: 1, semgrep: 0, dependencyAudit: 12 },
            findings: [{ ruleId: 'no-eval', message: 'msg', file: 'a.ts', line: 1, severity: 'high' }],
      };
      printConsoleReport(result);

      expect(logSpy.mock.calls.flat().join('\n')).toContain('Dependency audit: 12 pacote(s) considerado(s)');
});

it('does not mention dependency audit coverage when it was skipped or failed', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result: ScanResult = {
            scannedFiles: 2,
            findings: [],
            durationMs: 10,
            engines: { codesentry: 2, semgrep: 0, dependencyAudit: false },
      };
      printConsoleReport(result);

      expect(logSpy.mock.calls.flat().join('\n')).not.toContain('Dependency audit:');
});

it('prints how many of the locked packages OSV.dev actually verified', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result: ScanResult = {
            scannedFiles: 100,
            findings: [],
            durationMs: 10,
            engines: { codesentry: 100, semgrep: 0, dependencyAudit: 363, osv: { checked: 360, total: 363 } },
      };
      printConsoleReport(result);

      expect(logSpy.mock.calls.flat().join('\n')).toContain('OSV.dev: 360/363 verificados');
});

it('does not mention OSV.dev coverage when the dependency audit never reached it', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result: ScanResult = {
            scannedFiles: 2,
            findings: [],
            durationMs: 10,
            engines: { codesentry: 2, semgrep: 0, dependencyAudit: false },
      };
      printConsoleReport(result);

      expect(logSpy.mock.calls.flat().join('\n')).not.toContain('OSV.dev:');
});

it('prints the zero-semgrep-coverage warning when present', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result: ScanResult = {
            scannedFiles: 2,
            findings: [],
            durationMs: 10,
            engines: { codesentry: 2, semgrep: 0 },
            warnings: [ZERO_SEMGREP_COVERAGE_WARNING],
      };
      printConsoleReport(result);

      expect(logSpy.mock.calls.flat().join('\n')).toContain(ZERO_SEMGREP_COVERAGE_WARNING);
});

it('prints structured OSV and NVD dependency details without dropping the OSV finding', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result: ScanResult = {
            scannedFiles: 1,
            durationMs: 10,
            engines: {
                  dependencyAudit: 1,
                  nvd: { total: 1, enriched: 1, notFound: 0, failed: 0, cacheHits: 0 },
            },
            findings: [
                  {
                        ruleId: 'dependency-audit',
                        message: 'summary',
                        file: 'package-lock.json',
                        line: 1,
                        severity: 'critical',
                        dependency: {
                              package: { name: 'example', installedVersion: '1.0.0', fixedVersions: ['1.0.2'] },
                              advisory: {
                                    source: 'osv',
                                    id: 'GHSA-aaaa-bbbb-cccc',
                                    aliases: ['CVE-2026-12345'],
                                    summary: 'OSV summary',
                              },
                              nvd: [
                                    {
                                          status: 'found',
                                          cveId: 'CVE-2026-12345',
                                          data: {
                                                id: 'CVE-2026-12345',
                                                cvss: {
                                                      version: '3.1',
                                                      score: 9.8,
                                                      severity: 'CRITICAL',
                                                      vectorString: 'CVSS:3.1/example',
                                                      attackVector: 'NETWORK',
                                                },
                                                cwes: ['CWE-78'],
                                                references: [],
                                                cisa: {
                                                      kev: {
                                                            addedAt: '2026-01-01',
                                                            vulnerabilityName: 'Example vulnerability',
                                                      },
                                                      ssvc: { exploitation: 'active', technicalImpact: 'total' },
                                                },
                                          },
                                    },
                              ],
                        },
                  },
            ],
      };

      printConsoleReport(result);
      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Pacote: example');
      expect(output).toContain('CVE-2026-12345');
      expect(output).toContain('CVSS: 9.8');
      expect(output).toContain('CWE: CWE-78');
      expect(output).toContain('Nome CISA: Example vulnerability');
      expect(output).toContain('CISA SSVC: exploração=active; impacto técnico=total');
      expect(output).toContain('Fontes: OSV, NVD');
      expect(output).toContain('NVD: 1 CVE(s)');
});

it('shows the ecosystem next to the package name only when it is not npm', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const baseFinding = {
            ruleId: 'dependency-audit',
            message: 'summary',
            file: 'poetry.lock',
            line: 1,
            severity: 'medium' as const,
      };
      const result: ScanResult = {
            scannedFiles: 1,
            durationMs: 1,
            findings: [
                  {
                        ...baseFinding,
                        dependency: {
                              package: {
                                    name: 'requests',
                                    installedVersion: '2.28.0',
                                    fixedVersions: [],
                                    ecosystem: 'PyPI',
                              },
                              advisory: { source: 'osv', id: 'GHSA-x', aliases: [] },
                        },
                  },
                  {
                        ...baseFinding,
                        dependency: {
                              package: {
                                    name: 'chalk',
                                    installedVersion: '5.3.0',
                                    fixedVersions: [],
                                    ecosystem: 'npm',
                              },
                              advisory: { source: 'osv', id: 'GHSA-y', aliases: [] },
                        },
                  },
            ],
      };

      printConsoleReport(result);
      const output = logSpy.mock.calls.flat().join('\n');

      expect(output).toContain('Pacote: requests (PyPI)');
      expect(output).toContain('Pacote: chalk');
      expect(output).not.toContain('Pacote: chalk (npm)');
});

it('distinguishes NVD not-found from an NVD consultation error', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const dependency = {
            package: { name: 'example', installedVersion: '1.0.0', fixedVersions: [] },
            advisory: { source: 'osv' as const, id: 'GHSA-aaaa-bbbb-cccc', aliases: [] },
            nvd: [
                  { status: 'not-found' as const, cveId: 'CVE-2026-10001' },
                  { status: 'error' as const, cveId: 'CVE-2026-10002', error: { kind: 'timeout' as const } },
            ],
      };
      printConsoleReport({
            scannedFiles: 1,
            durationMs: 1,
            findings: [
                  {
                        ruleId: 'dependency-audit',
                        message: 'x',
                        file: 'package-lock.json',
                        line: 1,
                        severity: 'medium',
                        dependency,
                  },
            ],
      });

      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('NVD: sem resultado');
      expect(output).toContain('NVD: falha ao consultar (timeout)');
});
