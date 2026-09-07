import type { Command } from 'commander';
import { emptyCatchRule } from '../../rules/empty-catch.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerEmptyCatchCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('empty-catch')
                  .description('Detecta blocos catch vazios')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [emptyCatchRule], 'Checking empty catch blocks...', options),
      );
};
