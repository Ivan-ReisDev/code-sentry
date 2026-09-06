import type { Command } from 'commander';
import { highComplexityRule } from '../../rules/high-complexity.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerHighComplexityCommand = (program: Command): void => {
  program
    .command('high-complexity')
    .description('Detecta funções com muitos condicionais/loops (complexidade alta)')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action((path: string, options: ScanOutputOptions) =>
      scanAndReport(path, [highComplexityRule], 'Checking function complexity...', options),
    );
};
