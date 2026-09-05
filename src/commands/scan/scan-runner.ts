import { Listr } from 'listr2';
import { printConsoleReport } from '../../reporters/console.reporter.js';
import { toJsonReport } from '../../reporters/json.reporter.js';
import type { Rule } from '../../rules/rule.interface.js';
import type { ScanResult } from '../../scanner/scan-result.js';
import { runScan } from '../../scanner/scanner.js';

export interface ScanOutputOptions {
  json?: boolean;
}

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
      task: async () => {
        result = await runScan(path, rules);
      },
    },
  ]);

  await tasks.run();
  if (result) {
    printResult(result, options);
  }
};
