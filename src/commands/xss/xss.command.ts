import type { Command } from 'commander';
import { xssRule } from '../../rules/xss.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerXssCommand = (program: Command): void => {
  program
    .command('xss')
    .description('Detecta sinks perigosos de XSS (innerHTML, document.write, etc.)')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action((path: string, options: ScanOutputOptions) =>
      scanAndReport(path, [xssRule], 'Checking XSS sinks...', options),
    );
};
