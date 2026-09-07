import type { RuleFinding } from '../rules/rule.interface.js';

export interface ScanResult {
      scannedFiles: number;
      findings: RuleFinding[];
      durationMs: number;
      engines?: ScanEngines;
      warnings?: string[];
}

export interface ScanEngines {
      codesentry?: number;
      semgrep?: number;
      dependencyAudit?: false;
}

export const DEPENDENCY_AUDIT_NOTE =
      'Dependency audit não foi incluído neste scan — rode "codesentry dependency-audit" separadamente.';

export const ZERO_SEMGREP_COVERAGE_WARNING =
      'Semgrep não analisou nenhum arquivo nesta execução — verifique se o ruleset offline está instalado/preparado.';

export const mergeScanResults = (nativeResult: ScanResult, semgrepResult: ScanResult): ScanResult => ({
      scannedFiles: nativeResult.scannedFiles,
      findings: [...nativeResult.findings, ...semgrepResult.findings],
      durationMs: nativeResult.durationMs + semgrepResult.durationMs,
      engines: {
            codesentry: nativeResult.engines?.codesentry ?? nativeResult.scannedFiles,
            semgrep: semgrepResult.engines?.semgrep ?? semgrepResult.scannedFiles,
      },
});

export const finalizeScanResult = (result: ScanResult): ScanResult => ({
      ...result,
      engines: { ...result.engines, dependencyAudit: false },
      warnings:
            result.engines?.semgrep === 0
                  ? [...(result.warnings ?? []), ZERO_SEMGREP_COVERAGE_WARNING]
                  : result.warnings,
});
