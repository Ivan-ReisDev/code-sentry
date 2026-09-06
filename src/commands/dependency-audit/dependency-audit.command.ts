import type { Command } from 'commander';
import { printConsoleReport } from '../../reporters/console.reporter.js';
import { toJsonReport } from '../../reporters/json.reporter.js';
import { runDependencyAudit } from '../../scanner/dependency-audit.js';
import type { ScanOutputOptions } from '../scan/scan-runner.js';

const printAuditResult = (result: Awaited<ReturnType<typeof runDependencyAudit>>, json: boolean): void => {
      if (json) {
            console.log(toJsonReport(result));
            return;
      }
      printConsoleReport(result);
};

const auditAndReport = async (path: string, options: ScanOutputOptions): Promise<void> => {
      try {
            printAuditResult(await runDependencyAudit(path), options.json ?? false);
      } catch (error) {
            const message = error instanceof Error ? error.message : 'erro desconhecido';
            process.exitCode = 1;
            console.error(`Falha ao auditar dependências: ${message}`);
      }
};

export const registerDependencyAuditCommand = (program: Command): void => {
      program
            .command('dependency-audit')
            .description(
                  'Audita as dependências do projeto contra vulnerabilidades conhecidas (via "npm audit"; requer npm no PATH e acesso à rede)',
            )
            .argument('[path]', 'diretório do projeto a ser auditado', '.')
            .option('--json', 'exibe o resultado em JSON')
            .action((path: string, options: ScanOutputOptions) => auditAndReport(path, options));
};
