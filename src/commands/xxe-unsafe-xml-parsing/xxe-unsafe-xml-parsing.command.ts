import type { Command } from 'commander';
import { xxeUnsafeXmlParsingRule } from '../../rules/xxe-unsafe-xml-parsing.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerXxeUnsafeXmlParsingCommand = (program: Command): void => {
  program
    .command('xxe-unsafe-xml-parsing')
    .description('Detecta parsing de XML com noent/dtdload habilitados (risco de XXE)')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action(async (path: string, options: ScanOutputOptions) => {
      await scanAndReport(path, [xxeUnsafeXmlParsingRule], 'Checking unsafe XML parsing...', options);
    });
};
