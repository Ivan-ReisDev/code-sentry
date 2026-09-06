import { Listr } from 'listr2';
import { printConsoleReport } from '../../reporters/console.reporter.js';
import { toJsonReport } from '../../reporters/json.reporter.js';
import type { Rule } from '../../rules/rule.interface.js';
import type { ScanResult } from '../../scanner/scan-result.js';
import { runScan } from '../../scanner/scanner.js';

export interface ScanOutputOptions {
  json?: boolean;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'erro desconhecido';

const reportScanFailure = (error: unknown): void => {
  process.exitCode = 1;
  console.error(`Falha ao executar o scan: ${errorMessage(error)}`);
};

const printResult = (result: ScanResult, options: ScanOutputOptions): void => {
  if (options.json) {
    console.log(toJsonReport(result));
    return;
  }
  printConsoleReport(result);
};

export const scanAndReport = async (
  path: string,
  rules: Rule[],
  taskTitle: string,
  options: ScanOutputOptions,
): Promise<void> => {
  let result: ScanResult | undefined;
  const tasks = new Listr([
    {
      title: taskTitle,
      task: () =>
        runScan(path, rules)
          .then((scanResult) => {
            result = scanResult;
          })
          .catch((error: unknown) => {
            throw new Error(`Falha durante a análise: ${errorMessage(error)}`, { cause: error });
          }),
    },
  ]);

  try {
    await tasks.run();
    if (result) {
      printResult(result, options);
    }
  } catch (error) {
    reportScanFailure(error);
  }
};
