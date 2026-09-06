import { expect, it } from 'vitest';
import { mergeScanResults } from '../../src/scanner/scan-result.js';

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
