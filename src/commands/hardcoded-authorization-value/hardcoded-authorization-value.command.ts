import type { Command } from 'commander';
import { hardcodedAuthorizationValueRule } from '../../rules/hardcoded-authorization-value.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerHardcodedAuthorizationValueCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('hardcoded-authorization-value')
                  .description('Detecta comparação de headers/cookies de autorização com um valor fixo no código')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [hardcodedAuthorizationValueRule], 'Checking hardcoded authorization values...', options),
      );
};
