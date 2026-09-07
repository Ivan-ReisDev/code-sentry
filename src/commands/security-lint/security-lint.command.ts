import type { Command } from 'commander';
import { securityLintRule } from '../../rules/security-lint.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerSecurityLintCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('security-lint')
                  .description('Detecta padrões de segurança genéricos via eslint-plugin-security')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [securityLintRule], 'Checking generic security patterns...', options),
      );
};
