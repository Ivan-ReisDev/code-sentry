import type { Command } from 'commander';
import { commandInjectionRule } from '../../rules/command-injection.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerCommandInjectionCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('command-injection')
                  .description('Detecta child_process.exec()/execSync() recebendo entrada externa')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [commandInjectionRule], 'Checking command injection...', options),
      );
};
