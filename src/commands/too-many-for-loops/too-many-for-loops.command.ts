import type { Command } from 'commander';
import { tooManyForLoopsRule } from '../../rules/too-many-for-loops.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerTooManyForLoopsCommand = (program: Command): void => {
      program
            .command('too-many-for-loops')
            .description('Detecta funções com muitos loops "for"/"for-in"/"for-of"')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, [tooManyForLoopsRule], 'Checking for-loop count...', options),
            );
};
