import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RuleFinding, Severity } from '../rules/rule.interface.js';
import type { ScanResult } from './scan-result.js';
import { resolveBundledSemgrepRuntime, type BundledSemgrepRuntime } from './semgrep-runtime.js';
import { resolveBundledSemgrepRuleset } from './semgrep-rules.js';

const execFileAsync = promisify(execFile);

const SEMGREP_SEVERITIES: Record<string, Severity> = {
      INFO: 'low',
      WARNING: 'medium',
      ERROR: 'high',
      CRITICAL: 'critical',
};

export interface SemgrepReport {
      results: SemgrepFinding[];
      paths?: { scanned: string[] };
}

export interface SemgrepFinding {
      check_id: string;
      path: string;
      start: { line: number };
      extra: { message: string; severity: string };
}

export const parseSemgrepReport = (stdout: string): SemgrepReport => {
      try {
            const report = JSON.parse(stdout) as Partial<SemgrepReport>;
            if (!Array.isArray(report.results)) {
                  throw new Error('campo "results" ausente');
            }
            return { results: report.results, paths: report.paths };
      } catch (error) {
            const reason = error instanceof Error ? error.message : 'erro desconhecido';
            throw new Error(`Semgrep retornou JSON inválido: ${reason}`, { cause: error });
      }
};

export const mapSemgrepReportToFindings = (report: SemgrepReport): RuleFinding[] =>
      report.results.map((finding) => ({
            ruleId: `semgrep/${finding.check_id}`,
            message: finding.extra.message,
            file: finding.path,
            line: finding.start.line,
            severity: SEMGREP_SEVERITIES[finding.extra.severity] ?? 'medium',
      }));

const outputFromError = (error: unknown): string | undefined =>
      typeof (error as { stdout?: unknown }).stdout === 'string' ? (error as { stdout: string }).stdout : undefined;

export type SemgrepExecutor = (
      file: string,
      args: string[],
      options: { cwd: string; maxBuffer: number },
) => Promise<{ stdout: string }>;

export const runBundledSemgrep = async (
      targetDir: string,
      runtime: BundledSemgrepRuntime = resolveBundledSemgrepRuntime(),
      ruleset: string = resolveBundledSemgrepRuleset(),
      execute: SemgrepExecutor = execFileAsync,
): Promise<ScanResult> => {
      const startedAt = Date.now();
      const args = [
            'scan',
            '--config',
            ruleset,
            '--metrics=off',
            '--json',
            '--quiet',
            '--exclude',
            'node_modules',
            '--exclude',
            '.git',
            '--exclude',
            'dist',
            '--exclude',
            '.next',
            targetDir,
      ];
      let stdout: string;

      try {
            ({ stdout } = await execute(runtime.semgrep, args, { cwd: targetDir, maxBuffer: 20 * 1024 * 1024 }));
      } catch (error) {
            const output = outputFromError(error);
            if (!output) {
                  throw new Error('Não foi possível executar o Semgrep embutido.', { cause: error });
            }
            stdout = output;
      }

      const report = parseSemgrepReport(stdout);
      const scannedFiles = report.paths?.scanned.length ?? 0;
      return {
            scannedFiles,
            findings: mapSemgrepReportToFindings(report),
            durationMs: Date.now() - startedAt,
            engines: { semgrep: scannedFiles },
      };
};
