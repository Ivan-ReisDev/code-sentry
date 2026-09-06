import type { Command } from 'commander';
import { unsafeSqlRule } from '../../rules/unsafe-sql.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerUnsafeSqlCommand = (program: Command): void => {
  program
    .command('unsafe-sql')
    .description('Detecta concatenação insegura de SQL (risco de SQL injection)')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action((path: string, options: ScanOutputOptions) =>
      scanAndReport(path, [unsafeSqlRule], 'Checking unsafe SQL...', options),
    );
};
