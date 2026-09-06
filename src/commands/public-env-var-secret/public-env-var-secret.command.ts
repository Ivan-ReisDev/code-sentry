import type { Command } from 'commander';
import { publicEnvVarSecretRule } from '../../rules/public-env-var-secret.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerPublicEnvVarSecretCommand = (program: Command): void => {
      program
            .command('public-env-var-secret')
            .description('Detecta uma variável de ambiente pública (NEXT_PUBLIC_/VITE_/REACT_APP_) com nome de segredo')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action(async (path: string, options: ScanOutputOptions) => {
                  await scanAndReport(path, [publicEnvVarSecretRule], 'Checking public env var secrets...', options);
            });
};
