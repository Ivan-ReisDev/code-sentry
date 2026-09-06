import type { Command } from 'commander';
import { jwtDecodeWithoutVerifyRule } from '../../rules/jwt-decode-without-verify.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerJwtDecodeWithoutVerifyCommand = (program: Command): void => {
      program
            .command('jwt-decode-without-verify')
            .description('Detecta decodificação manual de um token (base64 + JSON.parse) sem verificar a assinatura')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action(async (path: string, options: ScanOutputOptions) => {
                  await scanAndReport(
                        path,
                        [jwtDecodeWithoutVerifyRule],
                        'Checking JWT decode without verification...',
                        options,
                  );
            });
};
