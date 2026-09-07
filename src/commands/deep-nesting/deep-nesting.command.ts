import type { Command } from 'commander';
import { deepNestingRule } from '../../rules/deep-nesting.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerDeepNestingCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('deep-nesting')
                  .description('Detecta blocos aninhados além do limite recomendado')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [deepNestingRule], 'Checking nesting depth...', options),
      );
};
