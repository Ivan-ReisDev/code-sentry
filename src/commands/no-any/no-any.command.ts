import type { Command } from 'commander';
import { noAnyRule } from '../../rules/no-any.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerNoAnyCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('no-any')
                  .description('Detecta o uso do tipo "any" no TypeScript')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [noAnyRule], 'Checking any usage...', options),
      );
};
