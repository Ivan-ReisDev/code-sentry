import type { Command } from 'commander';
import { expressMissingBodyLimitRule } from '../../rules/express-missing-body-limit.rule.js';
import { withScanOptions } from '../scan/scan-options.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerExpressMissingBodyLimitCommand = (program: Command): void => {
      withScanOptions(
            program
                  .command('express-missing-body-limit')
                  .description('Detecta middlewares de body parsing do Express sem limite de tamanho de requisição')
                  .argument('[path]', 'diretório a ser analisado', '.'),
      ).action((path: string, options: ScanOutputOptions) =>
            scanAndReport(path, [expressMissingBodyLimitRule], 'Checking Express body limits...', options),
      );
};
