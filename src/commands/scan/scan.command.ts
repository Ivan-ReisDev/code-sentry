import type { Command } from 'commander';
import { allRules } from '../../rules/index.js';
import { scanAndReport, type ScanOutputOptions } from './scan-runner.js';

export const registerScanCommand = (program: Command): void => {
  program
    .command('scan')
    .description('Analisa um diretório em busca de vulnerabilidades e problemas de qualidade')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action((path: string, options: ScanOutputOptions) =>
      scanAndReport(path, allRules, 'Scanning files...', options),
    );
};
