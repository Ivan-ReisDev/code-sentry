import type { Command } from 'commander';
import { longFunctionRule } from '../../rules/long-function.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerLongFunctionsCommand = (program: Command): void => {
  program
    .command('long-functions')
    .description('Detecta funções com mais de 30 linhas')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action((path: string, options: ScanOutputOptions) =>
      scanAndReport(path, [longFunctionRule], 'Checking function length...', options),
    );
};
