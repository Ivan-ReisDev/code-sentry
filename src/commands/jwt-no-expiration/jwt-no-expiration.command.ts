import type { Command } from 'commander';
import { jwtNoExpirationRule } from '../../rules/jwt-no-expiration.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerJwtNoExpirationCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('jwt-no-expiration')
                  .description('Detecta jwt.sign() sem expiração configurada')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [jwtNoExpirationRule], 'Checking JWT expiration...', options),
      );
};
