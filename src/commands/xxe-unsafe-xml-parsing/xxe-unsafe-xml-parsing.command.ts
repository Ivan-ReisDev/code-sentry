import type { Command } from 'commander';
import { xxeUnsafeXmlParsingRule } from '../../rules/xxe-unsafe-xml-parsing.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerXxeUnsafeXmlParsingCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('xxe-unsafe-xml-parsing')
                  .description('Detecta parsing de XML com noent/dtdload habilitados (risco de XXE)')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [xxeUnsafeXmlParsingRule], 'Checking unsafe XML parsing...', options),
      );
};
