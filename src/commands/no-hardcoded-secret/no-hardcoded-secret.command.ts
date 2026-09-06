import type { Command } from 'commander';
import { noHardcodedSecretRule } from '../../rules/no-hardcoded-secret.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerNoHardcodedSecretCommand = (program: Command): void => {
      program
            .command('no-hardcoded-secret')
            .description('Detecta segredos/credenciais hardcoded no código-fonte')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, [noHardcodedSecretRule], 'Checking hardcoded secrets...', options),
            );
};
