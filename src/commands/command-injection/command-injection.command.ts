import type { Command } from 'commander';
import { commandInjectionRule } from '../../rules/command-injection.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerCommandInjectionCommand = (program: Command): void => {
      program
            .command('command-injection')
            .description('Detecta child_process.exec()/execSync() recebendo entrada externa')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, [commandInjectionRule], 'Checking command injection...', options),
            );
};
