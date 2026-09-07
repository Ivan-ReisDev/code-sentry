import type { Command } from 'commander';
import { highComplexityRule } from '../../rules/high-complexity.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerHighComplexityCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('high-complexity')
                  .description('Detecta funções com muitos condicionais/loops (complexidade alta)')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [highComplexityRule], 'Checking function complexity...', options),
      );
};
