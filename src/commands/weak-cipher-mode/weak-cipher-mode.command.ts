import type { Command } from 'commander';
import { weakCipherModeRule } from '../../rules/weak-cipher-mode.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerWeakCipherModeCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('weak-cipher-mode')
                  .description('Detecta o uso de modos de cifra fracos (CBC, ECB) em createCipheriv/createDecipheriv')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [weakCipherModeRule], 'Checking weak cipher modes...', options),
      );
};
