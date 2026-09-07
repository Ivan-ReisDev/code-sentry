import type { Command } from 'commander';
import { insecureRandomTokenRule } from '../../rules/insecure-random-token.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerInsecureRandomTokenCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('insecure-random-token')
                  .description('Detecta o uso de Math.random() para gerar tokens/segredos previsíveis')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [insecureRandomTokenRule], 'Checking insecure random tokens...', options),
      );
};
