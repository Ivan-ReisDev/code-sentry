import { execFile } from 'node:child_process';
import { delimiter, dirname } from 'node:path';
import { promisify } from 'node:util';
import { ALWAYS_IGNORED_DIR_NAMES, TEST_DIR_NAMES, TEST_FILE_GLOBS } from './ignore-patterns.js';
import type { RuleFinding, Severity } from '../rules/rule.interface.js';
import type { ScanResult } from './scan-result.js';
import { resolveBundledSemgrepRuntime, type BundledSemgrepRuntime } from './semgrep-runtime.js';
import { resolveBundledSemgrepRuleset } from './semgrep-rules.js';

const execFileAsync = promisify(execFile);

const SEMGREP_SEVERITIES: Record<string, Severity> = {
      INFO: 'low',
      WARNING: 'medium',
      ERROR: 'high',
      CRITICAL: 'critical',
};

export interface SemgrepReport {
      results: SemgrepFinding[];
      paths?: { scanned: string[] };
}

export interface SemgrepFinding {
      check_id: string;
      path: string;
      start: { line: number };
      extra: { message: string; severity: string };
}

export const parseSemgrepReport = (stdout: string): SemgrepReport => {
      try {
            const report = JSON.parse(stdout) as Partial<SemgrepReport>;
            if (!Array.isArray(report.results)) {
                  throw new Error('campo "results" ausente');
            }
            return { results: report.results, paths: report.paths };
      } catch (error) {
            const reason = error instanceof Error ? error.message : 'erro desconhecido';
            throw new Error(`Semgrep retornou JSON inválido: ${reason}`, { cause: error });
      }
};

export const mapSemgrepReportToFindings = (report: SemgrepReport): RuleFinding[] =>
      report.results.map((finding) => ({
            ruleId: `semgrep/${finding.check_id}`,
            message: finding.extra.message,
            file: finding.path,
            line: finding.start.line,
            severity: SEMGREP_SEVERITIES[finding.extra.severity] ?? 'medium',
      }));

const outputFromError = (error: unknown): string | undefined =>
      typeof (error as { stdout?: unknown }).stdout === 'string' ? (error as { stdout: string }).stdout : undefined;

export type SemgrepExecutor = (
      file: string,
      args: string[],
      options: { cwd: string; maxBuffer: number; env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string }>;

const excludeArgs = (names: readonly string[]): string[] => names.flatMap((name) => ['--exclude', name]);

const semgrepArgs = (ruleset: string, includeTests: boolean): string[] => [
      'scan',
      '--config',
      ruleset,
      '--metrics=off',
      '--json',
      '--quiet',
      ...excludeArgs(ALWAYS_IGNORED_DIR_NAMES),
      ...(includeTests ? [] : excludeArgs([...TEST_DIR_NAMES, ...TEST_FILE_GLOBS])),
      // Não repetir targetDir aqui: o processo já roda com cwd = targetDir,
      // então o alvo relativo a esse cwd é o diretório atual.
      '.',
];

// O Semgrep executa um auxiliar interno ("pysemgrep") pelo nome, procurando-o no PATH,
// em vez de por caminho absoluto — o diretório do runtime precisa vir na frente do PATH
// para que esse auxiliar (instalado ao lado do executável semgrep) seja encontrado. E o
// launcher .exe do Windows resolve seu próprio interpretador via "#!python.exe" (também
// por PATH), mas python.exe fica um nível ACIMA de Scripts/ nesse layout — sem o diretório
// pai também no PATH, ele acaba achando outro python.exe qualquer, sem semgrep instalado.
// Também acrescentamos as pastas padrão do sistema como fallback: o Semgrep chama
// ferramentas do sistema (ex.: git, para decidir quais arquivos escanear) por nome, e
// processos pai como "npx" substituem o PATH herdado só por diretórios node_modules/.bin,
// derrubando /usr/bin e /bin — sem erro, o Semgrep simplesmente escaneia zero arquivos.
const semgrepEnvironment = (runtime: BundledSemgrepRuntime): NodeJS.ProcessEnv => {
      const semgrepDir = dirname(runtime.semgrep);
      const systemPathFallback =
            process.platform === 'win32' ? 'C:\\Windows\\System32;C:\\Windows' : '/usr/local/bin:/usr/bin:/bin';
      return {
            ...process.env,
            PATH: `${semgrepDir}${delimiter}${dirname(semgrepDir)}${delimiter}${process.env.PATH ?? ''}${delimiter}${systemPathFallback}`,
      };
};

const executeSemgrep = async (
      targetDir: string,
      runtime: BundledSemgrepRuntime,
      ruleset: string,
      execute: SemgrepExecutor,
      includeTests: boolean,
): Promise<string> => {
      try {
            const { stdout } = await execute(runtime.semgrep, semgrepArgs(ruleset, includeTests), {
                  cwd: targetDir,
                  maxBuffer: 20 * 1024 * 1024,
                  env: semgrepEnvironment(runtime),
            });
            return stdout;
      } catch (error) {
            const output = outputFromError(error);
            if (output) {
                  return output;
            }
            throw new Error('Não foi possível executar o Semgrep embutido.', { cause: error });
      }
};

export const runBundledSemgrep = async (
      targetDir: string,
      runtime: BundledSemgrepRuntime = resolveBundledSemgrepRuntime(),
      ruleset: string = resolveBundledSemgrepRuleset(),
      execute: SemgrepExecutor = execFileAsync,
      includeTests = false,
): Promise<ScanResult> => {
      const startedAt = Date.now();
      try {
            const report = parseSemgrepReport(await executeSemgrep(targetDir, runtime, ruleset, execute, includeTests));
            const scannedFiles = report.paths?.scanned.length ?? 0;
            return {
                  scannedFiles,
                  findings: mapSemgrepReportToFindings(report),
                  durationMs: Date.now() - startedAt,
                  engines: { semgrep: scannedFiles },
            };
      } catch (error) {
            throw new Error('Não foi possível processar o resultado do Semgrep.', { cause: error });
      }
};
