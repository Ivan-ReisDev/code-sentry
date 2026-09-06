import type { Command } from 'commander';
import { jwtNoExpirationRule } from '../../rules/jwt-no-expiration.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerJwtNoExpirationCommand = (program: Command): void => {
      program
            .command('jwt-no-expiration')
            .description('Detecta jwt.sign() sem expiração configurada')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, [jwtNoExpirationRule], 'Checking JWT expiration...', options),
            );
};
