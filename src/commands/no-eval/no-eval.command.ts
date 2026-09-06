import type { Command } from 'commander';
import { noEvalRule } from '../../rules/no-eval.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerNoEvalCommand = (program: Command): void => {
  program
    .command('no-eval')
    .description('Detecta o uso de eval() ou new Function()')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action((path: string, options: ScanOutputOptions) =>
      scanAndReport(path, [noEvalRule], 'Checking eval/new Function usage...', options),
    );
};
