import type { Command } from 'commander';

export const withScanOptions = (command: Command): Command =>
      command
            .option('--json', 'exibe o resultado em JSON')
            .option('--tests', 'inclui arquivos de teste na análise (por padrão são ignorados)');
