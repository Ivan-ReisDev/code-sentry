import type { Command } from 'commander';
import { noEvalRule } from '../../rules/no-eval.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerNoEvalCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('no-eval')
                  .description('Detecta o uso de eval() ou new Function()')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [noEvalRule], 'Checking eval/new Function usage...', options),
      );
};
