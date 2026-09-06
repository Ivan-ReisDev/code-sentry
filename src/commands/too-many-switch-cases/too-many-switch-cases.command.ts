import type { Command } from 'commander';
import { tooManySwitchCasesRule } from '../../rules/too-many-switch-cases.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerTooManySwitchCasesCommand = (program: Command): void => {
      program
            .command('too-many-switch-cases')
            .description('Detecta "switch" com muitos "case" (considere um mapa/lookup)')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, [tooManySwitchCasesRule], 'Checking switch cases...', options),
            );
};
