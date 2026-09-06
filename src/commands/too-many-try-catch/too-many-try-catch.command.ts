import type { Command } from 'commander';
import { tooManyTryCatchRule } from '../../rules/too-many-try-catch.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerTooManyTryCatchCommand = (program: Command): void => {
      program
            .command('too-many-try-catch')
            .description('Detecta funções com muitos blocos "try/catch"')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, [tooManyTryCatchRule], 'Checking try/catch count...', options),
            );
};
