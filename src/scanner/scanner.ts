import { readFile } from 'node:fs/promises';
import type { Rule, RuleFinding } from '../rules/rule.interface.js';
import { findFiles } from './file-finder.js';
import { runWithConcurrencyLimit } from './run-with-concurrency-limit.js';
import type { ScanResult } from './scan-result.js';

export const DEFAULT_SCAN_CONCURRENCY = 10;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'erro desconhecido';

const parseErrorFinding = (filePath: string, error: unknown): RuleFinding => ({
  ruleId: 'parse-error',
  message: `Não foi possível analisar este arquivo (erro de sintaxe): ${errorMessage(error)}`,
  file: filePath,
  line: 1,
  severity: 'low',
});

const readFileContent = async (filePath: string): Promise<string> => {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Não foi possível ler o arquivo "${filePath}".`, { cause: error });
  }
};

const scanFile = async (filePath: string, rules: Rule[]): Promise<RuleFinding[]> => {
  const content = await readFileContent(filePath);
  const findings: RuleFinding[] = [];
  let hasParseError = false;

  for (const rule of rules) {
    try {
      findings.push(...rule.check(filePath, content));
    } catch (error) {
      if (!hasParseError) {
        findings.push(parseErrorFinding(filePath, error));
        hasParseError = true;
      }
    }
  }

  return findings;
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
    };
  } catch (error) {
    throw new Error(`Não foi possível concluir a análise de "${targetDir}".`, { cause: error });
  }
};
