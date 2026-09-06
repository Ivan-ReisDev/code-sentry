import type { Command } from 'commander';
import { permissiveCorsRule } from '../../rules/permissive-cors.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerPermissiveCorsCommand = (program: Command): void => {
      program
            .command('permissive-cors')
            .description('Detecta CORS configurado para permitir qualquer origem')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, [permissiveCorsRule], 'Checking permissive CORS...', options),
            );
};
