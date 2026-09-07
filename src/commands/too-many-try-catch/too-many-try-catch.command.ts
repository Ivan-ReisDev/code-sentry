import type { Command } from 'commander';
import { tooManyTryCatchRule } from '../../rules/too-many-try-catch.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerTooManyTryCatchCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('too-many-try-catch')
                  .description('Detecta funções com muitos blocos "try/catch"')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [tooManyTryCatchRule], 'Checking try/catch count...', options),
      );
};
