import { expect, it } from 'vitest';
import { toJsonReport } from '../../src/reporters/json.reporter.js';
import { ZERO_SEMGREP_COVERAGE_WARNING } from '../../src/scanner/scan-result.js';

it('serializes engines.dependencyAudit and warnings from the scan result', () => {
      const json = toJsonReport({
            scannedFiles: 2,
            findings: [],
            durationMs: 10,
            engines: { codesentry: 2, semgrep: 0, dependencyAudit: false },
            warnings: [ZERO_SEMGREP_COVERAGE_WARNING],
      });

      const parsed = JSON.parse(json) as {
            engines?: { dependencyAudit?: boolean };
            warnings?: string[];
      };

      expect(parsed.engines?.dependencyAudit).toBe(false);
      expect(parsed.warnings).toContain(ZERO_SEMGREP_COVERAGE_WARNING);
});

it('serializes optional structured dependency enrichment without changing legacy fields', () => {
      const json = toJsonReport({
            scannedFiles: 1,
            durationMs: 1,
            findings: [
                  {
                        ruleId: 'dependency-audit',
                        message: 'legacy summary',
                        file: 'package-lock.json',
                        line: 1,
                        severity: 'high',
                        dependency: {
                              package: { name: 'pkg', installedVersion: '1.0.0', fixedVersions: [] },
                              advisory: { source: 'osv', id: 'GHSA-aaaa-bbbb-cccc', aliases: ['CVE-2026-12345'] },
                              nvd: [{ status: 'not-found', cveId: 'CVE-2026-12345' }],
                        },
                  },
            ],
      });
      const parsed = JSON.parse(json) as { findings: Array<{ message: string; dependency?: unknown }> };
      expect(parsed.findings[0].message).toBe('legacy summary');
      expect(parsed.findings[0].dependency).toBeDefined();
});
