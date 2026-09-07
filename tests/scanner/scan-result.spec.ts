import { expect, it } from 'vitest';
import {
      finalizeScanResult,
      mergeScanResults,
      ZERO_SEMGREP_COVERAGE_WARNING,
} from '../../src/scanner/scan-result.js';

it('keeps native file counting while exposing Semgrep coverage separately', () => {
      const result = mergeScanResults(
            { scannedFiles: 2, findings: [], durationMs: 10 },
            {
                  scannedFiles: 4,
                  findings: [
                        {
                              ruleId: 'semgrep/example',
                              message: 'example',
                              file: 'api/server.py',
                              line: 1,
                              severity: 'high',
                        },
                  ],
                  durationMs: 20,
            },
      );

      expect(result.scannedFiles).toBe(2);
      expect(result.durationMs).toBe(30);
      expect(result.findings).toHaveLength(1);
      expect(result.engines).toEqual({ codesentry: 2, semgrep: 4 });
});

it('marks dependencyAudit as not run while keeping existing engine counts', () => {
      const result = finalizeScanResult({
            scannedFiles: 2,
            findings: [],
            durationMs: 10,
            engines: { codesentry: 2, semgrep: 4 },
      });

      expect(result.engines).toEqual({ codesentry: 2, semgrep: 4, dependencyAudit: false });
});

it('warns when semgrep ran but scanned zero files', () => {
      const result = finalizeScanResult({
            scannedFiles: 2,
            findings: [],
            durationMs: 10,
            engines: { codesentry: 2, semgrep: 0 },
      });

      expect(result.warnings).toContain(ZERO_SEMGREP_COVERAGE_WARNING);
});

it('does not warn when semgrep was not run at all', () => {
      const result = finalizeScanResult({ scannedFiles: 2, findings: [], durationMs: 10 });

      expect(result.warnings ?? []).not.toContain(ZERO_SEMGREP_COVERAGE_WARNING);
});
