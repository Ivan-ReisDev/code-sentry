import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { Listr } from 'listr2';
import { formatErrorChain } from '../../errors.js';
import { printConsoleReport } from '../../reporters/console.reporter.js';
import { toJsonReport } from '../../reporters/json.reporter.js';
import { toMarkdownReport } from '../../reporters/markdown.reporter.js';
import type { Rule } from '../../rules/rule.interface.js';
import { mergeScanResults, type ScanResult } from '../../scanner/scan-result.js';
import { runScan } from '../../scanner/scanner.js';
import { runBundledSemgrep } from '../../scanner/semgrep.js';
import { generateMarkdownReportFilename, MARKDOWN_REPORT_FINDINGS_THRESHOLD } from './report-filename.js';

export interface ScanOutputOptions {
      json?: boolean;
      concurrency?: number;
      config?: string;
      /** Internal: scan command always enables the bundled Semgrep engine. */
      semgrep?: boolean;
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

const runScanEngines = async (path: string, rules: Rule[], options: ScanOutputOptions): Promise<ScanResult> => {
      try {
            const nativeResult = await runScan(path, rules, options.concurrency);
            if (!options.semgrep) {
                  return nativeResult;
            }
            const semgrepResult = await runBundledSemgrep(path, undefined, options.config);
            return mergeScanResults(nativeResult, semgrepResult);
      } catch (error) {
            throw new Error(`Falha durante a análise: ${errorMessage(error)}`, { cause: error });
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
