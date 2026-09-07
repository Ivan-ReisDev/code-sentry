import type { Command } from 'commander';
import { jwtDecodeWithoutVerifyRule } from '../../rules/jwt-decode-without-verify.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerJwtDecodeWithoutVerifyCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('jwt-decode-without-verify')
                  .description(
                        'Detecta decodificação manual de um token (base64 + JSON.parse) sem verificar a assinatura',
                  )
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [jwtDecodeWithoutVerifyRule], 'Checking JWT decode without verification...', options),
      );
};
