import type { Command } from 'commander';
import { securityLintRule } from '../../rules/security-lint.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerSecurityLintCommand = (program: Command): void => {
  program
    .command('security-lint')
    .description('Detecta padrões de segurança genéricos via eslint-plugin-security')
    .argument('[path]', 'diretório a ser analisado', '.')
    .option('--json', 'exibe o resultado em JSON')
    .action((path: string, options: ScanOutputOptions) =>
      scanAndReport(path, [securityLintRule], 'Checking generic security patterns...', options),
    );
};
