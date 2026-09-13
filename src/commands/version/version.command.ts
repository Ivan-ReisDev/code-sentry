import type { Command } from 'commander';
import { loadEngineMetadata, type EngineMetadata } from '../../engines/engine-metadata.js';

interface VersionCommandOptions {
      engines?: boolean;
      json?: boolean;
}

export interface VersionReport {
      codesentryVersion: string;
      engines: EngineMetadata;
}

export const buildVersionReport = (codesentryVersion: string, engines: EngineMetadata): VersionReport => ({
      codesentryVersion,
      engines,
});

export const formatEngineVersions = (report: VersionReport): string => {
      const { semgrep, owaspRuleset } = report.engines;
      return [
            `CodeSentry: ${report.codesentryVersion}`,
            '',
            'Runtime Semgrep CE',
            `  Versão: ${semgrep.semgrepVersion}`,
            `  Python: ${semgrep.pythonVersion}`,
            `  Pacote: ${semgrep.packageName}`,
            `  SHA-256: ${semgrep.runtimeSha256}`,
            '',
            'Ruleset OWASP',
            `  Snapshot: ${owaspRuleset.ruleset}`,
            `  Versão do pacote: ${owaspRuleset.packageVersion}`,
            `  Origem: ${owaspRuleset.source}`,
            `  Capturado em: ${owaspRuleset.capturedAt}`,
            ...(owaspRuleset.upstreamRevision ? [`  Revisão upstream: ${owaspRuleset.upstreamRevision}`] : []),
            `  SHA-256: ${owaspRuleset.sha256}`,
      ].join('\n');
};

export const registerVersionCommand = (
      program: Command,
      readPackageVersion: () => string,
      readEngineMetadata: () => EngineMetadata = loadEngineMetadata,
): void => {
      program
            .command('version')
            .description('Exibe a versão do CodeSentry e dos motores embutidos')
            .option('--engines', 'inclui versões e proveniência do Semgrep e ruleset OWASP')
            .option('--json', 'emite o relatório de versões em JSON')
            .action((options: VersionCommandOptions) => {
                  const codesentryVersion = readPackageVersion();
                  if (!options.engines && !options.json) {
                        console.log(`CodeSentry: ${codesentryVersion}`);
                        return;
                  }

                  try {
                        const report = buildVersionReport(codesentryVersion, readEngineMetadata());
                        console.log(options.json ? JSON.stringify(report, null, 2) : formatEngineVersions(report));
                  } catch (error) {
                        const reason = error instanceof Error ? error.message : 'erro desconhecido';
                        process.exitCode = 1;
                        console.error(`Não foi possível auditar as versões dos motores: ${reason}`);
                  }
            });
};
