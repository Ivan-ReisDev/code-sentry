import type { Command } from 'commander';
import { noAnyRule } from '../../rules/no-any.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerNoAnyCommand = (program: Command): void => {
  program
    .command('no-any')
    .description('Detecta o uso do tipo "any" no TypeScript')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action((path: string, options: ScanOutputOptions) =>
      scanAndReport(path, [noAnyRule], 'Checking any usage...', options),
    );
};
