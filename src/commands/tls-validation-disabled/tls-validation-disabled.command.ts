import type { Command } from 'commander';
import { tlsValidationDisabledRule } from '../../rules/tls-validation-disabled.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerTlsValidationDisabledCommand = (program: Command): void => {
  program
    .command('tls-validation-disabled')
    .description('Detecta a desativação da validação de certificados TLS')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action((path: string, options: ScanOutputOptions) =>
      scanAndReport(path, [tlsValidationDisabledRule], 'Checking TLS validation...', options),
    );
};
