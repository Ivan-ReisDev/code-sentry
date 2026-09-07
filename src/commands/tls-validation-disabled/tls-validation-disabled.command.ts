import type { Command } from 'commander';
import { tlsValidationDisabledRule } from '../../rules/tls-validation-disabled.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerTlsValidationDisabledCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('tls-validation-disabled')
                  .description('Detecta a desativação da validação de certificados TLS')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [tlsValidationDisabledRule], 'Checking TLS validation...', options),
      );
};
