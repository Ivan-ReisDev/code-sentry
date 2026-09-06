import type { Command } from 'commander';
import { resolve } from 'node:path';
import { allRules } from '../../rules/index.js';
import { scanAndReport, type ScanOutputOptions } from './scan-runner.js';

export const parseConcurrency = (value: string): number => {
      const concurrency = Number(value);
      if (!Number.isInteger(concurrency) || concurrency < 1) {
            throw new Error('A concorrência deve ser um inteiro positivo.');
      }
      return concurrency;
};

export const parseLocalSemgrepConfig = (value: string): string => {
      if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
            throw new Error('A configuração do Semgrep deve ser um arquivo local.');
      }
      return resolve(value);
};

export const registerScanCommand = (program: Command): void => {
      program
            .command('scan')
            .description('Analisa um diretório em busca de vulnerabilidades e problemas de qualidade')
            .argument('[path]', 'diretório a ser analisado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .option('--concurrency <n>', 'limita arquivos processados em paralelo', parseConcurrency)
            .option('--config <file>', 'usa um ruleset Semgrep YAML local', parseLocalSemgrepConfig)
            .action((path: string, options: ScanOutputOptions) =>
                  scanAndReport(path, allRules, 'Scanning files...', { ...options, semgrep: true }),
            );
};
