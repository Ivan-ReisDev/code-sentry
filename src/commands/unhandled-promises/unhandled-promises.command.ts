import type { Command } from 'commander';
import { awaitNoTryCatchRule } from '../../rules/await-no-try-catch.rule.js';
import { floatingPromiseRule } from '../../rules/floating-promise.rule.js';
import { promiseNoCatchRule } from '../../rules/promise-no-catch.rule.js';
import { scanAndReport, type ScanOutputOptions } from '../scan/scan-runner.js';

export const registerUnhandledPromisesCommand = (program: Command): void => {
      program
            .command('unhandled-promises')
            .description('Detecta promises sem tratamento (sem .catch, await sem try/catch ou promises soltas)')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(
                        path,
                        [promiseNoCatchRule, awaitNoTryCatchRule, floatingPromiseRule],
                        'Checking unhandled promises...',
                        options,
                  ),
            );
};
