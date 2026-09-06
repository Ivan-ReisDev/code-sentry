import type { Command } from 'commander';
import { tooManyIfsRule } from '../../rules/too-many-ifs.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerTooManyIfsCommand = (program: Command): void => {
  program
    .command('too-many-ifs')
    .description('Detecta funções com muitos "if" (incluindo "else if")')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action(async (path: string, options: ScanOutputOptions) => {
      await scanAndReport(path, [tooManyIfsRule], 'Checking if count...', options);
    });
};
