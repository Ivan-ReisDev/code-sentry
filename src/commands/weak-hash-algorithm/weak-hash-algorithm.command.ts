import type { Command } from 'commander';
import { weakHashAlgorithmRule } from '../../rules/weak-hash-algorithm.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerWeakHashAlgorithmCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('weak-hash-algorithm')
                  .description('Detecta o uso de algoritmos de hash fracos (MD5, SHA-1)')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [weakHashAlgorithmRule], 'Checking weak hash algorithms...', options),
      );
};
