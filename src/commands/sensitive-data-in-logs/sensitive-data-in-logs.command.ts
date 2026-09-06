import type { Command } from 'commander';
import { sensitiveDataInLogsRule } from '../../rules/sensitive-data-in-logs.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerSensitiveDataInLogsCommand = (program: Command): void => {
  program
    .command('sensitive-data-in-logs')
    .description('Detecta senhas/segredos/tokens sendo passados para chamadas de log')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action(async (path: string, options: ScanOutputOptions) => {
      await scanAndReport(path, [sensitiveDataInLogsRule], 'Checking sensitive data in logs...', options);
    });
};
