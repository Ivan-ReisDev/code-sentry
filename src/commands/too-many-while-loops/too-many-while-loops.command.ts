import type { Command } from 'commander';
import { tooManyWhileLoopsRule } from '../../rules/too-many-while-loops.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerTooManyWhileLoopsCommand = (program: Command): void => {
      program
            .command('too-many-while-loops')
            .description('Detecta funções com muitos loops "while"/"do-while"')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, [tooManyWhileLoopsRule], 'Checking while-loop count...', options),
            );
};
