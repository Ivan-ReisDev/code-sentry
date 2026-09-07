import { afterEach, expect, it, vi } from 'vitest';
import { printConsoleReport } from '../../src/reporters/console.reporter.js';
import { DEPENDENCY_AUDIT_NOTE, ZERO_SEMGREP_COVERAGE_WARNING } from '../../src/scanner/scan-result.js';
import type { ScanResult } from '../../src/scanner/scan-result.js';

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
