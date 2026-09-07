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
