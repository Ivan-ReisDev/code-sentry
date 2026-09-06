import type { Command } from 'commander';
import { deepNestingRule } from '../../rules/deep-nesting.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerDeepNestingCommand = (program: Command): void => {
      program
            .command('deep-nesting')
            .description('Detecta blocos aninhados além do limite recomendado')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, [deepNestingRule], 'Checking nesting depth...', options),
            );
};
