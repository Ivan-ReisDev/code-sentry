import type { Command } from 'commander';
import { Listr } from 'listr2';
import { toJsonReport } from '../reporters/json.reporter.js';
import { printConsoleReport } from '../reporters/console.reporter.js';
import { allRules } from '../rules/index.js';
import { runScan } from '../scanner/scanner.js';
import type { ScanResult } from '../scanner/scan-result.js';

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Analisa um diretório em busca de vulnerabilidades e problemas de qualidade')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action(async (path: string, options: { json?: boolean }) => {
      let result: ScanResult | undefined;

      const tasks = new Listr([
        {
          title: 'Scanning files...',
          task: async () => {
            result = await runScan(path, allRules);
          },
        },
      ]);

      await tasks.run();

      if (!result) {
        return;
      }

      if (options.json) {
        console.log(toJsonReport(result));
      } else {
        printConsoleReport(result);
      }
    });
}
