import { readFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import type { Rule, RuleFinding } from '../rules/rule.interface.js';
import { findFiles } from './file-finder.js';
import { runWithConcurrencyLimit } from './run-with-concurrency-limit.js';
import type { ScanResult } from './scan-result.js';

export const DEFAULT_SCAN_CONCURRENCY = Math.max(1, Math.min(8, availableParallelism()));

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'erro desconhecido');

const parseErrorFinding = (filePath: string, error: unknown): RuleFinding => ({
      ruleId: 'parse-error',
      message: `Não foi possível analisar este arquivo (erro de sintaxe): ${errorMessage(error)}`,
      file: filePath,
      line: 1,
      severity: 'low',
});

const readFileContent = async (filePath: string): Promise<string> => {
      try {
            // codesentry-disable-next-line security/detect-non-literal-fs-filename -- filePath is emitted by findFiles().
            return await readFile(filePath, 'utf-8');
      } catch (error) {
            throw new Error(`Não foi possível ler o arquivo "${filePath}".`, { cause: error });
      }
};

const checkRule = (rule: Rule, filePath: string, content: string): { findings: RuleFinding[]; error?: unknown } => {
      try {
            return { findings: rule.check(filePath, content) };
      } catch (error) {
            return { findings: [], error };
      }
};

const scanFile = async (filePath: string, rules: Rule[]): Promise<RuleFinding[]> => {
      try {
            const content = await readFileContent(filePath);
            const findings: RuleFinding[] = [];
            let hasParseError = false;

            for (const rule of rules) {
                  const result = checkRule(rule, filePath, content);
                  findings.push(...result.findings);
                  if (result.error && !hasParseError) {
                        findings.push(parseErrorFinding(filePath, result.error));
                        hasParseError = true;
                  }
            }

            return findings;
      } catch (error) {
            throw new Error(`Não foi possível analisar o arquivo "${filePath}".`, { cause: error });
      }
};

export const runScan = async (
      targetDir: string,
      rules: Rule[],
      concurrency: number = DEFAULT_SCAN_CONCURRENCY,
): Promise<ScanResult> => {
      try {
            const startedAt = Date.now();
            const files = await findFiles(targetDir);
            const findings = (
                  await runWithConcurrencyLimit(files, concurrency, (filePath) => scanFile(filePath, rules))
            ).flat();

            return {
                  scannedFiles: files.length,
                  findings,
                  durationMs: Date.now() - startedAt,
                  engines: { codesentry: files.length },
            };
      } catch (error) {
            throw new Error(`Não foi possível concluir a análise de "${targetDir}".`, { cause: error });
      }
};
