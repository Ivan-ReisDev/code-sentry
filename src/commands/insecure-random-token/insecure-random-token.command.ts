import type { Command } from 'commander';
import { insecureRandomTokenRule } from '../../rules/insecure-random-token.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerInsecureRandomTokenCommand = (program: Command): void => {
      program
            .command('insecure-random-token')
            .description('Detecta o uso de Math.random() para gerar tokens/segredos previsíveis')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, [insecureRandomTokenRule], 'Checking insecure random tokens...', options),
            );
};
