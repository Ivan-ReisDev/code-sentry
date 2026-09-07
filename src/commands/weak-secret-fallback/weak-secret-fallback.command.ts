import type { Command } from 'commander';
import { weakSecretFallbackRule } from '../../rules/weak-secret-fallback.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerWeakSecretFallbackCommand = (program: Command): void => {
      program
            .command('weak-secret-fallback')
            .description(
                  'Detecta uma variável de ambiente de segredo/chave com um valor hardcoded como fallback (|| ou ??)',
            )
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, [weakSecretFallbackRule], 'Checking weak secret fallbacks...', options),
            );
};
