import type { RuleFinding } from '../rules/rule.interface.js';

export interface ScanResult {
      scannedFiles: number;
      findings: RuleFinding[];
      durationMs: number;
      engines?: ScanEngines;
}

export interface ScanEngines {
      codesentry?: number;
      semgrep?: number;
}

export const mergeScanResults = (nativeResult: ScanResult, semgrepResult: ScanResult): ScanResult => ({
      scannedFiles: nativeResult.scannedFiles,
      findings: [...nativeResult.findings, ...semgrepResult.findings],
      durationMs: nativeResult.durationMs + semgrepResult.durationMs,
      engines: {
            codesentry: nativeResult.engines?.codesentry ?? nativeResult.scannedFiles,
            semgrep: semgrepResult.engines?.semgrep ?? semgrepResult.scannedFiles,
      },
});
