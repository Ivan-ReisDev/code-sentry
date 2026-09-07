import type { Command } from 'commander';
import { permissiveCorsRule } from '../../rules/permissive-cors.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerPermissiveCorsCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('permissive-cors')
                  .description('Detecta CORS configurado para permitir qualquer origem')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [permissiveCorsRule], 'Checking permissive CORS...', options),
      );
};
