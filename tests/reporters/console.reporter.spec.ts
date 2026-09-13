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

it('prints how many packages npm audit checked on a clean report', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result: ScanResult = {
            scannedFiles: 100,
            findings: [],
            durationMs: 10,
            engines: { codesentry: 100, semgrep: 0, dependencyAudit: 363 },
      };
      printConsoleReport(result);

      expect(logSpy.mock.calls.flat().join('\n')).toContain('Dependency audit: 363 pacote(s) via npm audit');
});

it('prints how many packages npm audit checked on a report with findings', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result: ScanResult = {
            scannedFiles: 1,
            durationMs: 5,
            engines: { codesentry: 1, semgrep: 0, dependencyAudit: 12 },
            findings: [{ ruleId: 'no-eval', message: 'msg', file: 'a.ts', line: 1, severity: 'high' }],
      };
      printConsoleReport(result);

      expect(logSpy.mock.calls.flat().join('\n')).toContain('Dependency audit: 12 pacote(s) via npm audit');
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
