import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { Listr } from 'listr2';
import { formatErrorChain } from '../../errors.js';
import { printConsoleReport } from '../../reporters/console.reporter.js';
import { toJsonReport } from '../../reporters/json.reporter.js';
import { toMarkdownReport } from '../../reporters/markdown.reporter.js';
import type { Rule } from '../../rules/rule.interface.js';
import { runDependencyAudit } from '../../scanner/dependency-audit.js';
import { finalizeScanResult, mergeScanResults, type ScanResult } from '../../scanner/scan-result.js';
import { runScan } from '../../scanner/scanner.js';
import { runBundledSemgrep } from '../../scanner/semgrep.js';
import { generateMarkdownReportFilename, MARKDOWN_REPORT_FINDINGS_THRESHOLD } from './report-filename.js';

export interface ScanOutputOptions {
      json?: boolean;
      concurrency?: number;
      config?: string;
      tests?: boolean;
      /** Internal: scan command always enables the bundled Semgrep engine. */
      semgrep?: boolean;
      /**
       * Internal: opt-in only, like `semgrep` above — NOT "on unless false".
       * `scanAndReport`/`runScanEngines` are reused by ~30 individual per-rule
       * commands (weak-hash-algorithm, jwt-no-expiration, command-injection, ...),
       * none of which should start running "npm audit"/OSV.dev. Only the `scan`
       * command sets this, via its `--no-deps` flag (Commander defaults it to
       * `true` there, `false` when `--no-deps` is passed).
       */
      deps?: boolean;
      /** Internal: enabled by the scan/dependency-audit commands unless --no-nvd is passed. */
      nvd?: boolean;
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'erro desconhecido');

const reportScanFailure = (error: unknown): void => {
      process.exitCode = 1;
      console.error(`Falha ao executar o scan: ${formatErrorChain(error)}`);
};

const printResult = (result: ScanResult, options: ScanOutputOptions): void => {
      if (options.json) {
            console.log(toJsonReport(result));
            return;
      }
      printConsoleReport(result);
};

const writeMarkdownReportIfNeeded = async (result: ScanResult, targetDir: string): Promise<void> => {
      if (result.findings.length <= MARKDOWN_REPORT_FINDINGS_THRESHOLD) {
            return;
      }

      const filePath = join(targetDir, generateMarkdownReportFilename());
      try {
            // codesentry-disable-next-line security/detect-non-literal-fs-filename -- the report name is generated locally.
            await writeFile(filePath, toMarkdownReport(result), 'utf-8');
            console.log(chalk.cyan(`\nRelatório detalhado gerado em: ${filePath}`));
      } catch (error) {
            console.error(chalk.red(`Não foi possível gerar o relatório Markdown: ${errorMessage(error)}`));
      }
};

const runNativeAndSemgrep = async (path: string, rules: Rule[], options: ScanOutputOptions): Promise<ScanResult> => {
      try {
            const includeTests = options.tests ?? false;
            const nativeResult = await runScan(path, rules, options.concurrency, includeTests);
            return options.semgrep
                  ? mergeScanResults(
                          nativeResult,
                          await runBundledSemgrep(path, undefined, options.config, undefined, includeTests),
                    )
                  : nativeResult;
      } catch (error) {
            throw new Error(`Falha durante a análise: ${errorMessage(error)}`, { cause: error });
      }
};

const runOptionalDependencyAudit = async (
      path: string,
      merged: ScanResult,
      options: ScanOutputOptions,
): Promise<ScanResult> => {
      try {
            const auditResult = await runDependencyAudit(path, { nvdEnabled: options.nvd ?? true });
            return finalizeScanResult(
                  {
                        ...merged,
                        findings: [...merged.findings, ...auditResult.findings],
                        durationMs: merged.durationMs + auditResult.durationMs,
                        warnings: [...(merged.warnings ?? []), ...(auditResult.warnings ?? [])],
                        engines: {
                              ...merged.engines,
                              osv: auditResult.engines?.osv,
                              nvd: auditResult.engines?.nvd,
                        },
                        osvCheckedPackages: auditResult.osvCheckedPackages,
                  },
                  auditResult.engines?.dependencyAudit ?? false,
            );
      } catch (error) {
            return finalizeScanResult({
                  ...merged,
                  warnings: [...(merged.warnings ?? []), `Auditoria de dependências falhou: ${errorMessage(error)}.`],
                  engines: { ...merged.engines, nvd: false },
            });
      }
};

const runScanEngines = async (path: string, rules: Rule[], options: ScanOutputOptions): Promise<ScanResult> => {
      try {
            const merged = await runNativeAndSemgrep(path, rules, options);
            return options.deps ? runOptionalDependencyAudit(path, merged, options) : finalizeScanResult(merged);
      } catch (error) {
            throw error;
      }
};

const createScanTasks = (
      path: string,
      rules: Rule[],
      taskTitle: string,
      options: ScanOutputOptions,
      onResult: (result: ScanResult) => void,
) =>
      new Listr([
            {
                  title: taskTitle,
                  task: async () => {
                        try {
                              onResult(await runScanEngines(path, rules, options));
                        } catch (error) {
                              throw error;
                        }
                  },
            },
      ]);

export const scanAndReport = async (
      path: string,
      rules: Rule[],
      taskTitle: string,
      options: ScanOutputOptions,
): Promise<void> => {
      let result: ScanResult | undefined;
      const tasks = createScanTasks(path, rules, taskTitle, options, (scanResult) => {
            result = scanResult;
      });

      try {
            await tasks.run();
            if (result) {
                  printResult(result, options);
                  await writeMarkdownReportIfNeeded(result, path);
            }
      } catch (error) {
            reportScanFailure(error);
      }
};
